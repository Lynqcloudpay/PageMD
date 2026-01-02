import React, { useState, useEffect } from 'react';
import {
    Eye, X, Lock, Activity, FlaskConical, FileImage,
    Heart, Waves, Stethoscope, FileText, RefreshCw, AlertCircle, Clock, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid
} from 'recharts';
import PatientHeaderPhoto from './PatientHeaderPhoto';
import { ordersAPI, documentsAPI, patientsAPI } from '../services/api';

const decodeHtmlEntities = (text) => {
    if (typeof text !== 'string') return String(text || '');
    let str = text;
    if (typeof document !== 'undefined') {
        const txt = document.createElement('textarea');
        for (let i = 0; i < 4; i++) {
            const prev = str;
            txt.innerHTML = str;
            str = txt.value;
            str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/');
            if (str === prev) break;
        }
    }
    return str;
};

const ChartReviewModal = ({
    isOpen,
    onClose,
    visits = [],
    patientData = {},
    onViewFullChart,
    onOpenVisit,
    isLoading = false
}) => {
    const [activeTab, setActiveTab] = useState('Summary');
    const [selectedVisitId, setSelectedVisitId] = useState(null);
    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Filter keywords helper
    const getFilterKeywords = (type) => {
        switch (type) {
            case 'Labs': return ['lab', 'blood', 'urine', 'panel', 'culture', 'bmp', 'cmp', 'cbc'];
            case 'Imaging': return ['x-ray', 'ct', 'mri', 'ultrasound', 'scan', 'radiology', 'imaging'];
            case 'Echo': return ['echo', 'tte', 'tee', 'echocardiogram'];
            case 'EKG': return ['ekg', 'ecg', 'electrocardiogram'];
            case 'Cath': return ['cath', 'angiogram', 'pci', 'coronary'];
            case 'Stress': return ['stress', 'exercise', 'nuclear', 'treadmill'];
            default: return [];
        }
    };

    // Load records when modal opens or patient changes
    useEffect(() => {
        if (isOpen && patientData?.id) {
            loadRecords(patientData.id);
            setSelectedItem(null);
        }
    }, [isOpen, patientData?.id]);

    const loadRecords = async (patientId) => {
        setRecordsLoading(true);
        setRecordsError(null);
        try {
            const [ordersRes, docsRes, fullPatientRes] = await Promise.allSettled([
                ordersAPI.getByPatient(patientId),
                documentsAPI.getByPatient(patientId),
                patientsAPI.get(patientId)
            ]);

            let combinedItems = [];

            // 1. Mother Chart Data
            if (fullPatientRes.status === 'fulfilled' && fullPatientRes.value.data) {
                const pData = fullPatientRes.value.data;
                // Helper to map robustly
                const mapRecord = (list, type, defaultLabel) => {
                    if (!Array.isArray(list)) return [];
                    return list.map((item, idx) => ({
                        id: `pat-${type}-${item.id || idx}`,
                        category: type,
                        type: 'record',
                        title: item.type || item.name || item.study_type || defaultLabel,
                        description: item.result || item.impression || item.summary || 'See full chart',
                        date: item.date || item.created_at || item.study_date,
                        status: 'Completed',
                        source: item
                    }));
                };

                combinedItems = [
                    ...combinedItems,
                    ...mapRecord(pData.labs, 'Labs', 'Lab Result'),
                    ...mapRecord(pData.imaging, 'Imaging', 'Imaging Result'),
                    ...mapRecord(pData.echos, 'Echo', 'Echo Report'),
                    ...mapRecord(pData.ekgs || pData.ekg, 'EKG', 'EKG Report'),
                    ...mapRecord(pData.cardiac_caths || pData.caths, 'Cath', 'Cath Report'),
                    ...mapRecord(pData.stress_tests, 'Stress', 'Stress Test')
                ];
            }

            // 2. Orders
            if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
                const orders = ordersRes.value.data.map(o => {
                    // Try to guess category
                    let category = 'Other';
                    const text = (o.name + ' ' + o.description + ' ' + o.type).toLowerCase();
                    if (getFilterKeywords('Labs').some(k => text.includes(k))) category = 'Labs';
                    else if (getFilterKeywords('Imaging').some(k => text.includes(k))) category = 'Imaging';
                    else if (getFilterKeywords('Echo').some(k => text.includes(k))) category = 'Echo';
                    else if (getFilterKeywords('EKG').some(k => text.includes(k))) category = 'EKG';
                    else if (getFilterKeywords('Cath').some(k => text.includes(k))) category = 'Cath';
                    else if (getFilterKeywords('Stress').some(k => text.includes(k))) category = 'Stress';

                    return {
                        id: `ord-${o.id}`,
                        category,
                        type: 'order',
                        title: o.name || o.description || 'Untitled Order',
                        description: o.description,
                        date: o.created_at || o.order_date,
                        status: o.status,
                        source: o
                    };
                });
                combinedItems = [...combinedItems, ...orders];
            }

            // 3. Documents
            if (docsRes.status === 'fulfilled' && docsRes.value.data) {
                const docs = docsRes.value.data.map(d => {
                    let category = 'Docs';
                    const docType = (d.doc_type || '').toLowerCase();
                    const tags = Array.isArray(d.tags) ? d.tags : [];
                    const comment = d.comment || '';
                    const text = (d.filename + ' ' + comment + ' ' + docType + ' ' + tags.join(' ')).toLowerCase();

                    if (getFilterKeywords('Labs').some(k => text.includes(k))) category = 'Labs';
                    else if (getFilterKeywords('Echo').some(k => text.includes(k)) || docType === 'echo') category = 'Echo';
                    else if (getFilterKeywords('EKG').some(k => text.includes(k)) || docType === 'ekg') category = 'EKG';
                    else if (getFilterKeywords('Cath').some(k => text.includes(k)) || docType === 'cardiac_cath') category = 'Cath';
                    else if (getFilterKeywords('Stress').some(k => text.includes(k)) || docType === 'stress') category = 'Stress';
                    else if (getFilterKeywords('Imaging').some(k => text.includes(k))) category = 'Imaging';

                    const interpretationTag = tags.find(t => t.startsWith('interpretation:'));
                    const interpretation = interpretationTag ? interpretationTag.replace('interpretation:', '') : null;

                    return {
                        id: `doc-${d.id}`,
                        category,
                        type: 'document',
                        title: d.filename || 'Untitled Document',
                        description: interpretation ? `Interpretation: ${interpretation}` : (comment || d.filename),
                        date: d.created_at || d.uploaded_at,
                        status: 'Uploaded',
                        source: d
                    };
                });
                combinedItems = [...combinedItems, ...docs];
            }

            // Sort
            combinedItems.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setRecords(combinedItems);

        } catch (err) {
            console.error('Error loading chart records:', err);
            setRecordsError('Failed to load chart records.');
        } finally {
            setRecordsLoading(false);
        }
    };


    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab('Summary');
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

    const renderSummaryTab = () => {
        // Data prep for Summary
        const vitalsTrendData = [...visits].reverse().map(v => {
            let vitals = v.vitals || {};
            if (typeof vitals === 'string') {
                try { vitals = JSON.parse(vitals); } catch (e) { vitals = {}; }
            }
            const bp = vitals.bp || (vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : '');
            const sys = parseInt(vitals.systolic || (typeof bp === 'string' ? bp.split('/')[0] : 0)) || 0;
            const hr = parseInt(vitals.pulse || vitals.hr || 0) || 0;
            const spo2 = parseInt(vitals.o2sat || vitals.spo2 || 0) || 0;

            return {
                name: format(new Date(v.visit_date), 'MM/dd'),
                hr: hr || null,
                sys: sys || null,
                spo2: spo2 || null
            };
        }).filter(d => d.hr !== null || d.sys !== null);

        const latestVitals = vitalsTrendData[vitalsTrendData.length - 1] || { hr: '--', sys: '--', spo2: '--' };

        const timelineItems = [
            ...visits.map(v => ({
                id: `v-${v.id}`,
                time: format(new Date(v.visit_date), 'h:mm a'),
                date: v.visit_date,
                title: v.visit_type?.replace('_', ' ') || 'Office Visit',
                subtitle: v.provider_last_name || 'MD',
                color: 'bg-emerald-500'
            })),
            ...records.slice(0, 10).map(r => ({
                id: r.id,
                time: format(new Date(r.date || 0), 'h:mm a'),
                date: r.date,
                title: r.title,
                subtitle: r.category,
                color: r.type === 'order' ? 'bg-blue-500' : 'bg-amber-500'
            }))
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return (
            <div className="flex-1 bg-slate-50 overflow-y-auto custom-scrollbar p-4">
                <div className="max-w-3xl mx-auto space-y-4 text-left">
                    {/* Compact Patient Header */}
                    <div className="relative p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="relative">
                            <PatientHeaderPhoto
                                firstName={patientData.first_name}
                                lastName={patientData.last_name}
                                photoUrl={patientData.photo_url}
                                className="w-14 h-14 text-lg shadow-md border-2 border-white ring-4 ring-blue-50"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-900">
                                {patientData.first_name} {patientData.last_name}
                            </h2>
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                <span>ID #{patientData.id || '---'}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                <span className="text-blue-600">Summary</span>
                            </div>
                        </div>
                        <RefreshCw className="w-4 h-4 text-slate-300 hover:text-slate-500 cursor-pointer transition-colors" onClick={() => loadRecords(patientData.id)} />
                    </div>

                    {/* Compact Vitals Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'HEART RATE', value: latestVitals.hr, unit: 'bpm', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                            { label: 'BP SYSTOLIC', value: latestVitals.sys, unit: 'mmHg', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                            { label: 'SPO2', value: latestVitals.spo2, unit: '%', icon: Waves, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' }
                        ].map((stat, i) => (
                            <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color} border ${stat.border}`}>
                                        <stat.icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 tracking-wider">{stat.label}</div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                                    <span className="text-[10px] font-medium text-slate-400">{stat.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Compact Trend Chart */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Clinical Monitoring</h3>
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Visit-over-visit trends</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    <span className="text-[9px] font-bold text-slate-400">HR</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                    <span className="text-[9px] font-bold text-slate-400">BP</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                                    <span className="text-[9px] font-bold text-slate-400">O2</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ width: '100%', height: 180 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={vitalsTrendData.length > 0 ? vitalsTrendData : [{ name: 'No Data', hr: 0, sys: 0, spo2: 0 }]}>
                                    <defs>
                                        <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="bpGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="o2Gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 9 }}
                                        domain={[0, 'auto']}
                                        width={30}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            padding: '8px',
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="hr"
                                        name="Heart Rate"
                                        stroke="#f43f5e"
                                        strokeWidth={2}
                                        fill="url(#hrGradient)"
                                        dot={{ fill: '#f43f5e', r: 3, strokeWidth: 0 }}
                                        connectNulls
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sys"
                                        name="BP Systolic"
                                        stroke="#2563eb"
                                        strokeWidth={2}
                                        fill="url(#bpGradient)"
                                        dot={{ fill: '#2563eb', r: 3, strokeWidth: 0 }}
                                        connectNulls
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="spo2"
                                        name="SpO2"
                                        stroke="#059669"
                                        strokeWidth={2}
                                        fill="url(#o2Gradient)"
                                        dot={{ fill: '#059669', r: 3, strokeWidth: 0 }}
                                        connectNulls
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Compact Timeline */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Timeline</h3>
                        <div className="space-y-3 relative ml-2">
                            <div className="absolute top-0 bottom-0 left-[5px] w-0.5 bg-slate-100"></div>

                            {timelineItems.length > 0 ? timelineItems.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex gap-4 items-center relative group">
                                    <div className={`w-3 h-3 rounded-full ${item.color} border-2 border-white shadow-sm z-10 shrink-0`}></div>
                                    <div className="flex-1 flex items-center justify-between bg-slate-50 hover:bg-white px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer">
                                        <div>
                                            <div className="font-medium text-slate-900 text-xs">{item.title}</div>
                                            <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                                        </div>
                                        <div className="text-[9px] font-medium text-slate-400">{item.time}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-8 text-center text-slate-400 font-medium text-xs">
                                    No activity recorded
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderNotesTab = () => {
        const selectedVisit = visits.find(v => v.id === selectedVisitId) || visits[0];
        if (!selectedVisit) return <div className="text-center text-slate-400 py-12 font-bold uppercase tracking-widest text-xs">No visits recorded</div>;

        const noteText = typeof selectedVisit.note_draft === 'string' ? selectedVisit.note_draft : (selectedVisit.fullNote || '');
        const decoded = decodeHtmlEntities(noteText);

        const ccMatch = String(decoded).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History):|$)/is);
        const hpiMatch = String(decoded).match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment):|$)/is);
        const assessmentMatch = String(decoded).match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
        const planMatch = String(decoded).match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|Follow):|$)/is);

        return (
            <div className="flex flex-1 overflow-hidden bg-white text-left">
                {/* Visit History Sidebar */}
                <div className="w-64 border-r border-slate-100 bg-slate-50/50 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex-shrink-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Encounter History</div>
                        <div className="text-xs font-bold text-slate-500">{visits.length} Recorded Visits</div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {visits.map((visit) => {
                            const date = visit.visit_date ? new Date(visit.visit_date) : new Date();
                            const isActive = selectedVisitId === visit.id;

                            return (
                                <button
                                    key={visit.id}
                                    onClick={() => setSelectedVisitId(visit.id)}
                                    className={`w-full text-left p-4 border-b border-slate-100 transition-all ${isActive
                                        ? 'bg-white border-l-4 border-l-blue-600 shadow-sm'
                                        : 'hover:bg-white/60'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-black ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {format(date, 'MMM d, yyyy')}
                                        </span>
                                        {(visit.locked || visit.signed) && <Lock className="w-3 h-3 text-slate-300" />}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                        {visit.visit_type?.replace('_', ' ') || 'Office Visit'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Clinical Note Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-12">
                    <div className="max-w-3xl">
                        <div className="flex items-center justify-between pb-8 border-b border-slate-100 mb-10">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 leading-tight">
                                    Clinical Encounter Note
                                </h1>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm font-bold text-blue-600">
                                        {format(new Date(selectedVisit.visit_date), 'MMMM d, yyyy')}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                    <span className="text-sm font-medium text-slate-400">
                                        Dr. {selectedVisit.provider_last_name || 'MD'}
                                    </span>
                                </div>
                            </div>
                            {onOpenVisit && (
                                <button
                                    onClick={() => onOpenVisit(selectedVisit.id)}
                                    className="px-6 py-2.5 bg-slate-50 text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
                                >
                                    Edit Case
                                </button>
                            )}
                        </div>

                        <div className="space-y-12">
                            {/* CC Section */}
                            <div className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100/50">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Reason for Visit</h4>
                                <div className="text-xl font-bold text-blue-900 leading-relaxed italic">
                                    "{ccMatch ? ccMatch[1].trim() : 'Not documented'}"
                                </div>
                            </div>

                            {/* HPI Section */}
                            {hpiMatch && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">History of Present Illness</h4>
                                    <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                        {hpiMatch[1].trim()}
                                    </div>
                                </div>
                            )}

                            {/* Assessment & Plan */}
                            <div className="grid grid-cols-2 gap-8 pt-6">
                                {assessmentMatch && (
                                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-4">Clinical Assessment</h4>
                                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-bold">
                                            {assessmentMatch[1].trim()}
                                        </div>
                                    </div>
                                )}
                                {planMatch && (
                                    <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                                        <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-4">Treatment Plan</h4>
                                        <div className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap font-bold">
                                            {planMatch[1].trim()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="w-64 border-l border-slate-100 bg-slate-50/30 p-6 overflow-y-auto custom-scrollbar h-full">
                    <div className="space-y-10">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Conditions</h4>
                            <div className="space-y-3">
                                {(patientData?.problems || []).filter(p => p.status === 'active').slice(0, 5).map((p, i) => (
                                    <div key={i} className="text-xs font-bold text-slate-700 flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
                                        <span>{decodeHtmlEntities(p.problem_name || p.name)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Medications</h4>
                            <div className="space-y-3">
                                {(patientData?.medications || []).filter(m => m.active !== false).slice(0, 5).map((m, i) => (
                                    <div key={i} className="text-xs font-medium text-slate-600">
                                        {decodeHtmlEntities(m.medication_name || m.name)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Allergies</h4>
                            {(patientData?.allergies || []).length > 0 ? (
                                <div className="space-y-2">
                                    {patientData.allergies.map((a, i) => (
                                        <div key={i} className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg border border-rose-100 inline-block mr-2">
                                            {decodeHtmlEntities(a.allergen || a.name)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">NKDA</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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

                                    const rawBP = v.bp || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '-');
                                    const bp = decodeHtmlEntities(rawBP);
                                    const hr = v.pulse || v.hr || '-';
                                    const temp = v.temp ? `${v.temp}` : '-';
                                    const rr = v.resp || v.rr || '-';
                                    const o2 = v.o2sat || v.spo2 ? `${v.o2sat || v.spo2}%` : '-';
                                    const bmi = v.bmi || '-';
                                    const weight = v.weight ? `${v.weight} ${v.weightUnit || 'lbs'}` : '-';

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

    // Document Preview Component
    const DocumentPreview = ({ item, onClose }) => {
        const [src, setSrc] = useState(null);
        const [mimeType, setMimeType] = useState(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            let currentUrl = null;
            if (item.type === 'document' && item.source?.id) {
                setLoading(true);
                documentsAPI.getFile(item.source.id).then(res => {
                    const blob = res.data;
                    const url = URL.createObjectURL(blob);
                    currentUrl = url;
                    setSrc(url);
                    setMimeType(item.source.mime_type || blob.type);
                }).catch(err => {
                    console.error("Error loading document:", err);
                }).finally(() => {
                    setLoading(false);
                });
            }
            return () => {
                if (currentUrl) URL.revokeObjectURL(currentUrl);
            };
        }, [item.id, item.source?.id]);

        const tags = Array.isArray(item.source?.tags) ? item.source.tags : [];
        const interpretationTag = tags.find(t => t.startsWith('interpretation:'));
        const interpretation = interpretationTag ? interpretationTag.replace('interpretation:', '') : null;

        const metrics = tags.filter(t => t.includes(':') && !t.startsWith('interpretation:') && !t.startsWith('date:'))
            .map(t => {
                const [key, ...valParts] = t.split(':');
                const value = valParts.join(':');
                const label = key.replace(/_/g, ' ').toUpperCase();
                return { label, value };
            });

        return (
            <div className="flex-1 flex flex-col bg-slate-50 border-l border-slate-200 overflow-auto custom-scrollbar">
                <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                    <div>
                        <h4 className="font-bold text-slate-900">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {item.date ? format(new Date(item.date), 'MMMM dd, yyyy') : 'No Date'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1">
                    {item.type === 'document' ? (
                        <div className="h-full flex flex-col space-y-6">
                            {loading ? (
                                <div className="h-64 flex items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200">
                                    <div className="flex flex-col items-center animate-pulse">
                                        <FileImage className="w-12 h-12 text-slate-200 mb-2" />
                                        <span className="text-xs text-slate-400 font-bold uppercase">Loading Document...</span>
                                    </div>
                                </div>
                            ) : src ? (
                                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                                    <div className="flex-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden min-h-[400px]">
                                        {mimeType?.startsWith('image/') ? (
                                            <div className="h-full overflow-auto custom-scrollbar flex items-center justify-center bg-slate-100/50 rounded-xl">
                                                <img
                                                    src={src}
                                                    className="max-w-full h-auto rounded-lg shadow-lg cursor-zoom-in"
                                                    alt="Document"
                                                    onClick={() => window.open(src, '_blank')}
                                                />
                                            </div>
                                        ) : (
                                            <iframe
                                                src={`${src}#toolbar=0&navpanes=0`}
                                                className="w-full h-full rounded-xl border-0"
                                                title="Document Preview"
                                            />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center font-medium italic">
                                        Tip: Click on image documents to open in a new tab for full-size viewing.
                                    </p>
                                </div>
                            ) : (
                                <div className="h-32 flex items-center justify-center bg-rose-50 rounded-xl border border-rose-100 text-rose-500 font-bold text-xs">
                                    Failed to load image
                                </div>
                            )}

                            {(metrics.length > 0 || interpretation) && (
                                <div className="grid gap-6">
                                    {metrics.length > 0 && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {metrics.map((m, i) => (
                                                <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">{m.label}</span>
                                                    <span className="text-[13px] font-bold text-slate-800">{m.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {interpretation && (
                                        <div className="bg-blue-600 p-5 rounded-2xl shadow-blue-200 shadow-xl">
                                            <span className="text-[9px] font-black text-blue-100 uppercase tracking-widest block mb-2 opacity-80">Physician Interpretation</span>
                                            <div className="text-[15px] font-bold text-white leading-relaxed italic">"{interpretation}"</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/50">
                            <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4">Order Details</h5>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">Description</div>
                                    <div className="text-sm text-slate-800 font-medium">{item.description || 'No description provided'}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400">Status</div>
                                        <div className="text-sm font-bold text-blue-600">{item.status}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400">Category</div>
                                        <div className="text-sm font-bold text-slate-800">{item.category}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderResultsTab = (type) => {
        const filteredRecords = records.filter(r => r.category === type || (type === 'Docs' && r.type === 'document'));

        if (recordsLoading) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                    <p className="text-slate-500">Loading {type}...</p>
                </div>
            );
        }

        if (recordsError) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-red-500">{recordsError}</p>
                </div>
            );
        }

        if (filteredRecords.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        {type === 'Labs' && <FlaskConical className="w-8 h-8 text-slate-300" />}
                        {type === 'Imaging' && <FileImage className="w-8 h-8 text-slate-300" />}
                        {type === 'Echo' && <Heart className="w-8 h-8 text-slate-300" />}
                        {type === 'EKG' && <Waves className="w-8 h-8 text-slate-300" />}
                        {type === 'Cath' && <Stethoscope className="w-8 h-8 text-slate-300" />}
                        {type === 'Stress' && <Activity className="w-8 h-8 text-slate-300" />}
                        {type === 'Docs' && <FileText className="w-8 h-8 text-slate-300" />}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No {type} Found</h3>
                    <p className="text-sm text-slate-500">No records found for this category.</p>
                </div>
            );
        }

        return (
            <div className="flex-1 flex overflow-hidden">
                <div className={`${selectedItem ? 'w-1/2' : 'w-full'} flex flex-col overflow-hidden`}>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            {type} History
                        </h3>
                        <div className="text-xs text-slate-400">{filteredRecords.length} records</div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar p-0">
                        <div className="divide-y divide-slate-100">
                            {filteredRecords.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`p-4 cursor-pointer transition-all flex items-start gap-4 hover:bg-slate-50 ${selectedItem?.id === item.id ? 'bg-blue-50/50 border-r-4 border-blue-500' : ''}`}
                                >
                                    <div className="mt-1">
                                        {item.type === 'record' && <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>}
                                        {item.type === 'order' && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Activity className="w-5 h-5 text-blue-600" /></div>}
                                        {item.type === 'document' && <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><FileText className="w-5 h-5 text-amber-600" /></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-semibold text-slate-900 truncate">{item.title}</h4>
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 ml-2">
                                                <Clock className="w-3 h-3" />
                                                {item.date ? format(new Date(item.date), 'MM/dd/yy') : '--'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-2 truncate">{item.description}</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase tracking-tighter
                                                    ${item.type === 'record' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    item.type === 'order' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                {item.type}
                                            </span>
                                            {item.status && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.status}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {selectedItem && (
                    <DocumentPreview item={selectedItem} onClose={() => setSelectedItem(null)} />
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-[60]" onClick={onClose}>
            <div className="bg-slate-50 rounded-[2rem] shadow-2xl w-full max-w-[1240px] h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                {/* Clean Professional Header */}
                <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-12">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">Chart Review</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patientData.first_name} {patientData.last_name}</p>
                            </div>
                        </div>

                        {/* Tab Navigation - Redesigned for premium look */}
                        <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-[1.25rem] overflow-x-auto max-w-[700px] scrollbar-hide">
                            {['Summary', 'Notes', 'Vitals', 'Labs', 'Imaging', 'Echo', 'EKG', 'Stress', 'Cath', 'Docs'].map((tab) => {
                                const isActive = (activeTab || 'Summary') === tab;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-5 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${isActive
                                            ? 'bg-white text-blue-600 shadow-md shadow-slate-200 scale-105'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all group border border-slate-100"
                    >
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeTab === 'Summary' ? (
                        renderSummaryTab()
                    ) : activeTab === 'Notes' ? (
                        renderNotesTab()
                    ) : activeTab === 'Vitals' ? (
                        renderVitalsTab()
                    ) : (
                        renderResultsTab(activeTab)
                    )}
                </div>

                {/* Professional Footer */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <Clock className="w-4 h-4" />
                        {activeTab === 'Summary' ? 'Clinical Overview • Real-time Data' :
                            activeTab === 'Notes' ? 'Encounter Logs • Patient History' :
                                activeTab === 'Vitals' ? 'Biometric Trends • Standardized' :
                                    'Clinical Documentation • External Records'}
                    </div>
                    {onViewFullChart && (
                        <button
                            onClick={onViewFullChart}
                            className="px-8 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Review Full Medical Chart →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChartReviewModal;
