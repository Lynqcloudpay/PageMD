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
    Trash2
} from 'lucide-react';

const PortalAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRequestForm, setShowRequestForm] = useState(false);

    const [formData, setFormData] = useState({
        preferredDate: '',
        preferredTimeRange: 'morning',
        appointmentType: 'Follow-up',
        reason: ''
    });

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [apptsRes, reqsRes] = await Promise.all([
                axios.get(`${apiBase}/portal/appointments`, { headers }),
                axios.get(`${apiBase}/portal/appointments/requests`, { headers })
            ]);
            setAppointments(apptsRes.data);
            setRequests(reqsRes.data);
            setError(null);
        } catch (err) {
            setError('Failed to load appointment information.');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${apiBase}/portal/appointments/requests`, formData, { headers });
            setShowRequestForm(false);
            setFormData({ preferredDate: '', preferredTimeRange: 'morning', appointmentType: 'Follow-up', reason: '' });
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
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Checking Schedules...</p>
        </div>
    );

    const upcoming = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) > new Date());
    const past = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) <= new Date());

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
                <div className="relative">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Appointments</h2>
                    <p className="text-slate-500 font-medium">Manage your medical visits and scheduling requests</p>
                </div>
                <button
                    onClick={() => setShowRequestForm(true)}
                    className="relative px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3 group"
                >
                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    Request New Visit
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] border border-red-100 flex items-center gap-4 animate-shake">
                    <AlertCircle className="w-6 h-6" />
                    <span className="font-bold text-sm tracking-tight">{error}</span>
                </div>
            )}

            {/* Request Form Modal */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[70] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-xl w-full p-10 animate-in zoom-in duration-300 relative">
                        <button
                            onClick={() => setShowRequestForm(false)}
                            className="absolute top-8 right-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-10 text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Plus className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Request Visit</h2>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Submit your preferred date and time</p>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.preferredDate}
                                        onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-bold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Time</label>
                                    <select
                                        value={formData.preferredTimeRange}
                                        onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 appearance-none"
                                    >
                                        <option value="morning">Morning (8am - 12pm)</option>
                                        <option value="afternoon">Afternoon (1pm - 5pm)</option>
                                        <option value="any">Flexible (Any time)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visit Type</label>
                                <select
                                    value={formData.appointmentType}
                                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 appearance-none"
                                >
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Physical">Physical Exam</option>
                                    <option value="Sick Visit">Sick Visit / Urgent</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Visit</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
                                    placeholder="Briefly describe why you'd like to be seen..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-2xl shadow-slate-900/10 mt-4"
                            >
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {/* Upcoming Appointments */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                        <CalendarDays className="w-4 h-4 text-emerald-500" />
                        Scheduled Visits
                    </h3>
                    {upcoming.length === 0 ? (
                        <div className="p-16 bg-white/50 rounded-[2.5rem] border border-dashed border-slate-200 text-center flex flex-col items-center">
                            <Calendar className="w-12 h-12 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No upcoming visits scheduled</p>
                        </div>
                    ) : (
                        upcoming.map(appt => (
                            <div key={appt.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex justify-between items-start relative">
                                    <div className="space-y-4">
                                        <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit">Confirmed</div>
                                        <div>
                                            <div className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                                                {new Date(appt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">
                                                <Clock className="w-3 h-3" />
                                                {appt.appointment_time.slice(0, 5)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl w-fit">
                                            <div className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center">
                                                <Stethoscope className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Provider</div>
                                                <div className="text-xs font-black text-slate-800 uppercase tracking-wider">Dr. {appt.provider_last_name}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Type</div>
                                        <div className="text-sm font-black text-slate-900 uppercase tracking-wider">{appt.appointment_type}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pending Requests */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                        <History className="w-4 h-4 text-amber-500" />
                        Requests in Review
                    </h3>
                    {requests.length === 0 ? (
                        <div className="p-16 bg-white/50 rounded-[2.5rem] border border-dashed border-slate-200 text-center flex flex-col items-center">
                            <Clock className="w-12 h-12 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No active requests</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 relative group shadow-sm hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                        req.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {req.status}
                                    </div>
                                    {req.status === 'pending' && (
                                        <button
                                            onClick={() => handleCancelRequest(req.id)}
                                            className="w-10 h-10 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-red-200"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                                        {new Date(req.preferred_date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                        <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> {req.appointment_type}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {req.preferred_time_range}</span>
                                    </div>
                                    {req.reason && (
                                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                                            <p className="text-sm font-medium text-slate-600 italic leading-relaxed">"{req.reason}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortalAppointments;
