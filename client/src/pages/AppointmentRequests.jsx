import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, CheckCircle, Clock, X, RefreshCw, Search,
    User, Phone, FileText, ChevronRight, AlertCircle, CalendarPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { inboxAPI, usersAPI, appointmentsAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { getPatientDisplayName } from '../utils/patientNameUtils';

const AppointmentRequests = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [providers, setProviders] = useState([]);

    // Filter State
    const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'all'
    const [searchQuery, setSearchQuery] = useState('');

    // Selected Request State
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Approval Modal
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approvalData, setApprovalData] = useState({
        providerId: '',
        appointmentDate: '',
        appointmentTime: '',
        duration: 30
    });
    const [submitting, setSubmitting] = useState(false);

    // Fetch data
    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch appointment requests from inbox
            const params = {
                status: filterStatus === 'pending' ? 'new' : 'all',
                type: 'portal_appointment'
            };
            const response = await inboxAPI.getAll(params);
            setRequests(response.data || []);

            // Fetch providers
            if (providers.length === 0) {
                const usersRes = await usersAPI.getDirectory();
                const providerList = (usersRes.data || []).filter(u =>
                    ['Physician', 'Nurse Practitioner', 'Physician Assistant', 'Admin'].includes(u.role)
                );
                setProviders(providerList);
            }
        } catch (error) {
            console.error('Error fetching appointment requests:', error);
            showError('Failed to load appointment requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchData();
        const poll = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(poll);
    }, [fetchData]);

    // Autofill approval data when request selected
    useEffect(() => {
        if (showApproveModal && selectedRequest) {
            let providerId = selectedRequest.assigned_user_id || user?.id || '';
            let date = '';
            let time = '';

            const body = selectedRequest.body || '';
            const dateMatch = body.match(/Preferred Date: (\d{4}-\d{2}-\d{2})/);
            if (dateMatch) date = dateMatch[1];

            const timeMatch = body.match(/\(At (\d{2}:\d{2})\)/);
            if (timeMatch) time = timeMatch[1];

            // Detect [ACCEPTED_SLOT:YYYY-MM-DDTHH:mm]
            const acceptedMatch = body.match(/\[ACCEPTED_SLOT:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\]/);
            if (acceptedMatch) {
                date = acceptedMatch[1];
                time = acceptedMatch[2];
            }

            setApprovalData({
                providerId: providerId,
                appointmentDate: date,
                appointmentTime: time,
                duration: 30
            });
        }
    }, [showApproveModal, selectedRequest, user]);

    // Filter requests
    const filteredRequests = requests.filter(req => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const patientName = getPatientDisplayName(req).toLowerCase();
            return patientName.includes(q) || req.subject?.toLowerCase().includes(q);
        }
        return true;
    });

    // Handle approve
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
            console.error('Error approving appointment:', error);
            showError('Failed to schedule appointment');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle deny
    const handleDeny = async () => {
        if (!selectedRequest) return;

        try {
            await inboxAPI.denyAppointment(selectedRequest.id);
            showSuccess('Appointment request denied');
            setSelectedRequest(null);
            fetchData(true);
        } catch (error) {
            console.error('Error denying appointment:', error);
            showError('Failed to deny request');
        }
    };

    const openPatientChart = (req) => {
        const pid = req.patient_id || req.patientId;
        if (pid) {
            navigate(`/patient/${pid}/snapshot`);
        }
    };

    const parseRequestDetails = (body) => {
        const details = {};

        const typeMatch = body?.match(/Type: (.+?)(?:\n|$)/);
        if (typeMatch) details.type = typeMatch[1];

        const dateMatch = body?.match(/Preferred Date: (\d{4}-\d{2}-\d{2})/);
        if (dateMatch) details.preferredDate = dateMatch[1];

        const timeMatch = body?.match(/\(At (\d{2}:\d{2})\)/);
        if (timeMatch) details.preferredTime = timeMatch[1];

        const reasonMatch = body?.match(/Reason: (.+?)(?:\n|$)/);
        if (reasonMatch) details.reason = reasonMatch[1];

        return details;
    };

    return (
        <div className="h-[calc(100vh-64px)] flex bg-gray-50 overflow-hidden">
            {/* Main List */}
            <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                                <CalendarPlus className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Appointment Requests</h1>
                                <p className="text-sm text-gray-500">Patient portal requests pending approval</p>
                            </div>
                        </div>
                        <button
                            onClick={() => fetchData(true)}
                            className={`p-2 text-gray-500 hover:bg-white rounded-full transition-colors ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by patient name..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilterStatus('pending')}
                                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                            >
                                Pending ({requests.filter(r => r.status === 'new').length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                            >
                                All
                            </button>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading && !refreshing ? (
                        <div className="flex justify-center items-center h-64 text-gray-400">
                            <RefreshCw className="w-6 h-6 animate-spin" />
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-64 text-gray-400">
                            <Calendar className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-lg font-medium">No appointment requests</p>
                            <p className="text-sm">Requests from the patient portal will appear here</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredRequests.map(req => {
                                const details = parseRequestDetails(req.body);
                                return (
                                    <div
                                        key={req.id}
                                        onClick={() => setSelectedRequest(req)}
                                        className={`p-4 cursor-pointer hover:bg-amber-50/50 transition-colors ${selectedRequest?.id === req.id ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : ''}`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${req.status === 'new' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {getPatientDisplayName(req).charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className={`text-sm truncate pr-2 ${req.status === 'new' ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                                                        {getPatientDisplayName(req)}
                                                    </h3>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {format(new Date(req.created_at || req.createdAt), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {details.type && (
                                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                            {details.type}
                                                        </span>
                                                    )}
                                                    {details.preferredDate && (
                                                        <span className="text-xs text-gray-600 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(details.preferredDate + 'T00:00:00'), 'MMM d, yyyy')}
                                                            {details.preferredTime && ` at ${details.preferredTime}`}
                                                        </span>
                                                    )}
                                                </div>
                                                {details.reason && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate">{details.reason}</p>
                                                )}
                                            </div>
                                            {req.status === 'new' && (
                                                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-2"></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel */}
            {selectedRequest && (
                <div className="w-[450px] bg-white flex flex-col shadow-xl">
                    {/* Detail Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${selectedRequest.status === 'new' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                {selectedRequest.status === 'new' ? 'PENDING' : selectedRequest.status.toUpperCase()}
                            </span>
                            <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">{selectedRequest.subject || 'Appointment Request'}</h2>
                        <button
                            onClick={() => openPatientChart(selectedRequest)}
                            className="text-amber-600 hover:text-amber-800 text-sm font-medium flex items-center gap-1"
                        >
                            <User className="w-4 h-4" />
                            {getPatientDisplayName(selectedRequest)}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Detail Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-4">
                            {/* Request Details Card */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Request Details</h3>
                                <div className="space-y-3">
                                    {(() => {
                                        const details = parseRequestDetails(selectedRequest.body);
                                        return (
                                            <>
                                                {details.type && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <FileText className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">Type:</span>
                                                        <span className="font-medium text-gray-900">{details.type}</span>
                                                    </div>
                                                )}
                                                {details.preferredDate && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">Preferred:</span>
                                                        <span className="font-medium text-gray-900">
                                                            {format(new Date(details.preferredDate + 'T00:00:00'), 'MMMM d, yyyy')}
                                                            {details.preferredTime && ` at ${details.preferredTime}`}
                                                        </span>
                                                    </div>
                                                )}
                                                {details.reason && (
                                                    <div className="flex items-start gap-2 text-sm">
                                                        <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                                                        <div>
                                                            <span className="text-gray-600">Reason:</span>
                                                            <p className="font-medium text-gray-900 mt-0.5">{details.reason}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-600">Submitted:</span>
                                                    <span className="font-medium text-gray-900">
                                                        {format(new Date(selectedRequest.created_at), 'MMM d, yyyy at h:mm a')}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Full Body */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Full Request</h3>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedRequest.body}</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {selectedRequest.status === 'new' && (
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowApproveModal(true)}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Approve & Schedule
                                </button>
                                <button
                                    onClick={handleDeny}
                                    className="px-4 py-3 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition-colors"
                                >
                                    Deny
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Approval Modal */}
            {showApproveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Schedule Appointment
                                </h3>
                                <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                <select
                                    value={approvalData.providerId}
                                    onChange={e => setApprovalData({ ...approvalData, providerId: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                >
                                    <option value="">Select provider...</option>
                                    {providers.map(p => (
                                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={approvalData.appointmentDate}
                                        onChange={e => setApprovalData({ ...approvalData, appointmentDate: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={approvalData.appointmentTime}
                                        onChange={e => setApprovalData({ ...approvalData, appointmentTime: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                                <select
                                    value={approvalData.duration}
                                    onChange={e => setApprovalData({ ...approvalData, duration: parseInt(e.target.value) })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>60 minutes</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={submitting || !approvalData.providerId || !approvalData.appointmentDate || !approvalData.appointmentTime}
                                className="flex-1 py-2.5 px-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                Confirm & Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentRequests;
