import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    MessageCircle, X, Send, Sparkles, Activity, ChevronDown, Loader2, TrendingUp,
    Pill, FileText, Bot, User, Navigation, BarChart3, Trash2, History,
    Stethoscope, ClipboardList, Plus, CheckCircle2, AlertTriangle, Calendar,
    Inbox, PenTool, Search, Copy, ChevronRight, Zap, Globe, FlaskConical, ArrowUpRight, ArrowDownRight,
    Mic, Square, Paperclip, ShieldAlert, BookOpen, FileImage
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ─── Trend Chart Component (lightweight SVG) ────────────────────────────────

function EchoTrendChart({ visualization }) {
    if (!visualization || !visualization.dataPoints || visualization.dataPoints.length < 2) {
        return null;
    }

    const { dataPoints, label, unit, chartConfig, stats, clinicalContext } = visualization;
    const width = 320;
    const height = 140;
    const padding = { top: 20, right: 16, bottom: 28, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = dataPoints.map(d => d.value);
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;

    const scaleX = (i) => padding.left + (i / (dataPoints.length - 1)) * chartW;
    const scaleY = (v) => padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    const pathD = dataPoints.map((dp, i) => {
        const x = scaleX(i);
        const y = scaleY(dp.value);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    const severityColor = clinicalContext?.severity === 'high' ? '#ef4444' :
        clinicalContext?.severity === 'moderate' ? '#f59e0b' : '#3b82f6';
    const gradientId = `chartGradient-${label.replace(/\s+/g, '')}`;

    return (
        <div className="bg-white rounded-xl p-4 mt-2 border border-gray-200/60 shadow-sm transition-all hover:shadow-md group">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gray-50 group-hover:bg-blue-50 transition-colors">
                        <TrendingUp className={`w-3.5 h-3.5 ${severityColor === '#ef4444' ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <span className="text-[12px] font-bold text-gray-700 tracking-tight">{label}</span>
                </div>
                {stats?.trend && stats.trend !== 'stable' && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${stats.trend === 'rising'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                        {stats.trend === 'rising' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        <span className="text-[9px] font-extrabold uppercase tracking-wider">
                            {stats.trend === 'rising' ? 'Rising' : 'Falling'}
                        </span>
                    </div>
                )}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: '140px' }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={severityColor} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={severityColor} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padding.top + chartH * (1 - pct);
                    const val = Math.round(minVal + (maxVal - minVal) * pct);
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                stroke="#f1f5f9" strokeWidth="1" />
                            <text x={padding.left - 8} y={y + 3} textAnchor="end"
                                className="text-[8px] font-medium" fill="#94a3b8">{val}</text>
                        </g>
                    );
                })}

                <path d={`${pathD} L ${scaleX(dataPoints.length - 1)} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`}
                    fill={`url(#${gradientId})`} />

                <path d={pathD} fill="none" stroke={severityColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {dataPoints.map((dp, i) => (
                    <circle key={i} cx={scaleX(i)} cy={scaleY(dp.value)} r="3"
                        fill={severityColor} stroke="white" strokeWidth="1.5" />
                ))}

                {dataPoints.filter((_, i) => i === 0 || i === dataPoints.length - 1).map((dp, i) => (
                    <text key={`d-${i}`}
                        x={scaleX(i === 0 ? 0 : dataPoints.length - 1)}
                        y={height - 4}
                        textAnchor={i === 0 ? 'start' : 'end'}
                        className="text-[7px]" fill="#94a3b8">
                        {new Date(dp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </text>
                ))}
            </svg>
            {clinicalContext?.recommendation && (
                <p className={`text-[10px] mt-1 ${clinicalContext.severity === 'high' ? 'text-red-600 font-medium' :
                    clinicalContext.severity === 'moderate' ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                    {clinicalContext.recommendation}
                </p>
            )}
        </div>
    );
}

// ─── Note Draft Card ────────────────────────────────────────────────────────

function NoteDraftCard({ visualization, patientId }) {
    const [copied, setCopied] = useState({});
    const [inserting, setInserting] = useState(false);
    const [inserted, setInserted] = useState(false);
    const [openNotes, setOpenNotes] = useState(null);
    const [showNotePicker, setShowNotePicker] = useState(false);
    const [insertError, setInsertError] = useState(null);

    const copyToClipboard = (section, text) => {
        navigator.clipboard.writeText(text);
        setCopied(prev => ({ ...prev, [section]: true }));
        setTimeout(() => setCopied(prev => ({ ...prev, [section]: false })), 2000);
    };

    const insertIntoNote = async (targetVisitId = null) => {
        if (!patientId) return;
        setInserting(true);
        setInsertError(null);

        try {
            // If no target visit specified, find open notes first
            if (!targetVisitId) {
                const { data } = await api.get(`/echo/open-notes/${patientId}`);

                if (data.count === 0) {
                    setInsertError('No open notes found for today. Open a visit note first.');
                    setInserting(false);
                    return;
                }

                if (data.count > 1) {
                    // Multiple notes — show picker
                    setOpenNotes(data.notes);
                    setShowNotePicker(true);
                    setInserting(false);
                    return;
                }

                // Exactly one note — use it
                targetVisitId = data.notes[0].visitId;
            }

            // Map visualization draft keys to API keys
            const sections = {};
            for (const [section, text] of Object.entries(visualization.drafts)) {
                const key = section.toLowerCase();
                if (key === 'hpi' || key === 'history of present illness') sections.hpi = text;
                else if (key === 'ros' || key === 'review of systems') sections.ros = text;
                else if (key === 'pe' || key === 'physical exam' || key === 'physical examination') sections.pe = text;
                else if (key === 'assessment') sections.assessment = text;
                else if (key === 'plan') sections.plan = text;
                else if (key === 'chief complaint') sections.chiefComplaint = text;
                else sections[key] = text;
            }

            await api.post('/echo/write-to-note', { visitId: targetVisitId, sections });

            setInserted(true);
            setShowNotePicker(false);
            setTimeout(() => setInserted(false), 4000);

            // Trigger a reload of the visit note if currently open
            window.dispatchEvent(new CustomEvent('eko-note-updated', { detail: { visitId: targetVisitId } }));
        } catch (err) {
            console.error('[NoteDraftCard] Insert error:', err);
            setInsertError(err.response?.data?.error || 'Failed to insert into note');
        } finally {
            setInserting(false);
        }
    };

    if (!visualization?.drafts) return null;

    return (
        <div className="mt-3 space-y-2.5">
            {/* Insert all at once button */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => insertIntoNote()}
                    disabled={inserting || inserted}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all
                        ${inserted
                            ? 'bg-emerald-500 text-white'
                            : inserting
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-[0.98]'
                        }`}
                >
                    {inserted ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Inserted into Note</>
                    ) : inserting ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing...</>
                    ) : (
                        <><PenTool className="w-3.5 h-3.5" /> Insert All into Note</>
                    )}
                </button>
            </div>

            {insertError && (
                <div className="text-[10px] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    {insertError}
                </div>
            )}

            {/* Note picker modal (multiple open notes) */}
            {showNotePicker && openNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[11px] font-bold text-amber-900">Multiple open notes found — select one:</span>
                    </div>
                    {openNotes.map((note) => (
                        <button
                            key={note.visitId}
                            onClick={() => insertIntoNote(note.visitId)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[11px] group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-gray-800 group-hover:text-blue-700">{note.visitType}</span>
                                    {note.time && <span className="text-gray-400 ml-2">{note.time}</span>}
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${note.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {note.status}
                                </span>
                            </div>
                            {note.preview && (
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{note.preview}...</p>
                            )}
                        </button>
                    ))}
                    <button onClick={() => setShowNotePicker(false)} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">
                        Cancel
                    </button>
                </div>
            )}

            {/* Individual section drafts */}
            {Object.entries(visualization.drafts).map(([section, text]) => (
                <div key={section} className="bg-white rounded-xl p-3 border border-emerald-200/60 shadow-sm relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                                <PenTool className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-widest">
                                {section === 'hpi' ? 'HPI Draft' : `Draft: ${section}`}
                            </span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(section, text)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all
                                       ${copied[section]
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'text-emerald-600 hover:bg-emerald-50'}`}
                        >
                            {copied[section] ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied[section] ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="text-[12px] text-gray-700 leading-relaxed font-serif italic bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                        {text}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Diagnosis Suggestions Card ─────────────────────────────────────────────

function DiagnosisSuggestionsCard({ visualization }) {
    if (!visualization?.suggestions?.length) return null;

    return (
        <div className="mt-2 bg-amber-50/70 rounded-lg p-2.5 border border-amber-200/60">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Search className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Suggested Diagnoses
                </span>
            </div>
            <div className="space-y-1">
                {visualization.suggestions.map((dx, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 bg-white/60 rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                            <code className="text-[10px] font-mono font-bold text-amber-700 flex-shrink-0">
                                {dx.icd10_code}
                            </code>
                            <span className="text-[11px] text-gray-700 truncate">{dx.description}</span>
                        </div>
                        <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${dx.relevance === 'high' ? 'bg-amber-200 text-amber-800' :
                            dx.relevance === 'medium' ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-50 text-gray-500'
                            }`}>
                            {dx.relevance}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Write Action Card ──────────────────────────────────────────────────────

// ─── Staged Action Card (Phase 3) ───────────────────────────────────────────

function StagedActionCard({ visualization, onApprove, onReject }) {
    if (!visualization) return null;

    const iconMap = {
        add_problem: Stethoscope,
        add_medication: Pill,
        create_order: ClipboardList
    };
    const Icon = iconMap[visualization.type] || Plus;
    const isCommitted = visualization.status === 'committed';
    const isRejected = visualization.status === 'rejected';

    return (
        <div className={`mt-2.5 rounded-2xl p-3 border transition-all duration-300 relative overflow-hidden ${isCommitted
            ? 'bg-green-50/50 border-green-200'
            : isRejected
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : 'bg-white border-blue-200 shadow-sm hover:shadow-md hover:border-blue-300'
            }`}>
            {/* Background Accent */}
            {!isCommitted && !isRejected && (
                <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-blue-50 rounded-full opacity-40 blur-2xl" />
            )}

            <div className="flex items-start gap-3 relative z-10">
                <div className={`p-2 rounded-xl shadow-sm ${isCommitted ? 'bg-green-100 text-green-600' : isRejected ? 'bg-gray-50 text-gray-500' : 'bg-blue-600 text-white'}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <p className={`text-[12px] font-bold tracking-tight ${isCommitted ? 'text-green-800' : isRejected ? 'text-gray-600' : 'text-gray-900'}`}>
                            {visualization.label}
                        </p>
                        {isCommitted && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight ${isCommitted ? 'text-green-600' : 'text-gray-500'}`}>
                        {isCommitted ? 'Action successfully committed to patient chart.' : isRejected ? 'Action declined.' : visualization.message.split('\n\n**Preview:**')[0]}
                    </p>
                    {!isCommitted && !isRejected && visualization.type === 'send_message' && (
                        <div className="mt-2 bg-gray-50/50 rounded-lg p-2 border border-blue-50/50">
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Message Preview</span>
                            <p className="text-[10px] text-gray-600 italic mt-1 leading-snug line-clamp-3">
                                {visualization.payload?.body}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* DDI Warning */}
            {visualization.interactionWarning && !isCommitted && !isRejected && (
                <div className={`mt-3 p-2.5 rounded-xl border ${visualization.interactionWarning.severity === 'high'
                    ? 'bg-red-50/80 border-red-200 text-red-800'
                    : 'bg-amber-50/80 border-amber-200 text-amber-800'
                    } animate-in fade-in slide-in-from-top-1`}>
                    <div className="flex items-start gap-2">
                        <div className={`p-1 rounded-lg ${visualization.interactionWarning.severity === 'high' ? 'bg-red-200 text-red-600' : 'bg-amber-200 text-amber-600'}`}>
                            <AlertTriangle className={`w-3 h-3 ${visualization.interactionWarning.severity === 'high' ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none mt-0.5">
                                {visualization.interactionWarning.risk} — {visualization.interactionWarning.severity.toUpperCase()} RISK
                            </p>
                            <p className="text-[10px] mt-1 font-medium leading-snug opacity-90">
                                {visualization.interactionWarning.message} (Interacts with: {visualization.interactionWarning.interactsWith})
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!isCommitted && !isRejected && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                        onClick={() => onApprove(visualization)}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-[0.97]"
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => onReject(visualization)}
                        className="px-4 py-1.5 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 text-[10px] font-bold rounded-lg transition-all active:scale-[0.97]"
                    >
                        Decline
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Lab Results Card (Phase 2B) ────────────────────────────────────────────

function LabResultsCard({ visualization }) {
    if (!visualization) return null;

    // Handle both full analysis and specific interpretation
    const isFullAnalysis = !!visualization.summary;
    const results = isFullAnalysis
        ? [...(visualization.criticals || []), ...(visualization.abnormals || [])].slice(0, 8)
        : visualization.success !== undefined ? [visualization] : [];

    if (results.length === 0 && !visualization.summary) return null;

    const severityBg = {
        critical: 'bg-red-100 text-red-800 border-red-200',
        high: 'bg-orange-100 text-orange-800 border-orange-200',
        moderate: 'bg-amber-100 text-amber-700 border-amber-200',
        normal: 'bg-green-100 text-green-700 border-green-200',
        unknown: 'bg-gray-50 text-gray-600 border-gray-200'
    };

    const severityIcon = {
        critical: '🔴',
        high: '🟠',
        moderate: '🟡',
        normal: '🟢',
        unknown: '⚪'
    };

    return (
        <div className="mt-2 bg-blue-50/60 rounded-lg p-2.5 border border-blue-200/60">
            <div className="flex items-center gap-1.5 mb-1.5">
                <FlaskConical className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    {isFullAnalysis ? 'Lab Results Analysis' : 'Lab Interpretation'}
                </span>
            </div>

            {isFullAnalysis && visualization.summary && (
                <div className="text-[11px] text-blue-800 mb-2 whitespace-pre-wrap leading-relaxed">
                    {visualization.summary}
                </div>
            )}

            <div className="space-y-1.5">
                {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-gray-200/80 shadow-sm group hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-2 h-2 rounded-full ${r.severity === 'critical' ? 'bg-red-500 animate-pulse ring-4 ring-red-100' :
                                r.severity === 'high' ? 'bg-red-400' :
                                    r.severity === 'moderate' ? 'bg-amber-400' : 'bg-green-400'
                                }`} />
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-gray-700 truncate">{r.testName || r.rawTestName}</p>
                                <p className="text-[9px] text-gray-400 font-medium">Ref: {r.normalRange || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                            <span className={`text-[12px] font-bold ${r.severity === 'critical' ? 'text-red-600' :
                                r.severity === 'high' ? 'text-red-500' :
                                    r.severity === 'moderate' ? 'text-amber-600' : 'text-gray-900'
                                }`}>
                                {r.value} <small className="text-[9px] font-bold opacity-60 uppercase">{r.unit}</small>
                            </span>
                            {r.status !== 'normal' && (
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${r.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                                    }`}>
                                    {r.status.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Trends section */}
            {visualization.trends?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Activity className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Longitudinal Trends</span>
                    </div>
                    <div className="space-y-1">
                        {visualization.trends.filter(t => t.direction !== 'stable').map((t, i) => (
                            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                                <span className="text-[11px] font-bold text-gray-600">{t.testName}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold ${t.direction === 'rising' ? 'text-red-500' : 'text-blue-500'}`}>
                                        {t.direction === 'rising' ? '+' : ''}{t.percentChange}%
                                    </span>
                                    {t.direction === 'rising'
                                        ? <ArrowUpRight className="w-3 h-3 text-red-500" />
                                        : <ArrowDownRight className="w-3 h-3 text-blue-500" />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Follow-up suggestions */}
            {results.some(r => r.followUp?.length > 0) && (
                <div className="mt-2 pt-2 border-t border-blue-200/40">
                    <span className="text-[9px] font-bold text-blue-600 uppercase">Suggested Follow-up</span>
                    <ul className="mt-0.5 space-y-0.5">
                        {[...new Set(results.flatMap(r => r.followUp || []))].slice(0, 4).map((f, i) => (
                            <li key={i} className="text-[10px] text-blue-600 flex items-center gap-1">
                                <ChevronRight className="w-2.5 h-2.5" />{f}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ─── Clinical Gaps Card (Phase 2C) ──────────────────────────────────────────

function ClinicalGapsCard({ visualization }) {
    if (!visualization?.gaps?.length) return null;

    const severityColor = {
        high: 'text-red-600 border-red-200 bg-red-50/50',
        medium: 'text-amber-600 border-amber-200 bg-amber-50/50',
        low: 'text-blue-600 border-blue-200 bg-blue-50/50'
    };

    return (
        <div className="mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-200/60">
            <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                    Care Gaps & Opportunities
                </span>
            </div>
            <div className="space-y-1.5">
                {visualization.gaps.map((gap, i) => (
                    <div key={i} className={`px-2 py-1.5 rounded border text-[11px] leading-tight ${severityColor[gap.severity] || severityColor.low}`}>
                        <div className="font-bold flex items-center justify-between">
                            {gap.name}
                            <span className="text-[8px] uppercase px-1 rounded bg-white/50 border border-current opacity-70">
                                {gap.type}
                            </span>
                        </div>
                        <div className="mt-0.5 opacity-90">{gap.message}</div>
                    </div>
                ))}
            </div>
            {visualization.summary && (
                <p className="text-[9px] text-gray-400 mt-2 text-right italic">{visualization.summary}</p>
            )}
        </div>
    );
}

// ─── Risk Assessment Card (Phase 4) ─────────────────────────────────────────

function RiskAssessmentCard({ visualization }) {
    if (!visualization?.scores?.length) return null;

    return (
        <div className="mt-3 bg-white rounded-2xl p-4 border border-blue-100 shadow-sm relative overflow-hidden group">
            {/* Background Atmosphere */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-100/50 transition-colors" />

            <div className="flex items-center gap-2 mb-4 relative z-10">
                <div className="p-1.5 rounded-xl bg-blue-600 shadow-blue-200 shadow-lg">
                    <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                    <span className="text-[12px] font-bold text-gray-900 tracking-tight">Predictive Insight Engine</span>
                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest leading-none mt-0.5">Clinical Prognosis</p>
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                {visualization.scores.map((score, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-blue-200 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{score.type === 'ascvd' ? 'ASCVD 10-Year Risk' : 'CHA2DS2-VASc'}</span>
                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${score.level === 'high' || score.score >= 2 ? 'bg-red-100 text-red-600' :
                                score.level === 'intermediate' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                }`}>
                                {score.level || (score.score >= 2 ? 'Actionable' : 'Monitor')}
                            </div>
                        </div>

                        <div className="flex items-end gap-2 mb-2">
                            <span className={`text-2xl font-bold tracking-tight ${score.level === 'high' || score.score >= 2 ? 'text-red-500' : 'text-gray-900'
                                }`}>
                                {score.score}<small className="text-[10px] font-bold opacity-60 ml-0.5 uppercase">{score.unit}</small>
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2 relative">
                                <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${(score.type === 'ascvd' && score.score > 20) || (score.type === 'chads' && score.score >= 4) ? 'bg-red-500' :
                                        (score.type === 'ascvd' && score.score > 7.5) || (score.type === 'chads' && score.score >= 2) ? 'bg-amber-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.min(100, (score.score / (score.type === 'ascvd' ? 30 : 9)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <p className="text-[11px] font-medium text-gray-700 leading-snug">
                            {score.interpretation}
                        </p>
                        <div className="mt-2.5 flex items-start gap-2 p-2 rounded-xl bg-white/60 border border-blue-50">
                            <ShieldAlert className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-blue-700 leading-tight">
                                {score.recommendation}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Document Analysis Card (Phase 4) ───────────────────────────────────────

function DocumentAnalysisCard({ visualization }) {
    if (!visualization) return null;

    const docTypeLabels = {
        lab_report: 'Lab Report', referral: 'Referral Letter', imaging: 'Imaging Report',
        prescription: 'Prescription', insurance: 'Insurance Doc', other: 'Clinical Document'
    };

    const flagColors = {
        normal: 'bg-green-100 text-green-700 border-green-200',
        abnormal: 'bg-amber-100 text-amber-700 border-amber-200',
        critical: 'bg-red-100 text-red-700 border-red-200',
        info: 'bg-blue-100 text-blue-700 border-blue-200'
    };

    const flagDots = {
        normal: 'bg-green-400', abnormal: 'bg-amber-400', critical: 'bg-red-500 animate-pulse', info: 'bg-blue-400'
    };

    return (
        <div className="mt-3 bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors" />

            <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="p-1.5 rounded-xl bg-indigo-600 shadow-indigo-200 shadow-lg">
                    <FileImage className="w-4 h-4 text-white" />
                </div>
                <div>
                    <span className="text-[12px] font-bold text-gray-900 tracking-tight">
                        {docTypeLabels[visualization.document_type] || 'Document Analysis'}
                    </span>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-0.5">
                        Vision AI • {visualization.source_date || 'Date unknown'}
                    </p>
                </div>
            </div>

            {visualization.summary && (
                <p className="text-[11px] text-gray-600 mb-3 leading-relaxed relative z-10">
                    {visualization.summary}
                </p>
            )}

            {visualization.key_findings?.length > 0 && (
                <div className="space-y-1.5 relative z-10">
                    {visualization.key_findings.map((f, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full ${flagDots[f.flag] || flagDots.info}`} />
                                <span className="text-[11px] font-bold text-gray-600">{f.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-gray-800">{f.value}</span>
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${flagColors[f.flag] || flagColors.info}`}>
                                    {f.flag}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {visualization.recommendations?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 relative z-10">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Recommendations</span>
                    <ul className="mt-1.5 space-y-1">
                        {visualization.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-600">
                                <ChevronRight className="w-2.5 h-2.5 mt-0.5 text-indigo-400 flex-shrink-0" />
                                {r}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ─── Evidence Card (Phase 4) ────────────────────────────────────────────────

function EvidenceCard({ visualization }) {
    if (!visualization?.results?.length) return null;

    const categoryColors = {
        preventive: 'bg-teal-100 text-teal-700',
        chronic: 'bg-blue-100 text-blue-700'
    };

    return (
        <div className="mt-3 bg-white rounded-2xl p-4 border border-teal-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-teal-100/50 transition-colors" />

            <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="p-1.5 rounded-xl bg-teal-600 shadow-teal-200 shadow-lg">
                    <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                    <span className="text-[12px] font-bold text-gray-900 tracking-tight">Clinical Evidence</span>
                    <p className="text-[9px] font-bold text-teal-500 uppercase tracking-widest leading-none mt-0.5">
                        {visualization.count} Guideline{visualization.count !== 1 ? 's' : ''} Found
                    </p>
                </div>
            </div>

            <div className="space-y-2.5 relative z-10">
                {visualization.results.map((g, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-teal-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{g.source}</span>
                                <span className="text-[8px] font-bold text-gray-400">({g.year})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${categoryColors[g.category] || 'bg-gray-50 text-gray-500'}`}>
                                    {g.category}
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    {g.grade}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-700 leading-none mb-1">{g.topic}</p>
                        <p className="text-[10px] text-gray-600 leading-relaxed">{g.recommendation}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
// ─── Insert Into Note Button (for any assistant message) ────────────────────

function InsertIntoNoteButton({ messageContent, patientId }) {
    const [state, setState] = useState('idle'); // idle | loading | picking | inserted | error
    const [openNotes, setOpenNotes] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const location = useLocation();

    // Only show on visit note pages
    const isOnVisitPage = location.pathname.includes('/visit/');
    if (!isOnVisitPage || !patientId || !messageContent) return null;

    // Check if the message looks like it contains clinical draft content
    const text = messageContent || '';
    const hasClinicalContent = /\b(HPI|History of Present Illness|Assessment|Review of Systems|Physical Exam|ROS|PE|Plan)[\s]*:/i.test(text);
    if (!hasClinicalContent) return null;

    // Parse sections from raw text
    const parseSectionsFromText = (rawText) => {
        const sections = {};
        const patterns = [
            { key: 'hpi', regex: /(?:\*\*)?(?:HPI|History of Present Illness)(?:\*\*)?[:\s]+/i },
            { key: 'ros', regex: /(?:\*\*)?(?:ROS|Review of Systems)(?:\*\*)?[:\s]+/i },
            { key: 'pe', regex: /(?:\*\*)?(?:PE|Physical Exam(?:ination)?)(?:\*\*)?[:\s]+/i },
            { key: 'assessment', regex: /(?:\*\*)?Assessment(?:\*\*)?[:\s]+/i },
            { key: 'plan', regex: /(?:\*\*)?Plan(?:\*\*)?[:\s]+/i },
            { key: 'chiefComplaint', regex: /(?:\*\*)?(?:Chief Complaint|CC)(?:\*\*)?[:\s]+/i },
        ];

        // Find all section positions
        const found = [];
        for (const p of patterns) {
            const match = p.regex.exec(rawText);
            if (match) {
                found.push({ key: p.key, start: match.index + match[0].length, headerStart: match.index });
            }
        }

        // Sort by position
        found.sort((a, b) => a.headerStart - b.headerStart);

        // Extract content between sections
        for (let i = 0; i < found.length; i++) {
            const end = i + 1 < found.length ? found[i + 1].headerStart : rawText.length;
            const content = rawText.substring(found[i].start, end).trim();
            if (content) {
                // Clean up markdown bold markers
                sections[found[i].key] = content.replace(/\*\*/g, '').trim();
            }
        }

        return sections;
    };

    const handleInsert = async (targetVisitId = null) => {
        setState('loading');
        setErrorMsg(null);

        try {
            if (!targetVisitId) {
                const { data } = await api.get(`/echo/open-notes/${patientId}`);

                if (data.count === 0) {
                    setErrorMsg('No open notes found for today. Open a visit note first.');
                    setState('error');
                    return;
                }

                if (data.count > 1) {
                    setOpenNotes(data.notes);
                    setState('picking');
                    return;
                }

                targetVisitId = data.notes[0].visitId;
            }

            const sections = parseSectionsFromText(text);
            if (Object.keys(sections).length === 0) {
                setErrorMsg('Could not parse clinical sections from this response.');
                setState('error');
                return;
            }

            await api.post('/echo/write-to-note', { visitId: targetVisitId, sections });
            setState('inserted');
            window.dispatchEvent(new CustomEvent('eko-note-updated', { detail: { visitId: targetVisitId } }));
            setTimeout(() => setState('idle'), 5000);
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Failed to insert into note');
            setState('error');
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-100">
            {state === 'idle' && (
                <button
                    onClick={() => handleInsert()}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-sm w-full justify-center"
                >
                    <PenTool className="w-3.5 h-3.5" />
                    Insert into Note
                </button>
            )}

            {state === 'loading' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-xl text-[10px] font-bold justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Writing to note...
                </div>
            )}

            {state === 'inserted' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Inserted into Note ✓
                </div>
            )}

            {state === 'error' && (
                <div>
                    <div className="text-[10px] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 mb-1.5">
                        {errorMsg}
                    </div>
                    <button onClick={() => setState('idle')} className="text-[9px] text-gray-500 hover:text-gray-700 font-medium">
                        Try again
                    </button>
                </div>
            )}

            {state === 'picking' && openNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[11px] font-bold text-amber-900">Multiple open notes — select one:</span>
                    </div>
                    {openNotes.map((note) => (
                        <button
                            key={note.visitId}
                            onClick={() => handleInsert(note.visitId)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[11px] group"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-gray-800 group-hover:text-blue-700">{note.visitType}</span>
                                {note.time && <span className="text-gray-400">{note.time}</span>}
                            </div>
                        </button>
                    ))}
                    <button onClick={() => setState('idle')} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main Echo Panel ────────────────────────────────────────────────────────

export default function EchoPanel({ patientId, patientName }) {
    const { user } = useAuth();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [usage, setUsage] = useState(null);
    const [error, setError] = useState(null);
    const [proactiveGaps, setProactiveGaps] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [suggestion, setSuggestion] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const isPatientMode = !!patientId;

    // Navigation Observer Logic
    useEffect(() => {
        const path = location.pathname.toLowerCase();
        if (path.includes('labs') || path.includes('orders')) {
            setSuggestion({ label: 'Analyze Labs', prompt: 'Interpret the latest lab results and check for trends.' });
        } else if (path.includes('visit') || path.includes('notes')) {
            setSuggestion({ label: 'Draft SOAP Note', prompt: 'Draft the HPI and Assessment for this visit.' });
        } else if (path.includes('schedule')) {
            setSuggestion({ label: 'Day Summary', prompt: 'Give me a summary of my priority patients for today.' });
        } else {
            setSuggestion(null);
        }
    }, [location.pathname]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opening or after loading finishes
    useEffect(() => {
        if (isOpen && !isGlobalLoading) {
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isGlobalLoading]);

    // Hotkey listener for Alt key Push-to-Talk
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Alt' && isOpen) {
                e.preventDefault();
                if (!isRecording) {
                    handleStartRecording();
                }
            }
        };

        const handleGlobalKeyUp = (e) => {
            if (e.key === 'Alt') {
                handleStopRecording();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, [isOpen, isRecording]);

    // Reset on patient change
    useEffect(() => {
        setMessages([]);
        setConversationId(null);
        setError(null);
        setProactiveGaps(null);

        // Proactive clinical gap peeking
        if (patientId) {
            api.get(`/echo/gaps/${patientId}`)
                .then(res => {
                    if (res.data?.gaps?.length > 0) {
                        setProactiveGaps(res.data);
                    }
                })
                .catch(err => console.error('Silent gap check failed:', err));
        }
    }, [patientId]);

    const sendMessage = useCallback(async (messageText) => {
        const text = messageText || input.trim();
        if ((!text && attachments.length === 0) || isGlobalLoading) return;

        const currentAttachments = [...attachments];
        setInput('');
        setAttachments([]);
        setError(null);

        const userMessage = {
            role: 'user',
            content: text,
            timestamp: new Date(),
            attachments: currentAttachments.map(f => ({ name: f.name, type: f.type }))
        };
        setMessages(prev => [...prev, userMessage]);
        setIsGlobalLoading(true);

        try {
            // Convert file attachments to base64 for Vision API
            let base64Attachments = null;
            if (currentAttachments.length > 0) {
                base64Attachments = await Promise.all(
                    currentAttachments
                        .filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
                        .slice(0, 3) // Max 3 images
                        .map(file => new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const base64 = reader.result.split(',')[1];
                                resolve({ base64, mimeType: file.type, name: file.name });
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        }))
                );
            }

            const { data } = await api.post('/echo/chat', {
                message: text,
                patientId,
                conversationId,
                uiContext: window.location.pathname,
                attachments: base64Attachments
            });

            const assistantMessage = {
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                toolCalls: data.toolCalls,
                visualizations: data.visualizations,
                writeActions: data.writeActions,
                usage: data.usage
            };
            setMessages(prev => [...prev, assistantMessage]);
            setConversationId(data.conversationId);
            setUsage(data.usage);

        } catch (err) {
            console.error('[EchoPanel] Send error:', err);
            const errorMsg = err.response?.data?.error || err.message;
            setError(errorMsg);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                isError: true
            }]);
        } finally {
            setIsGlobalLoading(false);
        }
    }, [input, isGlobalLoading, patientId, conversationId, attachments]);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (audioChunksRef.current.length === 0) {
                    setIsRecording(false);
                    return;
                }
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size < 1000) { // Ignore blobs smaller than 1KB (likely silence or micro-tap)
                    setIsRecording(false);
                    return;
                }
                await handleAudioUpload(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                setRecordingTime(0);
                if (timerRef.current) clearInterval(timerRef.current);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Recording start failed:', err);
            setError('Microphone access denied or error occurred.');
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleAudioUpload = async (blob) => {
        setIsGlobalLoading(true); // Changed 'setLoading' to 'setIsGlobalLoading'
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');

            const { data } = await api.post('/echo/transcribe', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.success && data.text) {
                sendMessage(data.text);
            }
        } catch (err) {
            console.error('Transcription error:', err);
            setError('Failed to transcribe audio.');
        } finally {
            setIsGlobalLoading(false); // Changed 'setLoading' to 'setIsGlobalLoading'
        }
    };

    async function handleApproveAction(action, messageIndex) {
        // Now handles both single action objects and arrays for batch
        const actionsToCommit = Array.isArray(action) ? action : [action];

        try {
            console.log('[Echo] Committing actions:', actionsToCommit);
            const { data } = await api.post('/echo/commit', {
                actions: actionsToCommit.map(a => ({ type: a.type, payload: a.payload })),
                conversationId
            });

            if (data.success) {
                console.log('[Echo] Commit successful:', data);
                const newMessages = [...messages];
                actionsToCommit.forEach(a => {
                    const vizList = newMessages[messageIndex].visualizations;
                    const vizIndex = vizList.findIndex(v => v.action_id === a.action_id);
                    if (vizIndex !== -1) {
                        vizList[vizIndex].status = 'committed';
                    }
                });
                setMessages(newMessages);

                if (window.refreshChartData) window.refreshChartData();
            } else {
                console.error('[Echo] Commit failed:', data.error);
                alert('Approval failed: ' + (data.error || 'Unknown database error occurred.'));
            }
        } catch (err) {
            console.error('[Echo] Approve error:', err);
            // Extract the most meaningful error message
            const backendError = err.response?.data?.error;
            const axiosError = err.message;
            const finalMsg = backendError || axiosError || 'Unknown connection error';

            alert('Approval failed: ' + finalMsg);
        }
    }

    function handleRejectAction(action, messageIndex) {
        const newMessages = [...messages];
        const vizIndex = newMessages[messageIndex].visualizations.findIndex(v => v.action_id === action.action_id);
        if (vizIndex !== -1) {
            newMessages[messageIndex].visualizations[vizIndex].status = 'rejected';
            setMessages(newMessages);
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setAttachments(prev => [...prev, ...files]);
            // Logic to handle upload/processing would go here
        }
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const clearConversation = () => {
        setMessages([]);
        setConversationId(null);
        setError(null);
    };

    // Quick actions — context-aware
    const patientActions = [
        { label: 'Summarize chart', icon: FileText, prompt: 'Give me a concise summary of this patient.' },
        { label: 'BP trend', icon: TrendingUp, prompt: 'Show me the blood pressure trend for this patient.' },
        { label: 'Active meds', icon: Pill, prompt: 'List all active medications.' },
        { label: 'Draft HPI', icon: PenTool, prompt: 'Draft an HPI for a follow-up visit.' },
        { label: 'Interpret labs', icon: FlaskConical, prompt: 'Interpret all recent lab results for this patient.' },
        { label: 'Suggest Dx', icon: Stethoscope, prompt: 'Suggest diagnoses based on the chief complaint and patient history.' },
        { label: 'Clinical gaps', icon: AlertTriangle, prompt: 'Check for any clinical gaps or missing preventive care for this patient.' },
    ];

    const globalActions = [
        { label: 'Today\'s schedule', icon: Calendar, prompt: 'Show me today\'s schedule summary.' },
        { label: 'Pending notes', icon: FileText, prompt: 'How many unsigned notes do I have?' },
        { label: 'Inbox summary', icon: Inbox, prompt: 'Give me my inbox summary.' },
        { label: 'Navigate', icon: Navigation, prompt: 'Take me to the schedule.' },
    ];

    const quickActions = isPatientMode ? patientActions : globalActions;

    // ─── Render ─────────────────────────────────────────────────────────
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 z-[9999] w-12 h-12 bg-white/80 backdrop-blur-md 
                           rounded-full shadow-lg flex items-center justify-center 
                           hover:shadow-xl hover:scale-110 hover:-translate-y-1
                           transition-all duration-300 group border border-cyan-100"
                title="Open Eko"
            >
                <div className="relative">
                    <img src="/echo-mascot.png?v=1" alt="Eko" className="w-8 h-8 rounded-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" />
                    {isPatientMode && proactiveGaps && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 border-2 border-white rounded-full 
                                          animate-pulse shadow-sm" />
                    )}
                </div>
            </button>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 z-[9999] w-[340px] max-h-[620px] flex flex-col
                        bg-white/95 backdrop-blur-xl rounded-[3rem] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] 
                        border border-slate-200/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">

            {/* Ultra-Minimalist Header */}
            <div className={`px-5 py-3.5 sticky top-0 z-20 border-b transition-colors duration-500 bg-white/80 backdrop-blur-md
                            ${isPatientMode ? 'border-cyan-50' : 'border-slate-50'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 p-0.5 overflow-hidden">
                                <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover rounded-full" />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm
                                          ${isPatientMode ? 'bg-cyan-400' : 'bg-green-400'}`} />
                        </div>

                        <div className="flex flex-col">
                            <h3 className="text-[13px] font-bold text-slate-800 tracking-tight leading-none">Eko</h3>
                            <p className="text-[9px] text-slate-400 font-medium mt-1 leading-none">
                                {patientName ? 'Chart Assistant' : 'Clinical Support'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5 bg-slate-50 p-1 rounded-full border border-slate-100">
                            {conversationId && (
                                <button onClick={clearConversation}
                                    className="p-1 rounded-full text-slate-400 hover:text-cyan-600 hover:bg-white shadow-sm transition-all"
                                    title="New">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-white shadow-sm transition-all">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 min-h-[300px] max-h-[480px]
                            scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 transition-all">

                {/* Welcome State - Seamless */}
                {messages.length === 0 && (
                    <div className="flex flex-col h-full py-1">
                        <div className="text-center mb-5">
                            <div className="relative inline-block mb-2">
                                <div className="absolute -inset-1 bg-cyan-100 rounded-full blur-lg opacity-40" />
                                <div className="relative w-14 h-14 overflow-hidden rounded-full border border-slate-100 shadow-sm">
                                    <img src="/echo-mascot.png?v=1" alt="Eko Mascot"
                                        className="w-full h-full object-cover" />
                                </div>
                            </div>
                            <h2 className="text-[15px] font-bold text-slate-800 tracking-tight">
                                {isPatientMode ? `Chart Intelligence` : "Practice Intelligence"}
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">
                                Secure clinical decision support active.
                            </p>
                        </div>

                        <div className="space-y-1.5 px-3">
                            {quickActions.slice(0, 4).map((action, i) => (
                                <button key={i}
                                    onClick={() => sendMessage(action.prompt)}
                                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left 
                                                   bg-slate-50/50 border border-slate-100 hover:bg-white
                                                   hover:border-cyan-200 hover:shadow-sm
                                                   transition-all duration-200 group active:scale-[0.98]">
                                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-100 text-slate-400 group-hover:text-cyan-600 transition-colors">
                                        <action.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message list */}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-400 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-slate-100 bg-white">
                                <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className={`max-w-[85%] group relative ${msg.role === 'user'
                            ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 shadow-sm'
                            : msg.isError
                                ? 'bg-rose-50 text-rose-700 rounded-2xl rounded-tl-sm px-3.5 py-2 border border-rose-50'
                                : 'bg-white text-slate-600 rounded-2xl rounded-tl-sm px-3.5 py-2 border border-slate-100 shadow-sm'
                            }`}>

                            {msg.role === 'assistant' && !msg.isError && (
                                <div className="absolute -top-4 left-0 text-[8px] font-bold text-slate-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    Eko
                                </div>
                            )}

                            <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap font-medium">
                                {msg.role === 'assistant' ? (
                                    (msg.content || '').split(/(\*\*.*?\*\*|!!.*?!!)/g).map((part, index) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                                        }
                                        if (part.startsWith('!!') && part.endsWith('!!')) {
                                            return <span key={index} className="font-bold text-rose-500">{part.slice(2, -2)}</span>;
                                        }
                                        return part;
                                    })
                                ) : (
                                    msg.content
                                )}
                            </div>

                            {/* Visualizations Container */}
                            <div className="space-y-4">
                                {msg.visualizations?.map((viz, vi) => (
                                    <div key={vi} className="animate-in fade-in slide-in-from-top-2 duration-500 delay-150">
                                        {viz.type === 'vital_trend' && <EchoTrendChart visualization={viz} />}
                                        {viz.type === 'note_draft' && <NoteDraftCard visualization={viz} patientId={patientId} />}
                                        {viz.type === 'diagnosis_suggestions' && <DiagnosisSuggestionsCard visualization={viz} />}
                                        {(viz.type === 'lab_analysis' || viz.type === 'lab_interpretation') && <LabResultsCard visualization={viz} />}
                                        {viz.type === 'clinical_gaps' && <ClinicalGapsCard visualization={viz} />}
                                        {viz.action_id && (
                                            <StagedActionCard
                                                visualization={viz}
                                                onApprove={(v) => handleApproveAction(v, i)}
                                                onReject={(v) => handleRejectAction(v, i)}
                                            />
                                        )}
                                        {viz.type === 'risk_assessment' && <RiskAssessmentCard visualization={viz} />}
                                        {viz.type === 'document_analysis' && <DocumentAnalysisCard visualization={viz} />}
                                        {viz.type === 'guideline_evidence' && <EvidenceCard visualization={viz} />}
                                        {viz.type === 'navigation' && (
                                            <div className="mt-3 bg-cyan-50 rounded-xl p-3 border border-cyan-100 flex items-center justify-between group/nav cursor-pointer hover:bg-cyan-100/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-cyan-600 text-white shadow shadow-cyan-200">
                                                        <Navigation className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[11px] font-bold text-cyan-900 tracking-tight">
                                                            Navigate: {viz.label}
                                                        </span>
                                                        <p className="text-[9px] text-cyan-600 font-medium mt-0.5">{viz.instructions}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* System Status Indicators */}
                            {msg.role === 'assistant' && msg.toolCalls?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-50">
                                    {msg.toolCalls.map((tc, ti) => (
                                        <div key={ti} className="inline-flex items-center gap-1.5 px-2 py-1 
                                                                    rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                                            {tc.name.replace(/_/g, ' ')}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Batch Approval */}
                            {(() => {
                                const pending = (msg.visualizations || []).filter(v => v.action_id && !v.status);
                                if (pending.length > 1) {
                                    return (
                                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                            <button
                                                onClick={() => handleApproveAction(pending, i)}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Approve All ({pending.length})
                                            </button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Insert into Note (for assistant messages with clinical content) */}
                            {msg.role === 'assistant' && !msg.isError && (
                                <InsertIntoNoteButton messageContent={msg.content} patientId={patientId} />
                            )}
                        </div>
                    </div>
                ))}

                {/* Eko is Working State */}
                {isGlobalLoading && (
                    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 mt-0.5 border border-slate-100 bg-white">
                            <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover" />
                        </div>
                        <div className="bg-slate-100 text-slate-600 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2 border border-slate-200">
                            <div className="flex gap-1">
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                            </div>
                            <span className="text-[10px] font-semibold tracking-tight uppercase">Processing</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Proactive Suggestion Pill */}
            {suggestion && !isGlobalLoading && (
                <div className="px-5 py-2 -mb-2 z-10 animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <button
                        onClick={() => sendMessage(suggestion.prompt)}
                        className="w-full flex items-center justify-between px-5 py-3 bg-white border border-amber-200 rounded-[1.25rem] group 
                                   hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-50/50 to-orange-50/50 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="p-2 rounded-xl bg-amber-400 text-amber-950 shadow-lg shadow-amber-200/50 group-hover:scale-110 transition-transform">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-[12px] font-black text-amber-900 tracking-tight">{suggestion.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 group-hover:text-amber-600 transition-all relative z-10" />
                    </button>
                </div>
            )}

            {/* Ultra-Compact Input Area */}
            <div className="p-3.5 pt-0">
                <div className="bg-slate-50/80 rounded-3xl border border-slate-200 focus-within:border-cyan-500 focus-within:bg-white transition-all duration-200 group/input">

                    {/* Attachments Display */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-3 pt-3 animate-in fade-in">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-100 shadow-xs">
                                    <FileText className="w-2.5 h-2.5 text-cyan-500" />
                                    <span className="text-[8px] font-bold text-slate-500 truncate max-w-[80px]">{file.name}</span>
                                    <button onClick={() => removeAttachment(idx)} className="text-slate-300 hover:text-rose-500">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center px-1.5 py-0.5">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg" />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-full text-slate-400 hover:text-cyan-600 hover:bg-white transition-all active:scale-90"
                        >
                            <Paperclip className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex-1 px-0.5">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Eko clinical ask..."
                                disabled={isGlobalLoading}
                                rows={1}
                                className="w-full bg-transparent text-[12px] text-slate-600 placeholder-slate-400
                                       resize-none outline-none py-2.5 font-medium h-[38px] flex items-center"
                                style={{ maxHeight: '80px' }}
                            />
                        </div>

                        <div className="flex items-center gap-0.5">
                            <button
                                onMouseDown={handleStartRecording}
                                onMouseUp={handleStopRecording}
                                onMouseLeave={handleStopRecording}
                                className={`p-2 rounded-full transition-all ${isRecording
                                    ? 'bg-rose-500 text-white animate-pulse'
                                    : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
                                    }`}
                            >
                                <Mic className="w-3.5 h-3.5" />
                            </button>

                            <button
                                onClick={() => sendMessage()}
                                disabled={(!input.trim() && !isRecording) || isGlobalLoading}
                                className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center
                                       text-white disabled:opacity-30 transition-all hover:bg-cyan-700 active:scale-90"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center mt-2 opacity-0 group-hover-within/input:opacity-100 transition-opacity">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                        Alt + Record
                    </span>
                </div>
            </div>
        </div>
    );
}
