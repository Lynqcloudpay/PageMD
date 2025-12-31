import React, { useState, useEffect } from 'react';
import {
    Eye, X, Lock, Activity, FlaskConical, FileImage,
    Heart, Waves, Stethoscope, FileText, RefreshCw, AlertCircle, Clock, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ordersAPI, documentsAPI, patientsAPI } from '../services/api';

const decodeHtmlEntities = (text) => {
    if (typeof text !== 'string') return String(text || '');
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
    onOpenVisit,
    isLoading = false
}) => {
    const [activeTab, setActiveTab] = useState('Notes');
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

        const noteText = typeof selectedVisit.note_draft === 'string' ? selectedVisit.note_draft : (selectedVisit.fullNote || '');
        const decoded = decodeHtmlEntities(noteText);

        // Parse sections for display
        const ccMatch = String(decoded).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History):|$)/is);
        const hpiMatch = String(decoded).match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment):|$)/is);
        const rosMatch = String(decoded).match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment):|$)/is);
        const peMatch = String(decoded).match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|A):|$)/is);
        const assessmentMatch = String(decoded).match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
        const planMatch = String(decoded).match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|Follow):|$)/is);
        const carePlanMatch = String(decoded).match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|$)/is);

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
                            const vNoteRaw = visit.note_draft || visit.fullNote || '';
                            const vNoteText = typeof vNoteRaw === 'string' ? vNoteRaw : String(vNoteRaw || '');
                            const vCCMatch = String(vNoteText).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n|$)/i);
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
                        renderResultsTab(activeTab)
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="text-xs text-slate-500">
                        {activeTab === 'Notes' ? 'Navigate between visits to review patient history' :
                            activeTab === 'Vitals' ? 'Review vital signs across visits' :
                                'Reviewing imported results and documents'}
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
