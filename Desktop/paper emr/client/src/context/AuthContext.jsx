import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext({
    user: null,
    loading: true,
    login: async () => {},
    logout: () => {}
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        let cancelled = false;
        
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                if (mounted && !cancelled) {
                    setUser(null);
                    setLoading(false);
                }
                return;
            }

            try {
                const response = await authAPI.getMe();
                if (mounted && !cancelled && response && response.data) {
                    setUser(response.data);
                } else if (mounted && !cancelled) {
                    // No valid user data, clear token
                    localStorage.removeItem('token');
                    setUser(null);
                }
            } catch (error) {
                // Token invalid or error, clear it
                if (mounted && !cancelled) {
                    // Only log if not a rate limit error
                    if (error.response?.status !== 429) {
                        console.warn('Auth check failed:', error.message);
                    }
                    // Don't clear token on rate limit - just set loading to false
                    if (error.response?.status === 429) {
                        console.warn('Rate limited, will retry on next page load');
                    } else {
                        localStorage.removeItem('token');
                    }
                    setUser(null);
                }
            } finally {
                if (mounted && !cancelled) {
                    setLoading(false);
                }
            }
        };

        // Only run once on mount
        initAuth();
        
        return () => {
            cancelled = true;
            mounted = false;
        };
    }, []); // Empty deps - only run once

    const login = async (email, password) => {
        try {
            const response = await authAPI.login(email, password);
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                setUser(response.data.user);
                return response.data;
            }
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

