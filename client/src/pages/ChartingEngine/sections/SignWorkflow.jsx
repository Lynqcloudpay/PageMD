/**
 * SignWorkflow.jsx
 * Orchestrates sign, cosign, retract, and delete flows in a single component.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Lock, CheckCircle2, AlertCircle, UserCircle, X, RotateCcw, Trash2 } from 'lucide-react';
import { macrosAPI } from '../../../services/api';

const SignWorkflow = ({
    visitData, isSigned, isPreliminary, isRetracted, isLocked, isDirectEditing,
    attendings = [], retractionInfo, providerName,
    onSign, onCosign, onDelete, onRetract, onSetDirectEditing,
    showToast, navigate, patientId,
}) => {
    const [showSignPrompt, setShowSignPrompt] = useState(false);
    const [selectedAttendingId, setSelectedAttendingId] = useState('');
    const [showCosignModal, setShowCosignModal] = useState(false);
    const [attestationText, setAttestationText] = useState('');
    const [authorshipModel, setAuthorshipModel] = useState('Addendum');
    const [attestationMacros, setAttestationMacros] = useState([]);
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [retractReason, setRetractReason] = useState({ reason_code: 'ERROR', reason_text: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Load attestation macros when cosign modal opens
    useEffect(() => {
        if (showCosignModal) {
            macrosAPI.getAll({ category: 'Attestation' }).then(res => setAttestationMacros(res.data || [])).catch(() => { });
        }
    }, [showCosignModal]);

    const handleSignClick = useCallback(async () => {
        const result = await onSign?.(selectedAttendingId);
        if (result === 'NEEDS_ATTENDING') setShowSignPrompt(true);
    }, [onSign, selectedAttendingId]);

    const handleCosignClick = useCallback(async () => {
        await onCosign?.({ attestationText, authorshipModel, isDirectEditing });
        setShowCosignModal(false);
        setAttestationText('');
    }, [onCosign, attestationText, authorshipModel, isDirectEditing]);

    const handleDeleteClick = useCallback(async () => {
        await onDelete?.(navigate);
        setShowDeleteConfirm(false);
    }, [onDelete, navigate]);

    // ── Action Buttons (bottom bar) ────────────────────────────────────────
    if (isLocked && !isPreliminary) return null;

    return (
        <>
            {/* Attending Selection Modal */}
            {showSignPrompt && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-primary-50 rounded-xl"><UserCircle className="w-5 h-5 text-primary-600" /></div>
                            <div>
                                <h3 className="text-lg font-bold">Select Attending</h3>
                                <p className="text-xs text-slate-500">This note requires cosignature from an attending physician.</p>
                            </div>
                        </div>
                        <select value={selectedAttendingId} onChange={(e) => setSelectedAttendingId(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl mb-4 text-sm focus:ring-primary-400 focus:border-primary-400">
                            <option value="">Select attending...</option>
                            {attendings.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}, {a.credentials || 'MD'}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowSignPrompt(false); handleSignClick(); }} disabled={!selectedAttendingId} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4" /> Submit for Cosignature
                            </button>
                            <button onClick={() => setShowSignPrompt(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm transition-all">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cosign Modal */}
            {showCosignModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                                <h3 className="text-lg font-bold">Cosign Note</h3>
                            </div>
                            <button onClick={() => setShowCosignModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Authorship Model */}
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Authorship Model</label>
                            <div className="flex gap-2">
                                {['Addendum', 'Full Attestation', 'Direct Edit'].map(model => (
                                    <button key={model} onClick={() => { setAuthorshipModel(model); if (model === 'Direct Edit') onSetDirectEditing?.(true); }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${authorshipModel === model ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-200'}`}>
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Attestation macros */}
                        {attestationMacros.length > 0 && (
                            <div className="mb-3">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Quick Templates</label>
                                <div className="flex flex-wrap gap-1">
                                    {attestationMacros.map(m => (
                                        <button key={m.id} onClick={() => setAttestationText(m.content)} className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100">{m.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attestation Text */}
                        <textarea value={attestationText} onChange={(e) => setAttestationText(e.target.value)}
                            placeholder={authorshipModel === 'Full Attestation' ? 'I have personally seen and examined this patient...' : 'Attestation statement...'}
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] focus:ring-primary-400 focus:border-primary-400 mb-4" />

                        <div className="flex gap-2">
                            <button onClick={handleCosignClick} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Cosign Note
                            </button>
                            <button onClick={() => setShowCosignModal(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Retract Modal */}
            {showRetractModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-50 rounded-xl"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-red-900">Retract Note</h3>
                                <p className="text-xs text-slate-500">This action cannot be easily undone. The note will be marked as entered in error.</p>
                            </div>
                        </div>
                        <select value={retractReason.reason_code} onChange={(e) => setRetractReason({ ...retractReason, reason_code: e.target.value })} className="w-full p-2 border border-slate-200 rounded-xl mb-3 text-sm">
                            <option value="ERROR">Entered in Error</option>
                            <option value="WRONG_PATIENT">Wrong Patient</option>
                            <option value="DUPLICATE">Duplicate Note</option>
                            <option value="OTHER">Other</option>
                        </select>
                        <textarea value={retractReason.reason_text} onChange={(e) => setRetractReason({ ...retractReason, reason_text: e.target.value })} placeholder="Additional details..." className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[80px] mb-4" />
                        <div className="flex gap-2">
                            <button onClick={() => { onRetract?.(retractReason); setShowRetractModal(false); }} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700"><RotateCcw className="w-4 h-4 inline mr-1" /> Confirm Retraction</button>
                            <button onClick={() => setShowRetractModal(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl text-center">
                        <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold mb-1">Delete Draft?</h3>
                        <p className="text-sm text-slate-500 mb-4">This will permanently delete this unsigned note.</p>
                        <div className="flex gap-2">
                            <button onClick={handleDeleteClick} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700">Delete</button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Expose show methods via a companion hook
export const useSignWorkflowUI = () => {
    const [showCosignModal, setShowCosignModal] = useState(false);
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    return { showCosignModal, setShowCosignModal, showRetractModal, setShowRetractModal, showDeleteConfirm, setShowDeleteConfirm };
};

export default SignWorkflow;
