import React, { useState, useEffect } from 'react';
import {
    UserPlus, Search, Filter, Send, Mail, Phone, Clock,
    CheckCircle, AlertCircle, Eye, MoreVertical, Copy, RefreshCw,
    Check, X, ChevronRight, User, ExternalLink, Smartphone, Shield
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { intakeAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import Modal from '../components/ui/Modal';
import IntakeReviewModal from '../components/IntakeReviewModal';
import { useAuth } from '../context/AuthContext';

const DigitalIntake = () => {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showQRModal, setShowQRModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [menuSessionId, setMenuSessionId] = useState(null);

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

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUBMITTED': return 'bg-blue-100 text-blue-700 font-bold';
            case 'IN_PROGRESS': return 'bg-amber-100 text-amber-700';
            case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
            case 'NEEDS_EDITS': return 'bg-rose-100 text-rose-700';
            case 'EXPIRED': return 'bg-gray-200 text-gray-500';
            default: return 'bg-gray-100 text-gray-700';
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-blue-600 tracking-tight">Digital Intake</h1>
                    <p className="text-gray-500 mt-1 font-medium italic">Universal QR Workflow • Azure Blue Engine</p>
                </div>
                <button
                    onClick={() => setShowQRModal(true)}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                    <QrCode className="w-5 h-5" />
                    Display Universal QR
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Total Submissions', value: sessions.length, icon: Smartphone, color: 'blue' },
                    { label: 'Pending Review', value: sessions.filter(s => s.status === 'SUBMITTED').length, icon: Clock, color: 'indigo' },
                    { label: 'In Progress', value: sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'NEEDS_EDITS').length, icon: RefreshCw, color: 'amber' },
                    { label: 'Created Patients', value: sessions.filter(s => s.status === 'APPROVED').length, icon: CheckCircle, color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
                            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 flex items-center justify-center`}>
                                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters and List */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search registrations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchSessions(true)} className="p-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 text-left text-xs font-black text-gray-400 uppercase tracking-widest">
                                <th className="px-8 py-5">Patient Details</th>
                                <th className="px-8 py-5 text-center">Status</th>
                                <th className="px-8 py-5">Last Activity</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="4" className="px-8 py-12 text-center text-gray-400 font-medium">Loading session data...</td></tr>
                            ) : filteredSessions.length === 0 ? (
                                <tr><td colSpan="4" className="px-8 py-12 text-center text-gray-400 font-medium">No registrations found.</td></tr>
                            ) : (
                                filteredSessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white border border-gray-100 text-blue-600 rounded-2xl flex items-center justify-center font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {(session.prefill_json?.firstName?.[0] || '') + (session.prefill_json?.lastName?.[0] || '')}
                                                </div>
                                                <div>
                                                    <div className="text-base font-bold text-gray-900">
                                                        {session.prefill_json?.firstName} {session.prefill_json?.lastName}
                                                    </div>
                                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                                                        DOB: {session.prefill_json?.dob} • Phone: {session.prefill_json?.phone}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${getStatusColor(session.status)}`}>
                                                {session.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-bold text-gray-900">
                                                {format(new Date(session.updated_at), 'MMM d, h:mm a')}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                Started {format(new Date(session.created_at), 'MM/dd/yy')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right relative">
                                            <div className="flex items-center justify-end gap-2">
                                                {session.status === 'SUBMITTED' || session.status === 'NEEDS_EDITS' ? (
                                                    <button
                                                        onClick={() => setSelectedSessionId(session.id)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-1"
                                                    >
                                                        <Eye className="w-4 h-4" /> Review
                                                    </button>
                                                ) : session.status === 'APPROVED' ? (
                                                    <button
                                                        onClick={() => window.open(`/patient/${session.patient_id}`, '_blank')}
                                                        className="px-4 py-2 border border-blue-100 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-50 transition-all flex items-center gap-1"
                                                    >
                                                        View Chart <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                ) : null}

                                                <div className="relative">
                                                    <button
                                                        onClick={() => setMenuSessionId(menuSessionId === session.id ? null : session.id)}
                                                        className="p-2 text-gray-300 hover:text-blue-600 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                    {menuSessionId === session.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-30" onClick={() => setMenuSessionId(null)} />
                                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-40 animate-fadeInShort">
                                                                {session.patient_id && (
                                                                    <button
                                                                        onClick={() => {
                                                                            window.open(`/patient/${session.patient_id}`, '_blank');
                                                                            setMenuSessionId(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                                                    >
                                                                        <User className="w-4 h-4" /> Open Chart
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteSession(session.id)}
                                                                    className="w-full text-left px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                                                >
                                                                    <X className="w-4 h-4" /> Delete Session
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                            <span className="text-sm font-bold uppercase tracking-widest">Azure Secure workflow active</span>
                        </div>
                        <p className="text-gray-500 text-sm max-w-xs mx-auto">Patients can scan this to start their registration on their own mobile device.</p>
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
                        <div className="mt-6 text-2xl font-black text-gray-900 tracking-tight">Scan to Register</div>
                        <div className="text-blue-500 font-bold text-xs tracking-widest uppercase mt-1">{user?.clinicName || 'Your Clinic'}</div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Clinic Link</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(universalURL);
                                    showSuccess('Link copied to clipboard');
                                }}
                                className="flex items-center gap-1 text-blue-600 font-bold text-xs"
                            >
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                        </div>
                        <div className="text-blue-700 font-mono text-sm break-all font-bold">
                            {universalURL}
                        </div>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-bold text-lg shadow-2xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
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
