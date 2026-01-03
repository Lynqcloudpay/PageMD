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
    XCircle
} from 'lucide-react';
import { format } from 'date-fns';

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
        exactTime: ''
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
            setFormData({ preferredDate: '', preferredTimeRange: 'morning', appointmentType: 'Follow-up', reason: '', providerId: '', exactTime: '' });
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

    const scheduled = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) > new Date()).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    const pending = requests.filter(r => r.status === 'pending');
    const cancelled = requests.filter(r => r.status === 'cancelled');
    const past = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) <= new Date());

    const nextAppt = scheduled[0];

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-700">
            {/* COMPACT HERO SECTION */}
            {nextAppt ? (
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl">
                    <div className="relative flex justify-between items-center">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-white/20 rounded-md text-[8px] font-black uppercase tracking-widest">Upcoming</span>
                                <span className="text-xs font-bold text-blue-100">{format(new Date(nextAppt.appointment_date), 'EEEE, MMMM do')}</span>
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
                                        setFormData({ ...formData, reason: `Reschedule request for current visit on ${nextAppt.appointment_date}` });
                                        setShowRequestForm(true);
                                    }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors border border-white/20"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 w-24">
                            <span className="text-2xl font-black leading-none">{format(new Date(nextAppt.appointment_date), 'dd')}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{format(new Date(nextAppt.appointment_date), 'MMM')}</span>
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

            {/* ACTION REQUIRED: Suggestions pulsing banner */}
            {hasSuggestions && (
                <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-xl shadow-emerald-100 flex items-center justify-between gap-4 animate-pulse-subtle">
                    <div className="flex items-center gap-3">
                        <MessageCircle className="w-4 h-4" />
                        <div>
                            <h4 className="font-bold text-xs">New Appointment Suggestions</h4>
                        </div>
                    </div>
                    <button
                        onClick={() => onMessageShortcut?.('messages')}
                        className="px-4 py-1.5 bg-white text-emerald-600 rounded-lg font-black text-[8px] uppercase tracking-widest"
                    >
                        Review Options
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {/* SCHEDULED - TABLE VIEW */}
                <div className="space-y-3">
                    <SectionLabel icon={<Calendar size={14} className="text-blue-500" />} title="Scheduled" count={scheduled.length} />
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Date & Time</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Clinician</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Status</th>
                                    <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {scheduled.map(appt => (
                                    <tr key={appt.id} className="hover:bg-slate-50/30 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-800 text-sm">{format(new Date(appt.appointment_date), 'MMM d, yyyy')}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{appt.appointment_time.slice(0, 5)}</div>
                                        </td>
                                        <td className="px-5 py-4 font-bold text-slate-600 text-sm">Dr. {appt.provider_last_name}</td>
                                        <td className="px-5 py-4">
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-tighter">Confirmed</span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button onClick={() => onMessageShortcut?.('messages')} className="p-2 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {scheduled.length === 0 && (
                                    <tr><td colSpan="4" className="px-5 py-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No scheduled visits</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PENDING / CANCELLED GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <SectionLabel icon={<Clock size={14} className="text-amber-500" />} title="Pending Requests" count={pending.length} />
                        <div className="space-y-2">
                            {pending.map(req => (
                                <CompactCard key={req.id} req={req} type="pending" onCancel={() => handleCancelRequest(req.id)} />
                            ))}
                            {pending.length === 0 && <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-300 uppercase tracking-widest">No pending requests</div>}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SectionLabel icon={<XCircle size={14} className="text-red-400" />} title="Cancelled" count={cancelled.length} />
                        <div className="space-y-2">
                            {cancelled.map(req => (
                                <CompactCard key={req.id} req={req} type="cancelled" />
                            ))}
                            {cancelled.length === 0 && <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-300 uppercase tracking-widest">No cancelled records</div>}
                        </div>
                    </div>
                </div>
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
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                                    <input type="date" required value={formData.preferredDate} onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="portal-input" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Time</label>
                                    <select value={formData.preferredTimeRange} onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })} className="portal-input">
                                        <option value="morning">Morning</option>
                                        <option value="afternoon">Afternoon</option>
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

const CompactCard = ({ req, type, onCancel }) => {
    const isPending = type === 'pending';
    return (
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isPending ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPending ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                    <span className="text-sm font-black leading-none">{format(new Date(req.preferred_date), 'dd')}</span>
                    <span className="text-[8px] font-bold uppercase">{format(new Date(req.preferred_date), 'MMM')}</span>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-slate-800">{format(new Date(req.preferred_date), 'MMMM do')}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{req.preferred_time_range}</p>
                </div>
            </div>
            {isPending && onCancel && (
                <button onClick={onCancel} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                </button>
            )}
            {!isPending && (
                <span className="text-[8px] font-black uppercase text-slate-400">Cancelled</span>
            )}
        </div>
    );
};

export default PortalAppointments;
