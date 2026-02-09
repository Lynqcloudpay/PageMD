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

// Visit Type Dropdown Component
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
                <div className="absolute left-0 mt-1 w-28 bg-white border border-slate-100 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {types.map((t) => (
                        <button
                            key={t.label}
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
                            className={`w-full text-left px-3 py-1.5 text-[9px] font-semibold hover:bg-slate-50 transition-colors ${t.label === 'Telehealth Visit' ? 'text-emerald-600' : 'text-slate-600'
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

// Provider Change Modal Component
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

    const displayName = currentProviderName?.split(' ')[1] || currentProviderName?.split(' ')[0] || 'Provider';

    // Filter to only show physicians/NP/PA (roles that can see patients)
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
    const [showAddPatientModal, setShowAddPatientModal] = useState(false);
    const [clickedTimeSlot, setClickedTimeSlot] = useState(null);
    const [activeDropdownApptId, setActiveDropdownApptId] = useState(null);

    // Color Palette
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
    const [newAppt, setNewAppt] = useState({
        patientId: '',
        patient: '',
        providerId: '',
        type: 'Follow-up',
        time: '09:00',
        duration: 30,
        date: format(new Date(), 'yyyy-MM-dd'),
        visitMethod: 'office'
    });
    const [patientSearch, setPatientSearch] = useState('');
    const [patientSearchResults, setPatientSearchResults] = useState([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const patientSearchRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [modalAppointments, setModalAppointments] = useState([]);
    const [loadingModalAppts, setLoadingModalAppts] = useState(false);
    const [clinicalSettings, setClinicalSettings] = useState(null);

    // Fetch clinical settings (includes max overbooking cap)
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await settingsAPI.getClinical();
                setClinicalSettings(response.data);
            } catch (err) {
                console.warn('Failed to fetch clinical settings:', err);
            }
        };
        fetchSettings();
    }, []);
    const [pendingFollowupId, setPendingFollowupId] = useState(null); // For auto-addressing after reschedule
    // Load saved preference from localStorage, default to true if not set
    const [showCancelledAppointments, setShowCancelledAppointments] = useState(() => {
        const saved = localStorage.getItem('schedule_showCancelled');
        return saved !== null ? saved === 'true' : true;
    });

    const [dismissedAppointmentIds, setDismissedAppointmentIds] = useState(new Set());

    // Save preference to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('schedule_showCancelled', showCancelledAppointments.toString());
    }, [showCancelledAppointments]);

    // Time slots from 7 AM to 7 PM
    const timeSlots = [];
    for (let i = 7; i <= 19; i++) {
        timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
    }

    const visibleTimeSlots = useMemo(() => {
        if (timeFilter === 'both') return timeSlots;
        return timeSlots.filter(slot => {
            const hour = parseInt(slot.split(':')[0]);
            if (timeFilter === 'am') return hour < 12;
            if (timeFilter === 'pm') return hour >= 12;
            return true;
        });
    }, [timeFilter, timeSlots]);

    // Handle prefilled patient from Cancellations page and open modal
    useEffect(() => {
        if (location.state?.prefillPatient && location.state?.patientName) {
            setPatientSearch(location.state.patientName);
            // Trigger search to find the patient
            if (location.state.patientId) {
                // If we have patientId, we can directly set it
                setNewAppt(prev => ({ ...prev, patientId: location.state.patientId, patient: location.state.patientName }));
            }
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
                    // Verify the saved providers still exist in the list
                    const validSavedIds = providersList.filter(p => parsedIds.includes(p.id)).map(p => p.id);
                    setSelectedProviderIds(validSavedIds);
                } else {
                    // If no saved preference, use role-based selection for initial view
                    const roleName = user?.role_name || user?.role || '';
                    const roleNameLower = roleName.toLowerCase();
                    const isPhysicianRole = (
                        roleNameLower === 'physician' ||
                        roleNameLower === 'nurse practitioner' ||
                        roleNameLower === 'np' ||
                        roleNameLower === 'physician assistant' ||
                        roleNameLower === 'pa' ||
                        roleNameLower === 'clinician' ||
                        user?.role === 'clinician'
                    );

                    if (user && isPhysicianRole) {
                        const currentUserProvider = providersList.find(p => p.id === user.id);
                        if (currentUserProvider) {
                            setSelectedProviderIds([currentUserProvider.id]);
                            setNewAppt(prev => ({ ...prev, providerId: currentUserProvider.id }));
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching providers:', error);
            }
        };
        fetchProviders();
    }, [user]);

    // Patient search with debouncing
    useEffect(() => {
        if (searchTimeout) clearTimeout(searchTimeout);

        if (patientSearch.trim().length >= 2) {
            const timeout = setTimeout(async () => {
                try {
                    const response = await patientsAPI.search(patientSearch);
                    setPatientSearchResults(response.data || []);
                    setShowPatientDropdown(true);
                } catch (error) {
                    console.error('Error searching patients:', error);
                    setPatientSearchResults([]);
                }
            }, 300);
            setSearchTimeout(timeout);
        } else {
            setPatientSearchResults([]);
            setShowPatientDropdown(false);
        }

        return () => { if (searchTimeout) clearTimeout(searchTimeout); };
    }, [patientSearch]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(event.target)) {
                setShowPatientDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch appointments for mini scheduler in modal
    useEffect(() => {
        const fetchModalAppointments = async () => {
            if (!showModal || !newAppt.date || !newAppt.providerId) {
                setModalAppointments([]);
                return;
            }

            setLoadingModalAppts(true);
            try {
                const params = { date: newAppt.date, providerId: newAppt.providerId };
                const response = await appointmentsAPI.get(params);
                setModalAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching modal appointments:', error);
                setModalAppointments([]);
            } finally {
                setLoadingModalAppts(false);
            }
        };

        fetchModalAppointments();
    }, [showModal, newAppt.date, newAppt.providerId]);

    // Fetch appointments - ALWAYS fetch all for date, filter on client
    useEffect(() => {
        let isInitialLoad = true;

        const fetchAppointments = async (isRefresh = false) => {
            if (!isRefresh) setLoading(true);
            try {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const params = { date: dateStr };
                // We do NOT send providerId param anymore, we fetch all and filter locally
                const response = await appointmentsAPI.get(params);
                setAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setAppointments([]);
            } finally {
                if (!isRefresh) setLoading(false);
                isInitialLoad = false;
            }
        };

        fetchAppointments();

        const interval = setInterval(() => {
            fetchAppointments(true);
        }, 2000);

        return () => clearInterval(interval);
    }, [currentDate]);

    // Provider colors
    const getProviderColor = (providerId, providerName) => {
        if (!providerId) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: '#64748b', light: 'bg-slate-100' };

        // Check for override
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
    // Group appointments by provider - Filter based on multi-selection
    const activeProviderIds = new Set((providers || []).map(p => p.id));

    // Determine which providers are visible
    // If selectedProviderIds is empty, show ALL. Else show only selected.
    const visibleProviderIds = new Set(
        selectedProviderIds.length === 0
            ? (providers || []).map(p => p.id)
            : selectedProviderIds
    );

    const appointmentsByProvider = (appointments || []).reduce((acc, appt) => {
        const providerId = appt.providerId || 'unknown';

        // Skip if not in our visible set
        if (!visibleProviderIds.has(providerId) && providerId !== 'unknown') {
            return acc;
        }

        // Only include providers that are in the active providers list (exclude system/unknown if needed, or keep 'unknown' separate)
        if (!activeProviderIds.has(providerId) && providerId !== 'unknown') {
            return acc;
        }

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

    // Calculate required height for each time slot based on ALL appointments across ALL providers
    const compactCardHeight = 24;
    const verticalGap = 1;
    const baseSlotHeight = 48;
    const getTimeSlotHeight = (time) => {
        const apptTime = time.substring(0, 5);
        let totalAppointments = 0;

        // Count ALL appointments at this time across ALL providers
        Object.values(appointmentsByProvider).forEach((providerGroup) => {
            const appointmentsAtTime = providerGroup.appointments.filter(a => {
                if (!a.time) return false;
                const aTime = a.time.substring(0, 5);
                return aTime === apptTime;
            }).filter(appt => {
                const isCancelledOrNoShow = appt.patient_status === 'cancelled' || ['no_show', 'no-show'].includes(appt.patient_status);
                return showCancelledAppointments || !isCancelledOrNoShow;
            });

            totalAppointments += appointmentsAtTime.length;
        });

        // Calculate height needed for all stacked appointments
        const stackedHeight = totalAppointments > 0
            ? (totalAppointments * compactCardHeight) + ((totalAppointments - 1) * verticalGap)
            : 0;

        // Return base height or expanded height if needed
        return stackedHeight > 0 ? Math.max(baseSlotHeight, stackedHeight + 2) : baseSlotHeight;
    };

    const handleTimeSlotClick = (time) => {
        setClickedTimeSlot(time);
        setNewAppt(prev => ({
            ...prev,
            time: time,
            date: format(currentDate, 'yyyy-MM-dd')
        }));
        setShowModal(true);
    };

    const handleAddAppointment = async () => {
        if (!newAppt.patientId) {
            alert('Please select a patient');
            return;
        }
        if (!newAppt.providerId) {
            alert('Please select a provider');
            return;
        }

        // Frontend validation: Overbooking cap removed per user request
        const selectedDate = newAppt.date || format(currentDate, 'yyyy-MM-dd');
        const selectedTime = newAppt.time;

        try {
            await appointmentsAPI.create({
                patientId: newAppt.patientId,
                providerId: newAppt.providerId,
                date: selectedDate,
                time: selectedTime,
                duration: newAppt.duration,
                type: newAppt.type,
                visitMethod: newAppt.visitMethod
            });

            // Auto-address the follow-up if this was a reschedule from Cancellations
            if (pendingFollowupId) {
                try {
                    await followupsAPI.address(pendingFollowupId, {
                        note: `Rescheduled to ${newAppt.date || format(currentDate, 'yyyy-MM-dd')} at ${newAppt.time}`
                    });
                    console.log('Follow-up auto-addressed:', pendingFollowupId);
                } catch (followupError) {
                    console.warn('Could not auto-address follow-up:', followupError);
                    // Don't block the appointment creation success
                }
                setPendingFollowupId(null);
            }

            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const params = { date: dateStr };
            const response = await appointmentsAPI.get(params);
            setAppointments(response.data || []);

            setShowModal(false);
            setClickedTimeSlot(null);
            setNewAppt({
                patientId: '',
                patient: '',
                providerId: newAppt.providerId,
                type: 'Follow-up',
                time: '09:00',
                duration: 30,
                date: format(currentDate, 'yyyy-MM-dd'),
                visitMethod: 'office'
            });
            setPatientSearch('');
        } catch (error) {
            console.error('Error creating appointment:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to create appointment. Please try again.';
            alert(errorMessage);
        }
    };

    const handlePatientNameClick = (e, appt) => {
        e.stopPropagation();
        if (appt.patientId) {
            navigate(`/patient/${appt.patientId}/snapshot`);
        }
    };

    // Calculate appointment position - FIXED for double booking
    const getAppointmentPosition = (appt, providerGroup) => {
        const [hours, minutes] = appt.time.split(':').map(Number);
        // Each slot is 48px (h-12), starting from 7:00 AM
        const minutesFromStart = (hours - 7) * 60 + minutes;
        const topPx = (minutesFromStart / 30) * 48; // 48px per 30 min slot
        // Height based on duration - min 48px for 30min to fit content
        const heightPx = Math.max((appt.duration / 30) * 48, 48);

        const providerKeys = Object.keys(appointmentsByProvider);
        const providerCount = providerKeys.length || 1;
        const providerIndex = providerKeys.indexOf(providerGroup.providerId || 'unknown');

        // Find ALL appointments at the same time slot for this provider (for overlap detection)
        const apptTime = appt.time.substring(0, 5);
        const allAtSameTime = providerGroup.appointments.filter(a => {
            const aTime = a.time?.substring(0, 5);
            return aTime === apptTime;
        });

        // Sort all appointments by status (active first, then cancelled/no-show) and then by ID
        allAtSameTime.sort((a, b) => {
            const aIsActive = a.patient_status !== 'cancelled' && !['no_show', 'no-show'].includes(a.patient_status);
            const bIsActive = b.patient_status !== 'cancelled' && !['no_show', 'no-show'].includes(b.patient_status);
            if (aIsActive !== bIsActive) {
                return aIsActive ? -1 : 1; // Active appointments first
            }
            return a.id.localeCompare(b.id); // Then by ID
        });

        // Find this appointment's index in the sorted list
        const overlapCount = allAtSameTime.length || 1;
        const overlapIndex = allAtSameTime.findIndex(a => a.id === appt.id);

        // Ensure overlapIndex is valid (should never be -1, but safety check)
        if (overlapIndex === -1) {
            console.warn('Appointment not found in same-time list:', appt.id);
            return { top: topPx, height: heightPx, left: '80px', width: 'calc(100% - 84px)', overlapCount: 1, overlapIndex: 0 };
        }

        // Constants
        const timeColumnWidth = 80; // w-20 = 80px
        const gap = 4; // padding between appointments

        // Calculate provider column percentage (after time column)
        const providerWidthPct = 100 / providerCount;
        const providerStartPct = providerIndex * providerWidthPct;

        // Calculate appointment slot within provider column
        const slotWidthPct = providerWidthPct / overlapCount;
        const slotStartPct = providerStartPct + (overlapIndex * slotWidthPct);

        // Build CSS calc() expressions
        // left = timeColumn + (percentage of remaining width) + gap
        // width = (percentage of remaining width) - gap
        const left = `calc(${timeColumnWidth + gap}px + (100% - ${timeColumnWidth + gap * 2}px) * ${slotStartPct / 100})`;
        const width = `calc((100% - ${timeColumnWidth + gap * 2}px) * ${slotWidthPct / 100} - ${gap}px)`;

        return { top: topPx, height: heightPx, left, width, overlapCount, overlapIndex };
    };

    const refreshAppointments = async () => {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const params = { date: dateStr };
        try {
            const response = await appointmentsAPI.get(params);
            setAppointments(response.data || []);
        } catch (error) {
            console.error('Error refreshing appointments:', error);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[#F8FAFC]">
            {/* Soft Modern Header - Elevated Z-Index to clear grid and sidebar */}
            <div className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 relative z-[40]">
                <div className="max-w-[1700px] mx-auto px-6 py-2.5">
                    <div className="flex items-center justify-between">
                        {/* Left: Title and Date Navigation */}
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100/50">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-semibold text-slate-700 tracking-tight">Schedule</h1>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Clinic Overview</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-2xl p-1 shadow-sm">
                                    <button
                                        className="p-2 hover:bg-white text-slate-400 hover:text-indigo-500 rounded-xl transition-all hover:shadow-sm active:scale-95"
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
                                            style={{ display: 'block' }}
                                            value={format(currentDate, 'yyyy-MM-dd')}
                                            onClick={(e) => { e.target.showPicker && e.target.showPicker(); }}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                                    setCurrentDate(new Date(y, m - 1, d));
                                                }
                                            }}
                                        />
                                    </div>
                                    <button
                                        className="p-2 hover:bg-white text-slate-400 hover:text-indigo-500 rounded-xl transition-all hover:shadow-sm active:scale-95"
                                        onClick={() => setCurrentDate(addDays(currentDate, 1))}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    className={`px-4 py-2 text-xs font-medium rounded-xl transition-all shadow-sm active:scale-95 ${format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                        : 'text-slate-500 bg-white border border-slate-100 hover:bg-slate-50'
                                        }`}
                                    onClick={() => setCurrentDate(new Date())}
                                >
                                    Today
                                </button>
                            </div>
                        </div>

                        {/* Right: Provider Filter and New Appointment */}
                        <div className="flex items-center gap-4">
                            {(providers || []).length > 0 && (
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
                                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-[9999] max-h-[400px] overflow-y-auto ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="px-2 py-1.5 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Select Providers to View
                                            </div>
                                            {(providers || []).map(p => (
                                                <label
                                                    key={p.id}
                                                    className="flex items-center gap-3 w-full p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                                >
                                                    <div className={`
                                                        w-5 h-5 rounded border flex items-center justify-center transition-all
                                                        ${selectedProviderIds.includes(p.id)
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'border-slate-300 bg-white'}
                                                    `}>
                                                        {selectedProviderIds.includes(p.id) && <span className="text-[10px] font-bold">✓</span>}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={selectedProviderIds.includes(p.id)}
                                                        onChange={() => toggleProvider(p.id)}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-900">{p.name || `${p.first_name} ${p.last_name}`}</div>
                                                        <div className="text-xs text-slate-500">{p.role_name || p.role || 'Provider'}</div>
                                                    </div>
                                                </label>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => { setSelectedProviderIds([]); setShowProviderMenu(false); }}
                                                    className="w-full py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg"
                                                >
                                                    Show All Providers
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setClickedTimeSlot(null);
                                    setNewAppt(prev => ({ ...prev, date: format(currentDate, 'yyyy-MM-dd') }));
                                    setShowModal(true);
                                }}
                                className="flex items-center gap-3 px-6 py-3 bg-indigo-500 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5" />
                                <span>New Appointment</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Grid Container */}
            <div className="flex-1 px-4 pb-4 overflow-hidden bg-[#F8FAFC]">
                <div className="h-full bg-white rounded-3xl border border-slate-100 overflow-hidden flex flex-col shadow-sm">
                    {/* Clean Toolbar */}
                    <div className="flex-shrink-0 px-4 py-2 bg-slate-50/30 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const nextValue = !showCancelledAppointments;
                                    setShowCancelledAppointments(nextValue);
                                    if (nextValue) {
                                        setDismissedAppointmentIds(new Set()); // Restore dismissed appointments when showing cancelled
                                    }
                                }}
                                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all ${showCancelledAppointments
                                    ? 'bg-white border border-slate-200 text-slate-500 shadow-sm'
                                    : 'bg-indigo-50/50 border border-indigo-100/50 text-indigo-500'
                                    }`}
                            >
                                {showCancelledAppointments ? (
                                    <>
                                        <FilterX className="w-3 h-3" />
                                        <span>Hide Cancelled</span>
                                    </>
                                ) : (
                                    <>
                                        <Filter className="w-3 h-3" />
                                        <span>Show Cancelled</span>
                                    </>
                                )}
                            </button>

                            <div className="h-4 w-[1px] bg-slate-200"></div>

                            <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-100">
                                <button
                                    onClick={() => setTimeFilter('am')}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${timeFilter === 'am' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    AM Only
                                </button>
                                <button
                                    onClick={() => setTimeFilter('pm')}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${timeFilter === 'pm' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    PM Only
                                </button>
                                <button
                                    onClick={() => setTimeFilter('both')}
                                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${timeFilter === 'both' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Full Day
                                </button>
                            </div>

                            <div className="h-4 w-[1px] bg-slate-200"></div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Arrived</span>
                                    <span className="text-slate-200">/</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400"></span> Checked In</span>
                                    <span className="text-slate-200">/</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400"></span> Room</span>
                                    <span className="text-slate-200">/</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Provider</span>
                                    <span className="text-slate-200">/</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> Out</span>
                                </div>
                            </div>
                        </div>

                        {/* Provider Legend */}
                        {Object.keys(appointmentsByProvider).length > 0 && (
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Providers</span>
                                <div className="flex items-center gap-2">
                                    {Object.values(appointmentsByProvider).map((providerGroup) => {
                                        const isSelected = selectedProviderIds.includes(providerGroup.providerId);
                                        return (
                                            <ProviderLegendItem
                                                key={providerGroup.providerId || 'unknown'}
                                                providerGroup={providerGroup}
                                                isSelected={isSelected}
                                                selectedProviderIds={selectedProviderIds}
                                                setSelectedProviderIds={setSelectedProviderIds}
                                                palette={PROVIDER_PALETTE}
                                                onUpdateColor={(colorIndex) => updateProviderColor(providerGroup.providerId, colorIndex)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Schedule Grid */}
                    <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                        <div className="min-w-full inline-block">
                            {/* Single Column Header */}
                            <div className="sticky top-0 z-[35] bg-white/95 backdrop-blur-sm border-b border-slate-100">
                                <div className="flex">
                                    <div className="w-20 flex-shrink-0 border-r border-slate-100 bg-slate-50/30"></div>
                                    <div className="flex-1 px-4 py-2">
                                        <div className="flex items-center gap-3">
                                            <div className="font-semibold text-xs text-slate-700">
                                                Provider Schedule
                                            </div>
                                            <div className="px-2 py-0.5 bg-slate-100 rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {appointments.length} Total
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Time Slots Grid */}
                            <div className="relative">
                                {/* Time Column and Provider Columns */}
                                {visibleTimeSlots.map((time, idx) => {
                                    const isHour = time.endsWith(':00');
                                    const hour = parseInt(time.split(':')[0]);
                                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                    const ampm = hour >= 12 ? 'PM' : 'AM';

                                    const slotHeight = getTimeSlotHeight(time);

                                    return (
                                        <div
                                            key={time}
                                            className={`flex border-b border-slate-50 ${isHour ? 'bg-white' : 'bg-slate-50/20'}`}
                                            style={{ minHeight: `${slotHeight}px`, height: `${slotHeight}px` }}
                                        >
                                            {/* Time Column */}
                                            <div className="w-20 flex-shrink-0 border-r border-slate-50 bg-white flex items-center justify-end pr-3">
                                                {isHour ? (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {displayHour} {ampm}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] text-slate-200">
                                                        :30
                                                    </span>
                                                )}
                                            </div>

                                            {/* Single Provider Column */}
                                            <div
                                                className="flex-1 relative cursor-pointer hover:bg-indigo-50/20 transition-all group"
                                                onClick={() => handleTimeSlotClick(time)}
                                            >
                                                {/* Empty slot indicator on hover */}
                                                {(() => {
                                                    const apptTime = time.substring(0, 5);
                                                    let existingCount = 0;
                                                    Object.values(appointmentsByProvider).forEach(group => {
                                                        existingCount += group.appointments.filter(a =>
                                                            a.time?.substring(0, 5) === apptTime &&
                                                            !['cancelled', 'no_show', 'no-show'].includes(a.patient_status) &&
                                                            !dismissedAppointmentIds.has(a.id)
                                                        ).length;
                                                    });

                                                    const compactCardHeight = 24;
                                                    const verticalGap = 1;

                                                    return (
                                                        <div
                                                            className={`absolute inset-x-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform scale-95 group-hover:scale-100 shadow-sm`}
                                                            style={{
                                                                top: `${existingCount * (compactCardHeight + verticalGap) + 4}px`,
                                                                height: `${compactCardHeight}px`
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 text-indigo-500">
                                                                <Plus className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">Book at {time}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Appointments Overlay - All providers in single column */}
                                {(() => {
                                    // Collect all appointments from all providers, sorted by time and provider
                                    const allAppointments = [];
                                    Object.values(appointmentsByProvider).forEach((providerGroup) => {
                                        providerGroup.appointments
                                            .filter(appt => {
                                                if (dismissedAppointmentIds.has(appt.id)) return false;
                                                const isCancelledOrNoShow = ['cancelled', 'no_show', 'no-show'].includes(appt.patient_status);
                                                return showCancelledAppointments || !isCancelledOrNoShow;
                                            })
                                            .forEach(appt => {
                                                allAppointments.push({
                                                    ...appt,
                                                    providerGroup: providerGroup
                                                });
                                            });
                                    });

                                    // Group by time slot
                                    const appointmentsByTime = {};
                                    allAppointments.forEach(appt => {
                                        const apptTime = appt.time?.substring(0, 5) || '';
                                        if (!appointmentsByTime[apptTime]) {
                                            appointmentsByTime[apptTime] = [];
                                        }
                                        appointmentsByTime[apptTime].push(appt);
                                    });

                                    // Sort appointments within each time slot
                                    Object.keys(appointmentsByTime).forEach(time => {
                                        appointmentsByTime[time].sort((a, b) => {
                                            const aIsActive = !['cancelled', 'no_show', 'no-show'].includes(a.patient_status);
                                            const bIsActive = !['cancelled', 'no_show', 'no-show'].includes(b.patient_status);
                                            if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
                                            // Then by provider name for consistency
                                            const aProvider = a.providerGroup?.providerName || '';
                                            const bProvider = b.providerGroup?.providerName || '';
                                            if (aProvider !== bProvider) return aProvider.localeCompare(bProvider);
                                            return a.id.localeCompare(b.id);
                                        });
                                    });

                                    return allAppointments.map(appt => {
                                        const apptTime = appt.time?.substring(0, 5) || '';

                                        // Skip if not in visible time slots
                                        const slotIdx = visibleTimeSlots.indexOf(apptTime);
                                        if (slotIdx === -1) return null;

                                        // Calculate cumulative top position based on previous visible time slots
                                        let cumulativeTop = 0;
                                        for (let i = 0; i < slotIdx; i++) {
                                            cumulativeTop += getTimeSlotHeight(visibleTimeSlots[i]);
                                        }
                                        const baseTopPx = cumulativeTop;

                                        // Fixed compact height for all appointments
                                        const compactCardHeight = 24;
                                        const verticalGap = 1;

                                        // Find position within this time slot
                                        const appointmentsAtSameTime = appointmentsByTime[apptTime] || [];
                                        const overlapIndex = appointmentsAtSameTime.findIndex(a => a.id === appt.id);

                                        // Stack appointments vertically
                                        let stackedTopPx = baseTopPx;
                                        for (let i = 0; i < overlapIndex; i++) {
                                            stackedTopPx += compactCardHeight + verticalGap;
                                        }

                                        // Full width of single column
                                        const timeColumnWidth = 80;
                                        const slotWidthCalc = `calc(100% - ${timeColumnWidth + 4}px)`;
                                        const leftOffset = `${timeColumnWidth + 2}px`;

                                        const color = appt.providerGroup.color;
                                        const isCancelledOrNoShow = ['cancelled', 'no_show', 'no-show'].includes(appt.patient_status);
                                        const isActiveInClinic = ['arrived', 'checked_in', 'checked-in', 'in_room', 'in-room'].includes(appt.patient_status);

                                        return (
                                            <div
                                                key={appt.id}
                                                className={`absolute border-l-[3px] rounded-lg shadow-sm hover:shadow-md transition-all overflow-visible group ${isCancelledOrNoShow
                                                    ? 'bg-slate-50 border-slate-300 opacity-60'
                                                    : isActiveInClinic
                                                        ? `${color.bg} ${color.border} ring-1 ring-indigo-400/30 shadow-indigo-100/20`
                                                        : `${color.bg} ${color.border}`
                                                    }`}
                                                style={{
                                                    top: `${stackedTopPx}px`,
                                                    height: `${compactCardHeight}px`,
                                                    left: leftOffset,
                                                    width: slotWidthCalc,
                                                    borderLeftColor: isCancelledOrNoShow
                                                        ? (['no_show', 'no-show'].includes(appt.patient_status) ? '#cbd5e1' : '#f1f5f9')
                                                        : color.accent,
                                                    zIndex: activeDropdownApptId === appt.id ? 100 : (isActiveInClinic ? 20 : 10)
                                                }}
                                            >
                                                {isCancelledOrNoShow && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDismissedAppointmentIds(prev => {
                                                                const next = new Set(prev);
                                                                next.add(appt.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-30 cursor-pointer border border-white"
                                                        title="Dismiss from schedule (will still appear in cancellations)"
                                                    >
                                                        <X className="w-2.5 h-2.5" />
                                                    </button>
                                                )}
                                                <div className="h-full px-1.5 py-0 flex items-center gap-1.5 overflow-visible relative">

                                                    {/* Column 1: Patient Name - Generous space */}
                                                    <div className="flex-shrink-0 w-[180px] min-w-[180px] max-w-[180px]">
                                                        <span
                                                            className={`font-semibold text-[11px] leading-tight ${isCancelledOrNoShow ? 'text-slate-400 line-through' : 'text-slate-700'} hover:underline cursor-pointer truncate block w-full`}
                                                            onClick={(e) => handlePatientNameClick(e, appt)}
                                                            title={appt.patientName}
                                                        >
                                                            {appt.patientName}
                                                        </span>
                                                    </div>

                                                    {/* Column 2: Appointment Type + Duration - Fixed width */}
                                                    <div className="flex-shrink-0 w-[100px] min-w-[100px] max-w-[100px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <VisitTypeDropdown
                                                                appt={appt}
                                                                onUpdate={refreshAppointments}
                                                                isCancelledOrNoShow={isCancelledOrNoShow}
                                                                onOpenChange={(open) => {
                                                                    if (open) setActiveDropdownApptId(appt.id);
                                                                    else if (activeDropdownApptId === appt.id) setActiveDropdownApptId(null);
                                                                }}
                                                            />
                                                            <span className={`text-[8px] font-bold ${isCancelledOrNoShow ? 'text-slate-300' : 'text-slate-400'}`}>{appt.duration}m</span>
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Provider Name - Expanded room with leading gap */}
                                                    <div className="flex-shrink-0 w-[115px] min-w-[115px] max-w-[115px] flex items-center overflow-visible pl-3">
                                                        <ProviderSelector
                                                            appointment={appt}
                                                            providers={providers}
                                                            currentProviderName={appt.providerGroup.providerName}
                                                            onProviderChange={refreshAppointments}
                                                            showInitials={true}
                                                        />
                                                    </div>

                                                    {/* Column 4: Status Flow - Flexible middle */}
                                                    <div className="flex-1 min-w-[210px] overflow-visible">
                                                        <InlinePatientStatus
                                                            appointment={appt}
                                                            onStatusUpdate={refreshAppointments}
                                                            showNoShowCancelled={false}
                                                            showCancelledBadge={true}
                                                        />
                                                    </div>

                                                    {/* Column 5: No Show/Cancelled Buttons - Right aligned */}
                                                    <div className="flex-shrink-0 w-[95px] min-w-[95px] max-w-[95px] flex items-center justify-end pr-1">
                                                        <NoShowCancelledButtons
                                                            appointment={appt}
                                                            onStatusUpdate={refreshAppointments}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* New Appointment Modal - Portaled for maximum priority focus */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10001] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-50/50 border-b border-indigo-100 px-8 py-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-indigo-900 tracking-tight">
                                {clickedTimeSlot ? `Book at ${clickedTimeSlot}` : 'New Appointment'}
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); setClickedTimeSlot(null); setPatientSearch(''); setPendingFollowupId(null); }}
                                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-500 transition-all border border-transparent hover:border-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-6">
                                {/* Left Column - Patient & Details */}
                                <div className="space-y-4">
                                    {/* Patient Search */}
                                    <div ref={patientSearchRef} className="relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Patient</label>
                                            <button
                                                type="button"
                                                onClick={() => { setShowModal(false); setShowAddPatientModal(true); }}
                                                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase tracking-wider"
                                            >
                                                + New Patient
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-slate-400"
                                                placeholder="Search by name or MRN..."
                                                value={patientSearch}
                                                onChange={(e) => {
                                                    setPatientSearch(e.target.value);
                                                    if (e.target.value === '') setNewAppt({ ...newAppt, patientId: '', patient: '' });
                                                }}
                                                onFocus={() => { if (patientSearchResults.length > 0) setShowPatientDropdown(true); }}
                                            />
                                            {newAppt.patientId && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setPatientSearch(''); setNewAppt({ ...newAppt, patientId: '', patient: '' }); setShowPatientDropdown(false); }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        {showPatientDropdown && patientSearchResults.length > 0 && (
                                            <div className="absolute z-[10002] w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto ring-1 ring-black/5 animate-in slide-in-from-top-2">
                                                {patientSearchResults.map(patient => (
                                                    <button
                                                        key={patient.id}
                                                        type="button"
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors text-sm border-b border-slate-50 last:border-0"
                                                        onClick={() => {
                                                            const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                                                            setPatientSearch(patientName + (patient.mrn ? ` (${patient.mrn})` : ''));
                                                            setNewAppt({ ...newAppt, patientId: patient.id, patient: patientName });
                                                            setShowPatientDropdown(false);
                                                        }}
                                                    >
                                                        <div className="font-bold text-slate-900">{patient.first_name} {patient.last_name}</div>
                                                        {patient.mrn && <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">MRN: {patient.mrn}</div>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {newAppt.patientId && (
                                            <div className="mt-2 text-[10px] text-blue-600 bg-blue-50/50 px-3 py-2 rounded-lg font-bold uppercase tracking-wider border border-blue-100">
                                                ✓ <span className="">{newAppt.patient}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Provider & Date Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Provider</label>
                                            <select
                                                className="w-full py-3 px-4 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all appearance-none font-medium text-slate-700"
                                                value={newAppt.providerId}
                                                onChange={(e) => setNewAppt({ ...newAppt, providerId: e.target.value })}
                                            >
                                                <option value="">Select Provider</option>
                                                {providers.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name || `${p.first_name} ${p.last_name}`}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Date</label>
                                            <input
                                                type="date"
                                                className="w-full py-3 px-4 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all font-medium text-slate-700"
                                                value={newAppt.date}
                                                onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Visit Type & Method Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Visit Type</label>
                                            <VisitTypeDropdown
                                                value={newAppt.type}
                                                onChange={(type, method) => setNewAppt({ ...newAppt, type, visitMethod: method || newAppt.visitMethod })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Visit Method</label>
                                            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                                <button
                                                    onClick={() => setNewAppt({ ...newAppt, visitMethod: 'office', type: newAppt.type === 'Telehealth Visit' ? 'Follow-up' : newAppt.type })}
                                                    className={`flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newAppt.visitMethod === 'office'
                                                        ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    Office
                                                </button>
                                                <button
                                                    onClick={() => setNewAppt({ ...newAppt, visitMethod: 'telehealth', type: 'Telehealth Visit' })}
                                                    className={`flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newAppt.visitMethod === 'telehealth'
                                                        ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    Telehealth
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Mini Scheduler */}
                                <div className="space-y-4">
                                    {/* Mini Scheduler - Visual Time Slot Picker */}
                                    <div className="h-full flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Time Slot</label>
                                            {newAppt.time && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold uppercase tracking-widest border border-indigo-100/50">
                                                    {newAppt.time}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-h-0 bg-slate-50/50 rounded-[2rem] p-4 border border-slate-100 flex flex-col">
                                            {!newAppt.providerId ? (
                                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                                                        <Users className="w-6 h-6 text-amber-500" />
                                                    </div>
                                                    <p className="text-sm font-medium text-amber-900/60 leading-relaxed">
                                                        Select a provider first to see their real-time availability.
                                                    </p>
                                                </div>
                                            ) : loadingModalAppts ? (
                                                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                                                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scanning Schedule...</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-y-auto pr-2 custom-scrollbar">
                                                    <div className="grid grid-cols-6 gap-1.5">
                                                        {timeSlots.map(slot => {
                                                            const appointmentsAtSlot = modalAppointments.filter(appt => {
                                                                if (!appt.time) return false;
                                                                const apptTime = appt.time.substring(0, 5);
                                                                return apptTime === slot;
                                                            });

                                                            const activeAppointments = appointmentsAtSlot.filter(appt => {
                                                                const status = (appt.patient_status || '').toLowerCase();
                                                                return status !== 'cancelled' && !['no_show', 'no-show'].includes(status);
                                                            });

                                                            const bookingCount = activeAppointments.length;
                                                            const maxSlots = clinicalSettings?.max_appointments_per_slot || 999; // Default to effectively no cap if not set
                                                            const isFullyBooked = bookingCount >= maxSlots;
                                                            const hasSomeBooking = bookingCount > 0;
                                                            const isSelected = newAppt.time === slot;

                                                            const bookedPatients = appointmentsAtSlot.map(a => {
                                                                const statusSuffix = a.patient_status === 'cancelled' ? ' (Cancelled)' :
                                                                    ['no_show', 'no-show'].includes(a.patient_status) ? ' (No Show)' : '';
                                                                return `${a.patient_name || 'Patient'}${statusSuffix}`;
                                                            });

                                                            return (
                                                                <button
                                                                    key={slot}
                                                                    onClick={() => !isFullyBooked && setNewAppt({ ...newAppt, time: slot })}
                                                                    className={`
                                                                        group relative h-10 rounded-lg flex items-center justify-center transition-all
                                                                        ${isFullyBooked ? 'bg-red-50 cursor-not-allowed' :
                                                                            isSelected ? 'bg-indigo-500 text-white shadow-lg ring-2 ring-indigo-200' :
                                                                                hasSomeBooking ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' :
                                                                                    'bg-white hover:bg-slate-50 border border-slate-100 text-slate-600'}
                                                                    `}
                                                                    title={isFullyBooked ? `Slot Full (${bookingCount}/${maxSlots} booked: ${bookedPatients.join(', ')})` :
                                                                        bookedPatients.length > 0 ? `Booked: ${bookedPatients.join(', ')}` : 'Available'}
                                                                >
                                                                    <span className="text-[10px] font-bold">{slot}</span>
                                                                    {bookingCount > 0 && !isSelected && (
                                                                        <div className="absolute top-1 right-1 flex gap-0.5">
                                                                            {[...Array(bookingCount)].map((_, i) => (
                                                                                <div key={i} className={`w-1 h-1 rounded-full ${isFullyBooked ? 'bg-red-400' : 'bg-amber-400'}`} />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-4 px-2 py-3 border-t border-slate-100">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                            <div className="w-2 h-2 bg-white border border-slate-200 rounded-sm" /> Available
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                            <div className="w-2 h-2 bg-amber-100 rounded-sm" /> 1/2 Filled
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                            <div className="w-2 h-2 bg-red-100 rounded-sm" /> Full
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                            <div className="w-2 h-2 bg-indigo-500 rounded-full" /> Selected
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowModal(false); setClickedTimeSlot(null); setPatientSearch(''); setPendingFollowupId(null); }}
                                className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAppointment}
                                className="px-10 py-3 text-sm font-bold bg-indigo-500 text-white rounded-xl shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                            >
                                Book Appointment
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Add Patient Modal */}
            <AddPatientModal
                isOpen={showAddPatientModal}
                onClose={() => { setShowAddPatientModal(false); setShowModal(true); }}
                onSuccess={(message) => { alert(message); setShowAddPatientModal(false); setShowModal(true); }}
            />
        </div>
    );
};

export default Schedule;
