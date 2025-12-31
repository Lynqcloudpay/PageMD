import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api, { patientsAPI } from '../api/client';
import {
    ChevronLeft, Save, Lock, RefreshCw, AlertCircle
} from 'lucide-react';

/**
 * VisitNotePage - Tablet-optimized clinical note editor
 * Uses the same API as main PageMD EMR for full synchronization
 * iPad-first: Horizontal tabs, full-width editor, minimal chrome
 */
export function VisitNotePage() {
    const { patientId } = useParams();
    const navigate = useNavigate();

    const [patient, setPatient] = useState(null);
    const [visit, setVisit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [lastSaved, setLastSaved] = useState(null);
    const [activeSection, setActiveSection] = useState('hpi');

    // Note content state (matches main EMR structure)
    const [noteContent, setNoteContent] = useState({
        chiefComplaint: '',
        hpi: '',
        ros: '',
        physicalExam: '',
        assessment: '',
        plan: '',
    });

    // Vitals state
    const [vitals, setVitals] = useState({
        bp_systolic: '', bp_diastolic: '', pulse: '', temp: '',
        weight: '', height: '', o2_sat: '', respiratory_rate: '',
    });

    const autoSaveRef = useRef(null);

    // Load or create visit
    useEffect(() => {
        const loadVisit = async () => {
            setLoading(true);
            setError(null);
            try {
                const patientRes = await patientsAPI.getSnapshot(patientId);
                setPatient(patientRes.data?.patient || patientRes.data);

                const visitRes = await api.post(`/visits/open-today/${patientId}`, {
                    noteType: 'office_visit'
                });

                const visitData = visitRes.data;
                setVisit(visitData);

                if (visitData.note_text) {
                    parseNoteText(visitData.note_text);
                }
                if (visitData.vitals) {
                    setVitals(prev => ({ ...prev, ...visitData.vitals }));
                }
            } catch (err) {
                console.error('Failed to load visit:', err);
                setError('Failed to load visit. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadVisit();
    }, [patientId]);

    const parseNoteText = (text) => {
        if (!text) return;
        const sections = { chiefComplaint: '', hpi: '', ros: '', physicalExam: '', assessment: '', plan: '' };
        const extractSection = (label) => {
            const regex = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=(?:CHIEF COMPLAINT|HPI|ROS|PHYSICAL EXAM|ASSESSMENT|PLAN):|$)`, 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        };
        sections.chiefComplaint = extractSection('CHIEF COMPLAINT');
        sections.hpi = extractSection('HPI');
        sections.ros = extractSection('ROS');
        sections.physicalExam = extractSection('PHYSICAL EXAM');
        sections.assessment = extractSection('ASSESSMENT');
        sections.plan = extractSection('PLAN');
        setNoteContent(sections);
    };

    const combineNoteText = useCallback(() => {
        const parts = [];
        if (noteContent.chiefComplaint) parts.push(`CHIEF COMPLAINT:\n${noteContent.chiefComplaint}`);
        if (noteContent.hpi) parts.push(`HPI:\n${noteContent.hpi}`);
        if (noteContent.ros) parts.push(`ROS:\n${noteContent.ros}`);
        if (noteContent.physicalExam) parts.push(`PHYSICAL EXAM:\n${noteContent.physicalExam}`);
        if (noteContent.assessment) parts.push(`ASSESSMENT:\n${noteContent.assessment}`);
        if (noteContent.plan) parts.push(`PLAN:\n${noteContent.plan}`);
        return parts.join('\n\n');
    }, [noteContent]);

    // Auto-save every 30 seconds
    useEffect(() => {
        if (!visit?.id) return;
        autoSaveRef.current = setInterval(() => { handleSave(true); }, 30000);
        return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
    }, [visit?.id, noteContent, vitals]);

    const handleSave = async (isAutoSave = false) => {
        if (!visit?.id) return;
        setSaving(true);
        try {
            await api.put(`/visits/${visit.id}`, {
                note_text: combineNoteText(),
                vitals: vitals,
                status: 'in_progress',
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to save:', err);
            if (!isAutoSave) setError('Failed to save note');
        } finally {
            setSaving(false);
        }
    };

    const handleSign = async () => {
        if (!visit?.id) return;
        if (!window.confirm('Sign this note? This action cannot be undone.')) return;
        setSaving(true);
        try {
            await api.post(`/visits/${visit.id}/sign`, { noteDraft: combineNoteText(), vitals });
            navigate(-1);
        } catch (err) {
            console.error('Failed to sign:', err);
            setError('Failed to sign note');
        } finally {
            setSaving(false);
        }
    };

    const updateSection = (section, value) => {
        setNoteContent(prev => ({ ...prev, [section]: value }));
    };

    // Horizontal tabs for iPad
    const tabs = [
        { key: 'cc', label: 'CC' },
        { key: 'hpi', label: 'HPI' },
        { key: 'ros', label: 'ROS' },
        { key: 'pe', label: 'Exam' },
        { key: 'assessment', label: 'A&P' },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error && !visit) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600 font-medium mb-4">{error}</p>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg min-h-[44px]">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
            {/* Compact Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                            {patient?.first_name?.[0]}{patient?.last_name?.[0]}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900">{patient?.first_name} {patient?.last_name}</div>
                            <div className="text-xs text-gray-500">{format(new Date(), 'MMM d, yyyy')} • {visit?.status === 'signed' ? 'Signed' : 'Draft'}</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {lastSaved && <span className="text-xs text-gray-400 hidden sm:block">Saved {format(lastSaved, 'h:mm a')}</span>}
                    <button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg min-h-[44px] font-medium text-sm">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                    <button onClick={handleSign} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg min-h-[44px] font-bold text-sm">
                        <Lock className="w-4 h-4" />
                        Sign
                    </button>
                </div>
            </div>

            {/* Compact Vitals Ribbon */}
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Vitals:</span>
                {[
                    { key: 'bp_systolic', label: 'SBP', unit: '' },
                    { key: 'bp_diastolic', label: 'DBP', unit: '' },
                    { key: 'pulse', label: 'HR', unit: '' },
                    { key: 'temp', label: 'T', unit: '°' },
                    { key: 'o2_sat', label: 'O2', unit: '%' },
                    { key: 'weight', label: 'Wt', unit: '' },
                ].map(field => (
                    <div key={field.key} className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{field.label}:</span>
                        <input
                            type="number"
                            value={vitals[field.key] || ''}
                            onChange={(e) => setVitals({ ...vitals, [field.key]: e.target.value })}
                            className="w-14 px-2 py-1.5 border border-gray-200 rounded text-sm text-center min-h-[36px]"
                            placeholder="--"
                        />
                    </div>
                ))}
            </div>

            {/* Horizontal Section Tabs - Sticky */}
            <div className="bg-white border-b border-gray-200 px-4 flex gap-1 sticky top-0 z-10">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSection(tab.key)}
                        className={`px-5 py-3 text-sm font-bold transition-all min-h-[48px] border-b-2 ${activeSection === tab.key
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Full-Width Note Editor */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto">
                    {activeSection === 'cc' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Chief Complaint</label>
                            <textarea
                                value={noteContent.chiefComplaint}
                                onChange={(e) => updateSection('chiefComplaint', e.target.value)}
                                placeholder="Enter chief complaint..."
                                className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                    )}

                    {activeSection === 'hpi' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">History of Present Illness</label>
                            <textarea
                                value={noteContent.hpi}
                                onChange={(e) => updateSection('hpi', e.target.value)}
                                placeholder="Enter HPI..."
                                className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[350px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                    )}

                    {activeSection === 'ros' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Review of Systems</label>
                            <textarea
                                value={noteContent.ros}
                                onChange={(e) => updateSection('ros', e.target.value)}
                                placeholder="Enter ROS..."
                                className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[350px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                    )}

                    {activeSection === 'pe' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Physical Examination</label>
                            <textarea
                                value={noteContent.physicalExam}
                                onChange={(e) => updateSection('physicalExam', e.target.value)}
                                placeholder="Enter physical exam findings..."
                                className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[350px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                    )}

                    {activeSection === 'assessment' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Assessment</label>
                                <textarea
                                    value={noteContent.assessment}
                                    onChange={(e) => updateSection('assessment', e.target.value)}
                                    placeholder="Enter assessment and diagnoses..."
                                    className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Plan</label>
                                <textarea
                                    value={noteContent.plan}
                                    onChange={(e) => updateSection('plan', e.target.value)}
                                    placeholder="Enter treatment plan..."
                                    className="w-full p-4 border border-gray-200 rounded-xl text-base min-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
