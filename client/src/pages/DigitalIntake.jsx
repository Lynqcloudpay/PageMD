import React, { useState, useEffect } from 'react';
import {
    UserPlus, Search, Filter, QrCode, Send, Mail, Phone, Clock,
    CheckCircle, AlertCircle, Eye, MoreVertical, Copy, RefreshCw,
    Check, X, ChevronRight, User
} from 'lucide-react';
import { format } from 'date-fns';
import { intakeAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import Modal from '../components/ui/Modal';

const DigitalIntake = () => {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Invite Form State
    const [inviteData, setInviteData] = useState({
        channel: 'qr',
        toEmail: '',
        toPhone: '',
        prefill: {
            firstName: '',
            lastName: '',
            dob: '',
            phone: ''
        }
    });
    const [generatedLink, setGeneratedLink] = useState(null);

    useEffect(() => {
        fetchInvites();
    }, []);

    const fetchInvites = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await intakeAPI.getInvites();
            setInvites(res.data || []);
        } catch (e) {
            showError('Failed to load invitations');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleCreateInvite = async () => {
        try {
            const res = await intakeAPI.createInvite(inviteData);
            setGeneratedLink(res.data.inviteLink);
            showSuccess('Invitation created successfully');
            fetchInvites(true);
        } catch (e) {
            showError('Failed to create invitation');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Sent': return 'bg-blue-100 text-blue-700';
            case 'InProgress': return 'bg-amber-100 text-amber-700';
            case 'Submitted': return 'bg-purple-100 text-purple-700 font-bold';
            case 'Approved': return 'bg-emerald-100 text-emerald-700';
            case 'NeedsEdits': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredInvites = invites.filter(i => {
        const name = `${i.prefill_first_name || ''} ${i.prefill_last_name || ''}`.toLowerCase();
        const contact = (i.to_email || i.to_phone || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase()) || contact.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Digital Intake</h1>
                    <p className="text-gray-500 mt-1">Manage and monitor new patient registrations.</p>
                </div>
                <button
                    onClick={() => {
                        setGeneratedLink(null);
                        setShowInviteModal(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                    <UserPlus className="w-5 h-5" />
                    New Registration
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Total Invites', value: invites.length, icon: Send, color: 'blue' },
                    { label: 'Pending Review', value: invites.filter(i => i.status === 'Submitted').length, icon: Clock, color: 'purple' },
                    { label: 'In Progress', value: invites.filter(i => i.status === 'InProgress').length, icon: RefreshCw, color: 'amber' },
                    { label: 'Completed', value: invites.filter(i => i.status === 'Approved').length, icon: CheckCircle, color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                            <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters and List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchInvites(true)} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Patient Name</th>
                                <th className="px-6 py-4">Contact / Channel</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Sent On</th>
                                <th className="px-6 py-4">Expires</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">Loading invitations...</td></tr>
                            ) : filteredInvites.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">No invitations found.</td></tr>
                            ) : (
                                filteredInvites.map((invite) => (
                                    <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                                    {(invite.prefill_first_name?.[0] || '') + (invite.prefill_last_name?.[0] || '')}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {invite.prefill_first_name} {invite.prefill_last_name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        DOB: {invite.prefill_dob ? format(new Date(invite.prefill_dob), 'MM/dd/yyyy') : 'Not set'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                {invite.channel === 'sms' && <Phone className="w-4 h-4 text-gray-400" />}
                                                {invite.channel === 'email' && <Mail className="w-4 h-4 text-gray-400" />}
                                                {invite.channel === 'qr' && <QrCode className="w-4 h-4 text-gray-400" />}
                                                <span className="truncate max-w-[150px]">{invite.to_email || invite.to_phone || 'QR Generation'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(invite.status)}`}>
                                                {invite.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {format(new Date(invite.created_at), 'MM/dd/yy h:mm a')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {format(new Date(invite.expires_at), 'MM/dd/yy')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {invite.status === 'Submitted' && (
                                                    <button
                                                        title="Review Submission"
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Modal */}
            <Modal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                title="New Patient Registration"
                size="md"
            >
                {!generatedLink ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={inviteData.prefill.firstName}
                                    onChange={(e) => setInviteData({ ...inviteData, prefill: { ...inviteData.prefill, firstName: e.target.value } })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={inviteData.prefill.lastName}
                                    onChange={(e) => setInviteData({ ...inviteData, prefill: { ...inviteData.prefill, lastName: e.target.value } })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth</label>
                                <input
                                    type="date"
                                    value={inviteData.prefill.dob}
                                    onChange={(e) => setInviteData({ ...inviteData, prefill: { ...inviteData.prefill, dob: e.target.value } })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={inviteData.prefill.phone}
                                    onChange={(e) => setInviteData({ ...inviteData, prefill: { ...inviteData.prefill, phone: e.target.value } })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-gray-700">Delivery Method</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'qr', label: 'QR Code', icon: QrCode },
                                    { id: 'sms', label: 'SMS Link', icon: Phone },
                                    { id: 'email', label: 'Email Link', icon: Mail },
                                ].map((channel) => (
                                    <button
                                        key={channel.id}
                                        onClick={() => setInviteData({ ...inviteData, channel: channel.id })}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${inviteData.channel === channel.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                    >
                                        <channel.icon className="w-6 h-6 mb-2" />
                                        <span className="text-xs font-bold">{channel.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {inviteData.channel === 'email' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="patient@example.com"
                                    value={inviteData.toEmail}
                                    onChange={(e) => setInviteData({ ...inviteData, toEmail: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        )}

                        {inviteData.channel === 'sms' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 000-0000"
                                    value={inviteData.toPhone}
                                    onChange={(e) => setInviteData({ ...inviteData, toPhone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowInviteModal(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleCreateInvite} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">Generate Invite</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-center space-y-6">
                        {inviteData.channel === 'qr' && (
                            <div className="bg-white p-8 rounded-2xl inline-block border-4 border-blue-50 shadow-xl mb-4">
                                <QrCode className="w-48 h-48 text-gray-900" />
                                <div className="mt-4 text-sm font-bold text-gray-500">Scan to Start Registration</div>
                            </div>
                        )}

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Secure Link</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs truncate text-blue-600 bg-white p-2 rounded border border-blue-100">{generatedLink}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedLink);
                                        showSuccess('Link copied to clipboard');
                                    }}
                                    className="p-2 bg-blue-600 text-white rounded-lg"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="text-sm text-gray-500">
                            {inviteData.channel === 'sms' && `The link has been sent to ${inviteData.toPhone}`}
                            {inviteData.channel === 'email' && `The link has been sent to ${inviteData.toEmail}`}
                        </div>

                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all"
                        >
                            Done
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DigitalIntake;
