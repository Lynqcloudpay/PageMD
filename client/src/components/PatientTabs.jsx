import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, MoreHorizontal } from 'lucide-react';
import { usePatientTabs } from '../context/PatientTabsContext';

const PatientTabs = () => {
    const { tabs, activeTab, switchTab, removeTab } = usePatientTabs();
    const [isAnimating, setIsAnimating] = useState(false);
    const [visibleTabsCount, setVisibleTabsCount] = useState(tabs.length);
    const [showDropdown, setShowDropdown] = useState(false);
    const prevActiveTabRef = useRef(activeTab);
    const containerRef = useRef(null);
    const tabsContainerRef = useRef(null);
    const dropdownRef = useRef(null);

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
            const dropdownWidth = 40;
            const availableWidth = containerWidth - dropdownWidth;
            const avgTabWidth = 90;
            const maxVisible = Math.floor(availableWidth / avgTabWidth);

            setVisibleTabsCount(Math.max(1, Math.min(maxVisible, tabs.length)));
        };

        calculateVisibleTabs();
        window.addEventListener('resize', calculateVisibleTabs);
        const timer = setTimeout(calculateVisibleTabs, 100);

        return () => {
            window.removeEventListener('resize', calculateVisibleTabs);
            clearTimeout(timer);
        };
    }, [tabs.length]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown]);

    const visibleTabs = tabs.length > 0 ? tabs.slice(0, visibleTabsCount) : [];
    const hiddenTabs = tabs.length > 0 ? tabs.slice(visibleTabsCount) : [];
    const hasOverflow = hiddenTabs.length > 0;

    return (
        <div
            className="bg-white border-b border-deep-gray/10 flex items-center overflow-hidden relative"
            ref={containerRef}
        >
            {/* Open Tabs */}
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
                                <span className={`truncate max-w-[80px] text-[11px] font-medium transition-colors duration-300 ${isActive ? 'text-white' : 'text-deep-gray'
                                    }`}>
                                    {tab.patientName}
                                </span>
                                {tab.mrn && (
                                    <span className={`ml-1 text-[9px] truncate px-1 py-0.5 rounded font-medium transition-all duration-300 ${isActive
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
                                    className={`ml-1 opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all duration-200 ${isActive
                                        ? 'hover:bg-white/20'
                                        : 'hover:bg-soft-gray'
                                        }`}
                                >
                                    <X className={`w-2.5 h-2.5 ${isActive
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
                        onClick={() => setShowDropdown(!showDropdown)}
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
                                            <span className={`truncate text-xs font-medium ${isActive ? 'text-strong-azure' : 'text-deep-gray'
                                                }`}>
                                                {tab.patientName}
                                            </span>
                                            {tab.mrn && (
                                                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${isActive
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
