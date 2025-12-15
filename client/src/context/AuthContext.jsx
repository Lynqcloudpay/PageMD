import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';
import tokenManager from '../services/tokenManager';

// HIPAA Security: 15-minute inactivity timeout (in milliseconds)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

const AuthContext = createContext({
    user: null,
    loading: true,
    login: async () => { },
    logout: () => { },
    resetInactivityTimer: () => { }
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
    const lastActivityRef = useRef(Date.now());
    const inactivityTimerRef = useRef(null);

    // Reset inactivity timer on user activity
    const resetInactivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        tokenManager.updateActivity();
    }, []);

    // Check for inactivity and logout if needed
    const checkInactivity = useCallback(() => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityRef.current;

        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT && user) {
            console.log('Session expired due to inactivity');
            // Clear session and redirect to login
            tokenManager.clearToken();
            setUser(null);
            window.location.href = '/login?reason=inactivity';
        }
    }, [user]);

    // Set up inactivity monitoring
    useEffect(() => {
        if (!user) {
            // Clear interval if no user
            if (inactivityTimerRef.current) {
                clearInterval(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
            return;
        }

        // Track user activity
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        const handleActivity = () => {
            resetInactivityTimer();
        };

        // Add event listeners
        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Start inactivity check interval
        inactivityTimerRef.current = setInterval(checkInactivity, ACTIVITY_CHECK_INTERVAL);

        // Cleanup
        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            if (inactivityTimerRef.current) {
                clearInterval(inactivityTimerRef.current);
            }
        };
    }, [user, resetInactivityTimer, checkInactivity]);

    useEffect(() => {
        let mounted = true;
        let cancelled = false;

        const initAuth = async () => {
            // HIPAA SECURITY: Token is stored in memory only
            // Closing the browser tab = token is gone = must log in again
            // This is the most secure approach for PHI protection
            const token = tokenManager.getToken();

            if (!token) {
                // No token in memory - user must log in
                if (mounted && !cancelled) {
                    setUser(null);
                    setLoading(false);
                }
                return;
            }

            // Check for inactivity timeout
            const lastActivity = tokenManager.getLastActivity();
            if (lastActivity) {
                const timeSinceLastActivity = Date.now() - lastActivity;
                if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
                    // Session expired due to inactivity
                    console.log('Session expired - was inactive for too long');
                    tokenManager.clearToken();
                    if (mounted && !cancelled) {
                        setUser(null);
                        setLoading(false);
                    }
                    return;
                }
            }

            try {
                const response = await authAPI.getMe();

                if (mounted && !cancelled && response && response.data) {
                    setUser(response.data);
                    resetInactivityTimer();
                } else if (mounted && !cancelled) {
                    // No valid user data, clear token
                    tokenManager.clearToken();
                    setUser(null);
                }
            } catch (error) {
                // Token invalid or error, clear it
                if (mounted && !cancelled) {
                    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                        console.warn('Auth check request timed out');
                        tokenManager.clearToken();
                        setUser(null);
                    } else if (error.response?.status === 401 || error.response?.status === 403) {
                        // Invalid token
                        tokenManager.clearToken();
                        setUser(null);
                    } else if (error.response?.status !== 429) {
                        // Other errors (but not rate limit)
                        console.warn('Auth check failed:', error.message || 'Network error');
                        tokenManager.clearToken();
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
                tokenManager.clearToken();
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
            console.log('AuthContext: Attempting login for', email);
            const response = await authAPI.login(email, password);
            console.log('AuthContext: Login response', response);
            if (response.data.token) {
                // HIPAA SECURITY: Token stored in memory ONLY
                // Closing tab = token gone = must log in again
                console.log('AuthContext: Token received, updating state');
                tokenManager.setToken(response.data.token);
                tokenManager.setRememberedUsername(email);
                setUser(response.data.user);
                resetInactivityTimer();
                console.log('AuthContext: User state updated', response.data.user);
                return response.data;
            } else {
                console.warn('AuthContext: Login successful but no token received');
            }
        } catch (error) {
            console.error('AuthContext: Login error', error);
            throw error;
        }
    };

    const logout = () => {
        tokenManager.clearToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, resetInactivityTimer }}>
            {children}
        </AuthContext.Provider>
    );
};
