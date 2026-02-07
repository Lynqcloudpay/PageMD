import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    UserPlus, Search, Filter, QrCode, Send, Mail, Phone, Clock,
    CheckCircle, AlertCircle, Eye, MoreVertical, Copy, RefreshCw,
    Check, X, ChevronRight, User, ExternalLink, Smartphone, Shield, Key, ShieldOff, ChevronDown, ChevronUp, Calendar, ArrowRight, Notebook
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';
import { intakeAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import Modal from '../components/ui/Modal';
import IntakeReviewModal from '../components/IntakeReviewModal';
import { useAuth } from '../context/AuthContext';

const DigitalIntake = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showQRModal, setShowQRModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [menuSessionId, setMenuSessionId] = useState(null);

    const handleClearLimits = async (lastName, dob) => {
        try {
            await intakeAPI.clearRateLimits({ lastName, dob });
            showSuccess(`Lookup lockout reset for ${lastName}`);
        } catch (e) {
            showError('Failed to reset rate limit');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await intakeAPI.getSessions();
            setSessions(res.data || []);
        } catch (e) {
            showError('Failed to load registrations');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDeleteSession = async (id) => {
        if (!window.confirm('Are you sure you want to delete this intake session? This cannot be undone.')) return;
        try {
            // We need a delete endpoint in the backend
            await intakeAPI.deleteSession(id);
            showSuccess('Session deleted');
            fetchSessions(true);
        } catch (e) {
            showError('Failed to delete session');
        }
    };

    const handleRegenerateCode = async (id, patientName) => {
        try {
            const res = await intakeAPI.regenerateCode(id);
            setNewCodeModal({ open: true, code: res.data.resumeCode, patientName });
            setMenuSessionId(null);
            showSuccess('New code generated');
        } catch (e) {
            showError('Failed to generate new code');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUBMITTED': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'IN_PROGRESS': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'NEEDS_EDITS': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'EXPIRED': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const filteredSessions = sessions.filter(s => {
        const name = `${s.prefill_json?.firstName || ''} ${s.prefill_json?.lastName || ''}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });


    // Use clinic slug from authenticated user context for tenant-specific URL
    const clinicSlug = user?.clinicSlug || 'sandbox';
    const universalURL = `${window.location.origin}/intake?clinic=${clinicSlug}`;

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Digital Intake</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Universal QR Workflow • Azure Blue Engine</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowQRModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold shadow-md shadow-blue-100 hover:bg-blue-700 hover:shadow-lg transition-all active:scale-95"
                    >
                        <QrCode className="w-4 h-4" />
                        <span>Display QR</span>
                    </button>
                    <button
                        onClick={() => fetchSessions(true)}
                        disabled={refreshing}
                        className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-xl transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Submissions', value: sessions.length, icon: Smartphone, color: 'blue' },
                    { label: 'Pending Review', value: sessions.filter(s => s.status === 'SUBMITTED').length, icon: Clock, color: 'indigo' },
                    { label: 'In Progress', value: sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'NEEDS_EDITS').length, icon: RefreshCw, color: 'amber' },
                    { label: 'Created Patients', value: sessions.filter(s => s.status === 'APPROVED').length, icon: CheckCircle, color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                            <div className={`p-1.5 rounded-lg bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                <stat.icon size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search registrations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                </div>
            </div>

            {/* Content List */}
            {/* Content List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <Smartphone className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No registrations found</h3>
                    <p className="text-slate-500 text-sm">Waiting for new QR code scans...</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredSessions
                            .sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at))
                            .map((session) => (
                                <div key={session.id} className="px-5 py-4 hover:bg-slate-50 group transition-colors">
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Left: Patient Info */}
                                        <div
                                            className={`flex-1 min-w-0 flex items-center gap-4 ${session.patient_id ? 'cursor-pointer' : ''}`}
                                            onClick={() => session.patient_id && navigate(`/patient/${session.patient_id}/snapshot`)}
                                        >
                                            <div className={`w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm group-hover:border-blue-200 group-hover:text-blue-600 transition-colors ${session.patient_id ? 'group-hover:bg-blue-50' : ''}`}>
                                                {(session.prefill_json?.firstName?.[0] || '') + (session.prefill_json?.lastName?.[0] || '')}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`font-semibold text-sm text-slate-800 ${session.patient_id ? 'group-hover:text-blue-700 underline decoration-blue-200 underline-offset-2' : ''} transition-colors`}>
                                                        {session.prefill_json?.firstName} {session.prefill_json?.lastName}
                                                    </div>
                                                    {session.prefill_json?.dob && (
                                                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 rounded">
                                                            {session.prefill_json.dob}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    <span>{format(new Date(session.created_at || session.updated_at), 'MMM d, yyyy • h:mm a')}</span>
                                                    {session.prefill_json?.phone && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                                                            <Smartphone className="w-3 h-3 text-slate-400" />
                                                            <span>{session.prefill_json.phone}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Status & Actions */}
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <div className={`px-3 py-1 rounded-full text-xs font-semibold border shadow-sm flex items-center gap-1.5 ${getStatusColor(session.status)}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${session.status === 'APPROVED' ? 'bg-emerald-500' : session.status === 'SUBMITTED' ? 'bg-blue-500' : session.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                                                {session.status.replace('_', ' ')}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {session.status === 'SUBMITTED' || session.status === 'NEEDS_EDITS' ? (
                                                    <button
                                                        onClick={() => setSelectedSessionId(session.id)}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" /> Review
                                                    </button>
                                                ) : null}

                                                {/* Simple Menu Trigger */}
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMenuSessionId(menuSessionId === session.id ? null : session.id);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>

                                                    {menuSessionId === session.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fadeInShort origin-top-right">
                                                            <div className="fixed inset-0 z-40" onClick={() => setMenuSessionId(null)} />
                                                            <div className="relative z-50">
                                                                {session.patient_id && (
                                                                    <button
                                                                        onClick={() => {
                                                                            navigate(`/patient/${session.patient_id}/snapshot`);
                                                                            setMenuSessionId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                                    >
                                                                        <User className="w-3.5 h-3.5" /> Open Chart
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        handleClearLimits(session.patient_last_name || session.prefill_json?.lastName, session.patient_dob || session.prefill_json?.dob);
                                                                        setMenuSessionId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                                                >
                                                                    <ShieldOff className="w-3.5 h-3.5" /> Reset Limits
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteSession(session.id)}
                                                                    className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                                                >
                                                                    <X className="w-3.5 h-3.5" /> Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Universal QR Modal */}
            <Modal
                isOpen={showQRModal}
                onClose={() => setShowQRModal(false)}
                title="Universal Intake QR"
                size="md"
            >
                <div className="p-4 text-center space-y-8 animate-fadeIn">
                    <div className="space-y-2">
                        <div className="inline-flex p-4 bg-emerald-50 text-emerald-600 rounded-2xl mb-2 items-center gap-2">
                            <Shield className="w-5 h-5" />
                            <span className="text-sm font-semibold uppercase tracking-widest">Azure Secure workflow active</span>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">Patients can scan this to start their registration on their own mobile device.</p>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] inline-block border-4 border-blue-100 shadow-2xl shadow-blue-100">
                        <div className="bg-white p-4 rounded-2xl">
                            <QRCodeSVG
                                value={universalURL}
                                size={240}
                                level="H"
                                includeMargin={false}
                                bgColor="#ffffff"
                                fgColor="#2563eb"
                            />
                        </div>
                        <div className="mt-6 text-2xl font-bold text-slate-900 tracking-tight">Scan to Register</div>
                        <div className="text-blue-500 font-bold text-xs tracking-widest uppercase mt-1">{user?.clinicName || 'Your Clinic'}</div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Clinic Link</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(universalURL);
                                    showSuccess('Link copied to clipboard');
                                }}
                                className="flex items-center gap-1 text-blue-600 font-bold text-xs hover:text-blue-700 transition-colors"
                            >
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                        </div>
                        <a
                            href={universalURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 font-mono text-sm break-all font-bold hover:underline block"
                        >
                            {universalURL}
                        </a>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        Print Signage
                    </button>
                </div>
            </Modal>

            {/* Review Modal */}
            {selectedSessionId && (
                <IntakeReviewModal
                    isOpen={!!selectedSessionId}
                    onClose={() => {
                        setSelectedSessionId(null);
                        fetchSessions(true);
                    }}
                    sessionId={selectedSessionId}
                />
            )}
        </div>
    );
};
export default DigitalIntake;
