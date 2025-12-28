import React, { useEffect, useRef, useState } from 'react';
import { X, User } from 'lucide-react';
import { usePatientTabs } from '../context/PatientTabsContext';

const PatientTabs = () => {
    const { tabs, activeTab, switchTab, removeTab } = usePatientTabs();
    const [isAnimating, setIsAnimating] = useState(false);
    const prevActiveTabRef = useRef(activeTab);
    const containerRef = useRef(null);

    // Track when active tab changes to trigger animation
    useEffect(() => {
        if (prevActiveTabRef.current !== activeTab && prevActiveTabRef.current !== null) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
        prevActiveTabRef.current = activeTab;
    }, [activeTab]);

    // If no tabs, show a placeholder
    if (!tabs || tabs.length === 0) {
        return (
            <div
                className="h-full flex items-center px-4 bg-gradient-to-r from-soft-gray/30 to-white border-b border-deep-gray/10"
                ref={containerRef}
            >
                <div className="flex items-center gap-2 text-deep-gray/50">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-medium">Open a patient chart to start</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-full flex items-center bg-gradient-to-r from-soft-gray/30 to-white border-b border-deep-gray/10 overflow-x-auto"
            ref={containerRef}
        >
            {(tabs || []).map((tab, index) => {
                const isActive = activeTab === tab.patientId;

                return (
                    <div
                        key={tab.patientId}
                        className={`
                            flex items-center gap-2 px-4 py-2 h-full cursor-pointer
                            min-w-0 group transition-all duration-200 relative
                            ${isActive
                                ? 'bg-white shadow-sm'
                                : 'bg-transparent hover:bg-white/60'
                            }
                            ${index > 0 ? 'border-l border-deep-gray/10' : ''}
                        `}
                        onClick={() => switchTab(tab.patientId)}
                    >
                        {/* Active indicator bar */}
                        {isActive && (
                            <div
                                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-strong-azure ${isAnimating ? 'animate-pulse' : ''}`}
                            />
                        )}

                        {/* Patient initials */}
                        <div className={`
                            w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                            ${isActive
                                ? 'bg-strong-azure text-white'
                                : 'bg-soft-gray text-deep-gray/70'
                            }
                        `}>
                            {tab.patientName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'}
                        </div>

                        {/* Patient name and MRN */}
                        <div className="flex flex-col min-w-0">
                            <span className={`
                                truncate text-xs font-semibold leading-tight max-w-[100px]
                                ${isActive ? 'text-deep-gray' : 'text-deep-gray/70'}
                            `}>
                                {tab.patientName}
                            </span>
                            {tab.mrn && (
                                <span className="text-[10px] text-deep-gray/50 font-medium truncate">
                                    {tab.mrn}
                                </span>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTab(tab.patientId);
                            }}
                            className={`
                                ml-1 p-1 rounded-full opacity-0 group-hover:opacity-100 
                                transition-all duration-200 flex-shrink-0
                                ${isActive
                                    ? 'hover:bg-strong-azure/10 text-deep-gray/50 hover:text-deep-gray'
                                    : 'hover:bg-soft-gray text-deep-gray/40 hover:text-deep-gray/70'
                                }
                            `}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default PatientTabs;
