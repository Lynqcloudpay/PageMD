import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, Search, X, ChevronDown, Filter, FilterX } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
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
    const providerOptions = providers.filter(p => {
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
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [providers, setProviders] = useState([]);
    // Load saved provider preference from localStorage
    const [selectedProvider, setSelectedProvider] = useState(() => {
        const saved = localStorage.getItem('schedule_selectedProvider');
        return saved || null;
    });
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
        date: format(new Date(), 'yyyy-MM-dd')
    });
    const [patientSearch, setPatientSearch] = useState('');
    const [patientSearchResults, setPatientSearchResults] = useState([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const patientSearchRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [modalAppointments, setModalAppointments] = useState([]);
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
                const savedProviderId = localStorage.getItem('schedule_selectedProvider');
                if (savedProviderId) {
                    // Verify the saved provider still exists in the list
                    const savedProvider = providersList.find(p => p.id === savedProviderId);
                    if (savedProvider) {
                        setSelectedProvider(savedProviderId);
                        setNewAppt(prev => ({ ...prev, providerId: savedProviderId }));
                        return; // Don't override with role-based selection if saved preference exists
                    }
                }

                // If no saved preference, use role-based selection
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
                        setSelectedProvider(currentUserProvider.id);
                        setNewAppt(prev => ({ ...prev, providerId: currentUserProvider.id }));
                    }
                }
            } catch (error) {
                console.error('Error fetching providers:', error);
            }
        };
        fetchProviders();
    }, [user]);

    // Save provider preference to localStorage whenever it changes
    useEffect(() => {
        if (selectedProvider) {
            localStorage.setItem('schedule_selectedProvider', selectedProvider);
        } else {
            localStorage.removeItem('schedule_selectedProvider');
        }
    }, [selectedProvider]);

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

            try {
                const params = { date: newAppt.date, providerId: newAppt.providerId };
                const response = await appointmentsAPI.get(params);
                setModalAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching modal appointments:', error);
                setModalAppointments([]);
            }
        };

        fetchModalAppointments();
    }, [showModal, newAppt.date, newAppt.providerId]);

    // Fetch appointments
    useEffect(() => {
        const fetchAppointments = async (isRefresh = false) => {
            // Only show loading on initial load, not on refresh
            if (!isRefresh) {
                setLoading(true);
            }
            try {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const params = { date: dateStr };
                if (selectedProvider) params.providerId = selectedProvider;
                const response = await appointmentsAPI.get(params);
                setAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setAppointments([]);
            } finally {
                if (!isRefresh) {
                    setLoading(false);
                }
                isInitialLoad = false;
            }
        };

        fetchAppointments();

        // Auto-refresh every 10 seconds (silent refresh, no loading state)
        const interval = setInterval(() => {
            fetchAppointments(true);
        }, 10000);

        return () => clearInterval(interval);
    }, [currentDate, selectedProvider]);

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

    // Group appointments by provider - only include active providers
    const activeProviderIds = new Set(providers.map(p => p.id));
    const appointmentsByProvider = appointments.reduce((acc, appt) => {
        const providerId = appt.providerId || 'unknown';
        // Only include providers that are in the active providers list
        if (!activeProviderIds.has(providerId) && providerId !== 'unknown') {
            return acc; // Skip suspended/inactive providers
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
                type: newAppt.type
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
            if (selectedProvider) params.providerId = selectedProvider;
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
                date: format(currentDate, 'yyyy-MM-dd')
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
        if (selectedProvider) params.providerId = selectedProvider;
        try {
            const response = await appointmentsAPI.get(params);
            setAppointments(response.data || []);
        } catch (error) {
            console.error('Error refreshing appointments:', error);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#fcfdfe] animate-fade-in overflow-hidden">
            {/* Premium Schedule Header */}
            <header className="h-[100px] frothy-blur border-b border-slate-100 px-8 flex items-center justify-between shrink-0 relative z-30">
                <div className="flex items-center gap-12">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">Schedule</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Resource Allocation & Deployment</p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100">
                        <button
                            onClick={() => setCurrentDate(prev => addDays(prev, -1))}
                            className="p-3 hover:bg-white hover:shadow-lg rounded-[1rem] transition-all text-slate-400 hover:text-slate-900"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-6 flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{format(currentDate, 'EEEE')}</span>
                            <span className="text-sm font-black text-slate-900 tracking-tight">{format(currentDate, 'MMMM d, yyyy')}</span>
                        </div>
                        <button
                            onClick={() => setCurrentDate(prev => addDays(prev, 1))}
                            className="p-3 hover:bg-white hover:shadow-lg rounded-[1rem] transition-all text-slate-400 hover:text-slate-900"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                            <Filter className="w-4 h-4" />
                        </div>
                        <select
                            value={selectedProvider || ''}
                            onChange={(e) => setSelectedProvider(e.target.value || null)}
                            className="h-12 pl-12 pr-10 bg-white border border-slate-100 rounded-2xl text-[12px] font-black text-slate-900 outline-none hover:border-primary-200 transition-all shadow-sm appearance-none tracking-tight uppercase"
                        >
                            <option value="">Consolidated Fleet View</option>
                            {providers.filter(p => (p.role_name || p.role || '').toLowerCase().includes('physician') || (p.role_name || p.role || '').toLowerCase().includes('np') || (p.role_name || p.role || '').toLowerCase().includes('pa')).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-300">
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>

                    <button
                        onClick={() => setShowCancelledAppointments(!showCancelledAppointments)}
                        className={`h-12 px-5 rounded-2xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${showCancelledAppointments
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xl'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                            }`}
                    >
                        {showCancelledAppointments ? <FilterX className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                        {showCancelledAppointments ? 'Hide Trash' : 'Trash Off'}
                    </button>

                    <button
                        onClick={() => {
                            setClickedTimeSlot(format(new Date(), 'HH:00'));
                            setNewAppt(prev => ({ ...prev, time: format(new Date(), 'HH:00'), date: format(currentDate, 'yyyy-MM-dd') }));
                            setShowModal(true);
                        }}
                        className="frothy-btn-primary h-12"
                    >
                        <Plus className="w-4 h-4" /> Deploy Patient
                    </button>
                </div>
            </header>

            {/* Main Execution Grid */}
            <main className="flex-1 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <div className="spinner w-12 h-12 text-primary-500 mb-4"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Synchronizing Data...</span>
                        </div>
                    </div>
                )}

                <div
                    ref={scrollContainerRef}
                    className="h-full overflow-y-auto custom-scrollbar relative bg-slate-50/30"
                >
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 pointer-events-none">
                        {timeSlots.map(time => (
                            <div
                                key={time}
                                className="border-b border-slate-100/50"
                                style={{ height: `${getTimeSlotHeight(time)}px` }}
                            />
                        ))}
                    </div>

                    <div className="min-h-full flex flex-col relative">
                        {timeSlots.map(time => {
                            const isHour = time.endsWith(':00');
                            const height = getTimeSlotHeight(time);

                            return (
                                <div
                                    key={time}
                                    style={{ height: `${height}px` }}
                                    className="group relative flex items-center border-b border-slate-100/60 hover:bg-white transition-colors"
                                    onClick={() => handleTimeSlotClick(time)}
                                >
                                    {/* Vertical Timeline Tracker */}
                                    <div className="w-[100px] h-full flex items-center justify-center border-r border-slate-100 bg-white shrink-0 relative">
                                        {isHour ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[11px] font-black text-slate-900 tracking-tight leading-none mb-1">
                                                    {time.split(':')[0]}
                                                    <span className="text-slate-300">:00</span>
                                                </span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">30m</span>
                                        )}
                                    </div>

                                    {/* Action Trigger Area */}
                                    <div className="flex-1 h-full px-4 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="px-3 py-1.5 bg-primary-500 text-white text-[9px] font-black rounded-lg shadow-lg flex items-center gap-2 cursor-pointer uppercase tracking-widest">
                                            <Plus className="w-3 h-3" /> Insert Record
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Rendering Distributed Appointment Cards */}
                        {Object.values(appointmentsByProvider).map(group => (
                            <React.Fragment key={group.providerId || 'unknown'}>
                                {group.appointments
                                    .filter(appt => {
                                        const isCancelledOrNoShow = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
                                        return showCancelledAppointments || !isCancelledOrNoShow;
                                    })
                                    .map(appt => {
                                        const pos = getAppointmentPosition(appt, group);
                                        const isCancelled = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
                                        const isCheckedIn = appt.patient_status === 'checked_in' || appt.patient_status === 'roomed';
                                        const isCompleted = appt.patient_status === 'checked_out';

                                        return (
                                            <div
                                                key={appt.id}
                                                className="absolute p-1 transition-all duration-500 animate-scale-in group/card"
                                                style={{
                                                    top: `${pos.top}px`,
                                                    height: `${pos.height}px`,
                                                    left: pos.left,
                                                    width: pos.width,
                                                    zIndex: 10
                                                }}
                                            >
                                                <div
                                                    className={`h-full rounded-[1.2rem] border transition-all duration-300 relative overflow-hidden flex flex-col p-2.5 ${isCancelled
                                                        ? 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                                                        : isCheckedIn
                                                            ? 'bg-white border-primary-200 shadow-xl shadow-primary-500/5'
                                                            : isCompleted
                                                                ? 'bg-emerald-50/30 border-emerald-100 opacity-80'
                                                                : 'bg-white border-white shadow-lg shadow-slate-200/30 hover:border-primary-100'
                                                        }`}
                                                >
                                                    {/* Status Accent Bar */}
                                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${isCancelled ? 'bg-slate-300' :
                                                        isCompleted ? 'bg-emerald-400' :
                                                            isCheckedIn ? 'bg-primary-500' :
                                                                'bg-slate-200'
                                                        }`}></div>

                                                    <div className="flex items-start justify-between mb-1 ml-1.5">
                                                        <div
                                                            onClick={(e) => handlePatientNameClick(e, appt)}
                                                            className={`text-[12px] font-black tracking-tight uppercase cursor-pointer transition-colors truncate pr-2 ${isCancelled ? 'text-slate-400' : 'text-slate-900 hover:text-primary-600'
                                                                }`}
                                                        >
                                                            {appt.patientName}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <ProviderSelector
                                                                appointment={appt}
                                                                providers={providers}
                                                                currentProviderName={appt.providerName}
                                                                onProviderChange={() => {
                                                                    const dateStr = format(currentDate, 'yyyy-MM-dd');
                                                                    const params = { date: dateStr };
                                                                    if (selectedProvider) params.providerId = selectedProvider;
                                                                    appointmentsAPI.get(params).then(res => setAppointments(res.data || []));
                                                                }}
                                                                showInitials={true}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-auto ml-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[8px] font-black text-slate-400 uppercase tracking-tight">
                                                                {appt.type}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                                                                <Clock className="w-2.5 h-2.5" /> {appt.time.substring(0, 5)}
                                                            </div>
                                                        </div>
                                                        <NoShowCancelledButtons
                                                            appointment={appt}
                                                            onStatusUpdate={(updated) => {
                                                                setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Room Status Integration */}
                                                    <div className="mt-1 ml-1.5">
                                                        <InlinePatientStatus
                                                            appointment={appt}
                                                            onUpdate={(updated) => {
                                                                setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </main>

            {/* Premium Deployment Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-white animate-scale-in flex flex-col md:flex-row max-h-[90vh]">
                        {/* Right Form Side */}
                        <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Patient Entry</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Tactical Appointment Creation</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-4 hover:bg-slate-50 rounded-[1.5rem] text-slate-300 transition-all"><X className="w-6 h-6" /></button>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3 relative" ref={patientSearchRef}>
                                    <label className="frothy-label">Identity Identification</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-300">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={patientSearch}
                                            onChange={(e) => setPatientSearch(e.target.value)}
                                            placeholder="SCAN BY NAME, MRN, OR SSN..."
                                            className="w-full h-16 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-primary-400 focus:shadow-xl focus:shadow-primary-500/5 transition-all tracking-tight uppercase"
                                        />
                                        {showPatientDropdown && patientSearchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden animate-fade-in py-2">
                                                {patientSearchResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setNewAppt({ ...newAppt, patientId: p.id, patient: p.name });
                                                            setPatientSearch(p.name);
                                                            setShowPatientDropdown(false);
                                                        }}
                                                        className="w-full px-8 py-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                                                    >
                                                        <div>
                                                            <div className="font-black text-slate-900 tracking-tight">{p.name}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{p.mrn} • {p.dob ? format(new Date(p.dob), 'MMM dd, yyyy') : 'N/A'}</div>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-200 group-hover:text-primary-500 group-hover:scale-110 transition-all">
                                                            <ChevronRight className="w-4 h-4" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={() => setShowAddPatientModal(true)}
                                            className="text-[10px] font-black text-primary-500 hover:text-primary-600 uppercase tracking-widest flex items-center gap-1.5 group"
                                        >
                                            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Initialize New Record
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="frothy-label">Resource Allocation</label>
                                        <select
                                            value={newAppt.providerId}
                                            onChange={(e) => setNewAppt({ ...newAppt, providerId: e.target.value })}
                                            className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-primary-400 transition-all tracking-tight uppercase"
                                        >
                                            <option value="">Select Resource...</option>
                                            {providers.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="frothy-label">Deployment Protocol</label>
                                        <select
                                            value={newAppt.type}
                                            onChange={(e) => setNewAppt({ ...newAppt, type: e.target.value })}
                                            className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-primary-400 transition-all tracking-tight uppercase"
                                        >
                                            {['New Patient', 'Follow-up', 'Consultation', 'Procedure', 'Emergent', 'Telehealth'].map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="frothy-label">Temporal Window</label>
                                        <div className="flex items-center gap-4">
                                            <select
                                                value={newAppt.time}
                                                onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                                                className="flex-1 h-16 px-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-primary-400 transition-all tracking-tight"
                                            >
                                                {timeSlots.map(time => (
                                                    <option key={time} value={time}>{time}</option>
                                                ))}
                                            </select>
                                            <div className="w-[120px] h-16 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-slate-100">
                                                <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Duration</span>
                                                <span className="text-lg font-black text-slate-900 tracking-tighter">{newAppt.duration}M</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="frothy-label">Calendar Sync</label>
                                        <input
                                            type="date"
                                            value={newAppt.date}
                                            onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                                            className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-primary-400 transition-all tracking-tight"
                                        />
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <button
                                        onClick={handleAddAppointment}
                                        disabled={!newAppt.patientId || !newAppt.providerId}
                                        className="w-full h-18 bg-slate-900 text-white rounded-[2rem] font-black text-lg uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100"
                                    >
                                        Execute Deployment
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Left Sidebar: Daily Visualizer */}
                        <div className="w-[320px] bg-slate-50/50 p-10 hidden lg:block border-r border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-10">Capacity View</h3>
                            <div className="space-y-[2px]">
                                {timeSlots.map(time => {
                                    const appts = modalAppointments.filter(a => a.time?.substring(0, 5) === time);
                                    const isFull = appts.length >= 2;
                                    const isPartial = appts.length === 1;

                                    return (
                                        <div key={time} className="flex items-center gap-4 h-10 group/slot">
                                            <span className="w-10 text-[9px] font-black text-slate-300 group-hover/slot:text-slate-900 transition-colors">{time}</span>
                                            <div className={`flex-1 h-3 rounded-full relative overflow-hidden bg-slate-100/50 transition-all ${isFull ? 'bg-slate-200' : ''}`}>
                                                {isFull && <div className="absolute inset-0 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]"></div>}
                                                {isPartial && <div className="absolute inset-0 bg-primary-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"></div>}
                                                {!isFull && !isPartial && <div className="absolute inset-0 border border-slate-200/50 border-dashed rounded-full"></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddPatientModal && (
                <AddPatientModal
                    onClose={() => setShowAddPatientModal(false)}
                    onSuccess={(p) => {
                        setNewAppt({ ...newAppt, patientId: p.id, patient: p.name });
                        setPatientSearch(p.name);
                        setShowAddPatientModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default Schedule;
