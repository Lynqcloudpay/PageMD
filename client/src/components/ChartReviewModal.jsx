import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { ordersAPI, documentsAPI, patientsAPI, labsAPI } from '../services/api';

const decodeHtmlEntities = (text) => {
    if (typeof text !== 'string') return String(text || '');
    let str = text;
    if (typeof document !== 'undefined') {
        const txt = document.createElement('textarea');
        for (let i = 0; i < 10; i++) {
            const prev = str;
            txt.innerHTML = str;
            str = txt.value;
            str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/').replace(/&amp;/g, '&');
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
    const [selectedVitals, setSelectedVitals] = useState({ hr: true, bp: true, bmi: true });

    const toggleVital = (vital) => setSelectedVitals(prev => ({ ...prev, [vital]: !prev[vital] }));

    // Helper to get patient name (handles both naming conventions)
    const getPatientName = () => {
        if (!patientData) return { first: '', last: '', full: 'Unknown Patient' };
        const first = patientData.first_name || patientData.firstName || '';
        const last = patientData.last_name || patientData.lastName || '';
        return { first, last, full: `${first} ${last}`.trim() || 'Unknown Patient' };
    };

    const getChiefComplaint = (visit) => {
        const noteText = typeof visit.note_draft === 'string' ? visit.note_draft : (visit.fullNote || '');
        const decoded = decodeHtmlEntities(noteText);
        const ccMatch = String(decoded).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History):|$)/is);
        return ccMatch ? ccMatch[1].trim() : null;
    };

    // Filter keywords helper
    const getFilterKeywords = (type) => {
        switch (type) {
            case 'Labs': return ['lab', 'blood', 'urine', 'panel', 'culture', 'bmp', 'cmp', 'cbc'];
            case 'Imaging': return ['x-ray', 'ct', 'mri', 'ultrasound', 'scan', 'radiology', 'imaging', 'cath', 'angiogram', 'pci', 'coronary', 'stress', 'exercise', 'nuclear', 'treadmill'];
            case 'Echo': return ['echo', 'tte', 'tee', 'echocardiogram'];
            case 'EKG': return ['ekg', 'ecg', 'electrocardiogram'];
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
            const [ordersRes, docsRes, fullPatientRes, labsRes] = await Promise.allSettled([
                ordersAPI.getByPatient(patientId),
                documentsAPI.getByPatient(patientId),
                patientsAPI.get(patientId),
                labsAPI.getByPatient(patientId)
            ]);

            let combinedItems = [];

            // 1. Mother Chart Data
            if (fullPatientRes.status === 'fulfilled' && fullPatientRes.value.data) {
                const pData = fullPatientRes.value.data;
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
                    ...mapRecord(pData.cardiac_caths || pData.caths, 'Imaging', 'Cath Report'),
                    ...mapRecord(pData.stress_tests, 'Imaging', 'Stress Test')
                ];
            }

            // 2. Labs from Dedicated API
            if (labsRes.status === 'fulfilled' && labsRes.value.data) {
                const labs = labsRes.value.data.map(l => ({
                    id: `lab-${l.id}`,
                    category: 'Labs',
                    type: 'lab',
                    title: l.order_payload?.test_name || l.order_payload?.name || 'Lab Result',
                    description: l.status || 'Received',
                    date: l.created_at || l.order_date,
                    status: l.status,
                    source: l
                }));
                combinedItems = [...combinedItems, ...labs];
            }

            // 3. Orders
            if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
                const orders = ordersRes.value.data.map(o => {
                    let category = 'Other';
                    const text = (o.name + ' ' + o.description + ' ' + o.type).toLowerCase();
                    if (getFilterKeywords('Labs').some(k => text.includes(k)) || o.order_type === 'lab') category = 'Labs';
                    else if (getFilterKeywords('Imaging').some(k => text.includes(k)) || o.order_type === 'imaging') category = 'Imaging';
                    else if (getFilterKeywords('Echo').some(k => text.includes(k))) category = 'Echo';
                    else if (getFilterKeywords('EKG').some(k => text.includes(k))) category = 'EKG';

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

            // 4. Documents
            if (docsRes.status === 'fulfilled' && docsRes.value.data) {
                const docs = docsRes.value.data.map(d => {
                    let category = 'Docs';
                    const docType = (d.doc_type || '').toLowerCase();
                    const tags = Array.isArray(d.tags) ? d.tags : [];
                    const comment = d.comment || '';
                    const text = (d.filename + ' ' + comment + ' ' + docType + ' ' + tags.join(' ')).toLowerCase();

                    if (getFilterKeywords('Labs').some(k => text.includes(k)) || docType === 'lab') category = 'Labs';
                    else if (getFilterKeywords('Echo').some(k => text.includes(k)) || docType === 'echo') category = 'Echo';
                    else if (getFilterKeywords('EKG').some(k => text.includes(k)) || docType === 'ekg') category = 'EKG';
                    else if (getFilterKeywords('Imaging').some(k => text.includes(k)) || docType === 'imaging' || docType === 'cardiac_cath' || docType === 'stress' || docType === 'stress_test') category = 'Imaging';

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

            // Deduplicate
            const seenIds = new Set();
            const deduplicatedItems = combinedItems.filter(item => {
                const uid = item.source?.id ? `${item.type}-${item.source.id}` : item.id;
                if (seenIds.has(uid)) return false;
                seenIds.add(uid);
                return true;
            });

            deduplicatedItems.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setRecords(deduplicatedItems);

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
        // Data prep for Summary - tracking HR, BP, and BMI
        let vitalsTrendData = [...visits].reverse().map((v, i) => {
            let vitals = v.vitals || {};
            if (typeof vitals === 'string') {
                try { vitals = JSON.parse(vitals); } catch (e) { vitals = {}; }
            }
            const bp = vitals.bp || (vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : '');
            const sys = parseInt(vitals.systolic || (typeof bp === 'string' ? bp.split('/')[0] : 0)) || 0;
            const hr = parseInt(vitals.pulse || vitals.hr || 0) || 0;
            const bmi = parseFloat(vitals.bmi || 0) || 0;

            return {
                uniqueKey: `${format(new Date(v.visit_date), 'yyyy-MM-dd')}-${i}-${sys || 0}-${hr || 0}`,
                name: format(new Date(v.visit_date), 'M/d'),
                hr: hr || null,
                sys: sys || null,
                bmi: bmi || null
            };
        }).filter(d => d.hr !== null || d.sys !== null || d.bmi !== null);

        // Fallback sample data if no vitals exist
        if (vitalsTrendData.length === 0) {
            vitalsTrendData = [
                { name: '11/1', hr: 72, sys: 120, bmi: 26.5 },
                { name: '11/15', hr: 68, sys: 118, bmi: 26.2 },
                { name: '12/1', hr: 75, sys: 122, bmi: 26.8 },
                { name: '12/15', hr: 70, sys: 119, bmi: 26.4 }
            ];
        }

        const latestVitals = vitalsTrendData[vitalsTrendData.length - 1] || { hr: '--', sys: '--', bmi: '--' };
        const patientName = getPatientName();

        // Build comprehensive timeline from all sources
        const getEventColor = (type, category) => {
            if (type === 'visit') return 'bg-emerald-500';
            if (type === 'order') return 'bg-blue-500';
            if (category?.toLowerCase().includes('lab')) return 'bg-purple-500';
            if (category?.toLowerCase().includes('imaging') || category?.toLowerCase().includes('radiology')) return 'bg-cyan-500';
            if (category?.toLowerCase().includes('message')) return 'bg-yellow-500';
            if (category?.toLowerCase().includes('payment') || category?.toLowerCase().includes('billing')) return 'bg-green-500';
            if (category?.toLowerCase().includes('ekg') || category?.toLowerCase().includes('echo')) return 'bg-rose-500';
            return 'bg-slate-400';
        };

        const getEventIcon = (type, category) => {
            if (type === 'visit') return '🩺';
            if (category?.toLowerCase().includes('lab')) return '🧪';
            if (category?.toLowerCase().includes('imaging')) return '📷';
            if (category?.toLowerCase().includes('message')) return '💬';
            if (category?.toLowerCase().includes('payment')) return '💳';
            if (category?.toLowerCase().includes('ekg')) return '❤️';
            return '📄';
        };

        const timelineItems = [
            ...visits.map(v => {
                const d = new Date(v.visit_date);
                return {
                    id: `visit-${v.id}`,
                    dateLabel: format(d, 'MMM d'),
                    timeLabel: format(d, 'h:mm a'),
                    date: v.visit_date,
                    title: v.visit_type?.replace('_', ' ') || 'Office Visit',
                    subtitle: v.provider_last_name ? `Dr. ${v.provider_last_name}` : 'Provider',
                    type: 'visit',
                    icon: '🩺',
                    color: 'bg-emerald-500',
                    onClick: () => { setActiveTab('Notes'); setSelectedVisitId(v.id); }
                };
            }),
            ...records.map(r => {
                const d = new Date(r.date || r.created_at || 0);
                const category = r.category || r.type || '';
                return {
                    id: r.id,
                    dateLabel: format(d, 'MMM d'),
                    timeLabel: format(d, 'h:mm a'),
                    date: r.date || r.created_at,
                    title: r.title || r.name || category,
                    subtitle: category,
                    type: r.type,
                    icon: getEventIcon(r.type, category),
                    color: getEventColor(r.type, category),
                    onClick: () => setSelectedItem(r)
                };
            })
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return (
            <div className="flex-1 bg-slate-50 overflow-y-auto custom-scrollbar p-4">
                <div className="grid grid-cols-5 gap-4 h-full">
                    {/* Left Column - Main Content (3/5) */}
                    <div className="col-span-3 space-y-3">
                        {/* Patient Header */}
                        <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="relative">
                                {patientData ? (
                                    <PatientHeaderPhoto
                                        firstName={patientName.first}
                                        lastName={patientName.last}
                                        photoUrl={patientData?.photo_url || patientData?.photoUrl}
                                        className="w-12 h-12 text-sm shadow border-2 border-white"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 animate-pulse">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                {patientData ? (
                                    <>
                                        <h2 className="text-lg font-black text-slate-900 truncate tracking-tight">
                                            {patientName.full}
                                        </h2>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                            MRN: {patientData?.id || patientData?.patient_id || '---'} • <span className="text-emerald-600">Active Record</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
                                        <div className="h-2 w-20 bg-slate-50 rounded animate-pulse"></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Vitals Stats - Compact row */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { key: 'hr', label: 'HR', value: latestVitals.hr, unit: 'bpm', color: 'text-rose-500', bg: 'bg-rose-50' },
                                { key: 'bp', label: 'BP', value: latestVitals.sys, unit: 'mmHg', color: 'text-blue-600', bg: 'bg-blue-50' },
                                { key: 'bmi', label: 'BMI', value: latestVitals.bmi, unit: '', color: 'text-purple-600', bg: 'bg-purple-50' }
                            ].map((stat) => (
                                <button
                                    key={stat.key}
                                    onClick={() => toggleVital(stat.key)}
                                    className={`p-2.5 rounded-lg ${stat.bg} flex items-center justify-between transition-all cursor-pointer ${selectedVitals[stat.key] ? 'ring-2 ring-offset-1 ring-' + stat.color.replace('text-', '') : 'opacity-40'}`}
                                >
                                    <span className={`text-[9px] font-bold ${stat.color} uppercase`}>{stat.label}</span>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-base font-bold text-slate-900">{stat.value}</span>
                                        <span className="text-[8px] text-slate-400">{stat.unit}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Trend Chart - Selectable vitals */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700">Vitals Trend</span>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleVital('hr')} className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded ${selectedVitals.hr ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedVitals.hr ? 'bg-rose-500' : 'bg-slate-300'}`}></span>HR
                                    </button>
                                    <button onClick={() => toggleVital('bp')} className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded ${selectedVitals.bp ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedVitals.bp ? 'bg-blue-600' : 'bg-slate-300'}`}></span>BP
                                    </button>
                                    <button onClick={() => toggleVital('bmi')} className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded ${selectedVitals.bmi ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedVitals.bmi ? 'bg-purple-600' : 'bg-slate-300'}`}></span>BMI
                                    </button>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: 160, minWidth: 0, minHeight: 160 }}>
                                {vitalsTrendData && vitalsTrendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                        <AreaChart data={vitalsTrendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="hrG" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="bpG" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="bmiG" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="uniqueKey"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={({ x, y, payload }) => {
                                                    const dateLabel = vitalsTrendData.find(d => d.uniqueKey === payload.value)?.name || '';
                                                    return <text x={x} y={y + 10} textAnchor="middle" fill="#94a3b8" fontSize={9}>{dateLabel}</text>;
                                                }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} domain={[0, 'dataMax + 20']} width={25} />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const dateLabel = payload[0]?.payload?.name || '';
                                                        return (
                                                            <div className="bg-white border border-slate-200 rounded-md shadow-lg p-2 text-[10px]">
                                                                <div className="font-bold text-slate-500 mb-1 border-b border-slate-100 pb-1">{dateLabel}</div>
                                                                {payload.map((p, i) => (
                                                                    <div key={i} className="flex items-center gap-2 mb-0.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }}></div>
                                                                        <span className="text-slate-600 font-medium">{p.name}:</span>
                                                                        <span className="font-bold ml-auto" style={{ color: p.color }}>{p.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            {selectedVitals.hr && <Area type="monotone" dataKey="hr" name="Heart Rate" stroke="#f43f5e" strokeWidth={2} fill="url(#hrG)" dot={{ r: 2, fill: '#f43f5e' }} />}
                                            {selectedVitals.bp && <Area type="monotone" dataKey="sys" name="BP Systolic" stroke="#2563eb" strokeWidth={2} fill="url(#bpG)" dot={{ r: 2, fill: '#2563eb' }} />}
                                            {selectedVitals.bmi && <Area type="monotone" dataKey="bmi" name="BMI" stroke="#9333ea" strokeWidth={2} fill="url(#bmiG)" dot={{ r: 2, fill: '#9333ea' }} />}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 text-[10px] italic">No trend data available</div>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats below chart */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center">
                                <div className="text-[9px] text-slate-400 uppercase">Total Visits</div>
                                <div className="text-lg font-bold text-slate-900">{visits.length}</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center">
                                <div className="text-[9px] text-slate-400 uppercase">Last Visit</div>
                                <div className="text-sm font-bold text-slate-900">{visits[0] ? format(new Date(visits[0].visit_date), 'M/d/yy') : '--'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Sidebar (2/5) */}
                    <div className="col-span-2 space-y-3">
                        {/* Timeline - Clickable events */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 mb-3">Recent Activity</h3>
                            <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scrollbar">
                                {timelineItems.length > 0 ? timelineItems.slice(0, 12).map((item, i) => (
                                    <div
                                        key={item.id || i}
                                        onClick={item.onClick}
                                        className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 group"
                                    >
                                        <span className="text-sm mt-0.5">{item.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-medium text-slate-900 truncate group-hover:text-blue-600">{item.title}</span>
                                                <span className="text-[9px] text-slate-400 shrink-0">{item.dateLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-500">{item.subtitle}</span>
                                                <span className="text-[8px] text-slate-400">{item.timeLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-4 text-center text-slate-400 text-xs">No activity recorded</div>
                                )}
                            </div>
                        </div>

                        {/* Active Problems */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 mb-2">Active Problems</h3>
                            <div className="space-y-1">
                                {(patientData?.problems || []).filter(p => p.status === 'active').slice(0, 5).map((p, i) => (
                                    <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span className="truncate">{decodeHtmlEntities(p.problem_name || p.name)}</span>
                                    </div>
                                ))}
                                {(!patientData?.problems || patientData.problems.filter(p => p.status === 'active').length === 0) && (
                                    <div className="text-[11px] text-slate-400 italic">No active problems</div>
                                )}
                            </div>
                        </div>

                        {/* Medications */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 mb-2">Medications</h3>
                            <div className="space-y-1">
                                {(patientData?.medications || []).filter(m => m.active !== false).slice(0, 5).map((m, i) => (
                                    <div key={i} className="text-[11px] text-slate-600 truncate">
                                        {decodeHtmlEntities(m.medication_name || m.name)}
                                    </div>
                                ))}
                                {(!patientData?.medications || patientData.medications.length === 0) && (
                                    <div className="text-[11px] text-slate-400 italic">No medications</div>
                                )}
                            </div>
                        </div>

                        {/* Allergies */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 mb-2">Allergies</h3>
                            {(patientData?.allergies || []).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {patientData.allergies.map((a, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-medium rounded border border-rose-100">
                                            {decodeHtmlEntities(a.allergen || a.name)}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[11px] font-bold text-emerald-600">NKDA</span>
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

        // Parse note sections
        const ccMatch = String(decoded).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History):|$)/is);
        const hpiMatch = String(decoded).match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Vitals):|$)/is);
        const assessmentMatch = String(decoded).match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
        const planMatch = String(decoded).match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|Follow|$))/is);
        const carePlanMatch = String(decoded).match(/(?:Care Plan):\s*(.+?)(?:\n\n|\n(?:Follow):|$)/is);
        const followUpMatch = String(decoded).match(/(?:Follow[\s-]?up|F\/U):\s*(.+?)(?:\n\n|$)/is);

        // Get vitals from visit data and decode any HTML entities
        let visitVitals = selectedVisit.vitals || {};
        if (typeof visitVitals === 'string') {
            try { visitVitals = JSON.parse(visitVitals); } catch (e) { visitVitals = {}; }
        }
        // Decode HTML entities in all vitals values
        const cleanVitals = {};
        Object.keys(visitVitals).forEach(key => {
            const val = visitVitals[key];
            cleanVitals[key] = typeof val === 'string' ? decodeHtmlEntities(val) : val;
        });

        // Fallback to visit object fields if regex didn't match
        const planText = planMatch ? planMatch[1].trim() : (selectedVisit.plan ? decodeHtmlEntities(selectedVisit.plan) : null);
        const carePlanText = carePlanMatch ? carePlanMatch[1].trim() : (selectedVisit.care_plan ? decodeHtmlEntities(selectedVisit.care_plan) : null);
        const followUpText = followUpMatch ? followUpMatch[1].trim() : (selectedVisit.follow_up ? decodeHtmlEntities(selectedVisit.follow_up) : null);

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
                                    {getChiefComplaint(visit) && (
                                        <div className="text-[10px] font-medium text-slate-500 mt-1 line-clamp-2 italic">
                                            "{getChiefComplaint(visit)}"
                                        </div>
                                    )}
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
                        </div>

                        <div className="space-y-6">
                            {/* CC Section */}
                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50">
                                <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Chief Complaint</h4>
                                <div className="text-base font-medium text-blue-900 italic">
                                    "{ccMatch ? ccMatch[1].trim() : 'Not documented'}"
                                </div>
                            </div>

                            {/* HPI Section */}
                            {hpiMatch && (
                                <div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">History of Present Illness</h4>
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {hpiMatch[1].trim()}
                                    </div>
                                </div>
                            )}

                            {/* Vitals Section */}
                            {Object.keys(cleanVitals).length > 0 && (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Vitals</h4>
                                    <div className="grid grid-cols-4 gap-3 text-xs">
                                        {cleanVitals.bp && <div><span className="text-slate-400">BP:</span> <span className="font-bold">{cleanVitals.bp}</span></div>}
                                        {(cleanVitals.pulse || cleanVitals.hr) && <div><span className="text-slate-400">HR:</span> <span className="font-bold">{cleanVitals.pulse || cleanVitals.hr}</span></div>}
                                        {cleanVitals.temp && <div><span className="text-slate-400">Temp:</span> <span className="font-bold">{cleanVitals.temp}</span></div>}
                                        {cleanVitals.resp && <div><span className="text-slate-400">RR:</span> <span className="font-bold">{cleanVitals.resp}</span></div>}
                                        {(cleanVitals.o2sat || cleanVitals.spo2) && <div><span className="text-slate-400">SpO2:</span> <span className="font-bold">{cleanVitals.o2sat || cleanVitals.spo2}%</span></div>}
                                        {cleanVitals.weight && <div><span className="text-slate-400">Wt:</span> <span className="font-bold">{cleanVitals.weight}</span></div>}
                                        {cleanVitals.height && <div><span className="text-slate-400">Ht:</span> <span className="font-bold">{cleanVitals.height}</span></div>}
                                        {cleanVitals.bmi && <div><span className="text-slate-400">BMI:</span> <span className="font-bold">{cleanVitals.bmi}</span></div>}
                                    </div>
                                </div>
                            )}

                            {/* Assessment */}
                            {assessmentMatch && (
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                    <h4 className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">Assessment</h4>
                                    <div className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                                        {assessmentMatch[1].trim()}
                                    </div>
                                </div>
                            )}

                            {/* Plan */}
                            {planText && (
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <h4 className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">Plan</h4>
                                    <div className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">
                                        {planText}
                                    </div>
                                </div>
                            )}

                            {/* Care Plan */}
                            {carePlanText && (
                                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                                    <h4 className="text-[9px] font-black text-purple-700 uppercase tracking-widest mb-2">Care Plan</h4>
                                    <div className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">
                                        {carePlanText}
                                    </div>
                                </div>
                            )}

                            {/* Follow-up */}
                            {followUpText && (
                                <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-100">
                                    <h4 className="text-[9px] font-black text-cyan-700 uppercase tracking-widest mb-2">Follow-up</h4>
                                    <div className="text-sm text-cyan-900 leading-relaxed whitespace-pre-wrap">
                                        {followUpText}
                                    </div>
                                </div>
                            )}
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

    const modalContent = (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[2000] p-4" onClick={onClose}>
            <div className="bg-slate-50 rounded-[2rem] shadow-2xl w-full max-w-[1240px] h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                {/* Clean Professional Header */}
                <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">Chart Review</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patientData.first_name} {patientData.last_name}</p>
                        </div>
                    </div>

                    {/* Centered Tab Navigation */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="flex gap-0.5 p-1 bg-slate-100 rounded-lg shadow-inner">
                            {['Summary', 'Notes', 'Vitals', 'Labs', 'Imaging', 'Echo', 'EKG', 'Docs'].map((tab) => {
                                const isActive = (activeTab || 'Summary') === tab;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${isActive
                                            ? 'bg-white text-blue-600 shadow-sm'
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
                <div className="px-8 py-8 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-300" />
                        </div>
                        <div>
                            <div className="text-slate-500">{activeTab} View</div>
                            <div className="text-[10px] font-medium lowercase italic">Last updated: {format(new Date(), 'h:mm a')}</div>
                        </div>
                    </div>
                    {onViewFullChart && (
                        <button
                            onClick={onViewFullChart}
                            className="px-10 py-4 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2 hover:-translate-y-0.5"
                        >
                            Open Full Patient Chart
                            <Eye className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.getElementById('modal-root') || document.body);
};

export default ChartReviewModal;
