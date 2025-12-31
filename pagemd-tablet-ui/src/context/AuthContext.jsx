import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastActivity, setLastActivity] = useState(Date.now());

    // Check for existing session on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // Inactivity logout
    useEffect(() => {
        if (!user) return;

        const checkInactivity = setInterval(() => {
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                logout();
            }
        }, 60000); // Check every minute

        const resetActivity = () => setLastActivity(Date.now());

        window.addEventListener('mousedown', resetActivity);
        window.addEventListener('keydown', resetActivity);
        window.addEventListener('touchstart', resetActivity);

        return () => {
            clearInterval(checkInactivity);
            window.removeEventListener('mousedown', resetActivity);
            window.removeEventListener('keydown', resetActivity);
            window.removeEventListener('touchstart', resetActivity);
        };
    }, [user, lastActivity]);

    const login = useCallback(async (email, password) => {
        const response = await authAPI.login(email, password);
        const { token, user: userData } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setLastActivity(Date.now());

        return userData;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
