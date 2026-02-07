import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, Copy, ExternalLink, Shield as ShieldCheck, Clock, ArrowRight, Send, Edit2, AlertCircle, Eye } from 'lucide-react';
import Modal from './ui/Modal';
import { showSuccess, showError } from '../utils/toast';
import api from '../services/api';

const PortalInviteModal = ({ isOpen, onClose, patient, inviteData: initialInviteData }) => {
    const [step, setStep] = useState('config'); // config, result
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [inviteData, setInviteData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialInviteData) {
                setInviteData(initialInviteData);
                setStep('result');
            } else {
                setStep('config');
                setEmail(patient?.email || '');
                setInviteData(null);
            }
            setShowPreview(false);
        }
    }, [isOpen, initialInviteData, patient]);

    const handleSendInvite = async () => {
        if (!email || !email.includes('@')) {
            showError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post(`/patients/${patient.id}/portal-invite`, {
                email: email
            });
            if (response.data.success) {
                setInviteData(response.data);
                setStep('result');
                showSuccess('Invitation sent successfully');
            }
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (inviteData?.inviteLink) {
            navigator.clipboard.writeText(inviteData.inviteLink);
            setCopied(true);
            showSuccess('Link copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!patient) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'config' ? 'Invite Patient to Portal' : 'Invitation Generated'}
            size="md"
        >
            {step === 'config' ? (
                <div className="space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900">Portal Invitation</h4>
                            <p className="text-sm text-blue-700">Send a secure link to {patient.first_name} to create their portal account.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Recipient Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="patient@example.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                            {patient.email && email !== patient.email && (
                                <p className="mt-2 text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    This differes from the email in the patient's chart ({patient.email})
                                </p>
                            )}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
                            >
                                <Eye className="w-4 h-4" />
                                {showPreview ? 'Hide Preview' : 'Preview Email Content'}
                            </button>

                            {showPreview && (
                                <div className="mt-4 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                                            <span className="font-bold text-lg">PM</span>
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-slate-900">PageMD</h5>
                                            <p className="text-[10px] text-slate-500">support@pagemdemr.com</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h2 className="text-lg font-bold text-blue-600">Hello {patient.first_name},</h2>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Your healthcare provider has invited you to join the PageMD Patient Portal.
                                        </p>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Through this secure portal, you can view your health records, message your doctor, and request appointments.
                                        </p>
                                        <div className="py-4">
                                            <div className="w-full py-3 bg-blue-600 text-white rounded-xl text-center font-bold text-sm shadow-lg shadow-blue-200">
                                                Complete Your Registration
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-50 text-[10px] text-slate-400 text-center">
                                            © {new Date().getFullYear()} PageMD EMR. All rights reserved.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendInvite}
                            disabled={loading}
                            className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><Send className="w-4 h-4" /> Send Invitation Now</>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Status Header */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl border ${inviteData?.emailFailed ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg ${inviteData?.emailFailed ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
                            {inviteData?.emailFailed ? <ArrowRight className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                        </div>
                        <div>
                            <h4 className={`text-lg font-bold ${inviteData?.emailFailed ? 'text-amber-900' : 'text-emerald-900'}`}>
                                {inviteData?.emailFailed ? 'Link Generated' : 'Success!'}
                            </h4>
                            <p className={`text-sm ${inviteData?.emailFailed ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {inviteData?.message || `The invitation for ${patient.first_name} has been created.`}
                            </p>
                        </div>
                    </div>

                    {/* Email Info */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span>Email Status</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-slate-500 font-medium">Recipient</span>
                                <span className="text-sm text-slate-900 font-bold">{email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500 font-medium">Status</span>
                                {inviteData?.emailFailed ? (
                                    <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
                                        <Clock className="w-4 h-4" />
                                        Failed to Send
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm">
                                        <ShieldCheck className="w-4 h-4" />
                                        Queued for Delivery
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Direct Link */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                            <Copy className="w-4 h-4 text-purple-600" />
                            <span>Direct Invite Link</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-600 truncate border border-slate-200">
                                {inviteData?.inviteLink || 'Generating...'}
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2
                                    ${copied ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}
                                `}
                            >
                                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Done
                        </button>
                        <a
                            href={inviteData?.inviteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Preview Link
                        </a>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default PortalInviteModal;
