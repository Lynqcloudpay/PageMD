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
    const [staff, setStaff] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Missing state variables
    const [appointments, setAppointments] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRequestForm, setShowRequestForm] = useState(false);

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
            // Include exactTime in preferredTimeRange if selected
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

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
                <div className="relative">
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Appointments</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage your visits and scheduling requests</p>
                </div>
                <button
                    onClick={() => setShowRequestForm(true)}
                    className="relative px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 group"
                >
                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    Request New Visit
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-5 rounded-[1.5rem] border border-red-100 flex items-center gap-3 animate-shake">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold text-xs tracking-tight">{error}</span>
                </div>
            )}

            {/* Request Form Modal */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 animate-in zoom-in duration-300 relative">
                        <button
                            onClick={() => setShowRequestForm(false)}
                            className="absolute top-6 right-6 w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="mb-8 text-center text-slate-800">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-6.5 h-6.5 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight mb-1">Request Visit</h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Select your preferred window</p>
                        </div>

                        <form onSubmit={handleRequestSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Preferred Provider</label>
                                <select
                                    required
                                    value={formData.providerId}
                                    onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                                >
                                    <option value="">Choose a clinician...</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.role === 'clinician' ? 'Dr.' : ''} {s.last_name}, {s.first_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Preferred Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.preferredDate}
                                        onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-sm text-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Window/Slot</label>
                                    <select
                                        value={formData.preferredTimeRange}
                                        disabled={!!formData.exactTime}
                                        onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })}
                                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-sm text-slate-800 appearance-none disabled:opacity-50"
                                    >
                                        <option value="morning">Morning (8am - 12pm)</option>
                                        <option value="afternoon">Afternoon (1pm - 5pm)</option>
                                        <option value="any">Flexible (Any time)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Availability Calendar (Slots) */}
                            {formData.providerId && formData.preferredDate && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Available Slots</label>
                                        {loadingAvailability && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                                        {availability.length === 0 && !loadingAvailability ? (
                                            <p className="col-span-4 text-center py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-slate-50 rounded-xl border border-dashed border-slate-200">No slots available</p>
                                        ) : (
                                            availability.map(slot => (
                                                <button
                                                    key={slot.time}
                                                    type="button"
                                                    disabled={!slot.available}
                                                    onClick={() => setFormData(prev => ({ ...prev, exactTime: prev.exactTime === slot.time ? '' : slot.time }))}
                                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${!slot.available ? 'bg-slate-50 text-slate-300 border-slate-50 cursor-not-allowed' :
                                                        formData.exactTime === slot.time ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' :
                                                            'bg-white text-slate-600 border-slate-100 hover:border-blue-300 hover:text-blue-600'
                                                        }`}
                                                >
                                                    {slot.time}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                    {formData.exactTime && (
                                        <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                                            <CheckCircle2 size={12} /> Specific slot selected: {formData.exactTime}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Visit Type</label>
                                <select
                                    value={formData.appointmentType}
                                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                                >
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Physical">Physical Exam</option>
                                    <option value="Sick Visit">Sick Visit / Urgent</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason for Visit</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl h-24 focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-medium text-sm text-slate-800 placeholder:text-slate-300"
                                    placeholder="Describe your symptoms or reason..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 mt-2"
                            >
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Upcoming Appointments */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                        Scheduled Visits
                    </h3>
                    {upcoming.length === 0 ? (
                        <div className="p-12 bg-white/50 rounded-[2rem] border border-dashed border-slate-200 text-center flex flex-col items-center">
                            <Calendar className="w-10 h-10 text-slate-200 mb-4 opacity-50" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">No upcoming visits scheduled</p>
                        </div>
                    ) : (
                        upcoming.map(appt => (
                            <div key={appt.id} className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex justify-between items-start relative">
                                    <div className="space-y-4">
                                        <div className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold uppercase tracking-widest w-fit border border-emerald-100">Confirmed</div>
                                        <div>
                                            <div className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                                                {new Date(appt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 font-bold mt-1 uppercase text-[9px] tracking-widest">
                                                <Clock className="w-3 h-3" />
                                                {appt.appointment_time.slice(0, 5)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl w-fit">
                                            <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center">
                                                <Stethoscope className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Provider</div>
                                                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Dr. {appt.provider_last_name}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</div>
                                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">{appt.appointment_type}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pending Requests */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        Requests in Review
                    </h3>
                    {requests.length === 0 ? (
                        <div className="p-12 bg-white/50 rounded-[2rem] border border-dashed border-slate-200 text-center flex flex-col items-center">
                            <Clock className="w-10 h-10 text-slate-200 mb-4 opacity-50" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">No active requests</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 relative group shadow-sm hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${req.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        req.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                        }`}>
                                        {req.status}
                                    </div>
                                    {req.status === 'pending' && (
                                        <button
                                            onClick={() => handleCancelRequest(req.id)}
                                            className="w-8 h-8 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md shadow-red-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-xl font-bold text-slate-800 tracking-tight">
                                        {new Date(req.preferred_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                                        <span className="flex items-center gap-1">{req.appointment_type}</span>
                                        <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                        <span className="flex items-center gap-1">{req.preferred_time_range}</span>
                                    </div>
                                    {req.reason && (
                                        <div className="mt-3 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                                            <p className="text-[13px] font-medium text-slate-500 italic leading-snug">"{req.reason}"</p>
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
