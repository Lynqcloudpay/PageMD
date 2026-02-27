import React from 'react';
import {
    Save, Lock, FileText, Eye, Printer, PanelRight, Sparkles,
    CheckCircle2, AlertCircle, RotateCcw, ArrowLeft, Radio
} from 'lucide-react';
import { useEko } from '../../context/EkoContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const VisitNoteHeader = ({
    visitData,
    visitType,
    setVisitType,
    isSigned,
    isPreliminary,
    isLocked,
    isRetracted,
    isSaving,
    lastSaved,
    handleSave,
    handleSign,
    setShowCosignModal,
    setShowPrintModal,
    setShowPrintOrdersModal,
    setShowChartReview,
    showQuickActions,
    setShowQuickActions,
    setShowRetractModal,
    viewRetractedContent,
    setViewRetractedContent,
    retractionInfo,
    isDirectEditing,
    setIsDirectEditing,
    handleCosign,
    navigate,
    id,
    providerName
}) => {
    const {
        ambientMode, setAmbientMode, isRecording, recordingTime,
        handleStartRecording, handleStopRecording
    } = useEko();

    const visitDate = visitData?.visit_date ? format(new Date(visitData.visit_date), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy');

    return (
        <div className="w-full">
            {/* Back Button */}
            <div className="mb-6">
                <button
                    onClick={() => navigate(`/patient/${id}/snapshot`)}
                    className="group flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-all"
                >
                    <div className="p-1.5 rounded-full group-hover:bg-blue-50 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide uppercase">Patient Chart</span>
                </button>
            </div>

            {/* Direct Editing Alert */}
            {isDirectEditing && (
                <div className="mb-6 p-4 bg-blue-50/50 backdrop-blur-sm border border-blue-100 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-200">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-blue-900">Direct Editing Mode</h3>
                            <p className="text-xs text-blue-700 font-medium">Modifying trainee documentation. Changes save permanently.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsDirectEditing(false)}
                            className="px-4 py-2 text-blue-600 hover:bg-blue-100/50 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleCosign('', 'Direct Edit')}
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Finalize Note
                        </button>
                    </div>
                </div>
            )}

            {/* Header Main Card */}
            <div className="vn-card p-5 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                            <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <select
                                    value={visitType}
                                    onChange={(e) => setVisitType(e.target.value)}
                                    disabled={isLocked}
                                    className="text-xl font-bold text-gray-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600 transition-colors"
                                >
                                    <option value="Office Visit">Office Visit</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="New Patient">New Patient</option>
                                    <option value="Sick Visit">Sick Visit</option>
                                    <option value="Telehealth Visit">Telehealth</option>
                                    <option value="Consultation">Consultation</option>
                                </select>
                                <span className="text-xl font-light text-gray-400">/</span>
                                <span className="text-xl font-bold text-gray-800">Visit Note</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
                                <span>{visitDate}</span>
                                <span className="w-1 h-1 bg-gray-100 rounded-full"></span>
                                <span className="text-gray-500">{providerName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Floating Scribe Master Control — Portal to Body for Layout Isolation */}
                    {!isSigned && !isPreliminary && (
                        <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center justify-center">
                            {/* The Header Placeholder Version (Only clickable when NOT recording) */}
                            <button
                                onClick={() => {
                                    if (isRecording) return;
                                    setAmbientMode(true);
                                    handleStartRecording(true);
                                }}
                                className={`group flex items-center gap-4 px-8 py-3 rounded-2xl text-xs font-bold transition-all shadow-md border ${isRecording && ambientMode
                                        ? 'opacity-0 pointer-events-none'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                                    }`}
                            >
                                <Radio className="w-5 h-5 text-amber-500" />
                                <span className="tracking-[0.1em] uppercase text-[10px]">Ambient Scribe</span>
                            </button>

                            {/* The Floating Portal Version (Active when recording) */}
                            {isRecording && ambientMode && createPortal(
                                <div className="fixed inset-x-0 bottom-12 z-[9999] pointer-events-none flex flex-col items-center gap-3">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                            className="pointer-events-auto"
                                        >
                                            <button
                                                onClick={() => handleStopRecording()}
                                                className="group flex items-center gap-4 px-10 py-4 rounded-3xl text-sm font-black transition-all bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_20px_50px_rgba(245,158,11,0.5)] ring-4 ring-amber-300 ring-offset-4 animate-in hover:scale-105 active:scale-95"
                                            >
                                                <div className="relative">
                                                    <Radio className="w-6 h-6 animate-pulse" />
                                                    <motion.span
                                                        initial={{ scale: 1, opacity: 0.5 }}
                                                        animate={{ scale: 2.5, opacity: 0 }}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                        className="absolute inset-0 bg-white rounded-full"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-start leading-tight min-w-[140px]">
                                                    <span className="tracking-widest uppercase text-[11px] opacity-80">STOP SCRIBE</span>
                                                    <span className="text-[14px] font-mono mt-0.5">
                                                        {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                                                    </span>
                                                </div>
                                                <div className="flex h-3 w-3 relative ml-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
                                                </div>
                                            </button>
                                        </motion.div>
                                    </AnimatePresence>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="bg-white/90 backdrop-blur-md px-6 py-2 rounded-2xl border border-amber-200 shadow-2xl flex items-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                                        <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
                                            Eko is listening and documenting...
                                        </span>
                                    </motion.div>
                                </div>,
                                document.body
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => setShowChartReview(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-lg shadow-slate-200"
                        >
                            <Eye className="w-4 h-4" />
                            <span>Review</span>
                        </button>

                        {!isSigned && !isPreliminary && (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4 text-gray-400" />
                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button
                                    onClick={handleSign}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <Lock className="w-4 h-4" />
                                    <span>Sign Note</span>
                                </button>
                            </>
                        )}



                        {isSigned && (
                            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>Signed</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-100">
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-100 transition-all shadow-sm"
                                title="Print Note"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowQuickActions(!showQuickActions)}
                                className={`p-2.5 rounded-xl transition-all shadow-sm border ${showQuickActions
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-200'
                                    }`}
                                title="Insights Panel"
                            >
                                <PanelRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisitNoteHeader;
