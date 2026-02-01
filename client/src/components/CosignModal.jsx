import React from 'react';
import { X, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

/**
 * Commercial-Grade Cosignature Modal
 * Used by physicians to finalize preliminary notes.
 */
const CosignModal = ({
    isOpen,
    onClose,
    onConfirm,
    visitData,
    authorshipModel,
    setAuthorshipModel,
    attestationText,
    setAttestationText,
    macros = [],
    isSaving
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-2xl">
                                <Lock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">Clinical Cosignature</h2>
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Finalizing Preliminary Report</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                            <X className="w-6 h-6 text-slate-300" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Attestation Statement</label>
                                <textarea
                                    value={attestationText}
                                    onChange={(e) => setAttestationText(e.target.value)}
                                    placeholder="Enter your attestation (e.g., 'I have reviewed the trainee note and agree with the assessment and plan...')"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 focus:bg-white outline-none transition-all h-48 resize-none placeholder:text-slate-300 shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Authorship & Documentation Model</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${authorshipModel === 'Addendum' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="authorship"
                                            value="Addendum"
                                            checked={authorshipModel === 'Addendum'}
                                            onChange={(e) => setAuthorshipModel(e.target.value)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-800">Addendum Model</span>
                                            <span className="text-[10px] text-slate-500">Append attestation to trainee note</span>
                                        </div>
                                    </label>
                                    <label className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${authorshipModel === 'Direct' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="authorship"
                                            value="Direct"
                                            checked={authorshipModel === 'Direct'}
                                            onChange={(e) => setAuthorshipModel(e.target.value)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-800">Direct Edit Model</span>
                                            <span className="text-[10px] text-slate-500">I have modified sections of the note</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Macros Sidebar */}
                        <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Attestations</h4>
                            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {macros.length > 0 ? macros.map((macro) => (
                                    <button
                                        key={macro.id}
                                        onClick={() => setAttestationText(macro.content)}
                                        className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all hover:shadow-sm active:scale-95"
                                    >
                                        {macro.name}
                                    </button>
                                )) : (
                                    <div className="text-center py-10">
                                        <Sparkles className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">No Macros Found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Legal Footer */}
                    <div className="mt-8 flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                            CMS Requirements: Your cosignature affirms that you personally performed the service, or were physically present during the key portions of the service performed by the resident.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(attestationText, authorshipModel)}
                            disabled={!attestationText.trim() || isSaving}
                            className="flex-[2] px-4 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirm Cosignature
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CosignModal;
