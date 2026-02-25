import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { appointmentsAPI } from '../services/api';

const VisitTypeDropdown = ({ appt, onUpdate, isCancelledOrNoShow, value, onChange, onOpenChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (onOpenChange) onOpenChange(isOpen);
    }, [isOpen, onOpenChange]);

    const types = [
        { label: 'Follow-up', method: 'office' },
        { label: 'New Patient', method: 'office' },
        { label: 'Sick Visit', method: 'office' },
        { label: 'Telehealth Visit', method: 'telehealth' },
        { label: 'Consultation', method: 'office' }
    ];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentType = value || appt?.type || 'Follow-up';
    const isTelehealth = value === 'Telehealth Visit' || appt?.visitMethod === 'telehealth' || appt?.type === 'Telehealth Visit';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isCancelledOrNoShow) setIsOpen(!isOpen);
                }}
                className={`text-[8px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 border shadow-sm flex items-center gap-1 whitespace-nowrap ${isTelehealth
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    } ${isCancelledOrNoShow ? 'opacity-50 grayscale line-through cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {isTelehealth ? 'Telehealth' : currentType}
                {!isCancelledOrNoShow && <ChevronDown className="w-2 h-2 opacity-50 shrink-0" />}
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-1 w-28 bg-white border border-gray-100 rounded-lg shadow-xl z-[60] py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {types.map((t) => (
                        <button
                            key={t.label}
                            type="button"
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (onChange) {
                                    onChange(t.label, t.method);
                                    setIsOpen(false);
                                } else if (appt) {
                                    try {
                                        await appointmentsAPI.update(appt.id, {
                                            type: t.label,
                                            visitMethod: t.method
                                        });
                                        if (onUpdate) onUpdate();
                                        setIsOpen(false);
                                    } catch (err) {
                                        console.error('Failed to update visit type:', err);
                                    }
                                }
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[9px] font-semibold hover:bg-gray-50 transition-colors ${t.label === 'Telehealth Visit' ? 'text-emerald-600' : 'text-gray-600'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VisitTypeDropdown;
