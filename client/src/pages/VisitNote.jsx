import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList,
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History,
    Activity, CheckSquare, Square, Trash2, Pill, Users, UserCircle, ChevronRight
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import { OrderModal, PrescriptionModal, ReferralModal } from '../components/ActionModals';
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import CodeSearchModal from '../components/CodeSearchModal';
import VisitPrint from '../components/VisitPrint';
import PatientChartPanel from '../components/PatientChartPanel';
import { visitsAPI, codesAPI, patientsAPI } from '../services/api';
import { usePrivileges } from '../hooks/usePrivileges';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { hpiDotPhrases } from '../data/hpiDotPhrases';
import { ProblemInput, MedicationInput, AllergyInput, FamilyHistoryInput } from '../components/PAMFOSInputs';

// Collapsible Section Component
const Section = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm mb-2 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-2 py-1.5 bg-neutral-50 border-b border-gray-200 flex items-center justify-between hover:bg-neutral-100 transition-colors"
            >
                <h3 className="text-xs font-semibold text-primary-900">{title}</h3>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </button>
            {isOpen && <div className="p-2 bg-white">{children}</div>}
        </div>
    );
};

// Plan Display Component
const PlanDisplay = ({ plan }) => {
    if (!plan) return null;
    const lines = plan.split('\n');
    const formattedLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            formattedLines.push(<br key={i} />);
            continue;
        }
        if (line.startsWith('**__') && line.endsWith('__**')) {
            const diagnosis = line.replace(/^\*\*__/, '').replace(/__\*\*$/, '');
            formattedLines.push(
                <div key={i} className="font-bold underline text-ink-900 mb-2 mt-3 first:mt-0">
                    {diagnosis}
                </div>
            );
        } else if (line.startsWith('  - ')) {
            const orderText = line.substring(4);
            formattedLines.push(
                <div key={i} className="ml-4 text-ink-700 mb-1">
                    • {orderText}
                </div>
            );
        } else {
            formattedLines.push(
                <div key={i} className="text-ink-700 mb-1">
                    {line}
                </div>
            );
        }
    }
    return <div className="whitespace-pre-wrap">{formattedLines}</div>;
};

// Generic History List Component
const HistoryList = ({ title, icon, items, renderItem, onAdd, onDelete, emptyMessage, addPlaceholder = "Add item...", renderInput }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onAdd(newItem);
            setNewItem('');
            setIsAdding(false);
        }
    };

    return (
        <div className="border rounded-md border-gray-100 bg-white">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    {icon}
                    <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
                </div>
                {!isAdding && (
                    <button onClick={() => setIsAdding(true)} className="text-primary-600 hover:bg-primary-50 p-1 rounded">
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
            <div className="p-2">
                {items && items.length > 0 ? (
                    <div className="space-y-1">
                        {items.map((item, idx) => (
                            <div key={item.id || idx} className="group flex items-start justify-between py-1 px-2 hover:bg-gray-50 rounded text-sm">
                                <div className="flex-1 mr-2">
                                    {renderItem(item)}
                                </div>
                                <button
                                    onClick={() => onDelete(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 italic text-center py-2">{emptyMessage}</p>
                )}

                {isAdding && (
                    <div className="mt-2">
                        {renderInput ? (
                            renderInput({
                                onSave: (data) => {
                                    onAdd(data);
                                    setIsAdding(false);
                                },
                                onCancel: () => setIsAdding(false)
                            })
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newItem}
                                    onChange={(e) => setNewItem(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                    placeholder={addPlaceholder}
                                    className="flex-1 text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 px-2 py-1"
                                    autoFocus
                                />
                                <button onClick={handleAdd} className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700">Save</button>
                                <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 hover:text-gray-700 px-1">Cancel</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const VisitNote = () => {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const id = params.id;
    // Extract visitId from params - check if it's the "new" route or an existing visit
    const urlVisitId = params.visitId || (location.pathname.endsWith('/visit/new') ? 'new' : undefined);
    const [currentVisitId, setCurrentVisitId] = useState(urlVisitId);
    const [isSigned, setIsSigned] = useState(false);
    const [visitData, setVisitData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [toast, setToast] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderModalTab, setOrderModalTab] = useState('labs');
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [showEPrescribeEnhanced, setShowEPrescribeEnhanced] = useState(false);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const { hasPrivilege } = usePrivileges();
    const { user } = useAuth();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showPatientChart, setShowPatientChart] = useState(false);
    const [patientChartTab, setPatientChartTab] = useState('history');
    const [patientData, setPatientData] = useState(null);

    // Auto-save tracking
    const autoSaveTimeoutRef = useRef(null);
    const hasInitialSaveRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    // Patient History State (PAMFOS)
    const [familyHistory, setFamilyHistory] = useState([]);
    const [socialHistory, setSocialHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false); // For extended editing if needed

    // Note sections
    const [noteData, setNoteData] = useState({
        chiefComplaint: '',
        hpi: '',
        ros: {
            constitutional: false,
            eyes: false,
            ent: false,
            cardiovascular: false,
            respiratory: false,
            gastrointestinal: false,
            genitourinary: false,
            musculoskeletal: false,
            neurological: false,
            skin: false
        },
        rosNotes: '',
        pe: {
            general: false,
            headNeck: false,
            eyes: false,
            ent: false,
            cardiovascular: false,
            respiratory: false,
            abdomen: false,
            extremities: false,
            neurological: false,
            skin: false
        },
        peNotes: '',
        assessment: '',
        plan: '',
        planStructured: [] // Array of {diagnosis: string, orders: string[]}
    });

    // Vitals
    const [vitals, setVitals] = useState({
        systolic: '',
        diastolic: '',
        bp: '',
        bpReadings: [],
        temp: '',
        pulse: '',
        resp: '',
        o2sat: '',
        weight: '',
        height: '',
        bmi: '',
        weightUnit: 'lbs',
        heightUnit: 'in'
    });

    // Previous visit weight for comparison
    const [previousWeight, setPreviousWeight] = useState(null);
    const [previousWeightUnit, setPreviousWeightUnit] = useState('lbs');

    // Dot phrases
    const [showDotPhraseModal, setShowDotPhraseModal] = useState(false);
    const [dotPhraseSearch, setDotPhraseSearch] = useState('');
    const [activeTextArea, setActiveTextArea] = useState(null);
    const [hpiDotPhraseSearch, setHpiDotPhraseSearch] = useState('');
    const [showHpiDotPhraseResults, setShowHpiDotPhraseResults] = useState(false);

    // ICD-10 search
    const [showIcd10Search, setShowIcd10Search] = useState(false);
    const [icd10Search, setIcd10Search] = useState('');
    const [icd10Results, setIcd10Results] = useState([]);

    // AI Summary
    const [aiSummary, setAiSummary] = useState('');
    const [generatingSummary, setGeneratingSummary] = useState(false);

    // Refs for textareas
    const hpiRef = useRef(null);
    const assessmentRef = useRef(null);
    const planRef = useRef(null);

    // Refs for vitals inputs
    const systolicRef = useRef(null);
    const diastolicRef = useRef(null);
    const tempRef = useRef(null);
    const pulseRef = useRef(null);
    const respRef = useRef(null);
    const o2satRef = useRef(null);
    const weightRef = useRef(null);
    const heightRef = useRef(null);

    // Autocomplete state
    const [autocompleteState, setAutocompleteState] = useState({
        show: false,
        suggestions: [],
        position: { top: 0, left: 0 },
        selectedIndex: 0
    });

    const rosFindings = {
        constitutional: 'No fever, chills, fatigue, or weight loss.',
        eyes: 'No vision changes, eye pain, or discharge.',
        ent: 'No hearing loss, ear pain, nasal congestion, or sore throat.',
        cardiovascular: 'No chest pain, palpitations, or shortness of breath.',
        respiratory: 'No cough, wheezing, or difficulty breathing.',
        gastrointestinal: 'No nausea, vomiting, diarrhea, or abdominal pain.',
        genitourinary: 'No dysuria, frequency, urgency, or hematuria.',
        musculoskeletal: 'No joint pain, swelling, or muscle weakness.',
        neurological: 'No headaches, dizziness, or seizures.',
        skin: 'No rashes, lesions, or changes in moles.'
    };

    const peFindings = {
        general: 'Well-appearing, alert, in no acute distress.',
        headNeck: 'Normocephalic, atraumatic. No lymphadenopathy. Neck supple.',
        eyes: 'PERRLA, EOMI. No conjunctival injection.',
        ent: 'TMs clear. Oropharynx clear. Nasal mucosa normal.',
        cardiovascular: 'Regular rate and rhythm. No murmurs. Pulses intact.',
        respiratory: 'Clear to auscultation bilaterally. No wheezes or rales.',
        abdomen: 'Soft, non-tender, non-distended. Bowel sounds active.',
        extremities: 'No edema or clubbing. Full range of motion. Pulses intact.',
        neurological: 'Alert and oriented x3. Cranial nerves intact. Strength 5/5.',
        skin: 'No rashes or lesions. Good turgor.'
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Decode HTML entities (handles double-encoding)
    const decodeHtmlEntities = (text) => {
        if (!text) return text;
        // Handle double-encoded entities like &amp;amp;#x2F;
        let decoded = text
            .replace(/&amp;amp;/g, '&')
            .replace(/&amp;#x2F;/g, '/')
            .replace(/&amp;#47;/g, '/')
            .replace(/&amp;lt;/g, '<')
            .replace(/&amp;gt;/g, '>')
            .replace(/&amp;quot;/g, '"')
            .replace(/&amp;apos;/g, "'");
        // Handle single-encoded entities
        decoded = decoded
            .replace(/&#x2F;/g, '/')
            .replace(/&#47;/g, '/')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        return decoded;
    };

    const parseNoteText = (text) => {
        if (!text || !text.trim()) {
            console.log('parseNoteText: Empty or whitespace text');
            return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        }
        const decodedText = decodeHtmlEntities(text);
        console.log('parseNoteText: Decoded text length:', decodedText.length, 'Preview:', decodedText.substring(0, 100));

        // More flexible regex patterns that handle various formats (including end of string)
        const chiefComplaintMatch = decodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const hpiMatch = decodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const rosMatch = decodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):|$)/is);
        const peMatch = decodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):|$)/is);
        const assessmentMatch = decodedText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
        const planMatch = decodedText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|$)/is);

        const result = {
            chiefComplaint: chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '',
            hpi: hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '',
            rosNotes: rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '',
            peNotes: peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '',
            assessment: assessmentMatch ? decodeHtmlEntities(assessmentMatch[1].trim()) : '',
            plan: planMatch ? decodeHtmlEntities(planMatch[1].trim()) : ''
        };

        console.log('parseNoteText: Parsed result lengths:', {
            cc: result.chiefComplaint.length,
            hpi: result.hpi.length,
            ros: result.rosNotes.length,
            pe: result.peNotes.length,
            assessment: result.assessment.length,
            plan: result.plan.length
        });

        return result;
    };

    // Parse plan text back into structured format
    const parsePlanText = (planText) => {
        if (!planText || !planText.trim()) return [];
        const structured = [];
        const lines = planText.split('\n');
        let currentDiagnosis = null;
        let currentOrders = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Check if line is a diagnosis (starts with number and period)
            const diagnosisMatch = line.match(/^(\d+)\.\s*(.+)$/);
            if (diagnosisMatch) {
                // Save previous diagnosis if exists
                if (currentDiagnosis) {
                    structured.push({
                        diagnosis: currentDiagnosis,
                        orders: [...currentOrders]
                    });
                }
                // Start new diagnosis
                currentDiagnosis = diagnosisMatch[2].trim();
                currentOrders = [];
            } else if (line.startsWith('•') || line.startsWith('-')) {
                // This is an order line
                const orderText = line.replace(/^[•\-]\s*/, '').trim();
                if (orderText && currentDiagnosis) {
                    currentOrders.push(orderText);
                }
            } else if (line && currentDiagnosis) {
                // Continuation of previous order or new order without bullet
                currentOrders.push(line);
            }
        }

        // Don't forget the last diagnosis
        if (currentDiagnosis) {
            structured.push({
                diagnosis: currentDiagnosis,
                orders: currentOrders
            });
        }

        return structured;
    };

    const formatPlanText = (structuredPlan) => {
        if (!structuredPlan || structuredPlan.length === 0) return '';
        return structuredPlan.map((item, index) => {
            const diagnosisLine = `${index + 1}. ${item.diagnosis}`;
            const ordersLines = item.orders.map(order => `  • ${order}`).join('\n');
            return `${diagnosisLine}\n${ordersLines}`;
        }).join('\n\n');
    };

    const combineNoteSections = () => {
        const sections = [];
        if (noteData.chiefComplaint) sections.push(`Chief Complaint: ${noteData.chiefComplaint}`);
        if (noteData.hpi) sections.push(`HPI: ${noteData.hpi}`);

        // ROS - use rosNotes directly (ros checkbox object may not exist)
        if (noteData.rosNotes) {
            sections.push(`Review of Systems: ${noteData.rosNotes}`);
        }

        // PE - use peNotes directly (pe checkbox object may not exist)
        if (noteData.peNotes) {
            sections.push(`Physical Exam: ${noteData.peNotes}`);
        }

        if (noteData.assessment) sections.push(`Assessment: ${noteData.assessment}`);

        // Use structured plan if available, otherwise use plain plan text
        let planText = '';
        if (noteData.planStructured && noteData.planStructured.length > 0) {
            planText = formatPlanText(noteData.planStructured);
        } else if (noteData.plan) {
            planText = noteData.plan;
        }
        if (planText) sections.push(`Plan: ${planText}`);

        const combined = sections.join('\n\n');
        console.log('Combined note sections length:', combined.length);
        return combined;
    };

    // Find or create visit on mount
    useEffect(() => {
        // Always fetch patient data if we have a patient ID
        if (id) {
            // Fetch Patient Snapshot (Demographics, Problems, Meds, Allergies)
            patientsAPI.getSnapshot(id)
                .then(response => {
                    setPatientData(response.data);
                })
                .catch(error => console.error('Error fetching patient snapshot:', error));

            // Fetch Family History
            patientsAPI.getFamilyHistory(id)
                .then(response => setFamilyHistory(response.data || []))
                .catch(error => console.error('Error fetching family history:', error));

            // Fetch Social History
            patientsAPI.getSocialHistory(id)
                .then(response => setSocialHistory(response.data || {}))
                .catch(error => console.error('Error fetching social history:', error));
        }

        if (urlVisitId === 'new' && id) {
            console.log('Creating new visit for patient:', id);
            setLoading(true);
            visitsAPI.openToday(id, 'office_visit')
                .then(response => {
                    // New API returns { note: {...} }
                    const visit = response.data?.note || response.data;
                    console.log('Created visit:', visit);
                    if (!visit || !visit.id) {
                        throw new Error('Invalid visit response');
                    }
                    setCurrentVisitId(visit.id);
                    setVisitData(visit);
                    // Check status field or legacy fields
                    setIsSigned(visit.status === 'signed' || visit.locked || !!visit.note_signed_by || !!visit.note_signed_at);
                    hasInitialSaveRef.current = true; // Mark that we've created the visit
                    // Use navigate to properly update the route - this will trigger the useEffect to reload with new visitId
                    console.log('Navigating to visit:', `/patient/${id}/visit/${visit.id}`);
                    navigate(`/patient/${id}/visit/${visit.id}`, { replace: true });
                    // Don't set loading to false here - let the next useEffect (for visit/:visitId) handle it
                })
                .catch(error => {
                    console.error('Error finding or creating visit:', error);
                    console.error('Error details:', error.response?.data || error.message);
                    console.error('Error code:', error.code);
                    console.error('Full error:', error);

                    if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONNECTION_REFUSED')) {
                        showToast('Cannot connect to server. Please check if the server is running.', 'error');
                    } else {
                        showToast('Could not create visit. Please try again.', 'error');
                    }
                    setLoading(false);
                    // Navigate back to snapshot on error
                    setTimeout(() => navigate(`/patient/${id}/snapshot`), 2000);
                });
        } else if (urlVisitId && urlVisitId !== 'new') {
            console.log('Loading existing visit:', urlVisitId);
            setLoading(true);
            visitsAPI.get(urlVisitId)
                .then(response => {
                    console.log('Visit loaded successfully:', response.data?.id);
                    const visit = response.data;
                    setVisitData(visit);
                    setCurrentVisitId(visit.id);
                    setIsSigned(visit.locked || !!visit.note_signed_by || !!visit.note_signed_at);
                    if (visit.vitals) {
                        const v = typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals;
                        setVitals({
                            systolic: v.systolic || '',
                            diastolic: v.diastolic || '',
                            bp: v.bp || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : ''),
                            bpReadings: v.bpReadings || [],
                            temp: v.temp || '',
                            pulse: v.pulse || '',
                            resp: v.resp || '',
                            o2sat: v.o2sat || '',
                            weight: v.weight || '',
                            height: v.height || '',
                            bmi: v.bmi || '',
                            weightUnit: v.weightUnit || 'lbs',
                            heightUnit: v.heightUnit || 'in'
                        });
                    }
                    // Always try to parse note_draft, even if it appears empty
                    if (visit.note_draft) {
                        console.log('Loading note_draft, length:', visit.note_draft.length);
                        console.log('Note_draft preview:', visit.note_draft.substring(0, 200));
                        const parsed = parseNoteText(visit.note_draft);
                        console.log('Parsed note sections:', {
                            cc: parsed.chiefComplaint?.length || 0,
                            hpi: parsed.hpi?.length || 0,
                            ros: parsed.rosNotes?.length || 0,
                            pe: parsed.peNotes?.length || 0,
                            assessment: parsed.assessment?.length || 0,
                            plan: parsed.plan?.length || 0
                        });
                        // Parse plan text back into structured format if it exists
                        const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                        setNoteData(prev => ({
                            ...prev,
                            chiefComplaint: parsed.chiefComplaint || prev.chiefComplaint || '',
                            hpi: parsed.hpi || prev.hpi || '',
                            assessment: parsed.assessment || prev.assessment || '',
                            plan: parsed.plan || prev.plan || '',
                            rosNotes: parsed.rosNotes || prev.rosNotes || '',
                            peNotes: parsed.peNotes || prev.peNotes || '',
                            planStructured: planStructured.length > 0 ? planStructured : (prev.planStructured || [])
                        }));
                        if ((visit.locked || visit.note_signed_by || visit.note_signed_at) && parsed) {
                            setTimeout(() => generateAISummary(parsed, visit), 100);
                        }
                    } else {
                        // If no note_draft, ensure we have empty state
                        console.log('No note_draft found in visit');
                    }
                    setLoading(false);

                    // Mark that initial save should happen after autoSave is defined
                    hasInitialSaveRef.current = false; // Reset to trigger save on mount
                })
                .catch(error => {
                    console.error('Error loading visit:', error);
                    showToast('Could not load visit.', 'error');
                    setLoading(false);
                    // Set visitData to empty object so component can still render
                    setVisitData({});
                });
        } else {
            // No visit ID in URL - this shouldn't happen normally, but ensure we don't stay in loading state
            setLoading(false);
            setVisitData({});
        }
    }, [urlVisitId, id, navigate]);

    // Auto-save function (can be called with or without user action)
    const autoSave = useCallback(async (showToastMessage = false) => {
        if (isSigned || isSaving || isAutoSavingRef.current) return;
        if (!id) return; // Need patient ID

        isAutoSavingRef.current = true;

        try {
            const noteDraft = combineNoteSections();
            let visitId = currentVisitId || urlVisitId;

            // Create visit if it doesn't exist
            if (!visitId || visitId === 'new') {
                try {
                    const response = await visitsAPI.openToday(id, 'office_visit');
                    // New API returns { note: {...} }
                    const visit = response.data?.note || response.data;
                    if (!visit || !visit.id) {
                        throw new Error('Invalid visit response');
                    }
                    visitId = visit.id;
                    setCurrentVisitId(visitId);
                    setVisitData(visit);
                    window.history.replaceState({}, '', `/patient/${id}/visit/${visitId}`);
                    hasInitialSaveRef.current = true;
                } catch (error) {
                    console.error('Failed to create visit for auto-save:', error);
                    isAutoSavingRef.current = false;
                    return;
                }
            }

            if (visitId) {
                const vitalsToSave = {
                    systolic: vitals.systolic || null,
                    diastolic: vitals.diastolic || null,
                    bp: vitals.bp || (vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : null),
                    temp: vitals.temp || null,
                    pulse: vitals.pulse || null,
                    resp: vitals.resp || null,
                    o2sat: vitals.o2sat || null,
                    weight: vitals.weight || null,
                    height: vitals.height || null,
                    bmi: vitals.bmi || null,
                    weightUnit: vitals.weightUnit || 'lbs',
                    heightUnit: vitals.heightUnit || 'in'
                };

                // Save even if note is empty
                await visitsAPI.update(visitId, { noteDraft: noteDraft || '', vitals: vitalsToSave });

                const reloadResponse = await visitsAPI.get(visitId);
                setVisitData(reloadResponse.data);

                // Reload parsed data to ensure planStructured is reconstructed from saved plan
                if (reloadResponse.data.note_draft) {
                    const parsed = parseNoteText(reloadResponse.data.note_draft);
                    const planStructured = parsed.plan ? parsePlanText(parsed.plan) : (noteData.planStructured || []);
                    setNoteData(prev => ({
                        ...prev,
                        plan: parsed.plan || prev.plan,
                        planStructured: planStructured.length > 0 ? planStructured : prev.planStructured
                    }));
                }

                setLastSaved(new Date());
                hasInitialSaveRef.current = true;

                if (showToastMessage) {
                    showToast('Draft saved successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            if (showToastMessage) {
                showToast('Failed to save: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
            }
        } finally {
            isAutoSavingRef.current = false;
        }
    }, [id, currentVisitId, urlVisitId, isSigned, isSaving, noteData, vitals, combineNoteSections, parseNoteText, parsePlanText, showToast]);

    // Debounced auto-save function
    const scheduleAutoSave = useCallback((showToastMessage = false) => {
        // Clear any pending auto-save
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Schedule auto-save after 15 seconds of inactivity (reduced from 2s to prevent 429 errors)
        autoSaveTimeoutRef.current = setTimeout(() => {
            autoSave(showToastMessage);
        }, 15000);
    }, [autoSave]);

    // Manual save (shows toast)
    const handleSave = async () => {
        // Cancel any pending auto-save and save immediately
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = null;
        }
        await autoSave(true);
    };

    // Auto-save immediately when note is loaded/opened (even if empty)
    useEffect(() => {
        if (!loading && !isSigned && visitData && visitData.id && !hasInitialSaveRef.current) {
            // Auto-save immediately when note is opened to ensure visit exists with draft
            // This prevents data loss and ensures the draft is always saved
            const timer = setTimeout(() => {
                autoSave(false); // Silent save, no toast
                hasInitialSaveRef.current = true;
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, isSigned, visitData, autoSave]);

    // Auto-save on note data changes (debounced)
    useEffect(() => {
        if (hasInitialSaveRef.current && !isSigned && !loading) {
            scheduleAutoSave(false);
        }

        // Cleanup timeout on unmount
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [noteData, vitals, scheduleAutoSave, isSigned, loading]);

    const handleDelete = async () => {
        if (isSigned) {
            showToast('Cannot delete signed notes', 'error');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this draft note? This action cannot be undone.')) {
            return;
        }

        const visitId = currentVisitId || urlVisitId;
        if (!visitId || visitId === 'new') {
            // If it's a new visit that hasn't been saved, just navigate back
            navigate(`/patient/${id}/snapshot`);
            return;
        }

        try {
            await visitsAPI.delete(visitId);
            showToast('Draft note deleted successfully', 'success');
            setTimeout(() => navigate(`/patient/${id}/snapshot`), 1000);
        } catch (error) {
            console.error('Error deleting draft note:', error);
            showToast('Failed to delete draft note', 'error');
        }
    };

    const handleSign = async () => {
        if (isSigned || isSaving) return;
        setIsSaving(true);
        try {
            const noteDraft = combineNoteSections();
            let visitId = currentVisitId || urlVisitId;
            if (!visitId || visitId === 'new') {
                if (!id) {
                    showToast('Patient ID is missing', 'error');
                    setIsSaving(false);
                    return;
                }
                try {
                    const response = await visitsAPI.openToday(id, 'office_visit');
                    visitId = response.data.id;
                    setCurrentVisitId(visitId);
                    window.history.replaceState({}, '', `/patient/${id}/visit/${visitId}`);
                } catch (error) {
                    showToast('Failed to create visit. Please try again.', 'error');
                    setIsSaving(false);
                    return;
                }
            }
            if (visitId) {
                // First, save vitals and note draft to ensure everything is saved
                const vitalsToSave = {
                    systolic: vitals.systolic || null,
                    diastolic: vitals.diastolic || null,
                    bp: vitals.bp || (vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : null),
                    temp: vitals.temp || null,
                    pulse: vitals.pulse || null,
                    resp: vitals.resp || null,
                    o2sat: vitals.o2sat || null,
                    weight: vitals.weight || null,
                    height: vitals.height || null,
                    bmi: vitals.bmi || null,
                    weightUnit: vitals.weightUnit || 'lbs',
                    heightUnit: vitals.heightUnit || 'in'
                };

                // Save vitals first to ensure they're in the database
                console.log('Saving vitals before signing:', vitalsToSave);
                await visitsAPI.update(visitId, { noteDraft: noteDraft || '', vitals: vitalsToSave });

                // Then sign the note (vitals should already be saved, but include them as backup)
                console.log('Signing note with vitals:', vitalsToSave);
                await visitsAPI.sign(visitId, noteDraft, vitalsToSave);
                showToast('Note signed successfully', 'success');
                // Reload visit data to get signed status
                const response = await visitsAPI.get(visitId);
                const visit = response.data;
                setVisitData(visit);
                setIsSigned(visit.locked || !!visit.note_signed_by);
                // Ensure patient data is loaded
                if (id && !patientData) {
                    try {
                        const patientResponse = await patientsAPI.get(id);
                        setPatientData(patientResponse.data);
                    } catch (error) {
                        console.error('Error fetching patient:', error);
                    }
                }
            } else {
                showToast('Visit ID is missing', 'error');
            }
        } catch (error) {
            showToast('Failed to sign note: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDotPhrase = (phrase) => {
        const template = hpiDotPhrases[phrase];
        if (!template) return;
        const textarea = activeTextArea === 'hpi' ? hpiRef.current :
            activeTextArea === 'assessment' ? assessmentRef.current :
                activeTextArea === 'plan' ? planRef.current : null;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before.replace(new RegExp(`\\.${phrase.replace('.', '')}\\s*$`), '') + template + after;
            if (activeTextArea === 'hpi') {
                setNoteData({ ...noteData, hpi: newText });
            } else if (activeTextArea === 'assessment') {
                setNoteData({ ...noteData, assessment: newText });
            } else if (activeTextArea === 'plan') {
                setNoteData({ ...noteData, plan: newText });
            }
            setTimeout(() => {
                textarea.focus();
                const newPos = start + template.length;
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        }
        setShowDotPhraseModal(false);
        setDotPhraseSearch('');
        setActiveTextArea(null);
    };

    const handleF2Key = useCallback((e, textareaRef, field) => {
        if (e.key === 'F2' && textareaRef.current) {
            e.preventDefault();
            const textarea = textareaRef.current;
            const text = textarea.value;
            const cursorPos = textarea.selectionStart;
            const placeholderRegex = /\[([^\]]+)\]/g;
            let match;
            let found = false;
            while ((match = placeholderRegex.exec(text)) !== null) {
                if (match.index >= cursorPos) {
                    textarea.setSelectionRange(match.index, match.index + match[0].length);
                    found = true;
                    break;
                }
            }
            if (!found) {
                placeholderRegex.lastIndex = 0;
                match = placeholderRegex.exec(text);
                if (match) {
                    textarea.setSelectionRange(match.index, match.index + match[0].length);
                }
            }
        }
    }, []);

    const handleDotPhraseAutocomplete = useCallback((value, field, textareaRef) => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        // Only trigger if dot is at start of line/after whitespace AND has at least 1 letter after it
        // This prevents triggering on sentence-ending periods
        const dotPhraseMatch = textBeforeCursor.match(/(?:^|[\s\n])\.([a-z][a-z0-9_]*)$/i);
        if (dotPhraseMatch && dotPhraseMatch[1].length >= 1) {
            const partialPhrase = dotPhraseMatch[1].toLowerCase();
            const suggestions = Object.keys(hpiDotPhrases)
                .filter(key => {
                    const keyLower = key.toLowerCase().replace('.', '');
                    return keyLower.startsWith(partialPhrase) || keyLower.includes(partialPhrase);
                })
                .slice(0, 8)
                .map(key => ({ key, template: hpiDotPhrases[key], display: key }));
            if (suggestions.length > 0) {
                const lineHeight = 18;
                const lines = textBeforeCursor.split('\n');
                const currentLine = lines.length - 1;
                const top = (currentLine * lineHeight) + lineHeight + 2;
                const matchLen = dotPhraseMatch[0].startsWith('.') ? dotPhraseMatch[0].length : dotPhraseMatch[0].length - 1;
                setAutocompleteState({
                    show: true,
                    suggestions,
                    position: { top, left: 0 },
                    selectedIndex: 0,
                    field,
                    textareaRef,
                    matchStart: cursorPos - matchLen,
                    matchEnd: cursorPos
                });
            } else {
                setAutocompleteState(prev => ({ ...prev, show: false }));
            }
        } else {
            setAutocompleteState(prev => ({ ...prev, show: false }));
        }
    }, []);

    const insertDotPhrase = useCallback((phrase, autocompleteState) => {
        if (!autocompleteState.textareaRef?.current) return;
        const textarea = autocompleteState.textareaRef.current;
        const template = hpiDotPhrases[phrase];
        if (!template) return;
        const currentValue = textarea.value;
        const before = currentValue.substring(0, autocompleteState.matchStart);
        const after = currentValue.substring(autocompleteState.matchEnd);
        const newValue = before + template + after;
        if (autocompleteState.field === 'hpi') {
            setNoteData(prev => ({ ...prev, hpi: newValue }));
        } else if (autocompleteState.field === 'assessment') {
            setNoteData(prev => ({ ...prev, assessment: newValue }));
        } else if (autocompleteState.field === 'plan') {
            setNoteData(prev => ({ ...prev, plan: newValue }));
        }
        setTimeout(() => {
            const newCursorPos = before.length + template.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);
        setAutocompleteState(prev => ({ ...prev, show: false }));
    }, []);

    const handleTextChange = (value, field) => {
        const decoded = decodeHtmlEntities(value);
        if (field === 'hpi') {
            setNoteData({ ...noteData, hpi: decoded });
        } else if (field === 'assessment') {
            setNoteData({ ...noteData, assessment: decoded });
        } else if (field === 'plan') {
            setNoteData({ ...noteData, plan: decoded });
        }
    };

    // ICD-10 search - show popular codes when empty, search when 2+ characters
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                // If search is empty or less than 2 chars, show popular codes (first 50)
                // Otherwise, perform search
                const query = icd10Search.trim().length >= 2 ? icd10Search : '';
                const response = await codesAPI.searchICD10(query);
                setIcd10Results(response.data || []);
                // Auto-show results if we have codes and search box is focused or has content
                if (response.data && response.data.length > 0) {
                    setShowIcd10Search(true);
                }
            } catch (error) {
                setIcd10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    // Load popular codes on mount
    useEffect(() => {
        const loadPopularCodes = async () => {
            try {
                const response = await codesAPI.searchICD10('');
                if (response.data && response.data.length > 0) {
                    setIcd10Results(response.data);
                }
            } catch (error) {
                console.error('Error loading popular ICD-10 codes:', error);
            }
        };
        loadPopularCodes();
    }, []);

    const handleAddICD10 = async (code, addToProblem = false) => {
        if (addToProblem) {
            try {
                await patientsAPI.addProblem(id, { problemName: code.description, icd10Code: code.code, status: 'active' });
                showToast(`Added ${code.code} to problem list`, 'success');
            } catch (error) {
                console.error('Error adding to problem list:', error);
                showToast('Error adding to problem list', 'error');
            }
        }
        const newAssessment = noteData.assessment
            ? `${noteData.assessment}\n${code.code} - ${code.description}`
            : `${code.code} - ${code.description}`;
        setNoteData({ ...noteData, assessment: newAssessment });
        setShowIcd10Search(false);
        setIcd10Search('');
    };

    // Parse assessment to extract diagnoses - memoized to prevent infinite re-renders
    const diagnoses = useMemo(() => {
        if (!noteData.assessment) return [];
        const lines = noteData.assessment.split('\n').filter(line => line.trim());
        return lines.map(line => line.trim());
    }, [noteData.assessment]);

    // Add order to plan
    const addOrderToPlan = (diagnosis, orderText) => {
        let diagnosisToUse = diagnosis;

        // If diagnosis is new, add it to assessment
        if (diagnosis && !diagnoses.includes(diagnosis)) {
            const newAssessment = noteData.assessment
                ? `${noteData.assessment}\n${diagnosis}`
                : diagnosis;
            setNoteData(prev => ({ ...prev, assessment: newAssessment }));
        }

        // Find or create diagnosis entry in structured plan
        setNoteData(prev => {
            const currentPlan = prev.planStructured || [];
            const diagnosisIndex = currentPlan.findIndex(item => item.diagnosis === diagnosisToUse);

            let updatedPlan;
            if (diagnosisIndex >= 0) {
                // Add order to existing diagnosis
                updatedPlan = [...currentPlan];
                updatedPlan[diagnosisIndex] = {
                    ...updatedPlan[diagnosisIndex],
                    orders: [...updatedPlan[diagnosisIndex].orders, orderText]
                };
            } else {
                // Create new diagnosis entry
                updatedPlan = [...currentPlan, { diagnosis: diagnosisToUse, orders: [orderText] }];
            }

            const formattedPlan = formatPlanText(updatedPlan);
            return { ...prev, planStructured: updatedPlan, plan: formattedPlan };
        });
    };

    const removeFromPlan = (diagnosisIndex, orderIndex = null) => {
        setNoteData(prev => {
            const updatedPlan = [...(prev.planStructured || [])];
            if (orderIndex === null) {
                updatedPlan.splice(diagnosisIndex, 1);
            } else {
                const diag = updatedPlan[diagnosisIndex];
                const updatedOrders = [...diag.orders];
                updatedOrders.splice(orderIndex, 1);
                if (updatedOrders.length === 0) {
                    updatedPlan.splice(diagnosisIndex, 1);
                } else {
                    updatedPlan[diagnosisIndex] = { ...diag, orders: updatedOrders };
                }
            }
            const formattedPlan = formatPlanText(updatedPlan);
            return { ...prev, planStructured: updatedPlan, plan: formattedPlan };
        });
    };

    const removeDiagnosisFromAssessment = (index) => {
        setNoteData(prev => {
            const lines = prev.assessment.split('\n').filter(l => l.trim());
            lines.splice(index, 1);
            return { ...prev, assessment: lines.join('\n') };
        });
    };

    const generateAISummary = async (parsed, visit) => {
        if (generatingSummary || aiSummary) return;
        setGeneratingSummary(true);
        try {
            const summaryParts = [];
            if (parsed.hpi) summaryParts.push(`Chief complaint: ${parsed.hpi.substring(0, 100)}...`);
            if (parsed.assessment) summaryParts.push(`Diagnoses: ${parsed.assessment.substring(0, 100)}...`);
            if (parsed.plan) summaryParts.push(`Plan: ${parsed.plan.substring(0, 100)}...`);
            const summary = summaryParts.join(' ');
            setAiSummary(summary || 'Visit summary will be generated automatically.');
        } catch (error) {
            console.error('Error generating summary:', error);
        } finally {
            setGeneratingSummary(false);
        }
    };

    const convertWeight = (value, fromUnit, toUnit) => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        if (fromUnit === 'lbs' && toUnit === 'kg') {
            return (num / 2.20462).toFixed(1);
        } else if (fromUnit === 'kg' && toUnit === 'lbs') {
            return (num * 2.20462).toFixed(1);
        }
        return value;
    };

    const convertHeight = (value, fromUnit, toUnit) => {
        if (!value || fromUnit === toUnit) return value;
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        if (fromUnit === 'in' && toUnit === 'cm') {
            return (num * 2.54).toFixed(1);
        } else if (fromUnit === 'cm' && toUnit === 'in') {
            return (num / 2.54).toFixed(1);
        }
        return value;
    };

    const calculateBMI = (weight, weightUnit, height, heightUnit) => {
        let weightKg = weightUnit === 'lbs' ? parseFloat(weight) / 2.20462 : parseFloat(weight);
        let heightM;
        if (heightUnit === 'in') {
            heightM = parseFloat(height) * 0.0254;
        } else {
            heightM = parseFloat(height) / 100;
        }
        if (isNaN(weightKg) || isNaN(heightM) || heightM === 0) return '';
        return (weightKg / (heightM * heightM)).toFixed(1);
    };

    const isAbnormalVital = (type, value) => {
        if (!value || value === '') return false;
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        switch (type) {
            case 'systolic': return num < 90 || num > 140;
            case 'diastolic': return num < 60 || num > 90;
            case 'temp': return num < 97 || num > 99.5;
            case 'pulse': return num < 60 || num > 100;
            case 'resp': return num < 12 || num > 20;
            case 'o2sat': return num < 95;
            case 'bmi': return num < 18.5 || num > 25;
            default: return false;
        }
    };

    const getWeightChange = () => {
        if (!vitals.weight || !previousWeight) return null;
        const currentWeight = parseFloat(vitals.weight);
        const prevWeight = parseFloat(previousWeight);
        if (isNaN(currentWeight) || isNaN(prevWeight)) return null;
        let currentKg = vitals.weightUnit === 'lbs' ? currentWeight / 2.20462 : currentWeight;
        let prevKg = previousWeightUnit === 'lbs' ? prevWeight / 2.20462 : prevWeight;
        const change = currentKg - prevKg;
        const changeLbs = change * 2.20462;
        return { kg: change.toFixed(1), lbs: changeLbs.toFixed(1), percent: ((change / prevKg) * 100).toFixed(1) };
    };

    // Fetch previous visit weight
    useEffect(() => {
        const fetchPreviousWeight = async () => {
            if (!id || !currentVisitId) return;
            try {
                const response = await visitsAPI.getByPatient(id);
                const visits = response.data || [];
                const previousVisits = visits
                    .filter(v => v.id !== currentVisitId && v.vitals)
                    .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
                if (previousVisits.length > 0) {
                    const prevVisit = previousVisits[0];
                    const prevVitals = typeof prevVisit.vitals === 'string' ? JSON.parse(prevVisit.vitals) : prevVisit.vitals;
                    if (prevVitals && prevVitals.weight) {
                        setPreviousWeight(prevVitals.weight);
                        setPreviousWeightUnit(prevVitals.weightUnit || 'lbs');
                    }
                }
            } catch (error) {
                console.error('Error fetching previous weight:', error);
            }
        };
        if (currentVisitId && currentVisitId !== 'new') {
            fetchPreviousWeight();
        }
    }, [id, currentVisitId]);

    const filteredDotPhrases = useMemo(() => {
        if (!dotPhraseSearch.trim()) return [];
        const search = dotPhraseSearch.toLowerCase();
        return Object.keys(hpiDotPhrases)
            .filter(key => key.toLowerCase().includes(search))
            .slice(0, 10)
            .map(key => ({ key, template: hpiDotPhrases[key], source: 'hpi' }));
    }, [dotPhraseSearch]);

    const filteredHpiDotPhrases = useMemo(() => {
        if (!hpiDotPhraseSearch.trim()) return [];
        const search = hpiDotPhraseSearch.toLowerCase();
        return Object.keys(hpiDotPhrases)
            .filter(key => key.toLowerCase().includes(search))
            .slice(0, 20)
            .map(key => ({ key, template: hpiDotPhrases[key] }));
    }, [hpiDotPhraseSearch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-gray-600">Loading visit...</p>
                </div>
            </div>
        );
    }

    // Ensure visitData exists, use empty object if not
    const currentVisitData = visitData || {};
    const visitDate = currentVisitData.visit_date ? format(new Date(currentVisitData.visit_date), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy');

    // Get current logged-in user name
    const currentUserName = user
        ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim()
        : null;

    // Use signed_by name if note is signed and it's not "System Administrator"
    const signedByName = currentVisitData.signed_by_first_name && currentVisitData.signed_by_last_name
        ? `${currentVisitData.signed_by_first_name} ${currentVisitData.signed_by_last_name}`
        : null;

    // Get provider name from visit data
    const providerNameFromVisit = currentVisitData.provider_first_name && currentVisitData.provider_last_name
        ? `${currentVisitData.provider_first_name} ${currentVisitData.provider_last_name}`
        : null;

    // Determine display name priority:
    // 1. If signed and signed_by is valid (not "System Administrator"), use signed_by
    // 2. If not signed or signed_by is "System Administrator", use current logged-in user
    // 3. Fallback to provider from visit if current user not available
    // 4. Final fallback to "Provider"
    let displayName = 'Provider';

    if (isSigned && signedByName && signedByName !== 'System Administrator') {
        displayName = signedByName;
    } else if (currentUserName && currentUserName !== 'System Administrator') {
        // Use current logged-in user for unsigned notes or when signed_by is "System Administrator"
        displayName = currentUserName;
    } else if (providerNameFromVisit && providerNameFromVisit !== 'System Administrator') {
        displayName = providerNameFromVisit;
    }

    const providerName = displayName;

    // Signed notes now use the same template as editable notes, just with disabled inputs

    return (
        <div className="min-h-screen bg-white py-8">
            <div className="max-w-5xl mx-auto px-6">
                {/* Master Back Button */}
                <div className="mb-4">
                    <button onClick={() => navigate(-1)} className="flex items-center space-x-2 text-gray-600 hover:text-primary-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                </div>

                {/* Header */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                        <div>
                            <h1 className="text-base font-semibold text-neutral-900 mb-1">Office Visit Note</h1>
                            <p className="text-xs text-neutral-600">{visitDate} • {providerName}</p>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <button
                                onClick={() => { setPatientChartTab('history'); setShowPatientChart(!showPatientChart); }}
                                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border ${showPatientChart ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-neutral-700 border-gray-200 hover:bg-gray-50'}`}
                                title="Toggle Patient Chart Side Panel"
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Chart</span>
                            </button>
                            {isSigned && (
                                <div className="flex items-center space-x-2 text-green-700 text-xs font-medium">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Signed</span>
                                    {currentVisitData.note_signed_at && (
                                        <span className="text-neutral-500">
                                            {format(new Date(currentVisitData.note_signed_at), 'MM/dd/yyyy h:mm a')}
                                        </span>
                                    )}
                                </div>
                            )}
                            {!isSigned && (
                                <>
                                    {lastSaved && <span className="text-xs text-neutral-500 italic px-1.5">Saved {lastSaved.toLocaleTimeString()}</span>}
                                    <button onClick={handleSave} disabled={isSaving} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: isSaving ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')} onMouseLeave={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                    </button>
                                    <button onClick={handleSign} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Sign</span>
                                    </button>
                                </>
                            )}
                            <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Vitals */}
                    <Section title="Vital Signs" defaultOpen={true}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">BP (mmHg)</label>
                                <div className="flex items-center gap-1">
                                    <input ref={systolicRef} type="number" placeholder="120" value={vitals.systolic}
                                        onChange={(e) => {
                                            const sys = e.target.value;
                                            const bp = sys && vitals.diastolic ? `${sys}/${vitals.diastolic}` : '';
                                            setVitals({ ...vitals, systolic: sys, bp });
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); diastolicRef.current?.focus(); } }}
                                        disabled={isSigned}
                                        className={`w-14 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                    />
                                    <span className="text-neutral-400 text-xs font-medium px-0.5">/</span>
                                    <input ref={diastolicRef} type="number" placeholder="80" value={vitals.diastolic}
                                        onChange={(e) => {
                                            const dia = e.target.value;
                                            const bp = vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '';
                                            setVitals({ ...vitals, diastolic: dia, bp });
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pulseRef.current?.focus(); } }}
                                        disabled={isSigned}
                                        className={`w-14 px-1.5 py-1 text-xs border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-accent-500 focus:border-accent-500 disabled:bg-white disabled:text-gray-900 transition-colors ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-600 font-semibold border-red-300' : 'text-gray-900'}`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">HR (bpm)</label>
                                <input ref={pulseRef} type="number" placeholder="72" value={vitals.pulse}
                                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); o2satRef.current?.focus(); } }}
                                    disabled={isSigned}
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('pulse', vitals.pulse) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">O2 Sat (%)</label>
                                <input ref={o2satRef} type="number" placeholder="98" value={vitals.o2sat}
                                    onChange={(e) => setVitals({ ...vitals, o2sat: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tempRef.current?.focus(); } }}
                                    disabled={isSigned}
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('o2sat', vitals.o2sat) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Temp (°F)</label>
                                <input ref={tempRef} type="number" step="0.1" placeholder="98.6" value={vitals.temp}
                                    onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); weightRef.current?.focus(); } }}
                                    disabled={isSigned}
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('temp', vitals.temp) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">
                                    Weight
                                    {previousWeight && (() => {
                                        const change = getWeightChange();
                                        if (!change) return null;
                                        const isIncrease = parseFloat(change.lbs) > 0;
                                        return <span className={`ml-1.5 text-xs font-normal ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>({isIncrease ? '+' : ''}{change.lbs} lbs)</span>;
                                    })()}
                                </label>
                                <div className="flex items-center gap-1">
                                    <input ref={weightRef} type="text" value={vitals.weight || ''}
                                        onChange={(e) => {
                                            const weight = e.target.value;
                                            const newVitals = { ...vitals, weight };
                                            if (weight && vitals.height) {
                                                newVitals.bmi = calculateBMI(weight, vitals.weightUnit, vitals.height, vitals.heightUnit);
                                            } else {
                                                newVitals.bmi = '';
                                            }
                                            setVitals(newVitals);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); heightRef.current?.focus(); } }}
                                        disabled={isSigned}
                                        className="w-16 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors text-neutral-900"
                                    />
                                    <div className="flex border border-neutral-300 rounded-md overflow-hidden flex-shrink-0">
                                        <button type="button" onClick={() => {
                                            const newUnit = 'lbs';
                                            if (vitals.weight && vitals.weightUnit !== newUnit) {
                                                const converted = convertWeight(vitals.weight, vitals.weightUnit, newUnit);
                                                const newVitals = { ...vitals, weightUnit: newUnit, weight: converted };
                                                if (converted && vitals.height) newVitals.bmi = calculateBMI(converted, newUnit, vitals.height, vitals.heightUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({ ...vitals, weightUnit: newUnit });
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'lbs' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.weightUnit === 'lbs' ? { background: '#3B82F6' } : {}}>lbs</button>
                                        <button type="button" onClick={() => {
                                            const newUnit = 'kg';
                                            if (vitals.weight && vitals.weightUnit !== newUnit) {
                                                const converted = convertWeight(vitals.weight, vitals.weightUnit, newUnit);
                                                const newVitals = { ...vitals, weightUnit: newUnit, weight: converted };
                                                if (converted && vitals.height) newVitals.bmi = calculateBMI(converted, newUnit, vitals.height, vitals.heightUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({ ...vitals, weightUnit: newUnit });
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'kg' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.weightUnit === 'kg' ? { background: '#3B82F6' } : {}}>kg</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Height</label>
                                <div className="flex items-center gap-1">
                                    <input ref={heightRef} type="number" step="0.1" placeholder="70" value={vitals.height}
                                        onChange={(e) => {
                                            const height = e.target.value;
                                            const newVitals = { ...vitals, height };
                                            if (height && vitals.weight) {
                                                newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, height, vitals.heightUnit);
                                            } else {
                                                newVitals.bmi = '';
                                            }
                                            setVitals(newVitals);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hpiRef.current?.focus(); } }}
                                        disabled={isSigned}
                                        className="w-16 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors text-neutral-900"
                                    />
                                    <div className="flex border border-neutral-300 rounded-md overflow-hidden flex-shrink-0">
                                        <button type="button" onClick={() => {
                                            const newUnit = 'in';
                                            if (vitals.height && vitals.heightUnit !== newUnit) {
                                                const converted = convertHeight(vitals.height, vitals.heightUnit, newUnit);
                                                const newVitals = { ...vitals, heightUnit: newUnit, height: converted };
                                                if (converted && vitals.weight) newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, converted, newUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({ ...vitals, heightUnit: newUnit });
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'in' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.heightUnit === 'in' ? { background: '#3B82F6' } : {}}>in</button>
                                        <button type="button" onClick={() => {
                                            const newUnit = 'cm';
                                            if (vitals.height && vitals.heightUnit !== newUnit) {
                                                const converted = convertHeight(vitals.height, vitals.heightUnit, newUnit);
                                                const newVitals = { ...vitals, heightUnit: newUnit, height: converted };
                                                if (converted && vitals.weight) newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, converted, newUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({ ...vitals, heightUnit: newUnit });
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'cm' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.heightUnit === 'cm' ? { background: '#3B82F6' } : {}}>cm</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">BMI</label>
                                <input type="text" value={vitals.bmi || ''} readOnly placeholder="Auto"
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-gray-50 transition-colors ${vitals.bmi && isAbnormalVital('bmi', vitals.bmi) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Chief Complaint */}
                    <div className="mb-3">
                        <label className="block text-sm font-semibold text-neutral-900 mb-1">Chief Complaint</label>
                        <input type="text" placeholder="Enter chief complaint..." value={noteData.chiefComplaint || ''}
                            onChange={(e) => setNoteData({ ...noteData, chiefComplaint: e.target.value })}
                            disabled={isSigned}
                            className="w-full px-2 py-1.5 text-sm font-medium border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors text-neutral-900"
                        />
                    </div>

                    {/* HPI */}
                    <Section title="History of Present Illness (HPI)" defaultOpen={true}>
                        <div className="relative">
                            <textarea ref={hpiRef} value={noteData.hpi}
                                onChange={(e) => {
                                    handleTextChange(e.target.value, 'hpi');
                                    handleDotPhraseAutocomplete(e.target.value, 'hpi', hpiRef);
                                }}
                                onKeyDown={(e) => {
                                    if (autocompleteState.show && autocompleteState.field === 'hpi') {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({
                                                ...prev,
                                                selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
                                            }));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({
                                                ...prev,
                                                selectedIndex: Math.max(prev.selectedIndex - 1, 0)
                                            }));
                                        } else if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (autocompleteState.suggestions[autocompleteState.selectedIndex]) {
                                                insertDotPhrase(autocompleteState.suggestions[autocompleteState.selectedIndex].key, autocompleteState);
                                            }
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({ ...prev, show: false }));
                                        }
                                    } else {
                                        handleF2Key(e, hpiRef, 'hpi');
                                    }
                                }}
                                onFocus={() => setActiveTextArea('hpi')}
                                disabled={isSigned}
                                rows={6}
                                className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[80px]"
                                placeholder="Type .dotphrase to expand, or press F2 to find [] placeholders..."
                            />
                            {autocompleteState.show && autocompleteState.field === 'hpi' && autocompleteState.suggestions.length > 0 && (
                                <div className="absolute z-50 bg-white border border-neutral-300 rounded-md shadow-lg max-h-32 overflow-y-auto mt-0.5 w-64" style={{ top: `${autocompleteState.position.top}px` }}>
                                    {autocompleteState.suggestions.map((item, index) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => insertDotPhrase(item.key, autocompleteState)}
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
                                                }`}
                                        >
                                            <div className="font-medium text-neutral-900 text-xs">{item.key}</div>
                                            <div className="text-xs text-neutral-500 truncate">{item.template.substring(0, 60)}...</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-1.5 flex items-center space-x-1.5 text-xs text-neutral-500">
                            <button onClick={() => { setActiveTextArea('hpi'); setShowDotPhraseModal(true); }} className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 transition-colors">
                                <Zap className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Dot Phrases (F2)</span>
                            </button>
                        </div>
                    </Section>

                    {/* ROS and PE Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        {/* ROS */}
                        <Section title="Review of Systems" defaultOpen={true}>
                            <div className="grid grid-cols-2 gap-1 mb-1.5">
                                {Object.keys(noteData.ros).map(system => (
                                    <label key={system} className="flex items-center space-x-1 cursor-pointer">
                                        {noteData.ros[system] ? <CheckSquare className="w-3 h-3 text-primary-600" /> : <Square className="w-3 h-3 text-neutral-400" />}
                                        <span className="text-xs text-neutral-700 capitalize">{system}</span>
                                        <input type="checkbox" checked={noteData.ros[system]}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                const systemName = system.charAt(0).toUpperCase() + system.slice(1);
                                                const findings = rosFindings[system] || '';
                                                const newRos = { ...noteData.ros, [system]: isChecked };
                                                let newRosNotes = noteData.rosNotes || '';
                                                const findingsLine = `**${systemName}:** ${findings}`;
                                                if (isChecked) {
                                                    if (!newRosNotes.includes(`**${systemName}:**`)) {
                                                        newRosNotes = newRosNotes.trim() ? `${newRosNotes}\n${findingsLine}` : findingsLine;
                                                    }
                                                } else {
                                                    newRosNotes = newRosNotes.split('\n').filter(line => !line.trim().startsWith(`**${systemName}:**`)).join('\n').trim();
                                                }
                                                setNoteData({ ...noteData, ros: newRos, rosNotes: newRosNotes });
                                            }}
                                            disabled={isSigned}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                            <textarea value={noteData.rosNotes} onChange={(e) => setNoteData({ ...noteData, rosNotes: e.target.value })}
                                disabled={isSigned} rows={10}
                                className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px]"
                                placeholder="ROS notes..."
                            />
                            <button onClick={() => {
                                const allRos = {};
                                Object.keys(noteData.ros).forEach(key => { allRos[key] = true; });
                                let rosText = '';
                                Object.keys(rosFindings).forEach(key => {
                                    const systemName = key.charAt(0).toUpperCase() + key.slice(1);
                                    rosText += `**${systemName}:** ${rosFindings[key]}\n`;
                                });
                                setNoteData({ ...noteData, ros: allRos, rosNotes: rosText.trim() });
                            }} disabled={isSigned} className="mt-1.5 px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md disabled:opacity-50 transition-colors">
                                Pre-fill Normal ROS
                            </button>
                        </Section>

                        {/* Physical Exam */}
                        <Section title="Physical Examination" defaultOpen={true}>
                            <div className="grid grid-cols-2 gap-1 mb-1.5">
                                {Object.keys(noteData.pe).map(system => (
                                    <label key={system} className="flex items-center space-x-1 cursor-pointer">
                                        {noteData.pe[system] ? <CheckSquare className="w-3 h-3 text-primary-600" /> : <Square className="w-3 h-3 text-neutral-400" />}
                                        <span className="text-xs text-neutral-700 capitalize">{system.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <input type="checkbox" checked={noteData.pe[system]}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                const systemName = system.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                                const findings = peFindings[system] || '';
                                                const newPe = { ...noteData.pe, [system]: isChecked };
                                                let newPeNotes = noteData.peNotes || '';
                                                const findingsLine = `**${systemName}:** ${findings}`;
                                                if (isChecked) {
                                                    if (!newPeNotes.includes(`**${systemName}:**`)) {
                                                        newPeNotes = newPeNotes.trim() ? `${newPeNotes}\n${findingsLine}` : findingsLine;
                                                    }
                                                } else {
                                                    newPeNotes = newPeNotes.split('\n').filter(line => !line.trim().startsWith(`**${systemName}:**`)).join('\n').trim();
                                                }
                                                setNoteData({ ...noteData, pe: newPe, peNotes: newPeNotes });
                                            }}
                                            disabled={isSigned}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                            <textarea value={noteData.peNotes} onChange={(e) => setNoteData({ ...noteData, peNotes: e.target.value })}
                                disabled={isSigned} rows={10}
                                className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px]"
                                placeholder="PE findings..."
                            />
                            <button onClick={() => {
                                const allPe = {};
                                Object.keys(noteData.pe).forEach(key => { allPe[key] = true; });
                                let peText = '';
                                Object.keys(peFindings).forEach(key => {
                                    const systemName = key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                    peText += `**${systemName}:** ${peFindings[key]}\n`;
                                });
                                setNoteData({ ...noteData, pe: allPe, peNotes: peText.trim() });
                            }} disabled={isSigned} className="mt-1.5 px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md disabled:opacity-50 transition-colors">
                                Pre-fill Normal PE
                            </button>
                        </Section>
                    </div>

                    {/* PAMFOS Section - Past Medical, Allergies, Meds, Family, Social/Other */}
                    <Section title="Patient History (PAMFOS)" defaultOpen={true}>
                        <div className="bg-white p-1">
                            <div className="space-y-4">

                                {/* P - Past Medical History */}
                                <HistoryList
                                    title="Past Medical History"
                                    icon={<Activity className="w-4 h-4 text-red-600" />}
                                    items={patientData?.problems || []}
                                    emptyMessage="No active problems"
                                    renderItem={(problem) => (
                                        <div className="flex justify-between items-start w-full">
                                            <div>
                                                <span className="font-medium text-gray-900">{problem.problem_name}</span>
                                                {problem.icd10_code && <span className="text-gray-500 ml-2 text-xs">({problem.icd10_code})</span>}
                                            </div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${problem.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {problem.status}
                                            </span>
                                        </div>
                                    )}
                                    renderInput={(props) => <ProblemInput {...props} />}
                                    onAdd={async (data) => {
                                        try {
                                            const res = await patientsAPI.addProblem(id, data);
                                            setPatientData(prev => ({ ...prev, problems: [res.data, ...(prev.problems || [])] }));
                                            showToast('Problem added', 'success');
                                        } catch (e) { showToast('Failed to add problem', 'error'); }
                                    }}
                                    onDelete={async (itemId) => {
                                        if (!confirm('Are you sure?')) return;
                                        try {
                                            await patientsAPI.deleteProblem(itemId);
                                            setPatientData(prev => ({ ...prev, problems: prev.problems.filter(p => p.id !== itemId) }));
                                            showToast('Problem deleted', 'success');
                                        } catch (e) { showToast('Failed to delete problem', 'error'); }
                                    }}
                                />

                                {/* A - Allergies */}
                                <HistoryList
                                    title="Allergies"
                                    icon={<Activity className="w-4 h-4 text-orange-600" />}
                                    items={patientData?.allergies || []}
                                    emptyMessage="No known allergies"
                                    renderItem={(allergy) => (
                                        <div className="flex justify-between items-start w-full">
                                            <span className="font-medium text-red-700">{allergy.allergen}</span>
                                            {allergy.reaction && <span className="text-gray-500 text-xs mx-1">- {allergy.reaction}</span>}
                                            {allergy.severity && allergy.severity !== 'unknown' && <span className="text-gray-400 text-[10px] italic">({allergy.severity})</span>}
                                        </div>
                                    )}
                                    renderInput={(props) => <AllergyInput {...props} />}
                                    onAdd={async (data) => {
                                        try {
                                            const payload = typeof data === 'string' ? { allergen: data, severity: 'unknown' } : data;
                                            const res = await patientsAPI.addAllergy(id, payload);
                                            setPatientData(prev => ({ ...prev, allergies: [res.data, ...(prev.allergies || [])] }));
                                            showToast('Allergy added', 'success');
                                        } catch (e) { showToast('Failed to add allergy', 'error'); }
                                    }}
                                    onDelete={async (itemId) => {
                                        if (!confirm('Are you sure?')) return;
                                        try {
                                            await patientsAPI.deleteAllergy(itemId);
                                            setPatientData(prev => ({ ...prev, allergies: prev.allergies.filter(a => a.id !== itemId) }));
                                            showToast('Allergy deleted', 'success');
                                        } catch (e) { showToast('Failed to delete allergy', 'error'); }
                                    }}
                                />

                                {/* M - Medications */}
                                <HistoryList
                                    title="Home Medications"
                                    icon={<Pill className="w-4 h-4 text-blue-600" />}
                                    items={patientData?.medications || []}
                                    emptyMessage="No active medications"
                                    renderItem={(med) => (
                                        <div className="flex justify-between items-start w-full">
                                            <span className="font-medium text-gray-900">{med.medication_name}</span>
                                            <span className="text-gray-500 text-xs">
                                                {[med.dosage, med.frequency, med.route].filter(Boolean).join(' ')}
                                            </span>
                                        </div>
                                    )}
                                    renderInput={(props) => <MedicationInput {...props} />}
                                    onAdd={async (data) => {
                                        try {
                                            const res = await patientsAPI.addMedication(id, data);
                                            setPatientData(prev => ({ ...prev, medications: [res.data, ...(prev.medications || [])] }));
                                            showToast('Medication added', 'success');
                                        } catch (e) { showToast('Failed to add medication', 'error'); }
                                    }}
                                    onDelete={async (itemId) => {
                                        if (!confirm('Are you sure?')) return;
                                        try {
                                            await patientsAPI.deleteMedication(itemId);
                                            setPatientData(prev => ({ ...prev, medications: prev.medications.filter(m => m.id !== itemId) }));
                                            showToast('Medication deleted', 'success');
                                        } catch (e) { showToast('Failed to delete medication', 'error'); }
                                    }}
                                />

                                {/* F - Family History */}
                                <HistoryList
                                    title="Family History"
                                    icon={<Users className="w-4 h-4 text-purple-600" />}
                                    items={familyHistory}
                                    emptyMessage="No family history recorded"
                                    renderItem={(hist) => (
                                        <div className="flex justify-between items-start w-full">
                                            <span className="font-medium text-gray-900">{hist.condition}</span>
                                            <span className="text-gray-500 text-xs">{hist.relationship}</span>
                                        </div>
                                    )}
                                    renderInput={(props) => <FamilyHistoryInput {...props} />}
                                    onAdd={async (data) => {
                                        try {
                                            const res = await patientsAPI.addFamilyHistory(id, data);
                                            setFamilyHistory(prev => [res.data, ...prev]);
                                            showToast('Family history added', 'success');
                                        } catch (e) { showToast('Failed to add family history', 'error'); }
                                    }}
                                    onDelete={async (itemId) => {
                                        if (!confirm('Are you sure?')) return;
                                        try {
                                            await patientsAPI.deleteFamilyHistory(itemId);
                                            setFamilyHistory(prev => prev.filter(h => h.id !== itemId));
                                            showToast('Family history deleted', 'success');
                                        } catch (e) { showToast('Failed to delete family history', 'error'); }
                                    }}
                                />

                                {/* O/S - Social History */}
                                <div className="border rounded-md border-gray-100 bg-white">
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-100">
                                        <UserCircle className="w-4 h-4 text-teal-600" />
                                        <h4 className="text-sm font-semibold text-gray-800">Other / Social History</h4>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Smoking Status</label>
                                            <select
                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                value={socialHistory?.smoking_status || ''}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    try {
                                                        await patientsAPI.saveSocialHistory(id, { ...socialHistory, smoking_status: val });
                                                        setSocialHistory(prev => ({ ...prev, smoking_status: val }));
                                                    } catch (e) { showToast('Failed to update', 'error'); }
                                                }}
                                            >
                                                <option value="">Unknown</option>
                                                <option value="Never smoker">Never smoker</option>
                                                <option value="Former smoker">Former smoker</option>
                                                <option value="Current smoker">Current smoker</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Alcohol Use</label>
                                            <select
                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                value={socialHistory?.alcohol_use || ''}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    try {
                                                        await patientsAPI.saveSocialHistory(id, { ...socialHistory, alcohol_use: val });
                                                        setSocialHistory(prev => ({ ...prev, alcohol_use: val }));
                                                    } catch (e) { showToast('Failed to update', 'error'); }
                                                }}
                                            >
                                                <option value="">Unknown</option>
                                                <option value="None">None</option>
                                                <option value="Social">Social</option>
                                                <option value="Moderate">Moderate</option>
                                                <option value="Heavy">Heavy</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Occupation</label>
                                            <input
                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                value={socialHistory?.occupation || ''}
                                                placeholder="Occupation"
                                                onBlur={async (e) => {
                                                    const val = e.target.value;
                                                    try {
                                                        await patientsAPI.saveSocialHistory(id, { ...socialHistory, occupation: val });
                                                        setSocialHistory(prev => ({ ...prev, occupation: val }));
                                                    } catch (e) { showToast('Failed to update', 'error'); }
                                                }}
                                                onChange={(e) => setSocialHistory(prev => ({ ...prev, occupation: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* Assessment */}
                    <Section title="Assessment" defaultOpen={true}>
                        {/* Show structured list of diagnoses when not signed and diagnoses exist */}
                        {!isSigned && diagnoses.length > 0 && (
                            <div className="mb-2 border border-neutral-200 rounded-md bg-white p-2">
                                <div className="space-y-1">
                                    {diagnoses.map((diag, idx) => (
                                        <div key={idx} className="flex items-start justify-between py-1 px-2 hover:bg-neutral-50 rounded group transition-colors">
                                            <div className="flex-1 text-xs text-neutral-900">
                                                <span className="font-medium">{idx + 1}.</span> {diag}
                                            </div>
                                            <button
                                                onClick={() => removeDiagnosisFromAssessment(idx)}
                                                className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all ml-2"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {hasPrivilege('search_icd10') && (
                            <div className="mb-2">
                                <button
                                    onClick={() => setShowICD10Modal(true)}
                                    className="w-full px-3 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors flex items-center justify-center space-x-1"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Search ICD-10 Codes</span>
                                </button>
                            </div>
                        )}
                        <div className="relative">
                            <textarea ref={assessmentRef} value={noteData.assessment}
                                onChange={(e) => {
                                    handleTextChange(e.target.value, 'assessment');
                                    handleDotPhraseAutocomplete(e.target.value, 'assessment', assessmentRef);
                                }}
                                onKeyDown={(e) => {
                                    if (autocompleteState.show && autocompleteState.field === 'assessment') {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({
                                                ...prev,
                                                selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
                                            }));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({
                                                ...prev,
                                                selectedIndex: Math.max(prev.selectedIndex - 1, 0)
                                            }));
                                        } else if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (autocompleteState.suggestions[autocompleteState.selectedIndex]) {
                                                insertDotPhrase(autocompleteState.suggestions[autocompleteState.selectedIndex].key, autocompleteState);
                                            }
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setAutocompleteState(prev => ({ ...prev, show: false }));
                                        }
                                    } else {
                                        handleF2Key(e, assessmentRef, 'assessment');
                                    }
                                }}
                                onFocus={() => setActiveTextArea('assessment')}
                                disabled={isSigned}
                                rows={4}
                                className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[60px]"
                                placeholder="Enter diagnoses..."
                            />
                            {autocompleteState.show && autocompleteState.field === 'assessment' && autocompleteState.suggestions.length > 0 && (
                                <div className="absolute z-50 bg-white border border-neutral-300 rounded-md shadow-lg max-h-32 overflow-y-auto mt-0.5 w-64" style={{ top: `${autocompleteState.position.top}px` }}>
                                    {autocompleteState.suggestions.map((item, index) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => insertDotPhrase(item.key, autocompleteState)}
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
                                                }`}
                                        >
                                            <div className="font-medium text-neutral-900 text-xs">{item.key}</div>
                                            <div className="text-xs text-neutral-500 truncate">{item.template.substring(0, 60)}...</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* Plan */}
                    <Section title="Plan" defaultOpen={true}>
                        <div className="relative">
                            {/* Show structured plan preview only when editing and there's structured data */}
                            {!isSigned && noteData.planStructured && noteData.planStructured.length > 0 && (
                                <div className="mb-2 p-2 bg-neutral-50 rounded-md border border-neutral-200">
                                    <div className="space-y-3">
                                        {noteData.planStructured.map((item, index) => (
                                            <div key={index} className="border-b border-neutral-200 last:border-b-0 pb-2 last:pb-0 group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-bold underline text-xs text-neutral-900">
                                                        {index + 1}. {item.diagnosis}
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromPlan(index)}
                                                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all p-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <ul className="ml-4 space-y-0.5">
                                                    {item.orders.flatMap((order, orderIdx) => {
                                                        const orderParts = order.split(';').map(part => part.trim()).filter(part => part);
                                                        return orderParts.map((part, partIdx) => (
                                                            <li key={`${orderIdx}-${partIdx}`} className="text-xs text-neutral-900 flex items-center group/order">
                                                                <span className="mr-2 text-neutral-400">•</span>
                                                                <span className="flex-1">{part}</span>
                                                                <button
                                                                    onClick={() => removeFromPlan(index, orderIdx)}
                                                                    className="opacity-0 group-hover/order:opacity-100 text-neutral-300 hover:text-red-400 transition-all ml-2"
                                                                >
                                                                    <X className="w-2.5 h-2.5" />
                                                                </button>
                                                            </li>
                                                        ));
                                                    })}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Always show textarea - it will display formatted plan text when signed or when there's no structured plan */}
                            {(!noteData.planStructured || noteData.planStructured.length === 0 || isSigned) && (
                                <textarea ref={planRef} value={isSigned && noteData.planStructured && noteData.planStructured.length > 0 ? formatPlanText(noteData.planStructured) : noteData.plan}
                                    onChange={(e) => {
                                        handleTextChange(e.target.value, 'plan');
                                        handleDotPhraseAutocomplete(e.target.value, 'plan', planRef);
                                    }}
                                    onKeyDown={(e) => {
                                        if (autocompleteState.show && autocompleteState.field === 'plan') {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setAutocompleteState(prev => ({
                                                    ...prev,
                                                    selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
                                                }));
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setAutocompleteState(prev => ({
                                                    ...prev,
                                                    selectedIndex: Math.max(prev.selectedIndex - 1, 0)
                                                }));
                                            } else if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (autocompleteState.suggestions[autocompleteState.selectedIndex]) {
                                                    insertDotPhrase(autocompleteState.suggestions[autocompleteState.selectedIndex].key, autocompleteState);
                                                }
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setAutocompleteState(prev => ({ ...prev, show: false }));
                                            }
                                        } else {
                                            handleF2Key(e, planRef, 'plan');
                                        }
                                    }}
                                    onFocus={() => setActiveTextArea('plan')}
                                    disabled={isSigned}
                                    rows={6}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[80px]"
                                    placeholder="Plan text (auto-generated from orders)..."
                                />
                            )}
                            {autocompleteState.show && autocompleteState.field === 'plan' && autocompleteState.suggestions.length > 0 && (
                                <div className="absolute z-50 bg-white border border-neutral-300 rounded-md shadow-lg max-h-32 overflow-y-auto mt-0.5 w-64" style={{ top: `${autocompleteState.position.top}px` }}>
                                    {autocompleteState.suggestions.map((item, index) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => insertDotPhrase(item.key, autocompleteState)}
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
                                                }`}
                                        >
                                            <div className="font-medium text-neutral-900 text-xs">{item.key}</div>
                                            <div className="text-xs text-neutral-500 truncate">{item.template.substring(0, 60)}...</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!isSigned && (
                            <div className="mt-2 flex space-x-1.5">
                                {hasPrivilege('order_labs') && (
                                    <button
                                        onClick={() => {
                                            setOrderModalTab('labs');
                                            setShowOrderModal(true);
                                        }}
                                        className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors"
                                    >
                                        Add Order
                                    </button>
                                )}
                                {hasPrivilege('e_prescribe') && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowEPrescribeEnhanced(true);
                                            }}
                                            className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors"
                                        >
                                            e-Prescribe
                                        </button>
                                        <button
                                            onClick={() => {
                                                setOrderModalTab('medications');
                                                setShowOrderModal(true);
                                            }}
                                            className="px-2.5 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md border border-neutral-300 transition-colors"
                                        >
                                            Manual Rx
                                        </button>
                                    </>
                                )}
                                {hasPrivilege('create_referrals') && (
                                    <button
                                        onClick={() => {
                                            setOrderModalTab('referrals');
                                            setShowOrderModal(true);
                                        }}
                                        className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors"
                                    >
                                        Send Referral
                                    </button>
                                )}
                            </div>
                        )}
                    </Section>

                    {/* Bottom Action Buttons */}
                    {!isSigned && (
                        <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                {lastSaved && <span className="text-xs text-neutral-500 italic px-1.5">Saved {lastSaved.toLocaleTimeString()}</span>}
                                <button onClick={handleSave} disabled={isSaving} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: isSaving ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')} onMouseLeave={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button onClick={handleSign} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Sign</span>
                                </button>
                                <button onClick={handleDelete} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-colors text-xs font-medium">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                </button>
                            </div>
                            <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    {isSigned && (
                        <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-end">
                            <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <OrderModal
                isOpen={showOrderModal}
                onClose={() => setShowOrderModal(false)}
                initialTab={orderModalTab}
                diagnoses={diagnoses}
                onSuccess={(diagnosis, orderText) => {
                    addOrderToPlan(diagnosis, orderText);
                    showToast('Order added to plan', 'success');
                }}
            />
            <EPrescribeEnhanced
                isOpen={showEPrescribeEnhanced}
                onClose={() => setShowEPrescribeEnhanced(false)}
                onSuccess={(diagnosis, prescriptionText) => {
                    addOrderToPlan(diagnosis, prescriptionText);
                    showToast('Prescription added to plan', 'success');
                }}
                patientId={id}
                patientName={patientData ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() : ''}
                visitId={currentVisitId || urlVisitId}
                diagnoses={diagnoses}
            />
            {showPrintModal && <VisitPrint visitId={currentVisitId || urlVisitId} patientId={id} onClose={() => setShowPrintModal(false)} />}

            {/* Unified Patient Chart Panel */}
            <PatientChartPanel
                patientId={id}
                isOpen={showPatientChart}
                onClose={() => setShowPatientChart(false)}
                initialTab={patientChartTab}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Dot Phrase Modal */}
            {showDotPhraseModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowDotPhraseModal(false);
                    setDotPhraseSearch('');
                    setActiveTextArea(null);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
                                <Zap className="w-5 h-5 text-primary-600" />
                                <span>Dot Phrases</span>
                                {activeTextArea && <span className="text-sm font-normal text-ink-500">(Inserting into {activeTextArea.toUpperCase()})</span>}
                            </h3>
                            <button onClick={() => { setShowDotPhraseModal(false); setDotPhraseSearch(''); setActiveTextArea(null); }} className="p-1 hover:bg-primary-100 rounded">
                                <X className="w-5 h-5 text-ink-500" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-neutral-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <input type="text" value={dotPhraseSearch} onChange={(e) => setDotPhraseSearch(e.target.value)}
                                    placeholder="Search dot phrases..." className="w-full pl-11 pr-4 py-2.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" autoFocus />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredDotPhrases.length === 0 ? (
                                <div className="text-center text-ink-500 py-8">
                                    {dotPhraseSearch.trim() ? `No dot phrases found matching "${dotPhraseSearch}"` : 'Start typing to search dot phrases...'}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredDotPhrases.map((item, index) => {
                                        const template = hpiDotPhrases[item.key];
                                        return (
                                            <button key={`${item.key}-${index}`} onClick={() => handleDotPhrase(item.key)}
                                                className="w-full text-left p-3 border border-neutral-200 rounded-md hover:bg-primary-50 hover:border-neutral-300 transition-colors">
                                                <div className="font-medium text-ink-900 mb-1">{item.key}</div>
                                                <div className="text-sm text-ink-600 space-y-1 max-h-24 overflow-hidden">
                                                    {template.split(/[.\n]/).filter(s => s.trim()).slice(0, 4).map((sentence, idx) => (
                                                        <div key={idx} className="flex items-start">
                                                            <span className="text-ink-400 mr-2">•</span>
                                                            <span className="flex-1">{sentence.trim()}</span>
                                                        </div>
                                                    ))}
                                                    {template.split(/[.\n]/).filter(s => s.trim()).length > 4 && <div className="text-ink-400 italic">...</div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <PatientChartPanel
                patientId={id}
                isOpen={showPatientChart}
                onClose={() => setShowPatientChart(false)}
                initialTab={patientChartTab}
            />
        </div>
    );
};

export default VisitNote;
