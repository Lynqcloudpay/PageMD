import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';

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

    // Clear session when tab/browser is closed
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Set a flag indicating the page is unloading
            sessionStorage.setItem('sessionClosing', 'true');
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Page is visible again - check if session was marked as closing
                const wasClosing = sessionStorage.getItem('sessionClosing');
                if (wasClosing) {
                    // Clear the closing flag - this was just a tab switch, not a close
                    sessionStorage.removeItem('sessionClosing');
                }
            }
        };

        // On page load, check if this is a fresh browser session
        const sessionClosing = sessionStorage.getItem('sessionClosing');
        if (sessionClosing) {
            // Browser was closed and reopened with session restore - clear auth
            console.log('Previous session was not properly closed - clearing auth');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
            sessionStorage.removeItem('sessionClosing');
        }

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Reset inactivity timer on user activity
    const resetInactivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    // Check for inactivity and logout if needed
    const checkInactivity = useCallback(() => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityRef.current;

        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT && user) {
            console.log('Session expired due to inactivity');
            // Clear session and redirect to login
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
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
            // Store last activity time for cross-tab awareness
            sessionStorage.setItem('lastActivity', Date.now().toString());
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
            // SECURITY: Use sessionStorage instead of localStorage
            // Token is cleared when browser is closed
            const token = sessionStorage.getItem('token');
            if (!token) {
                if (mounted && !cancelled) {
                    setUser(null);
                    setLoading(false);
                }
                return;
            }

            // Check for stored last activity time
            const storedLastActivity = sessionStorage.getItem('lastActivity');
            if (storedLastActivity) {
                const timeSinceLastActivity = Date.now() - parseInt(storedLastActivity, 10);
                if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
                    // Session expired due to inactivity
                    console.log('Session expired - was inactive for too long');
                    sessionStorage.removeItem('token');
                    sessionStorage.removeItem('lastActivity');
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
                    sessionStorage.removeItem('token');
                    sessionStorage.removeItem('lastActivity');
                    setUser(null);
                }
            } catch (error) {
                // Token invalid or error, clear it
                if (mounted && !cancelled) {
                    // Handle timeout errors
                    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                        console.warn('Auth check request timed out');
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('lastActivity');
                        setUser(null);
                    } else if (error.response?.status === 401 || error.response?.status === 403) {
                        // Invalid token
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('lastActivity');
                        setUser(null);
                    } else if (error.response?.status !== 429) {
                        // Other errors (but not rate limit)
                        console.warn('Auth check failed:', error.message || 'Network error');
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('lastActivity');
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
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('lastActivity');
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
                // SECURITY: Use sessionStorage - clears when browser closes
                sessionStorage.setItem('token', response.data.token);
                sessionStorage.setItem('lastActivity', Date.now().toString());
                setUser(response.data.user);
                resetInactivityTimer();
                return response.data;
            }
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('lastActivity');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, resetInactivityTimer }}>
            {children}
        </AuthContext.Provider>
    );
};
