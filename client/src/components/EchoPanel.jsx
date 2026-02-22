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
        <div className="bg-white rounded-xl p-4 mt-2 border border-slate-200/60 shadow-sm transition-all hover:shadow-md group">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-colors">
                        <TrendingUp className={`w-3.5 h-3.5 ${severityColor === '#ef4444' ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <span className="text-[12px] font-bold text-slate-700 tracking-tight">{label}</span>
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
                    clinicalContext.severity === 'moderate' ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                    {clinicalContext.recommendation}
                </p>
            )}
        </div>
    );
}

// ─── Note Draft Card ────────────────────────────────────────────────────────

function NoteDraftCard({ visualization }) {
    const [copied, setCopied] = useState({});

    const copyToClipboard = (section, text) => {
        navigator.clipboard.writeText(text);
        setCopied(prev => ({ ...prev, [section]: true }));
        setTimeout(() => setCopied(prev => ({ ...prev, [section]: false })), 2000);
    };

    if (!visualization?.drafts) return null;

    return (
        <div className="mt-3 space-y-2.5">
            {Object.entries(visualization.drafts).map(([section, text]) => (
                <div key={section} className="bg-white rounded-xl p-3 border border-emerald-200/60 shadow-sm relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                                <PenTool className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">
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
                    <div className="text-[12px] text-slate-700 leading-relaxed font-serif italic bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
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
                            <span className="text-[11px] text-slate-700 truncate">{dx.description}</span>
                        </div>
                        <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${dx.relevance === 'high' ? 'bg-amber-200 text-amber-800' :
                            dx.relevance === 'medium' ? 'bg-amber-100 text-amber-600' :
                                'bg-slate-100 text-slate-500'
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
                ? 'bg-slate-50 border-slate-200 opacity-60'
                : 'bg-white border-blue-200 shadow-sm hover:shadow-md hover:border-blue-300'
            }`}>
            {/* Background Accent */}
            {!isCommitted && !isRejected && (
                <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-blue-50 rounded-full opacity-40 blur-2xl" />
            )}

            <div className="flex items-start gap-3 relative z-10">
                <div className={`p-2 rounded-xl shadow-sm ${isCommitted ? 'bg-green-100 text-green-600' : isRejected ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white'}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <p className={`text-[12px] font-black tracking-tight ${isCommitted ? 'text-green-800' : isRejected ? 'text-slate-600' : 'text-slate-900'}`}>
                            {visualization.label}
                        </p>
                        {isCommitted && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight ${isCommitted ? 'text-green-600' : 'text-slate-500'}`}>
                        {isCommitted ? 'Action successfully committed to patient chart.' : isRejected ? 'Action declined.' : visualization.message}
                    </p>
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
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">
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
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => onApprove(visualization)}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-[0.97]"
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => onReject(visualization)}
                        className="px-4 py-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 text-[10px] font-bold rounded-lg transition-all active:scale-[0.97]"
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
        unknown: 'bg-slate-100 text-slate-600 border-slate-200'
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
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-sm group hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-2 h-2 rounded-full ${r.severity === 'critical' ? 'bg-red-500 animate-pulse ring-4 ring-red-100' :
                                r.severity === 'high' ? 'bg-red-400' :
                                    r.severity === 'moderate' ? 'bg-amber-400' : 'bg-green-400'
                                }`} />
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-700 truncate">{r.testName || r.rawTestName}</p>
                                <p className="text-[9px] text-slate-400 font-medium">Ref: {r.normalRange || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                            <span className={`text-[12px] font-black ${r.severity === 'critical' ? 'text-red-600' :
                                r.severity === 'high' ? 'text-red-500' :
                                    r.severity === 'moderate' ? 'text-amber-600' : 'text-slate-900'
                                }`}>
                                {r.value} <small className="text-[9px] font-bold opacity-60 uppercase">{r.unit}</small>
                            </span>
                            {r.status !== 'normal' && (
                                <span className={`text-[8px] font-black uppercase tracking-widest ${r.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
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
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Activity className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Longitudinal Trends</span>
                    </div>
                    <div className="space-y-1">
                        {visualization.trends.filter(t => t.direction !== 'stable').map((t, i) => (
                            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600">{t.testName}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-black ${t.direction === 'rising' ? 'text-red-500' : 'text-blue-500'}`}>
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
        <div className="mt-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
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
                <p className="text-[9px] text-slate-400 mt-2 text-right italic">{visualization.summary}</p>
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
                    <span className="text-[12px] font-black text-slate-900 tracking-tight">Predictive Insight Engine</span>
                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest leading-none mt-0.5">Clinical Prognosis</p>
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                {visualization.scores.map((score, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-blue-200 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{score.type === 'ascvd' ? 'ASCVD 10-Year Risk' : 'CHA2DS2-VASc'}</span>
                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${score.level === 'high' || score.score >= 2 ? 'bg-red-100 text-red-600' :
                                score.level === 'intermediate' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                }`}>
                                {score.level || (score.score >= 2 ? 'Actionable' : 'Monitor')}
                            </div>
                        </div>

                        <div className="flex items-end gap-2 mb-2">
                            <span className={`text-2xl font-black tracking-tight ${score.level === 'high' || score.score >= 2 ? 'text-red-500' : 'text-slate-900'
                                }`}>
                                {score.score}<small className="text-[10px] font-bold opacity-60 ml-0.5 uppercase">{score.unit}</small>
                            </span>
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2 relative">
                                <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${(score.type === 'ascvd' && score.score > 20) || (score.type === 'chads' && score.score >= 4) ? 'bg-red-500' :
                                        (score.type === 'ascvd' && score.score > 7.5) || (score.type === 'chads' && score.score >= 2) ? 'bg-amber-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.min(100, (score.score / (score.type === 'ascvd' ? 30 : 9)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <p className="text-[11px] font-medium text-slate-700 leading-snug">
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
                    <span className="text-[12px] font-black text-slate-900 tracking-tight">
                        {docTypeLabels[visualization.document_type] || 'Document Analysis'}
                    </span>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-0.5">
                        Vision AI • {visualization.source_date || 'Date unknown'}
                    </p>
                </div>
            </div>

            {visualization.summary && (
                <p className="text-[11px] text-slate-600 mb-3 leading-relaxed relative z-10">
                    {visualization.summary}
                </p>
            )}

            {visualization.key_findings?.length > 0 && (
                <div className="space-y-1.5 relative z-10">
                    {visualization.key_findings.map((f, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full ${flagDots[f.flag] || flagDots.info}`} />
                                <span className="text-[11px] font-bold text-slate-600">{f.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-800">{f.value}</span>
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${flagColors[f.flag] || flagColors.info}`}>
                                    {f.flag}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {visualization.recommendations?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 relative z-10">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Recommendations</span>
                    <ul className="mt-1.5 space-y-1">
                        {visualization.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-600">
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
                    <span className="text-[12px] font-black text-slate-900 tracking-tight">Clinical Evidence</span>
                    <p className="text-[9px] font-bold text-teal-500 uppercase tracking-widest leading-none mt-0.5">
                        {visualization.count} Guideline{visualization.count !== 1 ? 's' : ''} Found
                    </p>
                </div>
            </div>

            <div className="space-y-2.5 relative z-10">
                {visualization.results.map((g, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-teal-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{g.source}</span>
                                <span className="text-[8px] font-bold text-slate-300">({g.year})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${categoryColors[g.category] || 'bg-slate-100 text-slate-500'}`}>
                                    {g.category}
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    {g.grade}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-700 leading-none mb-1">{g.topic}</p>
                        <p className="text-[10px] text-slate-600 leading-relaxed">{g.recommendation}</p>
                    </div>
                ))}
            </div>
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

    // Floating toggle button
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[9999] w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 
                           rounded-full shadow-lg shadow-blue-500/25 flex items-center justify-center 
                           hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 
                           transition-all duration-200 group border-2 border-white/20"
                title="Open Eko AI Assistant"
            >
                <img src="/echo-mascot.png?v=1" alt="Eko" className="w-10 h-10 rounded-full object-cover group-hover:scale-110 transition-transform shadow-sm" />
                {isPatientMode && proactiveGaps && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full 
                                     animate-pulse shadow-sm" />
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] w-[400px] max-h-[650px] flex flex-col
                        bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/60
                        overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 text-white sticky top-0 z-20 backdrop-blur-xl border-b
                            ${isPatientMode
                    ? 'bg-blue-600/90 border-blue-400/20'
                    : 'bg-slate-800/95 border-slate-600/30'}`}>
                <div className="flex items-center gap-2.5">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-white/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 overflow-hidden shadow-inner">
                            <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-blue-600 rounded-full shadow-sm" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-[13px] font-black tracking-tight uppercase">Eko</h3>
                            <span className="text-[7px] font-black bg-white/20 px-1 rounded-[4px] tracking-widest h-3 flex items-center">PRO</span>
                        </div>
                        <p className="text-[10px] opacity-70 font-medium leading-none mt-0.5">
                            {patientName
                                ? `Viewing ${patientName}`
                                : isPatientMode
                                    ? 'Patient Chart Mode'
                                    : 'Global Mode'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Mode indicator badge */}
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full mr-1 tracking-wider border
                                   ${isPatientMode
                            ? 'bg-blue-400/20 text-blue-50 border-blue-300/30'
                            : 'bg-slate-500/20 text-slate-100 border-slate-400/30'}`}>
                        {isPatientMode ? 'CHART' : 'GLOBAL'}
                    </span>

                    {/* Proactive Insight Badge */}
                    {isPatientMode && proactiveGaps && (
                        <button
                            onClick={() => sendMessage('Check for any clinical gaps or missing preventive care for this patient.')}
                            className="group flex items-center gap-1.5 px-2 py-0.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 rounded-full border border-amber-400/30 transition-all duration-200 animate-in fade-in zoom-in"
                        >
                            <Zap className="w-2.5 h-2.5 text-amber-300 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold">Insight</span>
                        </button>
                    )}
                    {conversationId && (
                        <button onClick={clearConversation}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="New conversation">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[440px]
                            scrollbar-thin scrollbar-thumb-slate-200">

                {/* Welcome state */}
                {messages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                        <div className="relative inline-block">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-3xl blur opacity-25 animate-pulse" />
                            <div className="relative w-24 h-24 overflow-hidden rounded-3xl border-2 border-white shadow-2xl shadow-blue-500/10">
                                <img src="/echo-mascot.png?v=1" alt="Eko Mascot"
                                    className="w-full h-full object-cover scale-[1.12]" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full shadow-sm z-10" />
                        </div>
                        <div>
                            <p className="text-base font-black text-slate-800 tracking-tight">
                                {isPatientMode ? "Hi, I'm Eko" : "Hi, I'm Eko — Global Mode"}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[240px] mx-auto mt-2">
                                {isPatientMode
                                    ? 'Ask me anything about this chart. I can analyze trends, draft HPIs, and stage medical orders.'
                                    : 'I can help you navigate the EMR, check your schedule, or manage your clinical inbox.'}
                            </p>
                        </div>
                        <div className={`grid gap-2 px-2 ${isPatientMode ? 'grid-cols-2' : 'grid-cols-2'}`}>
                            {quickActions.map((action, i) => (
                                <button key={i}
                                    onClick={() => sendMessage(action.prompt)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] 
                                                   font-semibold text-slate-600 bg-white border border-slate-200
                                                   hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200
                                                   hover:shadow-md hover:shadow-blue-500/5
                                                   transition-all duration-200 group active:scale-[0.98]">
                                    <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-blue-100 transition-colors">
                                        <action.icon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <span className="truncate">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message list */}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-0.5 border border-blue-100 shadow-sm bg-white ring-2 ring-blue-50/50">
                                <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover scale-110" />
                            </div>
                        )}
                        <div className={`max-w-[85%] group relative ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-lg shadow-blue-500/10'
                            : msg.isError
                                ? 'bg-red-50 text-red-700 rounded-2xl rounded-tl-md px-4 py-2.5 border border-red-100 shadow-sm'
                                : 'bg-white text-slate-700 rounded-2xl rounded-tl-md px-4 py-2.5 border border-slate-200/60 shadow-sm'
                            }`}>
                            <div className="text-[12px] leading-relaxed whitespace-pre-wrap">
                                {msg.role === 'assistant' ? (
                                    (msg.content || '').split(/(\*\*.*?\*\*|!!.*?!!)/g).map((part, index) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                                        }
                                        if (part.startsWith('!!') && part.endsWith('!!')) {
                                            return <span key={index} className="font-bold text-red-600">{part.slice(2, -2)}</span>;
                                        }
                                        return part;
                                    })
                                ) : (
                                    msg.content
                                )}
                            </div>

                            {/* Visualizations */}
                            {msg.visualizations?.map((viz, vi) => (
                                <div key={vi}>
                                    {viz.type === 'vital_trend' && <EchoTrendChart visualization={viz} />}
                                    {viz.type === 'note_draft' && <NoteDraftCard visualization={viz} />}
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
                                    {viz.type === 'risk_assessment' && (
                                        <RiskAssessmentCard visualization={viz} />
                                    )}
                                    {viz.type === 'document_analysis' && (
                                        <DocumentAnalysisCard visualization={viz} />
                                    )}
                                    {viz.type === 'guideline_evidence' && (
                                        <EvidenceCard visualization={viz} />
                                    )}
                                    {viz.type === 'navigation' && (
                                        <div className="mt-2 bg-blue-50 rounded-lg p-2 border border-blue-100">
                                            <div className="flex items-center gap-1.5">
                                                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[11px] font-medium text-blue-700">
                                                    Navigate to {viz.label}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-blue-500 mt-0.5">{viz.instructions}</p>
                                        </div>
                                    )}
                                </div>
                            ))}



                            {/* Tool call indicators */}
                            {msg.toolCalls?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {msg.toolCalls.map((tc, ti) => (
                                        <span key={ti} className="inline-flex items-center gap-1 px-2 py-1 
                                                                    rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                            {tc.name.includes('add_') || tc.name.includes('create_') || tc.name.includes('draft_') ? (
                                                <Zap className="w-2.5 h-2.5 text-amber-500" />
                                            ) : (
                                                <Search className="w-2.5 h-2.5 text-blue-400" />
                                            )}
                                            {tc.name.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Batch Approval Action */}
                            {(() => {
                                const pending = (msg.visualizations || []).filter(v => v.type === 'staged_action' && !v.status);
                                if (pending.length > 1) {
                                    return (
                                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
                                            <button
                                                onClick={() => handleApproveAction(pending, i)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-blue-700 transition-all"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Approve All ({pending.length})
                                            </button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                        {
                            msg.role === 'user' && (
                                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center 
                                            flex-shrink-0 mt-0.5">
                                    <User className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                            )
                        }
                    </div>
                ))}

                {/* Loading */}
                {isGlobalLoading && ( // Changed 'loading' to 'isGlobalLoading'
                    <div className="flex gap-3 animate-pulse duration-1000">
                        <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 border border-blue-200 shadow-sm bg-white ring-2 ring-blue-50 animate-bounce transition-all duration-1000">
                            <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover scale-110" />
                        </div>
                        <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 border border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 tracking-tight uppercase">Eko is working</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Proactive Suggestion Pill (Phase 3) */}
            {suggestion && !isGlobalLoading && ( // Changed 'loading' to 'isGlobalLoading'
                <div className="px-3 py-1.5 -mb-2 z-10 animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <button
                        onClick={() => sendMessage(suggestion.prompt)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-white border border-amber-200/60 rounded-xl group 
                                   hover:border-amber-400 hover:shadow-md hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-50 to-orange-50 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2.5 relative z-10">
                            <div className="p-1 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            </div>
                            <span className="text-[11px] font-extrabold text-amber-900 tracking-tight">{suggestion.label}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-1 group-hover:text-amber-600 transition-all relative z-10" />
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-1">
                {usage && (
                    <div className="flex items-center justify-between px-2 mb-1.5">
                        <span className="text-[9px] text-slate-300">
                            {usage.model} · {usage.latencyMs}ms · {usage.totalTokens} tokens
                        </span>
                    </div>
                )}
                <div className="flex flex-col gap-2 bg-slate-50 rounded-xl border border-slate-200/60 
                                focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100
                                transition-all duration-150 px-3 py-2">

                    {/* Attachment Pills */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 group">
                                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-[10px] font-bold text-blue-800 truncate max-w-[120px]">{file.name}</span>
                                    <button
                                        onClick={() => removeAttachment(idx)}
                                        className="text-blue-300 hover:text-blue-600 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 group"
                            title="Attach Clinical Document"
                        >
                            <Paperclip className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        </button>
                        <button
                            onMouseDown={handleStartRecording}
                            onMouseUp={handleStopRecording}
                            onMouseLeave={handleStopRecording}
                            className={`p-2.5 rounded-2xl transition-all active:scale-95 group ${isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                            title="Hold to Record"
                        >
                            <Mic className={`w-5 h-5 ${isRecording ? 'animate-bounce' : ''}`} />
                        </button>

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isPatientMode
                                ? "Ask Eko... (Hold Alt to talk)"
                                : "Ask Eko or navigate... (Hold Alt to talk)"}
                            disabled={isGlobalLoading}
                            rows={1}
                            className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder-slate-300
                                   resize-none outline-none max-h-[80px]"
                            style={{ fieldSizing: 'content' }}
                        />

                        <button
                            onClick={() => sendMessage()}
                            disabled={(!input.trim() && !isRecording) || isGlobalLoading}
                            className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center 
                                   text-white shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:bg-slate-300
                                   hover:bg-blue-700 transition-all active:scale-95 flex-shrink-0"
                        >
                            <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5" />
                        </button>
                    </div>
                    {!isRecording && (
                        <div className="flex justify-center mt-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                                💡 Tip: Hold <kbd className="bg-slate-100 border border-slate-300 px-1 rounded text-[9px] font-sans">Alt</kbd> to talk
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
