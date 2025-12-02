import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Search, X } from 'lucide-react';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { appointmentsAPI, authAPI, patientsAPI } from '../services/api';
import AddPatientModal from '../components/AddPatientModal';

const Schedule = () => {
    const navigate = useNavigate();
    const { patients } = usePatient();
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState(null);
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

    const timeSlots = [];
    for (let i = 8; i < 17; i++) {
        timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
    }

    // Fetch providers
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await authAPI.getProviders();
                const providersList = response.data || [];
                setProviders(providersList);
                // Set current user as default provider if they're a clinician
                if (user && (user.role === 'clinician' || user.role === 'admin')) {
                    const currentUserProvider = providersList.find(p => p.id === user.id);
                    if (currentUserProvider) {
                        setSelectedProvider(currentUserProvider.id);
                        setNewAppt(prev => ({ ...prev, providerId: currentUserProvider.id }));
                    } else if (providersList.length > 0) {
                        // If current user not found, use first provider
                        setSelectedProvider(providersList[0].id);
                        setNewAppt(prev => ({ ...prev, providerId: providersList[0].id }));
                    }
                } else if (providersList.length > 0) {
                    // Set first provider as default
                    setSelectedProvider(providersList[0].id);
                    setNewAppt(prev => ({ ...prev, providerId: providersList[0].id }));
                }
            } catch (error) {
                console.error('Error fetching providers:', error);
            }
        };
        fetchProviders();
    }, [user]);

    // Patient search with debouncing
    useEffect(() => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

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

        return () => {
            if (searchTimeout) clearTimeout(searchTimeout);
        };
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

    // Fetch appointments for the current date
    useEffect(() => {
        const fetchAppointments = async () => {
            setLoading(true);
            try {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const params = { date: dateStr };
                if (selectedProvider) {
                    params.providerId = selectedProvider;
                }
                const response = await appointmentsAPI.get(params);
                setAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setAppointments([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAppointments();
    }, [currentDate, selectedProvider]);

    // Generate consistent color for each provider
    const getProviderColor = (providerId, providerName) => {
        if (!providerId) return { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-800' };
        
        // Create a hash from provider ID for consistent color assignment
        let hash = 0;
        const str = providerId + (providerName || '');
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Predefined color palette for providers
        const colors = [
            { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', accent: 'bg-blue-500' },
            { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', accent: 'bg-teal-500' },
            { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', accent: 'bg-purple-500' },
            { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', accent: 'bg-pink-500' },
            { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800', accent: 'bg-indigo-500' },
            { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800', accent: 'bg-cyan-500' },
            { bg: 'bg-primary-100', border: 'border-primary-300', text: 'text-primary-800', accent: 'bg-primary-500' },
            { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', accent: 'bg-emerald-500' },
            { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800', accent: 'bg-rose-500' },
            { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800', accent: 'bg-violet-500' }
        ];
        
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    // Group appointments by provider and assign colors
    const appointmentsByProvider = appointments.reduce((acc, appt) => {
        const providerId = appt.providerId || 'unknown';
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
        
        try {
            const appointmentData = {
                patientId: newAppt.patientId,
                providerId: newAppt.providerId,
                date: newAppt.date || format(currentDate, 'yyyy-MM-dd'),
                time: newAppt.time,
                duration: newAppt.duration,
                type: newAppt.type
            };
            
            await appointmentsAPI.create(appointmentData);
            
            // Refresh appointments
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const params = { date: dateStr };
            if (selectedProvider) {
                params.providerId = selectedProvider;
            }
            const response = await appointmentsAPI.get(params);
            setAppointments(response.data || []);
            
            setShowModal(false);
            setClickedTimeSlot(null);
            setNewAppt({ 
                patientId: '', 
                patient: '', 
                providerId: newAppt.providerId, // Keep selected provider
                type: 'Follow-up', 
                time: '09:00', 
                duration: 30,
                date: format(currentDate, 'yyyy-MM-dd')
            });
        } catch (error) {
            console.error('Error creating appointment:', error);
            alert('Failed to create appointment. Please try again.');
        }
    };

    const handlePatientClick = (appt) => {
        if (appt.patientId) {
            navigate(`/patient/${appt.patientId}/snapshot`);
        }
    };

    const getAppointmentStyle = (appt, providerGroup) => {
        const [hours, minutes] = appt.time.split(':').map(Number);
        const startMinutes = (hours - 8) * 60 + minutes;
        const top = (startMinutes / 30) * 3 + 3; // 3rem per 30 mins, plus header offset
        const height = (appt.duration / 30) * 3;
        
        // Calculate left position based on provider (if multiple providers)
        // Time column is w-20 (5rem = 80px), so start appointments just after it
        // Using rem units to account for the time column width
        const providerKeys = Object.keys(appointmentsByProvider);
        const providerCount = providerKeys.length;
        const providerIndex = providerKeys.indexOf(providerGroup.providerId || 'unknown');
        // Start at 5rem (80px) to account for time column, then add provider offset
        const leftOffsetRem = 5; // 5rem = 80px (w-20 time column)
        const leftOffset = providerCount > 1 
            ? `calc(5rem + ${providerIndex * (95 / providerCount)}%)` 
            : '5rem';
        const width = providerCount > 1 
            ? `calc(${95 / providerCount}% - 0.5rem)` 
            : 'calc(100% - 5.5rem)';

        // Use provider color instead of appointment type color
        const colorScheme = providerGroup.color || getProviderColor(providerGroup.providerId, providerGroup.providerName);
        const colorClass = `${colorScheme.bg} ${colorScheme.border} ${colorScheme.text} border-l-4`;

        return {
            top: `${top}rem`,
            height: `${height}rem`,
            left: leftOffset,
            width: width,
            className: `absolute rounded p-2 border text-sm shadow-sm hover:shadow-md transition-shadow cursor-pointer ${colorClass}`,
            accentColor: colorScheme.accent
        };
    };

    return (
        <div className="p-6 max-w-7xl mx-auto h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-serif font-bold text-ink-900">Schedule</h1>
                    <div className="flex items-center space-x-2 bg-white rounded-md border border-paper-300 p-1">
                        <button 
                            className="p-1 hover:bg-paper-100 rounded" 
                            onClick={() => setCurrentDate(addDays(currentDate, -1))}
                        >
                            <ChevronLeft className="w-5 h-5 text-ink-600" />
                        </button>
                        <span className="font-medium text-ink-900 px-2 w-32 text-center">
                            {format(currentDate, 'MMM d, yyyy')}
                        </span>
                        <button 
                            className="p-1 hover:bg-paper-100 rounded" 
                            onClick={() => setCurrentDate(addDays(currentDate, 1))}
                        >
                            <ChevronRight className="w-5 h-5 text-ink-600" />
                        </button>
                    </div>
                    {providers.length > 0 && (
                        <select
                            className="px-3 py-1 border border-paper-300 rounded-md text-sm focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                            value={selectedProvider || ''}
                            onChange={(e) => {
                                setSelectedProvider(e.target.value || null);
                                setNewAppt(prev => ({ ...prev, providerId: e.target.value || '' }));
                            }}
                        >
                            <option value="">All Providers</option>
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>
                <button
                    onClick={() => {
                        setClickedTimeSlot(null);
                        setNewAppt(prev => ({
                            ...prev,
                            date: format(currentDate, 'yyyy-MM-dd')
                        }));
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800 shadow-sm flex items-center space-x-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Appointment</span>
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white border border-paper-200 rounded-lg shadow-sm flex-1 overflow-y-auto relative">
                {timeSlots.map((time, idx) => (
                    <div key={time} className="flex border-b border-paper-100 h-12">
                        <div className="w-20 border-r border-paper-100 bg-paper-50 flex items-center justify-center text-xs font-medium text-ink-500">
                            {time}
                        </div>
                        <div 
                            className="flex-1 relative group cursor-pointer"
                            onClick={() => handleTimeSlotClick(time)}
                        >
                            {/* Hover effect for slot */}
                            <div className="absolute inset-0 hover:bg-paper-50 transition-colors"></div>
                        </div>
                    </div>
                ))}

                {/* Provider Legend - Always visible if there are appointments */}
                {Object.keys(appointmentsByProvider).length > 0 && (
                    <div className="absolute top-2 right-4 bg-white border border-paper-200 rounded-md shadow-lg p-3 z-10 min-w-[180px]">
                        <div className="text-sm font-semibold text-ink-700 mb-3 pb-2 border-b border-paper-200">Provider Legend</div>
                        <div className="space-y-2">
                            {Object.values(appointmentsByProvider).map((providerGroup) => {
                                const colorScheme = providerGroup.color || getProviderColor(providerGroup.providerId, providerGroup.providerName);
                                return (
                                    <div key={providerGroup.providerId || 'unknown'} className="flex items-center space-x-2">
                                        <div className={`w-4 h-4 rounded ${colorScheme.accent} border ${colorScheme.border}`}></div>
                                        <span className="text-xs font-medium text-ink-700">{providerGroup.providerName}</span>
                                        <span className="text-xs text-ink-400">({providerGroup.appointments.length})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Appointments Overlay - Organized by Provider */}
                {Object.values(appointmentsByProvider).map((providerGroup) => (
                    <div key={providerGroup.providerId || 'unknown'}>
                        {providerGroup.appointments.map(appt => {
                            const style = getAppointmentStyle(appt, providerGroup);
                            return (
                                <div 
                                    key={appt.id} 
                                    style={{ 
                                        top: style.top, 
                                        height: style.height,
                                        left: style.left,
                                        width: style.width,
                                        borderLeftColor: style.accentColor ? undefined : 'transparent'
                                    }} 
                                    className={style.className}
                                    onClick={() => handlePatientClick(appt)}
                                >
                                    <div className="font-bold flex items-center justify-between mb-1">
                                        <span className="hover:underline cursor-pointer truncate flex-1">{appt.patientName}</span>
                                        <span className="text-xs opacity-75 ml-2 flex-shrink-0">{appt.time}</span>
                                    </div>
                                    <div className="text-xs mt-1 flex items-center space-x-2">
                                        <span className="flex items-center"><User className="w-3 h-3 mr-1" /> {appt.type}</span>
                                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {appt.duration}m - {appt.providerName || providerGroup.providerName}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* New Appointment Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-serif font-bold text-ink-900 mb-4">
                            {clickedTimeSlot ? `New Appointment at ${clickedTimeSlot}` : 'New Appointment'}
                        </h2>
                        <div className="space-y-4">
                            <div ref={patientSearchRef} className="relative">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-ink-700">Patient</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setShowAddPatientModal(true);
                                        }}
                                        className="text-xs text-paper-700 hover:text-paper-900 underline"
                                    >
                                        Enroll New Patient
                                    </button>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-10 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        placeholder="Search by name or MRN..."
                                        value={patientSearch}
                                        onChange={(e) => {
                                            setPatientSearch(e.target.value);
                                            if (e.target.value === '') {
                                                setNewAppt({ ...newAppt, patientId: '', patient: '' });
                                            }
                                        }}
                                        onFocus={() => {
                                            if (patientSearchResults.length > 0) {
                                                setShowPatientDropdown(true);
                                            }
                                        }}
                                    />
                                    {newAppt.patientId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPatientSearch('');
                                                setNewAppt({ ...newAppt, patientId: '', patient: '' });
                                                setShowPatientDropdown(false);
                                            }}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-400 hover:text-ink-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {showPatientDropdown && patientSearchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-paper-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {patientSearchResults.map(patient => (
                                            <button
                                                key={patient.id}
                                                type="button"
                                                className="w-full text-left px-4 py-2 hover:bg-paper-50 focus:bg-paper-50 focus:outline-none"
                                                onClick={() => {
                                                    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                                                    setPatientSearch(patientName + (patient.mrn ? ` (${patient.mrn})` : ''));
                                                    setNewAppt({ 
                                                        ...newAppt, 
                                                        patientId: patient.id,
                                                        patient: patientName
                                                    });
                                                    setShowPatientDropdown(false);
                                                }}
                                            >
                                                <div className="font-medium text-ink-900">
                                                    {patient.first_name} {patient.last_name}
                                                </div>
                                                {patient.mrn && (
                                                    <div className="text-xs text-ink-500">MRN: {patient.mrn}</div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {patientSearch.trim().length >= 2 && patientSearchResults.length === 0 && showPatientDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-paper-200 rounded-md shadow-lg p-4 text-sm text-ink-500">
                                        No patients found. <button
                                            type="button"
                                            onClick={() => {
                                                setShowModal(false);
                                                setShowAddPatientModal(true);
                                            }}
                                            className="text-paper-700 hover:underline"
                                        >
                                            Enroll a new patient
                                        </button>
                                    </div>
                                )}
                                {newAppt.patientId && (
                                    <div className="mt-2 text-xs text-ink-600 bg-paper-50 p-2 rounded">
                                        Selected: <span className="font-medium">{newAppt.patient}</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink-700 mb-1">Provider</label>
                                {providers.length > 0 ? (
                                    <select
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        value={newAppt.providerId}
                                        onChange={(e) => setNewAppt({ ...newAppt, providerId: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Select Provider --</option>
                                        {providers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full p-2 border border-paper-300 rounded-md bg-paper-50 text-ink-500 text-sm">
                                        No providers available. Please contact administrator.
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        value={newAppt.date || format(currentDate, 'yyyy-MM-dd')}
                                        onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Time</label>
                                    <select
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        value={newAppt.time}
                                        onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                                        required
                                    >
                                        {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Duration (min)</label>
                                    <select
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        value={newAppt.duration}
                                        onChange={(e) => setNewAppt({ ...newAppt, duration: Number(e.target.value) })}
                                    >
                                        <option value={15}>15</option>
                                        <option value={30}>30</option>
                                        <option value={45}>45</option>
                                        <option value={60}>60</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        value={newAppt.type}
                                        onChange={(e) => setNewAppt({ ...newAppt, type: e.target.value })}
                                    >
                                        <option value="Follow-up">Follow-up</option>
                                        <option value="New Patient">New Patient</option>
                                        <option value="Sick Visit">Sick Visit</option>
                                        <option value="Physical">Physical</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    setClickedTimeSlot(null);
                                }}
                                className="px-4 py-2 border border-paper-300 text-ink-600 rounded-md hover:bg-paper-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAppointment}
                                className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800"
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
                onClose={() => {
                    setShowAddPatientModal(false);
                    setShowModal(true);
                }}
                onSuccess={(message) => {
                    alert(message);
                    setShowAddPatientModal(false);
                    setShowModal(true);
                }}
            />
        </div>
    );
};

export default Schedule;
