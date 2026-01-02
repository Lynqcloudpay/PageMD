import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

    if (loading && appointments.length === 0) return <div className="p-8 text-center text-slate-500">Loading appointments...</div>;

    const upcoming = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) > new Date());
    const past = appointments.filter(a => new Date(`${a.appointment_date} ${a.appointment_time}`) <= new Date());

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Appointments</h2>
                    <p className="text-slate-500">Manage your visits and requests</p>
                </div>
                <button
                    onClick={() => setShowRequestForm(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Request New Visit
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm">
                    {error}
                </div>
            )}

            {/* Request Form Modal Placeholder (Simple Overlay) */}
            {showRequestForm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Request Appointment</h2>
                            <button onClick={() => setShowRequestForm(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleRequestSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.preferredDate}
                                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Time</label>
                                <select
                                    value={formData.preferredTimeRange}
                                    onChange={(e) => setFormData({ ...formData, preferredTimeRange: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                                >
                                    <option value="morning">Morning (8am - 12pm)</option>
                                    <option value="afternoon">Afternoon (1pm - 5pm)</option>
                                    <option value="any">Flexible (Any time)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Visit Type</label>
                                <select
                                    value={formData.appointmentType}
                                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                                >
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Physical">Physical Exam</option>
                                    <option value="Sick Visit">Sick Visit / Urgent</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Visit</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none h-24"
                                    placeholder="Briefly describe why you'd like to be seen"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg mt-4"
                            >
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upcoming Appointments */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Upcoming Visits
                    </h3>
                    {upcoming.length === 0 ? (
                        <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-400">
                            No upcoming visits scheduled
                        </div>
                    ) : (
                        upcoming.map(appt => (
                            <div key={appt.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-blue-600 font-bold mb-1">{appt.appointment_type}</div>
                                        <div className="text-xl font-bold text-slate-800">
                                            {new Date(appt.appointment_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </div>
                                        <div className="text-slate-600 flex items-center gap-2 mt-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {appt.appointment_time.slice(0, 5)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Provider</div>
                                        <div className="font-bold text-slate-700">Dr. {appt.provider_last_name}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pending Requests */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        Requests in Review
                    </h3>
                    {requests.length === 0 ? (
                        <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-400">
                            No active requests
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            req.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {req.status}
                                    </div>
                                    {req.status === 'pending' && (
                                        <button
                                            onClick={() => handleCancelRequest(req.id)}
                                            className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                                <div className="text-lg font-bold text-slate-800">
                                    {new Date(req.preferred_date).toLocaleDateString()}
                                </div>
                                <div className="text-slate-600 text-sm">{req.appointment_type} • {req.preferred_time_range}</div>
                                {req.reason && <p className="text-sm text-slate-500 mt-2 italic">"{req.reason}"</p>}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortalAppointments;
