import React, { useState } from 'react';
import { Mail, CheckCircle, Copy, ExternalLink, Shield as ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import Modal from './ui/Modal';
import { showSuccess } from '../utils/toast';

const PortalInviteModal = ({ isOpen, onClose, patient, inviteData }) => {
    const [copied, setCopied] = useState(false);

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
            title="Portal Invitation Generated"
            size="md"
        >
            <div className="space-y-6">
                {/* Status Header */}
                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-emerald-900">Success!</h4>
                        <p className="text-sm text-emerald-700">
                            The invitation for <span className="font-semibold">{patient.first_name} {patient.last_name}</span> has been created.
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
                            <span className="text-sm text-slate-900 font-bold">{patient.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Status</span>
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm">
                                <ShieldCheck className="w-4 h-4" />
                                Queued for Delivery
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">
                        In a production system, this email is sent instantly via our secure HIPAA-compliant email service (Resend).
                    </p>
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

                {/* Expiry / Security */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100 text-[11px] text-amber-700">
                    <Clock className="w-3.5 h-3.5" />
                    <span>This link will expire in 72 hours for security. Following that, a new invite must be generated.</span>
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
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
        </Modal>
    );
};

export default PortalInviteModal;
