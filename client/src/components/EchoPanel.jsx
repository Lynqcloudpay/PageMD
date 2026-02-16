import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, X, Send, Sparkles, Activity, ChevronDown, Loader2, TrendingUp,
    Pill, FileText, Bot, User, Navigation, BarChart3, Trash2, History,
    Stethoscope, ClipboardList, Plus, CheckCircle2, AlertTriangle, Calendar,
    Inbox, PenTool, Search, Copy, ChevronRight, Zap, Globe, FlaskConical, ArrowUpRight, ArrowDownRight,
    Mic, Square
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

    return (
        <div className="bg-slate-50 rounded-lg p-3 mt-2 border border-slate-200/60">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                {stats?.trend && stats.trend !== 'stable' && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stats.trend === 'rising' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                        {stats.trend === 'rising' ? '↑ Rising' : '↓ Falling'}
                    </span>
                )}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: '140px' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padding.top + chartH * (1 - pct);
                    const val = Math.round(minVal + (maxVal - minVal) * pct);
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                stroke="#e2e8f0" strokeWidth="0.5" />
                            <text x={padding.left - 4} y={y + 3} textAnchor="end"
                                className="text-[8px]" fill="#94a3b8">{val}</text>
                        </g>
                    );
                })}

                {chartConfig?.thresholds?.map((t, i) => {
                    if (t.value >= minVal && t.value <= maxVal) {
                        const y = scaleY(t.value);
                        return (
                            <g key={`t-${i}`}>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                    stroke={t.color} strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
                                <text x={width - padding.right + 2} y={y + 3}
                                    className="text-[7px]" fill={t.color}>{t.label}</text>
                            </g>
                        );
                    }
                    return null;
                })}

                <path d={pathD} fill="none" stroke={severityColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

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
        <div className="mt-2 space-y-2">
            {Object.entries(visualization.drafts).map(([section, text]) => (
                <div key={section} className="bg-emerald-50/70 rounded-lg p-2.5 border border-emerald-200/60">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <PenTool className="w-3 h-3 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                {section === 'hpi' ? 'HPI' : section.charAt(0).toUpperCase() + section.slice(1)}
                            </span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(section, text)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
                                       text-emerald-600 hover:bg-emerald-100 transition-colors"
                        >
                            {copied[section] ? (
                                <><CheckCircle2 className="w-2.5 h-2.5" /> Copied</>
                            ) : (
                                <><Copy className="w-2.5 h-2.5" /> Copy</>
                            )}
                        </button>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed whitespace-pre-wrap">
                        {text}
                    </p>
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
        <div className={`mt-2 rounded-lg p-2.5 border transition-all duration-200 ${isCommitted
            ? 'bg-green-50 border-green-200 shadow-sm'
            : isRejected
                ? 'bg-slate-50 border-slate-200 opacity-60'
                : 'bg-blue-50/80 border-blue-200 shadow-sm'
            }`}>
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isCommitted ? 'bg-green-100' : isRejected ? 'bg-slate-100' : 'bg-blue-100'}`}>
                    <Icon className={`w-3.5 h-3.5 ${isCommitted ? 'text-green-600' : isRejected ? 'text-slate-500' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${isCommitted ? 'text-green-800' : isRejected ? 'text-slate-600' : 'text-blue-800'}`}>
                        {visualization.label}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {isCommitted ? '✅ Action successfully committed to chart.' : isRejected ? 'Action declined.' : visualization.message}
                    </p>
                </div>
            </div>

            {/* DDI Warning */}
            {visualization.interactionWarning && !isCommitted && !isRejected && (
                <div className={`mt-2 p-2 rounded-md border ${visualization.interactionWarning.severity === 'high'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                    } animate-in fade-in slide-in-from-top-1`}>
                    <div className="flex items-start gap-1.5">
                        <AlertTriangle className={`w-3 h-3 mt-0.5 ${visualization.interactionWarning.severity === 'high' ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider">
                                {visualization.interactionWarning.risk} — {visualization.interactionWarning.severity.toUpperCase()} RISK
                            </p>
                            <p className="text-[10px] mt-0.5 leading-snug">
                                {visualization.interactionWarning.message} (Interacts with: {visualization.interactionWarning.interactsWith})
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!isCommitted && !isRejected && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-100/50">
                    <button
                        onClick={() => onApprove(visualization)}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md shadow-sm transition-colors"
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => onReject(visualization)}
                        className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[10px] font-medium rounded-md transition-colors"
                    >
                        Reject
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

            <div className="space-y-1">
                {results.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border ${severityBg[r.severity] || severityBg.unknown
                        }`}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-[10px]">{severityIcon[r.severity] || '⚪'}</span>
                            <span className="text-[11px] font-medium truncate">
                                {r.testName || r.rawTestName}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-bold">
                                {r.value}{r.unit ? ` ${r.unit}` : ''}
                            </span>
                            <span className="text-[9px] opacity-70">
                                {r.normalRange && r.normalRange !== 'N/A' ? `(${r.normalRange})` : ''}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Trends section */}
            {visualization.trends?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200/40">
                    <span className="text-[9px] font-bold text-blue-600 uppercase">Trends</span>
                    <div className="space-y-0.5 mt-1">
                        {visualization.trends.filter(t => t.direction !== 'stable').map((t, i) => (
                            <div key={i} className="flex items-center gap-1 text-[10px]">
                                {t.direction === 'rising'
                                    ? <ArrowUpRight className="w-3 h-3 text-red-500" />
                                    : <ArrowDownRight className="w-3 h-3 text-blue-500" />
                                }
                                <span className="text-blue-700">
                                    {t.testName}: {t.direction} {Math.abs(t.percentChange)}% ({t.period})
                                </span>
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

// ─── Main Echo Panel ────────────────────────────────────────────────────────

export default function EchoPanel({ patientId, patientName }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [usage, setUsage] = useState(null);
    const [error, setError] = useState(null);
    const [proactiveGaps, setProactiveGaps] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const isPatientMode = !!patientId;

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

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
        if (!text || loading) return;

        setInput('');
        setError(null);

        const userMessage = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setLoading(true);

        try {
            const { data } = await api.post('/echo/chat', {
                message: text,
                patientId,
                conversationId
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
            setLoading(false);
        }
    }, [input, loading, patientId, conversationId]);

    const startRecording = async () => {
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
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleAudioUpload = async (blob) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');

            const { data } = await api.post('/echo/transcribe', formData);

            if (data.success && data.text) {
                sendMessage(data.text);
            }
        } catch (err) {
            console.error('Transcription error:', err);
            setError('Failed to transcribe audio.');
        } finally {
            setLoading(false);
        }
    };

    async function handleApproveAction(action, messageIndex) {
        // Now handles both single action objects and arrays for batch
        const actionsToCommit = Array.isArray(action) ? action : [action];

        try {
            const { data } = await api.post('/echo/commit', {
                actions: actionsToCommit.map(a => ({ type: a.type, payload: a.payload })),
                conversationId
            });

            if (data.success) {
                const newMessages = [...messages];
                actionsToCommit.forEach(a => {
                    const vizIndex = newMessages[messageIndex].visualizations.findIndex(v => v.action_id === a.action_id);
                    if (vizIndex !== -1) {
                        newMessages[messageIndex].visualizations[vizIndex].status = 'committed';
                    }
                });
                setMessages(newMessages);

                if (window.refreshChartData) window.refreshChartData();
            } else {
                alert('Approval failed: ' + data.error);
            }
        } catch (err) {
            console.error('Approve error:', err);
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
            <div className={`flex items-center justify-between px-4 py-3 text-white
                            ${isPatientMode
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    : 'bg-gradient-to-r from-slate-700 to-slate-800'}`}>
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/10 overflow-hidden shadow-inner">
                        <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover scale-110" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold tracking-tight uppercase">Eko</h3>
                        <p className="text-[10px] opacity-80">
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
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mr-1 ${isPatientMode ? 'bg-blue-400/30 text-blue-100' : 'bg-slate-500/30 text-slate-300'
                        }`}>
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
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] 
                                                   font-medium text-slate-500 bg-slate-50 border border-slate-100
                                                   hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100
                                                   transition-all duration-150">
                                    <action.icon className="w-3.5 h-3.5" />
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message list */}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 mt-0.5 border border-blue-100 shadow-sm bg-blue-50">
                                <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover scale-110" />
                            </div>
                        )}
                        <div className={`max-w-[85%] ${msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md px-3 py-2'
                            : msg.isError
                                ? 'bg-red-50 text-red-700 rounded-2xl rounded-bl-md px-3 py-2 border border-red-100'
                                : 'bg-slate-50 text-slate-700 rounded-2xl rounded-bl-md px-3 py-2 border border-slate-100'
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

                            {/* Write Actions */}
                            {msg.writeActions?.map((wa, wi) => (
                                <WriteActionCard key={wi} action={wa} />
                            ))}

                            {/* Tool call indicators */}
                            {msg.toolCalls?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {msg.toolCalls.map((tc, ti) => (
                                        <span key={ti} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 
                                                                    rounded-full bg-slate-100 text-[9px] text-slate-400">
                                            {tc.name.includes('add_') || tc.name.includes('create_') ? (
                                                <Zap className="w-2.5 h-2.5 text-amber-500" />
                                            ) : (
                                                <BarChart3 className="w-2.5 h-2.5" />
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
                        {msg.role === 'user' && (
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center 
                                            flex-shrink-0 mt-0.5">
                                <User className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading */}
                {loading && (
                    <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-blue-100 shadow-sm bg-blue-50">
                            <img src="/echo-mascot.png?v=1" alt="Eko" className="w-full h-full object-cover animate-pulse scale-110" />
                        </div>
                        <div className="bg-slate-50 rounded-2xl rounded-bl-md px-3 py-2 border border-slate-100">
                            <div className="flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                                <span className="text-[11px] text-slate-400">Eko is thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-1">
                {usage && (
                    <div className="flex items-center justify-between px-2 mb-1.5">
                        <span className="text-[9px] text-slate-300">
                            {usage.model} · {usage.latencyMs}ms · {usage.totalTokens} tokens
                        </span>
                    </div>
                )}
                <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200/60 
                                focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100
                                transition-all duration-150 px-3 py-2">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0
                                   ${isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                        title={isRecording ? 'Stop Recording' : 'Start Dictation'}
                    >
                        {isRecording ? <Square className="w-3 h-3" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                    {isRecording ? (
                        <div className="flex-1 flex items-center px-2 py-1">
                            <span className="text-[11px] font-bold text-red-500 animate-pulse">
                                Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    ) : (
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isPatientMode
                                ? "Ask Eko about this patient..."
                                : "Ask about schedule, inbox, or navigate..."}
                            disabled={loading}
                            rows={1}
                            className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder-slate-300
                                   resize-none outline-none max-h-[80px]"
                            style={{ fieldSizing: 'content' }}
                        />
                    )}
                    <button
                        onClick={() => sendMessage()}
                        disabled={(!input.trim() && !isRecording) || loading}
                        className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center 
                                   text-white disabled:opacity-30 disabled:bg-slate-300
                                   hover:bg-blue-600 transition-colors flex-shrink-0"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
