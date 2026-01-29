import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Search, X, Calendar, Users, ChevronDown, Filter, FilterX } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ShieldAlert, AlertTriangle, Shield } from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { appointmentsAPI, authAPI, patientsAPI, followupsAPI } from '../services/api';
import AddPatientModal from '../components/AddPatientModal';
import InlinePatientStatus from '../components/InlinePatientStatus';

// No Show / Cancelled Buttons Component (extracted for use in Schedule)
const NoShowCancelledButtons = ({ appointment, onStatusUpdate }) => {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [reasonInput, setReasonInput] = useState('');

    const status = appointment?.patient_status || 'scheduled';
    const isTerminalState = status === 'checked_out' || status === 'no_show' || status === 'cancelled';

    const handleNoShowOrCancelled = (newStatus) => {
        if (newStatus === 'no_show') {
            // No Show doesn't require a reason - mark directly
            handleStatusChange(newStatus, null);
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
        const isActive = status === statusKey;
        const color = isActive
            ? (statusKey === 'no_show' ? 'text-orange-700 font-bold' : 'text-red-700 font-bold')
            : (statusKey === 'no_show' ? 'text-orange-500 hover:text-orange-600' : 'text-red-500 hover:text-red-600');

        return (
            <button
                type="button"
                onClick={() => {
                    if (!saving && statusKey !== status && !isTerminalState) {
                        handleNoShowOrCancelled(statusKey);
                    }
                }}
                disabled={saving || isTerminalState}
                className={`text-[8px] transition-all cursor-pointer ${color} ${saving || isTerminalState ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isActive && <span className="text-[7px] mr-0.5">✓</span>}
                <span className={isActive ? 'underline underline-offset-1' : ''}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <>
            <div className="flex items-center gap-1">
                <NoShowCancelledBtn statusKey="no_show" label="No Show" />
                <span className="text-gray-300 text-[8px]">·</span>
                <NoShowCancelledBtn statusKey="cancelled" label="Cancelled" />
            </div>

            {/* Cancellation Reason Modal - only for cancelled status */}
            {showReasonModal && pendingStatus === 'cancelled' && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center"
                    onClick={() => {
                        setShowReasonModal(false);
                        setReasonInput('');
                        setPendingStatus(null);
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-xl">
                            <h2 className="text-xl font-bold text-white">
                                Cancel Appointment
                            </h2>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cancellation Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    placeholder="Enter reason for cancellation..."
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                                    rows={3}
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
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReasonSubmit}
                                    disabled={!reasonInput.trim() || saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
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

    const displayName = currentProviderName?.split(' ')[1] || currentProviderName?.split(' ')[0] || 'Provider';

    // Filter to only show physicians/NP/PA (roles that can see patients)
    const providerOptions = (providers || []).filter(p => {
        const role = (p.role_name || p.role || '').toLowerCase();
        return role.includes('physician') || role.includes('doctor') || role.includes('np') ||
            role.includes('nurse practitioner') || role.includes('pa') || role.includes('physician assistant') ||
            role === 'clinician';
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-xl">
                    <h2 className="text-xl font-bold text-white">Change Provider</h2>
                    <p className="text-blue-100 text-sm mt-1">Assign patient to a different provider</p>
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Provider
                        </label>
                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                            {currentProviderName || 'No provider assigned'}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select New Provider <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedProviderId}
                            onChange={(e) => setSelectedProviderId(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="">Select a provider...</option>
                            {providerOptions.map(provider => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.name} ({provider.role_name || provider.role || 'Provider'})
                                </option>
                            ))}
                        </select>
                        {providerOptions.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">No physicians/NP/PA available</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !selectedProviderId || selectedProviderId === appointment.providerId}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Saving...' : 'Change Provider'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
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
                className="text-[8px] text-gray-600 hover:text-gray-800 cursor-pointer transition-colors truncate block w-full text-left"
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
    const [pendingFollowupId, setPendingFollowupId] = useState(null); // For auto-addressing after reschedule
    // Load saved preference from localStorage, default to true if not set
    const [showCancelledAppointments, setShowCancelledAppointments] = useState(() => {
        const saved = localStorage.getItem('schedule_showCancelled');
        return saved !== null ? saved === 'true' : true;
    });

    // Save preference to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('schedule_showCancelled', showCancelledAppointments.toString());
    }, [showCancelledAppointments]);

    // Time slots from 7 AM to 6 PM
    const timeSlots = [];
    for (let i = 7; i <= 18; i++) {
        timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
    }

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

        let hash = 0;
        const str = providerId + (providerName || '');
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: '#3b82f6', light: 'bg-blue-100' },
            { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: '#10b981', light: 'bg-emerald-100' },
            { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', accent: '#8b5cf6', light: 'bg-violet-100' },
            { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', accent: '#f59e0b', light: 'bg-amber-100' },
            { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', accent: '#f43f5e', light: 'bg-rose-100' },
            { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', accent: '#06b6d4', light: 'bg-cyan-100' },
            { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: '#6366f1', light: 'bg-indigo-100' },
            { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', accent: '#14b8a6', light: 'bg-teal-100' },
        ];

        return colors[Math.abs(hash) % colors.length];
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
    const baseSlotHeight = 50;
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
                const isCancelledOrNoShow = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
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

        // Frontend validation: Check if slot is already full (max 2)
        // Exception: If BOTH appointments are cancelled/no-show, treat slot as empty (0/2)
        const selectedDate = newAppt.date || format(currentDate, 'yyyy-MM-dd');
        const selectedTime = newAppt.time;
        const appointmentsAtSelectedSlot = modalAppointments.filter(appt => {
            if (!appt.time) return false;
            const apptTime = appt.time.substring(0, 5);
            return apptTime === selectedTime;
        });

        // Check if both are cancelled/no-show
        const allCancelled = appointmentsAtSelectedSlot.length === 2 &&
            appointmentsAtSelectedSlot.every(appt =>
                appt.patient_status === 'cancelled' || appt.patient_status === 'no_show'
            );

        // If both are cancelled, allow booking (treat as empty)
        // Otherwise, if 2 or more appointments exist, block booking
        if (!allCancelled && appointmentsAtSelectedSlot.length >= 2) {
            alert('This time slot is already full. Maximum 2 appointments allowed per time slot. Please select a different time.');
            return;
        }

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
            const aIsActive = a.patient_status !== 'cancelled' && a.patient_status !== 'no_show';
            const bIsActive = b.patient_status !== 'cancelled' && b.patient_status !== 'no_show';
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
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Modern Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Title and Date Navigation */}
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">Schedule</h1>
                                    <p className="text-xs text-slate-500">Manage appointments</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                                    <button
                                        className="p-2 hover:bg-white rounded-lg transition-all hover:shadow-sm"
                                        onClick={() => setCurrentDate(addDays(currentDate, -1))}
                                    >
                                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                                    </button>
                                    <div className="relative group">
                                        <div className="w-[280px] px-4 py-2 font-semibold text-slate-900 group-hover:bg-white rounded-lg transition-all text-center cursor-pointer select-none flex items-center justify-center gap-2">
                                            {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                            <ChevronDown className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <input
                                            type="date"
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
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
                                        className="p-2 hover:bg-white rounded-lg transition-all hover:shadow-sm"
                                        onClick={() => setCurrentDate(addDays(currentDate, 1))}
                                    >
                                        <ChevronRight className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                                <button
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm ${format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                        ? 'bg-blue-600 text-white border border-blue-700 hover:bg-blue-700'
                                        : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                                        }`}
                                    onClick={() => setCurrentDate(new Date())}
                                    title="Go to today's date"
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
                                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-xl px-3 py-2.5 transition-colors border border-transparent hover:border-slate-300"
                                    >
                                        <Users className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm font-medium text-slate-700">
                                            {selectedProviderIds.length === 0
                                                ? 'All Providers'
                                                : `${selectedProviderIds.length} Provider${selectedProviderIds.length === 1 ? '' : 's'}`}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showProviderMenu && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 max-h-[400px] overflow-y-auto">
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
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5" />
                                <span>New Appointment</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid - eCW Style */}
            <div className="flex-1 overflow-hidden bg-gray-50">
                <div className="h-full bg-white border-t border-gray-200 overflow-hidden flex flex-col">
                    {/* Toolbar */}
                    <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-300 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowCancelledAppointments(!showCancelledAppointments)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${showCancelledAppointments
                                    ? 'bg-white border-gray-400 text-gray-700 hover:bg-gray-50'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                                    }`}
                            >
                                {showCancelledAppointments ? (
                                    <>
                                        <FilterX className="w-3.5 h-3.5" />
                                        <span>Hide Cancelled</span>
                                    </>
                                ) : (
                                    <>
                                        <Filter className="w-3.5 h-3.5" />
                                        <span>Show Cancelled</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="font-semibold">Status:</span>
                                <span className="text-blue-600">Arrived</span>
                                <span>→</span>
                                <span className="text-green-600">Checked In</span>
                                <span>→</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-purple-600">Room</span>
                                    <span className="w-2.5 h-2.5 rounded-full border-2 border-violet-500 bg-violet-50" title="With Nurse" />
                                    <span className="text-[9px] text-violet-600 font-medium">Nurse</span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Ready for Provider" />
                                    <span className="text-[9px] text-amber-600 font-medium">Provider</span>
                                </div>
                                <span>→</span>
                                <span className="text-red-600">Out</span>
                            </div>
                            {/* Provider Color Legend */}
                            {Object.keys(appointmentsByProvider).length > 0 && (
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="font-semibold text-gray-600">Providers:</span>
                                    {Object.values(appointmentsByProvider).map((providerGroup) => (
                                        <div key={providerGroup.providerId || 'unknown'} className="flex items-center gap-1.5">
                                            <div
                                                className={`w-3 h-3 rounded border-2 ${providerGroup.color.bg} ${providerGroup.color.border}`}
                                                style={{
                                                    borderLeftWidth: '3px',
                                                    borderLeftColor: providerGroup.color.accent
                                                }}
                                            />
                                            <span className="text-gray-700 font-medium">{providerGroup.providerName}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Schedule Grid */}
                    <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                        <div className="min-w-full inline-block">
                            {/* Single Column Header */}
                            <div className="sticky top-0 z-10 bg-white border-b-2 border-gray-300">
                                <div className="flex">
                                    <div className="w-24 flex-shrink-0 border-r-2 border-gray-300 bg-gray-50"></div>
                                    <div className="flex-1 border-r border-gray-200 bg-gray-50 px-3 py-2">
                                        <div className="font-semibold text-sm text-gray-800">
                                            All Providers
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} total
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Time Slots Grid */}
                            <div className="relative">
                                {/* Time Column and Provider Columns */}
                                {timeSlots.map((time, idx) => {
                                    const isHour = time.endsWith(':00');
                                    const hour = parseInt(time.split(':')[0]);
                                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                    const ampm = hour >= 12 ? 'PM' : 'AM';

                                    const slotHeight = getTimeSlotHeight(time);

                                    return (
                                        <div
                                            key={time}
                                            className={`flex border-b border-gray-200 ${isHour ? 'bg-white' : 'bg-gray-50/50'}`}
                                            style={{ minHeight: `${slotHeight}px`, height: `${slotHeight}px` }}
                                        >
                                            {/* Time Column */}
                                            <div className="w-24 flex-shrink-0 border-r-2 border-gray-300 bg-white flex items-center justify-end pr-3">
                                                {isHour && (
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        {displayHour} {ampm}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Single Provider Column */}
                                            <div
                                                className="flex-1 border-r border-gray-200 relative cursor-pointer hover:bg-blue-50/30 transition-colors"
                                                onClick={() => handleTimeSlotClick(time)}
                                            >
                                                {/* Empty slot indicator on hover */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                                    <span className="text-xs text-blue-600 font-medium">+ Add</span>
                                                </div>
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
                                                const isCancelledOrNoShow = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
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
                                            const aIsActive = a.patient_status !== 'cancelled' && a.patient_status !== 'no_show';
                                            const bIsActive = b.patient_status !== 'cancelled' && b.patient_status !== 'no_show';
                                            if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
                                            // Then by provider name for consistency
                                            const aProvider = a.providerGroup?.providerName || '';
                                            const bProvider = b.providerGroup?.providerName || '';
                                            if (aProvider !== bProvider) return aProvider.localeCompare(bProvider);
                                            return a.id.localeCompare(b.id);
                                        });
                                    });

                                    return allAppointments.map(appt => {
                                        const [hours, minutes] = appt.time.split(':').map(Number);
                                        const minutesFromStart = (hours - 7) * 60 + minutes;
                                        // Calculate cumulative top position based on previous time slots
                                        let cumulativeTop = 0;
                                        const apptSlotIndex = Math.floor(minutesFromStart / 30);
                                        for (let i = 0; i < apptSlotIndex; i++) {
                                            cumulativeTop += getTimeSlotHeight(timeSlots[i]);
                                        }
                                        const baseTopPx = cumulativeTop;

                                        // Fixed compact height for all appointments
                                        const compactCardHeight = 24;
                                        const verticalGap = 1;

                                        // Find position within this time slot
                                        const apptTime = appt.time.substring(0, 5);
                                        const appointmentsAtSameTime = appointmentsByTime[apptTime] || [];
                                        const overlapIndex = appointmentsAtSameTime.findIndex(a => a.id === appt.id);

                                        // Stack appointments vertically
                                        let stackedTopPx = baseTopPx;
                                        for (let i = 0; i < overlapIndex; i++) {
                                            stackedTopPx += compactCardHeight + verticalGap;
                                        }

                                        // Full width of single column
                                        const timeColumnWidth = 96;
                                        const slotWidthCalc = `calc(100% - ${timeColumnWidth + 4}px)`;
                                        const leftOffset = `${timeColumnWidth + 2}px`;

                                        const color = appt.providerGroup.color;
                                        const isCancelledOrNoShow = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
                                        const isActiveInClinic = appt.patient_status === 'arrived' || appt.patient_status === 'checked_in' || appt.patient_status === 'in_room';

                                        return (
                                            <div
                                                key={appt.id}
                                                className={`absolute border-l-2 rounded shadow-sm hover:shadow-md transition-all overflow-visible ${isCancelledOrNoShow
                                                    ? 'bg-gray-100 border-gray-400 opacity-70'
                                                    : isActiveInClinic
                                                        ? `${color.bg} ${color.border} ring-2 ring-blue-400 ring-opacity-60 shadow-lg`
                                                        : `${color.bg} ${color.border}`
                                                    }`}
                                                style={{
                                                    top: `${stackedTopPx}px`,
                                                    height: `${compactCardHeight}px`,
                                                    left: leftOffset,
                                                    width: slotWidthCalc,
                                                    borderLeftColor: isCancelledOrNoShow
                                                        ? (appt.patient_status === 'no_show' ? '#f97316' : '#ef4444')
                                                        : isActiveInClinic
                                                            ? '#3b82f6' // Blue border for active patients
                                                            : color.accent,
                                                    borderLeftWidth: isActiveInClinic ? '3px' : '2px',
                                                }}
                                            >
                                                <div className={`h-full px-1.5 py-0 flex items-center gap-1.5 overflow-visible relative ${isCancelledOrNoShow ? 'line-through' : ''}`}>
                                                    {/* Column 1: Patient Name - Fixed width with truncation */}
                                                    <div className="flex-shrink-0 w-[120px] min-w-[120px] max-w-[120px]">
                                                        <span
                                                            className={`font-semibold text-[9px] leading-tight ${isCancelledOrNoShow ? 'text-gray-500' : color.text} hover:underline cursor-pointer truncate block w-full`}
                                                            onClick={(e) => handlePatientNameClick(e, appt)}
                                                            title={appt.patientName}
                                                        >
                                                            {appt.patientName}
                                                        </span>
                                                    </div>

                                                    {/* Column 2: Appointment Type + Duration - Fixed width */}
                                                    <div className="flex-shrink-0 w-[85px] min-w-[85px] max-w-[85px]">
                                                        <div className="flex items-center gap-0.5">
                                                            <span className={`text-[8px] ${isCancelledOrNoShow ? 'text-gray-500' : 'text-gray-700'} truncate`}>{appt.type}</span>
                                                            <span className={`text-[8px] ${isCancelledOrNoShow ? 'text-gray-400' : 'text-gray-400'}`}>-</span>
                                                            <span className={`text-[8px] ${isCancelledOrNoShow ? 'text-gray-500' : 'text-gray-700'} whitespace-nowrap`}>{appt.duration}m</span>
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Provider Name/Initials - Fixed width */}
                                                    <div className="flex-shrink-0 w-[60px] min-w-[60px] max-w-[60px] flex items-center">
                                                        <ProviderSelector
                                                            appointment={appt}
                                                            providers={providers}
                                                            currentProviderName={appt.providerGroup.providerName}
                                                            onProviderChange={refreshAppointments}
                                                            showInitials={true}
                                                        />
                                                    </div>

                                                    {/* Column 4: Status Flow - Flexible but with min width */}
                                                    <div className="flex-1 min-w-[150px] overflow-hidden">
                                                        <InlinePatientStatus
                                                            appointment={appt}
                                                            onStatusUpdate={refreshAppointments}
                                                            showNoShowCancelled={false}
                                                            showCancelledBadge={true}
                                                        />
                                                    </div>

                                                    {/* Column 5: No Show/Cancelled Buttons - Fixed width on right, always visible */}
                                                    <div className="flex-shrink-0 w-[100px] min-w-[100px] max-w-[100px] flex items-center justify-end pr-1">
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

            {/* New Appointment Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                            <h2 className="text-lg font-bold text-white">
                                {clickedTimeSlot ? `New Appointment at ${clickedTimeSlot}` : 'New Appointment'}
                            </h2>
                        </div>

                        <div className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Left Column - Patient & Details */}
                                <div className="space-y-3">
                                    {/* Patient Search */}
                                    <div ref={patientSearchRef} className="relative">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-semibold text-slate-700">Patient</label>
                                            <button
                                                type="button"
                                                onClick={() => { setShowModal(false); setShowAddPatientModal(true); }}
                                                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                + New Patient
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {showPatientDropdown && patientSearchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                                                {patientSearchResults.map(patient => (
                                                    <button
                                                        key={patient.id}
                                                        type="button"
                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm"
                                                        onClick={() => {
                                                            const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                                                            setPatientSearch(patientName + (patient.mrn ? ` (${patient.mrn})` : ''));
                                                            setNewAppt({ ...newAppt, patientId: patient.id, patient: patientName });
                                                            setShowPatientDropdown(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</div>
                                                        {patient.mrn && <div className="text-xs text-slate-500">MRN: {patient.mrn}</div>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {newAppt.patientId && (
                                            <div className="mt-1 text-xs text-slate-600 bg-blue-50 p-2 rounded-lg">
                                                ✓ <span className="font-semibold text-blue-700">{newAppt.patient}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Provider & Date Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Provider</label>
                                            <select
                                                className="w-full py-2 px-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                value={newAppt.providerId}
                                                onChange={(e) => setNewAppt({ ...newAppt, providerId: e.target.value })}
                                            >
                                                <option value="">Select</option>
                                                {(providers || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Date</label>
                                            <input
                                                type="date"
                                                className="w-full py-2 px-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                value={newAppt.date || format(currentDate, 'yyyy-MM-dd')}
                                                onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Duration & Type Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Duration</label>
                                            <select
                                                className="w-full py-2 px-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                value={newAppt.duration}
                                                onChange={(e) => setNewAppt({ ...newAppt, duration: Number(e.target.value) })}
                                            >
                                                <option value={15}>15 min</option>
                                                <option value={30}>30 min</option>
                                                <option value={45}>45 min</option>
                                                <option value={60}>60 min</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Type</label>
                                            <select
                                                className="w-full py-2 px-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                value={newAppt.type}
                                                onChange={(e) => {
                                                    const newType = e.target.value;
                                                    const updates = { type: newType };
                                                    if (newType === 'Telehealth Visit') {
                                                        updates.visitMethod = 'telehealth';
                                                    }
                                                    setNewAppt({ ...newAppt, ...updates });
                                                }}
                                            >
                                                <option value="Follow-up">Follow-up</option>
                                                <option value="New Patient">New Patient</option>
                                                <option value="Sick Visit">Sick Visit</option>
                                                <option value="Physical">Physical</option>
                                                <option value="Telehealth Visit">Telehealth Visit</option>
                                                <option value="Consultation">Consultation</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Visit Method Toggle */}
                                    <div className="mb-4">
                                        <label className="text-xs font-semibold text-slate-700 mb-2 block">Visit Method</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                            <button
                                                type="button"
                                                onClick={() => setNewAppt({ ...newAppt, visitMethod: 'office' })}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${newAppt.visitMethod === 'office' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Office
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewAppt({ ...newAppt, visitMethod: 'telehealth' })}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${newAppt.visitMethod === 'telehealth' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Telehealth
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Time Slot Picker */}
                                <div>

                                    {/* Mini Scheduler - Visual Time Slot Picker */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-semibold text-slate-700">Select Time Slot</label>
                                            {newAppt.time && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-medium">
                                                    Selected: {newAppt.time}
                                                </span>
                                            )}
                                        </div>

                                        {!newAppt.providerId ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-700 text-sm">
                                                Please select a provider first to see availability
                                            </div>
                                        ) : loadingModalAppts ? (
                                            <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500 text-sm">
                                                Loading schedule...
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="grid grid-cols-6 gap-1">
                                                    {timeSlots.map(slot => {
                                                        // Check how many appointments are at this exact time slot
                                                        const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);

                                                        // Count ALL appointments that START at this exact slot time
                                                        // Exception: If BOTH are cancelled/no-show, treat as empty (0/2)
                                                        const appointmentsAtSlot = modalAppointments.filter(appt => {
                                                            if (!appt.time) return false;
                                                            const apptTime = appt.time.substring(0, 5);
                                                            return apptTime === slot;
                                                        });

                                                        // Check if both are cancelled/no-show
                                                        const allCancelled = appointmentsAtSlot.length === 2 &&
                                                            appointmentsAtSlot.every(appt =>
                                                                appt.patient_status === 'cancelled' || appt.patient_status === 'no_show'
                                                            );

                                                        // If both cancelled, treat as 0 bookings (empty slot)
                                                        const effectiveCount = allCancelled ? 0 : appointmentsAtSlot.length;
                                                        const bookingCount = effectiveCount;
                                                        const isFullyBooked = bookingCount >= 2; // Max 2 patients per slot
                                                        const hasOneBooking = bookingCount === 1;
                                                        const isSelected = newAppt.time === slot;

                                                        // Get patient names for tooltip (include cancelled status)
                                                        const bookedPatients = appointmentsAtSlot.map(a => {
                                                            const status = a.patient_status === 'cancelled' ? ' (Cancelled)' :
                                                                a.patient_status === 'no_show' ? ' (No Show)' : '';
                                                            return a.patientName + status;
                                                        }).join(', ');

                                                        return (
                                                            <button
                                                                key={slot}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!isFullyBooked) {
                                                                        setNewAppt({ ...newAppt, time: slot });
                                                                    }
                                                                }}
                                                                disabled={isFullyBooked}
                                                                className={`
                                                            py-1.5 px-0.5 text-[10px] font-medium rounded transition-all relative
                                                            ${isSelected
                                                                        ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                                                        : isFullyBooked
                                                                            ? 'bg-red-200 text-red-500 cursor-not-allowed'
                                                                            : hasOneBooking
                                                                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                                                                                : 'bg-white text-slate-700 hover:bg-green-100 hover:text-green-700 border border-slate-200 hover:border-green-300'
                                                                    }
                                                        `}
                                                                title={isFullyBooked
                                                                    ? `FULL: ${bookedPatients}`
                                                                    : hasOneBooking
                                                                        ? `1/2 booked: ${bookedPatients}`
                                                                        : 'Available'}
                                                            >
                                                                {slot}
                                                                {bookingCount > 0 && (
                                                                    <span className={`absolute -top-1 -right-1 w-3 h-3 text-[8px] rounded-full flex items-center justify-center font-bold ${isFullyBooked ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                                                        }`}>
                                                                        {bookingCount}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Legend */}
                                                <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2.5 h-2.5 bg-white border border-slate-200 rounded"></span>
                                                        Open
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded"></span>
                                                        1/2
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2.5 h-2.5 bg-red-200 rounded"></span>
                                                        Full
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2.5 h-2.5 bg-blue-600 rounded"></span>
                                                        Selected
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowModal(false); setClickedTimeSlot(null); setPatientSearch(''); setPendingFollowupId(null); }}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAppointment}
                                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
                            >
                                Book Appointment
                            </button>
                        </div>
                    </div>
                </div>
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
