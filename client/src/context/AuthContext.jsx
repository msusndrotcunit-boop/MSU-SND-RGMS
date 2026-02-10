import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('cadetId');
        localStorage.removeItem('isProfileCompleted');
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    }, []);

    const login = useCallback(async (userData) => {
        const normalizedRole = (userData.role || '').toLowerCase();
        localStorage.setItem('token', userData.token);
        localStorage.setItem('role', normalizedRole);
        if (userData.cadetId) localStorage.setItem('cadetId', userData.cadetId);
        if (userData.isProfileCompleted !== undefined) localStorage.setItem('isProfileCompleted', userData.isProfileCompleted);
        
        setUser({ ...userData, role: normalizedRole });
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const roleRaw = localStorage.getItem('role');
            const role = (roleRaw || '').toLowerCase();
            const cadetId = localStorage.getItem('cadetId');
            const isProfileCompleted = localStorage.getItem('isProfileCompleted');
            
            if (token) {
                // Convert 'true'/'false' string back to boolean or null if undefined
                const isCompleted = isProfileCompleted === 'true' || isProfileCompleted === '1';
                setUser({ token, role, cadetId, isProfileCompleted: isCompleted });
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    // Heartbeat mechanism
    useEffect(() => {
        if (!user) return;

        const sendHeartbeat = async () => {
            try {
                await axios.post('/api/auth/heartbeat');
            } catch (error) {
                console.error('Heartbeat failed', error);
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    logout();
                }
            }
        };

        // Send initial heartbeat
        sendHeartbeat();

        // Set interval for every minute
        const intervalId = setInterval(sendHeartbeat, 60000);

        return () => clearInterval(intervalId);
    }, [user, logout]);

    const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
