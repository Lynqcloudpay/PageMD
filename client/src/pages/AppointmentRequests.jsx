import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, CheckCircle, Clock, X, RefreshCw, Search,
    User, Phone, FileText, ChevronRight, AlertCircle, CalendarPlus,
    ChevronLeft, Check, Send, Eye, Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { inboxAPI, usersAPI, appointmentsAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { getPatientDisplayName } from '../utils/patientNameUtils';

// Helper component for schedule preview
const DaySchedulePreview = ({ date, providerId, selectedTime, duration, onDateChange, suggestedSlots = [], onSlotClick }) => {
    const [schedule, setSchedule] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const currentDate = date ? new Date(date) : new Date();
    const currentDateStr = date || format(new Date(), 'yyyy-MM-dd');

    const changeDay = (days) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        const dateStr = newDate.toISOString().split('T')[0];
        if (onDateChange) onDateChange(dateStr);
    };

    React.useEffect(() => {
        const fetchSchedule = async () => {
            if (!date || !providerId) return;
            try {
                setLoading(true);
                // Fetch appointments for the day
                const res = await appointmentsAPI.get({
                    view: 'day',
                    date: date,
                    providerId: providerId
                });
                setSchedule(res.data || []);
            } catch (err) {
                console.error('Failed to fetch schedule', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [date, providerId]);

    // Generate timeslots from 8am to 6pm
    const slots = [];
    for (let i = 8; i <= 17; i++) {
        slots.push(`${i.toString().padStart(2, '0')}:00`);
        slots.push(`${i.toString().padStart(2, '0')}:30`);
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex items-center justify-between mb-3 bg-white p-2 rounded border border-slate-200 shadow-sm">
                <button onClick={() => changeDay(-1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                <span className="font-bold text-xs text-slate-700">{format(currentDate, 'EEEE, MMM d, yyyy')}</span>
                <button onClick={() => changeDay(1)} className="p-1 hover:bg-slate-100 rounded transition-colors"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-slate-200">
                {loading ? (
                    <div className="text-xs text-slate-400 p-8 text-center flex items-center justify-center h-full">Loading schedule...</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {slots.map(slot => {
                            const appt = (schedule || []).find(a => (a.appointment_time || a.time || '').startsWith(slot));
                            const isSelected = selectedTime && selectedTime.startsWith(slot);
                            const isSuggested = suggestedSlots.some(s => s.date === currentDateStr && s.time === slot);

                            let rowClass = "hover:bg-slate-50 transition-colors";
                            if (isSelected) rowClass = "bg-emerald-50 ring-1 ring-inset ring-emerald-200";
                            else if (isSuggested) rowClass = "bg-amber-50 ring-1 ring-inset ring-amber-200";

                            return (
                                <div
                                    key={slot}
                                    className={`flex items-start text-xs p-2.5 min-h-[44px] cursor-pointer ${rowClass}`}
                                    onClick={() => {
                                        if (!appt && onSlotClick) {
                                            onSlotClick({ date: currentDateStr, time: slot });
                                        }
                                    }}
                                >
                                    <span className={`font-semibold w-14 shrink-0 mt-0.5 ${isSuggested ? 'text-amber-700' : isSelected ? 'text-emerald-700' : 'text-slate-400'}`}>
                                        {slot}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {appt ? (
                                            <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold truncate border border-blue-200 cursor-default">
                                                {appt.patient_name || 'Booked'} ({appt.duration}m)
                                            </div>
                                        ) : (
                                            <span className={`text-[10px] ${isSuggested ? 'text-amber-600 font-bold' : isSelected ? 'text-emerald-600 font-bold' : 'text-slate-300 italic'}`}>
                                                {isSuggested ? 'Suggested Slot' : isSelected ? 'Selected' : 'Available'}
                                            </span>
                                        )}
                                    </div>
                                    {isSuggested && <Check className="w-4 h-4 text-amber-600" />}
                                    {isSelected && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="mt-2 text-[10px] text-slate-400 text-center italic">
                Click available slots to suggest alternatives
            </div>
        </div>
    );
};

const AppointmentRequests = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState([]);

    // Filter State
    const [filterStatus, setFilterStatus] = useState('new'); // 'new', 'completed', 'all'
    const [searchQuery, setSearchQuery] = useState('');

    // Selected Request State
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Approval Modal
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approvalData, setApprovalData] = useState({
        providerId: '',
        appointmentDate: '',
        appointmentTime: '',
        duration: 30,
        visitMethod: 'office'
    });
    const [suggestedSlots, setSuggestedSlots] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Fetch data
    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const params = {
                status: filterStatus,
                type: 'portal_appointment'
            };
            const response = await inboxAPI.getAll(params);
            setRequests(response.data || []);

            if (users.length === 0) {
                const usersRes = await usersAPI.getDirectory();
                setUsers(usersRes.data || []);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            showError('Failed to load appointment requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus, users.length]);

    useEffect(() => {
        fetchData();
        const poll = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(poll);
    }, [fetchData]);

    // Autofill approval data when request selected or modal opens
    useEffect(() => {
        if (showApproveModal && selectedRequest) {
            setSuggestedSlots([]);

            let providerId = selectedRequest.assigned_user_id || '';
            let date = '';
            let time = '';

            const body = selectedRequest.body || '';
            const dateMatch = body.match(/Preferred Date: (\d{4}-\d{2}-\d{2})/);
            if (dateMatch) date = dateMatch[1];

            const timeMatch = body.match(/\(At (\d{2}:\d{2})\)/);
            if (timeMatch) time = timeMatch[1];

            const acceptedMatch = body.match(/\[ACCEPTED_SLOT:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\]/);
            if (acceptedMatch) {
                date = acceptedMatch[1];
                time = acceptedMatch[2];
            }

            setApprovalData({
                providerId: providerId,
                appointmentDate: date,
                appointmentTime: time,
                duration: 30,
                visitMethod: selectedRequest.visit_method || 'office'
            });
        }
    }, [showApproveModal, selectedRequest]);

    // Filter requests
    const filteredRequests = requests.filter(req => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const patientName = getPatientDisplayName(req).toLowerCase();
            return patientName.includes(q) || req.subject?.toLowerCase().includes(q);
        }
        return true;
    });

    // Actions
    const handleApprove = async () => {
        if (!approvalData.providerId || !approvalData.appointmentDate || !approvalData.appointmentTime) {
            showError('Provider, date, and time are required');
            return;
        }

        setSubmitting(true);
        try {
            await inboxAPI.approveAppointment(selectedRequest.id, approvalData);
            showSuccess('Appointment scheduled successfully!');
            setShowApproveModal(false);
            setSelectedRequest(null);
            fetchData(true);
        } catch (error) {
            console.error('Error approving:', error);
            showError('Failed to schedule appointment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuggestSlots = async () => {
        if (suggestedSlots.length === 0) return;

        setSubmitting(true);
        try {
            await inboxAPI.suggestSlots(selectedRequest.id, {
                slots: suggestedSlots.map(s => ({ date: s.date, time: s.time }))
            });
            setShowApproveModal(false);
            setSuggestedSlots([]);
            showSuccess('Alternative times sent to patient');
            fetchData(true);
        } catch (error) {
            console.error('Failed to suggest slots:', error);
            showError('Failed to send suggestions');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeny = async () => {
        if (!window.confirm('Are you sure you want to deny this appointment request?')) return;
        try {
            await inboxAPI.denyAppointment(selectedRequest.id);
            showSuccess('Appointment request denied');
            setSelectedRequest(null);
            fetchData(true);
        } catch (e) {
            console.error('Failed to deny:', e);
            showError('Failed to deny request');
        }
    };

    const openPatientChart = (req) => {
        const pid = req.patient_id || req.patientId;
        if (pid) navigate(`/patient/${pid}/snapshot`);
    };

    return (
        <div className="h-[calc(100vh-64px)] flex bg-white overflow-hidden">
            {/* List Sidebar (Left) */}
            <div className="w-[380px] flex flex-col border-r border-gray-200">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarPlus className="w-5 h-5 text-amber-500" />
                            <h1 className="text-lg font-bold text-gray-900">Appt Requests</h1>
                        </div>
                        <button
                            onClick={() => fetchData(true)}
                            className={`p-2 hover:bg-white rounded-full transition-all ${refreshing ? 'animate-spin text-amber-500' : 'text-gray-400'}`}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search requests..."
                                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <div className="flex p-1 bg-gray-200/50 rounded-lg">
                            <button
                                onClick={() => setFilterStatus('new')}
                                className={`flex-1 py-1 px-3 text-xs font-bold rounded-md transition-all ${filterStatus === 'new' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                New ({requests.filter(r => r.status === 'new').length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`flex-1 py-1 px-3 text-xs font-bold rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && !refreshing ? (
                        <div className="flex justify-center p-12 text-gray-300"><RefreshCw className="w-8 h-8 animate-spin" /></div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 text-sm">No requests found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredRequests.map(req => (
                                <div
                                    key={req.id}
                                    onClick={() => setSelectedRequest(req)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-amber-50/30 ${selectedRequest?.id === req.id ? 'bg-amber-50/50 border-l-4 border-amber-500 shadow-sm' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${req.status === 'new' ? 'bg-amber-100 text-amber-700' :
                                            req.status === 'pending_patient' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                            {req.status === 'new' ? 'NEW' :
                                                req.status === 'pending_patient' ? 'PENDING RESPONSE' :
                                                    'COMPLETED'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {format(new Date(req.created_at || req.createdAt), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                    <h3 className={`text-sm leading-tight mb-1 truncate ${req.status === 'new' ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                        {getPatientDisplayName(req)}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                        {req.body}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail View (Right) */}
            <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
                {selectedRequest ? (
                    <div className="flex-1 flex flex-col overflow-hidden m-6 bg-white rounded-2xl shadow-sm border border-gray-200 ring-1 ring-black/5">
                        {/* Detail Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50/30 to-transparent">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedRequest.subject || 'Appointment Request'}</h2>
                                <button
                                    onClick={() => openPatientChart(selectedRequest)}
                                    className="flex items-center gap-2 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs ring-2 ring-white">
                                        {getPatientDisplayName(selectedRequest).charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-base font-bold text-gray-900 group-hover:text-amber-600 transition-colors flex items-center gap-1">
                                            {getPatientDisplayName(selectedRequest)}
                                            <ChevronRight className="w-4 h-4 translate-y-px" />
                                        </div>
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                            View Patient Chart
                                        </p>
                                    </div>
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openPatientChart(selectedRequest)}
                                    className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-amber-50 hover:text-amber-600 transition-all shadow-sm"
                                    title="View Medical Record"
                                >
                                    <User className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="p-3 bg-white border border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all shadow-sm"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-3xl mx-auto space-y-8">
                                {/* The "Previous Engine" Workflow UI */}
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="p-3 bg-amber-500 rounded-xl shadow-lg shadow-amber-200">
                                            <Calendar className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-amber-900 mb-1">Process Request</h3>
                                            <p className="text-sm text-amber-700 font-medium opacity-80 leading-relaxed">
                                                Review the patient's preferred time and reason below.
                                                You can either approve the requested slot or suggest alternative times from the provider's schedule.
                                            </p>
                                        </div>
                                    </div>

                                    {selectedRequest.status === 'pending_patient' ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                                                    <Clock className="w-5 h-5 text-white animate-pulse" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-blue-900">Waiting for Patient</p>
                                                    <p className="text-xs text-blue-700 font-medium">Alternative slots have been sent. Staff action is paused.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowApproveModal(true)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                                            >
                                                Modify Suggestions
                                            </button>
                                        </div>
                                    ) : selectedRequest.status === 'new' && (
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => setShowApproveModal(true)}
                                                className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all transform hover:-translate-y-0.5"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                Approve & Schedule
                                            </button>
                                            <button
                                                onClick={handleDeny}
                                                className="px-6 py-4 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <X className="w-5 h-5" />
                                                Deny Request
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Body / Message */}
                                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-8">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Request Body</h4>
                                    <div className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap font-medium">
                                        {selectedRequest.body}
                                    </div>
                                </div>

                                {/* Metadata */}
                                <div className="grid grid-cols-2 gap-4 pb-12">
                                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Item ID</p>
                                        <p className="text-sm font-mono text-gray-600 truncate">{selectedRequest.id}</p>
                                    </div>
                                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Channel</p>
                                        <p className="text-sm font-bold text-amber-600">Patient Portal</p>
                                    </div>
                                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Requested Method</p>
                                        <p className={`text-sm font-bold flex items-center gap-1.5 ${selectedRequest.visit_method === 'telehealth' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {selectedRequest.visit_method === 'telehealth' ? (
                                                <><Video className="w-4 h-4" /> Telehealth</>
                                            ) : (
                                                <><User className="w-4 h-4" /> Office Visit</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center mb-6">
                            <CalendarPlus className="w-12 h-12 text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Manage Appointment Requests</h2>
                        <p className="text-gray-500 max-w-sm">Select a registration request from the list to approve, schedule, or deny the appointment.</p>
                    </div>
                )}
            </div>

            {/* Re-integrated Engine Approval Modal */}
            {showApproveModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-black/10 scale-in shadow-black/20">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Calendar className="w-6 h-6" />
                                    Schedule Appointment
                                </h3>
                                <p className="text-sm text-emerald-100 mt-1 font-medium opacity-90">Review physician availability and finalize the slot</p>
                            </div>
                            <button onClick={() => setShowApproveModal(false)} className="hover:bg-white/20 p-2 rounded-xl transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row h-full overflow-hidden bg-white">
                            {/* Left Column: Form */}
                            <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Provider / Practitioner</label>
                                    <select
                                        value={approvalData.providerId}
                                        onChange={e => setApprovalData({ ...approvalData, providerId: e.target.value })}
                                        className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
                                    >
                                        <option value="">Select provider...</option>
                                        {users.filter(u => ['clinician', 'physician', 'Physician', 'Nurse Practitioner', 'Physician Assistant'].includes(u.role)).map(u => (
                                            <option key={u.id} value={u.id}>{u.last_name}, {u.first_name} ({u.role})</option>
                                        ))}
                                        {users.filter(u => !['clinician', 'physician', 'Physician', 'Nurse Practitioner', 'Physician Assistant'].includes(u.role)).map(u => (
                                            <option key={u.id} value={u.id}>{u.last_name}, {u.first_name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Appointment Date</label>
                                        <input
                                            type="date"
                                            value={approvalData.appointmentDate}
                                            onChange={e => setApprovalData({ ...approvalData, appointmentDate: e.target.value })}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Start Time</label>
                                        <input
                                            type="time"
                                            value={approvalData.appointmentTime}
                                            onChange={e => setApprovalData({ ...approvalData, appointmentTime: e.target.value })}
                                            className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Duration</label>
                                        <div className="flex gap-2">
                                            {[15, 30, 45, 60].map(mins => (
                                                <button
                                                    key={mins}
                                                    type="button"
                                                    onClick={() => setApprovalData({ ...approvalData, duration: mins })}
                                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${approvalData.duration === mins ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-200'}`}
                                                >
                                                    {mins}m
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Visit Method</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setApprovalData({ ...approvalData, visitMethod: 'office' })}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${approvalData.visitMethod === 'office' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'}`}
                                            >
                                                <User size={12} /> Office
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setApprovalData({ ...approvalData, visitMethod: 'telehealth' })}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${approvalData.visitMethod === 'telehealth' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200'}`}
                                            >
                                                <Video size={12} /> Virtual
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Patient Request</p>
                                        <p className="text-sm text-amber-900 font-medium leading-relaxed italic line-clamp-3">"{selectedRequest.body}"</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Schedule Browser */}
                            <div className="w-full md:w-[400px] bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col overflow-hidden">
                                {approvalData.providerId ? (
                                    <div className="h-full flex flex-col">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Provider Schedule</h4>
                                        <div className="flex-1 overflow-hidden">
                                            <DaySchedulePreview
                                                date={approvalData.appointmentDate}
                                                providerId={approvalData.providerId}
                                                selectedTime={approvalData.appointmentTime}
                                                duration={approvalData.duration}
                                                onDateChange={(newDate) => setApprovalData(prev => ({ ...prev, appointmentDate: newDate }))}
                                                suggestedSlots={suggestedSlots}
                                                onSlotClick={(slot) => {
                                                    setSuggestedSlots(prev => {
                                                        const exists = prev.find(s => s.date === slot.date && s.time === slot.time);
                                                        if (exists) return prev.filter(s => s !== exists);
                                                        return [...prev, slot];
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8 text-slate-400">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                            <User className="w-8 h-8 opacity-20" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-500">No Provider Selected</p>
                                            <p className="text-xs">Choose a provider to check their availability on this date</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                            <div className="flex-1 w-full sm:w-auto">
                                {suggestedSlots.length > 0 ? (
                                    <button
                                        onClick={handleSuggestSlots}
                                        disabled={submitting}
                                        className="w-full sm:w-auto px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 shadow-lg shadow-amber-100 flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Send className="w-4 h-4" />
                                        Suggest {suggestedSlots.length} Alternative{suggestedSlots.length > 1 ? 's' : ''}
                                    </button>
                                ) : (
                                    <p className="text-xs text-slate-400 font-medium italic">
                                        Select available slots in the calendar to suggest alternatives if the requested time is booked.
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    onClick={() => setShowApproveModal(false)}
                                    className="flex-1 sm:flex-none px-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-white transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={submitting || !approvalData.providerId || !approvalData.appointmentDate || !approvalData.appointmentTime}
                                    className="flex-1 sm:flex-none px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                                >
                                    {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                    Finalize & Schedule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentRequests;
