import React from 'react';
import {
    Save, Lock, FileText, Eye, Printer, PanelRight, Sparkles,
    CheckCircle2, AlertCircle, RotateCcw, ArrowLeft, Radio
} from 'lucide-react';
import { useEko } from '../../context/EkoContext';
import { format } from 'date-fns';

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

                        {!isSigned && !isPreliminary && (
                            <button
                                onClick={() => {
                                    const nextMode = !ambientMode;
                                    setAmbientMode(nextMode);
                                    if (nextMode) {
                                        handleStartRecording(true);
                                    } else if (isRecording) {
                                        handleStopRecording();
                                    }
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${ambientMode
                                    ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-300'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <Radio className={`w-4 h-4 ${isRecording && ambientMode ? 'animate-pulse text-rose-500' : ''}`} />
                                <div className="flex flex-col items-start leading-none">
                                    <span>{ambientMode ? (isRecording ? 'STOP SCRIBE' : 'START SCRIBE') : 'SCRIBE'}</span>
                                    {isRecording && ambientMode && (
                                        <span className="text-[8px] font-mono mt-0.5">
                                            {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    )}
                                </div>
                            </button>
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
