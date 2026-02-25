import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Users, Plus, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsAPI, patientsAPI, followupsAPI } from '../services/api';
import VisitTypeDropdown from './VisitTypeDropdown';
import AddPatientModal from './AddPatientModal';

const ScheduleAppointmentModal = ({
    isOpen,
    onClose,
    onSuccess,
    initialDate,
    initialTime,
    initialPatient = null, // { id, name }
    providers = [],
    practiceSettings = null,
    clinicalSettings = null,
    pendingFollowupId = null,
    onPendingFollowupHandled = () => { }
}) => {
    const [newAppt, setNewAppt] = useState({
        patientId: initialPatient?.id || '',
        patient: initialPatient?.name || '',
        providerId: '',
        type: 'Follow-up',
        time: initialTime || '09:00',
        duration: 30,
        date: initialDate || format(new Date(), 'yyyy-MM-dd'),
        visitMethod: 'office'
    });

    const [patientSearch, setPatientSearch] = useState(initialPatient ? `${initialPatient.name}` : '');
    const [patientSearchResults, setPatientSearchResults] = useState([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [modalAppointments, setModalAppointments] = useState([]);
    const [loadingModalAppts, setLoadingModalAppts] = useState(false);
    const [showAddPatientModal, setShowAddPatientModal] = useState(false);
    const patientSearchRef = useRef(null);

    // Initial load for patient name if only ID is provided
    useEffect(() => {
        if (initialPatient) {
            setNewAppt(prev => ({
                ...prev,
                patientId: initialPatient.id,
                patient: initialPatient.name,
                date: initialDate || prev.date,
                time: initialTime || prev.time
            }));
            setPatientSearch(initialPatient.name);
        }
    }, [initialPatient, initialDate, initialTime]);

    // Set default provider if not provided
    useEffect(() => {
        if (!newAppt.providerId && providers.length > 0) {
            setNewAppt(prev => ({ ...prev, providerId: providers[0].id }));
        }
    }, [providers]);

    // Handle patient search
    useEffect(() => {
        const searchPatients = async () => {
            if (patientSearch.length < 2 || newAppt.patientId) {
                setPatientSearchResults([]);
                return;
            }
            try {
                const results = await patientsAPI.search(patientSearch);
                setPatientSearchResults(results.data || results);
                setShowPatientDropdown(true);
            } catch (error) {
                console.error('Error searching patients:', error);
            }
        };

        const timer = setTimeout(searchPatients, 300);
        return () => clearTimeout(timer);
    }, [patientSearch, newAppt.patientId]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (patientSearchRef.current && !patientSearchRef.current.contains(e.target)) {
                setShowPatientDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch appointments for the selected date and provider to show availability
    useEffect(() => {
        const fetchModalAppointments = async () => {
            if (!isOpen || !newAppt.date || !newAppt.providerId) {
                setModalAppointments([]);
                return;
            }

            setLoadingModalAppts(true);
            try {
                const params = { date: newAppt.date, providerId: newAppt.providerId };
                const response = await appointmentsAPI.get(params);
                setModalAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching availability:', error);
                setModalAppointments([]);
            } finally {
                setLoadingModalAppts(false);
            }
        };

        fetchModalAppointments();
    }, [isOpen, newAppt.date, newAppt.providerId]);

    const startHour = useMemo(() => {
        const h = parseInt(practiceSettings?.start_time?.split(':')[0]);
        return isNaN(h) ? 9 : h;
    }, [practiceSettings]);

    const endHour = useMemo(() => {
        const h = parseInt(practiceSettings?.end_time?.split(':')[0]);
        return isNaN(h) ? 17 : h;
    }, [practiceSettings]);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let i = startHour; i <= endHour; i++) {
            slots.push(`${i.toString().padStart(2, '0')}:00`);
            slots.push(`${i.toString().padStart(2, '0')}:30`);
        }
        return slots;
    }, [startHour, endHour]);

    const handleBookAppointment = async () => {
        if (!newAppt.patientId) {
            alert('Please select a patient');
            return;
        }
        if (!newAppt.providerId) {
            alert('Please select a provider');
            return;
        }

        try {
            const response = await appointmentsAPI.create({
                patientId: newAppt.patientId,
                providerId: newAppt.providerId,
                date: newAppt.date,
                time: newAppt.time,
                duration: newAppt.duration,
                type: newAppt.type,
                visitMethod: newAppt.visitMethod
            });

            // Handle follow-up auto-addressing if applicable
            if (pendingFollowupId) {
                try {
                    await followupsAPI.address(pendingFollowupId, {
                        note: `Rescheduled to ${newAppt.date} at ${newAppt.time}`
                    });
                    onPendingFollowupHandled();
                } catch (err) {
                    console.warn('Failed to auto-address follow-up:', err);
                }
            }

            if (onSuccess) onSuccess(response.data || response);
            onClose();
        } catch (error) {
            console.error('Error booking appointment:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to book appointment';
            alert(errorMessage);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-md flex items-center justify-center z-[10001] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-50/50 border-b border-indigo-100 px-8 py-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-indigo-900 tracking-tight">
                        {initialTime ? `Book at ${initialTime}` : 'New Appointment'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-indigo-500 transition-all border border-transparent hover:border-gray-100"
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
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Patient</label>
                                    {!initialPatient && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddPatientModal(true)}
                                            className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase tracking-wider"
                                        >
                                            + New Patient
                                        </button>
                                    )}
                                </div>
                                <div className="relative group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-10 py-3 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-gray-400"
                                        placeholder="Search by name or MRN..."
                                        value={patientSearch}
                                        onChange={(e) => {
                                            setPatientSearch(e.target.value);
                                            if (e.target.value === '') setNewAppt({ ...newAppt, patientId: '', patient: '' });
                                        }}
                                        disabled={!!initialPatient}
                                        onFocus={() => { if (patientSearchResults.length > 0) setShowPatientDropdown(true); }}
                                    />
                                    {newAppt.patientId && !initialPatient && (
                                        <button
                                            type="button"
                                            onClick={() => { setPatientSearch(''); setNewAppt({ ...newAppt, patientId: '', patient: '' }); setShowPatientDropdown(false); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {showPatientDropdown && patientSearchResults.length > 0 && (
                                    <div className="absolute z-[10002] w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto ring-1 ring-black/5 animate-in slide-in-from-top-2">
                                        {patientSearchResults.map(patient => (
                                            <button
                                                key={patient.id}
                                                type="button"
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-sm border-b border-slate-50 last:border-0"
                                                onClick={() => {
                                                    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                                                    setPatientSearch(patientName + (patient.mrn ? ` (${patient.mrn})` : ''));
                                                    setNewAppt({ ...newAppt, patientId: patient.id, patient: patientName });
                                                    setShowPatientDropdown(false);
                                                }}
                                            >
                                                <div className="font-bold text-gray-900">{patient.first_name} {patient.last_name}</div>
                                                {patient.mrn && <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">MRN: {patient.mrn}</div>}
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
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Provider</label>
                                    <select
                                        className="w-full py-3 px-4 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all appearance-none font-medium text-gray-700"
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
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Date</label>
                                    <input
                                        type="date"
                                        className="w-full py-3 px-4 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all font-medium text-gray-700"
                                        value={newAppt.date}
                                        onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Visit Type & Method Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Visit Type</label>
                                    <VisitTypeDropdown
                                        value={newAppt.type}
                                        onChange={(type, method) => setNewAppt({ ...newAppt, type, visitMethod: method || newAppt.visitMethod })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Visit Method</label>
                                    <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setNewAppt({ ...newAppt, visitMethod: 'office', type: newAppt.type === 'Telehealth Visit' ? 'Follow-up' : newAppt.type })}
                                            className={`flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newAppt.visitMethod === 'office'
                                                ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50'
                                                : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                        >
                                            Office
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewAppt({ ...newAppt, visitMethod: 'telehealth', type: 'Telehealth Visit' })}
                                            className={`flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newAppt.visitMethod === 'telehealth'
                                                ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50'
                                                : 'text-gray-400 hover:text-gray-600'
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
                            <div className="h-full flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Time Slot</label>
                                    {newAppt.time && (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold uppercase tracking-widest border border-indigo-100/50">
                                            {newAppt.time}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-h-0 bg-gray-50/50 rounded-[2rem] p-4 border border-gray-100 flex flex-col">
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
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scanning Schedule...</p>
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
                                                    const maxSlots = clinicalSettings?.max_appointments_per_slot || 999;
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
                                                            type="button"
                                                            onClick={() => !isFullyBooked && setNewAppt({ ...newAppt, time: slot })}
                                                            className={`
                                                                group relative h-10 rounded-lg flex items-center justify-center transition-all
                                                                ${isFullyBooked ? 'bg-red-50 cursor-not-allowed' :
                                                                    isSelected ? 'bg-indigo-500 text-white shadow-lg ring-2 ring-indigo-200' :
                                                                        hasSomeBooking ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' :
                                                                            'bg-white hover:bg-gray-50 border border-gray-100 text-gray-600'}
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
                                            <div className="mt-4 flex flex-wrap gap-4 px-2 py-3 border-t border-gray-100">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                    <div className="w-2 h-2 bg-white border border-gray-200 rounded-sm" /> Available
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                    <div className="w-2 h-2 bg-amber-100 rounded-sm" /> 1/2 Filled
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                    <div className="w-2 h-2 bg-red-100 rounded-sm" /> Full
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
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

                <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleBookAppointment}
                        className="px-10 py-3 text-sm font-bold bg-indigo-500 text-white rounded-xl shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                    >
                        Book Appointment
                    </button>
                </div>
            </div>

            <AddPatientModal
                isOpen={showAddPatientModal}
                onClose={() => setShowAddPatientModal(false)}
                onSuccess={(message) => {
                    alert(message);
                    setShowAddPatientModal(false);
                }}
            />
        </div>,
        document.body
    );
};

export default ScheduleAppointmentModal;
