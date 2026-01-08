import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Unlock, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { privacyAPI } from '../services/api';

const BreakTheGlassModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [restrictedData, setRestrictedData] = useState(null);
    const [reasonCode, setReasonCode] = useState('');
    const [reasonComment, setReasonComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const reasonOptions = [
        { value: 'DIRECT_CARE', label: 'Direct patient care' },
        { value: 'COVERAGE', label: 'Coverage / On-call' },
        { value: 'BILLING', label: 'Billing / Insurance' },
        { value: 'QUALITY', label: 'Quality review' },
        { value: 'COMPLIANCE', label: 'Compliance / Investigation' },
        { value: 'OTHER', label: 'Other (requires comment)' }
    ];

    useEffect(() => {
        const handleRestricted = (event) => {
            setRestrictedData(event.detail);
            setIsOpen(true);
            setError('');
        };

        window.addEventListener('privacy:restricted', handleRestricted);
        return () => window.removeEventListener('privacy:restricted', handleRestricted);
    }, []);

    const handleBreakGlass = async (e) => {
        e.preventDefault();
        if (!reasonCode) {
            setError('Please select a reason for access.');
            return;
        }
        if (reasonCode === 'OTHER' && !reasonComment.trim()) {
            setError('Please provide a comment for "Other" reason.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await privacyAPI.breakGlass(restrictedData.patientId, {
                reasonCode,
                reasonComment
            });

            setIsOpen(false);
            // Refresh the page or retry the failed request
            // Retrofitting: Refresh is safest but we can also broadcast a 'privacy:cleared' event
            window.location.reload();
        } catch (err) {
            console.error('Break-glass failed:', err);
            setError(err.response?.data?.message || 'Failed to authorize access. Please contact an administrator.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-red-50 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header - Alert Style */}
                <div className="bg-gradient-to-r from-red-600 to-red-500 p-8 text-center text-white relative">
                    <div className="absolute top-6 right-6 opacity-20">
                        <ShieldAlert size={120} />
                    </div>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-6 backdrop-blur-sm border border-white/30">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight mb-2">RESTRICTED RECORD</h2>
                    <p className="text-red-50 font-medium opacity-90 max-w-xs mx-auto">
                        This patient record is confidential. Access is limited to authorized personnel only.
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="bg-red-50/50 rounded-2xl p-6 border border-red-100/50 flex gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h4 className="text-red-900 font-bold mb-1">Authorization Required</h4>
                            <p className="text-sm text-red-700/80 leading-relaxed font-medium">
                                You are attempting to access a restricted chart. This action will be logged and audited in accordance with HIPAA regulations.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleBreakGlass} className="space-y-5">
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                Reason for Access (Required)
                            </label>
                            <select
                                required
                                value={reasonCode}
                                onChange={(e) => setReasonCode(e.target.value)}
                                className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all outline-none"
                            >
                                <option value="">Select a reason...</option>
                                {reasonOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {reasonCode === 'OTHER' && (
                            <div className="animate-in slide-in-from-top-4 duration-300">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                    Additional Details
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={reasonComment}
                                    onChange={(e) => setReasonComment(e.target.value)}
                                    placeholder="Provide details for compliance auditing..."
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium text-slate-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all outline-none"
                                />
                            </div>
                        )}

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                            <input
                                type="checkbox"
                                required
                                id="ack"
                                className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                            />
                            <label htmlFor="ack" className="text-xs font-bold text-slate-500 leading-tight">
                                I confirm I am authorized to access this chart and understand this access will be logged.
                            </label>
                        </div>

                        {error && (
                            <p className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                                {error}
                            </p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => window.history.back()}
                                className="flex-1 h-14 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-[2] h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        <Unlock className="w-5 h-5" />
                                        Break Glass & Access Chart
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Footer info */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Privacy Enforcement Active • Clinic ID: {localStorage.getItem('clinic_slug') || 'SYSTEM'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default BreakTheGlassModal;
