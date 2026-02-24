import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Search, X, Calendar, Users, ChevronDown, Filter, FilterX } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { AlertTriangle, Shield, Check, Mail, Phone, MapPin, MoreVertical } from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { appointmentsAPI, authAPI, patientsAPI, followupsAPI, settingsAPI } from '../services/api';
import AddPatientModal from '../components/AddPatientModal';
import InlinePatientStatus from '../components/InlinePatientStatus';

import VisitTypeDropdown from '../components/VisitTypeDropdown';
import ScheduleAppointmentModal from '../components/ScheduleAppointmentModal';

// Color Palette for Providers
const PROVIDER_PALETTE = [
    // Cold Spectrum
    { name: 'Indigo', bg: 'bg-indigo-50/40', border: 'border-indigo-200', text: 'text-indigo-700', accent: '#6366f1', light: 'bg-indigo-50' },
    { name: 'Teal', bg: 'bg-teal-50/40', border: 'border-teal-200', text: 'text-teal-700', accent: '#0d9488', light: 'bg-teal-50' },
    { name: 'Sky', bg: 'bg-sky-50/40', border: 'border-sky-200', text: 'text-sky-700', accent: '#0ea5e9', light: 'bg-sky-50' },
    { name: 'Slate', bg: 'bg-slate-100/40', border: 'border-slate-300', text: 'text-slate-700', accent: '#334155', light: 'bg-slate-100' },
    { name: 'Cobalt', bg: 'bg-blue-100/30', border: 'border-blue-200', text: 'text-blue-800', accent: '#1e40af', light: 'bg-blue-100' },
    { name: 'Emerald', bg: 'bg-emerald-50/40', border: 'border-emerald-200', text: 'text-emerald-700', accent: '#059669', light: 'bg-emerald-50' },
    { name: 'Cyan', bg: 'bg-cyan-50/40', border: 'border-cyan-200', text: 'text-cyan-700', accent: '#0891b2', light: 'bg-cyan-50' },
    { name: 'Blue', bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-700', accent: '#2563eb', light: 'bg-blue-50' },
    { name: 'Zinc', bg: 'bg-zinc-100/40', border: 'border-zinc-300', text: 'text-zinc-700', accent: '#52525b', light: 'bg-zinc-100' },
    { name: 'Deep Indigo', bg: 'bg-indigo-100/30', border: 'border-indigo-200', text: 'text-indigo-800', accent: '#3730a3', light: 'bg-indigo-100' },
    // Warm Spectrum
    { name: 'Rose', bg: 'bg-rose-50/40', border: 'border-rose-200', text: 'text-rose-700', accent: '#f43f5e', light: 'bg-rose-50' },
    { name: 'Amber', bg: 'bg-amber-50/40', border: 'border-amber-200', text: 'text-amber-700', accent: '#f59e0b', light: 'bg-amber-50' },
    { name: 'Orange', bg: 'bg-orange-50/40', border: 'border-orange-200', text: 'text-orange-700', accent: '#f97316', light: 'bg-orange-50' },
    { name: 'Red', bg: 'bg-red-50/40', border: 'border-red-200', text: 'text-red-700', accent: '#ef4444', light: 'bg-red-50' },
    { name: 'Yellow', bg: 'bg-yellow-50/40', border: 'border-yellow-200', text: 'text-yellow-700', accent: '#eab308', light: 'bg-yellow-50' },
    { name: 'Pink', bg: 'bg-pink-50/40', border: 'border-pink-200', text: 'text-pink-700', accent: '#ec4899', light: 'bg-pink-50' },
    { name: 'Fuchsia', bg: 'bg-fuchsia-50/40', border: 'border-fuchsia-200', text: 'text-fuchsia-700', accent: '#d946ef', light: 'bg-fuchsia-50' },
    { name: 'Purple', bg: 'bg-purple-50/40', border: 'border-purple-200', text: 'text-purple-700', accent: '#a855f7', light: 'bg-purple-50' },
    { name: 'Violet', bg: 'bg-violet-50/40', border: 'border-violet-200', text: 'text-violet-700', accent: '#8b5cf6', light: 'bg-violet-50' },
    { name: 'Stone', bg: 'bg-stone-100/40', border: 'border-stone-300', text: 'text-stone-700', accent: '#78716c', light: 'bg-stone-100' },
];

// No Show / Cancelled Buttons Component (extracted for use in Schedule)
const NoShowCancelledButtons = ({ appointment, onStatusUpdate }) => {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [reasonInput, setReasonInput] = useState('');

    const status = appointment?.patient_status || 'scheduled';
    const isTerminalState = ['checked_out', 'checked-out', 'completed'].includes(status) || ['no_show', 'no-show'].includes(status) || status === 'cancelled';

    const handleNoShowOrCancelled = (newStatus) => {

        if (['no_show', 'no-show'].includes(newStatus)) {
            // No Show doesn't require a reason - mark directly
            handleStatusChange('no-show', null);
        } else {
            // Cancelled requires a reason
            setPendingStatus(newStatus);
            setShowReasonModal(true);
        }
    };

    const handleStatusChange = async (newStatus, cancellationReason) => {
        if (saving) return;

        setSaving(true);
        try {
            const now = new Date();
            const statusHistory = appointment?.status_history || [];
            const userName = user ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() : 'System';
            const newHistory = [...statusHistory, {
                status: newStatus,
                room_sub_status: null,
                timestamp: now.toISOString(),
                changed_by: userName || 'System',
                ...(cancellationReason && { cancellation_reason: cancellationReason })
            }];

            const updateData = {
                patient_status: newStatus,
                room_sub_status: null,
                current_room: null,
                cancellation_reason: cancellationReason || null,
                status_history: newHistory
            };

            // Only set checkout_time if not already set
            if (!appointment?.checkout_time) {
                updateData.checkout_time = now.toISOString();
            }

            const response = await appointmentsAPI.update(appointment.id, updateData);
            const updated = response.data || response;

            if (onStatusUpdate) onStatusUpdate(updated);
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
            alert(`Failed to update status: ${errorMessage}`);
        } finally {
            setSaving(false);
            setShowReasonModal(false);
            setReasonInput('');
            setPendingStatus(null);
        }
    };

    const handleReasonSubmit = () => {
        if (reasonInput.trim()) {
            handleStatusChange(pendingStatus, reasonInput.trim());
        }
    };

    const NoShowCancelledBtn = ({ statusKey, label }) => {
        const isActive = ['no_show', 'no-show'].includes(status) ? statusKey === 'no-show' : status === statusKey;
        const color = isActive
            ? (['no_show', 'no-show'].includes(statusKey) ? 'text-orange-700 font-bold' : 'text-red-700 font-bold')
            : (['no_show', 'no-show'].includes(statusKey) ? 'text-orange-500 hover:text-orange-600' : 'text-red-500 hover:text-red-600');

        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!saving && statusKey !== status && !isTerminalState) {
                        handleNoShowOrCancelled(statusKey);
                    }
                }}
                disabled={saving || isTerminalState}
                className={`text-[8px] transition-all cursor-pointer ${color} ${saving || isTerminalState ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isActive && <span className="text-[7px] mr-0.5">×</span>}
                <span className={isActive ? 'underline underline-offset-1' : ''}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <>
            <div className="flex items-center gap-1">
                <NoShowCancelledBtn statusKey="no-show" label="No Show" />
                <span className="text-gray-300 text-[8px]">·</span>
                <NoShowCancelledBtn statusKey="cancelled" label="Cancelled" />
            </div>

            {/* Cancellation Reason Modal - Portaled to bypass stacking contexts */}
            {showReasonModal && pendingStatus === 'cancelled' && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[10000] flex items-center justify-center animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowReasonModal(false);
                        setReasonInput('');
                        setPendingStatus(null);
                    }}
                >
                    <div
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6">
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                Cancel Appointment
                            </h2>
                        </div>

                        <div className="p-8">
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                    Cancellation Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    placeholder="Please provide a reason for cancellation..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-red-100 focus:border-red-400 text-sm resize-none transition-all"
                                    rows={4}
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReasonModal(false);
                                        setReasonInput('');
                                        setPendingStatus(null);
                                    }}
                                    className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReasonSubmit}
                                    disabled={!reasonInput.trim() || saving}
                                    className="px-8 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all disabled:opacity-50 disabled:scale-95 active:scale-95"
                                >
                                    {saving ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// Provider Legend Item Component
const ProviderLegendItem = ({ providerGroup, isSelected, selectedProviderIds, setSelectedProviderIds, palette, onUpdateColor }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm ${isSelected
                ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100'
                : 'bg-white border-slate-100 hover:border-slate-200'
                }`}>
                {/* Color and Chevron Cluster */}
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => {
                            if (isSelected && selectedProviderIds.length === 1) {
                                setSelectedProviderIds([]);
                            } else {
                                setSelectedProviderIds([providerGroup.providerId]);
                            }
                        }}
                        className={`w-3 h-3 rounded-full ${isSelected ? 'animate-pulse' : ''} transition-colors cursor-pointer border border-black/5 flex-shrink-0`}
                        style={{ backgroundColor: providerGroup.color.accent }}
                        title={`Toggle ${providerGroup.providerName}`}
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        className={`p-0.5 rounded-full hover:bg-slate-100 transition-colors ${isOpen ? 'bg-slate-100 text-indigo-500' : 'text-slate-400'}`}
                        title="Change Color"
                    >
                        <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <button
                    onClick={() => {
                        if (isSelected && selectedProviderIds.length === 1) {
                            setSelectedProviderIds([]);
                        } else {
                            setSelectedProviderIds([providerGroup.providerId]);
                        }
                    }}
                    className={`text-[10px] font-bold uppercase tracking-tight truncate max-w-[80px] ${isSelected ? 'text-amber-700' : 'text-slate-500'} cursor-pointer`}
                >
                    {providerGroup.providerName}
                </button>
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 p-3 bg-white border border-slate-100 rounded-xl shadow-2xl z-[100] min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Choose Color</div>
                    <div className="grid grid-cols-5 gap-2">
                        {palette.map((color, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    onUpdateColor(idx);
                                    setIsOpen(false);
                                }}
                                className="w-6 h-6 rounded-full border border-slate-100 hover:scale-110 transition-transform shadow-sm relative group"
                                style={{ backgroundColor: color.accent }}
                                title={color.name}
                            >
                                {providerGroup.color.accent === color.accent && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Provider Change Modal Component
const ProviderChangeModal = ({ isOpen, onClose, appointment, providers, currentProviderName, onProviderChange }) => {
    const [selectedProviderId, setSelectedProviderId] = useState(appointment?.providerId || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && appointment) {
            setSelectedProviderId(appointment.providerId);
        }
    }, [isOpen, appointment]);

    const handleSave = async () => {
        if (saving || !selectedProviderId || selectedProviderId === appointment.providerId) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            await appointmentsAPI.update(appointment.id, { providerId: selectedProviderId });
            if (onProviderChange) onProviderChange();
            onClose();
        } catch (error) {
            console.error('Error changing provider:', error);
            alert(`Failed to change provider: ${error.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const providerOptions = (providers || []).filter(p => {
        const role = (p.role_name || p.role || '').toLowerCase();
        return role.includes('physician') || role.includes('doctor') || role.includes('np') ||
            role.includes('nurse practitioner') || role.includes('pa') || role.includes('physician assistant') ||
            role === 'clinician';
    });

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10001] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="bg-indigo-50/50 border-b border-indigo-100 px-8 py-6">
                    <h2 className="text-xl font-bold text-indigo-900 tracking-tight">Change Provider</h2>
                    <p className="text-indigo-400 text-[10px] uppercase font-bold tracking-widest mt-1">Reassign Appointment</p>
                </div>

                <div className="p-8">
                    <div className="mb-6">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Current Provider
                        </label>
                        <div className="px-5 py-4 bg-slate-50/80 rounded-2xl text-sm text-slate-600 border border-slate-100 font-medium italic">
                            {currentProviderName || 'No provider assigned'}
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Select New Provider
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedProviderId}
                                onChange={(e) => setSelectedProviderId(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 text-sm appearance-none text-slate-700 transition-all font-bold"
                            >
                                <option value="">Select a provider...</option>
                                {providerOptions.map(provider => (
                                    <option key={provider.id} value={provider.id}>
                                        {provider.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown className="w-4 h-4" />
                            </div>
                        </div>
                        {providerOptions.length === 0 && (
                            <p className="text-[10px] text-rose-500 mt-3 font-bold uppercase tracking-wider bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">No available providers found</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !selectedProviderId || selectedProviderId === appointment?.providerId}
                            className="px-8 py-3 text-sm font-bold bg-indigo-500 text-white rounded-xl shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 disabled:scale-95"
                        >
                            {saving ? 'Saving...' : 'Reassign'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Provider Selector Button Component
const ProviderSelector = ({ appointment, providers, currentProviderName, onProviderChange, showInitials = false }) => {
    const [showModal, setShowModal] = useState(false);

    const getDisplayName = () => {
        if (!currentProviderName) return 'Provider';
        const parts = currentProviderName.split(' ');
        if (showInitials && parts.length >= 2) {
            // Return initials: "M. Rodriguez"
            return `${parts[0][0]}. ${parts[parts.length - 1]}`;
        } else if (parts.length >= 2) {
            // Return last name
            return parts[parts.length - 1];
        }
        return parts[0] || 'Provider';
    };

    const displayName = getDisplayName();

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowModal(true);
                }}
                className="text-[9px] font-medium text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors truncate block w-full text-left"
                title={currentProviderName || 'Provider'}
            >
                {displayName}
            </button>

            <ProviderChangeModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                appointment={appointment}
                providers={providers}
                currentProviderName={currentProviderName}
                onProviderChange={onProviderChange}
            />
        </>
    );
};


const Schedule = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { patients } = usePatient();
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [providers, setProviders] = useState([]);
    const [selectedProviderIds, setSelectedProviderIds] = useState(() => {
        const saved = localStorage.getItem('schedule_selectedProviderIds');
        return saved ? JSON.parse(saved) : [];
    });
    const [showProviderMenu, setShowProviderMenu] = useState(false);
    const providerMenuRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Save provider preference to localStorage
    useEffect(() => {
        localStorage.setItem('schedule_selectedProviderIds', JSON.stringify(selectedProviderIds));
    }, [selectedProviderIds]);

    // Close provider menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (providerMenuRef.current && !providerMenuRef.current.contains(event.target)) {
                setShowProviderMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Toggle a provider in the selection
    const toggleProvider = (providerId) => {
        setSelectedProviderIds(prev => {
            if (prev.includes(providerId)) {
                return prev.filter(id => id !== providerId);
            } else {
                return [...prev, providerId];
            }
        });
    };

    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [clickedTimeSlot, setClickedTimeSlot] = useState(null);
    const [activeDropdownApptId, setActiveDropdownApptId] = useState(null);
    const [clinicalSettings, setClinicalSettings] = useState(null);
    const [practiceSettings, setPracticeSettings] = useState(null);
    const [providerColorOverrides, setProviderColorOverrides] = useState(() => {
        const saved = localStorage.getItem('schedule_providerColorOverrides');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('schedule_providerColorOverrides', JSON.stringify(providerColorOverrides));
    }, [providerColorOverrides]);

    const updateProviderColor = (providerId, colorIndex) => {
        setProviderColorOverrides(prev => ({
            ...prev,
            [providerId]: colorIndex
        }));
    };

    // Fetch clinical and practice settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [clinicalRes, practiceRes] = await Promise.all([
                    settingsAPI.getClinical(),
                    settingsAPI.getPractice()
                ]);
                setClinicalSettings(clinicalRes.data);
                setPracticeSettings(practiceRes.data);
            } catch (err) {
                console.warn('Failed to fetch settings:', err);
            }
        };
        fetchSettings();
    }, []);

    const startHour = useMemo(() => {
        if (!practiceSettings?.scheduling_start_time) return 7;
        return parseInt(practiceSettings.scheduling_start_time.split(':')[0]);
    }, [practiceSettings]);

    const endHour = useMemo(() => {
        if (!practiceSettings?.scheduling_end_time) return 19;
        return parseInt(practiceSettings.scheduling_end_time.split(':')[0]);
    }, [practiceSettings]);

    const [dismissedAppointmentIds, setDismissedAppointmentIds] = useState(new Set());

    const [timeFilter, setTimeFilter] = useState(() => {
        const saved = localStorage.getItem('schedule_timeFilter');
        return saved || 'both'; // 'am', 'pm', 'both'
    });

    useEffect(() => {
        localStorage.setItem('schedule_timeFilter', timeFilter);
    }, [timeFilter]);

    const [pendingFollowupId, setPendingFollowupId] = useState(null);
    // Load saved preference from localStorage, default to true if not set
    const [showCancelledAppointments, setShowCancelledAppointments] = useState(() => {
        const saved = localStorage.getItem('schedule_showCancelled');
        return saved !== null ? saved === 'true' : true;
    });

    // Save preference to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('schedule_showCancelled', showCancelledAppointments.toString());
    }, [showCancelledAppointments]);

    // Dynamic time slots based on practice settings
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let i = startHour; i <= endHour; i++) {
            slots.push(`${i.toString().padStart(2, '0')}:00`);
            slots.push(`${i.toString().padStart(2, '0')}:30`);
        }
        return slots;
    }, [startHour, endHour]);

    const visibleTimeSlots = useMemo(() => {
        if (timeFilter === 'both') return timeSlots;
        return timeSlots.filter(slot => {
            const hour = parseInt(slot.split(':')[0]);
            if (timeFilter === 'am') return hour < 12;
            if (timeFilter === 'pm') return hour >= 12;
            return true;
        });
    }, [timeFilter, timeSlots]);

    // Handle prefilled patient from other pages (like Cancellations)
    useEffect(() => {
        if (location.state?.prefillPatient && location.state?.patientName) {
            // Store follow-up ID for auto-addressing after booking
            if (location.state.followupId) {
                setPendingFollowupId(location.state.followupId);
            }
            // Open the modal if requested
            if (location.state.openModal) {
                setShowModal(true);
            }
            // Clear the state to prevent re-triggering
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    // Fetch providers
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await authAPI.getProviders();
                const providersList = response.data || [];
                setProviders(providersList);

                // Check if there's a saved provider preference
                const savedProviderIds = localStorage.getItem('schedule_selectedProviderIds');
                if (savedProviderIds) {
                    const parsedIds = JSON.parse(savedProviderIds);
                    const validSavedIds = providersList.filter(p => parsedIds.includes(p.id)).map(p => p.id);
                    setSelectedProviderIds(validSavedIds);
                } else if (user) {
                    // Default to current user if they are a provider
                    const roleName = user.role_name || user.role || '';
                    const roleLower = roleName.toLowerCase();
                    const isProvider = roleLower.includes('physician') || roleLower.includes('np') || roleLower.includes('pa') || roleLower === 'clinician';

                    if (isProvider) {
                        const currentUserProvider = providersList.find(p => p.id === user.id);
                        if (currentUserProvider) {
                            setSelectedProviderIds([currentUserProvider.id]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching providers:', error);
            }
        };
        fetchProviders();
    }, [user]);

    // Fetch appointments
    const fetchAppointments = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const params = { date: dateStr };
            const response = await appointmentsAPI.get(params);
            setAppointments(response.data || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setAppointments([]);
        } finally {
            if (!isRefresh) setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(() => {
            fetchAppointments(true);
        }, 2000);
        return () => clearInterval(interval);
    }, [currentDate]);

    // Provider color helper
    const getProviderColor = (providerId, providerName) => {
        if (!providerId) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: '#64748b', light: 'bg-slate-100' };

        if (providerColorOverrides[providerId] !== undefined) {
            return PROVIDER_PALETTE[providerColorOverrides[providerId]];
        }

        let hash = 0;
        const str = providerId + (providerName || '');
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return PROVIDER_PALETTE[Math.abs(hash) % PROVIDER_PALETTE.length];
    };

    // Memoized grouped appointments
    const appointmentsByProvider = useMemo(() => {
        const activeProviderIds = new Set((providers || []).map(p => p.id));
        const visibleProviderIds = new Set(
            selectedProviderIds.length === 0
                ? (providers || []).map(p => p.id)
                : selectedProviderIds
        );

        return (appointments || []).reduce((acc, appt) => {
            const providerId = appt.providerId || 'unknown';

            if (!visibleProviderIds.has(providerId) && providerId !== 'unknown') return acc;
            if (!activeProviderIds.has(providerId) && providerId !== 'unknown') return acc;

            if (!acc[providerId]) {
                const providerName = appt.providerName || 'Unknown Provider';
                acc[providerId] = {
                    providerId: appt.providerId,
                    providerName: providerName,
                    appointments: [],
                    color: getProviderColor(providerId, providerName)
                };
            }
            acc[providerId].appointments.push(appt);
            return acc;
        }, {});
    }, [appointments, providers, selectedProviderIds, providerColorOverrides]);

    const getTimeSlotHeight = (time) => {
        const apptTime = time.substring(0, 5);
        let totalAppointments = 0;
        const compactCardHeight = 24;
        const verticalGap = 1;
        const baseSlotHeight = 48;

        Object.values(appointmentsByProvider).forEach((providerGroup) => {
            const appointmentsAtTime = providerGroup.appointments.filter(a => {
                if (!a.time) return false;
                const aTime = a.time.substring(0, 5);
                return aTime === apptTime;
            }).filter(appt => {
                const isCancelledOrNoShow = ['cancelled', 'no_show', 'no-show'].includes(appt.patient_status);
                return showCancelledAppointments || !isCancelledOrNoShow;
            });

            totalAppointments += appointmentsAtTime.length;
        });

        const stackedHeight = totalAppointments > 0
            ? (totalAppointments * compactCardHeight) + ((totalAppointments - 1) * verticalGap)
            : 0;

        return stackedHeight > 0 ? Math.max(baseSlotHeight, stackedHeight + 2) : baseSlotHeight;
    };

    const handleTimeSlotClick = (time) => {
        setClickedTimeSlot(time);
        setShowModal(true);
    };

    const handlePatientNameClick = (e, appt) => {
        e.stopPropagation();
        if (appt.patientId) {
            navigate(`/patient/${appt.patientId}/snapshot`);
        }
    };

    const refreshAppointments = () => fetchAppointments(true);

    return (
        <div className="h-screen flex flex-col bg-[#F8FAFC]">
            {/* Soft Modern Header */}
            <div className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 relative z-[40]">
                <div className="max-w-[1700px] mx-auto px-6 py-2.5">
                    <div className="flex items-center justify-between">
                        {/* Left: Title and Date Navigation */}
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-[#10141A] tracking-tighter uppercase mb-0.5">Schedule</h1>
                                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Clinic Overview</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-2xl p-1 shadow-sm">
                                    <button
                                        className="p-2 hover:bg-white text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:shadow-sm active:scale-95"
                                        onClick={() => setCurrentDate(addDays(currentDate, -1))}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="relative group">
                                        <div className="w-[320px] px-3 py-1.5 font-medium text-slate-600 group-hover:bg-white rounded-xl transition-all text-center cursor-pointer select-none flex items-center justify-center gap-2 whitespace-nowrap text-base">
                                            {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                            <ChevronDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <input
                                            type="date"
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                                            value={format(currentDate, 'yyyy-MM-dd')}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                                    setCurrentDate(new Date(y, m - 1, d));
                                                }
                                            }}
                                        />
                                    </div>
                                    <button
                                        className="p-2 hover:bg-white text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:shadow-sm active:scale-95"
                                        onClick={() => setCurrentDate(addDays(currentDate, 1))}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    className={`px-4 py-2 text-xs font-medium rounded-xl transition-all shadow-sm active:scale-95 ${format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                        : 'text-slate-500 bg-white border border-slate-100 hover:bg-slate-50'
                                        }`}
                                    onClick={() => setCurrentDate(new Date())}
                                >
                                    Today
                                </button>
                            </div>
                        </div>

                        {/* Right: Provider Filter */}
                        <div className="flex items-center gap-4">
                            <div className="relative" ref={providerMenuRef}>
                                <button
                                    onClick={() => setShowProviderMenu(!showProviderMenu)}
                                    className="flex items-center gap-2 bg-white hover:bg-slate-50 rounded-2xl px-4 py-2 transition-all border border-slate-100 shadow-sm active:scale-95"
                                >
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                                        {selectedProviderIds.length === 0
                                            ? 'All Providers'
                                            : `${selectedProviderIds.length} Provider${selectedProviderIds.length === 1 ? '' : 's'}`}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {showProviderMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-[9999] max-h-[400px] overflow-y-auto">
                                        <div className="px-2 py-1.5 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Select Providers to View
                                        </div>
                                        {providers.map(p => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-3 w-full p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProviderIds.includes(p.id)}
                                                    onChange={() => toggleProvider(p.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex-shrink-0 bg-white border-b border-slate-100">
                <div className="max-w-[1700px] mx-auto px-6 py-2 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                const nextValue = !showCancelledAppointments;
                                setShowCancelledAppointments(nextValue);
                                if (nextValue) setDismissedAppointmentIds(new Set());
                            }}
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all ${showCancelledAppointments
                                ? 'bg-white border border-slate-200 text-slate-500 shadow-sm'
                                : 'bg-indigo-50/50 border border-indigo-100/50 text-indigo-500'
                                }`}
                        >
                            {showCancelledAppointments ? (
                                <><FilterX className="w-3 h-3" /><span>Hide Cancelled</span></>
                            ) : (
                                <><Filter className="w-3 h-3" /><span>Show Cancelled</span></>
                            )}
                        </button>

                        <div className="h-4 w-[1px] bg-slate-200"></div>

                        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100">
                            {['am', 'pm', 'both'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${timeFilter === filter ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {filter === 'both' ? 'Full Day' : filter.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Arrived</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400"></span> Checked In</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Provider</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                <div className="min-w-full inline-block">
                    {/* Grid Header */}
                    <div className="sticky top-0 z-[35] bg-white/95 backdrop-blur-sm border-b border-slate-100">
                        <div className="flex">
                            <div className="w-20 flex-shrink-0 border-r border-slate-100 bg-slate-50/30"></div>
                            <div className="flex-1 px-4 py-2 flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-700">Clinic Schedule</span>
                                <div className="flex items-center gap-1.5">
                                    {Object.values(appointmentsByProvider).map(group => (
                                        <ProviderLegendItem
                                            key={group.providerId}
                                            providerGroup={group}
                                            isSelected={selectedProviderIds.includes(group.providerId)}
                                            selectedProviderIds={selectedProviderIds}
                                            setSelectedProviderIds={setSelectedProviderIds}
                                            palette={PROVIDER_PALETTE}
                                            onUpdateColor={(idx) => updateProviderColor(group.providerId, idx)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative">
                        {visibleTimeSlots.map((time) => (
                            <div
                                key={time}
                                className={`flex border-b border-slate-50 ${time.endsWith(':00') ? 'bg-white' : 'bg-slate-50/20'}`}
                                style={{ height: `${getTimeSlotHeight(time)}px` }}
                            >
                                <div className="w-20 flex-shrink-0 border-r border-slate-50 flex items-center justify-end pr-3">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {time.endsWith(':00') ? format(new Date(`2000-01-01T${time}`), 'h a') : ':30'}
                                    </span>
                                </div>
                                <div
                                    className="flex-1 relative cursor-pointer hover:bg-indigo-50/20"
                                    onClick={() => handleTimeSlotClick(time)}
                                ></div>
                            </div>
                        ))}

                        {/* Appointments Overlay */}
                        {(() => {
                            const allAppointments = [];
                            Object.values(appointmentsByProvider).forEach(group => {
                                group.appointments.filter(appt => {
                                    if (dismissedAppointmentIds.has(appt.id)) return false;
                                    const isCancelled = ['cancelled', 'no_show', 'no-show'].includes(appt.patient_status);
                                    return showCancelledAppointments || !isCancelled;
                                }).forEach(appt => allAppointments.push({ ...appt, providerGroup: group }));
                            });

                            const appointmentsByTime = {};
                            allAppointments.forEach(appt => {
                                const t = appt.time?.substring(0, 5) || '';
                                if (!appointmentsByTime[t]) appointmentsByTime[t] = [];
                                appointmentsByTime[t].push(appt);
                            });

                            return allAppointments.map(appt => {
                                const slotIdx = visibleTimeSlots.indexOf(appt.time?.substring(0, 5));
                                if (slotIdx === -1) return null;

                                let cumulativeTop = 0;
                                for (let i = 0; i < slotIdx; i++) {
                                    cumulativeTop += getTimeSlotHeight(visibleTimeSlots[i]);
                                }

                                const list = appointmentsByTime[appt.time.substring(0, 5)] || [];
                                const idx = list.findIndex(a => a.id === appt.id);
                                const isCancelled = ['cancelled', 'no_show', 'no-show'].includes(appt.patient_status);

                                return (
                                    <div
                                        key={appt.id}
                                        className={`absolute border-l-[3px] rounded-lg shadow-sm transition-all overflow-visible flex items-center px-2 group ${isCancelled ? 'bg-slate-50 border-slate-300 opacity-60' : `${appt.providerGroup.color.bg} ${appt.providerGroup.color.border}`}`}
                                        style={{
                                            top: `${cumulativeTop + idx * 25 + 2}px`,
                                            height: '24px',
                                            left: '84px',
                                            width: 'calc(100% - 88px)',
                                            borderLeftColor: isCancelled ? '#CBD5E1' : appt.providerGroup.color.accent,
                                            zIndex: activeDropdownApptId === appt.id ? 100 : 10
                                        }}
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <span
                                                className={`text-[11px] font-bold truncate w-[180px] cursor-pointer hover:underline ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                onClick={(e) => handlePatientNameClick(e, appt)}
                                            >
                                                {appt.patientName}
                                            </span>
                                            <div className="w-[100px] flex items-center gap-1.5">
                                                <VisitTypeDropdown
                                                    appt={appt}
                                                    onUpdate={refreshAppointments}
                                                    onOpenChange={(open) => setActiveDropdownApptId(open ? appt.id : null)}
                                                />
                                                <span className="text-[8px] font-bold text-slate-400">{appt.duration}m</span>
                                            </div>
                                            <div className="w-[100px]">
                                                <ProviderSelector
                                                    appointment={appt}
                                                    providers={providers}
                                                    currentProviderName={appt.providerName}
                                                    onProviderChange={refreshAppointments}
                                                    showInitials={true}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <InlinePatientStatus
                                                    appointment={appt}
                                                    onStatusUpdate={refreshAppointments}
                                                    showNoShowCancelled={false}
                                                    showCancelledBadge={true}
                                                />
                                            </div>
                                            <NoShowCancelledButtons
                                                appointment={appt}
                                                onStatusUpdate={refreshAppointments}
                                            />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            <ScheduleAppointmentModal
                isOpen={showModal}
                initialTime={clickedTimeSlot}
                initialDate={format(currentDate, 'yyyy-MM-dd')}
                providers={providers}
                practiceSettings={practiceSettings}
                clinicalSettings={clinicalSettings}
                pendingFollowupId={pendingFollowupId}
                onClose={() => setShowModal(false)}
                onSuccess={() => {
                    setShowModal(false);
                    refreshAppointments();
                }}
            />
        </div>
    );
};

export default Schedule;
