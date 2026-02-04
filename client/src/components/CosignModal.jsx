import React from 'react';
import { X, Lock, Sparkles, CheckCircle2, Trash2 } from 'lucide-react';

/**
 * Commercial-Grade Cosignature Modal
 * Used by physicians to finalize preliminary notes.
 */
const CosignModal = ({
    isOpen,
    onClose,
    onConfirm,
    onCreateMacro,
    onDeleteMacro,
    visitData,
    authorshipModel,
    setAuthorshipModel,
    attestationText,
    setAttestationText,
    macros = [],
    isSaving
}) => {
    const [isAddingMacro, setIsAddingMacro] = React.useState(false);
    const [newMacroName, setNewMacroName] = React.useState('');
    const [newMacroContent, setNewMacroContent] = React.useState('');
    const [isProcessingMacro, setIsProcessingMacro] = React.useState(false);

    if (!isOpen) return null;

    const handleCreateMacro = async () => {
        if (!newMacroName.trim() || !newMacroContent.trim()) return;
        setIsProcessingMacro(true);
        const success = await onCreateMacro({ name: newMacroName, content: newMacroContent });
        if (success) {
            setNewMacroName('');
            setNewMacroContent('');
            setIsAddingMacro(false);
        }
        setIsProcessingMacro(false);
    };

    const handleDeleteMacro = async (e, id) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this macro?')) {
            setIsProcessingMacro(true);
            await onDeleteMacro(id);
            setIsProcessingMacro(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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

                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1 space-y-6 min-w-0">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Attestation Statement</label>
                                <textarea
                                    value={attestationText}
                                    onChange={(e) => setAttestationText(e.target.value)}
                                    placeholder="Enter your attestation (e.g., 'I have reviewed the trainee note and agree with the assessment and plan...')"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 focus:bg-white outline-none transition-all h-64 resize-none placeholder:text-slate-300 shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Authorship & Documentation Model</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className={`flex-1 min-w-[140px] flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${authorshipModel === 'Addendum' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="authorship"
                                            value="Addendum"
                                            checked={authorshipModel === 'Addendum'}
                                            onChange={(e) => setAuthorshipModel(e.target.value)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-800">Addendum</span>
                                            <span className="text-[10px] text-slate-500">Append to note</span>
                                        </div>
                                    </label>
                                    <label className={`flex-1 min-w-[140px] flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${authorshipModel === 'Direct Edit' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="authorship"
                                            value="Direct Edit"
                                            checked={authorshipModel === 'Direct Edit'}
                                            onChange={(e) => setAuthorshipModel(e.target.value)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-slate-800">Direct Edit</span>
                                            <span className="text-[10px] text-slate-500">I modified sections</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Macros Sidebar */}
                        <div className="lg:w-[320px] shrink-0 flex flex-col h-full overflow-hidden">
                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100 flex flex-col h-[500px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                        Templates
                                    </h4>
                                    <button
                                        onClick={() => setIsAddingMacro(!isAddingMacro)}
                                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2"
                                    >
                                        {isAddingMacro ? 'Cancel' : '+ Create'}
                                    </button>
                                </div>

                                {isAddingMacro ? (
                                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                        <input
                                            type="text"
                                            placeholder="Template Name"
                                            value={newMacroName}
                                            onChange={(e) => setNewMacroName(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/5"
                                        />
                                        <textarea
                                            placeholder="Content..."
                                            value={newMacroContent}
                                            onChange={(e) => setNewMacroContent(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-400 h-48 resize-none focus:ring-2 focus:ring-blue-500/5 shadow-inner"
                                        />
                                        <button
                                            onClick={handleCreateMacro}
                                            disabled={!newMacroName.trim() || !newMacroContent.trim() || isProcessingMacro}
                                            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/10 active:scale-95"
                                        >
                                            {isProcessingMacro ? 'Saving...' : 'Save Template'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                                        {macros.length > 0 ? macros.map((macro) => (
                                            <div key={macro.id} className="group relative">
                                                <button
                                                    onClick={() => setAttestationText(prev => prev ? `${prev}\n\n${macro.content}` : macro.content)}
                                                    className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98] flex flex-col gap-1 pr-10 shadow-sm"
                                                >
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{macro.name}</span>
                                                    <span className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{macro.content}</span>
                                                </button>
                                                {macro.user_id && (
                                                    <button
                                                        onClick={(e) => handleDeleteMacro(e, macro.id)}
                                                        className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm mb-4">
                                                    <Sparkles className="w-8 h-8 text-slate-200" />
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No Templates</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Legal Footer */}
                    <div className="mt-8 flex items-center gap-4 p-5 bg-amber-50/50 rounded-3xl border border-amber-100/50">
                        <div className="p-3 bg-amber-100/50 rounded-2xl">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-[11px] text-amber-900/70 font-bold leading-relaxed">
                            CMS & HIPAA Compliance: Your digital signature affirms you personally performed or supervised the service. This action is immutable and logged in the clinical audit trail.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(attestationText, authorshipModel)}
                            disabled={!attestationText.trim() || isSaving}
                            className="flex-[2] px-4 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    {authorshipModel === 'Direct Edit' ? 'Preparing Editor...' : 'Signing Note...'}
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {authorshipModel === 'Direct Edit' ? 'Enter Direct Edit Mode' : 'Finalize Cosignature'}
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
