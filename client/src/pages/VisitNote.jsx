import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList, 
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History,
    Activity, CheckSquare, Square, Trash2, FilePlus, AlertCircle, Layers, ChevronRight, Star, Edit2,
    UserCircle, Database, FileImage, FlaskConical, Heart, Pill, Upload
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import { OrderModal, PrescriptionModal, ReferralModal } from '../components/ActionModals';
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import CodeSearchModal from '../components/CodeSearchModal';
import VisitPrint from '../components/VisitPrint';
import PatientChartPanel from '../components/PatientChartPanel';
import ICD10HierarchySelector from '../components/ICD10HierarchySelector';
import PrintableOrders from '../components/PrintableOrders';
import { visitsAPI, codesAPI, patientsAPI, ordersetsAPI, icd10HierarchyAPI, ordersAPI } from '../services/api';
import { usePrivileges } from '../hooks/usePrivileges';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { hpiDotPhrases } from '../data/hpiDotPhrases';

// Utility function to convert markdown bold (**text**) to HTML bold
const markdownToHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

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

// Diagnosis Order Button Component - Shows dropdown menu for ordering
const DiagnosisOrderButton = ({ diagnosis, onOrderClick }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-all hover:shadow-sm flex items-center gap-1.5"
            >
                <span>{diagnosis}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </button>
            {showMenu && (
                <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="py-1">
                        <button
                            type="button"
                            onClick={() => {
                                onOrderClick('prescription');
                                setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                        >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            Prescription
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onOrderClick('lab');
                                setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                        >
                            <Activity className="w-3.5 h-3.5 text-green-600" />
                            Lab
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onOrderClick('referral');
                                setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                        >
                            <FilePlus className="w-3.5 h-3.5 text-orange-600" />
                            Referral
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onOrderClick('procedure');
                                setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                        >
                            <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                            Procedure
                        </button>
                    </div>
                </div>
            )}
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
    const [showEPrescribeEnhanced, setShowEPrescribeEnhanced] = useState(false);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [showOrdersetsModal, setShowOrdersetsModal] = useState(false);
    const [ordersets, setOrdersets] = useState([]);
    const [ordersetsSearch, setOrdersetsSearch] = useState('');
    const [ordersetsCategory, setOrdersetsCategory] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const ordersetsListRef = useRef(null);
    const [showCreateOrdersetModal, setShowCreateOrdersetModal] = useState(false);
    const [newOrderset, setNewOrderset] = useState({
        name: '',
        description: '',
        orders: [],
        currentOrderType: 'lab',
        currentOrderName: ''
    });
    const [preSelectedDiagnosisForOrder, setPreSelectedDiagnosisForOrder] = useState([]);
    const [planEditingState, setPlanEditingState] = useState({
        editingDiagnosis: null, // {diagnosisIndex: number}
        editingOrder: null, // {diagnosisIndex: number, orderIndex: number}
        addingOrder: null, // {diagnosisIndex: number}
        editDiagnosisValue: '',
        editOrderValue: '',
        newOrderValue: ''
    });
    const [showHierarchySelector, setShowHierarchySelector] = useState(false);
    const [selectedCodeForHierarchy, setSelectedCodeForHierarchy] = useState(null);
    const [selectedDescriptionForHierarchy, setSelectedDescriptionForHierarchy] = useState(null);
    const [codesWithHierarchy, setCodesWithHierarchy] = useState(new Set()); // Track which codes have hierarchies
    const [showAddOrderMenu, setShowAddOrderMenu] = useState(false);
    const addOrderMenuRef = useRef(null);
    const [checkingHierarchies, setCheckingHierarchies] = useState(false);
    const { hasPrivilege } = usePrivileges();
    const { user } = useAuth();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showPrintableOrders, setShowPrintableOrders] = useState(false);
    const [showPatientChart, setShowPatientChart] = useState(false);
    const [patientChartTab, setPatientChartTab] = useState('history');
    const [patientData, setPatientData] = useState(null);
    const [addendums, setAddendums] = useState([]);
    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [addendumText, setAddendumText] = useState('');
    const [showSignAddendumModal, setShowSignAddendumModal] = useState(false);
    const [addendumToSignIndex, setAddendumToSignIndex] = useState(null);
    const [clickedDiagnosis, setClickedDiagnosis] = useState(null);
    const [diagnosisMenuPosition, setDiagnosisMenuPosition] = useState({ x: 0, y: 0 });
    const diagnosisMenuRef = useRef(null);

    // Close diagnosis menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (diagnosisMenuRef.current && !diagnosisMenuRef.current.contains(event.target) && 
                !assessmentRef.current?.contains(event.target)) {
                setClickedDiagnosis(null);
            }
        };
        if (clickedDiagnosis) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [clickedDiagnosis]);
    
    // Patient chart data for editing in note
    const [patientChartData, setPatientChartData] = useState({
        allergies: [],
        medications: [],
        problems: [],
        familyHistory: [],
        socialHistory: null
    });
    
    // Track original patient chart data to detect deletions
    const originalPatientChartDataRef = useRef({
        allergies: [],
        medications: [],
        problems: [],
        familyHistory: [],
        socialHistory: null
    });
    
    // Auto-save tracking
    const autoSaveTimeoutRef = useRef(null);
    const patientChartDataSaveTimeoutRef = useRef(null);
    const hasInitialSaveRef = useRef(false);
    const isAutoSavingRef = useRef(false);
    
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
    const rosRef = useRef(null);
    const peRef = useRef(null);
    
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
            // Empty or whitespace text
            return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        }
        const decodedText = decodeHtmlEntities(text);
        // Parsing note text
        
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
        
        // Parsed note sections (verbose logging disabled)
        
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

    // Format patient background data for note
    const formatPatientBackgroundForNote = () => {
        const parts = [];
        
        // Allergies
        const activeAllergies = patientChartData.allergies.filter(a => a.active && a.allergen);
        if (activeAllergies.length > 0) {
            parts.push('**Allergies:**');
            activeAllergies.forEach(allergy => {
                let line = `- ${allergy.allergen}`;
                if (allergy.reaction) line += ` (Reaction: ${allergy.reaction})`;
                if (allergy.severity) line += ` [${allergy.severity}]`;
                parts.push(line);
            });
        }
        
        // Medications
        const activeMeds = patientChartData.medications.filter(m => m.active && m.medication_name);
        if (activeMeds.length > 0) {
            parts.push('**Current Medications:**');
            activeMeds.forEach(med => {
                let line = `- ${med.medication_name}`;
                if (med.dosage) line += ` ${med.dosage}`;
                if (med.frequency) line += ` ${med.frequency}`;
                if (med.route) line += ` ${med.route}`;
                parts.push(line);
            });
        }
        
        // Problems
        const activeProblems = patientChartData.problems.filter(p => p.status === 'active' && p.problem_name);
        if (activeProblems.length > 0) {
            parts.push('**Active Problems:**');
            activeProblems.forEach(problem => {
                let line = `- ${problem.problem_name}`;
                if (problem.icd10_code) line += ` (${problem.icd10_code})`;
                parts.push(line);
            });
        }
        
        // Family History
        const familyHistory = patientChartData.familyHistory.filter(fh => fh.condition);
        if (familyHistory.length > 0) {
            parts.push('**Family History:**');
            familyHistory.forEach(fh => {
                let line = `- ${fh.condition} (${fh.relationship})`;
                if (fh.age_at_diagnosis) line += ` - Diagnosed at age ${fh.age_at_diagnosis}`;
                if (fh.age_at_death) line += ` - Died at age ${fh.age_at_death}`;
                if (fh.notes) line += ` - ${fh.notes}`;
                parts.push(line);
            });
        }
        
        // Social History
        if (patientChartData.socialHistory) {
            const sh = patientChartData.socialHistory;
            const shParts = [];
            if (sh.smoking_status) {
                let line = `- Smoking: ${sh.smoking_status}`;
                if (sh.smoking_pack_years) line += ` (${sh.smoking_pack_years} pack-years)`;
                shParts.push(line);
            }
            if (sh.alcohol_use) {
                let line = `- Alcohol: ${sh.alcohol_use}`;
                if (sh.alcohol_quantity) line += ` (${sh.alcohol_quantity})`;
                shParts.push(line);
            }
            if (sh.drug_use) shParts.push(`- Drug Use: ${sh.drug_use}`);
            if (sh.exercise_frequency) shParts.push(`- Exercise: ${sh.exercise_frequency}`);
            if (sh.diet) shParts.push(`- Diet: ${sh.diet}`);
            if (sh.occupation) shParts.push(`- Occupation: ${sh.occupation}`);
            if (sh.living_situation) shParts.push(`- Living Situation: ${sh.living_situation}`);
            if (sh.notes) shParts.push(`- Notes: ${sh.notes}`);
            
            if (shParts.length > 0) {
                parts.push('**Social History:**');
                parts.push(...shParts);
            }
        }
        
        return parts.join('\n');
    };

    const combineNoteSections = () => {
        const sections = [];
        
        // Patient Background (from editable sections)
        const patientBackground = formatPatientBackgroundForNote();
        if (patientBackground) {
            sections.push(`Patient Background:\n${patientBackground}`);
        }
        
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
        // Combined note sections (verbose logging disabled)
        return combined;
    };

    // Fetch patient chart data (allergies, medications, problems, family history, social history)
    // For signed notes, use snapshot data; for unsigned notes, use current patient data
    const fetchPatientChartData = async (patientId, visit = null) => {
        try {
            // If note is signed, use snapshot data from visit (immutable)
            if (visit && (visit.note_signed_at || visit.locked) && visit.patient_snapshot) {
                try {
                    const snapshot = typeof visit.patient_snapshot === 'string' 
                        ? JSON.parse(visit.patient_snapshot) 
                        : visit.patient_snapshot;
                    
                    const chartData = {
                        allergies: snapshot.allergies || [],
                        medications: snapshot.medications || [],
                        problems: snapshot.problems || [],
                        familyHistory: snapshot.familyHistory || [],
                        socialHistory: snapshot.socialHistory || null
                    };
                    setPatientChartData(chartData);
                    // Store original data (from snapshot for signed notes)
                    originalPatientChartDataRef.current = {
                        allergies: [...(snapshot.allergies || [])],
                        medications: [...(snapshot.medications || [])],
                        problems: [...(snapshot.problems || [])],
                        familyHistory: [...(snapshot.familyHistory || [])],
                        socialHistory: snapshot.socialHistory ? { ...snapshot.socialHistory } : null
                    };
                    console.log('Using snapshot data for signed note');
                    return; // Don't fetch current data for signed notes
                } catch (snapshotError) {
                    console.error('Error parsing snapshot, falling back to current data:', snapshotError);
                    // Fall through to fetch current data if snapshot is invalid
                }
            }
            
            // For unsigned notes, fetch current patient data
            const [allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes] = await Promise.all([
                patientsAPI.getAllergies(patientId).catch(() => ({ data: [] })),
                patientsAPI.getMedications(patientId).catch(() => ({ data: [] })),
                patientsAPI.getProblems(patientId).catch(() => ({ data: [] })),
                patientsAPI.getFamilyHistory(patientId).catch(() => ({ data: [] })),
                patientsAPI.getSocialHistory(patientId).catch(() => ({ data: null }))
            ]);
            
            const chartData = {
                allergies: allergiesRes.data || [],
                medications: medicationsRes.data || [],
                problems: problemsRes.data || [],
                familyHistory: familyHistoryRes.data || [],
                socialHistory: socialHistoryRes.data || null
            };
            setPatientChartData(chartData);
            // Store original data to detect deletions (deep copy)
            originalPatientChartDataRef.current = {
                allergies: (allergiesRes.data || []).map(a => ({ ...a })),
                medications: (medicationsRes.data || []).map(m => ({ ...m })),
                problems: (problemsRes.data || []).map(p => ({ ...p })),
                familyHistory: (familyHistoryRes.data || []).map(fh => ({ ...fh })),
                socialHistory: socialHistoryRes.data ? { ...socialHistoryRes.data } : null
            };
            
            // Auto-populate note sections with existing data if note is new/empty
            if (!visit?.note_draft || !visit.note_draft.trim()) {
                autoPopulateNoteFromChart({
                    allergies: allergiesRes.data || [],
                    medications: medicationsRes.data || [],
                    problems: problemsRes.data || [],
                    familyHistory: familyHistoryRes.data || [],
                    socialHistory: socialHistoryRes.data || null
                });
            }
        } catch (error) {
            console.error('Error fetching patient chart data:', error);
        }
    };
    
    // Auto-populate note sections with patient chart data
    const autoPopulateNoteFromChart = (chartData) => {
        // Format allergies
        let allergiesText = '';
        if (chartData.allergies && chartData.allergies.length > 0) {
            allergiesText = '**Allergies:**\n';
            chartData.allergies.filter(a => a.active).forEach(allergy => {
                allergiesText += `- ${allergy.allergen}`;
                if (allergy.reaction) allergiesText += ` (Reaction: ${allergy.reaction})`;
                if (allergy.severity) allergiesText += ` [${allergy.severity}]`;
                allergiesText += '\n';
            });
        }
        
        // Format medications
        let medicationsText = '';
        if (chartData.medications && chartData.medications.length > 0) {
            medicationsText = '**Current Medications:**\n';
            chartData.medications.filter(m => m.active).forEach(med => {
                medicationsText += `- ${med.medication_name}`;
                if (med.dosage) medicationsText += ` ${med.dosage}`;
                if (med.frequency) medicationsText += ` ${med.frequency}`;
                if (med.route) medicationsText += ` ${med.route}`;
                medicationsText += '\n';
            });
        }
        
        // Format problems
        let problemsText = '';
        if (chartData.problems && chartData.problems.length > 0) {
            problemsText = '**Active Problems:**\n';
            chartData.problems.filter(p => p.status === 'active').forEach(problem => {
                problemsText += `- ${problem.problem_name}`;
                if (problem.icd10_code) problemsText += ` (${problem.icd10_code})`;
                problemsText += '\n';
            });
        }
        
        // Format family history
        let familyHistoryText = '';
        if (chartData.familyHistory && chartData.familyHistory.length > 0) {
            familyHistoryText = '**Family History:**\n';
            chartData.familyHistory.forEach(fh => {
                familyHistoryText += `- ${fh.condition} (${fh.relationship})`;
                if (fh.age_at_diagnosis) familyHistoryText += ` - Diagnosed at age ${fh.age_at_diagnosis}`;
                if (fh.age_at_death) familyHistoryText += ` - Died at age ${fh.age_at_death}`;
                if (fh.notes) familyHistoryText += ` - ${fh.notes}`;
                familyHistoryText += '\n';
            });
        }
        
        // Format social history
        let socialHistoryText = '';
        if (chartData.socialHistory) {
            socialHistoryText = '**Social History:**\n';
            if (chartData.socialHistory.smoking_status) {
                socialHistoryText += `- Smoking: ${chartData.socialHistory.smoking_status}`;
                if (chartData.socialHistory.smoking_pack_years) socialHistoryText += ` (${chartData.socialHistory.smoking_pack_years} pack-years)`;
                socialHistoryText += '\n';
            }
            if (chartData.socialHistory.alcohol_use) {
                socialHistoryText += `- Alcohol: ${chartData.socialHistory.alcohol_use}`;
                if (chartData.socialHistory.alcohol_quantity) socialHistoryText += ` (${chartData.socialHistory.alcohol_quantity})`;
                socialHistoryText += '\n';
            }
            if (chartData.socialHistory.drug_use) socialHistoryText += `- Drug Use: ${chartData.socialHistory.drug_use}\n`;
            if (chartData.socialHistory.exercise_frequency) socialHistoryText += `- Exercise: ${chartData.socialHistory.exercise_frequency}\n`;
            if (chartData.socialHistory.diet) socialHistoryText += `- Diet: ${chartData.socialHistory.diet}\n`;
            if (chartData.socialHistory.occupation) socialHistoryText += `- Occupation: ${chartData.socialHistory.occupation}\n`;
            if (chartData.socialHistory.living_situation) socialHistoryText += `- Living Situation: ${chartData.socialHistory.living_situation}\n`;
            if (chartData.socialHistory.notes) socialHistoryText += `- Notes: ${chartData.socialHistory.notes}\n`;
        }
        
        // Combine into patient background section
        // Do not autopopulate HPI with patient background
        // Patient background is available via the "Load Patient Background" button if needed
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
            
            // Fetch patient chart data for editing in note (will use snapshot if visit is signed)
            // Note: visitData may not be loaded yet, so we'll fetch it again after visit loads
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
            // Loading existing visit
            setLoading(true);
            visitsAPI.get(urlVisitId)
                .then(response => {
                    // Visit loaded successfully
                    const visit = response.data;
                    setVisitData(visit);
                    setCurrentVisitId(visit.id);
                    setIsSigned(visit.locked || !!visit.note_signed_by || !!visit.note_signed_at);
                    
                    // Load addendums
                    if (visit.addendums) {
                        const addendumsData = Array.isArray(visit.addendums) 
                            ? visit.addendums 
                            : JSON.parse(visit.addendums || '[]');
                        setAddendums(addendumsData);
                    } else {
                        setAddendums([]);
                    }
                    
                    // Load patient chart data (uses snapshot if signed)
                    fetchPatientChartData(id, visit);
                    if (visit.vitals) {
                        const v = typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals;
                        // Decode HTML entities in vitals values to prevent double encoding (handle deeply nested encoding)
                        const decodeValue = (val) => {
                            if (!val || typeof val !== 'string') return val;
                            let decoded = val;
                            // Handle deeply nested encoding (multiple passes may be needed)
                            let previous = '';
                            while (decoded !== previous) {
                                previous = decoded;
                                decoded = decoded
                                    .replace(/&amp;amp;/g, '&')
                                    .replace(/&amp;#x2F;/g, '/')
                                    .replace(/&amp;#47;/g, '/')
                                    .replace(/&amp;lt;/g, '<')
                                    .replace(/&amp;gt;/g, '>')
                                    .replace(/&amp;quot;/g, '"')
                                    .replace(/&amp;apos;/g, "'")
                                    .replace(/&#x2F;/g, '/')
                                    .replace(/&#47;/g, '/')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#39;/g, "'");
                            }
                            return decoded;
                        };
                        const decodedSystolic = decodeValue(v.systolic);
                        const decodedDiastolic = decodeValue(v.diastolic);
                        const decodedBp = decodeValue(v.bp) || (decodedSystolic && decodedDiastolic ? `${decodedSystolic}/${decodedDiastolic}` : '');
                        setVitals({
                            systolic: decodedSystolic || '',
                            diastolic: decodedDiastolic || '',
                            bp: decodedBp,
                            bpReadings: v.bpReadings || [],
                            temp: decodeValue(v.temp) || '',
                            pulse: decodeValue(v.pulse) || '',
                            resp: decodeValue(v.resp) || '',
                            o2sat: decodeValue(v.o2sat) || '',
                            weight: decodeValue(v.weight) || '',
                            height: decodeValue(v.height) || '',
                            bmi: decodeValue(v.bmi) || '',
                            weightUnit: v.weightUnit || 'lbs',
                            heightUnit: v.heightUnit || 'in'
                        });
                    }
                    // Always try to parse note_draft, even if it appears empty
                    if (visit.note_draft) {
                        // Loading note_draft
                        const parsed = parseNoteText(visit.note_draft);
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

    // Fetch patient data
    useEffect(() => {
        const fetchPatient = async () => {
            if (!id) return;
            try {
                const response = await patientsAPI.get(id);
                setPatientData(response.data);
            } catch (error) {
                console.error('Error fetching patient data:', error);
            }
        };
        fetchPatient();
    }, [id]);

    // Close add order menu when clicking outside and position it correctly
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (addOrderMenuRef.current && !addOrderMenuRef.current.contains(event.target)) {
                // Check if click is on the button that opens the menu
                const button = event.target.closest('button');
                if (button && button.textContent?.includes('Add Order')) {
                    return; // Don't close if clicking the button itself
                }
                setShowAddOrderMenu(false);
            }
        };

        const positionMenu = () => {
            if (showAddOrderMenu && addOrderMenuRef.current) {
                // Find the button by looking for the one with "Add Order" text
                const buttons = Array.from(document.querySelectorAll('button'));
                const button = buttons.find(btn => {
                    const span = btn.querySelector('span');
                    return span && span.textContent === 'Add Order';
                });
                
                if (button) {
                    const rect = button.getBoundingClientRect();
                    const menu = addOrderMenuRef.current;
                    const menuHeight = menu.offsetHeight || 150;
                    const viewportHeight = window.innerHeight;
                    const viewportWidth = window.innerWidth;
                    
                    // Position below button by default
                    let top = rect.bottom + 4;
                    let left = rect.left;
                    
                    // If menu would go below viewport, position it above
                    if (top + menuHeight > viewportHeight - 10) {
                        top = rect.top - menuHeight - 4;
                    }
                    
                    // Ensure menu doesn't go above viewport
                    if (top < 10) {
                        top = 10;
                    }
                    
                    // Ensure menu doesn't go off right edge
                    const menuWidth = Math.max(rect.width, 160);
                    if (left + menuWidth > viewportWidth - 10) {
                        left = viewportWidth - menuWidth - 10;
                    }
                    
                    // Ensure menu doesn't go off left edge
                    if (left < 10) {
                        left = 10;
                    }
                    
                    menu.style.position = 'fixed';
                    menu.style.top = `${top}px`;
                    menu.style.left = `${left}px`;
                    menu.style.width = `${menuWidth}px`;
                    menu.style.zIndex = '9999';
                }
            }
        };

        if (showAddOrderMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            // Position menu after it renders
            setTimeout(positionMenu, 0);
            // Reposition on scroll/resize
            window.addEventListener('scroll', positionMenu, true);
            window.addEventListener('resize', positionMenu);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', positionMenu, true);
            window.removeEventListener('resize', positionMenu);
        };
    }, [showAddOrderMenu]);

    // Save patient chart data changes
    // CRITICAL: Never save patient chart data for signed notes - they are immutable legal documents
    const savePatientChartData = useCallback(async (patientId) => {
        // Prevent saving if note is signed
        if (isSigned) {
            console.warn('Attempted to save patient chart data for signed note - blocked for legal compliance');
            return;
        }
        
        try {
            // Handle deletions first - find items that were in original but not in current
            const originalAllergies = originalPatientChartDataRef.current.allergies || [];
            const currentAllergyIds = new Set(patientChartData.allergies.map(a => a.id).filter(Boolean));
            const deletedAllergies = originalAllergies.filter(a => a.id && !a.id.startsWith('temp-') && !currentAllergyIds.has(a.id));
            
            // Delete removed allergies
            for (const allergy of deletedAllergies) {
                if (allergy.id) {
                    try {
                        await patientsAPI.deleteAllergy(allergy.id);
                    } catch (error) {
                        // Ignore 404 errors - item might already be deleted
                        if (error.response?.status !== 404) {
                            console.error('Error deleting allergy:', error);
                        }
                    }
                }
            }
            
            // Save allergies (create/update)
            for (const allergy of patientChartData.allergies) {
                if (allergy.id && allergy.id.startsWith('temp-')) {
                    // New allergy - create
                    if (allergy.allergen) {
                        await patientsAPI.addAllergy(patientId, {
                            allergen: allergy.allergen,
                            reaction: allergy.reaction || null,
                            severity: allergy.severity || 'Mild',
                            active: allergy.active !== false
                        });
                    }
                } else if (allergy.id) {
                    // Existing allergy - update
                    try {
                        await patientsAPI.updateAllergy(allergy.id, {
                            allergen: allergy.allergen,
                            reaction: allergy.reaction || null,
                            severity: allergy.severity || 'Mild',
                            active: allergy.active !== false
                        });
                    } catch (error) {
                        // If 404, item was deleted - create new one
                        if (error.response?.status === 404 && allergy.allergen) {
                            await patientsAPI.addAllergy(patientId, {
                                allergen: allergy.allergen,
                                reaction: allergy.reaction || null,
                                severity: allergy.severity || 'Mild',
                                active: allergy.active !== false
                            });
                        } else {
                            throw error;
                        }
                    }
                }
            }
            
            // Handle medication deletions
            const originalMedications = originalPatientChartDataRef.current.medications || [];
            const currentMedicationIds = new Set(patientChartData.medications.map(m => m.id).filter(Boolean));
            const deletedMedications = originalMedications.filter(m => m.id && !m.id.startsWith('temp-') && !currentMedicationIds.has(m.id));
            
            // Delete removed medications
            for (const med of deletedMedications) {
                if (med.id) {
                    try {
                        await patientsAPI.deleteMedication(med.id);
                    } catch (error) {
                        // Ignore 404 errors - item might already be deleted
                        if (error.response?.status !== 404) {
                            console.error('Error deleting medication:', error);
                        }
                    }
                }
            }
            
            // Save medications (create/update)
            for (const med of patientChartData.medications) {
                if (med.id && med.id.startsWith('temp-')) {
                    // New medication - create
                    if (med.medication_name) {
                        await patientsAPI.addMedication(patientId, {
                            medication_name: med.medication_name,
                            dosage: med.dosage || null,
                            frequency: med.frequency || null,
                            route: med.route || null,
                            active: med.active !== false
                        });
                    }
                } else if (med.id) {
                    // Existing medication - update
                    try {
                        await patientsAPI.updateMedication(med.id, {
                            medication_name: med.medication_name,
                            dosage: med.dosage || null,
                            frequency: med.frequency || null,
                            route: med.route || null,
                            active: med.active !== false
                        });
                    } catch (error) {
                        // If 404, item was deleted - create new one
                        if (error.response?.status === 404 && med.medication_name) {
                            await patientsAPI.addMedication(patientId, {
                                medication_name: med.medication_name,
                                dosage: med.dosage || null,
                                frequency: med.frequency || null,
                                route: med.route || null,
                                active: med.active !== false
                            });
                        } else {
                            throw error;
                        }
                    }
                }
            }
            
            // Handle problem deletions
            const originalProblems = originalPatientChartDataRef.current.problems || [];
            const currentProblemIds = new Set(patientChartData.problems.map(p => p.id).filter(Boolean));
            const deletedProblems = originalProblems.filter(p => p.id && !p.id.startsWith('temp-') && !currentProblemIds.has(p.id));
            
            // Delete removed problems
            for (const problem of deletedProblems) {
                if (problem.id) {
                    try {
                        await patientsAPI.deleteProblem(problem.id);
                    } catch (error) {
                        // Ignore 404 errors - item might already be deleted
                        if (error.response?.status !== 404) {
                            console.error('Error deleting problem:', error);
                        }
                    }
                }
            }
            
            // Save problems (create/update)
            for (const problem of patientChartData.problems) {
                if (problem.id && problem.id.startsWith('temp-')) {
                    // New problem - create
                    if (problem.problem_name) {
                        await patientsAPI.addProblem(patientId, {
                            problem_name: problem.problem_name,
                            icd10_code: problem.icd10_code || null,
                            status: problem.status || 'active'
                        });
                    }
                } else if (problem.id) {
                    // Existing problem - update
                    try {
                        await patientsAPI.updateProblem(problem.id, {
                            problem_name: problem.problem_name,
                            icd10_code: problem.icd10_code || null,
                            status: problem.status || 'active'
                        });
                    } catch (error) {
                        // If 404, item was deleted - create new one
                        if (error.response?.status === 404 && problem.problem_name) {
                            await patientsAPI.addProblem(patientId, {
                                problem_name: problem.problem_name,
                                icd10_code: problem.icd10_code || null,
                                status: problem.status || 'active'
                            });
                        } else {
                            throw error;
                        }
                    }
                }
            }
            
            // Handle family history deletions
            const originalFamilyHistory = originalPatientChartDataRef.current.familyHistory || [];
            const currentFamilyHistoryIds = new Set(patientChartData.familyHistory.map(fh => fh.id).filter(Boolean));
            const deletedFamilyHistory = originalFamilyHistory.filter(fh => fh.id && !fh.id.startsWith('temp-') && !currentFamilyHistoryIds.has(fh.id));
            
            // Delete removed family history
            for (const fh of deletedFamilyHistory) {
                if (fh.id) {
                    try {
                        await patientsAPI.deleteFamilyHistory(fh.id);
                    } catch (error) {
                        // Ignore 404 errors - item might already be deleted
                        if (error.response?.status !== 404) {
                            console.error('Error deleting family history:', error);
                        }
                    }
                }
            }
            
            // Save family history (create/update)
            for (const fh of patientChartData.familyHistory) {
                if (fh.id && fh.id.startsWith('temp-')) {
                    // New family history - create
                    if (fh.condition) {
                        await patientsAPI.addFamilyHistory(patientId, {
                            condition: fh.condition,
                            relationship: fh.relationship || null,
                            age_at_diagnosis: fh.age_at_diagnosis ? parseInt(fh.age_at_diagnosis) : null,
                            age_at_death: fh.age_at_death ? parseInt(fh.age_at_death) : null,
                            notes: fh.notes || null
                        });
                    }
                } else if (fh.id) {
                    // Existing family history - update
                    try {
                        await patientsAPI.updateFamilyHistory(fh.id, {
                            condition: fh.condition,
                            relationship: fh.relationship || null,
                            age_at_diagnosis: fh.age_at_diagnosis ? parseInt(fh.age_at_diagnosis) : null,
                            age_at_death: fh.age_at_death ? parseInt(fh.age_at_death) : null,
                            notes: fh.notes || null
                        });
                    } catch (error) {
                        // If 404, item was deleted - create new one
                        if (error.response?.status === 404 && fh.condition) {
                            await patientsAPI.addFamilyHistory(patientId, {
                                condition: fh.condition,
                                relationship: fh.relationship || null,
                                age_at_diagnosis: fh.age_at_diagnosis ? parseInt(fh.age_at_diagnosis) : null,
                                age_at_death: fh.age_at_death ? parseInt(fh.age_at_death) : null,
                                notes: fh.notes || null
                            });
                        } else {
                            throw error;
                        }
                    }
                }
            }
            
            // Save social history
            if (patientChartData.socialHistory) {
                await patientsAPI.saveSocialHistory(patientId, patientChartData.socialHistory);
            }
            
            // Preserve temporary items (items with temp- IDs that haven't been saved yet)
            const tempAllergies = patientChartData.allergies.filter(a => a.id && a.id.startsWith('temp-'));
            const tempMedications = patientChartData.medications.filter(m => m.id && m.id.startsWith('temp-'));
            const tempProblems = patientChartData.problems.filter(p => p.id && p.id.startsWith('temp-'));
            const tempFamilyHistory = patientChartData.familyHistory.filter(fh => fh.id && fh.id.startsWith('temp-'));
            
            // Refresh patient chart data after saving (get current data, not snapshot)
            // This ensures the UI shows the latest saved data
            await fetchPatientChartData(patientId, null);
            
            // Restore temporary items that weren't saved (empty ones or ones still being edited)
            setPatientChartData(prev => ({
                ...prev,
                allergies: [...prev.allergies, ...tempAllergies],
                medications: [...prev.medications, ...tempMedications],
                problems: [...prev.problems, ...tempProblems],
                familyHistory: [...prev.familyHistory, ...tempFamilyHistory]
            }));
        } catch (error) {
            console.error('Error saving patient chart data:', error);
            // Don't throw - allow note to save even if chart data save fails
        }
    }, [patientChartData, isSigned]);

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
                    const response = await visitsAPI.findOrCreate(id, 'Office Visit');
                    visitId = response.data.id;
                    setCurrentVisitId(visitId);
                    setVisitData(response.data);
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
                
                // Save patient chart data changes (only for unsigned notes)
                if (!isSigned) {
                    await savePatientChartData(id);
                }
                
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
    }, [id, currentVisitId, urlVisitId, isSigned, isSaving, noteData, vitals, patientChartData, combineNoteSections, parseNoteText, parsePlanText, formatPatientBackgroundForNote, savePatientChartData, fetchPatientChartData, showToast]);
    
    // Debounced auto-save function
    const scheduleAutoSave = useCallback((showToastMessage = false) => {
        // Clear any pending auto-save
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        
        // Schedule auto-save after 2 seconds of inactivity
        autoSaveTimeoutRef.current = setTimeout(() => {
            autoSave(showToastMessage);
        }, 2000);
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

    // Add addendum handler
    const handleAddAddendum = async (signImmediately = false) => {
        if (!addendumText.trim()) {
            showToast('Please enter addendum text', 'error');
            return;
        }
        
        if (!currentVisitId || currentVisitId === 'new') {
            showToast('Please save the note first before adding an addendum', 'error');
            return;
        }
        
        try {
            await visitsAPI.addAddendum(currentVisitId, addendumText);
            // Refresh visit data
            const visitRes = await visitsAPI.get(currentVisitId);
            const visitData = visitRes.data;
            let addendumsData = [];
            if (visitData.addendums) {
                addendumsData = Array.isArray(visitData.addendums) 
                    ? visitData.addendums 
                    : JSON.parse(visitData.addendums || '[]');
                setAddendums(addendumsData);
            }
            setAddendumText('');
            setShowAddendumModal(false);
            
            // Find the newly added addendum (last one, unsigned)
            const newAddendumIndex = addendumsData.length - 1;
            if (newAddendumIndex >= 0 && !addendumsData[newAddendumIndex].signed) {
                if (signImmediately) {
                    // Sign immediately
                    try {
                        await visitsAPI.signAddendum(currentVisitId, newAddendumIndex);
                        // Refresh again to get signed addendum
                        const refreshRes = await visitsAPI.get(currentVisitId);
                        const refreshData = refreshRes.data;
                        if (refreshData.addendums) {
                            const refreshedAddendums = Array.isArray(refreshData.addendums) 
                                ? refreshData.addendums 
                                : JSON.parse(refreshData.addendums || '[]');
                            setAddendums(refreshedAddendums);
                        }
                        showToast('Addendum added and signed successfully', 'success');
                    } catch (signError) {
                        console.error('Error signing addendum:', signError);
                        showToast('Addendum added but failed to sign. You can sign it later.', 'warning');
                    }
                } else {
                    // Prompt to sign the addendum
                    setAddendumToSignIndex(newAddendumIndex);
                    setShowSignAddendumModal(true);
                }
            } else {
                showToast('Addendum added successfully', 'success');
            }
        } catch (error) {
            console.error('Error adding addendum:', error);
            showToast('Failed to add addendum: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    // Sign addendum handler
    const handleSignAddendum = async () => {
        if (addendumToSignIndex === null || !currentVisitId) return;
        
        try {
            await visitsAPI.signAddendum(currentVisitId, addendumToSignIndex);
            // Refresh visit data
            const visitRes = await visitsAPI.get(currentVisitId);
            const visitData = visitRes.data;
            if (visitData.addendums) {
                const addendumsData = Array.isArray(visitData.addendums) 
                    ? visitData.addendums 
                    : JSON.parse(visitData.addendums || '[]');
                setAddendums(addendumsData);
            }
            setShowSignAddendumModal(false);
            setAddendumToSignIndex(null);
            showToast('Addendum signed successfully. It is now immutable.', 'success');
        } catch (error) {
            console.error('Error signing addendum:', error);
            showToast('Failed to sign addendum: ' + (error.response?.data?.error || error.message), 'error');
        }
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

    // Auto-save patient chart data changes immediately (separate from note auto-save)
    // This ensures dashboard stays in sync with changes made in the note
    useEffect(() => {
        // Don't save if note is signed, still loading, or no patient ID
        if (isSigned || loading || !id || !hasInitialSaveRef.current) {
            return;
        }

        // Clear any pending save
        if (patientChartDataSaveTimeoutRef.current) {
            clearTimeout(patientChartDataSaveTimeoutRef.current);
        }

        // Save patient chart data after a short debounce (1 second)
        // This ensures changes are saved quickly to keep dashboard in sync
        patientChartDataSaveTimeoutRef.current = setTimeout(() => {
            savePatientChartData(id).catch(error => {
                console.error('Error auto-saving patient chart data:', error);
                // Don't show toast for auto-save failures to avoid annoying the user
            });
        }, 1000);

        // Cleanup timeout on unmount or when dependencies change
        return () => {
            if (patientChartDataSaveTimeoutRef.current) {
                clearTimeout(patientChartDataSaveTimeoutRef.current);
            }
        };
    }, [patientChartData, isSigned, loading, id, savePatientChartData]);

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
                // Helper to normalize BP value (remove HTML entities, including deeply nested ones)
                const normalizeBP = (bp) => {
                    if (!bp || typeof bp !== 'string') return bp || '';
                    let cleaned = String(bp).trim();
                    // Handle deeply nested encoding (multiple passes may be needed)
                    let previous = '';
                    while (cleaned !== previous) {
                        previous = cleaned;
                        cleaned = cleaned
                            .replace(/&amp;amp;/g, '&')
                            .replace(/&amp;#x2F;/g, '/')
                            .replace(/&amp;#47;/g, '/')
                            .replace(/&amp;lt;/g, '<')
                            .replace(/&amp;gt;/g, '>')
                            .replace(/&amp;quot;/g, '"')
                            .replace(/&amp;apos;/g, "'")
                            .replace(/&#x2F;/g, '/')
                            .replace(/&#47;/g, '/')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");
                    }
                    return cleaned;
                };
                
                // Helper to clean all vitals values
                const cleanVitalValue = (val) => {
                    if (!val || typeof val !== 'string') return val;
                    return normalizeBP(val);
                };
                
                // First, save vitals and note draft to ensure everything is saved
                // Clean all vital values to prevent HTML entity encoding issues
                const cleanSystolic = cleanVitalValue(vitals.systolic);
                const cleanDiastolic = cleanVitalValue(vitals.diastolic);
                const cleanBp = normalizeBP(vitals.bp) || (cleanSystolic && cleanDiastolic ? `${cleanSystolic}/${cleanDiastolic}` : null);
                
                const vitalsToSave = {
                    systolic: cleanSystolic || null,
                    diastolic: cleanDiastolic || null,
                    bp: cleanBp,
                    temp: cleanVitalValue(vitals.temp) || null,
                    pulse: cleanVitalValue(vitals.pulse) || null,
                    resp: cleanVitalValue(vitals.resp) || null,
                    o2sat: cleanVitalValue(vitals.o2sat) || null,
                    weight: cleanVitalValue(vitals.weight) || null,
                    height: cleanVitalValue(vitals.height) || null,
                    bmi: cleanVitalValue(vitals.bmi) || null,
                    weightUnit: vitals.weightUnit || 'lbs',
                    heightUnit: vitals.heightUnit || 'in'
                };
                
                // Save vitals first to ensure they're in the database
                console.log('Saving vitals before signing:', vitalsToSave);
                await visitsAPI.update(visitId, { noteDraft: noteDraft || '', vitals: vitalsToSave });
                
                // Then sign the note (vitals should already be saved, but include them as backup)
                console.log('Signing note with vitals:', vitalsToSave);
                // Log the exact URL being called
                const apiBaseURL = window.location.origin.includes('localhost:5173') 
                    ? 'http://localhost:3000' 
                    : (process.env.REACT_APP_API_URL || 'http://localhost:3000');
                console.log('SIGN URL:', `${apiBaseURL}/api/visits/${visitId}/sign`);
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
            console.error('Error signing note:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error';
            showToast('Failed to sign note: ' + errorMessage, 'error');
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

    // Helper function to render clickable diagnoses
    const renderClickableDiagnoses = useCallback((element, text) => {
        if (!element || !text) return;
        const lines = text.split('\n');
        const html = lines.map((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return '<br />';
            // Escape HTML for data attribute but keep original text for display
            const escapedLine = trimmedLine
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            // Display the original text (not escaped) in the link
            const displayText = trimmedLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<a href="#" data-diagnosis="${escapedLine}" class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onclick="event.preventDefault(); return false;">${displayText}</a>`;
        }).join('<br />');
        
        // Only update if content changed to avoid cursor issues
        if (element.innerHTML !== html) {
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            const cursorPos = range ? range.startOffset : 0;
            
            element.innerHTML = html;
            
            // Restore cursor position if possible
            if (range && element.childNodes.length > 0) {
                try {
                    const newRange = document.createRange();
                    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
                    let node, pos = 0;
                    while (node = walker.nextNode()) {
                        if (pos + node.textContent.length >= cursorPos) {
                            newRange.setStart(node, cursorPos - pos);
                            newRange.setEnd(node, cursorPos - pos);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            break;
                        }
                        pos += node.textContent.length;
                    }
                } catch (e) {
                    // Ignore cursor restoration errors
                }
            }
        }
    }, []);

    // Helper function to convert markdown bold to HTML and render in ROS notes
    const renderBoldText = useCallback((element, markdownText) => {
        if (!element || !markdownText) return;
        const lines = markdownText.split('\n');
        const html = lines.map((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return '<br />';
            // Convert **text** to <strong>text</strong>
            // Escape HTML entities first, then convert markdown
            const escaped = trimmedLine
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const boldLine = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return `<div>${boldLine}</div>`;
        }).join('');
        
        // Only update if content changed to avoid cursor issues
        if (element.innerHTML !== html) {
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            const cursorPos = range ? range.startOffset : 0;
            
            element.innerHTML = html;
            
            // Restore cursor position if possible
            if (range && element.childNodes.length > 0) {
                try {
                    const newRange = document.createRange();
                    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
                    let node, pos = 0;
                    while (node = walker.nextNode()) {
                        if (pos + node.textContent.length >= cursorPos) {
                            newRange.setStart(node, cursorPos - pos);
                            newRange.setEnd(node, cursorPos - pos);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            break;
                        }
                        pos += node.textContent.length;
                    }
                } catch (e) {
                    // Ignore cursor restoration errors
                }
            }
        }
    }, []);

    // Helper function to extract markdown text from HTML contentEditable
    const extractMarkdownFromHTML = useCallback((htmlContent) => {
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = htmlContent;
        
        // Convert <strong> tags back to **text**
        const strongElements = temp.querySelectorAll('strong');
        strongElements.forEach(strong => {
            const text = strong.textContent;
            strong.outerHTML = `**${text}**`;
        });
        
        // Get text content and restore line breaks
        const lines = temp.innerHTML.split('<br>').map(line => {
            const div = document.createElement('div');
            div.innerHTML = line;
            return div.textContent || div.innerText || '';
        });
        
        return lines.join('\n');
    }, []);

    const handleTextChange = (value, field) => {
        const decoded = decodeHtmlEntities(value);
        // For assessment field, strip HTML tags if present (from contentEditable)
        const cleanValue = field === 'assessment' ? value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : decoded;
        if (field === 'hpi') {
            setNoteData({...noteData, hpi: decoded});
        } else if (field === 'assessment') {
            setNoteData({...noteData, assessment: cleanValue});
        } else if (field === 'plan') {
            setNoteData({...noteData, plan: decoded});
        }
    };

    // ICD-10 search - only search when user is typing
    useEffect(() => {
        const query = icd10Search.trim();
        
        // Don't search if empty - clear results and hide dropdown
        if (query.length === 0) {
            setIcd10Results([]);
            setShowIcd10Search(false);
            return;
        }
        
        const timeout = setTimeout(async () => {
            try {
                const response = await codesAPI.searchICD10(query);
                let results = response.data || [];
                
                // Sort results: shortest description first, with hierarchy codes prioritized
                results = results.sort((a, b) => {
                    const aHasHierarchy = codesWithHierarchy.has(a.code) || codesWithHierarchy.has(a.code.match(/^([A-Z]\d+)/)?.[1]);
                    const bHasHierarchy = codesWithHierarchy.has(b.code) || codesWithHierarchy.has(b.code.match(/^([A-Z]\d+)/)?.[1]);
                    const aDescLength = (a.description || '').length;
                    const bDescLength = (b.description || '').length;
                    
                    // First priority: hierarchy codes come first
                    if (aHasHierarchy && !bHasHierarchy) return -1;
                    if (!aHasHierarchy && bHasHierarchy) return 1;
                    
                    // Second priority: shortest description first
                    if (aDescLength !== bDescLength) {
                        return aDescLength - bDescLength;
                    }
                    
                    // If same length, sort alphabetically by code
                    return a.code.localeCompare(b.code);
                });
                
                setIcd10Results(results);
                // Only show results if user is actively typing
                if (query.length > 0) {
                    setShowIcd10Search(true);
                }
            } catch (error) {
                console.error('Error searching ICD-10 codes:', error);
                setIcd10Results([]);
            }
        }, 150); // Reduced debounce for more responsive feel
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    // Load ordersets when modal opens
    useEffect(() => {
        if (showOrdersetsModal) {
            ordersetsAPI.getAll({ specialty: 'cardiology' })
                .then(response => {
                    setOrdersets(response.data || []);
                })
                .catch(error => {
                    console.error('Error loading ordersets:', error);
                    showToast('Failed to load ordersets', 'error');
                });
        }
    }, [showOrdersetsModal]);

    const handleAddICD10 = async (code, addToProblem = false) => {
        // Always check for hierarchy first - try exact code, then base code
        let hasHierarchy = false;
        let hierarchyData = null;
        
        try {
            // Try exact code first
            const hierarchyResponse = await icd10HierarchyAPI.getQuestions(code.code);
            
            if (hierarchyResponse?.data?.questions?.length > 0) {
                hasHierarchy = true;
                hierarchyData = hierarchyResponse.data;
            } else {
                // Try base code (e.g., I50 for I50.1, I50.2, etc.)
                const baseMatch = code.code.match(/^([A-Z]\d+)/);
                if (baseMatch) {
                    const baseCode = baseMatch[1];
                    if (baseCode !== code.code) {
                        const baseResponse = await icd10HierarchyAPI.getQuestions(baseCode);
                        if (baseResponse?.data?.questions?.length > 0) {
                            hasHierarchy = true;
                            hierarchyData = baseResponse.data;
                        }
                    }
                }
            }
        } catch (error) {
            // No hierarchy found or API error - continue with direct add
            // Silently fail - not all codes have hierarchies
        }
        
        // If hierarchy exists, open the selector modal
        if (hasHierarchy) {
            // Set the code and description first
            setSelectedCodeForHierarchy(code.code);
            setSelectedDescriptionForHierarchy(code.description);
            // Close the ICD-10 search modal
            setShowICD10Modal(false);
            setShowIcd10Search(false);
            setIcd10Search('');
            // Open hierarchy selector after a brief delay to ensure modal closes first
            setTimeout(() => {
                setShowHierarchySelector(true);
            }, 150);
            return;
        }
        
        // Direct add (no hierarchy)
        addICD10Directly(code, addToProblem);
    };

    const addICD10Directly = async (code, addToProblem = false) => {
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
        
        // Collapse the dropdown and clear search
        setShowIcd10Search(false);
        setIcd10Search('');
        setIcd10Results([]);
        
        // Re-render assessment to show clickable diagnoses
        setTimeout(() => {
            if (assessmentRef.current && !isSigned) {
                renderClickableDiagnoses(assessmentRef.current, newAssessment);
            }
        }, 50);
    };

    const handleHierarchySelect = (refinedCode) => {
        addICD10Directly(refinedCode, false);
        setShowHierarchySelector(false);
        setSelectedCodeForHierarchy(null);
        setSelectedDescriptionForHierarchy(null);
    };

    // Parse assessment to extract diagnoses - memoized to prevent infinite re-renders
    const diagnoses = useMemo(() => {
        if (!noteData.assessment) {
            // No assessment text found - this is normal if assessment is empty
            return [];
        }
        // Strip HTML tags if present (from contentEditable)
        const cleanAssessment = noteData.assessment.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        const lines = cleanAssessment.split('\n').filter(line => line.trim());
        const parsedDiagnoses = lines.map(line => line.trim());
        // Only log if there are diagnoses to avoid console spam
        if (parsedDiagnoses.length > 0) {
            console.log('VisitNote: Extracted diagnoses from assessment:', parsedDiagnoses);
        }
        return parsedDiagnoses;
    }, [noteData.assessment]);

    // Helper function to add diagnosis to assessment and trigger re-render
    const handleAddDiagnosisToAssessment = useCallback((diagnosisText) => {
        setNoteData(prev => {
            const newAssessment = prev.assessment 
                ? `${prev.assessment}\n${diagnosisText}`
                : diagnosisText;
            // Trigger re-render of assessment contentEditable div after state update
            setTimeout(() => {
                if (assessmentRef.current && !isSigned) {
                    renderClickableDiagnoses(assessmentRef.current, newAssessment);
                }
            }, 50);
            return { ...prev, assessment: newAssessment };
        });
    }, [isSigned]);

    // Delete plan item
    const handleDeletePlanItem = (index) => {
        setNoteData(prev => {
            const currentPlan = prev.planStructured || [];
            const updatedPlan = currentPlan.filter((_, i) => i !== index);
            const formattedPlan = formatPlanText(updatedPlan);
            return {...prev, planStructured: updatedPlan, plan: formattedPlan};
        });
    };

    const handleEditPlanDiagnosis = (index, newDiagnosis) => {
        setNoteData(prev => {
            const currentPlan = [...(prev.planStructured || [])];
            if (currentPlan[index]) {
                currentPlan[index] = { ...currentPlan[index], diagnosis: newDiagnosis };
                const formattedPlan = formatPlanText(currentPlan);
                return {...prev, planStructured: currentPlan, plan: formattedPlan};
            }
            return prev;
        });
    };

    const handleDeletePlanOrder = (diagnosisIndex, orderIndex) => {
        setNoteData(prev => {
            const currentPlan = [...(prev.planStructured || [])];
            if (currentPlan[diagnosisIndex] && currentPlan[diagnosisIndex].orders) {
                const updatedOrders = currentPlan[diagnosisIndex].orders.filter((_, i) => i !== orderIndex);
                if (updatedOrders.length === 0) {
                    // If no orders left, remove the entire plan item
                    const updatedPlan = currentPlan.filter((_, i) => i !== diagnosisIndex);
                    const formattedPlan = formatPlanText(updatedPlan);
                    return {...prev, planStructured: updatedPlan, plan: formattedPlan};
                } else {
                    currentPlan[diagnosisIndex] = { ...currentPlan[diagnosisIndex], orders: updatedOrders };
                    const formattedPlan = formatPlanText(currentPlan);
                    return {...prev, planStructured: currentPlan, plan: formattedPlan};
                }
            }
            return prev;
        });
    };

    const handleEditPlanOrder = (diagnosisIndex, orderIndex, newOrder) => {
        setNoteData(prev => {
            const currentPlan = [...(prev.planStructured || [])];
            if (currentPlan[diagnosisIndex] && currentPlan[diagnosisIndex].orders) {
                const updatedOrders = [...currentPlan[diagnosisIndex].orders];
                updatedOrders[orderIndex] = newOrder;
                currentPlan[diagnosisIndex] = { ...currentPlan[diagnosisIndex], orders: updatedOrders };
                const formattedPlan = formatPlanText(currentPlan);
                return {...prev, planStructured: currentPlan, plan: formattedPlan};
            }
            return prev;
        });
    };

    const handleAddPlanOrder = (diagnosisIndex, newOrder) => {
        if (!newOrder || !newOrder.trim()) return;
        setNoteData(prev => {
            const currentPlan = [...(prev.planStructured || [])];
            if (currentPlan[diagnosisIndex]) {
                const updatedOrders = [...(currentPlan[diagnosisIndex].orders || []), newOrder.trim()];
                currentPlan[diagnosisIndex] = { ...currentPlan[diagnosisIndex], orders: updatedOrders };
                const formattedPlan = formatPlanText(currentPlan);
                return {...prev, planStructured: currentPlan, plan: formattedPlan};
            }
            return prev;
        });
    };

    // Delete assessment diagnosis and corresponding plan item
    const handleDeleteAssessmentDiagnosis = (diagnosisToDelete) => {
        setNoteData(prev => {
            // Remove diagnosis from assessment
            const cleanAssessment = prev.assessment.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            const lines = cleanAssessment.split('\n').filter(line => line.trim());
            const updatedLines = lines.filter(line => line.trim() !== diagnosisToDelete.trim());
            const newAssessment = updatedLines.join('\n');

            // Remove corresponding plan item
            const currentPlan = prev.planStructured || [];
            const updatedPlan = currentPlan.filter(item => item.diagnosis !== diagnosisToDelete);
            const formattedPlan = formatPlanText(updatedPlan);

            // Re-render assessment contentEditable div
            setTimeout(() => {
                if (assessmentRef.current && !isSigned) {
                    renderClickableDiagnoses(assessmentRef.current, newAssessment);
                }
            }, 50);

            return {...prev, assessment: newAssessment, planStructured: updatedPlan, plan: formattedPlan};
        });
        setClickedDiagnosis(null);
    };

    // Add order to plan
    const addOrderToPlan = (diagnosis, orderText) => {
        let diagnosisToUse = diagnosis;
        
        // If diagnosis is new, add it to assessment
        // Check for duplicates more robustly - handle both with and without ICD-10 code
        if (diagnosis) {
            const diagnosisAlreadyExists = diagnoses.some(d => {
                // Exact match
                if (d === diagnosis) return true;
                // Match by name (extract name from "CODE - Name" format)
                const existingName = d.includes(' - ') ? d.split(' - ')[1] : d;
                const newName = diagnosis.includes(' - ') ? diagnosis.split(' - ')[1] : diagnosis;
                if (existingName.trim() === newName.trim()) return true;
                // Match by code if present
                const existingCode = d.match(/^([A-Z]\d{2}(?:\.\d+)?)\s*[-–—]\s*/);
                const newCode = diagnosis.match(/^([A-Z]\d{2}(?:\.\d+)?)\s*[-–—]\s*/);
                if (existingCode && newCode && existingCode[1] === newCode[1]) return true;
                return false;
            });
            
            if (!diagnosisAlreadyExists) {
                const newAssessment = noteData.assessment 
                    ? `${noteData.assessment}\n${diagnosis}`
                    : diagnosis;
                setNoteData(prev => ({...prev, assessment: newAssessment}));
            }
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

    // Calculate age from DOB
    const calculateAge = (dob) => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const patientAge = patientData?.dob ? calculateAge(patientData.dob) : null;
    const patientName = patientData ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() : 'Patient';

    return (
        <>
            {/* Patient Header Section - Similar to Snapshot */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                {/* Quick Navigation Bar - Merged with Header */}
                <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 overflow-x-auto flex-1">
                                <button
                                    onClick={() => {
                                        setPatientChartTab('hub');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <UserCircle className="w-3.5 h-3.5 text-green-600" />
                                    <span>Patient Hub</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPatientChartTab('data');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <Database className="w-3.5 h-3.5 text-orange-600" />
                                    <span>Patient Data</span>
                                </button>
                                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                <button
                                    onClick={() => {
                                        setPatientChartTab('images');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <FileImage className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Images</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPatientChartTab('labs');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Labs</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPatientChartTab('documents');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                                    <span>Documents</span>
                                </button>
                                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPatientChartTab('ekg');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <Activity className="w-3.5 h-3.5 text-red-600" />
                                    <span>EKG</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPatientChartTab('echo');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <Heart className="w-3.5 h-3.5 text-blue-600" />
                                    <span>ECHO</span>
                                </button>
                                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                {hasPrivilege('e_prescribe') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEPrescribeEnhanced(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md transition-all duration-200 hover:shadow-md whitespace-nowrap"
                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        title="Create New Prescription"
                                    >
                                        <Pill className="w-3.5 h-3.5" />
                                        <span>e-Prescribe</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setPatientChartTab('prescriptions');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <Pill className="w-3.5 h-3.5 text-primary-600" />
                                    <span>Prescription Log</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPatientChartTab('referrals');
                                        setShowPatientChart(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                                >
                                    <FileText className="w-3.5 h-3.5 text-green-600" />
                                    <span>Referral Log</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Master Back Button */}
                <div className="mb-4">
                    <button onClick={() => navigate(`/patient/${id}/snapshot`)} className="flex items-center space-x-2 text-gray-600 hover:text-primary-900 transition-colors">
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
                            <button onClick={() => { setPatientChartTab('history'); setShowPatientChart(!showPatientChart); }} className={`p-1.5 rounded-md transition-colors ${showPatientChart && patientChartTab === 'history' ? 'bg-primary-200 text-primary-700' : 'text-neutral-600 hover:bg-primary-100'}`} title="Patient Chart">
                                <History className="w-3.5 h-3.5" />
                            </button>
                            {isSigned && (
                                <>
                                    <div className="flex items-center space-x-2 text-green-700 text-xs font-medium">
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Signed</span>
                                        {currentVisitData.note_signed_at && (
                                            <span className="text-neutral-500">
                                                {format(new Date(currentVisitData.note_signed_at), 'MM/dd/yyyy h:mm a')}
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setShowAddendumModal(true)} 
                                        className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium"
                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                    >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        <span>Add Addendum</span>
                                    </button>
                                </>
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

                    {/* Alert if addendums exist - Full width banner at top */}
                    {isSigned && addendums.length > 0 && (
                        <div className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-red-800 mb-4">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                            <span>⚠️ This note has {addendums.length} addendum{addendums.length > 1 ? 's' : ''}.</span>
                        </div>
                    )}

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
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'lbs' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.weightUnit === 'lbs' ? { background: '#3B82F6' } : {}}>lbs</button>
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
                                        }} disabled={isSigned} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'in' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.heightUnit === 'in' ? { background: '#3B82F6' } : {}}>in</button>
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
                            {isSigned ? (
                                <div 
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white text-neutral-900 leading-relaxed min-h-[80px] whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.hpi ? noteData.hpi.split('\n').map((line, idx) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong>
                                            const boldLine = markdownToHtml(trimmedLine);
                                            return `<div key="${idx}">${boldLine}</div>`;
                                        }).join('') : ''
                                    }}
                                />
                            ) : (
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
                                    rows={6}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[80px]"
                                    placeholder="Type .dotphrase to expand, or press F2 to find [] placeholders..."
                                />
                            )}
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
                            {isSigned ? (
                                <div 
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white text-neutral-900 leading-relaxed min-h-[120px] whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.rosNotes.split('\n').map((line, idx) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong>
                                            const boldLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                            return `<div key="${idx}">${boldLine}</div>`;
                                        }).join('')
                                    }}
                                />
                            ) : (
                                <div
                                    ref={rosRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => {
                                        // Extract markdown from HTML content
                                        const markdownText = extractMarkdownFromHTML(e.currentTarget.innerHTML);
                                        setNoteData({...noteData, rosNotes: markdownText});
                                        // Re-render with bold formatting
                                        setTimeout(() => {
                                            renderBoldText(e.currentTarget, markdownText);
                                        }, 50);
                                    }}
                                    onBlur={(e) => {
                                        // Extract markdown from HTML content
                                        const markdownText = extractMarkdownFromHTML(e.currentTarget.innerHTML);
                                        setNoteData({...noteData, rosNotes: markdownText});
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px] cursor-text outline-none"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.rosNotes.split('\n').map((line) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong>
                                            const boldLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                            return `<div>${boldLine}</div>`;
                                        }).join('')
                                    }}
                                />
                            )}
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

                    {/* Patient Background - Editable from Note */}
                    <Section title="Patient Background" defaultOpen={true}>
                        {isSigned && (
                            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                <strong>Note:</strong> This note is signed. Patient data shown is from the snapshot taken at the time of signing and cannot be modified. Changes to patient data will not affect this signed note.
                            </div>
                        )}
                        <div className="space-y-3">
                            {/* Allergies */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Allergies</h4>
                                <div className="space-y-1.5">
                                    {patientChartData.allergies.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No allergies recorded</p>
                                    ) : (
                                        patientChartData.allergies.map((allergy, idx) => (
                                            <div key={allergy.id || idx} className="flex items-start gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                                                <div className="flex-1 grid grid-cols-3 gap-1.5">
                                                    <input
                                                        type="text"
                                                        placeholder="Allergen"
                                                        value={allergy.allergen || ''}
                                                        onChange={(e) => {
                                                            if (isSigned) return;
                                                            const updated = [...patientChartData.allergies];
                                                            updated[idx] = { ...updated[idx], allergen: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, allergies: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Reaction"
                                                        value={allergy.reaction || ''}
                                                        onChange={(e) => {
                                                            if (isSigned) return;
                                                            const updated = [...patientChartData.allergies];
                                                            updated[idx] = { ...updated[idx], reaction: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, allergies: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                    <select
                                                        value={allergy.severity || 'Mild'}
                                                        onChange={(e) => {
                                                            if (isSigned) return;
                                                            const updated = [...patientChartData.allergies];
                                                            updated[idx] = { ...updated[idx], severity: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, allergies: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    >
                                                        <option>Mild</option>
                                                        <option>Moderate</option>
                                                        <option>Severe</option>
                                                    </select>
                                                </div>
                                                {!isSigned && (
                                                    <button
                                                        onClick={() => {
                                                            if (isSigned) return;
                                                            const updated = patientChartData.allergies.filter((_, i) => i !== idx);
                                                            setPatientChartData(prev => ({ ...prev, allergies: updated }));
                                                        }}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                    {!isSigned && (
                                        <button
                                            onClick={() => {
                                                if (isSigned) return;
                                                const newAllergy = { id: `temp-${Date.now()}`, allergen: '', reaction: '', severity: 'Mild', active: true };
                                                setPatientChartData(prev => ({
                                                    ...prev,
                                                    allergies: [...prev.allergies, newAllergy]
                                                }));
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors w-full justify-center border border-dashed border-gray-300"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Allergy
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Medications */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Current Medications</h4>
                                <div className="space-y-1.5">
                                    {patientChartData.medications.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No medications recorded</p>
                                    ) : (
                                        patientChartData.medications.filter(m => m.active).map((med, idx) => {
                                            const actualIdx = patientChartData.medications.findIndex(m => m.id === med.id);
                                            return (
                                                <div key={med.id || idx} className="flex items-start gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                                                    <div className="flex-1 grid grid-cols-4 gap-1.5">
                                                        <input
                                                            type="text"
                                                            placeholder="Medication"
                                                            value={med.medication_name || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.medications];
                                                                updated[actualIdx] = { ...updated[actualIdx], medication_name: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, medications: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Dosage"
                                                            value={med.dosage || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.medications];
                                                                updated[actualIdx] = { ...updated[actualIdx], dosage: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, medications: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Frequency"
                                                            value={med.frequency || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.medications];
                                                                updated[actualIdx] = { ...updated[actualIdx], frequency: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, medications: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Route"
                                                            value={med.route || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.medications];
                                                                updated[actualIdx] = { ...updated[actualIdx], route: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, medications: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                    </div>
                                                    {!isSigned && (
                                                        <button
                                                            onClick={() => {
                                                                const updated = patientChartData.medications.filter((_, i) => i !== actualIdx);
                                                                setPatientChartData(prev => ({ ...prev, medications: updated }));
                                                            }}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    {!isSigned && (
                                        <button
                                            onClick={() => {
                                                const newMed = { id: `temp-${Date.now()}`, medication_name: '', dosage: '', frequency: '', route: '', active: true };
                                                setPatientChartData(prev => ({
                                                    ...prev,
                                                    medications: [...prev.medications, newMed]
                                                }));
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors w-full justify-center border border-dashed border-gray-300"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Medication
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Problems */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Active Problems</h4>
                                <div className="space-y-1.5">
                                    {patientChartData.problems.filter(p => p.status === 'active').length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No active problems</p>
                                    ) : (
                                        patientChartData.problems.filter(p => p.status === 'active').map((problem, idx) => {
                                            const actualIdx = patientChartData.problems.findIndex(p => p.id === problem.id);
                                            return (
                                                <div key={problem.id || idx} className="flex items-start gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                                                    <div className="flex-1 grid grid-cols-2 gap-1.5">
                                                        <input
                                                            type="text"
                                                            placeholder="Problem"
                                                            value={problem.problem_name || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.problems];
                                                                updated[actualIdx] = { ...updated[actualIdx], problem_name: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, problems: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="ICD-10"
                                                            value={problem.icd10_code || ''}
                                                            onChange={(e) => {
                                                                const updated = [...patientChartData.problems];
                                                                updated[actualIdx] = { ...updated[actualIdx], icd10_code: e.target.value };
                                                                setPatientChartData(prev => ({ ...prev, problems: updated }));
                                                            }}
                                                            disabled={isSigned}
                                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                        />
                                                    </div>
                                                    {!isSigned && (
                                                        <button
                                                            onClick={() => {
                                                                const updated = patientChartData.problems.filter((_, i) => i !== actualIdx);
                                                                setPatientChartData(prev => ({ ...prev, problems: updated }));
                                                            }}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    {!isSigned && (
                                        <button
                                            onClick={() => {
                                                const newProblem = { id: `temp-${Date.now()}`, problem_name: '', icd10_code: '', status: 'active' };
                                                setPatientChartData(prev => ({
                                                    ...prev,
                                                    problems: [...prev.problems, newProblem]
                                                }));
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors w-full justify-center border border-dashed border-gray-300"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Problem
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Family History */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Family History</h4>
                                <div className="space-y-1.5">
                                    {patientChartData.familyHistory.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No family history recorded</p>
                                    ) : (
                                        patientChartData.familyHistory.map((fh, idx) => (
                                            <div key={fh.id || idx} className="flex items-start gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                                                <div className="flex-1 grid grid-cols-4 gap-1.5">
                                                    <input
                                                        type="text"
                                                        placeholder="Condition"
                                                        value={fh.condition || ''}
                                                        onChange={(e) => {
                                                            const updated = [...patientChartData.familyHistory];
                                                            updated[idx] = { ...updated[idx], condition: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, familyHistory: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Relationship"
                                                        value={fh.relationship || ''}
                                                        onChange={(e) => {
                                                            const updated = [...patientChartData.familyHistory];
                                                            updated[idx] = { ...updated[idx], relationship: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, familyHistory: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Age at Dx"
                                                        value={fh.age_at_diagnosis || ''}
                                                        onChange={(e) => {
                                                            const updated = [...patientChartData.familyHistory];
                                                            updated[idx] = { ...updated[idx], age_at_diagnosis: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, familyHistory: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Notes"
                                                        value={fh.notes || ''}
                                                        onChange={(e) => {
                                                            const updated = [...patientChartData.familyHistory];
                                                            updated[idx] = { ...updated[idx], notes: e.target.value };
                                                            setPatientChartData(prev => ({ ...prev, familyHistory: updated }));
                                                        }}
                                                        disabled={isSigned}
                                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                                    />
                                                </div>
                                                {!isSigned && (
                                                    <button
                                                        onClick={() => {
                                                            const updated = patientChartData.familyHistory.filter((_, i) => i !== idx);
                                                            setPatientChartData(prev => ({ ...prev, familyHistory: updated }));
                                                        }}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                    {!isSigned && (
                                        <button
                                            onClick={() => {
                                                const newFH = { id: `temp-${Date.now()}`, condition: '', relationship: '', age_at_diagnosis: '', age_at_death: '', notes: '' };
                                                setPatientChartData(prev => ({
                                                    ...prev,
                                                    familyHistory: [...prev.familyHistory, newFH]
                                                }));
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors w-full justify-center border border-dashed border-gray-300"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Family History
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Social History */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Social History</h4>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <input
                                        type="text"
                                        placeholder="Smoking Status"
                                        value={patientChartData.socialHistory?.smoking_status || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), smoking_status: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Pack Years"
                                        value={patientChartData.socialHistory?.smoking_pack_years || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), smoking_pack_years: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Alcohol Use"
                                        value={patientChartData.socialHistory?.alcohol_use || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), alcohol_use: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Exercise"
                                        value={patientChartData.socialHistory?.exercise_frequency || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), exercise_frequency: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Occupation"
                                        value={patientChartData.socialHistory?.occupation || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), occupation: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                                    />
                                    <textarea
                                        placeholder="Additional Notes"
                                        value={patientChartData.socialHistory?.notes || ''}
                                        onChange={(e) => {
                                            setPatientChartData(prev => ({
                                                ...prev,
                                                socialHistory: { ...(prev.socialHistory || {}), notes: e.target.value }
                                            }));
                                        }}
                                        disabled={isSigned}
                                        rows={2}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 col-span-2"
                                    />
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* ROS and PE Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
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
                            {isSigned ? (
                                <div 
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white text-neutral-900 leading-relaxed min-h-[120px] whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.peNotes ? noteData.peNotes.split('\n').map((line, idx) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong>
                                            const boldLine = markdownToHtml(trimmedLine);
                                            return `<div key="${idx}">${boldLine}</div>`;
                                        }).join('') : ''
                                    }}
                                />
                            ) : (
                                <div
                                    ref={peRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => {
                                        const markdownText = extractMarkdownFromHTML(e.currentTarget.innerHTML);
                                        setNoteData({...noteData, peNotes: markdownText});
                                        setTimeout(() => {
                                            renderBoldText(e.currentTarget, markdownText);
                                        }, 50);
                                    }}
                                    onBlur={(e) => {
                                        const markdownText = extractMarkdownFromHTML(e.currentTarget.innerHTML);
                                        setNoteData({...noteData, peNotes: markdownText});
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px] cursor-text outline-none"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.peNotes ? noteData.peNotes.split('\n').map((line) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong>
                                            const boldLine = markdownToHtml(trimmedLine);
                                            return `<div>${boldLine}</div>`;
                                        }).join('') : ''
                                    }}
                                />
                            )}
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
                        {hasPrivilege('search_icd10') && (
                            <div className="mb-2 space-y-2">
                                <button
                                    onClick={() => setShowICD10Modal(true)}
                                    className="w-full px-3 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors flex items-center justify-center space-x-1"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Search ICD-10 Codes</span>
                                </button>
                                {/* TEST BUTTON - Remove after testing */}
                                {/* Keep inline search as fallback */}
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                    <input type="text" placeholder="Type to search ICD-10 codes or browse popular codes..." value={icd10Search}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setIcd10Search(value);
                                            // Only show dropdown when typing (at least 1 character)
                                            if (value.trim().length > 0) {
                                                setShowIcd10Search(true);
                                            } else {
                                                setShowIcd10Search(false);
                                            }
                                        }}
                                        onFocus={() => {
                                            // Only show results if user is typing
                                            if (icd10Search.trim().length > 0) {
                                                setShowIcd10Search(true);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            // Only close if clicking outside the dropdown
                                            const relatedTarget = e.relatedTarget;
                                            if (!relatedTarget || !relatedTarget.closest('.icd10-dropdown')) {
                                                setTimeout(() => {
                                                    setShowIcd10Search(false);
                                                }, 200);
                                            }
                                        }}
                                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                    />
                                </div>
                                {showIcd10Search && icd10Search.trim().length > 0 && icd10Results.length > 0 && (
                                    <div 
                                        className="icd10-dropdown mb-2 border border-neutral-200 rounded-md bg-white shadow-lg max-h-60 overflow-y-auto z-50"
                                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking results
                                    >
                                        {icd10Results.map((code) => {
                                            const hasHierarchy = codesWithHierarchy.has(code.code);
                                            return (
                                                <div 
                                                    key={code.code} 
                                                    className={`flex items-center justify-between p-2 border-b border-neutral-100 hover:bg-primary-50 transition-colors ${hasHierarchy ? 'border-l-4 border-green-500 bg-green-50 border-r-2 border-r-green-200' : ''}`}
                                                >
                                                    <button 
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            await handleAddICD10(code, false);
                                                            // Close dropdown - hierarchy will open if needed
                                                            setShowIcd10Search(false);
                                                            setIcd10Search('');
                                                        }} 
                                                        className="flex-1 text-left"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-neutral-900 text-xs">{code.code}</span>
                                                            {hasHierarchy && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md shadow-sm">
                                                                    <Layers className="w-3 h-3" />
                                                                    REFINE
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-neutral-600">{code.description}</div>
                                                    </button>
                                                    <div className="flex items-center gap-1.5 ml-2">
                                                        {hasHierarchy && (
                                                            <ChevronRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                                        )}
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                await handleAddICD10(code, true);
                                                                // Close inline search dropdown
                                                                setShowIcd10Search(false);
                                                                setIcd10Search('');
                                                            }} 
                                                            className="px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md transition-colors"
                                                            title="Add to Problem List"
                                                        >
                                                            + Problem
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {showIcd10Search && icd10Results.length === 0 && icd10Search.trim().length > 0 && (
                                    <div className="mb-2 border border-neutral-200 rounded-md bg-white p-3 text-center">
                                        <p className="text-xs text-neutral-500">No codes found matching "{icd10Search}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="relative">
                            {isSigned ? (
                                <div 
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white text-neutral-900 leading-relaxed min-h-[60px] whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.assessment ? noteData.assessment.split('\n').map((line, idx) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Convert **text** to <strong>text</strong> and make clickable
                                            const escapedLine = trimmedLine
                                                .replace(/&/g, '&amp;')
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;')
                                                .replace(/"/g, '&quot;');
                                            const boldLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                            return `<div key="${idx}">${boldLine}</div>`;
                                        }).join('') : ''
                                    }}
                                />
                            ) : (
                                <div
                                    ref={assessmentRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => {
                                        const text = e.currentTarget.textContent || e.currentTarget.innerText;
                                        handleTextChange(text, 'assessment');
                                        handleDotPhraseAutocomplete(text, 'assessment', assessmentRef);
                                        // Re-render with clickable links after a short delay
                                        setTimeout(() => {
                                            renderClickableDiagnoses(e.currentTarget, text);
                                        }, 50);
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
                                    onClick={(e) => {
                                        if (isSigned) return;
                                        // Check if clicking on a diagnosis link
                                        const target = e.target;
                                        if (target.tagName === 'A' || target.closest('a')) {
                                            e.preventDefault();
                                            const link = target.tagName === 'A' ? target : target.closest('a');
                                            const diagnosis = link.getAttribute('data-diagnosis');
                                            if (diagnosis) {
                                                const rect = link.getBoundingClientRect();
                                                setClickedDiagnosis(diagnosis);
                                                setDiagnosisMenuPosition({ x: rect.left, y: rect.bottom + 5 });
                                            }
                                        } else if (clickedDiagnosis) {
                                            setClickedDiagnosis(null);
                                        }
                                    }}
                                    onFocus={() => setActiveTextArea('assessment')}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[60px] cursor-text outline-none"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                    dangerouslySetInnerHTML={{
                                        __html: noteData.assessment ? noteData.assessment.split('\n').map((line) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return '<br />';
                                            // Escape HTML and make each line a clickable blue link
                                            const escapedLine = trimmedLine
                                                .replace(/&/g, '&amp;')
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;')
                                                .replace(/"/g, '&quot;');
                                            return `<a href="#" data-diagnosis="${escapedLine}" class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onclick="event.preventDefault(); return false;">${trimmedLine}</a>`;
                                        }).join('<br />') : '<span class="text-gray-400">Enter diagnoses... (Click on a diagnosis to order)</span>'
                                    }}
                                />
                            )}
                            
                            {/* Diagnosis Context Menu */}
                            {clickedDiagnosis && !isSigned && (
                                <div 
                                    ref={diagnosisMenuRef}
                                    className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl"
                                    style={{ 
                                        left: `${diagnosisMenuPosition.x}px`, 
                                        top: `${diagnosisMenuPosition.y}px`,
                                        minWidth: '180px'
                                    }}
                                >
                                    <div className="p-2 border-b border-gray-200">
                                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[200px]" title={clickedDiagnosis}>
                                            {clickedDiagnosis}
                                        </p>
                                    </div>
                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const problem = patientChartData.problems?.find(p => {
                                                    const problemName = (p.problem_name || p.name || '').toLowerCase();
                                                    const diagnosisLower = clickedDiagnosis.toLowerCase();
                                                    const icd10Code = (p.icd10_code || p.icd10Code || '').toLowerCase();
                                                    
                                                    return problemName === diagnosisLower ||
                                                           diagnosisLower.includes(problemName) ||
                                                           problemName.includes(diagnosisLower) ||
                                                           (icd10Code && diagnosisLower.includes(icd10Code)) ||
                                                           (icd10Code && icd10Code.includes(diagnosisLower));
                                                });
                                                
                                                const diagnosisToUse = problem || {
                                                    id: `temp-${Date.now()}`,
                                                    problem_name: clickedDiagnosis,
                                                    name: clickedDiagnosis,
                                                    icd10_code: clickedDiagnosis.match(/^[A-Z]\d{2}(\.\d+)?/)?.[0] || null
                                                };
                                                
                                                setPreSelectedDiagnosisForOrder([diagnosisToUse]);
                                                setShowEPrescribeEnhanced(true);
                                                setClickedDiagnosis(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                                            Prescription
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const problem = patientChartData.problems?.find(p => {
                                                    const problemName = (p.problem_name || p.name || '').toLowerCase();
                                                    const diagnosisLower = clickedDiagnosis.toLowerCase();
                                                    const icd10Code = (p.icd10_code || p.icd10Code || '').toLowerCase();
                                                    
                                                    return problemName === diagnosisLower ||
                                                           diagnosisLower.includes(problemName) ||
                                                           problemName.includes(diagnosisLower) ||
                                                           (icd10Code && diagnosisLower.includes(icd10Code)) ||
                                                           (icd10Code && icd10Code.includes(diagnosisLower));
                                                });
                                                
                                                const diagnosisToUse = problem || {
                                                    id: `temp-${Date.now()}`,
                                                    problem_name: clickedDiagnosis,
                                                    name: clickedDiagnosis,
                                                    icd10_code: clickedDiagnosis.match(/^[A-Z]\d{2}(\.\d+)?/)?.[0] || null
                                                };
                                                
                                                setPreSelectedDiagnosisForOrder([diagnosisToUse]);
                                                setShowOrderModal(true);
                                                setClickedDiagnosis(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                        >
                                            <Activity className="w-3.5 h-3.5 text-green-600" />
                                            Lab
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const problem = patientChartData.problems?.find(p => {
                                                    const problemName = (p.problem_name || p.name || '').toLowerCase();
                                                    const diagnosisLower = clickedDiagnosis.toLowerCase();
                                                    const icd10Code = (p.icd10_code || p.icd10Code || '').toLowerCase();
                                                    
                                                    return problemName === diagnosisLower ||
                                                           diagnosisLower.includes(problemName) ||
                                                           problemName.includes(diagnosisLower) ||
                                                           (icd10Code && diagnosisLower.includes(icd10Code)) ||
                                                           (icd10Code && icd10Code.includes(diagnosisLower));
                                                });
                                                
                                                const diagnosisToUse = problem || {
                                                    id: `temp-${Date.now()}`,
                                                    problem_name: clickedDiagnosis,
                                                    name: clickedDiagnosis,
                                                    icd10_code: clickedDiagnosis.match(/^[A-Z]\d{2}(\.\d+)?/)?.[0] || null
                                                };
                                                
                                                setPreSelectedDiagnosisForOrder([diagnosisToUse]);
                                                setShowReferralModal(true);
                                                setClickedDiagnosis(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                        >
                                            <FilePlus className="w-3.5 h-3.5 text-orange-600" />
                                            Referral
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const problem = patientChartData.problems?.find(p => {
                                                    const problemName = (p.problem_name || p.name || '').toLowerCase();
                                                    const diagnosisLower = clickedDiagnosis.toLowerCase();
                                                    const icd10Code = (p.icd10_code || p.icd10Code || '').toLowerCase();
                                                    
                                                    return problemName === diagnosisLower ||
                                                           diagnosisLower.includes(problemName) ||
                                                           problemName.includes(diagnosisLower) ||
                                                           (icd10Code && diagnosisLower.includes(icd10Code)) ||
                                                           (icd10Code && icd10Code.includes(diagnosisLower));
                                                });
                                                
                                                const diagnosisToUse = problem || {
                                                    id: `temp-${Date.now()}`,
                                                    problem_name: clickedDiagnosis,
                                                    name: clickedDiagnosis,
                                                    icd10_code: clickedDiagnosis.match(/^[A-Z]\d{2}(\.\d+)?/)?.[0] || null
                                                };
                                                
                                                setPreSelectedDiagnosisForOrder([diagnosisToUse]);
                                                setShowOrderModal(true);
                                                setClickedDiagnosis(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                        >
                                            <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                                            Procedure
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete "${clickedDiagnosis}"?\n\nThis will also delete the associated plan item.`)) {
                                                    handleDeleteAssessmentDiagnosis(clickedDiagnosis);
                                                }
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                            Delete Diagnosis
                                        </button>
                                    </div>
                                </div>
                            )}
                            
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
                        {!isSigned && (
                            <div className="mb-2">
                                <button
                                    onClick={() => setShowOrdersetsModal(true)}
                                    className="w-full px-3 py-1.5 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded-md border border-green-300 transition-colors flex items-center justify-center space-x-1"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    <span>Browse Ordersets</span>
                                </button>
                            </div>
                        )}
                        <div className="relative">
                            {/* Show structured plan preview only when editing and there's structured data */}
                            {!isSigned && noteData.planStructured && noteData.planStructured.length > 0 && (
                                <div className="mb-2 p-2 bg-neutral-50 rounded-md border border-neutral-200">
                                    <div className="space-y-3">
                                        {noteData.planStructured.map((item, diagnosisIndex) => {
                                            const isEditingDiagnosis = planEditingState.editingDiagnosis === diagnosisIndex;
                                            const isAddingOrder = planEditingState.addingOrder === diagnosisIndex;
                                            
                                            return (
                                                <div key={diagnosisIndex} className="border-b border-neutral-200 last:border-b-0 pb-2 last:pb-0 group/plan">
                                                    <div className="flex items-start justify-between mb-1">
                                                        {isEditingDiagnosis ? (
                                                            <div className="flex-1 flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={planEditingState.editDiagnosisValue}
                                                                    onChange={(e) => setPlanEditingState(prev => ({ ...prev, editDiagnosisValue: e.target.value }))}
                                                                    onBlur={() => {
                                                                        if (planEditingState.editDiagnosisValue.trim()) {
                                                                            handleEditPlanDiagnosis(diagnosisIndex, planEditingState.editDiagnosisValue.trim());
                                                                        }
                                                                        setPlanEditingState(prev => ({ ...prev, editingDiagnosis: null, editDiagnosisValue: '' }));
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            if (planEditingState.editDiagnosisValue.trim()) {
                                                                                handleEditPlanDiagnosis(diagnosisIndex, planEditingState.editDiagnosisValue.trim());
                                                                            }
                                                                            setPlanEditingState(prev => ({ ...prev, editingDiagnosis: null, editDiagnosisValue: '' }));
                                                                        } else if (e.key === 'Escape') {
                                                                            setPlanEditingState(prev => ({ ...prev, editingDiagnosis: null, editDiagnosisValue: '' }));
                                                                        }
                                                                    }}
                                                                    className="flex-1 px-1.5 py-0.5 text-xs font-bold border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        if (planEditingState.editDiagnosisValue.trim()) {
                                                                            handleEditPlanDiagnosis(diagnosisIndex, planEditingState.editDiagnosisValue.trim());
                                                                        }
                                                                        setPlanEditingState(prev => ({ ...prev, editingDiagnosis: null, editDiagnosisValue: '' }));
                                                                    }}
                                                                    className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                                                    title="Save"
                                                                >
                                                                    <CheckSquare className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setPlanEditingState(prev => ({ ...prev, editingDiagnosis: null, editDiagnosisValue: '' }));
                                                                    }}
                                                                    className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div 
                                                                    className="font-bold underline text-xs text-neutral-900 flex-1 cursor-pointer hover:text-primary-600"
                                                                    onClick={() => {
                                                                        setPlanEditingState(prev => ({ ...prev, editingDiagnosis: diagnosisIndex, editDiagnosisValue: item.diagnosis }));
                                                                    }}
                                                                    title="Click to edit diagnosis"
                                                                >
                                                                    {diagnosisIndex + 1}. {item.diagnosis}
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover/plan:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            setPlanEditingState(prev => ({ ...prev, editingDiagnosis: diagnosisIndex, editDiagnosisValue: item.diagnosis }));
                                                                        }}
                                                                        className="p-1 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                                                                        title="Edit diagnosis"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm(`Are you sure you want to delete this plan item for "${item.diagnosis}"?`)) {
                                                                                handleDeletePlanItem(diagnosisIndex);
                                                                            }
                                                                        }}
                                                                        className="p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-700"
                                                                        title="Delete plan item"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <ul className="ml-4 space-y-0.5">
                                                        {item.orders.flatMap((order, orderIdx) => {
                                                            // Split order by semicolons to create separate bullet points
                                                            const orderParts = order.split(';').map(o => o.trim()).filter(o => o);
                                                            const isEditingOrder = planEditingState.editingOrder?.diagnosisIndex === diagnosisIndex && planEditingState.editingOrder?.orderIndex === orderIdx;
                                                            
                                                            // If editing, show the full order in edit mode
                                                            if (isEditingOrder) {
                                                                return (
                                                                    <li key={orderIdx} className="text-xs text-neutral-900 list-disc group/order flex items-center gap-0">
                                                                        <div className="flex-1 flex items-center gap-1">
                                                                            <input
                                                                                type="text"
                                                                                value={planEditingState.editOrderValue}
                                                                                onChange={(e) => setPlanEditingState(prev => ({ ...prev, editOrderValue: e.target.value }))}
                                                                                onBlur={() => {
                                                                                    if (planEditingState.editOrderValue.trim()) {
                                                                                        handleEditPlanOrder(diagnosisIndex, orderIdx, planEditingState.editOrderValue.trim());
                                                                                    }
                                                                                    setPlanEditingState(prev => ({ ...prev, editingOrder: null, editOrderValue: '' }));
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        if (planEditingState.editOrderValue.trim()) {
                                                                                            handleEditPlanOrder(diagnosisIndex, orderIdx, planEditingState.editOrderValue.trim());
                                                                                        }
                                                                                        setPlanEditingState(prev => ({ ...prev, editingOrder: null, editOrderValue: '' }));
                                                                                    } else if (e.key === 'Escape') {
                                                                                        setPlanEditingState(prev => ({ ...prev, editingOrder: null, editOrderValue: '' }));
                                                                                    }
                                                                                }}
                                                                                className="flex-1 px-1.5 py-0.5 text-xs border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                                autoFocus
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (planEditingState.editOrderValue.trim()) {
                                                                                        handleEditPlanOrder(diagnosisIndex, orderIdx, planEditingState.editOrderValue.trim());
                                                                                    }
                                                                                    setPlanEditingState(prev => ({ ...prev, editingOrder: null, editOrderValue: '' }));
                                                                                }}
                                                                                className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                                                                title="Save"
                                                                            >
                                                                                <CheckSquare className="w-3 h-3" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setPlanEditingState(prev => ({ ...prev, editingOrder: null, editOrderValue: '' }));
                                                                                }}
                                                                                className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                                                                title="Cancel"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            }
                                                            
                                                            // Otherwise, display each part as a separate bullet point
                                                            return orderParts.map((orderPart, partIdx) => {
                                                                const uniqueKey = `${orderIdx}-${partIdx}`;
                                                                return (
                                                                    <li key={uniqueKey} className="text-xs text-neutral-900 list-disc group/order flex items-center gap-0">
                                                                        <span className="flex-1">{orderPart}</span>
                                                                        {partIdx === 0 && (
                                                                            <div className="flex items-center gap-0 opacity-0 group-hover/order:opacity-100 transition-opacity inline-flex ml-1">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setPlanEditingState(prev => ({ ...prev, editingOrder: { diagnosisIndex, orderIndex: orderIdx }, editOrderValue: order }));
                                                                                    }}
                                                                                    className="p-0.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                                                                                    title="Edit order"
                                                                                >
                                                                                    <Edit2 className="w-2.5 h-2.5" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (window.confirm(`Are you sure you want to delete this order: "${order}"?`)) {
                                                                                            handleDeletePlanOrder(diagnosisIndex, orderIdx);
                                                                                        }
                                                                                    }}
                                                                                    className="p-0.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700"
                                                                                    title="Delete order"
                                                                                >
                                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </li>
                                                                );
                                                            });
                                                        })}
                                                        {isAddingOrder ? (
                                                            <li className="text-xs text-neutral-900 list-disc flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={planEditingState.newOrderValue}
                                                                    onChange={(e) => setPlanEditingState(prev => ({ ...prev, newOrderValue: e.target.value }))}
                                                                    onBlur={() => {
                                                                        if (planEditingState.newOrderValue.trim()) {
                                                                            handleAddPlanOrder(diagnosisIndex, planEditingState.newOrderValue.trim());
                                                                        }
                                                                        setPlanEditingState(prev => ({ ...prev, addingOrder: null, newOrderValue: '' }));
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            if (planEditingState.newOrderValue.trim()) {
                                                                                handleAddPlanOrder(diagnosisIndex, planEditingState.newOrderValue.trim());
                                                                            }
                                                                            setPlanEditingState(prev => ({ ...prev, addingOrder: null, newOrderValue: '' }));
                                                                        } else if (e.key === 'Escape') {
                                                                            setPlanEditingState(prev => ({ ...prev, addingOrder: null, newOrderValue: '' }));
                                                                        }
                                                                    }}
                                                                    className="flex-1 px-1.5 py-0.5 text-xs border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                    placeholder="Enter new order..."
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        if (planEditingState.newOrderValue.trim()) {
                                                                            handleAddPlanOrder(diagnosisIndex, planEditingState.newOrderValue.trim());
                                                                        }
                                                                        setPlanEditingState(prev => ({ ...prev, addingOrder: null, newOrderValue: '' }));
                                                                    }}
                                                                    className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                                                    title="Add"
                                                                >
                                                                    <CheckSquare className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setPlanEditingState(prev => ({ ...prev, addingOrder: null, newOrderValue: '' }));
                                                                    }}
                                                                    className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </li>
                                                        ) : (
                                                            <li className="text-xs">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Set the diagnosis for this plan item as pre-selected
                                                                        const diagnosisText = item.diagnosis;
                                                                        
                                                                        // Convert diagnosis string to object format that DiagnosisSelector expects
                                                                        // Format: "I25.3 - Aneurysm of heart" or just "Aneurysm of heart"
                                                                        const match = diagnosisText.match(/^([A-Z]\d{2}(?:\.\d+)?)\s*[-–—]\s*(.+)$/);
                                                                        let diagnosisObject;
                                                                        
                                                                        if (match) {
                                                                            // Has ICD-10 code
                                                                            diagnosisObject = {
                                                                                id: `plan-${diagnosisIndex}`,
                                                                                problem_name: match[2].trim(),
                                                                                name: match[2].trim(),
                                                                                icd10_code: match[1],
                                                                                icd10Code: match[1],
                                                                                status: 'active',
                                                                                fromAssessment: true
                                                                            };
                                                                        } else {
                                                                            // No code, treat entire string as name
                                                                            diagnosisObject = {
                                                                                id: `plan-${diagnosisIndex}`,
                                                                                problem_name: diagnosisText,
                                                                                name: diagnosisText,
                                                                                icd10_code: '',
                                                                                icd10Code: '',
                                                                                status: 'active',
                                                                                fromAssessment: true
                                                                            };
                                                                        }
                                                                        
                                                                        setPreSelectedDiagnosisForOrder([diagnosisObject]);
                                                                        setShowAddOrderMenu(true);
                                                                    }}
                                                                    className="text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 opacity-0 group-hover/plan:opacity-100 transition-opacity"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    <span>Add Order</span>
                                                                </button>
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Always show textarea - it will display formatted plan text when signed or when there's no structured plan */}
                            {(!noteData.planStructured || noteData.planStructured.length === 0 || isSigned) && (
                                isSigned ? (
                                    <div className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white text-neutral-900 leading-relaxed min-h-[80px]">
                                        {isSigned && noteData.planStructured && noteData.planStructured.length > 0 ? (
                                            // Display structured plan with bullet points
                                            <div className="space-y-3">
                                                {noteData.planStructured.map((item, diagnosisIndex) => (
                                                    <div key={diagnosisIndex}>
                                                        <div className="font-bold underline text-neutral-900 mb-1">
                                                            {diagnosisIndex + 1}. {item.diagnosis}
                                                        </div>
                                                        <ul className="ml-4 space-y-0.5 list-disc">
                                                            {item.orders.map((order, orderIdx) => (
                                                                <li key={orderIdx} className="text-neutral-700">
                                                                    {order}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : noteData.plan ? (
                                            // Display plain text plan, splitting by semicolons and newlines
                                            <ul className="list-disc ml-4 space-y-0.5">
                                                {noteData.plan
                                                    .split(/[;\n]/)
                                                    .map((item, idx) => {
                                                        const trimmed = item.trim();
                                                        if (!trimmed) return null;
                                                        return (
                                                            <li key={idx} className="text-neutral-700">
                                                                {markdownToHtml(trimmed)}
                                                            </li>
                                                        );
                                                    })
                                                    .filter(Boolean)
                                                }
                                            </ul>
                                        ) : null}
                                    </div>
                                ) : (
                                    <textarea ref={planRef} value={noteData.plan}
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
                                        rows={6}
                                        className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 leading-relaxed resize-y transition-colors text-neutral-900 min-h-[80px]"
                                        placeholder="Plan text (auto-generated from orders)..."
                                    />
                                )
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
                            <div className="mt-2 relative">
                                <button 
                                    onClick={() => {
                                        // Clear any pre-selected diagnosis when opening from main button (not from plan item)
                                        setPreSelectedDiagnosisForOrder([]);
                                        setShowAddOrderMenu(!showAddOrderMenu);
                                    }} 
                                    className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors flex items-center gap-1"
                                >
                                    <span>Add Order</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showAddOrderMenu ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {showAddOrderMenu && (
                                    <div 
                                        ref={addOrderMenuRef}
                                        className="bg-white border border-neutral-300 rounded-md shadow-lg z-[100] min-w-[160px] max-h-[200px] overflow-y-auto"
                                    >
                                        {hasPrivilege('order_labs') && (
                                            <button 
                                                onClick={() => {
                                                    // preSelectedDiagnosisForOrder is already set when clicking "Add Order" from plan
                                                    setShowOrderModal(true);
                                                    setShowAddOrderMenu(false);
                                                }} 
                                                className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-primary-50 transition-colors border-b border-neutral-100 first:rounded-t-md"
                                            >
                                                Add Lab
                                            </button>
                                        )}
                                        {hasPrivilege('e_prescribe') && (
                                            <button 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    // preSelectedDiagnosisForOrder is already set when clicking "Add Order" from plan
                                                    setShowEPrescribeEnhanced(true);
                                                    setShowAddOrderMenu(false);
                                                }} 
                                                className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-primary-50 transition-colors border-b border-neutral-100"
                                            >
                                                e-Prescribe
                                            </button>
                                        )}
                                        {hasPrivilege('create_referrals') && (
                                            <button 
                                                onClick={() => {
                                                    // preSelectedDiagnosisForOrder is already set when clicking "Add Order" from plan
                                                    setShowReferralModal(true);
                                                    setShowAddOrderMenu(false);
                                                }} 
                                                className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-primary-50 transition-colors last:rounded-b-md"
                                            >
                                                Send Referral
                                            </button>
                                        )}
                                    </div>
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
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setShowPrintableOrders(true)}
                                    className="px-2.5 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-1.5"
                                    title="Print Orders"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Print Orders</span>
                                </button>
                                <button 
                                    onClick={() => navigate(`/patient/${id}/snapshot`)} 
                                    className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5"
                                    title="Return to Chart"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Return to Chart</span>
                                </button>
                                <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                    <Printer className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                    {isSigned && (
                        <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-end gap-1.5">
                            <button 
                                onClick={() => setShowAddendumModal(true)} 
                                className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium"
                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                            >
                                <FilePlus className="w-3.5 h-3.5" />
                                <span>Add Addendum</span>
                            </button>
                            <button
                                onClick={() => setShowPrintableOrders(true)}
                                className="px-2.5 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-1.5"
                                title="Print Orders"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Orders</span>
                            </button>
                            <div className="flex items-center gap-1.5">
                                <button 
                                    onClick={() => navigate(`/patient/${id}/snapshot`)} 
                                    className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5"
                                    title="Return to Chart"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Return to Chart</span>
                                </button>
                                <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                    <Printer className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Addendums Section - Only show if note is signed */}
                    {isSigned && addendums.length > 0 && (
                        <Section title="Addendums" defaultOpen={true}>
                            <div className="space-y-2">
                                {addendums.map((addendum, idx) => (
                                    <div key={idx} className={`border-l-4 p-2 rounded ${
                                        addendum.signed 
                                            ? 'bg-green-50 border-green-400' 
                                            : 'bg-yellow-50 border-yellow-400'
                                    }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-600">
                                                {addendum.signed ? (
                                                    <>
                                                        <span className="font-semibold text-green-700">✓ Signed</span> by {addendum.signedByName} on {format(new Date(addendum.signedAt), 'MM/dd/yyyy h:mm a')}
                                                    </>
                                                ) : (
                                                    <>
                                                        Added by {addendum.addedByName} on {format(new Date(addendum.addedAt), 'MM/dd/yyyy h:mm a')}
                                                        <span className="ml-2 text-orange-600 font-semibold">(Unsigned - Must be signed)</span>
                                                    </>
                                                )}
                                            </div>
                                            {!addendum.signed && (
                                                <button
                                                    onClick={() => {
                                                        setAddendumToSignIndex(idx);
                                                        setShowSignAddendumModal(true);
                                                    }}
                                                    className="px-2 py-0.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                                >
                                                    Sign Addendum
                                                </button>
                                            )}
                                        </div>
                                        <div className={`text-xs whitespace-pre-wrap ${
                                            addendum.signed ? 'text-gray-900' : 'text-gray-800'
                                        }`}>
                                            {addendum.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Alert if addendums exist - Full width banner */}
                    {isSigned && addendums.length > 0 && (
                        <div className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-red-800 mb-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                            <span>⚠️ This note has {addendums.length} addendum{addendums.length > 1 ? 's' : ''}.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <OrderModal 
                isOpen={showOrderModal} 
                onClose={() => {
                    setShowOrderModal(false);
                    setPreSelectedDiagnosisForOrder([]);
                }} 
                patientId={id}
                visitId={currentVisitId || urlVisitId}
                diagnoses={diagnoses}
                preSelectedDiagnoses={preSelectedDiagnosisForOrder}
                assessmentDiagnoses={diagnoses}
                onAddToAssessment={handleAddDiagnosisToAssessment}
                returnTemplateOnly={showCreateOrdersetModal}
                onSuccess={(diagnosis, orderText, orderTemplates) => {
                    // If creating orderset, add order templates to newOrderset instead of plan
                    if (showCreateOrdersetModal && orderTemplates && Array.isArray(orderTemplates)) {
                        setNewOrderset(prev => ({
                            ...prev,
                            orders: [...prev.orders, ...orderTemplates]
                        }));
                        setShowOrderModal(false);
                        showToast(`${orderTemplates.length} order(s) added to orderset`, 'success');
                    } else if (showCreateOrdersetModal && orderTemplates) {
                        // Single order template
                        setNewOrderset(prev => ({
                            ...prev,
                            orders: [...prev.orders, orderTemplates]
                        }));
                        setShowOrderModal(false);
                        showToast('Order added to orderset', 'success');
                    } else {
                        addOrderToPlan(diagnosis, orderText);
                        showToast('Order created successfully', 'success');
                    }
                    setPreSelectedDiagnosisForOrder([]);
                }} 
            />
            <PrescriptionModal 
                isOpen={showPrescriptionModal} 
                onClose={() => setShowPrescriptionModal(false)} 
                diagnoses={diagnoses}
                patientId={id}
                assessmentDiagnoses={diagnoses}
                onAddToAssessment={handleAddDiagnosisToAssessment}
                onSuccess={(diagnosis, prescriptionText) => {
                    addOrderToPlan(diagnosis, prescriptionText);
                    showToast('Prescription added to plan', 'success');
                }} 
            />
            <ReferralModal 
                isOpen={showReferralModal} 
                onClose={() => setShowReferralModal(false)} 
                diagnoses={diagnoses}
                patientId={id}
                visitId={currentVisitId || urlVisitId}
                assessmentDiagnoses={diagnoses}
                onAddToAssessment={handleAddDiagnosisToAssessment}
                returnTemplateOnly={showCreateOrdersetModal}
                onSuccess={(diagnosis, referralText, referralTemplate) => {
                    // If creating orderset, add referral template to newOrderset instead of plan
                    if (showCreateOrdersetModal && referralTemplate) {
                        setNewOrderset(prev => ({
                            ...prev,
                            orders: [...prev.orders, referralTemplate]
                        }));
                        setShowReferralModal(false);
                        showToast('Referral added to orderset', 'success');
                    } else {
                        addOrderToPlan(diagnosis, referralText);
                        showToast('Referral created and added to plan', 'success');
                    }
                }} 
            />
            <EPrescribeEnhanced
                isOpen={showEPrescribeEnhanced}
                onClose={() => {
                    setShowEPrescribeEnhanced(false);
                    setPreSelectedDiagnosisForOrder([]);
                }}
                returnTemplateOnly={showCreateOrdersetModal}
                onSuccess={(diagnosis, prescriptionText, prescriptionTemplate) => {
                    // If creating orderset, add prescription template to newOrderset instead of plan
                    if (showCreateOrdersetModal && prescriptionTemplate) {
                        setNewOrderset(prev => ({
                            ...prev,
                            orders: [...prev.orders, prescriptionTemplate]
                        }));
                        setShowEPrescribeEnhanced(false);
                        showToast('Prescription added to orderset', 'success');
                    } else {
                        addOrderToPlan(diagnosis, prescriptionText);
                        showToast('Prescription added to plan', 'success');
                    }
                    setPreSelectedDiagnosisForOrder([]);
                }}
                patientId={id}
                patientName={patientData ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() : ''}
                visitId={currentVisitId || urlVisitId}
                preSelectedDiagnoses={preSelectedDiagnosisForOrder}
                assessmentDiagnoses={diagnoses}
                onAddToAssessment={handleAddDiagnosisToAssessment}
            />
            {showPrintModal && <VisitPrint visitId={currentVisitId || urlVisitId} patientId={id} onClose={() => setShowPrintModal(false)} />}
            
            {/* Printable Orders Modal */}
            {showPrintableOrders && (
                <PrintableOrders
                    visitId={currentVisitId || urlVisitId}
                    patientId={id}
                    patientName={patientData ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() : 'N/A'}
                    visitDate={visitData?.visit_date || visitData?.created_at || new Date().toISOString()}
                    planStructured={noteData.planStructured || []}
                    onClose={() => setShowPrintableOrders(false)}
                />
            )}
            
            {/* Add Addendum Modal */}
            {showAddendumModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddendumModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Add Addendum</h3>
                            <button onClick={() => setShowAddendumModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Addendum Text</label>
                                <textarea
                                    value={addendumText}
                                    onChange={(e) => setAddendumText(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent h-32"
                                    placeholder="Enter addendum text..."
                                />
                            </div>
                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => {
                                        setShowAddendumModal(false);
                                        setAddendumText('');
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAddAddendum(false)}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #6B7280, #4B5563)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #4B5563, #374151)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #6B7280, #4B5563)'}
                                >
                                    Add & Sign Later
                                </button>
                                <button
                                    onClick={() => handleAddAddendum(true)}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #10B981, #059669)'}
                                >
                                    Add & Sign Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sign Addendum Modal */}
            {showSignAddendumModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowSignAddendumModal(false);
                    setAddendumToSignIndex(null);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Sign Addendum</h3>
                            <button onClick={() => {
                                setShowSignAddendumModal(false);
                                setAddendumToSignIndex(null);
                            }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p className="text-sm text-yellow-800">
                                    <strong>Warning:</strong> Once signed, this addendum cannot be edited or deleted. 
                                    This action is permanent and legally binding.
                                </p>
                            </div>
                            {addendumToSignIndex !== null && addendums[addendumToSignIndex] && (
                                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                                    <p className="text-xs text-gray-600 mb-1">Addendum Text:</p>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{addendums[addendumToSignIndex].text}</p>
                                </div>
                            )}
                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => {
                                        setShowSignAddendumModal(false);
                                        setAddendumToSignIndex(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSignAddendum}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
                                >
                                    Sign Addendum
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Unified Patient Chart Panel */}
            <PatientChartPanel
                patientId={id}
                isOpen={showPatientChart}
                onClose={() => setShowPatientChart(false)}
                initialTab={patientChartTab}
            />
            
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Enhanced ICD-10 Search Modal */}
            {showICD10Modal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowICD10Modal(false);
                    setIcd10Search('');
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Search ICD-10 Codes</h3>
                            <button onClick={() => {
                                setShowICD10Modal(false);
                                setIcd10Search('');
                            }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-hidden flex flex-col">
                            {/* Search Input */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by code or description (e.g., 'I10', 'hypertension', 'diabetes')..."
                                    value={icd10Search}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setIcd10Search(value);
                                        setShowIcd10Search(true);
                                    }}
                                    onFocus={() => {
                                        setShowIcd10Search(true);
                                        if (icd10Results.length === 0 && icd10Search.trim().length === 0) {
                                            codesAPI.searchICD10('').then(response => {
                                                if (response.data && response.data.length > 0) {
                                                    setIcd10Results(response.data);
                                                }
                                            }).catch(() => {});
                                        }
                                    }}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    autoFocus
                                />
                            </div>
                            
                            {/* Results */}
                            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md">
                                {icd10Results.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {icd10Results.map((code) => {
                                            const searchLower = icd10Search.toLowerCase();
                                            const codeMatch = code.code.toLowerCase().includes(searchLower);
                                            const descMatch = code.description.toLowerCase().includes(searchLower);
                                            
                                            // Highlight matching text
                                            const highlightText = (text, searchTerm) => {
                                                if (!searchTerm) return text;
                                                const regex = new RegExp(`(${searchTerm})`, 'gi');
                                                const parts = text.split(regex);
                                                return parts.map((part, i) => 
                                                    regex.test(part) ? (
                                                        <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
                                                    ) : part
                                                );
                                            };
                                            
                                            const hasHierarchy = codesWithHierarchy.has(code.code);
                                            
                                            return (
                                                <div key={code.code} className={`p-3 hover:bg-primary-50 transition-colors ${hasHierarchy ? 'border-l-4 border-green-500 bg-green-50 border-r-2 border-r-green-200' : ''}`}>
                                                    <div className="flex items-start justify-between">
                                                        <button
                                                            onClick={async () => {
                                                                await handleAddICD10(code, false);
                                                                // Close modal - hierarchy will open on top if needed
                                                                setTimeout(() => {
                                                                    if (!showHierarchySelector) {
                                                                        setShowICD10Modal(false);
                                                                    }
                                                                }, 100);
                                                            }}
                                                            className="flex-1 text-left"
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-mono font-semibold text-sm text-primary-700">
                                                                    {highlightText(code.code, searchLower)}
                                                                </span>
                                                                {hasHierarchy && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md shadow-sm">
                                                                        <Layers className="w-3.5 h-3.5" />
                                                                        REFINE
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-700">
                                                                {highlightText(code.description, searchLower)}
                                                            </div>
                                                        </button>
                                                        <div className="flex items-center gap-2 ml-3">
                                                            {hasHierarchy && (
                                                                <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                            )}
                                                            <button
                                                                onClick={async () => {
                                                                    await handleAddICD10(code, true);
                                                                    // Close modal - hierarchy will open on top if needed
                                                                    setTimeout(() => {
                                                                        if (!showHierarchySelector) {
                                                                            setShowICD10Modal(false);
                                                                        }
                                                                    }, 100);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md transition-colors whitespace-nowrap"
                                                                title="Add to Problem List"
                                                            >
                                                                + Problem
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : icd10Search.trim().length > 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-gray-500">No codes found matching "{icd10Search}"</p>
                                        <p className="text-sm text-gray-400 mt-2">Try a different search term</p>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">Start typing to search ICD-10 codes</p>
                                        <p className="text-sm text-gray-400 mt-2">Search by code (e.g., I10) or description (e.g., hypertension)</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer with tips */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <div>
                                        <strong>Tip:</strong> Search by code (e.g., "I10") or description (e.g., "hypertension")
                                        {codesWithHierarchy.size > 0 && (
                                            <span className="ml-2 text-green-600 font-medium">
                                                • {codesWithHierarchy.size} code{codesWithHierarchy.size !== 1 ? 's' : ''} can be refined
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {checkingHierarchies && (
                                            <span className="text-blue-600 text-xs">Checking...</span>
                                        )}
                                        {icd10Results.length > 0 && `${icd10Results.length} result${icd10Results.length !== 1 ? 's' : ''} found`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ICD-10 Hierarchy Selector */}
            <ICD10HierarchySelector
                isOpen={showHierarchySelector}
                onClose={() => {
                    setShowHierarchySelector(false);
                    setSelectedCodeForHierarchy(null);
                    setSelectedDescriptionForHierarchy(null);
                }}
                onSelect={handleHierarchySelect}
                initialCode={selectedCodeForHierarchy}
                initialDescription={selectedDescriptionForHierarchy}
            />

            {/* Ordersets Modal */}
            {showOrdersetsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowOrdersetsModal(false);
                    setOrdersetsSearch('');
                    setOrdersetsCategory('');
                    setShowFavoritesOnly(false);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">Cardiology Ordersets</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        // Pre-fill with current assessment diagnoses if available
                                        const currentDiagnosis = diagnoses && diagnoses.length > 0 ? diagnoses[0] : '';
                                        setNewOrderset({
                                            name: currentDiagnosis ? `${currentDiagnosis.split(' - ')[1] || currentDiagnosis} Orderset` : 'New Orderset',
                                            description: '',
                                            orders: [],
                                            currentOrderType: 'lab',
                                            currentOrderName: ''
                                        });
                                        setShowCreateOrdersetModal(true);
                                    }}
                                    className="px-2 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Create Orderset</span>
                                </button>
                                <button onClick={() => {
                                    setShowOrdersetsModal(false);
                                    setOrdersetsSearch('');
                                    setOrdersetsCategory('');
                                    setShowFavoritesOnly(false);
                                }} className="p-0.5 hover:bg-gray-100 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-2 flex-1 overflow-hidden flex flex-col">
                            {/* Search and Filter */}
                            <div className="mb-2 space-y-1.5">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search ordersets..."
                                        value={ordersetsSearch}
                                        onChange={(e) => setOrdersetsSearch(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-1.5">
                                    <select
                                        value={ordersetsCategory}
                                        onChange={(e) => setOrdersetsCategory(e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                    >
                                        <option value="">All Categories</option>
                                        <option value="diagnostic">Diagnostic</option>
                                        <option value="acute_care">Acute Care</option>
                                        <option value="inpatient">Inpatient</option>
                                        <option value="outpatient">Outpatient</option>
                                        <option value="procedure">Procedure</option>
                                        <option value="monitoring">Monitoring</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                                        className={`px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 flex items-center gap-1 transition-colors ${
                                            showFavoritesOnly 
                                                ? 'bg-yellow-50 border-yellow-300 text-yellow-700' 
                                                : 'bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <Star 
                                            className={`w-3 h-3 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
                                        />
                                        <span>Favorites</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Ordersets List */}
                            <div ref={ordersetsListRef} className="flex-1 overflow-y-auto border border-gray-200 rounded">
                                {ordersets.length > 0 ? (
                                    <div>
                                        {ordersets
                                            .filter(os => {
                                                const matchesSearch = !ordersetsSearch || 
                                                    os.name.toLowerCase().includes(ordersetsSearch.toLowerCase()) ||
                                                    (os.description && os.description.toLowerCase().includes(ordersetsSearch.toLowerCase()));
                                                const matchesCategory = !ordersetsCategory || os.category === ordersetsCategory;
                                                const matchesFavorites = !showFavoritesOnly || os.isFavorite;
                                                return matchesSearch && matchesCategory && matchesFavorites;
                                            })
                                            .sort((a, b) => {
                                                // Sort favorites first
                                                if (a.isFavorite && !b.isFavorite) return -1;
                                                if (!a.isFavorite && b.isFavorite) return 1;
                                                return a.name.localeCompare(b.name);
                                            })
                                            .map((orderset) => (
                                                <div key={orderset.id} data-orderset-id={orderset.id} className="px-2 py-1.5 hover:bg-primary-50 transition-colors border-b border-gray-100 last:border-b-0" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <h4 className="font-semibold text-xs text-gray-900 truncate">{orderset.name}</h4>
                                                                <button
                                                                    type="button"
                                                                    onClick={async (e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        
                                                                        // Save the clicked element's position relative to viewport
                                                                        const clickedElement = e.currentTarget.closest('[data-orderset-id]');
                                                                        const ordersetId = orderset.id;
                                                                        let elementOffsetFromTop = 0;
                                                                        let containerScrollTop = 0;
                                                                        
                                                                        if (clickedElement && ordersetsListRef.current) {
                                                                            // Get the element's position relative to the scrollable container
                                                                            elementOffsetFromTop = clickedElement.offsetTop;
                                                                            containerScrollTop = ordersetsListRef.current.scrollTop;
                                                                        }
                                                                        
                                                                        try {
                                                                            const response = await ordersetsAPI.toggleFavorite(orderset.id);
                                                                            // Update the orderset in the list
                                                                            // Response structure: { data: { isFavorite: true/false } }
                                                                            const newFavoriteStatus = response?.data?.isFavorite !== undefined 
                                                                                ? response.data.isFavorite 
                                                                                : !orderset.isFavorite;
                                                                            
                                                                            setOrdersets(prev => prev.map(os => 
                                                                                os.id === orderset.id 
                                                                                    ? { ...os, isFavorite: newFavoriteStatus }
                                                                                    : os
                                                                            ));
                                                                            
                                                                            // Restore scroll position to keep the same element visible
                                                                            // Use multiple animation frames to ensure DOM has updated after sort
                                                                            requestAnimationFrame(() => {
                                                                                requestAnimationFrame(() => {
                                                                                    if (ordersetsListRef.current) {
                                                                                        // Find the element by ID after re-render (it may have moved due to sorting)
                                                                                        const elementAfterUpdate = ordersetsListRef.current.querySelector(`[data-orderset-id="${ordersetId}"]`);
                                                                                        if (elementAfterUpdate) {
                                                                                            // Calculate the new scroll position to keep the element in the same visual position
                                                                                            const newElementOffset = elementAfterUpdate.offsetTop;
                                                                                            const scrollDifference = newElementOffset - elementOffsetFromTop;
                                                                                            ordersetsListRef.current.scrollTop = containerScrollTop + scrollDifference;
                                                                                        } else {
                                                                                            // Fallback: restore original scroll position
                                                                                            ordersetsListRef.current.scrollTop = containerScrollTop;
                                                                                        }
                                                                                    }
                                                                                });
                                                                            });
                                                                            
                                                                            showToast(
                                                                                newFavoriteStatus 
                                                                                    ? 'Added to favorites' 
                                                                                    : 'Removed from favorites', 
                                                                                'success'
                                                                            );
                                                                        } catch (error) {
                                                                            console.error('Error toggling favorite:', error);
                                                                            console.error('Error response:', error.response);
                                                                            const errorMsg = error.response?.data?.error || error.message || 'Failed to update favorite';
                                                                            showToast(errorMsg, 'error');
                                                                        }
                                                                    }}
                                                                    className="p-0.5 hover:bg-yellow-50 rounded transition-colors flex-shrink-0"
                                                                    title={orderset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                                >
                                                                    <Star 
                                                                        className={`w-3 h-3 ${orderset.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
                                                                    />
                                                                </button>
                                                            </div>
                                                            {orderset.description && (
                                                                <p className="text-[10px] text-gray-600 mb-0.5 line-clamp-1">{orderset.description}</p>
                                                            )}
                                                            <div className="flex flex-wrap gap-0.5 mb-0.5">
                                                                {orderset.tags && orderset.tags.slice(0, 2).map((tag, idx) => (
                                                                    <span key={idx} className="px-1 py-0 text-[10px] bg-gray-100 text-gray-700 rounded">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-[10px] text-gray-500">
                                                                {Array.isArray(orderset.orders) ? orderset.orders.length : 0} order{orderset.orders?.length !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                        <div className="relative z-10 flex-shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    try {
                                                                        // Validate orderset has orders
                                                                        if (!orderset.orders || !Array.isArray(orderset.orders) || orderset.orders.length === 0) {
                                                                            showToast(`Orderset "${orderset.name}" has no orders to apply.`, 'warning');
                                                                            console.warn('Orderset has no orders:', orderset);
                                                                            return;
                                                                        }
                                                                        
                                                                        // Validate required IDs
                                                                        if (!id) {
                                                                            showToast('Patient ID is missing. Please refresh the page.', 'error');
                                                                            return;
                                                                        }
                                                                        
                                                                        const visitId = currentVisitId || urlVisitId;
                                                                        if (!visitId || visitId === 'new') {
                                                                            showToast('Please save the visit first before applying ordersets.', 'warning');
                                                                            return;
                                                                        }
                                                                        
                                                                        console.log('Applying orderset:', orderset.name, 'ID:', orderset.id);
                                                                        
                                                                        // Extract diagnosis IDs from assessment - improved matching
                                                                        const assessmentDiagnoses = diagnoses || [];
                                                                        let diagnosisIds = [];
                                                                        let selectedDiagnosisText = null; // Store the diagnosis text for display
                                                                        let diagnosisToAdd = null; // Diagnosis to add to assessment if not present
                                                                        
                                                                        // Always try to infer diagnosis from orderset name first
                                                                        let inferredDiagnosis = null;
                                                                        try {
                                                                            // Extract key terms from orderset name for searching
                                                                            const searchTerms = orderset.name
                                                                                .toLowerCase()
                                                                                .replace(/\(.*?\)/g, '') // Remove parentheticals
                                                                                .replace(/\s+/g, ' ')
                                                                                .trim();
                                                                            
                                                                            // Search for ICD-10 codes matching the orderset name
                                                                            const searchResponse = await codesAPI.searchICD10(searchTerms);
                                                                            
                                                                            if (searchResponse?.data?.length > 0) {
                                                                                // Use the first result (should be the most relevant)
                                                                                const matchedCode = searchResponse.data[0];
                                                                                inferredDiagnosis = `${matchedCode.code} - ${matchedCode.description}`;
                                                                            } else {
                                                                                // Fallback: try searching with just the first word or key term
                                                                                const firstWord = searchTerms.split(' ')[0];
                                                                                if (firstWord && firstWord.length > 3) {
                                                                                    const fallbackResponse = await codesAPI.searchICD10(firstWord);
                                                                                    if (fallbackResponse?.data?.length > 0) {
                                                                                        const matchedCode = fallbackResponse.data[0];
                                                                                        inferredDiagnosis = `${matchedCode.code} - ${matchedCode.description}`;
                                                                                    }
                                                                                }
                                                                            }
                                                                        } catch (searchError) {
                                                                            console.error('Error searching for ICD-10 code:', searchError);
                                                                        }
                                                                        
                                                                        // Check if inferred diagnosis is already in assessment
                                                                        const isInferredDiagnosisInAssessment = inferredDiagnosis && 
                                                                            assessmentDiagnoses.some(diag => {
                                                                                const diagCode = diag.split(' - ')[0]?.trim();
                                                                                const inferredCode = inferredDiagnosis.split(' - ')[0]?.trim();
                                                                                return diagCode === inferredCode;
                                                                            });
                                                                        
                                                                        if (inferredDiagnosis && !isInferredDiagnosisInAssessment) {
                                                                            // Add the inferred diagnosis to assessment
                                                                            diagnosisToAdd = inferredDiagnosis;
                                                                            selectedDiagnosisText = inferredDiagnosis;
                                                                            
                                                                            // Extract code from inferred diagnosis
                                                                            const inferredCode = inferredDiagnosis.split(' - ')[0]?.trim();
                                                                            
                                                                            // Try to find matching problem
                                                                            const matchingProblem = patientChartData.problems?.find(p => {
                                                                                const problemCode = (p.icd10_code || '').toLowerCase();
                                                                                return problemCode === inferredCode.toLowerCase();
                                                                            });
                                                                            
                                                                            if (matchingProblem && matchingProblem.id) {
                                                                                diagnosisIds.push(matchingProblem.id);
                                                                            }
                                                                        } else if (assessmentDiagnoses.length > 0) {
                                                                            // Use existing diagnosis from assessment
                                                                            const primaryDiagnosis = assessmentDiagnoses[0];
                                                                            selectedDiagnosisText = primaryDiagnosis;
                                                                            
                                                                            // Extract diagnosis name and code (format: "Code - Description" or just "Description")
                                                                            const diagParts = primaryDiagnosis.split(' - ');
                                                                            const diagName = diagParts.length > 1 ? diagParts[1].trim() : diagParts[0].trim();
                                                                            const diagCode = diagParts.length > 1 ? diagParts[0].trim() : null;
                                                                            
                                                                            // Try to find matching problem in patient's problem list
                                                                            const matchingProblem = patientChartData.problems?.find(p => {
                                                                                const problemName = (p.problem_name || p.name || '').toLowerCase();
                                                                                const problemCode = (p.icd10_code || '').toLowerCase();
                                                                                const searchName = diagName.toLowerCase();
                                                                                
                                                                                // Match by name or code
                                                                                return problemName === searchName || 
                                                                                       searchName.includes(problemName) || 
                                                                                       problemName.includes(searchName) ||
                                                                                       (diagCode && problemCode === diagCode.toLowerCase());
                                                                            });
                                                                            
                                                                            if (matchingProblem && matchingProblem.id) {
                                                                                diagnosisIds.push(matchingProblem.id);
                                                                            }
                                                                        } else {
                                                                            // No diagnosis found and couldn't infer one
                                                                            // Still allow applying orderset, but warn the user
                                                                            console.warn('No diagnosis found for orderset:', orderset.name);
                                                                            showToast('Note: No matching diagnosis found. Orders will be added without a specific diagnosis link.', 'info');
                                                                        }
                                                                        
                                                                        const requestData = {
                                                                            patientId: id,
                                                                            visitId: visitId,
                                                                            diagnosisIds
                                                                        };
                                                                        
                                                                        console.log('Calling ordersetsAPI.apply with:', { ordersetId: orderset.id, requestData });
                                                                        const response = await ordersetsAPI.apply(orderset.id, requestData);
                                                                        console.log('Orderset apply response:', response);
                                                                        
                                                                        // Add diagnosis to assessment if it was inferred and not already present
                                                                        // Use functional update to ensure we're working with latest state
                                                                        if (diagnosisToAdd) {
                                                                            setNoteData(prev => {
                                                                                const currentAssessment = prev.assessment || '';
                                                                                const currentLines = currentAssessment.split('\n').filter(line => line.trim());
                                                                                
                                                                                // Check if diagnosis is already in assessment (by code)
                                                                                const diagnosisCode = diagnosisToAdd.split(' - ')[0]?.trim();
                                                                                const isAlreadyPresent = currentLines.some(line => {
                                                                                    const lineCode = line.split(' - ')[0]?.trim();
                                                                                    return lineCode === diagnosisCode;
                                                                                });
                                                                                
                                                                                if (!isAlreadyPresent) {
                                                                                    // Preserve existing assessment and append new diagnosis
                                                                                    const newAssessment = currentAssessment.trim()
                                                                                        ? `${currentAssessment.trim()}\n${diagnosisToAdd}`
                                                                                        : diagnosisToAdd;
                                                                                    
                                                                                    // Re-render assessment to show clickable diagnoses
                                                                                    setTimeout(() => {
                                                                                        if (assessmentRef.current && !isSigned) {
                                                                                            renderClickableDiagnoses(assessmentRef.current, newAssessment);
                                                                                        }
                                                                                    }, 50);
                                                                                    
                                                                                    return { ...prev, assessment: newAssessment };
                                                                                }
                                                                                
                                                                                // Diagnosis already present, don't modify assessment
                                                                                return prev;
                                                                            });
                                                                        }
                                                                        
                                                                        // Show success message
                                                                        showToast(`Successfully applied orderset: ${orderset.name}`, 'success');
                                                                        
                                                                        // Close modal
                                                                        setShowOrdersetsModal(false);
                                                                        setOrdersetsSearch('');
                                                                        setOrdersetsCategory('');
                                                                        
                                                                        // Fetch the created orders and add them to the plan
                                                                        if (!response || !response.data) {
                                                                            console.error('Invalid response from ordersetsAPI.apply:', response);
                                                                            showToast('Error: Invalid response from server. Please try again.', 'error');
                                                                            return;
                                                                        }
                                                                        
                                                                        if (response.data?.orders && response.data.orders.length > 0) {
                                                                            console.log('Processing', response.data.orders.length, 'orders from response');
                                                                            const createdOrders = response.data.orders;
                                                                            
                                                                            // Format order text based on order type and payload
                                                                            const formatOrderText = (order) => {
                                                                                const payload = typeof order.order_payload === 'string' 
                                                                                    ? JSON.parse(order.order_payload) 
                                                                                    : (order.order_payload || {});
                                                                                const orderType = order.order_type;
                                                                                
                                                                                if (orderType === 'lab' && payload.testName) {
                                                                                    return `Lab: ${payload.testName}${payload.cpt ? ` (CPT: ${payload.cpt})` : ''}`;
                                                                                } else if (orderType === 'imaging' && payload.studyName) {
                                                                                    return `Imaging: ${payload.studyName}${payload.cpt ? ` (CPT: ${payload.cpt})` : ''}`;
                                                                                } else if ((orderType === 'prescription' || orderType === 'rx') && payload.medication) {
                                                                                    return `Rx: ${payload.medication}${payload.sig ? ` - ${payload.sig}` : ''}${payload.quantity ? ` (Qty: ${payload.quantity})` : ''}`;
                                                                                } else if (orderType === 'referral' && payload.specialist) {
                                                                                    return `Referral: ${payload.specialist}${payload.reason ? ` - ${payload.reason}` : ''}`;
                                                                                } else if (orderType === 'procedure' && payload.procedureName) {
                                                                                    return `Procedure: ${payload.procedureName}${payload.cpt ? ` (CPT: ${payload.cpt})` : ''}`;
                                                                                } else {
                                                                                    // Fallback: format the payload
                                                                                    return `${orderType}: ${JSON.stringify(payload)}`;
                                                                                }
                                                                            };
                                                                            
                                                                            // Group orders by diagnosis
                                                                            const ordersByDiagnosis = {};
                                                                            
                                                                            // Use the selected diagnosis text from assessment, or find from problems
                                                                            let diagnosisName = 'General';
                                                                            
                                                                            if (selectedDiagnosisText) {
                                                                                // Use the full diagnosis text from assessment (e.g., "I25.3 - Aneurysm of heart")
                                                                                diagnosisName = selectedDiagnosisText;
                                                                            } else if (diagnosisIds && diagnosisIds.length > 0) {
                                                                                // Fallback: use problem name from patient chart
                                                                                const problem = patientChartData.problems?.find(p => diagnosisIds.includes(p.id));
                                                                                if (problem) {
                                                                                    const problemName = problem.problem_name || problem.name || 'General';
                                                                                    const problemCode = problem.icd10_code ? ` (${problem.icd10_code})` : '';
                                                                                    diagnosisName = `${problemName}${problemCode}`;
                                                                                }
                                                                            } else if (diagnoses && diagnoses.length > 0) {
                                                                                // Last resort: use first diagnosis from assessment
                                                                                diagnosisName = diagnoses[0];
                                                                            }
                                                                            
                                                                            // Group all orders under the selected diagnosis
                                                                            for (const order of createdOrders) {
                                                                                const orderText = formatOrderText(order);
                                                                                
                                                                                if (!ordersByDiagnosis[diagnosisName]) {
                                                                                    ordersByDiagnosis[diagnosisName] = [];
                                                                                }
                                                                                ordersByDiagnosis[diagnosisName].push(orderText);
                                                                            }
                                                                            
                                                                            // Convert to planStructured format and merge with existing plan
                                                                            const newPlanItems = Object.entries(ordersByDiagnosis).map(([diagnosis, orders]) => ({
                                                                                diagnosis,
                                                                                orders
                                                                            }));
                                                                            
                                                                            // Update planStructured while preserving existing items
                                                                            // Use functional update to ensure we're working with latest state
                                                                            setNoteData(prev => {
                                                                                // Get current plan from state (preserve all existing items)
                                                                                const currentPlan = prev.planStructured || [];
                                                                                
                                                                                // Create a deep copy to avoid mutation
                                                                                const mergedPlan = currentPlan.map(item => ({
                                                                                    diagnosis: item.diagnosis,
                                                                                    orders: [...item.orders] // Deep copy orders array
                                                                                }));
                                                                                
                                                                                // Merge new plan items into existing plan
                                                                                newPlanItems.forEach(newItem => {
                                                                                    const existingIndex = mergedPlan.findIndex(
                                                                                        item => item.diagnosis.toLowerCase() === newItem.diagnosis.toLowerCase()
                                                                                    );
                                                                                    if (existingIndex >= 0) {
                                                                                        // Merge orders into existing diagnosis (avoid duplicates)
                                                                                        const existingOrders = mergedPlan[existingIndex].orders;
                                                                                        newItem.orders.forEach(newOrder => {
                                                                                            // Check for duplicates (exact match)
                                                                                            if (!existingOrders.some(existing => existing === newOrder)) {
                                                                                                existingOrders.push(newOrder);
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        // Add new diagnosis with orders (preserve existing diagnoses)
                                                                                        mergedPlan.push({
                                                                                            diagnosis: newItem.diagnosis,
                                                                                            orders: [...newItem.orders] // Deep copy new orders
                                                                                        });
                                                                                    }
                                                                                });
                                                                                
                                                                                // Convert merged plan to text format for saving
                                                                                const formattedPlan = formatPlanText(mergedPlan);
                                                                                
                                                                                // Preserve all existing noteData fields, only update plan-related fields
                                                                                return {
                                                                                    ...prev,
                                                                                    planStructured: mergedPlan,
                                                                                    plan: formattedPlan
                                                                                    // Explicitly preserve assessment and all other fields
                                                                                };
                                                                            });
                                                                        }
                                                                        
                                                                        // Don't reload visit data as it might overwrite planStructured
                                                                        // Just refresh patient chart data if needed
                                                                        fetchPatientChartData(id, null);
                                                                    } catch (error) {
                                                                        console.error('Error applying orderset:', error);
                                                                        console.error('Error details:', {
                                                                            message: error.message,
                                                                            response: error.response,
                                                                            orderset: orderset.name,
                                                                            ordersetId: orderset.id
                                                                        });
                                                                        
                                                                        let errorMessage = 'Failed to apply orderset';
                                                                        if (error.response) {
                                                                            errorMessage = error.response.data?.error || error.response.data?.message || error.response.statusText || `Server error: ${error.response.status}`;
                                                                        } else if (error.message) {
                                                                            errorMessage = error.message;
                                                                        }
                                                                        
                                                                        showToast(`Error applying orderset "${orderset.name}": ${errorMessage}`, 'error');
                                                                    }
                                                                }}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                }}
                                                                className="ml-2 px-2 py-1 text-[10px] font-medium bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors whitespace-nowrap cursor-pointer relative z-10"
                                                                style={{ pointerEvents: 'auto', position: 'relative' }}
                                                            >
                                                                Apply Orderset
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">Loading ordersets...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Orderset Modal */}
            {showCreateOrdersetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowCreateOrdersetModal(false);
                    setNewOrderset({ name: '', description: '', orders: [], currentOrderType: 'lab', currentOrderName: '' });
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Create New Orderset</h3>
                            <button onClick={() => {
                                setShowCreateOrdersetModal(false);
                                setNewOrderset({ name: '', description: '', orders: [] });
                            }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Orderset Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newOrderset.name}
                                        onChange={(e) => setNewOrderset(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Hypertension Follow-up"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        autoFocus
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        value={newOrderset.description}
                                        onChange={(e) => setNewOrderset(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Brief description of when to use this orderset..."
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Orders */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Orders <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2 border border-gray-200 rounded-md p-3 max-h-64 overflow-y-auto">
                                        {newOrderset.orders.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-4">No orders added yet. Click "Add Order" below to add orders.</p>
                                        ) : (
                                            newOrderset.orders.map((order, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {order.type === 'lab' && 'Lab: '}
                                                            {order.type === 'imaging' && 'Imaging: '}
                                                            {order.type === 'prescription' && 'Prescription: '}
                                                            {order.type === 'rx' && 'Prescription: '}
                                                            {order.type === 'referral' && 'Referral: '}
                                                            {order.type === 'procedure' && 'Procedure: '}
                                                            {order.payload?.testName || order.payload?.studyName || order.payload?.medication || order.payload?.specialist || order.payload?.procedureName || 'Order'}
                                                        </div>
                                                        {order.payload?.cpt && (
                                                            <div className="text-xs text-gray-500">CPT: {order.payload.cpt}</div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setNewOrderset(prev => ({
                                                                ...prev,
                                                                orders: prev.orders.filter((_, i) => i !== idx)
                                                            }));
                                                        }}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        {hasPrivilege('order_labs') && (
                                            <button
                                                onClick={() => {
                                                    setShowOrderModal(true);
                                                    setPreSelectedDiagnosisForOrder(diagnoses && diagnoses.length > 0 ? [diagnoses[0]] : []);
                                                }}
                                                className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                            >
                                                Add Lab/Imaging
                                            </button>
                                        )}
                                        {hasPrivilege('e_prescribe') && (
                                            <button
                                                onClick={() => {
                                                    setShowEPrescribeEnhanced(true);
                                                    setPreSelectedDiagnosisForOrder(diagnoses && diagnoses.length > 0 ? [diagnoses[0]] : []);
                                                }}
                                                className="px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                            >
                                                Add Prescription
                                            </button>
                                        )}
                                        {hasPrivilege('create_referrals') && (
                                            <button
                                                onClick={() => {
                                                    setShowReferralModal(true);
                                                }}
                                                className="px-3 py-1.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                            >
                                                Add Referral
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 py-3 py-2 border-t border-gray-200 flex items-center justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowCreateOrdersetModal(false);
                                    setNewOrderset({ name: '', description: '', orders: [], currentOrderType: 'lab', currentOrderName: '' });
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newOrderset.name.trim()) {
                                        showToast('Please enter an orderset name', 'error');
                                        return;
                                    }
                                    if (newOrderset.orders.length === 0) {
                                        showToast('Please add at least one order', 'error');
                                        return;
                                    }
                                    
                                    try {
                                        const response = await ordersetsAPI.create({
                                            name: newOrderset.name.trim(),
                                            description: newOrderset.description.trim() || null,
                                            specialty: 'cardiology',
                                            category: 'general',
                                            orders: newOrderset.orders,
                                            tags: []
                                        });
                                        
                                        showToast('Orderset created successfully!', 'success');
                                        setShowCreateOrdersetModal(false);
                                        setNewOrderset({ name: '', description: '', orders: [], currentOrderType: 'lab', currentOrderName: '' });
                                        
                                        // Refresh ordersets list
                                        const ordersetsResponse = await ordersetsAPI.getAll({ specialty: 'cardiology' });
                                        setOrdersets(ordersetsResponse.data || []);
                                    } catch (error) {
                                        console.error('Error creating orderset:', error);
                                        console.error('Error response:', error.response?.data);
                                        console.error('Error details:', {
                                            message: error.message,
                                            status: error.response?.status,
                                            statusText: error.response?.statusText,
                                            data: error.response?.data
                                        });
                                        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to create orderset';
                                        const errorDetails = error.response?.data?.details;
                                        if (errorDetails) {
                                            console.error('Error details:', errorDetails);
                                            showToast(`${errorMsg}\n\nDetails: ${JSON.stringify(errorDetails, null, 2)}`, 'error');
                                        } else {
                                            showToast(errorMsg, 'error');
                                        }
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors"
                            >
                                Create Orderset
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
        </>
    );
};

export default VisitNote;
