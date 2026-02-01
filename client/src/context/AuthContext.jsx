import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const role = localStorage.getItem('role');
            const cadetId = localStorage.getItem('cadetId');
            const isProfileCompleted = localStorage.getItem('isProfileCompleted');
            
            if (token) {
                // Convert 'true'/'false' string back to boolean or null if undefined
                const isCompleted = isProfileCompleted === 'true';
                setUser({ token, role, cadetId, isProfileCompleted: isCompleted });
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = useCallback(async (userData, token) => { // Updated signature to match usage in Login.jsx if needed, but Login.jsx calls login(user, token) - wait, Login.jsx calls login(user, token).
        // Actually, looking at Login.jsx: login(user, token). user object there is passed.
        // Let's check Login.jsx usage: login(user, token);
        // But AuthContext definition: login = (userData) => { ... }
        // This means Login.jsx is calling it wrong? Or userData IS the user object?
        // Login.jsx: const { token, user } = response.data; login(user, token);
        // If login takes one arg, then 'token' arg is ignored.
        // But user object likely contains token?
        // Let's check Login.jsx again.
        // response.data from standard login has { token, role, cadetId... } usually flattened?
        // No, Login.jsx says: const { token, user } = response.data;
        // But auth.js returns: res.json({ token, role: user.role, ... }) - FLATTENED!
        // So response.data IS { token, role, ... }
        // So const { token, user } = response.data is WRONG if the backend returns flattened structure.
        // Wait, auth.js returns: res.json({ token, role: user.role, cadetId: user.cadet_id });
        // So response.data = { token, role, cadetId }
        // Login.jsx: const { token, user } = response.data; -> user is undefined!
        // But then login(user, token) -> login(undefined, token).
        // Then inside login(userData): localStorage.setItem('token', userData.token) -> CRASH!
        // HOW DOES IT WORK CURRENTLY?
        // Maybe I misread auth.js or Login.jsx.
        
        // Let's re-read auth.js
        // res.json({ token, role: user.role, cadetId: user.cadet_id });
        
        // Let's re-read Login.jsx
        // const { token, user } = response.data;
        // login(user, token);
        
        // This looks broken for the standard flows unless response.data HAS 'user'.
        // Wait, standard login (admin):
        // res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id });
        // Still flattened.
        
        // Is it possible Login.jsx was recently changed or I am misinterpreting?
        // Or maybe response.data HAS user?
        // Ah, maybe previous implementation returned { token, user: { ... } }?
        // But I see current auth.js code.
        
        // Let's fix Login.jsx logic while I am at it.
        // And update AuthContext to handle the data correctly.
        
        // Let's look at AuthContext again.
        // login = (userData) => { localStorage.setItem('token', userData.token); ... }
        // It expects userData to have token.
        
        // So I should standardize.
        
        // In AuthContext:
        // Update login to accept (data) where data has token, role, etc.
        
        localStorage.setItem('token', userData.token);
        localStorage.setItem('role', userData.role);
        if (userData.cadetId) localStorage.setItem('cadetId', userData.cadetId);
        if (userData.isProfileCompleted !== undefined) localStorage.setItem('isProfileCompleted', userData.isProfileCompleted);
        
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    }, []);

    const logout = useCallback(async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('cadetId');
        localStorage.removeItem('isProfileCompleted');
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    }, []);

    const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
