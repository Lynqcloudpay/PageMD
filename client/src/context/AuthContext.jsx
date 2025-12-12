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
                    // Handle timeout errors
                    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                        console.warn('Auth check request timed out');
                        localStorage.removeItem('token');
                        setUser(null);
                    } else if (error.response?.status === 401 || error.response?.status === 403) {
                        // Invalid token
                        localStorage.removeItem('token');
                        setUser(null);
                    } else if (error.response?.status !== 429) {
                        // Other errors (but not rate limit)
                        console.warn('Auth check failed:', error.message || 'Network error');
                        localStorage.removeItem('token');
                        setUser(null);
                    } else {
                        // Rate limit - don't clear token
                        console.warn('Rate limited, will retry on next page load');
                    }
                }
            } finally {
                if (mounted && !cancelled) {
                    setLoading(false);
                }
            }
        };

        // Handle unauthorized events from API interceptor
        const handleUnauthorized = () => {
            if (mounted && !cancelled) {
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                // Redirect to login if not already there
                if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
                    window.location.href = '/login';
                }
            }
        };

        // Only run once on mount
        initAuth();
        
        // Listen for unauthorized events
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        
        return () => {
            cancelled = true;
            mounted = false;
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
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

