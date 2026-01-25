import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Calendar,
    Clock,
    Plus,
    X,
    ChevronRight,
    CheckCircle2,
    CalendarDays,
    Stethoscope,
    History,
    Trash2,
    ArrowUpRight,
    MapPin,
    CalendarPlus,
    MessageCircle,
    XCircle,
    Video
} from 'lucide-react';
import { format } from 'date-fns';

// Helper to parse dates/times as local-computer time to avoid UTC shifting
const parseLocalSafe = (dateVal, timeStr) => {
    if (!dateVal) return new Date();
    const dateStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
    const datePart = dateStr.substring(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (timeStr) {
        const timeParts = timeStr.split(':');
        const h = parseInt(timeParts[0]) || 0;
        const min = parseInt(timeParts[1]) || 0;
        date.setHours(h, min, 0, 0);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date;
};

const PortalAppointments = ({ onMessageShortcut }) => {
    const [staff, setStaff] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [hasSuggestions, setHasSuggestions] = useState(false);

    const [formData, setFormData] = useState({
        preferredDate: '',
        preferredTimeRange: 'morning',
        appointmentType: 'Follow-up',
        reason: '',
        providerId: '',
        exactTime: '',
        visitMethod: 'office' // office, telehealth
    });

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchData();
        checkSuggestions();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [apptsRes, reqsRes, staffRes] = await Promise.all([
                axios.get(`${apiBase}/portal/appointments`, { headers }),
                axios.get(`${apiBase}/portal/appointments/requests`, { headers }),
                axios.get(`${apiBase}/portal/chart/staff`, { headers })
            ]);
            setAppointments(apptsRes.data);
            setRequests(reqsRes.data);
            setStaff(staffRes.data);
            setError(null);
        } catch (err) {
            setError('Failed to load appointment information.');
        } finally {
            setLoading(false);
        }
    };

    const checkSuggestions = async () => {
        try {
            const res = await axios.get(`${apiBase}/portal/messages/threads`, { headers });
            const found = res.data.some(t => t.last_message_body?.includes('[SUGGEST_SLOT:'));
            setHasSuggestions(found);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchAvailability = async () => {
        if (!formData.preferredDate || !formData.providerId) return;
        try {
            setLoadingAvailability(true);
            const res = await axios.get(`${apiBase}/portal/appointments/availability`, {
                params: { date: formData.preferredDate, providerId: formData.providerId },
                headers
            });
            setAvailability(res.data);
        } catch (err) {
            console.error('Failed to fetch availability');
        } finally {
            setLoadingAvailability(false);
        }
    };

    useEffect(() => {
        fetchAvailability();
    }, [formData.preferredDate, formData.providerId]);

    const handleRequestSubmit = async (e) => {
        e.preventDefault();
        try {
            const submissionData = {
                ...formData,
                preferredTimeRange: formData.exactTime ? `At ${formData.exactTime}` : formData.preferredTimeRange
            };
            await axios.post(`${apiBase}/portal/appointments/requests`, submissionData, { headers });
            setShowRequestForm(false);
            setFormData({ preferredDate: '', preferredTimeRange: 'morning', appointmentType: 'Follow-up', reason: '', providerId: '', exactTime: '', visitMethod: 'office' });
            fetchData();
        } catch (err) {
            setError('Failed to submit appointment request.');
        }
    };

    const handleCancelRequest = async (requestId) => {
        if (!window.confirm('Are you sure you want to cancel this request?')) return;
        try {
            await axios.delete(`${apiBase}/portal/appointments/requests/${requestId}`, { headers });
            fetchData();
        } catch (err) {
            setError('Failed to cancel request.');
        }
    };

    if (loading && appointments.length === 0) return (
        <div className="flex flex-col items-center justify-center p-20">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Checking Schedules...</p>
        </div>
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMillis = today.getTime();

    const isCancelled = (a) => a.status === 'cancelled' || a.patient_status === 'cancelled' || a.patient_status === 'no_show';

    const getLocalDateMillis = (dateVal, timeStr) => {
        return parseLocalSafe(dateVal, timeStr).getTime();
    };

    const scheduled = appointments.filter(a => {
        const apptDateMillis = getLocalDateMillis(a.appointment_date, a.appointment_time);
        const isCompleted = a.status === 'completed' || a.status === 'checked_out';
        return apptDateMillis >= todayMillis && !isCancelled(a) && !isCompleted;
    }).sort((a, b) => getLocalDateMillis(a.appointment_date, a.appointment_time) - getLocalDateMillis(b.appointment_date, b.appointment_time));

    const past = appointments.filter(a => {
        const apptDateMillis = getLocalDateMillis(a.appointment_date, a.appointment_time);
        const isCompleted = a.status === 'completed' || a.status === 'checked_out';
        return (apptDateMillis < todayMillis || isCompleted) && !isCancelled(a);
    }).sort((a, b) => getLocalDateMillis(b.appointment_date, b.appointment_time) - getLocalDateMillis(a.appointment_date, a.appointment_time));

    const cancelledAppts = appointments.filter(a => isCancelled(a));

    const pending = requests.filter(r => r.status === 'pending');
    const withSuggestions = requests.filter(r => r.status === 'pending_patient' && r.suggested_slots);
    const cancelledRequests = requests.filter(r => r.status === 'cancelled' || r.status === 'denied');

    const nextAppt = scheduled[0];

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-700">
            {/* TOP ACTION BAR */}
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-800">My Appointments</h1>
                <button
                    onClick={() => setShowRequestForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Request
                </button>
            </div>

            {/* COMPACT HERO SECTION */}
            {nextAppt ? (
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl">
                    <div className="relative flex justify-between items-center">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-white/20 rounded-md text-[8px] font-black uppercase tracking-widest">Upcoming</span>
                                <span className="text-xs font-bold text-blue-100">{format(parseLocalSafe(nextAppt.appointment_date), 'EEEE, MMMM do')}</span>
                            </div>
                            <h1 className="text-2xl font-black tracking-tight leading-none">
                                {nextAppt.appointment_time.slice(0, 5)} with Dr. {nextAppt.provider_last_name}
                            </h1>
                            <div className="flex items-center gap-3 pt-1">
                                <button
                                    onClick={() => onMessageShortcut?.('messages')}
                                    className="px-4 py-2 bg-white text-blue-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-1.5"
                                >
                                    View Details <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({ ...formData, reason: `Reschedule request for current visit on ${format(parseLocalSafe(nextAppt.appointment_date), 'yyyy-MM-dd')}` });
                                        setShowRequestForm(true);
                                    }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors border border-white/20"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 w-24">
                            <span className="text-2xl font-black leading-none">{format(parseLocalSafe(nextAppt.appointment_date), 'dd')}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{format(parseLocalSafe(nextAppt.appointment_date), 'MMM')}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">No scheduled visits</h2>
                        <p className="text-slate-400 text-xs mt-0.5">Stay proactive with your health checkups.</p>
                    </div>
                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg shadow-blue-100"
                    >
                        Schedule Now
                    </button>
                </div>
            )}

            {/* ACTION REQUIRED: Suggested Slots from Clinic */}
            {withSuggestions.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 ml-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">Action Required</h3>
                    </div>
                    {withSuggestions.map(req => {
                        let slots = [];
                        try { slots = typeof req.suggested_slots === 'string' ? JSON.parse(req.suggested_slots) : req.suggested_slots; } catch (e) { }
                        return (
                            <div key={req.id} className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-red-900 text-sm">Choose Your Appointment Time</h4>
                                        <p className="text-[10px] text-red-600 font-medium mt-0.5">
                                            Your requested date wasn't available. Please select one of these options:
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {slots.map((slot, idx) => {
                                        const d = new Date(`${slot.date}T${slot.time}`);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={async () => {
                                                    try {
                                                        await axios.post(`${apiBase}/portal/appointments/requests/${req.id}/accept-slot`, {
                                                            date: slot.date,
                                                            time: slot.time
                                                        }, { headers });
                                                        fetchData();
                                                    } catch (err) {
                                                        console.error('Failed to accept slot:', err);
                                                        setError('Failed to accept slot. Please try again.');
                                                    }
                                                }}
                                                className="flex items-center gap-3 p-3 bg-white hover:bg-red-600 hover:text-white rounded-xl border border-red-100 hover:border-red-600 transition-all group"
                                            >
                                                <div className="w-10 h-10 bg-red-100 group-hover:bg-white/20 rounded-lg flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-sm font-black text-red-700 group-hover:text-white leading-none">{format(parseLocalSafe(slot.date, slot.time), 'd')}</span>
                                                    <span className="text-[7px] font-bold text-red-500 group-hover:text-white/80 uppercase">{format(parseLocalSafe(slot.date, slot.time), 'MMM')}</span>
                                                </div>
                                                <div className="text-left flex-1">
                                                    <div className="font-bold text-sm text-red-900 group-hover:text-white">{format(parseLocalSafe(slot.date, slot.time), 'EEEE')}</div>
                                                    <div className="text-[10px] font-medium text-red-600 group-hover:text-white/80">{format(parseLocalSafe(slot.date, slot.time), 'h:mm a')}</div>
                                                </div>
                                                <CheckCircle2 className="w-5 h-5 text-red-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 gap-12">
                {/* 1. SCHEDULED - TABLE VIEW */}
                <div className="space-y-4">
                    <SectionLabel icon={<Calendar size={14} className="text-blue-500" />} title="Scheduled Visits" count={scheduled.length} />
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Date & Time</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Clinician</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Type</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Status</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {scheduled.map(appt => (
                                    <tr key={appt.id} className="hover:bg-slate-50/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-800 text-sm">{format(parseLocalSafe(appt.appointment_date), 'MMM d, yyyy')}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{appt.appointment_time.slice(0, 5)}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-bold text-slate-700">Dr. {appt.provider_last_name}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-1.5">
                                                {appt.visit_method === 'telehealth' || (appt.appointment_type || '').toLowerCase().includes('telehealth') ? (
                                                    <>
                                                        <Video size={12} className="text-emerald-500" />
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Telehealth</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <MapPin size={12} className="text-blue-500" />
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">In-Person</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {(() => {
                                                const effectiveStatus = (appt.patient_status === 'cancelled' || appt.patient_status === 'no_show') ? appt.patient_status : appt.status;
                                                return (
                                                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${effectiveStatus === 'confirmed' || effectiveStatus === 'scheduled' ? 'bg-emerald-50 text-emerald-600' :
                                                        effectiveStatus === 'arrived' ? 'bg-blue-50 text-blue-600' :
                                                            (effectiveStatus === 'cancelled' || effectiveStatus === 'no_show') ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {effectiveStatus === 'scheduled' ? 'Confirmed' : effectiveStatus}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button onClick={() => onMessageShortcut?.('messages')} className="p-2 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {scheduled.length === 0 && (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-xs text-slate-300 font-bold uppercase tracking-[0.2em] italic">No upcoming visits found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. PENDING REQUESTS */}
                <div className="space-y-4">
                    <SectionLabel icon={<Clock size={14} className="text-amber-500" />} title="Pending Requests" count={pending.length} />
                    {pending.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pending.map(req => (
                                <CompactCard
                                    key={req.id}
                                    req={req}
                                    type="pending"
                                    onCancel={() => handleCancelRequest(req.id)}
                                    onEdit={() => {
                                        setFormData({
                                            preferredDate: req.preferred_date?.split('T')[0] || '',
                                            preferredTimeRange: req.preferred_time_range || 'morning',
                                            appointmentType: req.appointment_type || 'Follow-up',
                                            reason: req.reason || '',
                                            providerId: req.provider_id || '',
                                            exactTime: '',
                                            visitMethod: req.visit_method || 'office'
                                        });
                                        handleCancelRequest(req.id);
                                        setShowRequestForm(true);
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">No processing requests</p>
                        </div>
                    )}
                </div>

                {/* 3. PAST VISITS - TABLE VIEW */}
                <div className="space-y-4">
                    <SectionLabel icon={<History size={14} className="text-slate-400" />} title="Past Visits" count={past.length} />
                    <div className="bg-white rounded-[2rem] border border-slate-50 overflow-hidden shadow-sm opacity-90 transition-opacity">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/30">
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50">Date & Time</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50">Clinician</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50">Type</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50">Status</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {past.map(appt => (
                                    <tr key={appt.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-400 text-sm">{format(parseLocalSafe(appt.appointment_date), 'MMM d, yyyy')}</div>
                                            <div className="text-[10px] font-bold text-slate-300">{appt.appointment_time.slice(0, 5)}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-400 text-sm">Dr. {appt.provider_last_name}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                {appt.visit_method === 'telehealth' || (appt.appointment_type || '').toLowerCase().includes('telehealth') ? 'Telehealth' : 'In-Person'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[8px] font-black uppercase tracking-widest">
                                                Seen
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right"></td>
                                    </tr>
                                ))}
                                {past.length === 0 && (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-xs text-slate-200 font-bold uppercase tracking-[0.2em] italic">No visit history found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. CANCELLED / DENIED */}
                {(cancelledRequests.length > 0 || cancelledAppts.length > 0) && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <SectionLabel icon={<XCircle size={14} className="text-red-300" />} title="Cancelled & Denied" count={cancelledRequests.length + cancelledAppts.length} />
                            <button
                                onClick={async () => {
                                    if (!window.confirm('Clear all history records?')) return;
                                    try {
                                        await Promise.all(cancelledRequests.map(req =>
                                            axios.delete(`${apiBase}/portal/appointments/requests/${req.id}/clear`, { headers })
                                        ));
                                        fetchData();
                                    } catch (e) {
                                        console.error('Failed to clear:', e);
                                    }
                                }}
                                className="text-[9px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {cancelledAppts.map(appt => {
                                const isNoShow = appt.patient_status === 'no_show';
                                return (
                                    <div key={appt.id} className="p-4 rounded-2xl border border-transparent bg-slate-50/50 opacity-60 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-400 flex flex-col items-center justify-center shrink-0">
                                                <span className="text-sm font-black leading-none">{format(parseLocalSafe(appt.appointment_date), 'dd')}</span>
                                                <span className="text-[8px] font-bold uppercase">{format(parseLocalSafe(appt.appointment_date), 'MMM')}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 italic">Sch {format(parseLocalSafe(appt.appointment_date), 'MMM do')}</h4>
                                                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{isNoShow ? 'No Show' : 'Cancelled'}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {cancelledRequests.map(req => (
                                <CompactCard key={req.id} req={req} type="cancelled" />
                            ))}
                        </div>
                    </div>
                )}
            </div>


            {/* REQUEST FORM MODAL */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowRequestForm(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8 animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowRequestForm(false)} className="absolute top-6 right-6 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"><X size={16} /></button>

                        <div className="mb-8">
                            <h2 className="text-xl font-black tracking-tight text-slate-800">Request a Visit</h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Select your preferred date and clinician</p>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinician</label>
                                <select required value={formData.providerId} onChange={(e) => setFormData({ ...formData, providerId: e.target.value })} className="portal-input">
                                    <option value="">Any available</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.role === 'clinician' || s.role === 'physician' ? 'Dr.' : ''} {s.last_name}, {s.first_name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Visit Type</label>
                                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, visitMethod: 'office' })}
                                            className={`flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all ${formData.visitMethod === 'office' ? 'bg-white shadow-md shadow-slate-200/50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <MapPin size={14} className="mb-1" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Office</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, visitMethod: 'telehealth' })}
                                            className={`flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all ${formData.visitMethod === 'telehealth' ? 'bg-white shadow-md shadow-slate-200/50 text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Video size={14} className="mb-1" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Virtual</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Urgency</label>
                                    <select value={formData.appointmentType} onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })} className="portal-input">
                                        <option value="Routine Follow-up">Routine Follow-up</option>
                                        <option value="New Concern">New Concern</option>
                                        <option value="Urgent Care">Urgent Care</option>
                                        <option value="Lab Review">Lab Review</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                                    <input type="date" required value={formData.preferredDate} onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="portal-input" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Time</label>
                                    <select value={formData.preferredTimeRange} onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })} className="portal-input">
                                        <option value="morning">Morning (8am-12pm)</option>
                                        <option value="afternoon">Afternoon (12pm-5pm)</option>
                                    </select>
                                </div>
                            </div>

                            {formData.providerId && formData.preferredDate && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest underline decoration-blue-500 decoration-2">Specific Slots</label>
                                        {loadingAvailability && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                        {availability.map(slot => (
                                            <button
                                                key={slot.time} type="button" disabled={!slot.available}
                                                onClick={() => setFormData(prev => ({ ...prev, exactTime: prev.exactTime === slot.time ? '' : slot.time }))}
                                                className={`py-1.5 px-3 rounded-lg text-[10px] font-black transition-all border ${!slot.available ? 'bg-slate-100/50 text-slate-300 border-transparent' :
                                                    formData.exactTime === slot.time ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' :
                                                        'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                                                    }`}
                                            >
                                                {slot.time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason</label>
                                <textarea required value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="portal-input h-20" placeholder="Brief visit reason..." />
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-[1.2rem] font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
                                Send Request
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const SectionLabel = ({ icon, title, count }) => (
    <div className="flex items-center gap-2 mb-2 ml-1">
        {icon}
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">{title}</h3>
        <span className="w-4 h-4 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-[8px] font-black">{count}</span>
    </div>
);

const CompactCard = ({ req, type, onCancel, onEdit }) => {
    const isPending = type === 'pending';
    return (
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isPending ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPending ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                    <span className="text-sm font-black leading-none">{format(parseLocalSafe(req.preferred_date), 'dd')}</span>
                    <span className="text-[8px] font-bold uppercase">{format(parseLocalSafe(req.preferred_date), 'MMM')}</span>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-slate-800">{format(parseLocalSafe(req.preferred_date), 'MMMM do')}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{req.preferred_time_range}</p>
                </div>
            </div>
            {isPending && (
                <div className="flex items-center gap-1">
                    {onEdit && (
                        <button onClick={onEdit} className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Edit">
                            <CalendarPlus size={13} />
                        </button>
                    )}
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Cancel">
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )}
            {!isPending && (
                <span className="text-[8px] font-black uppercase text-slate-400">{req.status === 'denied' ? 'Denied' : 'Cancelled'}</span>
            )}
        </div>
    );
};

export default PortalAppointments;
