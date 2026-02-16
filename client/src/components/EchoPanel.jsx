import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, X, Send, Sparkles, Activity, ChevronDown, Loader2, TrendingUp,
    Pill, FileText, Bot, User, Navigation, BarChart3, Trash2, History,
    Stethoscope, ClipboardList, Plus, CheckCircle2, AlertTriangle, Calendar,
    Inbox, PenTool, Search, Copy, ChevronRight, Zap, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

function WriteActionCard({ action }) {
    if (!action) return null;

    const iconMap = {
        add_problem: Stethoscope,
        add_medication: Pill,
        create_order: ClipboardList
    };
    const Icon = iconMap[action.type] || Plus;

    return (
        <div className={`mt-2 rounded-lg p-2 border ${action.success
                ? 'bg-green-50/70 border-green-200/60'
                : 'bg-red-50/70 border-red-200/60'
            }`}>
            <div className="flex items-center gap-1.5">
                {action.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                )}
                <Icon className="w-3 h-3 text-slate-500" />
                <span className={`text-[11px] font-medium ${action.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {action.message}
                </span>
            </div>
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
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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
            const response = await fetch('/api/echo/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    message: text,
                    patientId,
                    conversationId
                })
            });

            if (!response.ok) {
                throw new Error(`Echo returned ${response.status}`);
            }

            const data = await response.json();

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
            setError(err.message);
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
        { label: 'Vital overview', icon: Activity, prompt: 'Analyze all vital sign trends.' },
        { label: 'Suggest Dx', icon: Stethoscope, prompt: 'Suggest diagnoses based on the chief complaint and patient history.' },
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
                className="fixed bottom-6 right-6 z-[9999] w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 
                           rounded-full shadow-lg shadow-blue-500/25 flex items-center justify-center 
                           hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 
                           transition-all duration-200 group"
                title="Open Echo AI Assistant"
            >
                <Sparkles className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
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
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        {isPatientMode ? <Bot className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">Echo</h3>
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
                    <div className="text-center py-4 space-y-3">
                        <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center border ${isPatientMode
                                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
                                : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
                            }`}>
                            {isPatientMode
                                ? <Sparkles className="w-6 h-6 text-blue-500" />
                                : <Globe className="w-6 h-6 text-slate-500" />}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-700">
                                {isPatientMode ? "Hi, I'm Echo" : "Hi, I'm Echo — Global Mode"}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {isPatientMode
                                    ? 'Ask me anything about this patient. I can also draft notes and add to the chart.'
                                    : 'Ask about your schedule, inbox, pending notes, or navigate the EMR.'}
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
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 
                                            flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-100">
                                <Bot className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                        )}
                        <div className={`max-w-[85%] ${msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md px-3 py-2'
                            : msg.isError
                                ? 'bg-red-50 text-red-700 rounded-2xl rounded-bl-md px-3 py-2 border border-red-100'
                                : 'bg-slate-50 text-slate-700 rounded-2xl rounded-bl-md px-3 py-2 border border-slate-100'
                            }`}>
                            <div className="text-[12px] leading-relaxed whitespace-pre-wrap">
                                {msg.content}
                            </div>

                            {/* Visualizations */}
                            {msg.visualizations?.map((viz, vi) => (
                                <div key={vi}>
                                    {viz.type === 'vital_trend' && <EchoTrendChart visualization={viz} />}
                                    {viz.type === 'note_draft' && <NoteDraftCard visualization={viz} />}
                                    {viz.type === 'diagnosis_suggestions' && <DiagnosisSuggestionsCard visualization={viz} />}
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
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 
                                        flex items-center justify-center flex-shrink-0 border border-blue-100">
                            <Bot className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div className="bg-slate-50 rounded-2xl rounded-bl-md px-3 py-2 border border-slate-100">
                            <div className="flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                                <span className="text-[11px] text-slate-400">Echo is thinking...</span>
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
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isPatientMode
                            ? "Ask Echo about this patient..."
                            : "Ask about schedule, inbox, or navigate..."}
                        disabled={loading}
                        rows={1}
                        className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder-slate-300
                                   resize-none outline-none max-h-[80px]"
                        style={{ fieldSizing: 'content' }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
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
