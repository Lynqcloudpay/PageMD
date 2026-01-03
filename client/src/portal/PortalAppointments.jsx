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
    MessageCircle
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

    const upcoming = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) > new Date());
    const pendingRequests = requests.filter(r => r.status === 'pending');

    return (
        <div className="space-y-10 pb-10 animate-in fade-in duration-700">
            {/* NEW HERO SECTION: Next Appointment or Placeholder */}
            {upcoming.length > 0 ? (
                <div className="relative overflow-hidden bg-blue-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-blue-200">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] backdrop-blur-md">
                                <Calendar className="w-3 h-3" /> Upcoming Appointment
                            </div>
                            <div>
                                <h2 className="text-4xl font-bold tracking-tight mb-2">
                                    {format(new Date(upcoming[0].appointment_date), 'EEEE, MMMM do')}
                                </h2>
                                <div className="flex items-center gap-6 text-blue-100 font-bold tracking-wide">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5" /> {upcoming[0].appointment_time.slice(0, 5)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Stethoscope className="w-5 h-5" /> Dr. {upcoming[0].provider_last_name}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pt-2">
                                <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-blue-800/20 flex items-center gap-2">
                                    View Details <ArrowUpRight className="w-4 h-4" />
                                </button>
                                <button className="px-6 py-3 bg-transparent border border-white/30 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors">
                                    Reschedule
                                </button>
                            </div>
                        </div>
                        <div className="hidden lg:block w-48 h-48 bg-white/5 rounded-3xl backdrop-blur-xl border border-white/10 p-6">
                            <div className="h-full flex flex-col justify-center items-center text-center space-y-2">
                                <div className="text-4xl font-black text-white/40">
                                    {format(new Date(upcoming[0].appointment_date), 'dd')}
                                </div>
                                <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
                                    {format(new Date(upcoming[0].appointment_date), 'MMM')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : pendingRequests.length > 0 ? (
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-xl shadow-slate-200/50 flex flex-col lg:flex-row items-center gap-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-400" />
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] mb-4">
                            <Clock className="w-3 h-3" /> Request in Review
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Your request for {format(new Date(pendingRequests[0].preferred_date), 'MMMM do')} is being processed</h2>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xl">We've received your appointment request. Our clinical team is reviewing the schedule and will confirm shortly or suggest alternatives.</p>
                    </div>
                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="px-8 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-slate-100/50 flex items-center gap-3"
                    >
                        <CalendarPlus className="w-5 h-5" /> Request Multiple
                    </button>
                </div>
            ) : (
                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-50 shadow-xl shadow-slate-200/50 text-center flex flex-col items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/50 rounded-full blur-3xl" />
                    <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center">
                        <CalendarPlus className="w-10 h-10 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">No Appointments Scheduled</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Ready for your next checkup? Request a visit today.</p>
                    </div>
                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center gap-3"
                    >
                        Schedule a Visit <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ACTION REQUIRED: Rescheduling Suggestions */}
            {hasSuggestions && (
                <div className="bg-emerald-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-100 flex items-center justify-between gap-6 animate-pulse-subtle">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-base tracking-tight">Action Required: New Schedule Suggestions</h4>
                            <p className="text-emerald-100 text-[11px] font-medium uppercase tracking-wider">Clinician has suggested several alternative times for your visit.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onMessageShortcut && onMessageShortcut('messages')}
                        className="px-6 py-3 bg-white text-emerald-600 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-800/20 whitespace-nowrap"
                    >
                        Review Suggestions
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Active Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                        <History className="w-4 h-4 text-blue-600" />
                        Scheduling Timeline
                    </h3>

                    <div className="space-y-4">
                        {[...upcoming, ...requests].sort((a, b) => new Date(b.appointment_date || b.preferred_date) - new Date(a.appointment_date || a.preferred_date)).map((item, idx) => {
                            const isReq = !!item.preferred_date;
                            return (
                                <div key={item.id} className="relative bg-white p-6 rounded-[1.8rem] border border-slate-50 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-5">
                                            <div className="flex flex-col items-center shrink-0">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${isReq ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {format(new Date(item.appointment_date || item.preferred_date), 'dd')}
                                                </div>
                                                {((upcoming.length + requests.length) > (idx + 1)) && <div className="w-px h-10 bg-slate-50 mt-2" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                    {isReq ? 'Appointment Request' : 'Confirmed Visit'}
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-800 tracking-tight">
                                                    {format(new Date(item.appointment_date || item.preferred_date), 'MMMM do, yyyy')}
                                                </h4>
                                                <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight line-clamp-1">
                                                    <span className="flex items-center gap-1.5"><Clock size={12} className="text-blue-500" /> {item.appointment_time?.slice(0, 5) || item.preferred_time_range}</span>
                                                    <span className="flex items-center gap-1.5"><Stethoscope size={12} className="text-blue-500" /> {isReq ? 'Requested Provider' : `Dr. ${item.provider_last_name}`}</span>
                                                </div>
                                                {item.reason && <p className="text-xs text-slate-400 italic mt-2">"{item.reason}"</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3">
                                            <div className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${item.status === 'confirmed' || item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    item.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                {item.status}
                                            </div>
                                            {isReq && item.status === 'pending' && (
                                                <button onClick={() => handleCancelRequest(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {upcoming.length === 0 && requests.length === 0 && (
                            <div className="p-10 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">No scheduling history found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar: Quick Info */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-xl shadow-slate-200/50">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Patient Instructions</h4>
                        <div className="space-y-6">
                            <InstructionItem
                                icon={<MapPin size={16} className="text-blue-600" />}
                                title="Primary Care Location"
                                detail="123 Clinical Way, Suite 400"
                            />
                            <InstructionItem
                                icon={<Plus size={16} className="text-blue-600" />}
                                title="Arrival Time"
                                detail="Please arrive 15 minutes before your visit."
                            />
                            <InstructionItem
                                icon={<X size={16} className="text-blue-600" />}
                                title="Cancellation Policy"
                                detail="24-hour notice required for cancellations."
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setShowRequestForm(true)}
                        className="w-full h-32 bg-slate-50 hover:bg-slate-100 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                        <Plus className="w-6 h-6 text-slate-300 group-hover:text-blue-600 transition-colors" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600">Request New Slot</span>
                    </button>
                </div>
            </div>

            {/* Request Form Modal */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4" onClick={() => setShowRequestForm(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-xl w-full p-10 animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowRequestForm(false)} className="absolute top-8 right-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:rotate-90 transition-all"><X size={18} /></button>

                        <div className="mb-10 text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <CalendarDays className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-800">New Visit Request</h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Our team will verify availability shortly</p>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Select Clinician</label>
                                <select required value={formData.providerId} onChange={(e) => setFormData({ ...formData, providerId: e.target.value })} className="portal-input">
                                    <option value="">Any available provider</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.role === 'clinician' || s.role === 'physician' ? 'Dr.' : ''} {s.last_name}, {s.first_name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Visit Date</label>
                                    <input type="date" required value={formData.preferredDate} onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="portal-input" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">General Time</label>
                                    <select disabled={!!formData.exactTime} value={formData.preferredTimeRange} onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })} className="portal-input disabled:opacity-50">
                                        <option value="morning">Morning</option>
                                        <option value="afternoon">Afternoon</option>
                                        <option value="any">Any Time</option>
                                    </select>
                                </div>
                            </div>

                            {formData.providerId && formData.preferredDate && (
                                <div className="space-y-3 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Specific Openings</label>
                                        {loadingAvailability && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {availability.map(slot => (
                                            <button
                                                key={slot.time} type="button" disabled={!slot.available}
                                                onClick={() => setFormData(prev => ({ ...prev, exactTime: prev.exactTime === slot.time ? '' : slot.time }))}
                                                className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border ${!slot.available ? 'bg-slate-100/50 text-slate-300 border-transparent cursor-not-allowed' :
                                                    formData.exactTime === slot.time ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' :
                                                        'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                                    }`}
                                            >
                                                {slot.time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Reason</label>
                                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="portal-input h-24" placeholder="Briefly describe your health concern..." />
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200">
                                Confirm Request
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const InstructionItem = ({ icon, title, detail }) => (
    <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            {icon}
        </div>
        <div>
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-0.5">{title}</h5>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{detail}</p>
        </div>
    </div>
);

export default PortalAppointments;
