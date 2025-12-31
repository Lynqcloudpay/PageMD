import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, subDays } from 'date-fns';
import {
    Phone, Calendar, Clock, User, AlertCircle, XCircle, RefreshCw,
    Search, Filter, MessageSquare, X, CheckCircle, Save, Ban,
    ChevronDown, ChevronUp, Send, PhoneCall, PhoneOff
} from 'lucide-react';
import { appointmentsAPI, patientsAPI, messagesAPI, followupsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getPatientDisplayName } from '../utils/patientNameUtils';

const Cancellations = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Main data
    const [followups, setFollowups] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'addressed', 'dismissed', 'all'
    const [dateRange, setDateRange] = useState('30');
    const [searchTerm, setSearchTerm] = useState('');

    // Stats
    const [stats, setStats] = useState({ pending_count: 0, addressed_count: 0, dismissed_count: 0, total_count: 0 });

    // Expanded follow-up for notes
    const [expandedId, setExpandedId] = useState(null);
    const [newNote, setNewNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Dismiss modal
    const [showDismissModal, setShowDismissModal] = useState(false);
    const [dismissingFollowup, setDissmissingFollowup] = useState(null);
    const [dismissReason, setDismissReason] = useState('');
    const [dismissNote, setDismissNote] = useState('');

    // Address modal
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [addressingFollowup, setAddressingFollowup] = useState(null);
    const [addressNote, setAddressNote] = useState('');

    const fetchStats = useCallback(async () => {
        try {
            const response = await followupsAPI.getStats();
            setStats(response.data || response);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, []);

    const fetchFollowups = useCallback(async (isRefresh = false) => {
        // Only show loading on initial load, not on refresh
        if (!isRefresh) {
            setLoading(true);
        }
        try {
            const endDate = format(new Date(), 'yyyy-MM-dd');
            const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

            // First, fetch all cancelled/no-show appointments to ensure follow-ups exist
            const apptResponse = await appointmentsAPI.get({ startDate, endDate });
            const allAppointments = apptResponse.data || apptResponse;

            // Filter for cancelled and no-show appointments
            const cancelledAppointments = allAppointments.filter(
                appt => appt.patient_status === 'cancelled' || appt.patient_status === 'no_show'
            );

            console.log('Cancelled/No-show appointments found:', cancelledAppointments.length);

            // Ensure follow-ups exist for all cancelled appointments (fire and forget)
            for (const appt of cancelledAppointments) {
                try {
                    await followupsAPI.ensure({
                        appointmentId: appt.id,
                        patientId: appt.patientId
                    });
                } catch (e) {
                    console.warn('Could not ensure follow-up for', appt.id);
                }
            }

            // Now fetch follow-ups with the status filter from the API
            const params = { startDate, endDate };
            if (activeTab !== 'all') {
                params.status = activeTab;
            }
            const response = await followupsAPI.getAll(params);
            const followupsData = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response)
                    ? response
                    : [];

            console.log('Follow-ups from API:', followupsData.length);
            console.log('Follow-ups data:', followupsData);

            // Map the data to the expected format
            const mappedFollowups = followupsData.map(f => ({
                ...f,
                // Use safe patient name utility to ensure encrypted names never display
                patientName: getPatientDisplayName(f),
                appointmentDate: f.appointment_date,
                appointmentTime: f.appointment_time,
                appointmentStatus: f.appointment_status,
                cancellationReason: f.cancellation_reason ||
                    (f.appointment_status === 'no_show' ? 'Patient did not show up' : 'No reason provided'),
                patientPhone: f.patientPhone || f.patient_phone || f.patient_phone_cell,
                emergencyPhone: f.emergency_contact_phone,
                emergencyContact: f.emergency_contact_name
            }));

            setFollowups(mappedFollowups);
        } catch (error) {
            console.error('Error fetching follow-ups:', error);
            setFollowups([]);
        } finally {
            if (!isRefresh) {
                setLoading(false);
            }
        }
    }, [dateRange, activeTab]);

    useEffect(() => {
        fetchFollowups();
        fetchStats();

        // Auto-refresh every 10 seconds (silent refresh, no loading state)
        const interval = setInterval(() => {
            fetchFollowups(true);
            fetchStats();
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchFollowups, fetchStats]);

    // Filter follow-ups by search
    const filteredFollowups = useMemo(() => {
        if (!searchTerm) return followups;
        const search = searchTerm.toLowerCase();
        return followups.filter(f =>
            f.patientName?.toLowerCase().includes(search) ||
            f.providerName?.toLowerCase().includes(search) ||
            f.cancellationReason?.toLowerCase().includes(search)
        );
    }, [followups, searchTerm]);

    // Add a note to follow-up
    const handleAddNote = async (followupId, noteType = 'general') => {
        if (!newNote.trim()) return;

        setSubmitting(true);
        try {
            await followupsAPI.addNote(followupId, {
                note: newNote,
                noteType
            });
            setNewNote('');
            fetchFollowups();
            fetchStats();
        } catch (error) {
            console.error('Error adding note:', error);
            alert('Failed to add note');
        } finally {
            setSubmitting(false);
        }
    };

    // Save call attempt
    const handleSaveCallAttempt = async (followupId) => {
        if (!newNote.trim()) {
            alert('Please add a note describing the call attempt');
            return;
        }

        setSubmitting(true);
        try {
            await followupsAPI.addNote(followupId, {
                note: newNote,
                noteType: 'call_attempt'
            });
            setNewNote('');
            alert('Call attempt documented. Follow-up remains pending.');
            fetchFollowups();
        } catch (error) {
            console.error('Error saving call attempt:', error);
            alert('Failed to save call attempt');
        } finally {
            setSubmitting(false);
        }
    };

    // Address follow-up (rescheduled)
    const handleAddress = async () => {
        if (!addressingFollowup) return;

        setSubmitting(true);
        try {
            await followupsAPI.address(addressingFollowup.id, {
                note: addressNote || 'Patient rescheduled successfully'
            });
            setShowAddressModal(false);
            setAddressingFollowup(null);
            setAddressNote('');
            fetchFollowups();
            fetchStats();
        } catch (error) {
            console.error('Error addressing follow-up:', error);
            alert('Failed to mark as addressed');
        } finally {
            setSubmitting(false);
        }
    };

    // Dismiss follow-up (won't reschedule)
    const handleDismiss = async () => {
        if (!dismissingFollowup || !dismissReason) {
            alert('Please provide a reason for dismissal');
            return;
        }

        setSubmitting(true);
        try {
            await followupsAPI.dismiss(dismissingFollowup.id, {
                reason: dismissReason,
                note: dismissNote
            });
            setShowDismissModal(false);
            setDissmissingFollowup(null);
            setDismissReason('');
            setDismissNote('');
            fetchFollowups();
            fetchStats();
        } catch (error) {
            console.error('Error dismissing follow-up:', error);
            alert('Failed to dismiss follow-up');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReschedule = (followup) => {
        navigate('/schedule', {
            state: {
                patientId: followup.appointment?.patientId || followup.patient_id,
                patientName: followup.patientName,
                prefillPatient: true,
                openModal: true,
                // Pass follow-up ID to auto-address after rescheduling
                followupId: followup.id,
                followupPatientName: followup.patientName
            }
        });
    };

    const formatNoteTime = (timestamp) => {
        try {
            const date = parseISO(timestamp);
            return format(date, 'MMM d, yyyy h:mm a');
        } catch {
            return 'Unknown time';
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-gray-900">Follow-up Tracker</h1>
                <p className="text-sm text-gray-600">Manage cancelled appointments and no-show follow-ups</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`p-3 rounded-xl border transition-all ${activeTab === 'pending'
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                        : 'bg-white border-gray-200 hover:border-amber-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${activeTab === 'pending' ? 'text-amber-600' : 'text-gray-400'}`} />
                        <span className="text-xs text-gray-600">Pending</span>
                    </div>
                    <p className={`text-2xl font-bold ${activeTab === 'pending' ? 'text-amber-600' : 'text-gray-700'}`}>
                        {stats.pending_count || 0}
                    </p>
                </button>

                <button
                    onClick={() => setActiveTab('addressed')}
                    className={`p-3 rounded-xl border transition-all ${activeTab === 'addressed'
                        ? 'bg-green-50 border-green-300 ring-2 ring-green-200'
                        : 'bg-white border-gray-200 hover:border-green-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle className={`w-4 h-4 ${activeTab === 'addressed' ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className="text-xs text-gray-600">Addressed</span>
                    </div>
                    <p className={`text-2xl font-bold ${activeTab === 'addressed' ? 'text-green-600' : 'text-gray-700'}`}>
                        {stats.addressed_count || 0}
                    </p>
                </button>

                <button
                    onClick={() => setActiveTab('dismissed')}
                    className={`p-3 rounded-xl border transition-all ${activeTab === 'dismissed'
                        ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
                        : 'bg-white border-gray-200 hover:border-red-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Ban className={`w-4 h-4 ${activeTab === 'dismissed' ? 'text-red-600' : 'text-gray-400'}`} />
                        <span className="text-xs text-gray-600">Dismissed</span>
                    </div>
                    <p className={`text-2xl font-bold ${activeTab === 'dismissed' ? 'text-red-600' : 'text-gray-700'}`}>
                        {stats.dismissed_count || 0}
                    </p>
                </button>

                <button
                    onClick={() => setActiveTab('all')}
                    className={`p-3 rounded-xl border transition-all ${activeTab === 'all'
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-white border-gray-200 hover:border-blue-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="text-xs text-gray-600">Total</span>
                    </div>
                    <p className={`text-2xl font-bold ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-700'}`}>
                        {stats.total_count || 0}
                    </p>
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search patient, provider, or reason..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="60">Last 60 days</option>
                    <option value="90">Last 90 days</option>
                </select>
                <button
                    onClick={() => { fetchFollowups(); fetchStats(); }}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Follow-ups List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <p className="text-sm">Loading follow-ups...</p>
                    </div>
                ) : filteredFollowups.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="font-medium text-sm">No {activeTab} follow-ups</p>
                        <p className="text-xs mt-1">
                            {activeTab === 'pending' && 'All follow-ups have been addressed or dismissed'}
                            {activeTab === 'addressed' && 'No rescheduled appointments yet'}
                            {activeTab === 'dismissed' && 'No dismissed follow-ups'}
                            {activeTab === 'all' && 'No follow-ups found'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredFollowups.map(followup => (
                            <div key={followup.id} className="transition-all">
                                {/* Main Row */}
                                <div
                                    className={`p-3 cursor-pointer hover:bg-gray-50 ${followup.appointmentStatus === 'no_show'
                                        ? 'border-l-4 border-l-orange-400'
                                        : 'border-l-4 border-l-red-400'
                                        }`}
                                    onClick={() => setExpandedId(expandedId === followup.id ? null : followup.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-gray-900">
                                                    {followup.patientName}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${followup.appointmentStatus === 'no_show'
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {followup.appointmentStatus === 'no_show' ? 'NO SHOW' : 'CANCELLED'}
                                                </span>
                                            </div>

                                            <span className="text-xs text-gray-500">
                                                {format(parseISO(followup.appointmentDate), 'MMM d')} @ {followup.appointmentTime?.substring(0, 5)}
                                            </span>

                                            <span className="text-xs text-gray-400">
                                                {followup.providerName}
                                            </span>

                                            {followup.notes?.length > 0 && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                                    {followup.notes.length} note{followup.notes.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {activeTab === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAddressingFollowup(followup);
                                                            setShowAddressModal(true);
                                                        }}
                                                        className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                                    >
                                                        <CheckCircle className="w-3 h-3 inline mr-1" />
                                                        Addressed
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDissmissingFollowup(followup);
                                                            setShowDismissModal(true);
                                                        }}
                                                        className="px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                                    >
                                                        <Ban className="w-3 h-3 inline mr-1" />
                                                        Dismiss
                                                    </button>
                                                </>
                                            )}
                                            {expandedId === followup.id ? (
                                                <ChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Notes Section */}
                                {expandedId === followup.id && (
                                    <div className="bg-gray-50 border-t border-gray-100 p-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Left: Patient Info & Contact */}
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact Info</h4>
                                                    {followup.patientPhone ? (
                                                        <a
                                                            href={`tel:${followup.patientPhone}`}
                                                            className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-sm"
                                                        >
                                                            <Phone className="w-4 h-4 text-green-600" />
                                                            <span className="font-medium text-green-700">{followup.patientPhone}</span>
                                                        </a>
                                                    ) : (
                                                        <p className="text-xs text-gray-400">No phone on file</p>
                                                    )}
                                                </div>

                                                {followup.emergencyPhone && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">
                                                            Emergency: {followup.emergencyContact || 'Contact'}
                                                        </p>
                                                        <a
                                                            href={`tel:${followup.emergencyPhone}`}
                                                            className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 text-sm"
                                                        >
                                                            <Phone className="w-4 h-4 text-orange-600" />
                                                            <span className="font-medium text-orange-700">{followup.emergencyPhone}</span>
                                                        </a>
                                                    </div>
                                                )}

                                                <div className="pt-2 border-t border-gray-200">
                                                    <p className="text-xs text-gray-500 mb-1">Reason for {followup.appointmentStatus === 'no_show' ? 'No Show' : 'Cancellation'}</p>
                                                    <p className="text-sm text-gray-700">{followup.cancellationReason}</p>
                                                </div>

                                                <button
                                                    onClick={() => handleReschedule(followup)}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                                >
                                                    <Calendar className="w-4 h-4" />
                                                    Reschedule Appointment
                                                </button>
                                            </div>

                                            {/* Middle: Notes History */}
                                            <div className="col-span-2">
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                                    Follow-up Notes & History
                                                </h4>

                                                {/* Notes List */}
                                                <div className="bg-white rounded-lg border border-gray-200 mb-3 max-h-48 overflow-y-auto">
                                                    {followup.notes?.length > 0 ? (
                                                        <div className="divide-y divide-gray-100">
                                                            {followup.notes.map(note => (
                                                                <div key={note.id} className="p-3">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex-1">
                                                                            <p className="text-sm text-gray-800">{note.note}</p>
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${note.note_type === 'call_attempt' ? 'bg-blue-100 text-blue-700' :
                                                                                    note.note_type === 'rescheduled' ? 'bg-green-100 text-green-700' :
                                                                                        note.note_type === 'dismissed' ? 'bg-red-100 text-red-700' :
                                                                                            note.note_type === 'message_sent' ? 'bg-purple-100 text-purple-700' :
                                                                                                'bg-gray-100 text-gray-600'
                                                                                    }`}>
                                                                                    {note.note_type === 'call_attempt' ? '📞 Call Attempt' :
                                                                                        note.note_type === 'rescheduled' ? '✓ Rescheduled' :
                                                                                            note.note_type === 'dismissed' ? '✗ Dismissed' :
                                                                                                note.note_type === 'message_sent' ? '💬 Message' : 'Note'}
                                                                                </span>
                                                                                <span className="text-[10px] text-gray-400">
                                                                                    {note.created_by_name || 'System'}
                                                                                </span>
                                                                                <span className="text-[10px] text-gray-400">
                                                                                    {formatNoteTime(note.created_at)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 text-center text-sm text-gray-400">
                                                            No notes yet. Add your first note below.
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Add Note - Only for pending */}
                                                {activeTab === 'pending' && (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={newNote}
                                                            onChange={(e) => setNewNote(e.target.value)}
                                                            placeholder="Document call attempt, conversation notes, why they cancelled, etc..."
                                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                                            rows={2}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleSaveCallAttempt(followup.id)}
                                                                disabled={!newNote.trim() || submitting}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <PhoneOff className="w-3 h-3" />
                                                                Save (No Answer)
                                                            </button>
                                                            <button
                                                                onClick={() => handleAddNote(followup.id, 'general')}
                                                                disabled={!newNote.trim() || submitting}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Save className="w-3 h-3" />
                                                                Add Note
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Resolution Info for addressed/dismissed */}
                                                {activeTab === 'addressed' && followup.addressed_at && (
                                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                        <p className="text-xs text-green-700">
                                                            <CheckCircle className="w-3 h-3 inline mr-1" />
                                                            Addressed by {followup.addressed_by_first_name} {followup.addressed_by_last_name} on {format(parseISO(followup.addressed_at), 'MMM d, yyyy h:mm a')}
                                                        </p>
                                                    </div>
                                                )}

                                                {activeTab === 'dismissed' && followup.dismissed_at && (
                                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                        <p className="text-xs text-red-700">
                                                            <Ban className="w-3 h-3 inline mr-1" />
                                                            Dismissed by {followup.dismissed_by_first_name} {followup.dismissed_by_last_name} on {format(parseISO(followup.dismissed_at), 'MMM d, yyyy h:mm a')}
                                                        </p>
                                                        <p className="text-xs text-red-600 mt-1">Reason: {followup.dismiss_reason}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Address Modal */}
            {showAddressModal && addressingFollowup && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="bg-green-600 px-4 py-3 rounded-t-xl flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Mark as Addressed</h2>
                            <button onClick={() => { setShowAddressModal(false); setAddressingFollowup(null); setAddressNote(''); }} className="text-white hover:text-green-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Marking this follow-up as addressed means <strong>{addressingFollowup.patientName}</strong> has been successfully rescheduled or the matter is resolved.
                            </p>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Resolution Note (optional)</label>
                                <textarea
                                    value={addressNote}
                                    onChange={(e) => setAddressNote(e.target.value)}
                                    placeholder="e.g., Patient rescheduled for next Monday at 2pm"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setShowAddressModal(false); setAddressingFollowup(null); setAddressNote(''); }}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddress}
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Mark Addressed'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dismiss Modal */}
            {showDismissModal && dismissingFollowup && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="bg-red-600 px-4 py-3 rounded-t-xl flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Dismiss Follow-up</h2>
                            <button onClick={() => { setShowDismissModal(false); setDissmissingFollowup(null); setDismissReason(''); setDismissNote(''); }} className="text-white hover:text-red-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Dismissing means <strong>{dismissingFollowup.patientName}</strong> will not be rescheduling. Please document the reason.
                            </p>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Dismissal <span className="text-red-500">*</span></label>
                                <select
                                    value={dismissReason}
                                    onChange={(e) => setDismissReason(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
                                >
                                    <option value="">Select a reason...</option>
                                    <option value="Patient declined to reschedule">Patient declined to reschedule</option>
                                    <option value="Patient found another provider">Patient found another provider</option>
                                    <option value="Patient moved out of area">Patient moved out of area</option>
                                    <option value="Unable to reach patient (multiple attempts)">Unable to reach patient (multiple attempts)</option>
                                    <option value="Patient no longer needs appointment">Patient no longer needs appointment</option>
                                    <option value="Insurance issues">Insurance issues</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Notes</label>
                                <textarea
                                    value={dismissNote}
                                    onChange={(e) => setDismissNote(e.target.value)}
                                    placeholder="Any additional details about why this follow-up is being dismissed..."
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setShowDismissModal(false); setDissmissingFollowup(null); setDismissReason(''); setDismissNote(''); }}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    disabled={!dismissReason || submitting}
                                    className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Dismiss Follow-up'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cancellations;
