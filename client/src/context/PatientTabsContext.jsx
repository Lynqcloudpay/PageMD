import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PatientTabsContext = createContext({
    tabs: [],
    activeTab: null,
    recentPatient: null,
    addTab: () => { },
    removeTab: () => { },
    switchTab: () => { },
    updateTabPath: () => { },
    setActiveTab: () => { }
});

export const usePatientTabs = () => {
    const context = useContext(PatientTabsContext);
    if (!context) {
        // Return default values if context is not available
        return {
            tabs: [],
            activeTab: null,
            recentPatient: null,
            addTab: () => { },
            removeTab: () => { },
            switchTab: () => { },
            updateTabPath: () => { },
            setActiveTab: () => { }
        };
    }
    return context;
};

export const PatientTabsProvider = ({ children }) => {
    const [tabs, setTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [recentPatient, setRecentPatient] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Use a clinic-scoped storage key
    const storageKey = useMemo(() => {
        return user?.clinic_id ? `patientTabs_${user.clinic_id}` : 'patientTabs';
    }, [user?.clinic_id]);

    const recentPatientKey = useMemo(() => {
        return user?.clinic_id ? `recentPatient_${user.clinic_id}` : 'recentPatient';
    }, [user?.clinic_id]);

    // Clear tabs when clinic changes
    useEffect(() => {
        setTabs([]);
        setActiveTab(null);
    }, [user?.clinic_id]);

    // Load tabs and recent patient from localStorage on mount or clinic change
    useEffect(() => {
        if (!user) return;

        try {
            const savedTabs = localStorage.getItem(storageKey);
            if (savedTabs) {
                try {
                    const parsed = JSON.parse(savedTabs);
                    setTabs(parsed);
                    // Set active tab based on current route
                    const currentPath = location.pathname;
                    const matchingTab = parsed.find(tab =>
                        currentPath.includes(`/patient/${tab.patientId}`)
                    );
                    if (matchingTab) {
                        setActiveTab(matchingTab.patientId);
                    }
                } catch (e) {
                    console.error('Error loading tabs:', e);
                }
            }

            // Load most recent patient
            const savedRecent = localStorage.getItem(recentPatientKey);
            if (savedRecent) {
                try {
                    setRecentPatient(JSON.parse(savedRecent));
                } catch (e) {
                    console.error('Error loading recent patient:', e);
                }
            }
        } catch (error) {
            console.error('Error accessing localStorage:', error);
        }
    }, [location.pathname, storageKey, recentPatientKey, user]);

    // Save tabs to localStorage whenever they change
    useEffect(() => {
        if (tabs.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(tabs));
        } else if (storageKey) {
            // If tabs is empty, we might want to clear it, but be careful with async updates
            // For now, let's only set if it's explicitly cleared or added
        }
    }, [tabs, storageKey]);

    // Update active tab when route changes
    useEffect(() => {
        const currentPath = location.pathname;
        const patientMatch = currentPath.match(/\/patient\/([^/]+)/);
        if (patientMatch) {
            const patientId = patientMatch[1];
            setActiveTab(patientId);

            // Update tab path if tab exists
            setTabs(prev => prev.map(t =>
                t.patientId === patientId && t.path !== currentPath
                    ? { ...t, path: currentPath }
                    : t
            ));
        } else {
            // Not on a patient route, clear active tab
            setActiveTab(null);
        }
    }, [location.pathname]);

    const addTab = (patient, shouldNavigate = false) => {
        // Use current path if we're already on a patient route, otherwise default to snapshot
        const currentPath = location.pathname;
        const isOnPatientRoute = currentPath.includes(`/patient/${patient.id}`);
        const tabPath = isOnPatientRoute ? currentPath : `/patient/${patient.id}/snapshot`;

        const newTab = {
            patientId: patient.id,
            patientName: patient.name || `${patient.first_name} ${patient.last_name}`,
            mrn: patient.mrn,
            path: tabPath,
            lastAccessed: new Date().toISOString()
        };

        const recentPatientData = {
            id: patient.id,
            name: patient.name || `${patient.first_name} ${patient.last_name}`,
            mrn: patient.mrn,
            lastAccessed: new Date().toISOString()
        };
        setRecentPatient(recentPatientData);
        localStorage.setItem(recentPatientKey, JSON.stringify(recentPatientData));

        setTabs(prev => {
            const existing = prev.find(t => t.patientId === patient.id);
            if (existing) {
                // Update last accessed time and path if on patient route
                return prev.map(t =>
                    t.patientId === patient.id
                        ? { ...t, lastAccessed: new Date().toISOString(), path: isOnPatientRoute ? currentPath : t.path }
                        : t
                );
            }
            return [...prev, newTab];
        });

        setActiveTab(patient.id);
        // Only navigate if explicitly requested (e.g., from search or patient list)
        if (shouldNavigate) {
            navigate(newTab.path);
        }
    };

    const removeTab = (patientId) => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.patientId !== patientId);
            if (newTabs.length === 0) {
                navigate('/dashboard');
                setActiveTab(null);
            } else if (activeTab === patientId) {
                // Switch to another tab
                const nextTab = newTabs[0];
                setActiveTab(nextTab.patientId);
                navigate(nextTab.path);
            }
            return newTabs;
        });
    };

    const switchTab = (patientId) => {
        const tab = tabs.find(t => t.patientId === patientId);
        if (tab) {
            // Just switch the tab without updating order
            setActiveTab(patientId);
            navigate(tab.path);
        }
    };

    const updateTabPath = (patientId, newPath) => {
        setTabs(prev => prev.map(t =>
            t.patientId === patientId ? { ...t, path: newPath } : t
        ));
    };

    return (
        <PatientTabsContext.Provider value={{
            tabs,
            activeTab,
            recentPatient,
            addTab,
            removeTab,
            switchTab,
            updateTabPath,
            setActiveTab
        }}>
            {children}
        </PatientTabsContext.Provider>
    );
};

