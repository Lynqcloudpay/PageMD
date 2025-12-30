import React, { useState, useEffect } from 'react';
import {
    Eye, X, Lock, Activity, FlaskConical, FileImage,
    Heart, Waves, Stethoscope, FileText
} from 'lucide-react';
import { format } from 'date-fns';

const decodeHtmlEntities = (text) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
};

const ChartReviewModal = ({
    isOpen,
    onClose,
    visits = [],
    patientData = {},
    onViewFullChart,
    onOpenVisit, // Optional callback to open a specific visit in full editor
    isLoading = false
}) => {
    const [activeTab, setActiveTab] = useState('Notes');
    const [selectedVisitId, setSelectedVisitId] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab('Notes');
            if (visits.length > 0) {
                setSelectedVisitId(visits[0].id);
            }
        }
    }, [isOpen, visits]);

    useEffect(() => {
        if (!selectedVisitId && visits.length > 0) {
            setSelectedVisitId(visits[0].id);
        }
    }, [selectedVisitId, visits]);

    if (!isOpen) return null;

    const renderNotesTab = () => {
        const selectedVisit = visits.find(v => v.id === selectedVisitId) || visits[0];
        if (!selectedVisit) return <div className="text-center text-slate-400 py-12">No visits found</div>;

        const noteText = selectedVisit.note_draft || selectedVisit.fullNote || '';
        const decoded = decodeHtmlEntities(noteText);

        // Parse sections for display
        const ccMatch = decoded.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History):|$)/is);
        const hpiMatch = decoded.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment):|$)/is);
        const rosMatch = decoded.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment):|$)/is);
        const peMatch = decoded.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|A):|$)/is);
        const assessmentMatch = decoded.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
        const planMatch = decoded.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|Follow):|$)/is);
        const carePlanMatch = decoded.match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|$)/is);

        return (
            <>
                {/* Left: Visit List */}
                <div className="w-56 border-r border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden">
                    <div className="p-3 border-b border-slate-200 flex-shrink-0">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Visit History</div>
                        <div className="text-[10px] text-slate-400">{visits.length} visits</div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {visits.map((visit) => {
                            const vNoteText = visit.note_draft || visit.fullNote || '';
                            const vCCMatch = vNoteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n|$)/i);
                            const cc = vCCMatch ? vCCMatch[1].trim().substring(0, 40) : 'Visit';
                            const date = visit.visit_date ? new Date(visit.visit_date) : new Date();

                            return (
                                <button
                                    key={visit.id}
                                    onClick={() => setSelectedVisitId(visit.id)}
                                    className={`w-full text-left p-3 border-b border-slate-100 transition-all ${selectedVisitId === visit.id
                                        ? 'bg-white border-l-4 border-l-primary-500 shadow-sm'
                                        : 'hover:bg-white/70'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-xs font-bold text-slate-900">
                                            {format(date, 'MMM d, yyyy')}
                                        </span>
                                        {(visit.locked || visit.signed) && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{cc}</div>
                                    <div className="text-[9px] text-slate-400 uppercase mt-0.5">
                                        {visit.provider_last_name || visit.provider || 'Provider'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Center: Full Note View */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="space-y-4">
                        {/* Visit Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-slate-900">
                                        {format(new Date(selectedVisit.visit_date), 'MMMM d, yyyy')}
                                    </span>
                                    {(selectedVisit.locked || selectedVisit.signed) && (
                                        <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                                            <Lock className="w-3 h-3" /> Signed
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {selectedVisit.visit_type?.replace('_', ' ') || 'Office Visit'} • {selectedVisit.provider_last_name || selectedVisit.provider || 'Provider'}
                                </div>
                            </div>
                            {onOpenVisit && (
                                <button
                                    onClick={() => onOpenVisit(selectedVisit.id)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                                >
                                    Open in Editor
                                </button>
                            )}
                        </div>

                        {/* CC */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Chief Complaint</div>
                            <div className="text-sm font-semibold text-blue-900">{ccMatch ? ccMatch[1].trim() : 'Not documented'}</div>
                        </div>

                        {/* HPI */}
                        {hpiMatch && (
                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">History of Present Illness</div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{hpiMatch[1].trim()}</div>
                            </div>
                        )}

                        {/* ROS - Collapsed by default */}
                        {rosMatch && (
                            <details className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <summary className="p-3 cursor-pointer text-[10px] font-bold text-slate-500 uppercase tracking-wide hover:bg-slate-100">
                                    Review of Systems ▾
                                </summary>
                                <div className="p-4 pt-0 text-xs text-slate-600 whitespace-pre-wrap">{rosMatch[1].trim()}</div>
                            </details>
                        )}

                        {/* PE - Collapsed by default */}
                        {peMatch && (
                            <details className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <summary className="p-3 cursor-pointer text-[10px] font-bold text-slate-500 uppercase tracking-wide hover:bg-slate-100">
                                    Physical Exam ▾
                                </summary>
                                <div className="p-4 pt-0 text-xs text-slate-600 whitespace-pre-wrap">{peMatch[1].trim()}</div>
                            </details>
                        )}

                        {/* Assessment */}
                        {assessmentMatch && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2">Assessment</div>
                                <div className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{assessmentMatch[1].trim()}</div>
                            </div>
                        )}

                        {/* Plan */}
                        {planMatch && (
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-2">Plan</div>
                                <div className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{planMatch[1].trim()}</div>
                            </div>
                        )}

                        {/* Care Plan */}
                        {carePlanMatch && (
                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                                <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-2">Care Plan</div>
                                <div className="text-sm text-purple-900 whitespace-pre-wrap leading-relaxed">{carePlanMatch[1].trim()}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Quick Info */}
                <div className="w-56 border-l border-slate-200 bg-slate-50 p-3 overflow-y-auto custom-scrollbar flex-shrink-0">
                    <div className="space-y-4">
                        {/* Active Problems */}
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Active Problems</div>
                            <div className="space-y-1">
                                {(patientData?.problems || []).filter(p => p.status === 'active').slice(0, 6).map((p, i) => (
                                    <div key={i} className="text-[11px] text-slate-700 flex items-start gap-1">
                                        <span className="text-slate-400">•</span>
                                        <span>{p.problem_name || p.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Medications */}
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Medications</div>
                            <div className="space-y-1">
                                {(patientData?.medications || []).filter(m => m.active !== false).slice(0, 6).map((m, i) => (
                                    <div key={i} className="text-[11px] text-slate-700">
                                        {m.medication_name || m.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Allergies */}
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Allergies</div>
                            {(patientData?.allergies || []).length > 0 ? (
                                <div className="space-y-1">
                                    {patientData.allergies.map((a, i) => (
                                        <div key={i} className="text-[11px] text-red-600 font-medium">{a.allergen || a.name}</div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[11px] text-emerald-600 font-medium">NKDA</div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    const renderVitalsTab = () => {
        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary-500" />
                        Vitals History
                    </h3>
                    <div className="text-xs text-slate-400">Showing last {visits.length} visits</div>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">BP</th>
                                    <th className="px-4 py-3 font-semibold">HR</th>
                                    <th className="px-4 py-3 font-semibold">Temp</th>
                                    <th className="px-4 py-3 font-semibold">RR</th>
                                    <th className="px-4 py-3 font-semibold">O2 Sat</th>
                                    <th className="px-4 py-3 font-semibold">BMI</th>
                                    <th className="px-4 py-3 font-semibold">Weight</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {visits.map(visit => {
                                    // Handle vitals being a string (JSON) or object
                                    let v = visit.vitals || {};
                                    if (typeof v === 'string') {
                                        try {
                                            v = JSON.parse(v);
                                        } catch (e) {
                                            v = {};
                                        }
                                    }

                                    const bp = v.bp || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '-');
                                    const hr = v.pulse || v.hr || '-';
                                    const temp = v.temp ? `${v.temp}` : '-';
                                    const rr = v.resp || v.rr || '-';
                                    const o2 = v.o2sat || v.spo2 ? `${v.o2sat || v.spo2}%` : '-';
                                    const bmi = v.bmi || '-';
                                    const weight = v.weight ? `${v.weight} ${v.weightUnit || 'lbs'}` : '-';

                                    // Highlight abnormal values roughly
                                    const isHighBP = (v.systolic && parseInt(v.systolic) > 140) || (v.diastolic && parseInt(v.diastolic) > 90);

                                    return (
                                        <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-50">
                                                {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                                            </td>
                                            <td className={`px-4 py-3 ${isHighBP ? 'text-red-600 font-bold' : ''}`}>
                                                {bp}
                                            </td>
                                            <td className="px-4 py-3">{hr}</td>
                                            <td className="px-4 py-3">{temp}</td>
                                            <td className="px-4 py-3">{rr}</td>
                                            <td className="px-4 py-3">{o2}</td>
                                            <td className="px-4 py-3 font-medium text-slate-700">{bmi}</td>
                                            <td className="px-4 py-3 text-slate-500">{weight}</td>
                                        </tr>
                                    );
                                })}
                                {visits.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                                            No vitals recorded
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                {/* Header with Tabs */}
                <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-white" />
                            <h2 className="text-lg font-bold text-white">Chart Review</h2>
                        </div>
                        {/* Tab Buttons */}
                        <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1 overflow-x-auto max-w-[600px] scrollbar-hide">
                            {['Notes', 'Vitals', 'Labs', 'Imaging', 'Echo', 'EKG', 'Stress', 'Cath', 'Docs'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${(activeTab || 'Notes') === tab
                                        ? 'bg-white text-slate-900 shadow'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeTab === 'Notes' ? (
                        renderNotesTab()
                    ) : activeTab === 'Vitals' ? (
                        renderVitalsTab()
                    ) : (
                        /* Labs / Imaging / Echo / EKG tabs - Placeholders for now */
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                    {activeTab === 'Labs' && <FlaskConical className="w-8 h-8 text-purple-500" />}
                                    {activeTab === 'Imaging' && <FileImage className="w-8 h-8 text-blue-500" />}
                                    {activeTab === 'Echo' && <Heart className="w-8 h-8 text-rose-500" />}
                                    {activeTab === 'EKG' && <Waves className="w-8 h-8 text-rose-500" />}
                                    {activeTab === 'Stress' && <Activity className="w-8 h-8 text-orange-500" />}
                                    {activeTab === 'Cath' && <Stethoscope className="w-8 h-8 text-red-500" />}
                                    {activeTab === 'Docs' && <FileText className="w-8 h-8 text-slate-500" />}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">{activeTab}</h3>
                                <p className="text-sm text-slate-500 mb-4">Results will be displayed here</p>
                                {onViewFullChart && (
                                    <button
                                        onClick={onViewFullChart}
                                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                                    >
                                        View in Full Chart
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="text-xs text-slate-500">
                        {activeTab === 'Notes' ? 'Navigate between visits to review patient history' : 'Review historical data'}
                    </div>
                    {onViewFullChart && (
                        <button
                            onClick={onViewFullChart}
                            className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Open Full Chart →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChartReviewModal;
