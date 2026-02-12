/**
 * ChartingEngine.jsx
 * Main orchestrator component – wires all hooks together and renders the layout.
 * Replaces the monolithic VisitNote.jsx (~4300 lines).
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';

// Hooks
import { useChartingEngine, ACTIONS } from './hooks/useChartingEngine';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useVisitLoader } from './hooks/useVisitLoader';
import { useSigningWorkflow } from './hooks/useSigningWorkflow';
import { usePrivileges } from '../../hooks/usePrivileges';
import { useAuth } from '../../context/AuthContext';

// Utilities
import {
    combineNoteSections, isAbnormalVital, calculateBMI,
    rosFindings, peFindings, formatPlanText, decodeHtmlEntities,
} from './utils/noteSerializer';

// API
import {
    ordersCatalogAPI, codesAPI, icd10API, patientsAPI, visitsAPI,
    documentsAPI, documentsAPIUpdate, macrosAPI,
} from '../../services/api';

// Shared components (reused from legacy)
import Toast from '../../components/ui/Toast';
import { OrderModal, PrescriptionModal, ReferralModal } from '../../components/ActionModals';
import CosignModal from '../../components/CosignModal';
import CodeSearchModal from '../../components/CodeSearchModal';
import VisitPrint from '../../components/VisitPrint';
import PatientChartPanel from '../../components/PatientChartPanel';
import ChartReviewModal from '../../components/ChartReviewModal';
import DiagnosisPicker from '../../components/DiagnosisPicker';
import OrderPicker from '../../components/OrderPicker';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import PrintOrdersModal from '../../components/PrintOrdersModal';
import ResultImportModal from '../../components/ResultImportModal';
import DiagnosisLinkModal from '../../components/DiagnosisLinkModal';
import SignatureCard from '../../components/SignatureCard';
import { hpiDotPhrases } from '../../data/hpiDotPhrases';

// Section components (reused from legacy redesign)
import '../VisitNote.css';
import VisitNoteHeader from '../VisitNoteComponent/VisitNoteHeader';
import QuickNav from '../VisitNoteComponent/QuickNav';
import VisitNoteSection from '../VisitNoteComponent/VisitNoteSection';
import VitalsGrid from '../VisitNoteComponent/VitalsGrid';
import PlanDisplay from '../VisitNoteComponent/PlanDisplay';
import CommandPalette from '../VisitNoteComponent/CommandPalette';

// New modular section components (Phase 3–6)
import HPISection from './sections/HPISection';
import ROSPESection from './sections/ROSPESection';
import AssessmentSection from './sections/AssessmentSection';
import PlanSection from './sections/PlanSection';
import Storyboard from './sections/Storyboard';
// CommandPaletteV2 and SignWorkflow available but orchestrator uses legacy CommandPalette + inline sign prompt

import {
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList,
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History,
    Activity, ActivitySquare, CheckCircle2, CheckSquare, Square, Trash2,
    Pill, Users, UserCircle, ChevronRight, DollarSign, Eye, Calendar,
    AlertCircle, Stethoscope, ScrollText, Copy, RotateCcw, PanelRight,
    RefreshCw, StopCircle, FileImage, FlaskConical, Heart, Waves,
    FilePlus, Share2,
} from 'lucide-react';

import { ProblemInput, MedicationInput, AllergyInput, FamilyHistoryInput, SurgicalHistoryInput } from '../../components/PAMFOSInputs';

// ─── HistoryList (extracted helper) ─────────────────────────────────────────
const HistoryList = ({ title, icon, items, renderItem, onAdd, onDelete, emptyMessage, addPlaceholder = "Add item...", renderInput }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState('');
    const handleAdd = () => { if (newItem.trim()) { onAdd(newItem); setNewItem(''); setIsAdding(false); } };
    return (
        <div className="border rounded-md border-gray-100 bg-white">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">{icon}<h4 className="text-sm font-semibold text-gray-800">{title}</h4></div>
                {!isAdding && <button onClick={() => setIsAdding(true)} className="text-primary-600 hover:bg-primary-50 p-1 rounded"><Plus className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="p-2">
                {items?.length > 0 ? (
                    <div className="space-y-1">
                        {items.map((item, idx) => (
                            <div key={item.id || idx} className="group flex items-start justify-between py-1 px-2 hover:bg-gray-50 rounded text-sm">
                                <div className="flex-1 mr-2">{renderItem(item)}</div>
                                <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-xs text-gray-400 italic text-center py-2">{emptyMessage}</p>}
                {isAdding && (
                    <div className="mt-2">
                        {renderInput ? renderInput({ onSave: (data) => { onAdd(data); setIsAdding(false); }, onCancel: () => setIsAdding(false) }) : (
                            <div className="flex items-center gap-2">
                                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder={addPlaceholder} className="flex-1 text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 px-2 py-1" autoFocus />
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

// ─── Image Preview Component ────────────────────────────────────────────────
const ResultImage = ({ doc }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let active = true;
        documentsAPI.getFile(doc.id).then(res => { if (active) setSrc(URL.createObjectURL(res.data)); }).catch(() => { });
        return () => { active = false; };
    }, [doc.id]);

    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    const interpretation = tags.find(t => t.startsWith('interpretation:'))?.replace('interpretation:', '') || null;
    const metrics = tags.filter(t => t.includes(':') && !t.startsWith('interpretation:') && !t.startsWith('date:')).map(t => {
        const [key, ...v] = t.split(':');
        return { label: key.replace(/_/g, ' ').toUpperCase(), value: v.join(':') };
    });

    if (!src) return <div className="h-48 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 rounded-lg border border-gray-100 animate-pulse">Loading image...</div>;
    return (
        <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <a href={src} target="_blank" rel="noopener noreferrer" className="block group relative">
                <img src={src} alt={doc.filename} className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition-all" />
            </a>
            {metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                    {metrics.map((m, i) => (
                        <div key={i} className="bg-gray-50 p-2 rounded-md border border-gray-100/50">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest block leading-none mb-1">{m.label}</span>
                            <span className="text-[11px] font-bold text-gray-800 tabular-nums">{m.value}</span>
                        </div>
                    ))}
                </div>
            )}
            {interpretation && (
                <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-lg mt-1">
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">Clinical Interpretation</span>
                    <div className="text-[12px] font-bold text-gray-700 leading-tight italic">"{interpretation}"</div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ChartingEngine Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const ChartingEngine = () => {
    const params = useParams();
    const location = useLocation();
    const patientId = params.id;
    const urlVisitId = params.visitId || (location.pathname.endsWith('/visit/new') ? 'new' : undefined);

    const { user } = useAuth();
    const { hasPrivilege } = usePrivileges();

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ── Core Hooks ──────────────────────────────────────────────────────────
    const { state, dispatch, diagnoses, isLocked: baseLocked, updateField, updateVital, addDiagnosis, replaceDiagnosis, removeDiagnosis, addOrderToPlan, removeFromPlan } = useChartingEngine(urlVisitId);

    const { handleSave, performSave, clearBackup, cancelPendingAutoSave } = useAutoSave({ state, dispatch, patientId, showToast });

    const { commandPaletteOpen, setCommandPaletteOpen, commandSearchQuery, setCommandSearchQuery, closeCommandPalette, autocompleteState, setAutocompleteState, handleF2Key, handleDotPhraseAutocomplete, insertDotPhrase } = useKeyboardNav();

    const { previousWeight, previousWeightUnit, chartReviewData, navigate } = useVisitLoader({ patientId, urlVisitId, dispatch, showToast });

    const { handleSign, handleCosign, handleDelete, isAttending } = useSigningWorkflow({ state, dispatch, patientId, diagnoses, showToast, clearBackup, cancelPendingAutoSave });

    // ── Locking Logic ───────────────────────────────────────────────────────
    const isLocked = baseLocked || (state.isPreliminary && !isAttending && !state.isDirectEditing);

    // ── Modal State ─────────────────────────────────────────────────────────
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderModalTab, setOrderModalTab] = useState('labs');
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [showCosignModal, setShowCosignModal] = useState(false);
    const [showSignPrompt, setShowSignPrompt] = useState(false);
    const [selectedAttendingId, setSelectedAttendingId] = useState('');
    const [showOrderPicker, setShowOrderPicker] = useState(false);
    const [orderPickerType, setOrderPickerType] = useState(null);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
    const [showOrderDetails, setShowOrderDetails] = useState(false);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showPrintOrdersModal, setShowPrintOrdersModal] = useState(false);
    const [showChartReview, setShowChartReview] = useState(false);
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [retractData, setRetractData] = useState({ reason_code: 'ERROR', reason_text: '' });
    const [viewRetractedContent, setViewRetractedContent] = useState(false);
    const [editingDiagnosisIndex, setEditingDiagnosisIndex] = useState(null);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
    const [showCarryForward, setShowCarryForward] = useState(false);
    const [carryForwardField, setCarryForwardField] = useState(null);
    const [previousVisits, setPreviousVisits] = useState([]);
    const [loadingPrevVisits, setLoadingPrevVisits] = useState(false);
    const [showResultImportModal, setShowResultImportModal] = useState(false);
    const [resultImportType, setResultImportType] = useState(null);
    const [showDiagnosisLinkModal, setShowDiagnosisLinkModal] = useState(false);
    const [pendingMedAction, setPendingMedAction] = useState(null);
    const [attestationText, setAttestationText] = useState('');
    const [authorshipModel, setAuthorshipModel] = useState('Addendum');
    const [attestationMacros, setAttestationMacros] = useState([]);

    // ICD-10
    const [icd10Search, setIcd10Search] = useState('');
    const [icd10Results, setIcd10Results] = useState([]);
    const [showIcd10Search, setShowIcd10Search] = useState(false);

    // AI Summary
    const [aiSummary, setAiSummary] = useState('');

    // Dot phrases
    const [showDotPhraseModal, setShowDotPhraseModal] = useState(false);
    const [dotPhraseSearch, setDotPhraseSearch] = useState('');
    const [activeTextArea, setActiveTextArea] = useState(null);
    const [hpiDotPhraseSearch, setHpiDotPhraseSearch] = useState('');
    const [showHpiDotPhraseResults, setShowHpiDotPhraseResults] = useState(false);

    // Refs
    const hpiRef = useRef(null);
    const assessmentRef = useRef(null);
    const planRef = useRef(null);
    const systolicRef = useRef(null);
    const diastolicRef = useRef(null);
    const tempRef = useRef(null);
    const pulseRef = useRef(null);
    const respRef = useRef(null);
    const o2satRef = useRef(null);
    const weightRef = useRef(null);
    const heightRef = useRef(null);

    // ── Command Palette Search ──────────────────────────────────────────────
    const [commandSuggestions, setCommandSuggestions] = useState([]);
    const [isCommandLoading, setIsCommandLoading] = useState(false);

    useEffect(() => {
        if (!commandPaletteOpen || commandSearchQuery.length < 2) { setCommandSuggestions([]); return; }
        const performSearch = async () => {
            setIsCommandLoading(true);
            try {
                const [icd10Res, ordersRes] = await Promise.all([codesAPI.searchICD10(commandSearchQuery), ordersCatalogAPI.search(commandSearchQuery)]);
                setCommandSuggestions([
                    ...(icd10Res.data || []).slice(0, 5).map(i => ({ type: 'diagnosis', title: i.description, code: i.code, source: i })),
                    ...(ordersRes.data || []).slice(0, 5).map(o => ({ type: 'order', title: o.name, code: o.category, source: o })),
                ]);
            } catch (e) { console.error('Command Palette Search Error:', e); }
            finally { setIsCommandLoading(false); }
        };
        const timeout = setTimeout(performSearch, 300);
        return () => clearTimeout(timeout);
    }, [commandSearchQuery, commandPaletteOpen]);

    // ── ICD-10 Search ───────────────────────────────────────────────────────
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                const query = icd10Search.trim();
                const response = await icd10API.search(query);
                setIcd10Results(response.data || []);
                if (response.data?.length > 0 && query.length > 0) setShowIcd10Search(true);
            } catch (e) { setIcd10Results([]); }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    useEffect(() => {
        icd10API.search('').then(res => { if (res.data?.length > 0) setIcd10Results(res.data); }).catch(() => { });
    }, []);

    // ── Sync Plan to Assessment ─────────────────────────────────────────────
    useEffect(() => {
        if (diagnoses.length > 0) {
            dispatch({ type: ACTIONS.SYNC_PLAN_TO_ASSESSMENT, payload: diagnoses });
        }
    }, [diagnoses, dispatch]);

    // ── Handler Functions ───────────────────────────────────────────────────

    const handleTextChange = useCallback((value, field) => {
        updateField(field, value);
    }, [updateField]);

    const handleCommandSelect = useCallback((item) => {
        if (item.type === 'diagnosis') handleAddICD10(item.source, true);
        else if (item.type === 'order') handleOrderSelect(item.source);
        closeCommandPalette();
    }, [closeCommandPalette]);

    const handleAddICD10 = useCallback(async (code, addToProblem = false) => {
        if (addToProblem) {
            try {
                await patientsAPI.addProblem(patientId, { problemName: code.description, icd10Code: code.code, status: 'active' });
                showToast(`Added ${code.code} to problem list`, 'success');
            } catch (e) { showToast('Error adding to problem list', 'error'); }
        }
        if (editingDiagnosisIndex !== null) {
            replaceDiagnosis(editingDiagnosisIndex, code.code, code.description);
            setEditingDiagnosisIndex(null);
        } else {
            addDiagnosis(code.code, code.description);
        }
        setShowIcd10Search(false);
        setIcd10Search('');
        setShowICD10Modal(false);
    }, [patientId, editingDiagnosisIndex, replaceDiagnosis, addDiagnosis, showToast]);

    const handleOrderSelect = useCallback(async (order) => {
        const diagnosisToUse = selectedDiagnosis || diagnoses[0] || 'Unassigned';
        let prefix = '';
        if (order.type === 'LAB') prefix = 'Lab: ';
        else if (order.type === 'IMAGING') prefix = 'Imaging: ';
        else if (order.type === 'PROCEDURE') prefix = 'Procedure: ';
        const orderText = `${prefix}${order.name}${order.loinc_code ? ` [${order.loinc_code}]` : ''}`;

        try {
            await ordersCatalogAPI.createVisitOrder(state.currentVisitId || urlVisitId, {
                catalog_id: order.id, patient_id: patientId, diagnosis_icd10_ids: [diagnosisToUse], priority: 'ROUTINE',
            });
        } catch (err) { console.error('Failed to create visit order record', err); }

        addOrderToPlan(diagnosisToUse, orderText);
        setShowOrderPicker(false);
    }, [selectedDiagnosis, diagnoses, state.currentVisitId, urlVisitId, patientId, addOrderToPlan]);

    const addProblemToAssessment = useCallback((problem) => {
        const diagText = problem.icd10_code ? `${problem.problem_name} (${problem.icd10_code})` : problem.problem_name;
        if (diagnoses.some(d => d.toLowerCase().includes(problem.problem_name.toLowerCase()))) {
            showToast('Already in assessment', 'info'); return;
        }
        addDiagnosis(null, diagText);
        showToast(`Added: ${problem.problem_name}`, 'success');
    }, [diagnoses, addDiagnosis, showToast]);

    const addMedicationToPlan = useCallback((med, action) => {
        setPendingMedAction({ med, action });
        setShowDiagnosisLinkModal(true);
    }, []);

    const handleMedicationDiagnosisSelect = useCallback((diagnosisText) => {
        if (!pendingMedAction) return;
        const { med, action } = pendingMedAction;
        const actionText = action === 'continue'
            ? `Continue ${med.medication_name} ${med.dosage || ''} ${med.frequency || ''}`
            : action === 'refill'
                ? `Refill ${med.medication_name} ${med.dosage || ''} - 90 day supply`
                : `Discontinue ${med.medication_name}`;
        const cleanDiagnosis = diagnosisText.replace(/^\d+\.\s*/, '').trim();
        addOrderToPlan(cleanDiagnosis, actionText);
        setShowDiagnosisLinkModal(false);
        setPendingMedAction(null);
    }, [pendingMedAction, addOrderToPlan]);

    const handleUpdatePlan = useCallback((updatedPlan) => {
        dispatch({ type: ACTIONS.UPDATE_PLAN_STRUCTURED, payload: updatedPlan });
    }, [dispatch]);

    const getWeightChange = useCallback(() => {
        if (!state.vitals.weight || !previousWeight) return null;
        const current = parseFloat(state.vitals.weight);
        const prev = parseFloat(previousWeight);
        if (isNaN(current) || isNaN(prev)) return null;
        let curKg = state.vitals.weightUnit === 'lbs' ? current / 2.20462 : current;
        let prevKg = previousWeightUnit === 'lbs' ? prev / 2.20462 : prev;
        const change = curKg - prevKg;
        return { kg: change.toFixed(1), lbs: (change * 2.20462).toFixed(1), percent: ((change / prevKg) * 100).toFixed(1) };
    }, [state.vitals, previousWeight, previousWeightUnit]);

    const handleSignClick = useCallback(async () => {
        const result = await handleSign(selectedAttendingId);
        if (result === 'NEEDS_ATTENDING') setShowSignPrompt(true);
    }, [handleSign, selectedAttendingId]);

    // ── Carry Forward ─────────────────────────────────────────────────────
    const openCarryForward = useCallback(async (field) => {
        setCarryForwardField(field);
        setShowCarryForward(true);
        setLoadingPrevVisits(true);
        try {
            const res = await visitsAPI.getByPatient(patientId);
            setPreviousVisits((res.data || []).filter(v => v.id !== state.currentVisitId && v.note_draft).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)).slice(0, 10));
        } catch (e) { setPreviousVisits([]); }
        finally { setLoadingPrevVisits(false); }
    }, [patientId, state.currentVisitId]);

    // ── HPI Templates ────────────────────────────────────────────────────
    const hpiTemplates = useMemo(() => [
        { key: 'Chest Pain', text: 'Patient presents with chest pain. Location: substernal. Quality: pressure. Severity: [X]/10. Onset: [TIME]. Duration: [DURATION]. Radiation: [LOCATION].' },
        { key: 'Shortness of Breath', text: 'Patient presents with shortness of breath. Onset: [TIME]. Duration: [DURATION]. Severity: at rest / with exertion.' },
        { key: 'Hypertension F/U', text: 'Patient here for hypertension follow-up. Blood pressure at home: [BP READINGS]. Medication compliance: good/fair/poor.' },
        { key: 'Diabetes F/U', text: 'Patient here for diabetes management. Home glucose readings: fasting [#], post-prandial [#]. A1C target: <7%.' },
        { key: 'Heart Failure', text: 'Patient with history of heart failure, EF [#]%. Current symptoms: NYHA Class [I/II/III/IV]. Weight today: [#] lbs.' },
        { key: 'Palpitations', text: 'Patient presents with palpitations. Onset: [TIME]. Frequency: [FREQUENCY]. Duration of episodes: [DURATION].' },
    ], []);

    const insertHpiTemplate = useCallback((key, text) => {
        const newHpi = state.noteData.hpi ? `${state.noteData.hpi}\n\n${text}` : text;
        dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { hpi: newHpi } });
        showToast(`Inserted: ${key}`, 'success');
    }, [state.noteData.hpi, dispatch, showToast]);

    // ── Result Import ─────────────────────────────────────────────────────
    const handleResultImport = useCallback(async (content, dateStr, item) => {
        if (item?.type === 'document' && state.currentVisitId) {
            try {
                const docId = (item.id || '').replace('doc-', '');
                await documentsAPIUpdate.update(docId, { visit_id: state.currentVisitId });
            } catch (e) { console.error('Failed to link document to visit:', e); }
        }
        const timestamp = dateStr || format(new Date(), 'MM/dd/yyyy');
        const entry = content === 'Not available in records'
            ? `${resultImportType}: Not available in current records.`
            : `${resultImportType} (${timestamp}): ${content}`;
        dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { results: state.noteData.results ? `${state.noteData.results}\n${entry}` : entry } });
        showToast(`${resultImportType} imported`, 'success');
        setResultImportType(null);
    }, [state.currentVisitId, state.noteData.results, resultImportType, dispatch, showToast]);

    // ── Provider Name ─────────────────────────────────────────────────────
    const providerName = useMemo(() => {
        const visit = state.visitData || {};
        const currentUserName = user ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() : null;
        const signedByName = visit.signed_by_first_name && visit.signed_by_last_name ? `${visit.signed_by_first_name} ${visit.signed_by_last_name}` : null;
        const providerFromVisit = visit.provider_first_name && visit.provider_last_name ? `${visit.provider_first_name} ${visit.provider_last_name}` : null;
        if (state.isSigned && signedByName && signedByName !== 'System Administrator') return signedByName;
        if (currentUserName && currentUserName !== 'System Administrator') return currentUserName;
        if (providerFromVisit && providerFromVisit !== 'System Administrator') return providerFromVisit;
        return 'Provider';
    }, [state.visitData, state.isSigned, user]);

    // Attestation macros
    const fetchMacros = useCallback(async () => {
        try { setAttestationMacros((await macrosAPI.getAll({ category: 'Attestation' })).data || []); } catch (e) { }
    }, []);
    useEffect(() => { if (showCosignModal) fetchMacros(); }, [showCosignModal, fetchMacros]);

    // ── Loading Screen ────────────────────────────────────────────────────
    if (state.loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
                    <p className="text-gray-600">Loading visit...</p>
                </div>
            </div>
        );
    }

    const visitDate = state.visitData?.visit_date ? format(new Date(state.visitData.visit_date), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy');

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="vn-soft-ui min-h-screen pb-20">
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={closeCommandPalette}
                onSelect={handleCommandSelect}
                searchQuery={commandSearchQuery}
                setSearchQuery={setCommandSearchQuery}
                suggestions={commandSuggestions}
                isLoading={isCommandLoading}
            />

            <div className="w-full max-w-[1400px] mx-auto px-4 pt-6">
                <VisitNoteHeader
                    visitData={state.visitData}
                    visitType={state.visitType}
                    setVisitType={(v) => dispatch({ type: ACTIONS.SET_VISIT_TYPE, payload: v })}
                    isSigned={state.isSigned}
                    isPreliminary={state.isPreliminary}
                    isLocked={isLocked}
                    isRetracted={state.isRetracted}
                    isSaving={state.isSaving}
                    lastSaved={state.lastSaved}
                    handleSave={handleSave}
                    handleSign={handleSignClick}
                    setShowCosignModal={setShowCosignModal}
                    setShowPrintModal={setShowPrintModal}
                    setShowPrintOrdersModal={setShowPrintOrdersModal}
                    setShowChartReview={setShowChartReview}
                    showQuickActions={state.showQuickActions}
                    setShowQuickActions={(v) => dispatch({ type: ACTIONS.TOGGLE_QUICK_ACTIONS, payload: v })}
                    setShowRetractModal={setShowRetractModal}
                    viewRetractedContent={viewRetractedContent}
                    setViewRetractedContent={setViewRetractedContent}
                    retractionInfo={state.retractionInfo}
                    isDirectEditing={state.isDirectEditing}
                    setIsDirectEditing={(v) => dispatch({ type: ACTIONS.SET_DIRECT_EDITING, payload: v })}
                    handleCosign={handleCosign}
                    navigate={navigate}
                    id={patientId}
                    providerName={providerName}
                />

                <div className="vn-quick-bar-container">
                    <QuickNav sections={[
                        { id: 'vitals', label: 'Vitals' }, { id: 'hpi', label: 'HPI' },
                        { id: 'ros-pe', label: 'ROS/PE' }, { id: 'pamfos', label: 'History' },
                        { id: 'results', label: 'Results' }, { id: 'assessment', label: 'Assessment' },
                        { id: 'plan', label: 'Plan' },
                    ]} />
                </div>

                {/* Retraction Banner */}
                {state.isRetracted && (
                    <div className="bg-red-500/10 backdrop-blur-sm border border-red-200 p-5 rounded-3xl mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-200"><AlertCircle className="w-6 h-6" /></div>
                            <div>
                                <h3 className="text-sm font-bold text-red-900 uppercase tracking-widest">Retracted / Entered in Error</h3>
                                <p className="text-xs text-red-700 font-medium">
                                    Voided for clinical audit.
                                    {state.retractionInfo && ` (By ${state.retractionInfo.retracted_by_name} on ${format(new Date(state.retractionInfo.retracted_at), 'MM/dd/yyyy')})`}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setViewRetractedContent(!viewRetractedContent)} className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-bold border border-red-100 shadow-sm hover:bg-red-50 transition-all">
                            {viewRetractedContent ? 'Hide original content' : 'Review original content'}
                        </button>
                    </div>
                )}

                {/* Main Content */}
                <div className={`flex gap-4`}>
                    <div className={`${state.showQuickActions && !isLocked ? 'flex-1' : 'w-full'} transition-all duration-300 ${state.isRetracted && !viewRetractedContent ? 'opacity-40 blur-[1px] pointer-events-none grayscale' : ''}`}>
                        {/* Vitals */}
                        <VisitNoteSection title="Vital Signs" defaultOpen={true} id="vitals">
                            <VitalsGrid vitals={state.vitals} setVitals={(v) => dispatch({ type: ACTIONS.SET_VITALS, payload: v })} isLocked={isLocked} isAbnormalVital={isAbnormalVital} calculateBMI={calculateBMI} heightRef={heightRef} systolicRef={systolicRef} diastolicRef={diastolicRef} pulseRef={pulseRef} o2satRef={o2satRef} tempRef={tempRef} weightRef={weightRef} hpiRef={hpiRef} previousWeight={previousWeight} getWeightChange={getWeightChange} />
                        </VisitNoteSection>

                        {/* Chief Complaint + HPI */}
                        <HPISection
                            chiefComplaint={state.noteData.chiefComplaint}
                            hpi={state.noteData.hpi}
                            editedSections={state.editedSections}
                            isLocked={isLocked}
                            onUpdateField={updateField}
                            onF2Key={handleF2Key}
                            onDotPhraseAutocomplete={handleDotPhraseAutocomplete}
                            patientId={patientId}
                            currentVisitId={state.currentVisitId}
                        />

                        {/* ROS/PE with All Normal + NoteWriter */}
                        <VisitNoteSection title="Review of Systems / Physical Exam" defaultOpen={false} id="ros-pe">
                            <ROSPESection
                                ros={state.noteData.ros}
                                pe={state.noteData.pe}
                                rosNotes={state.noteData.rosNotes}
                                peNotes={state.noteData.peNotes}
                                isLocked={isLocked}
                                dispatch={dispatch}
                                ACTIONS={ACTIONS}
                            />
                        </VisitNoteSection>

                        {/* Assessment with unified ICD-10 search */}
                        <VisitNoteSection title="Assessment" defaultOpen={true} id="assessment">
                            <AssessmentSection
                                diagnoses={diagnoses}
                                isLocked={isLocked}
                                addDiagnosis={addDiagnosis}
                                removeDiagnosis={removeDiagnosis}
                                replaceDiagnosis={replaceDiagnosis}
                                patientId={patientId}
                                showToast={showToast}
                                onReorder={(from, to) => {
                                    const lines = (state.noteData.assessment || '').split('\n').filter(l => l.trim());
                                    const [moved] = lines.splice(from, 1);
                                    lines.splice(to, 0, moved);
                                    const newAssessment = lines.join('\n');
                                    // Also reorder planStructured to match
                                    const planCopy = [...(state.noteData.planStructured || [])];
                                    if (planCopy.length > from && planCopy.length > to) {
                                        const [movedPlan] = planCopy.splice(from, 1);
                                        planCopy.splice(to, 0, movedPlan);
                                    }
                                    dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { assessment: newAssessment, planStructured: planCopy, plan: formatPlanText(planCopy) } });
                                }}
                            />
                        </VisitNoteSection>

                        {/* Plan with per-diagnosis cards */}
                        <VisitNoteSection title="Plan" defaultOpen={true} id="plan">
                            <PlanSection
                                planStructured={state.noteData.planStructured}
                                diagnoses={diagnoses}
                                isLocked={isLocked}
                                addOrderToPlan={addOrderToPlan}
                                removeFromPlan={removeFromPlan}
                                onOpenOrderPicker={(type, diagnosis) => { setOrderPickerType(type); setSelectedDiagnosis(diagnosis); setShowOrderPicker(true); }}
                                onOpenReferral={(diagnosis) => { setSelectedDiagnosis(diagnosis); setShowReferralModal(true); }}
                                onOpenPrescription={(diagnosis) => { setSelectedDiagnosis(diagnosis); setShowPrescriptionModal(true); }}
                            />
                        </VisitNoteSection>

                        {/* Additional Sections (Care Plan, Follow Up) */}
                        <VisitNoteSection title="Care Plan" defaultOpen={false} id="care-plan">
                            <textarea value={state.noteData.carePlan || ''} onChange={(e) => handleTextChange(e.target.value, 'carePlan')} disabled={isLocked} placeholder="Document care plan..." className="vn-textarea min-h-[80px]" rows={3} />
                        </VisitNoteSection>
                        <VisitNoteSection title="Follow Up" defaultOpen={false} id="follow-up">
                            <textarea value={state.noteData.followUp || ''} onChange={(e) => handleTextChange(e.target.value, 'followUp')} disabled={isLocked} placeholder="Follow-up instructions..." className="vn-textarea min-h-[80px]" rows={3} />
                        </VisitNoteSection>

                        {/* Signature Cards (when signed) */}
                        {(state.isSigned || state.isPreliminary) && state.visitData && (
                            <SignatureCard visitData={state.visitData} />
                        )}

                        {/* Action Buttons */}
                        {!isLocked && (
                            <div className="flex items-center gap-3 mt-8 pb-8">
                                <button onClick={handleSave} className="px-6 py-3 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Save Draft
                                </button>
                                <button onClick={handleSignClick} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2">
                                    <Lock className="w-4 h-4" /> Sign Note
                                </button>
                                <button onClick={() => handleDelete(navigate)} className="px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-bold text-sm transition-all flex items-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Storyboard Sidebar */}
                    {state.showQuickActions && !isLocked && (
                        <Storyboard
                            patientData={state.patientData}
                            diagnoses={diagnoses}
                            isLocked={isLocked}
                            onAddProblem={addProblemToAssessment}
                            onMedicationAction={addMedicationToPlan}
                            onInsertTemplate={insertHpiTemplate}
                            onResultImport={(type) => { setResultImportType(type); setShowResultImportModal(true); }}
                            onOpenOrderPicker={(type) => { setOrderPickerType(type); setShowOrderPicker(true); }}
                            onOpenReferral={() => setShowReferralModal(true)}
                            hpiTemplates={hpiTemplates}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {showOrderPicker && <OrderPicker onSelect={handleOrderSelect} onClose={() => setShowOrderPicker(false)} filterType={orderPickerType} />}
            {showICD10Modal && <DiagnosisPicker onSelect={(code) => handleAddICD10(code)} onClose={() => { setShowICD10Modal(false); setEditingDiagnosisIndex(null); }} />}
            {showCosignModal && <CosignModal onCosign={handleCosign} onClose={() => setShowCosignModal(false)} attestationText={attestationText} setAttestationText={setAttestationText} authorshipModel={authorshipModel} setAuthorshipModel={setAuthorshipModel} macros={attestationMacros} onCreateMacro={async (d) => { await macrosAPI.create({ ...d, category: 'Attestation' }); fetchMacros(); }} onDeleteMacro={async (id) => { await macrosAPI.delete(id); fetchMacros(); }} />}
            {showPrintModal && <VisitPrint visitData={state.visitData} noteData={state.noteData} vitals={state.vitals} providerName={providerName} patientData={state.patientData} onClose={() => setShowPrintModal(false)} />}
            {showPrintOrdersModal && <PrintOrdersModal visitId={state.currentVisitId} patientId={patientId} onClose={() => setShowPrintOrdersModal(false)} />}
            {showChartReview && <ChartReviewModal visits={chartReviewData.visits} loading={chartReviewData.loading} onClose={() => setShowChartReview(false)} />}
            {showResultImportModal && <ResultImportModal patientId={patientId} resultType={resultImportType} onImport={handleResultImport} onClose={() => { setShowResultImportModal(false); setResultImportType(null); }} />}
            {showDiagnosisLinkModal && <DiagnosisLinkModal diagnoses={diagnoses} onSelect={handleMedicationDiagnosisSelect} onClose={() => { setShowDiagnosisLinkModal(false); setPendingMedAction(null); }} />}
            {showReferralModal && <ReferralModal onClose={() => setShowReferralModal(false)} patientId={patientId} visitId={state.currentVisitId} />}

            {/* Sign Prompt */}
            {showSignPrompt && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Select Attending for Cosignature</h3>
                        <select value={selectedAttendingId} onChange={(e) => setSelectedAttendingId(e.target.value)} className="w-full p-2 border rounded-lg mb-4">
                            <option value="">Select attending...</option>
                            {state.attendings.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowSignPrompt(false); handleSignClick(); }} disabled={!selectedAttendingId} className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold disabled:opacity-50">Submit</button>
                            <button onClick={() => setShowSignPrompt(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartingEngine;
