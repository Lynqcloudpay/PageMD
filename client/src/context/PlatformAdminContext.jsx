import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const PlatformAdminContext = createContext();

export const usePlatformAdmin = () => {
    const context = useContext(PlatformAdminContext);
    if (!context) {
        throw new Error('usePlatformAdmin must be used within PlatformAdminProvider');
    }
    return context;
};

export const PlatformAdminProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [admin, setAdmin] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if token exists in localStorage
        const storedToken = localStorage.getItem('platform_admin_token');
        if (storedToken) {
            // Verify token is still valid
            verifyToken(storedToken);
        } else {
            setLoading(false);
        }
    }, []);

    const verifyToken = async (tokenToVerify) => {
        try {
            const response = await axios.get('/api/platform-auth/me', {
                headers: { 'X-Platform-Token': tokenToVerify }
            });

            if (response.data.admin) {
                setAdmin(response.data.admin);
                setToken(tokenToVerify);
                setIsAuthenticated(true);
            }
        } catch (error) {
            // Token invalid or expired
            localStorage.removeItem('platform_admin_token');
            localStorage.removeItem('platform_admin_user');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await axios.post('/api/platform-auth/login', {
                email,
                password
            });

            if (response.data.success) {
                const { token: newToken, admin: adminData } = response.data;
                setToken(newToken);
                setAdmin(adminData);
                setIsAuthenticated(true);
                localStorage.setItem('platform_admin_token', newToken);
                localStorage.setItem('platform_admin_user', JSON.stringify(adminData));
                return true;
            }
        } catch (error) {
            console.error('Platform admin login failed:', error);
            throw new Error(error.response?.data?.error || 'Invalid credentials');
        }
    };

    const logout = async () => {
        try {
            if (token) {
                await axios.post('/api/platform-auth/logout', {}, {
                    headers: { 'X-Platform-Token': token }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setToken(null);
            setAdmin(null);
            setIsAuthenticated(false);
            localStorage.removeItem('platform_admin_token');
            localStorage.removeItem('platform_admin_user');
        }
    };

    const apiCall = async (method, endpoint, data = null) => {
        // Determine the base URL based on the endpoint
        // platform-auth endpoints are at /api/platform-auth
        // super admin endpoints are at /api/super
        const baseURL = endpoint.startsWith('/platform-auth') ? '/api' : '/api/super';

        const config = {
            method,
            url: `${baseURL}${endpoint}`,
            headers: { 'X-Platform-Token': token }
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('Platform admin API call failed:', error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
            }
            throw error;
        }
    };

    const value = {
        isAuthenticated,
        admin,
        token,
        loading,
        login,
        logout,
        apiCall
    };

    return (
        <PlatformAdminContext.Provider value={value}>
            {children}
        </PlatformAdminContext.Provider>
    );
};
