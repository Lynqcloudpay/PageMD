import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, ChevronDown, MoreHorizontal, History } from 'lucide-react';
import { usePatientTabs } from '../context/PatientTabsContext';

const PatientTabs = () => {
    const { tabs, activeTab, switchTab, removeTab, addTab } = usePatientTabs();
    const [isAnimating, setIsAnimating] = useState(false);
    const [visibleTabsCount, setVisibleTabsCount] = useState(tabs.length);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showRecentDropdown, setShowRecentDropdown] = useState(false);
    const prevActiveTabRef = useRef(activeTab);
    const containerRef = useRef(null);
    const tabsContainerRef = useRef(null);
    const dropdownRef = useRef(null);
    const recentDropdownRef = useRef(null);

    // Track when active tab changes to trigger animation
    useEffect(() => {
        if (prevActiveTabRef.current !== activeTab && prevActiveTabRef.current !== null) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 400);
            return () => clearTimeout(timer);
        }
        prevActiveTabRef.current = activeTab;
    }, [activeTab]);

    // Calculate visible tabs based on container width
    useEffect(() => {
        const calculateVisibleTabs = () => {
            if (!containerRef.current || !tabsContainerRef.current || tabs.length === 0) {
                setVisibleTabsCount(tabs.length);
                return;
            }

            const containerWidth = containerRef.current.offsetWidth;
            const dropdownWidth = 40; // Space for dropdown button
            const availableWidth = containerWidth - dropdownWidth;
            
            // Approximate tab width (smaller tabs now)
            const avgTabWidth = 90; // Reduced from ~120px
            const maxVisible = Math.floor(availableWidth / avgTabWidth);
            
            setVisibleTabsCount(Math.max(1, Math.min(maxVisible, tabs.length)));
        };

        calculateVisibleTabs();
        window.addEventListener('resize', calculateVisibleTabs);
        
        // Recalculate after a short delay to ensure DOM is rendered
        const timer = setTimeout(calculateVisibleTabs, 100);
        
        return () => {
            window.removeEventListener('resize', calculateVisibleTabs);
            clearTimeout(timer);
        };
    }, [tabs.length]);

    // Get recent patients from localStorage (accessed by this user)
    const recentPatients = useMemo(() => {
        try {
            // Get all recent patients from localStorage
            const savedTabs = localStorage.getItem('patientTabs');
            if (!savedTabs) return [];
            
            const allTabs = JSON.parse(savedTabs);
            // Sort by lastAccessed, most recent first
            const sorted = [...allTabs].sort((a, b) => {
        const timeA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
        const timeB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
        return timeB - timeA;
    });

            // Return up to 10 most recent, excluding currently open tabs
            const openTabIds = new Set(tabs.map(t => t.patientId));
            return sorted
                .filter(tab => !openTabIds.has(tab.patientId))
                .slice(0, 10);
        } catch (error) {
            console.error('Error loading recent patients:', error);
            return [];
        }
    }, [tabs]);

    // Check if there are any saved tabs in localStorage (to show the button even if all are open)
    const hasAnySavedTabs = useMemo(() => {
        try {
            const savedTabs = localStorage.getItem('patientTabs');
            return savedTabs && JSON.parse(savedTabs).length > 0;
        } catch {
            return false;
        }
    }, [tabs]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (recentDropdownRef.current && !recentDropdownRef.current.contains(event.target)) {
                setShowRecentDropdown(false);
            }
        };

        if (showDropdown || showRecentDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown, showRecentDropdown]);

    const visibleTabs = tabs.length > 0 ? tabs.slice(0, visibleTabsCount) : [];
    const hiddenTabs = tabs.length > 0 ? tabs.slice(visibleTabsCount) : [];
    const hasOverflow = hiddenTabs.length > 0;
    const hasRecentPatients = recentPatients.length > 0;

    const handleRecentPatientClick = (patient) => {
        // Create a patient object from the tab data
        const patientData = {
            id: patient.patientId,
            first_name: patient.patientName.split(' ')[0] || '',
            last_name: patient.patientName.split(' ').slice(1).join(' ') || '',
            mrn: patient.mrn,
            name: patient.patientName
        };
        addTab(patientData, true); // Navigate to patient
        setShowRecentDropdown(false);
    };

    return (
        <div 
            className="bg-white border-b border-deep-gray/10 flex items-center overflow-hidden relative" 
            ref={containerRef}
        >
            {/* Recent Patients Dropdown - Always show if there are any saved tabs */}
            {hasAnySavedTabs && (
                <div className="relative flex-shrink-0" ref={recentDropdownRef}>
                    <button
                        onClick={() => {
                            setShowRecentDropdown(!showRecentDropdown);
                            setShowDropdown(false); // Close overflow dropdown if open
                        }}
                        className={`
                            flex items-center justify-center px-2 py-1 h-full
                            border-r border-deep-gray/10 cursor-pointer
                            transition-colors duration-200
                            ${showRecentDropdown
                                ? 'bg-soft-gray text-strong-azure' 
                                : 'bg-white text-deep-gray/70 hover:bg-soft-gray hover:text-strong-azure'
                            }
                        `}
                        title="Recent Patients"
                    >
                        <History className="w-3.5 h-3.5" />
                        <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showRecentDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Recent Patients Dropdown Menu */}
                    {showRecentDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-deep-gray/10 rounded-lg shadow-lg z-50 min-w-[220px] max-h-80 overflow-y-auto">
                            <div className="px-3 py-2 border-b border-deep-gray/10 bg-soft-gray">
                                <h3 className="text-xs font-semibold text-deep-gray uppercase tracking-wider">Recent Patients</h3>
                            </div>
                            {hasRecentPatients ? (
                                recentPatients.map((patient) => (
                                    <div
                                        key={patient.patientId}
                                        className="
                                            flex items-center justify-between px-3 py-2 cursor-pointer
                                            transition-colors duration-200 group
                                            hover:bg-soft-gray text-deep-gray
                                        "
                                        onClick={() => handleRecentPatientClick(patient)}
                                    >
                                        <div className="flex items-center min-w-0 flex-1">
                                            <span className="truncate text-xs font-medium text-deep-gray">
                                                {patient.patientName}
                                            </span>
                                            {patient.mrn && (
                                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium bg-soft-gray text-deep-gray/70">
                                                    {patient.mrn}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-3 py-4 text-center text-xs text-deep-gray/60">
                                    All recent patients are already open
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Open Tabs - Display in original order, no sorting */}
            {tabs.length > 0 && (
                <div className="flex items-center min-w-0 flex-1 patient-tabs-container" ref={tabsContainerRef}>
                {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.patientId;
                    
                    return (
                        <div
                            key={tab.patientId}
                            className={`
                                flex items-center px-2 py-1 border-r border-deep-gray/10 cursor-pointer
                                min-w-0 group patient-tab-item flex-shrink-0
                                ${isActive 
                                    ? 'text-white border-b-2 shadow-sm tab-active' 
                                    : 'bg-white text-deep-gray hover:bg-soft-gray hover:text-strong-azure'
                                }
                                ${isAnimating && isActive ? 'tab-switch-animation' : ''}
                        `}
                        style={isActive ? {
                            background: '#3B82F6',
                            borderBottomColor: '#3B82F6',
                            boxShadow: '0 1px 3px 0 rgba(59, 130, 246, 0.3)'
                        } : {}}
                        onClick={() => switchTab(tab.patientId)}
                    >
                            <span className={`truncate max-w-[80px] text-[11px] font-medium transition-colors duration-300 ${
                                isActive ? 'text-white' : 'text-deep-gray'
                        }`}>
                            {tab.patientName}
                        </span>
                        {tab.mrn && (
                                <span className={`ml-1 text-[9px] truncate px-1 py-0.5 rounded font-medium transition-all duration-300 ${
                                    isActive 
                                    ? 'bg-white/20 text-white' 
                                        : 'bg-soft-gray text-deep-gray/70'
                            }`}>
                                    {tab.mrn.split('-').pop() || tab.mrn}
                            </span>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTab(tab.patientId);
                            }}
                                className={`ml-1 opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all duration-200 ${
                                    isActive 
                                        ? 'hover:bg-white/20' 
                                        : 'hover:bg-soft-gray'
                                }`}
                        >
                                <X className={`w-2.5 h-2.5 ${
                                    isActive 
                                        ? 'text-white/70 hover:text-white' 
                                        : 'text-deep-gray/50 hover:text-deep-gray'
                            }`} />
                        </button>
                    </div>
                    );
                })}
                </div>
            )}

            {/* Dropdown for overflow tabs */}
            {hasOverflow && (
                <div className="relative flex-shrink-0" ref={dropdownRef}>
                    <button
                        onClick={() => {
                            setShowDropdown(!showDropdown);
                            setShowRecentDropdown(false); // Close recent dropdown if open
                        }}
                        className={`
                            flex items-center justify-center px-2 py-1 h-full
                            border-l border-deep-gray/10 cursor-pointer
                            transition-colors duration-200
                            ${showDropdown || hiddenTabs.some(t => t.patientId === activeTab)
                                ? 'bg-soft-gray text-strong-azure' 
                                : 'bg-white text-deep-gray/70 hover:bg-soft-gray hover:text-strong-azure'
                            }
                        `}
                        title={`${hiddenTabs.length} more tab${hiddenTabs.length > 1 ? 's' : ''}`}
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <span className="ml-1 text-[10px] font-medium">{hiddenTabs.length}</span>
                        <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <div className="absolute top-full right-0 mt-1 bg-white border border-deep-gray/10 rounded-lg shadow-lg z-50 min-w-[200px] max-h-64 overflow-y-auto">
                            {hiddenTabs.map((tab) => {
                                const isActive = activeTab === tab.patientId;
                                return (
                                    <div
                                        key={tab.patientId}
                                        className={`
                                            flex items-center justify-between px-3 py-2 cursor-pointer
                                            transition-colors duration-200 group
                                            ${isActive 
                                                ? 'bg-strong-azure/10 text-strong-azure border-l-2 border-l-strong-azure' 
                                                : 'hover:bg-soft-gray text-deep-gray'
                                            }
                                        `}
                                        onClick={() => {
                                            switchTab(tab.patientId);
                                            setShowDropdown(false);
                                        }}
                                    >
                                        <div className="flex items-center min-w-0 flex-1">
                                            <span className={`truncate text-xs font-medium ${
                                                isActive ? 'text-strong-azure' : 'text-deep-gray'
                                            }`}>
                                                {tab.patientName}
                                            </span>
                                            {tab.mrn && (
                                                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                    isActive 
                                                        ? 'bg-strong-azure/20 text-strong-azure' 
                                                        : 'bg-soft-gray text-deep-gray/70'
                                                }`}>
                                                    {tab.mrn}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeTab(tab.patientId);
                                            }}
                                            className="ml-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-soft-gray transition-all duration-200"
                                        >
                                            <X className="w-3 h-3 text-deep-gray/50 hover:text-deep-gray" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
            )}
        </div>
    );
};

export default PatientTabs;

