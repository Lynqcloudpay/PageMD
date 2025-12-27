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
    const [adminSecret, setAdminSecret] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if admin secret exists in localStorage
        const stored = localStorage.getItem('platform_admin_secret');
        if (stored) {
            setAdminSecret(stored);
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const login = async (secret) => {
        try {
            // Test the secret by calling dashboard API
            const response = await axios.get('/api/super/dashboard', {
                headers: { 'X-Super-Admin-Secret': secret }
            });

            if (response.data) {
                setAdminSecret(secret);
                setIsAuthenticated(true);
                localStorage.setItem('platform_admin_secret', secret);
                return true;
            }
        } catch (error) {
            console.error('Platform admin login failed:', error);
            throw new Error('Invalid admin secret');
        }
    };

    const logout = () => {
        setAdminSecret(null);
        setIsAuthenticated(false);
        localStorage.removeItem('platform_admin_secret');
    };

    const apiCall = async (method, endpoint, data = null) => {
        const config = {
            method,
            url: `/api/super${endpoint}`,
            headers: { 'X-Super-Admin-Secret': adminSecret }
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('Platform admin API call failed:', error);
            if (error.response?.status === 403) {
                logout();
            }
            throw error;
        }
    };

    const value = {
        isAuthenticated,
        adminSecret,
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
