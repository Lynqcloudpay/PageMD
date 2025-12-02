import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList, 
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History, UserCircle,
    Activity, CheckSquare, Square
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import { OrderModal, PrescriptionModal, ReferralModal } from '../components/ActionModals';
import VisitPrint from '../components/VisitPrint';
import PatientHistoryPanel from '../components/PatientHistoryPanel';
import PatientHub from '../components/PatientHub';
import { visitsAPI, codesAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';
import { hpiDotPhrases } from '../data/hpiDotPhrases';

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
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [showPatientHub, setShowPatientHub] = useState(false);
    const [patientData, setPatientData] = useState(null);
    
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
            patientsAPI.get(id)
                .then(patientResponse => {
                    setPatientData(patientResponse.data);
                })
                .catch(error => {
                    console.error('Error fetching patient:', error);
                });
        }
        
        if (urlVisitId === 'new' && id) {
            console.log('Creating new visit for patient:', id);
            setLoading(true);
            visitsAPI.findOrCreate(id, 'Office Visit')
                .then(response => {
                    const visit = response.data;
                    console.log('Created visit:', visit);
                    if (!visit || !visit.id) {
                        throw new Error('Invalid visit response');
                    }
                    setCurrentVisitId(visit.id);
                    setVisitData(visit);
                    setIsSigned(visit.locked || !!visit.note_signed_by || !!visit.note_signed_at);
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

    const handleSave = async () => {
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
                    const response = await visitsAPI.findOrCreate(id, 'Office Visit');
                    visitId = response.data.id;
                    setCurrentVisitId(visitId);
                    setVisitData(response.data);
                    window.history.replaceState({}, '', `/patient/${id}/visit/${visitId}`);
                } catch (error) {
                    showToast('Failed to create visit: ' + (error.response?.data?.error || error.message), 'error');
                    setIsSaving(false);
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
                showToast('Draft saved successfully', 'success');
            } else {
                showToast('Visit ID is missing', 'error');
            }
        } catch (error) {
            showToast('Failed to save: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
        } finally {
            setIsSaving(false);
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
                    const response = await visitsAPI.findOrCreate(id, 'Office Visit');
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
                setNoteData({...noteData, hpi: newText});
            } else if (activeTextArea === 'assessment') {
                setNoteData({...noteData, assessment: newText});
            } else if (activeTextArea === 'plan') {
                setNoteData({...noteData, plan: newText});
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
            setNoteData({...noteData, hpi: decoded});
        } else if (field === 'assessment') {
            setNoteData({...noteData, assessment: decoded});
        } else if (field === 'plan') {
            setNoteData({...noteData, plan: decoded});
        }
    };

    // ICD-10 search
    useEffect(() => {
        if (icd10Search.trim().length >= 2) {
            const timeout = setTimeout(async () => {
                try {
                    const response = await codesAPI.searchICD10(icd10Search);
                    setIcd10Results(response.data || []);
                } catch (error) {
                    setIcd10Results([]);
                }
            }, 300);
            return () => clearTimeout(timeout);
        } else {
            setIcd10Results([]);
        }
    }, [icd10Search]);

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
        setNoteData({...noteData, assessment: newAssessment});
        setShowIcd10Search(false);
        setIcd10Search('');
    };

    // Parse assessment to extract diagnoses
    const parseDiagnoses = () => {
        if (!noteData.assessment) return [];
        const lines = noteData.assessment.split('\n').filter(line => line.trim());
        return lines.map(line => line.trim());
    };

    // Format plan text from structured data
    const formatPlanText = (structuredPlan) => {
        if (!structuredPlan || structuredPlan.length === 0) return '';
        return structuredPlan.map((item, index) => {
            const diagnosisLine = `${index + 1}. ${item.diagnosis}`;
            const ordersLines = item.orders.map(order => `  • ${order}`).join('\n');
            return `${diagnosisLine}\n${ordersLines}`;
        }).join('\n\n');
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

    // Add order to plan
    const addOrderToPlan = (diagnosis, orderText) => {
        const diagnoses = parseDiagnoses();
        let diagnosisToUse = diagnosis;
        
        // If diagnosis is new, add it to assessment
        if (diagnosis && !diagnoses.includes(diagnosis)) {
            const newAssessment = noteData.assessment 
                ? `${noteData.assessment}\n${diagnosis}`
                : diagnosis;
            setNoteData(prev => ({...prev, assessment: newAssessment}));
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
            return {...prev, planStructured: updatedPlan, plan: formattedPlan};
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
    const providerName = currentVisitData.provider_first_name && currentVisitData.provider_last_name
        ? `${currentVisitData.provider_first_name} ${currentVisitData.provider_last_name}`
        : 'Provider';

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
                            <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} className={`p-1.5 rounded-md transition-colors ${showHistoryPanel ? 'bg-primary-200 text-primary-700' : 'text-neutral-600 hover:bg-primary-100'}`} title="Patient History">
                                <History className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setShowPatientHub(!showPatientHub)} className={`p-1.5 rounded-md transition-colors ${showPatientHub ? 'bg-primary-200 text-primary-700' : 'text-neutral-600 hover:bg-primary-100'}`} title="Patient Hub">
                                <UserCircle className="w-3.5 h-3.5" />
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
                                    <button onClick={handleSave} disabled={isSaving} className="px-2.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-colors text-xs font-medium">
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                    </button>
                                    <button onClick={handleSign} className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-colors text-xs font-medium">
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
                                            setVitals({...vitals, systolic: sys, bp});
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); diastolicRef.current?.focus(); }}}
                                        disabled={isSigned}
                                        className={`w-14 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                    />
                                    <span className="text-neutral-400 text-xs font-medium px-0.5">/</span>
                                    <input ref={diastolicRef} type="number" placeholder="80" value={vitals.diastolic}
                                        onChange={(e) => {
                                            const dia = e.target.value;
                                            const bp = vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '';
                                            setVitals({...vitals, diastolic: dia, bp});
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pulseRef.current?.focus(); }}}
                                        disabled={isSigned}
                                        className={`w-14 px-1.5 py-1 text-xs border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-accent-500 focus:border-accent-500 disabled:bg-white disabled:text-gray-900 transition-colors ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-600 font-semibold border-red-300' : 'text-gray-900'}`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">HR (bpm)</label>
                                <input ref={pulseRef} type="number" placeholder="72" value={vitals.pulse}
                                    onChange={(e) => setVitals({...vitals, pulse: e.target.value})}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); o2satRef.current?.focus(); }}}
                                    disabled={isSigned}
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('pulse', vitals.pulse) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">O2 Sat (%)</label>
                                <input ref={o2satRef} type="number" placeholder="98" value={vitals.o2sat}
                                    onChange={(e) => setVitals({...vitals, o2sat: e.target.value})}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tempRef.current?.focus(); }}}
                                    disabled={isSigned}
                                    className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors ${isAbnormalVital('o2sat', vitals.o2sat) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Temp (°F)</label>
                                <input ref={tempRef} type="number" step="0.1" placeholder="98.6" value={vitals.temp}
                                    onChange={(e) => setVitals({...vitals, temp: e.target.value})}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); weightRef.current?.focus(); }}}
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
                                            const newVitals = {...vitals, weight};
                                            if (weight && vitals.height) {
                                                newVitals.bmi = calculateBMI(weight, vitals.weightUnit, vitals.height, vitals.heightUnit);
                                            } else {
                                                newVitals.bmi = '';
                                            }
                                            setVitals(newVitals);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); heightRef.current?.focus(); }}}
                                        disabled={isSigned}
                                        className="w-16 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors text-neutral-900"
                                    />
                                    <div className="flex border border-neutral-300 rounded-md overflow-hidden flex-shrink-0">
                                        <button type="button" onClick={() => {
                                            const newUnit = 'lbs';
                                            if (vitals.weight && vitals.weightUnit !== newUnit) {
                                                const converted = convertWeight(vitals.weight, vitals.weightUnit, newUnit);
                                                const newVitals = {...vitals, weightUnit: newUnit, weight: converted};
                                                if (converted && vitals.height) newVitals.bmi = calculateBMI(converted, newUnit, vitals.height, vitals.heightUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({...vitals, weightUnit: newUnit});
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'lbs' ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 hover:bg-primary-50'} disabled:bg-white disabled:text-neutral-700`}>lbs</button>
                                        <button type="button" onClick={() => {
                                            const newUnit = 'kg';
                                            if (vitals.weight && vitals.weightUnit !== newUnit) {
                                                const converted = convertWeight(vitals.weight, vitals.weightUnit, newUnit);
                                                const newVitals = {...vitals, weightUnit: newUnit, weight: converted};
                                                if (converted && vitals.height) newVitals.bmi = calculateBMI(converted, newUnit, vitals.height, vitals.heightUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({...vitals, weightUnit: newUnit});
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'kg' ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 hover:bg-primary-50'} disabled:bg-white disabled:text-neutral-700`}>kg</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Height</label>
                                <div className="flex items-center gap-1">
                                    <input ref={heightRef} type="number" step="0.1" placeholder="70" value={vitals.height}
                                        onChange={(e) => {
                                            const height = e.target.value;
                                            const newVitals = {...vitals, height};
                                            if (height && vitals.weight) {
                                                newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, height, vitals.heightUnit);
                                            } else {
                                                newVitals.bmi = '';
                                            }
                                            setVitals(newVitals);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hpiRef.current?.focus(); }}}
                                        disabled={isSigned}
                                        className="w-16 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-white disabled:text-neutral-900 transition-colors text-neutral-900"
                                    />
                                    <div className="flex border border-neutral-300 rounded-md overflow-hidden flex-shrink-0">
                                        <button type="button" onClick={() => {
                                            const newUnit = 'in';
                                            if (vitals.height && vitals.heightUnit !== newUnit) {
                                                const converted = convertHeight(vitals.height, vitals.heightUnit, newUnit);
                                                const newVitals = {...vitals, heightUnit: newUnit, height: converted};
                                                if (converted && vitals.weight) newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, converted, newUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({...vitals, heightUnit: newUnit});
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'in' ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 hover:bg-primary-50'} disabled:bg-white disabled:text-neutral-700`}>in</button>
                                        <button type="button" onClick={() => {
                                            const newUnit = 'cm';
                                            if (vitals.height && vitals.heightUnit !== newUnit) {
                                                const converted = convertHeight(vitals.height, vitals.heightUnit, newUnit);
                                                const newVitals = {...vitals, heightUnit: newUnit, height: converted};
                                                if (converted && vitals.weight) newVitals.bmi = calculateBMI(vitals.weight, vitals.weightUnit, converted, newUnit);
                                                setVitals(newVitals);
                                            } else {
                                                setVitals({...vitals, heightUnit: newUnit});
                                            }
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'cm' ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 hover:bg-primary-50'} disabled:bg-white disabled:text-neutral-700`}>cm</button>
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
                            onChange={(e) => setNoteData({...noteData, chiefComplaint: e.target.value})}
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
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${
                                                index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
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
                                                const newRos = {...noteData.ros, [system]: isChecked};
                                                let newRosNotes = noteData.rosNotes || '';
                                                const findingsLine = `**${systemName}:** ${findings}`;
                                                if (isChecked) {
                                                    if (!newRosNotes.includes(`**${systemName}:**`)) {
                                                        newRosNotes = newRosNotes.trim() ? `${newRosNotes}\n${findingsLine}` : findingsLine;
                                                    }
                                                } else {
                                                    newRosNotes = newRosNotes.split('\n').filter(line => !line.trim().startsWith(`**${systemName}:**`)).join('\n').trim();
                                                }
                                                setNoteData({...noteData, ros: newRos, rosNotes: newRosNotes});
                                            }}
                                            disabled={isSigned}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                            <textarea value={noteData.rosNotes} onChange={(e) => setNoteData({...noteData, rosNotes: e.target.value})}
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
                                setNoteData({...noteData, ros: allRos, rosNotes: rosText.trim()});
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
                                                const newPe = {...noteData.pe, [system]: isChecked};
                                                let newPeNotes = noteData.peNotes || '';
                                                const findingsLine = `**${systemName}:** ${findings}`;
                                                if (isChecked) {
                                                    if (!newPeNotes.includes(`**${systemName}:**`)) {
                                                        newPeNotes = newPeNotes.trim() ? `${newPeNotes}\n${findingsLine}` : findingsLine;
                                                    }
                                                } else {
                                                    newPeNotes = newPeNotes.split('\n').filter(line => !line.trim().startsWith(`**${systemName}:**`)).join('\n').trim();
                                                }
                                                setNoteData({...noteData, pe: newPe, peNotes: newPeNotes});
                                            }}
                                            disabled={isSigned}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                            <textarea value={noteData.peNotes} onChange={(e) => setNoteData({...noteData, peNotes: e.target.value})}
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
                                setNoteData({...noteData, pe: allPe, peNotes: peText.trim()});
                            }} disabled={isSigned} className="mt-1.5 px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md disabled:opacity-50 transition-colors">
                                Pre-fill Normal PE
                            </button>
                        </Section>
                    </div>

                    {/* Assessment */}
                    <Section title="Assessment" defaultOpen={true}>
                        <div className="mb-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                <input type="text" placeholder="Search ICD-10 codes..." value={icd10Search}
                                    onChange={(e) => {
                                        setIcd10Search(e.target.value);
                                        setShowIcd10Search(e.target.value.trim().length > 0);
                                    }}
                                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                />
                            </div>
                        </div>
                        {showIcd10Search && icd10Results.length > 0 && (
                            <div className="mb-2 border border-neutral-200 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                                {icd10Results.map((code) => (
                                    <div key={code.code} className="flex items-center justify-between p-2 border-b border-neutral-100 hover:bg-primary-50 transition-colors">
                                        <button onClick={() => handleAddICD10(code, false)} className="flex-1 text-left">
                                            <div className="font-medium text-neutral-900 text-xs">{code.code}</div>
                                            <div className="text-xs text-neutral-600">{code.description}</div>
                                        </button>
                                        <button 
                                            onClick={() => handleAddICD10(code, true)} 
                                            className="ml-2 px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md transition-colors"
                                            title="Add to Problem List"
                                        >
                                            + Problem
                                        </button>
                                    </div>
                                ))}
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
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${
                                                index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
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
                                            <div key={index} className="border-b border-neutral-200 last:border-b-0 pb-2 last:pb-0">
                                                <div className="font-bold underline text-xs text-neutral-900 mb-1">
                                                    {index + 1}. {item.diagnosis}
                                                </div>
                                                <ul className="ml-4 space-y-0.5">
                                                    {item.orders.flatMap((order, orderIdx) => {
                                                        // Split orders that contain semicolons into separate bullet points
                                                        const orderParts = order.split(';').map(part => part.trim()).filter(part => part);
                                                        return orderParts.map((part, partIdx) => (
                                                            <li key={`${orderIdx}-${partIdx}`} className="text-xs text-neutral-900 list-disc">
                                                                {part}
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
                                            className={`w-full text-left px-2 py-1 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${
                                                index === autocompleteState.selectedIndex ? 'bg-primary-100' : ''
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
                                <button onClick={() => setShowOrderModal(true)} className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors">Add Order</button>
                                <button onClick={() => setShowPrescriptionModal(true)} className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors">e-Prescribe</button>
                                <button onClick={() => setShowReferralModal(true)} className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors">Send Referral</button>
                            </div>
                        )}
                    </Section>

                    {/* Bottom Action Buttons */}
                    {!isSigned && (
                        <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                {lastSaved && <span className="text-xs text-neutral-500 italic px-1.5">Saved {lastSaved.toLocaleTimeString()}</span>}
                                <button onClick={handleSave} disabled={isSaving} className="px-2.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-colors text-xs font-medium">
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button onClick={handleSign} className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-colors text-xs font-medium">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Sign</span>
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
                diagnoses={parseDiagnoses()}
                onSuccess={(diagnosis, orderText) => {
                    addOrderToPlan(diagnosis, orderText);
                    showToast('Order added to plan', 'success');
                }} 
            />
            <PrescriptionModal 
                isOpen={showPrescriptionModal} 
                onClose={() => setShowPrescriptionModal(false)} 
                diagnoses={parseDiagnoses()}
                onSuccess={(diagnosis, prescriptionText) => {
                    addOrderToPlan(diagnosis, prescriptionText);
                    showToast('Prescription added to plan', 'success');
                }} 
            />
            <ReferralModal 
                isOpen={showReferralModal} 
                onClose={() => setShowReferralModal(false)} 
                diagnoses={parseDiagnoses()}
                onSuccess={(diagnosis, referralText) => {
                    addOrderToPlan(diagnosis, referralText);
                    showToast('Referral added to plan', 'success');
                }} 
            />
            {showPrintModal && <VisitPrint visitId={currentVisitId || urlVisitId} patientId={id} onClose={() => setShowPrintModal(false)} />}
            <PatientHistoryPanel patientId={id} isOpen={showHistoryPanel} onClose={() => setShowHistoryPanel(false)} />
            <PatientHub patientId={id} isOpen={showPatientHub} onClose={() => setShowPatientHub(false)} />
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
        </div>
    );
};

export default VisitNote;
