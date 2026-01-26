import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { auth } from '../lib/firebase';
import { signInWithCustomToken, signOut } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const syncFirebase = useCallback(async () => {
        try {
            // Only sync if we have a token (axios header should be set)
            if (!axios.defaults.headers.common['Authorization']) return;

            const res = await axios.get('/api/auth/firebase-token');
            const { token } = res.data;
            await signInWithCustomToken(auth, token);
            console.log("Firebase Auth Synced");
        } catch (error) {
            console.error("Firebase Sync Error:", error);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const cadetId = localStorage.getItem('cadetId');
        if (token) {
            setUser({ token, role, cadetId });
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Attempt to sync Firebase on load
            syncFirebase();
        }
        setLoading(false);
    }, [syncFirebase]);

    const login = useCallback(async (userData) => {
        localStorage.setItem('token', userData.token);
        localStorage.setItem('role', userData.role);
        if (userData.cadetId) localStorage.setItem('cadetId', userData.cadetId);
        
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
        
        // Sync with Firebase
        await syncFirebase();
    }, [syncFirebase]);

    const logout = useCallback(async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('cadetId');
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Firebase SignOut Error", e);
        }
    }, []);

    const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
