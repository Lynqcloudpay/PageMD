import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Calendar,
    Clock,
    Plus,
    X,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    CalendarDays,
    Stethoscope,
    History,
    Trash2,
    ArrowUpRight,
    MapPin,
    CalendarPlus,
    MessageCircle,
    Ban
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
        <div className="space-y-8 pb-10 animate-in fade-in duration-700">
            {/* COMPACT HERO SECTION */}
            {nextAppt ? (
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-200">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md">
                                <Calendar className="w-3 h-3" /> Next Appointment
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight leading-none mb-2">
                                    {format(new Date(nextAppt.appointment_date), 'EEEE, MMM do')}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold opacity-90">
                                    <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {nextAppt.appointment_time.slice(0, 5)}</div>
                                    <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Dr. {nextAppt.provider_last_name}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                                <button
                                    onClick={() => onMessageShortcut?.('messages')}
                                    className="px-5 py-2.5 bg-white text-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-blue-900/10 flex items-center gap-2"
                                >
                                    View Details <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({ ...formData, reason: `Reschedule appointment on ${nextAppt.appointment_date}` });
                                        setShowRequestForm(true);
                                    }}
                                    className="px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                        <div className="w-32 h-32 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 flex flex-col items-center justify-center text-center">
                            <span className="text-4xl font-black leading-none">{format(new Date(nextAppt.appointment_date), 'dd')}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mt-1">{format(new Date(nextAppt.appointment_date), 'MMMM')}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                        <CalendarPlus className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">No Upcoming Visits</h2>
                        <p className="text-slate-500 text-sm mt-1">Schedule your next checkup to stay on top of your health.</p>
                    </div>
                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200"
                    >
                        Request Appointment
                    </button>
                </div>
            )}

            {/* ACTION REQUIRED: Suggestions pulsing banner */}
            {hasSuggestions && (
                <div className="bg-emerald-600 rounded-[1.5rem] p-5 text-white shadow-xl shadow-emerald-100 flex items-center justify-between gap-4 animate-pulse-subtle">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm tracking-tight leading-tight">New Schedule Suggestions</h4>
                            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider mt-0.5">Alternatives proposed by clinical team</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onMessageShortcut?.('messages')}
                        className="px-5 py-2.5 bg-white text-emerald-600 rounded-xl font-bold text-[9px] uppercase tracking-widest"
                    >
                        Review
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* LIST SECTIONS */}
                <div className="lg:col-span-2 space-y-10">

                    {/* SCHEDULED */}
                    <div className="space-y-4">
                        <SectionHeader icon={<Calendar className="text-emerald-500" />} title="Scheduled" count={scheduled.length} />
                        <div className="grid grid-cols-1 gap-3">
                            {scheduled.map(appt => (
                                <ApptCard key={appt.id} appt={appt} type="scheduled" />
                            ))}
                            {scheduled.length === 0 && <EmptyState text="No upcoming visits scheduled" />}
                        </div>
                    </div>

                    {/* PENDING */}
                    <div className="space-y-4">
                        <SectionHeader icon={<Clock className="text-amber-500" />} title="Pending Requests" count={pending.length} />
                        <div className="grid grid-cols-1 gap-3">
                            {pending.map(req => (
                                <ApptCard key={req.id} appt={req} type="pending" onCancel={() => handleCancelRequest(req.id)} />
                            ))}
                            {pending.length === 0 && <EmptyState text="No active requests" />}
                        </div>
                    </div>

                    {/* CANCELLED */}
                    {cancelled.length > 0 && (
                        <div className="space-y-4">
                            <SectionHeader icon={<Ban className="text-red-400" />} title="Cancelled" count={cancelled.length} />
                            <div className="grid grid-cols-1 gap-3">
                                {cancelled.map(req => (
                                    <ApptCard key={req.id} appt={req} type="cancelled" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SIDEBAR */}
                <aside className="space-y-6">
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Patient Portal Info</h4>
                        <div className="space-y-4">
                            <SidebarItem icon={<MapPin size={14} />} label="Clinic" val="123 Clinical Way, Suite 400" />
                            <SidebarItem icon={<History size={14} />} label="Policy" val="24h cancellation required" />
                        </div>
                        <button
                            onClick={() => setShowRequestForm(true)}
                            className="w-full mt-6 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-white hover:border-blue-400 transition-all group"
                        >
                            <Plus className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">New Request</span>
                        </button>
                    </div>
                </aside>
            </div>

            {/* REQUEST FORM MODAL */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowRequestForm(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-xl w-full p-8 animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowRequestForm(false)} className="absolute top-6 right-6 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"><X size={16} /></button>

                        <div className="mb-8 text-center">
                            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <CalendarDays className="w-7 h-7 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-800">Request a Visit</h2>
                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1">Availability varies by clinician</p>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Select Clinician</label>
                                <select required value={formData.providerId} onChange={(e) => setFormData({ ...formData, providerId: e.target.value })} className="portal-input">
                                    <option value="">Any available</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.role === 'clinician' || s.role === 'physician' ? 'Dr.' : ''} {s.last_name}, {s.first_name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Preferred Date</label>
                                    <input type="date" required value={formData.preferredDate} onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="portal-input" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">General Time</label>
                                    <select disabled={!!formData.exactTime} value={formData.preferredTimeRange} onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })} className="portal-input disabled:opacity-50">
                                        <option value="morning">Morning</option>
                                        <option value="afternoon">Afternoon</option>
                                    </select>
                                </div>
                            </div>

                            {formData.providerId && formData.preferredDate && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Available Slots</label>
                                        {loadingAvailability && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                        {availability.map(slot => (
                                            <button
                                                key={slot.time} type="button" disabled={!slot.available}
                                                onClick={() => setFormData(prev => ({ ...prev, exactTime: prev.exactTime === slot.time ? '' : slot.time }))}
                                                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border ${!slot.available ? 'bg-slate-100/50 text-slate-300 border-transparent' :
                                                    formData.exactTime === slot.time ? 'bg-blue-600 text-white border-blue-600' :
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
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason for visit</label>
                                <textarea required value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="portal-input h-20" placeholder="Describe symptoms or purpose..." />
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-[1.2rem] font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all">
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const SectionHeader = ({ icon, title, count }) => (
    <div className="flex items-center justify-between pb-2 border-b border-slate-50">
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">{title}</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-300">{count} total</span>
    </div>
);

const ApptCard = ({ appt, type, onCancel }) => {
    const isScheduled = type === 'scheduled';
    const isPending = type === 'pending';
    const isCancelled = type === 'cancelled';

    return (
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isScheduled ? 'bg-white border-slate-50 shadow-sm hover:shadow-md' :
                isPending ? 'bg-white border-amber-50 shadow-sm shadow-amber-900/5' :
                    'bg-slate-50 border-transparent opacity-80'
            }`}>
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${isScheduled ? 'bg-blue-50 text-blue-600' :
                        isPending ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-200 text-slate-400'
                    }`}>
                    <span className="text-sm font-black leading-none">{format(new Date(appt.appointment_date || appt.preferred_date), 'dd')}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest">{format(new Date(appt.appointment_date || appt.preferred_date), 'MMM')}</span>
                </div>
                <div>
                    <h4 className={`text-sm font-bold tracking-tight ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {format(new Date(appt.appointment_date || appt.preferred_date), 'MMMM do, yyyy')}
                    </h4>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        <span className="flex items-center gap-1"><Clock size={11} className="text-blue-500/50" /> {appt.appointment_time?.slice(0, 5) || appt.preferred_time_range}</span>
                        <span className="flex items-center gap-1"><Stethoscope size={11} className="text-blue-500/50" /> {isScheduled ? `Dr. ${appt.provider_last_name}` : 'Provider Requested'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isScheduled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        isPending ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                    {appt.status}
                </div>
                {onCancel && (
                    <button onClick={onCancel} className="p-2 text-slate-200 hover:text-red-500 transition-colors">
                        <Ban size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

const EmptyState = ({ text }) => (
    <div className="py-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{text}</p>
    </div>
);

const SidebarItem = ({ icon, label, val }) => (
    <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-blue-500 mt-0.5">
            {icon}
        </div>
        <div>
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
            <div className="text-[11px] font-bold text-slate-700 leading-tight">{val}</div>
        </div>
    </div>
);

export default PortalAppointments;
