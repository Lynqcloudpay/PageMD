import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PatientTabsContext = createContext({
    tabs: [],
    activeTab: null,
    addTab: () => { },
    removeTab: () => { },
    switchTab: () => { }
});

export const usePatientTabs = () => {
    const context = useContext(PatientTabsContext);
    if (!context) {
        return {
            tabs: [],
            activeTab: null,
            addTab: () => { },
            removeTab: () => { },
            switchTab: () => { }
        };
    }
    return context;
};

export const PatientTabsProvider = ({ children }) => {
    // ZERO PERSISTENCE - ALL IN MEMORY ONLY
    const [tabs, setTabs] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Update active tab based on current route
    useEffect(() => {
        const currentPath = location.pathname;
        const patientMatch = currentPath.match(/\/patient\/([^/]+)/);
        if (patientMatch) {
            const patientId = patientMatch[1];
            setActiveTab(patientId);
        } else {
            setActiveTab(null);
        }
    }, [location.pathname]);

    const addTab = (patient, shouldNavigate = false) => {
        const currentPath = location.pathname;
        const isOnPatientRoute = currentPath.includes(`/patient/${patient.id}`);
        const tabPath = isOnPatientRoute ? currentPath : `/patient/${patient.id}/snapshot`;

        const newTab = {
            patientId: patient.id,
            patientName: patient.name || `${patient.first_name} ${patient.last_name}`,
            mrn: patient.mrn,
            path: tabPath
        };

        setTabs(prev => {
            const existing = prev.find(t => t.patientId === patient.id);
            if (existing) {
                return prev.map(t =>
                    t.patientId === patient.id
                        ? { ...t, path: isOnPatientRoute ? currentPath : t.path }
                        : t
                );
            }
            return [...prev, newTab];
        });

        setActiveTab(patient.id);
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
            setActiveTab(patientId);
            navigate(tab.path);
        }
    };

    return (
        <PatientTabsContext.Provider value={{
            tabs,
            activeTab,
            addTab,
            removeTab,
            switchTab
        }}>
            {children}
        </PatientTabsContext.Provider>
    );
};
