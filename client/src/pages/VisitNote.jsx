import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CosignModal from '../components/CosignModal';
import {
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList,
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History,
    Activity, ActivitySquare, CheckCircle2, CheckSquare, Square, Trash2, Pill, Users, UserCircle, ChevronRight,
    DollarSign, Eye, Calendar, AlertCircle, Stethoscope, ScrollText, Copy, RotateCcw,
    PanelRight, RefreshCw, StopCircle, FileImage, FlaskConical, Heart, Waves, FilePlus
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import { OrderModal, PrescriptionModal, ReferralModal } from '../components/ActionModals';

import CodeSearchModal from '../components/CodeSearchModal';
import VisitPrint from '../components/VisitPrint';
import PatientChartPanel from '../components/PatientChartPanel';
import ChartReviewModal from '../components/ChartReviewModal';

import DiagnosisPicker from '../components/DiagnosisPicker';
import OrderPicker from '../components/OrderPicker';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { usePrivileges } from '../hooks/usePrivileges';
import { useAuth } from '../context/AuthContext';
import { ordersCatalogAPI, visitsAPI, codesAPI, patientsAPI, icd10API, documentsAPI, documentsAPIUpdate, usersAPI, macrosAPI } from '../services/api';
import { format } from 'date-fns';
import { hpiDotPhrases } from '../data/hpiDotPhrases';
import { ProblemInput, MedicationInput, AllergyInput, FamilyHistoryInput, SurgicalHistoryInput } from '../components/PAMFOSInputs';

import PrintOrdersModal from '../components/PrintOrdersModal';
import ResultImportModal from '../components/ResultImportModal';
import DiagnosisLinkModal from '../components/DiagnosisLinkModal';
import SignatureCard from '../components/SignatureCard';

// Image preview component for protected documents
const ResultImage = ({ doc }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let active = true;
        documentsAPI.getFile(doc.id).then(res => {
            if (active) {
                const url = URL.createObjectURL(res.data);
                setSrc(url);
            }
        }).catch(e => console.error(e));
        return () => {
            active = false;
        };
    }, [doc.id]);

    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    const interpretationTag = tags.find(t => t.startsWith('interpretation:'));
    const interpretation = interpretationTag ? interpretationTag.replace('interpretation:', '') : null;

    // Extract other metrics from tags
    const metrics = tags.filter(t => t.includes(':') && !t.startsWith('interpretation:') && !t.startsWith('date:'))
        .map(t => {
            const [key, ...valParts] = t.split(':');
            const value = valParts.join(':');
            const label = key.replace(/_/g, ' ').toUpperCase();
            return { label, value };
        });

    if (!src) return <div className="h-48 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 rounded-lg border border-gray-100 animate-pulse">Loading image...</div>;
    return (
        <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <a href={src} target="_blank" rel="noopener noreferrer" className="block group relative">
                <img src={src} alt={doc.filename} className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition-all" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg" />
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

// Collapsible Section Component
const Section = ({ title, children, defaultOpen = true, isEdited = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`border ${isEdited ? 'border-blue-300 shadow-blue-50 ring-1 ring-blue-400/20' : 'border-gray-200'} rounded-xl bg-white shadow-sm mb-3 overflow-hidden transition-all duration-300`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 ${isEdited ? 'bg-blue-50/50' : 'bg-neutral-50'} border-b ${isEdited ? 'border-blue-100' : 'border-gray-200'} flex items-center justify-between hover:bg-opacity-80 transition-all`}
            >
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                    {isEdited && (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-black uppercase rounded border border-blue-600 shadow-sm shadow-blue-600/20 flex items-center gap-1">
                            <Sparkles className="w-2 h-2" />
                            Modified by Attending
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {isOpen && <div className="p-3 bg-white">{children}</div>}
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

const RetractionModal = ({ isOpen, onClose, onConfirm, data, setData }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-md shadow-2xl overflow-hidden border border-red-100">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-red-50 rounded-2xl">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 leading-tight">Retract Signed Note</h2>
                            <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-0.5">Entered in Error</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        This action will mark the note as <span className="font-bold">Retracted/Entered-in-Error</span>. The original content will be preserved but hidden by default. This cannot be undone.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Primary Reason</label>
                            <select
                                value={data.reason_code}
                                onChange={(e) => setData({ ...data, reason_code: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
                            >
                                <option value="ERROR">General Error</option>
                                <option value="WRONG_PATIENT">Wrong Patient</option>
                                <option value="DUPLICATE">Duplicate Entry</option>
                                <option value="WRONG_ENCOUNTER">Incorrect Encounter</option>
                                <option value="INCOMPLETE">Note Prematurely Signed</option>
                                <option value="TEST">Test/Demo Note</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Explanation / Audit Journal</label>
                            <textarea
                                value={data.reason_text}
                                onChange={(e) => setData({ ...data, reason_text: e.target.value })}
                                placeholder="Mandatory explanation for audit trail..."
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:bg-white transition-all h-28 resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!data.reason_text.trim()}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-100"
                        >
                            Void & Retract
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Cosignature Modal for Attending Physicians

const SignPromptModal = ({ isOpen, onClose, onConfirm, attendings, selectedAttendingId, setSelectedAttendingId, isResident, isSaving }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-100">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-amber-50 rounded-2xl">
                            <Lock className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 leading-tight">Electronic Signature</h2>
                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Workflow Routing Required</p>
                        </div>
                    </div>

                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 mb-6">
                        <p className="text-sm text-amber-800 leading-relaxed">
                            {isResident
                                ? "As a trainee, your note will be saved as Preliminary and requires clinical validation by an attending physician."
                                : "This clinical note will be saved as Preliminary and forwarded to an attending physician for review and cosignature."
                            }
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                Assign Attending Physician
                                <span className="text-amber-600">(Required)</span>
                            </label>
                            <select
                                value={selectedAttendingId}
                                onChange={(e) => setSelectedAttendingId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                            >
                                <option value="">Select an Attending...</option>
                                {attendings.map(a => (
                                    <option key={a.id} value={a.id}>
                                        Dr. {a.last_name}, {a.first_name} ({a.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!selectedAttendingId || isSaving}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all shadow-lg shadow-amber-100"
                        >
                            {isSaving ? 'Signing...' : 'Sign & Route'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
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
    const [isPreliminary, setIsPreliminary] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [visitData, setVisitData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [toast, setToast] = useState(null);
    const [isRetracted, setIsRetracted] = useState(false);
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [retractData, setRetractData] = useState({ reason_code: 'ERROR', reason_text: '' });
    const [viewRetractedContent, setViewRetractedContent] = useState(false);
    const [retractionInfo, setRetractionInfo] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderModalTab, setOrderModalTab] = useState('labs');
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [showCosignModal, setShowCosignModal] = useState(false);
    const [attestationText, setAttestationText] = useState('');
    const [authorshipModel, setAuthorshipModel] = useState('Addendum');
    const [isDirectEditing, setIsDirectEditing] = useState(false);
    const [editedSections, setEditedSections] = useState(new Set());
    const [attestationMacros, setAttestationMacros] = useState([]);

    const fetchMacros = useCallback(async () => {
        try {
            const response = await macrosAPI.getAll({ category: 'Attestation' });
            setAttestationMacros(response.data || []);
        } catch (error) {
            console.error('Failed to fetch attestation macros:', error);
        }
    }, []);

    useEffect(() => {
        if (showCosignModal) {
            fetchMacros();
        }
    }, [showCosignModal, fetchMacros]);

    const handleCreateMacro = async (macroData) => {
        try {
            await macrosAPI.create({
                ...macroData,
                category: 'Attestation'
            });
            await fetchMacros();
            showToast('Template saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to create macro:', error);
            showToast('Failed to save template: ' + (error.response?.data?.error || 'Unknown error'), 'error');
            return false;
        }
    };

    const handleDeleteMacro = async (macroId) => {
        try {
            await macrosAPI.delete(macroId);
            await fetchMacros();
            showToast('Template deleted');
            return true;
        } catch (error) {
            console.error('Failed to delete macro:', error);
            showToast('Failed to delete template', 'error');
            return false;
        }
    };
    const [showSignPrompt, setShowSignPrompt] = useState(false);
    const [attendings, setAttendings] = useState([]);
    const [selectedAttendingId, setSelectedAttendingId] = useState('');

    const [showOrderPicker, setShowOrderPicker] = useState(false);
    const [orderPickerType, setOrderPickerType] = useState(null);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
    const [showOrderDetails, setShowOrderDetails] = useState(false);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);

    const { hasPrivilege } = usePrivileges();
    const { user } = useAuth();

    // Authorization Logic
    const isAttending = useMemo(() => {
        if (!user) return false;
        const role = (user.role || '').toLowerCase();
        const roleName = (user.role_name || '').toLowerCase();
        const profType = (user.professional_type || '').toLowerCase();

        // Match the logic used for the "Cosign Note" button exactly
        return roleName === 'Physician' || role === 'physician' ||
            roleName === 'CLINICIAN' || role === 'clinician' ||
            roleName === 'Admin' || role === 'admin' ||
            profType.includes('md') || profType.includes('do');
    }, [user]);

    // Locked State: 
    // - Note is read-only if fully signed (final)
    // - Note is read-only if preliminary AND user is NOT an attending
    // - Note is read-only if retracted
    const isLocked = isSigned || (isPreliminary && !isAttending && !isDirectEditing) || isRetracted;
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showPrintOrdersModal, setShowPrintOrdersModal] = useState(false);
    const [showPatientChart, setShowPatientChart] = useState(false);
    const [patientChartTab, setPatientChartTab] = useState('history');
    const [patientData, setPatientData] = useState(null);
    const [editingDiagnosisIndex, setEditingDiagnosisIndex] = useState(null);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);

    // Chart Review Modal
    const [showChartReview, setShowChartReview] = useState(false);
    const [chartReviewData, setChartReviewData] = useState({ visits: [], loading: true });

    // Carry Forward Modal
    const [showCarryForward, setShowCarryForward] = useState(false);
    const [carryForwardField, setCarryForwardField] = useState(null); // 'hpi', 'ros', 'pe', 'assessment'
    const [previousVisits, setPreviousVisits] = useState([]);
    const [loadingPrevVisits, setLoadingPrevVisits] = useState(false);

    // Result Import Modal
    const [showResultImportModal, setShowResultImportModal] = useState(false);
    const [resultImportType, setResultImportType] = useState(null);

    // Diagnosis Link Modal (for Meds)
    const [showDiagnosisLinkModal, setShowDiagnosisLinkModal] = useState(false);
    const [pendingMedAction, setPendingMedAction] = useState(null);
    const [visitDocuments, setVisitDocuments] = useState([]);

    // Quick Actions Panel
    const [showQuickActions, setShowQuickActions] = useState(true);

    // Auto-save tracking
    const autoSaveTimeoutRef = useRef(null);
    const hasInitialSaveRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    // Patient History State (PAMFOS)
    const [familyHistory, setFamilyHistory] = useState([]);
    const [surgicalHistory, setSurgicalHistory] = useState([]);
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
        results: '',
        assessment: '',
        plan: '',
        planStructured: [], // Array of {diagnosis: string, orders: string[]}
        carePlan: '', // Free text Care Plan section
        followUp: '' // Follow Up section
    });

    const [visitType, setVisitType] = useState('Office Visit');

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
    const decodeHtmlEntities = (rawText) => {
        if (!rawText) return rawText;
        const text = typeof rawText === 'string' ? rawText : String(rawText);
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
            // console.log('parseNoteText: Empty or whitespace text');
            return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '', carePlan: '', followUp: '' };
        }
        const decodedText = decodeHtmlEntities(text);
        const safeDecodedText = typeof decodedText === 'string' ? decodedText : String(decodedText || '');

        // More flexible regex patterns that handle various formats (including end of string)
        const chiefComplaintMatch = safeDecodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const hpiMatch = safeDecodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const rosMatch = safeDecodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):|$)/is);
        const peMatch = safeDecodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Results|Data|Assessment|Plan):|$)/is);
        const resultsMatch = safeDecodedText.match(/(?:Results|Data):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):|$)/is);
        const assessmentMatch = safeDecodedText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);

        // Updated regexes to support new sections: CTS, ASCVD, Safety Plan
        // Plan can now stop at CTS, ASCVD, Safety, or Care Plan
        const planMatch = safeDecodedText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Caregiver Training|CTS|ASCVD Risk|Cardiovascular|Safety Plan|Behavioral Safety|Care Plan|CP|Follow Up|FU):|$)/is);

        const ctsMatch = safeDecodedText.match(/(?:Caregiver Training|CTS):\s*(.+?)(?:\n\n|\n(?:ASCVD Risk|Cardiovascular|Safety Plan|Behavioral Safety|Care Plan|CP|Follow Up|FU):|$)/is);
        const ascvdMatch = safeDecodedText.match(/(?:ASCVD Risk|Cardiovascular):\s*(.+?)(?:\n\n|\n(?:Safety Plan|Behavioral Safety|Care Plan|CP|Follow Up|FU):|$)/is);
        const safetyPlanMatch = safeDecodedText.match(/(?:Safety Plan|Behavioral Safety):\s*(.+?)(?:\n\n|\n(?:Care Plan|CP|Follow Up|FU):|$)/is);

        const carePlanMatch = safeDecodedText.match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|\n(?:Follow Up|FU):|$)/is);
        const followUpMatch = safeDecodedText.match(/(?:Follow Up|FU):\s*(.+?)(?:\n\n|$)/is);

        const result = {
            chiefComplaint: chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '',
            hpi: hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '',
            rosNotes: rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '',
            peNotes: peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '',
            results: resultsMatch ? decodeHtmlEntities(resultsMatch[1].trim()) : '',
            assessment: assessmentMatch ? decodeHtmlEntities(assessmentMatch[1].trim()) : '',
            plan: planMatch ? decodeHtmlEntities(planMatch[1].trim()) : '',
            cts: ctsMatch ? decodeHtmlEntities(ctsMatch[1].trim()) : '',
            ascvd: ascvdMatch ? decodeHtmlEntities(ascvdMatch[1].trim()) : '',
            safetyPlan: safetyPlanMatch ? decodeHtmlEntities(safetyPlanMatch[1].trim()) : '',
            carePlan: carePlanMatch ? decodeHtmlEntities(carePlanMatch[1].trim()) : '',
            followUp: followUpMatch ? decodeHtmlEntities(followUpMatch[1].trim()) : ''
        };

        /*
        console.log('parseNoteText: Parsed result lengths:', {
            cc: result.chiefComplaint.length,
            hpi: result.hpi.length,
            ros: result.rosNotes.length,
            pe: result.peNotes.length,
            assessment: result.assessment.length,
            plan: result.plan.length
        });
        */

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
            const safeLine = typeof line === 'string' ? line : String(line || '');
            const diagnosisMatch = safeLine.match(/^(\d+)\.\s*(.+)$/);
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

        if (noteData.results) {
            sections.push(`Results: ${noteData.results}`);
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

        // New Phase 7 Sections
        if (noteData.cts) sections.push(`Caregiver Training: ${noteData.cts}`);
        if (noteData.ascvd) sections.push(`ASCVD Risk: ${noteData.ascvd}`);
        if (noteData.safetyPlan) sections.push(`Safety Plan: ${noteData.safetyPlan}`);

        if (noteData.carePlan) sections.push(`Care Plan: ${noteData.carePlan}`);
        if (noteData.followUp) sections.push(`Follow Up: ${noteData.followUp}`);

        const combined = sections.join('\n\n');
        console.log('Combined note sections length:', combined.length);
        return combined;
    };

    // Find or create visit on mount
    useEffect(() => {
        let cleanup = null;

        // Always fetch patient data if we have a patient ID
        if (id) {
            // Fetch Patient Snapshot (Demographics, Problems, Meds, Allergies)
            patientsAPI.getSnapshot(id)
                .then(async response => {
                    const data = response.data;
                    if (data && (!data.medications || data.medications.length === 0)) {
                        try {
                            const medsRes = await patientsAPI.getMedications(id);
                            data.medications = medsRes.data || [];
                        } catch (e) {
                            console.warn('Medication fallback failed:', e);
                        }
                    }
                    setPatientData(data);
                })
                .catch(error => console.error('Error fetching patient snapshot:', error));

            // Fetch Family History
            patientsAPI.getFamilyHistory(id)
                .then(response => setFamilyHistory(response.data || []))
                .catch(error => console.error('Error fetching family history:', error));

            // Fetch Surgical History
            patientsAPI.getSurgicalHistory(id)
                .then(response => setSurgicalHistory(response.data || []))
                .catch(error => console.error('Error fetching surgical history:', error));

            // Fetch Social History
            const fetchSocialHistory = () => {
                patientsAPI.getSocialHistory(id)
                    .then(response => setSocialHistory(response.data || {}))
                    .catch(error => console.error('Error fetching social history:', error));
            };
            fetchSocialHistory();

            // Listen for patient data updates
            const handlePatientDataUpdate = () => {
                fetchSocialHistory();

                // Refresh Family History
                patientsAPI.getFamilyHistory(id)
                    .then(response => setFamilyHistory(response.data || []))
                    .catch(error => console.error('Error refreshing family history:', error));

                // Refresh Surgical History
                patientsAPI.getSurgicalHistory(id)
                    .then(response => setSurgicalHistory(response.data || []))
                    .catch(error => console.error('Error refreshing surgical history:', error));

                // Also refresh snapshot data as it might have changed
                patientsAPI.getSnapshot(id)
                    .then(async response => {
                        const data = response.data;
                        if (data && (!data.medications || data.medications.length === 0)) {
                            try {
                                const medsRes = await patientsAPI.getMedications(id);
                                data.medications = medsRes.data || [];
                            } catch (e) { }
                        }
                        setPatientData(data);
                    })
                    .catch(error => console.error('Error fetching patient snapshot:', error));
            };

            window.addEventListener('patient-data-updated', handlePatientDataUpdate);
            return () => {
                window.removeEventListener('patient-data-updated', handlePatientDataUpdate);
            };
        }
    }, [id]);

    // Load documents linked to this visit
    useEffect(() => {
        if (id && currentVisitId) {
            documentsAPI.getByPatient(id).then(res => {
                const docs = res.data || [];
                const linked = docs.filter(d => d.visit_id === currentVisitId);
                setVisitDocuments(linked);
            }).catch(e => console.error('Error loading visit docs', e));
        }
    }, [id, currentVisitId]);

    // Load/Create Visit Effect
    useEffect(() => {
        let cleanup = null;
        if (urlVisitId === 'new' && id) {
            console.log('Creating new visit for patient:', id);
            setLoading(true);
            visitsAPI.openToday(id, visitType === 'Office Visit' ? 'office_visit' : visitType.toLowerCase().replace(' ', '_'))
                .then(response => {
                    // New API returns { note: {...} }
                    const visit = response.data?.note || response.data;
                    console.log('Created visit:', visit);
                    if (!visit || !visit.id) {
                        throw new Error('Invalid visit response');
                    }
                    setCurrentVisitId(visit.id);
                    setVisitData(visit);
                    // Check status field explicitly
                    const isFinal = (visit.status || '').toLowerCase() === 'signed';
                    const isPrelim = (visit.status || '').toLowerCase() === 'preliminary';

                    setIsSigned(isFinal);
                    setIsPreliminary(isPrelim);
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
                    setVisitType(visit.visit_type || 'Office Visit');
                    const isFinal = (visit.status || '').toLowerCase().trim() === 'signed';
                    const isPrelim = (visit.status || '').toLowerCase().trim() === 'preliminary';

                    setIsSigned(isFinal);
                    setIsPreliminary(isPrelim);
                    setIsRetracted((visit.status || '').toLowerCase().trim() === 'retracted');

                    if ((visit.status || '').toLowerCase().trim() === 'retracted') {
                        // Fetch retraction details if possible
                        visitsAPI.getRetraction(urlVisitId)
                            .then(res => setRetractionInfo(res.data))
                            .catch(e => console.warn('Retraction details not found'));
                    }

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
                    if (visit.note_draft) {
                        const noteDraftText = typeof visit.note_draft === 'string' ? visit.note_draft : (typeof visit.note_draft === 'object' ? JSON.stringify(visit.note_draft) : String(visit.note_draft));
                        console.log('Loading note_draft, length:', noteDraftText.length);
                        console.log('Note_draft preview:', noteDraftText.substring(0, 200));
                        const parsed = parseNoteText(noteDraftText);
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
                            planStructured: planStructured.length > 0 ? planStructured : (prev.planStructured || []),
                            carePlan: parsed.carePlan || prev.carePlan || '',
                            followUp: parsed.followUp || prev.followUp || ''
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
            // No visit ID in URL - this shouldn't happen normally, but ensure we don't stay in loading state
            setLoading(false);
            setVisitData({});
        }

        // Return cleanup function if it was set
        return cleanup || (() => { });
    }, [urlVisitId, id, navigate, refreshTrigger]);

    // Fetch Attendings for signing workflow
    useEffect(() => {
        const fetchDirectory = async () => {
            try {
                const response = await usersAPI.getDirectory();
                const data = response.data;
                // Filter for attendings (Physicians only as requested: MD, DO, Physician)
                const filtered = data.filter(u => {
                    const profType = (u.professional_type || '').toLowerCase();
                    const role = (u.role || '').toLowerCase();

                    return profType.includes('physician') ||
                        profType.includes('md') ||
                        profType.includes('do') ||
                        profType.includes('medical doctor') ||
                        role.includes('physician'); // Fallback for legacy
                });
                setAttendings(filtered);
            } catch (err) {
                console.error('Error fetching attendings:', err);
            }
        };
        fetchDirectory();
    }, []);

    // Handle Break-the-Glass authorization
    useEffect(() => {
        const handlePrivacyAuthorized = (event) => {
            if (event.detail?.patientId === id) {
                console.log('Privacy authorized for patient, refreshing visit...', id);
                setRefreshTrigger(prev => prev + 1);
            }
        };

        window.addEventListener('privacy:authorized', handlePrivacyAuthorized);
        return () => window.removeEventListener('privacy:authorized', handlePrivacyAuthorized);
    }, [id]);

    // Local Storage Backup Logic
    useEffect(() => {
        if (!id || !currentVisitId || currentVisitId === 'new' || loading || isSigned) return;

        const backupKey = `paper_emr_backup_${id}_${currentVisitId}`;
        const timeout = setTimeout(() => {
            const backupData = {
                noteData,
                vitals,
                timestamp: Date.now()
            };
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            // console.log('Saved local backup');
        }, 1000); // 1-second debounce for local backup

        return () => clearTimeout(timeout);
    }, [noteData, vitals, id, currentVisitId, loading, isSigned]);

    // Check for backup on load (modified part of loading effect is tricky via multi-replace, so we do it separately or handle it here if possible)
    // Actually, checking on load needs to be inside the existing useEffect or a new one that runs once currentVisitId is set and we have server data.
    // Let's add a separate effect that checks for restoration once we have visitData
    useEffect(() => {
        if (!loading && visitData && currentVisitId && currentVisitId !== 'new' && !isSigned) {
            const backupKey = `paper_emr_backup_${id}_${currentVisitId}`;
            const saved = localStorage.getItem(backupKey);
            if (saved) {
                try {
                    const localBackup = JSON.parse(saved);
                    const serverTime = new Date(visitData.updated_at || 0).getTime();
                    const localTime = localBackup.timestamp || 0;

                    // If local backup is newer than server data (by at least 2 seconds to avoid clock skew issues), or if server data is basically empty
                    const isNewer = localTime > serverTime + 2000;

                    // Simple check on note content length to see if server is "empty"
                    const serverNoteLength = (visitData.note_draft || '').length;
                    const localNoteLength = (localBackup.noteData?.plan || '').length + (localBackup.noteData?.assessment || '').length;

                    if (isNewer || (serverNoteLength < 10 && localNoteLength > 20)) {
                        console.log('Restoring from local backup', localBackup);
                        setNoteData(localBackup.noteData);
                        if (localBackup.vitals) {
                            setVitals(localBackup.vitals);
                        }
                        // showToast('Restored unsaved work from local backup', 'info');
                    }
                } catch (e) {
                    console.error('Error parsing local backup', e);
                }
            }
        }
    }, [loading, visitData, currentVisitId, id, isSigned]);

    // Auto-save function (can be called with or without user action)
    const autoSave = useCallback(async (showToastMessage = false) => {
        if (isSigned || isRetracted || isSaving || isAutoSavingRef.current) return;
        if (!id) return; // Need patient ID

        isAutoSavingRef.current = true;

        try {
            const noteDraft = combineNoteSections();
            let visitId = currentVisitId || urlVisitId;

            // Create visit if it doesn't exist
            if (!visitId || visitId === 'new') {
                try {
                    const response = await visitsAPI.openToday(id, visitType === 'Office Visit' ? 'office_visit' : visitType.toLowerCase().replace(' ', '_'));
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
                await visitsAPI.update(visitId, { noteDraft: noteDraft || '', vitals: vitalsToSave, visit_type: visitType });

                const reloadResponse = await visitsAPI.get(visitId);
                setVisitData(reloadResponse.data);

                // Reload parsed data to ensure text sections are synced, but preserve planStructured
                if (reloadResponse.data.note_draft) {
                    const parsed = parseNoteText(reloadResponse.data.note_draft);
                    setNoteData(prev => ({
                        ...prev,
                        plan: parsed.plan || prev.plan,
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
    }, [id, currentVisitId, urlVisitId, isSigned, isSaving, noteData, vitals, visitType, combineNoteSections, parseNoteText, parsePlanText, showToast]);

    const handleCreateSuperbill = async () => {
        if (!currentVisitId || currentVisitId === 'new') {
            showToast('Please save the visit first', 'error');
            return;
        }
        // Ported OpenEMR Fee Sheet uses visitId directly
        navigate(`/patient/${id}/fee-sheet/${currentVisitId}`);
    };

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
    }, [noteData, vitals, visitType, scheduleAutoSave, isSigned, loading]);

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

        // Workflow check for preliminary notes
        const role = (user?.role_name || user?.role || '').toUpperCase();
        const needsCosign = role.match(/RESIDENT|NP|PA|PRACTITIONER|ASSISTANT/);

        if (needsCosign && !selectedAttendingId) {
            setShowSignPrompt(true);
            return;
        }

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
                    const response = await visitsAPI.openToday(id, visitType === 'Office Visit' ? 'office_visit' : visitType.toLowerCase().replace(' ', '_'));
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
                const signRes = await visitsAPI.sign(visitId, noteDraft, vitalsToSave, selectedAttendingId);

                setShowSignPrompt(false);
                if (signRes.data?.status === 'preliminary') {
                    showToast('Note submitted for cosignature (Preliminary)', 'success');
                } else {
                    showToast('Note signed successfully', 'success');
                }

                // Sync assessments to problem list
                try {
                    if (diagnoses && diagnoses.length > 0) {
                        console.log('Syncing diagnoses to problem list:', diagnoses);

                        // Get current active problems to check for duplicates
                        // We use the latest patientData or fetch if needed, but patientData should be reasonably fresh
                        // For safety, let's look at patientData?.problems
                        const currentProblems = patientData?.problems || [];

                        let problemsAdded = 0;
                        for (const diag of diagnoses) {
                            // Parse "Code - Description" or just Description
                            // match: ["Code - Description", "Code", "Description"]
                            const cleanDiag = (typeof diag === 'string' ? diag : String(diag || ''))
                                .replace(/^\d+(\.\d+)*\.?\s*/, '')
                                .trim();

                            if (!cleanDiag) continue;

                            const match = cleanDiag.match(/^([A-Z][0-9.]+)\s*-\s*(.+)$/);
                            let icd10Code = null;
                            let problemName = cleanDiag;

                            if (match) {
                                icd10Code = match[1];
                                problemName = match[2];
                            }

                            // Check duplicate by code or name
                            const exists = currentProblems.some(p =>
                                (icd10Code && p.icd10_code === icd10Code) ||
                                (p.problem_name && p.problem_name.toLowerCase() === problemName.toLowerCase())
                            );

                            if (!exists) {
                                await patientsAPI.addProblem(id, {
                                    problemName,
                                    icd10Code,
                                    onsetDate: new Date().toISOString(),
                                    status: 'active'
                                });
                                problemsAdded++;
                            }
                        }
                        if (problemsAdded > 0) {
                            window.dispatchEvent(new Event('patient-data-updated'));
                            showToast(`Synced ${problemsAdded} problem(s) to chart`, 'success');
                        }
                    }
                } catch (err) {
                    console.error('Error syncing problems:', err);
                    // Don't fail the sign process for this
                }

                showToast('Note signed successfully', 'success');
                // Clear local backup on sign
                if (id && visitId) {
                    localStorage.removeItem(`paper_emr_backup_${id}_${visitId}`);
                }

                // Reload visit data to get signed status
                const response = await visitsAPI.get(visitId);
                const visit = response.data;
                setVisitData(visit);
                setIsSigned((visit.status || '').toLowerCase().trim() === 'signed' || visit.locked || !!visit.note_signed_by);
                setIsPreliminary((visit.status || '').toLowerCase().trim() === 'preliminary');
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

    const handleCosign = async (attestationText, authorshipModel = 'Addendum') => {
        // If transitioning from Modal to Direct Edit Mode
        if (authorshipModel === 'Direct Edit' && !isDirectEditing) {
            setIsDirectEditing(true);
            setShowCosignModal(false);
            showToast('Direct edit mode enabled. You can now modify the trainee\'s note.', 'info');
            return;
        }

        if (isSaving) return;
        setIsSaving(true);
        try {
            const visitId = currentVisitId || urlVisitId;
            // Use 'Direct Edit' if we are in that mode
            const finalAuthorshipModel = isDirectEditing ? 'Direct Edit' : authorshipModel;
            // For Direct Edit, we might not need an attestation text, or we can use a default one
            const finalAttestationText = isDirectEditing ? (attestationText || 'Note reviewed and edited directly.') : attestationText;

            await visitsAPI.cosign(visitId, {
                attestationText: finalAttestationText,
                authorshipModel: finalAuthorshipModel
            });
            showToast('Note cosigned successfully', 'success');

            // Reload visit data
            const response = await visitsAPI.get(visitId);
            const visit = response.data;
            setVisitData(visit);
            setIsSigned(true);
            setIsPreliminary(false);
            setIsDirectEditing(false);
            setShowCosignModal(false);
        } catch (error) {
            showToast('Failed to cosign note: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
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
        setNoteData(prev => ({ ...prev, [field]: decoded }));
        if (isDirectEditing) {
            setEditedSections(prev => {
                const next = new Set(prev);
                next.add(field);
                return next;
            });
        }
    };

    // ICD-10 search - show top codes when empty, search when 2+ characters
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                const query = icd10Search.trim();
                const response = await icd10API.search(query);
                setIcd10Results(response.data || []);
                if (response.data && response.data.length > 0 && query.length > 0) {
                    setShowIcd10Search(true);
                }
            } catch (error) {
                setIcd10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    // Load initial codes on mount
    useEffect(() => {
        const loadInitialCodes = async () => {
            try {
                const response = await icd10API.search('');
                if (response.data && response.data.length > 0) {
                    setIcd10Results(response.data);
                }
            } catch (error) {
                console.error('Error loading ICD-10 codes:', error);
            }
        };
        loadInitialCodes();
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

        if (editingDiagnosisIndex !== null) {
            // Replace existing diagnosis
            setNoteData(prev => {
                const lines = prev.assessment.split('\n').filter(l => l.trim());
                const oldName = lines[editingDiagnosisIndex];
                const newName = `${code.code} - ${code.description}`;
                lines[editingDiagnosisIndex] = newName;

                // Sync Plan Structured
                let updatedPlanStructured = prev.planStructured || [];
                if (oldName && updatedPlanStructured.length > 0) {
                    const matchIndex = updatedPlanStructured.findIndex(item =>
                        item.diagnosis === oldName || item.diagnosis.includes(oldName) || oldName.includes(item.diagnosis)
                    );
                    if (matchIndex !== -1) {
                        updatedPlanStructured = [...updatedPlanStructured];
                        updatedPlanStructured[matchIndex] = {
                            ...updatedPlanStructured[matchIndex],
                            diagnosis: newName
                        };
                    }
                }

                // Regenerate plan text from structured data
                const updatedPlanText = updatedPlanStructured.length > 0 && typeof formatPlanText === 'function'
                    ? formatPlanText(updatedPlanStructured)
                    : prev.plan;

                return {
                    ...prev,
                    assessment: lines.join('\n'),
                    planStructured: updatedPlanStructured,
                    plan: updatedPlanText
                };
            });
            setEditingDiagnosisIndex(null);
        } else {
            // Add new diagnosis
            const newDx = `${code.code} - ${code.description}`;
            const newAssessment = noteData.assessment
                ? `${noteData.assessment}\n${newDx}`
                : newDx;

            setNoteData(prev => ({
                ...prev,
                assessment: newAssessment,
                planStructured: [...(prev.planStructured || []), { diagnosis: newDx, orders: [] }]
            }));
        }

        setShowIcd10Search(false);
        setIcd10Search('');
        setShowICD10Modal(false);
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

    const handleUpdatePlan = (updatedPlanStructured) => {
        setNoteData(prev => {
            const formattedPlan = formatPlanText(updatedPlanStructured);

            // Extract all unique diagnoses from the updated plan
            const planDiagnoses = updatedPlanStructured
                .map(item => item.diagnosis)
                .filter(d => d && d !== 'Unassigned');

            // Current assessments
            let currentAssessment = prev.assessment || '';
            const existingDxLines = currentAssessment.split('\n').map(l => l.trim()).filter(Boolean);
            const existingDxClean = existingDxLines.map(l => l.replace(/^\d+\.\s*/, '').trim().toLowerCase());

            let assessmentUpdated = false;
            let newAssessment = currentAssessment;

            planDiagnoses.forEach(dx => {
                const cleanDx = dx.replace(/^\d+\.\s*/, '').trim();
                if (!existingDxClean.includes(cleanDx.toLowerCase())) {
                    // Add missing diagnosis to assessment
                    const nextNum = existingDxLines.length + 1;
                    if (newAssessment && !newAssessment.endsWith('\n')) newAssessment += '\n';
                    newAssessment += `${nextNum}. ${cleanDx}`;
                    existingDxLines.push(`${nextNum}. ${cleanDx}`);
                    existingDxClean.push(cleanDx.toLowerCase());
                    assessmentUpdated = true;
                }
            });

            return {
                ...prev,
                planStructured: updatedPlanStructured,
                plan: formattedPlan,
                assessment: assessmentUpdated ? newAssessment : prev.assessment
            };
        });
    };

    const handleOrderSelect = async (order) => {
        const diagnosisToUse = selectedDiagnosis || diagnoses[0] || 'Unassigned';

        let prefix = '';
        if (order.type === 'LAB') prefix = 'Lab: ';
        else if (order.type === 'IMAGING') prefix = 'Imaging: ';
        else if (order.type === 'PROCEDURE') prefix = 'Procedure: ';

        const orderText = `${prefix}${order.name}${order.loinc_code ? ` [${order.loinc_code}]` : ''}`;

        // 1. Persist to backend visit_orders table
        try {
            await ordersCatalogAPI.createVisitOrder(currentVisitId || urlVisitId, {
                catalog_id: order.id,
                patient_id: id,
                diagnosis_icd10_ids: [diagnosisToUse],
                priority: 'ROUTINE'
            });
        } catch (err) {
            console.error('Failed to create visit order record', err);
        }

        // 2. Update frontend note data
        setNoteData(prev => {
            const currentPlan = prev.planStructured || [];
            const diagnosisToUseClean = diagnosisToUse.replace(/^\d+\.\s*/, '').trim();
            const dxIndex = currentPlan.findIndex(p => p.diagnosis === diagnosisToUse || p.diagnosis === diagnosisToUseClean);

            let updatedPlan;
            if (dxIndex >= 0) {
                updatedPlan = [...currentPlan];
                updatedPlan[dxIndex] = {
                    ...updatedPlan[dxIndex],
                    orders: [...updatedPlan[dxIndex].orders, orderText]
                };
            } else {
                updatedPlan = [...currentPlan, { diagnosis: diagnosisToUseClean, orders: [orderText] }];
            }

            // Sync with Assessment
            let currentAssessment = prev.assessment || '';
            const existingDxLines = currentAssessment.split('\n').map(l => l.trim()).filter(Boolean);
            const existingDxClean = existingDxLines.map(l => l.replace(/^\d+\.\s*/, '').trim().toLowerCase());

            let assessmentUpdated = false;
            let newAssessment = currentAssessment;

            if (diagnosisToUseClean !== 'Unassigned' && !existingDxClean.includes(diagnosisToUseClean.toLowerCase())) {
                const nextNum = existingDxLines.length + 1;
                if (newAssessment && !newAssessment.endsWith('\n')) newAssessment += '\n';
                newAssessment += `${nextNum}. ${diagnosisToUseClean}`;
                assessmentUpdated = true;
            }

            const formattedPlan = formatPlanText(updatedPlan);
            return {
                ...prev,
                planStructured: updatedPlan,
                plan: formattedPlan,
                assessment: assessmentUpdated ? newAssessment : prev.assessment
            };
        });

        setShowOrderPicker(false);
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
            const deletedDiagnosis = lines[index]; // Get the diagnosis being deleted
            lines.splice(index, 1);

            // Update planStructured - if any orders are associated with the deleted diagnosis, move them to "Other"
            let updatedPlanStructured = prev.planStructured || [];
            if (deletedDiagnosis && updatedPlanStructured.length > 0) {
                // Find if there's an entry in planStructured that matches the deleted diagnosis
                const matchingPlanIndex = updatedPlanStructured.findIndex(item =>
                    item.diagnosis && deletedDiagnosis.includes(item.diagnosis)
                );

                if (matchingPlanIndex !== -1) {
                    // Get the orders from the deleted diagnosis
                    const ordersToMove = updatedPlanStructured[matchingPlanIndex].orders;

                    // Remove the deleted diagnosis entry
                    updatedPlanStructured = updatedPlanStructured.filter((_, idx) => idx !== matchingPlanIndex);

                    // If there are orders, move them to "Other" diagnosis
                    if (ordersToMove && ordersToMove.length > 0) {
                        const otherIndex = updatedPlanStructured.findIndex(item => item.diagnosis === 'Other');
                        if (otherIndex !== -1) {
                            // Append to existing "Other" diagnosis
                            updatedPlanStructured[otherIndex].orders = [
                                ...updatedPlanStructured[otherIndex].orders,
                                ...ordersToMove
                            ];
                        } else {
                            // Create new "Other" diagnosis entry
                            updatedPlanStructured.push({
                                diagnosis: 'Other',
                                orders: ordersToMove
                            });
                        }
                    }
                }
            }

            // Update plan text from structured data
            const updatedPlanText = updatedPlanStructured.length > 0
                ? formatPlanText(updatedPlanStructured)
                : prev.plan;

            return {
                ...prev,
                assessment: lines.join('\n'),
                planStructured: updatedPlanStructured,
                plan: updatedPlanText
            };
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

    // Open Carry Forward Modal - fetches previous visits for pulling data
    const openCarryForward = async (field) => {
        setCarryForwardField(field);
        setShowCarryForward(true);
        setLoadingPrevVisits(true);
        try {
            const res = await visitsAPI.getByPatient(id);
            const visits = (res.data || [])
                .filter(v => v.id !== currentVisitId && v.note_draft)
                .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                .slice(0, 10);
            setPreviousVisits(visits);
        } catch (e) {
            console.error('Error fetching previous visits:', e);
            setPreviousVisits([]);
        } finally {
            setLoadingPrevVisits(false);
        }
    };

    // Extract section from note text
    const extractSectionFromNote = (noteText, section) => {
        if (!noteText) return '';
        const decoded = decodeHtmlEntities(noteText);
        const safeDecoded = typeof decoded === 'string' ? decoded : String(decoded || '');
        let match;
        switch (section) {
            case 'hpi':
                match = safeDecoded.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                break;
            case 'ros':
                match = safeDecoded.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):|$)/is);
                break;
            case 'pe':
                match = safeDecoded.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):|$)/is);
                break;
            case 'assessment':
                match = safeDecoded.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):|$)/is);
                break;
            default:
                return '';
        }
        return match ? match[1].trim() : '';
    };

    // Insert carried forward content
    const insertCarryForward = (content) => {
        if (!carryForwardField || !content) return;

        if (carryForwardField === 'hpi') {
            setNoteData(prev => ({ ...prev, hpi: content }));
        } else if (carryForwardField === 'ros') {
            setNoteData(prev => ({ ...prev, rosNotes: content }));
        } else if (carryForwardField === 'pe') {
            setNoteData(prev => ({ ...prev, peNotes: content }));
        } else if (carryForwardField === 'assessment') {
            setNoteData(prev => ({ ...prev, assessment: content }));
        }

        setShowCarryForward(false);
        showToast(`${carryForwardField.toUpperCase()} pulled from previous visit`, 'success');
    };

    // Add problem directly to assessment (with ICD-10 code if available)
    const addProblemToAssessment = (problem) => {
        const diagText = problem.icd10_code
            ? `${problem.problem_name} (${problem.icd10_code})`
            : problem.problem_name;

        // Check if already in assessment
        if (diagnoses.some(d => d.toLowerCase().includes(problem.problem_name.toLowerCase()))) {
            showToast('Already in assessment', 'info');
            return;
        }

        const newAssessment = noteData.assessment
            ? `${noteData.assessment}\n${diagnoses.length + 1}. ${diagText}`
            : `1. ${diagText}`;
        setNoteData(prev => ({ ...prev, assessment: newAssessment }));

        // Also add to planStructured
        setNoteData(prev => ({
            ...prev,
            planStructured: [...(prev.planStructured || []), { diagnosis: diagText, orders: [] }]
        }));

        showToast(`Added: ${problem.problem_name}`, 'success');
    };

    // Add medication action to plan
    // Updated: Trigger Diagnosis Link Modal instead of direct add
    const addMedicationToPlan = (med, action) => {
        setPendingMedAction({ med, action });
        setShowDiagnosisLinkModal(true);
    };

    // Callback when diagnosis is selected for the medication
    const handleMedicationDiagnosisSelect = (diagnosisText) => {
        if (!pendingMedAction) return;

        const { med, action } = pendingMedAction;
        const actionText = action === 'continue'
            ? `Continue ${med.medication_name} ${med.dosage || ''} ${med.frequency || ''}`
            : action === 'refill'
                ? `Refill ${med.medication_name} ${med.dosage || ''} - 90 day supply`
                : `Discontinue ${med.medication_name}`;

        // Strip leading numbers "1. "
        const cleanDiagnosis = diagnosisText.replace(/^\d+\.\s*/, '').trim();

        // 1. Ensure diagnosis exists in assessment/planStructured
        let targetIndex = -1;

        // Check if diagnosis is already in our structured plan
        if (noteData.planStructured) {
            targetIndex = noteData.planStructured.findIndex(item => item.diagnosis === cleanDiagnosis || item.diagnosis === diagnosisText);
        }

        // If not found, adding it to assessment and structured plan
        if (targetIndex === -1) {
            const currentDiagnoses = noteData.assessment ? noteData.assessment.split('\n').filter(l => l.trim()) : [];
            const alreadyInAssessment = currentDiagnoses.some(d => d.replace(/^\d+\.\s*/, '').trim().toLowerCase() === cleanDiagnosis.toLowerCase())
                || (noteData.assessment && noteData.assessment.toLowerCase().includes(cleanDiagnosis.toLowerCase()));

            let newAssessment = noteData.assessment;
            if (!alreadyInAssessment) {
                newAssessment = noteData.assessment
                    ? `${noteData.assessment}\n${(currentDiagnoses.length || 0) + 1}. ${cleanDiagnosis}`
                    : `1. ${cleanDiagnosis}`;
            }

            // Add new structured entry
            const newEntry = { diagnosis: cleanDiagnosis, orders: [actionText] };

            setNoteData(prev => {
                const updatedPlan = [...(prev.planStructured || []), newEntry];
                const newPlanText = formatPlanText(updatedPlan);
                return {
                    ...prev,
                    assessment: newAssessment,
                    planStructured: updatedPlan,
                    plan: newPlanText
                };
            });

            setSelectedDiagnosis(cleanDiagnosis);
            setOrderModalTab('meds');
            setShowOrderModal(true);

        } else {
            // Diagnosis already exists. Use immutable update.
            setNoteData(prev => {
                const currentPlan = prev.planStructured || [];
                const updatedPlan = currentPlan.map((item, idx) => {
                    if (idx === targetIndex) {
                        return {
                            ...item,
                            orders: [...item.orders, actionText]
                        };
                    }
                    return item;
                });

                const newPlanText = formatPlanText(updatedPlan);
                return {
                    ...prev,
                    planStructured: updatedPlan,
                    plan: newPlanText
                };
            });

            setSelectedDiagnosis(cleanDiagnosis);
            setOrderModalTab('meds');
            setShowOrderModal(true);
        }

        setShowDiagnosisLinkModal(false);
        setPendingMedAction(null);
    };

    // Insert HPI template
    const insertHpiTemplate = (templateKey, templateText) => {
        const newHpi = noteData.hpi ? `${noteData.hpi}\n\n${templateText}` : templateText;
        setNoteData(prev => ({ ...prev, hpi: newHpi }));
        showToast(`Inserted: ${templateKey}`, 'success');
    };

    // Common HPI templates
    const hpiTemplates = [
        { key: 'Chest Pain', text: 'Patient presents with chest pain. Location: substernal. Quality: pressure. Severity: [X]/10. Onset: [TIME]. Duration: [DURATION]. Radiation: [LOCATION]. Associated symptoms: [SYMPTOMS]. Aggravating factors: [FACTORS]. Relieving factors: [FACTORS].' },
        { key: 'Shortness of Breath', text: 'Patient presents with shortness of breath. Onset: [TIME]. Duration: [DURATION]. Severity: at rest / with exertion. Associated symptoms: orthopnea, PND, leg swelling. Number of pillows: [#]. Walking distance: [DISTANCE].' },
        { key: 'Hypertension F/U', text: 'Patient here for hypertension follow-up. Blood pressure at home: [BP READINGS]. Medication compliance: good/fair/poor. Side effects: none/[SYMPTOMS]. Salt intake: [LOW/MODERATE/HIGH]. Exercise: [FREQUENCY].' },
        { key: 'Diabetes F/U', text: 'Patient here for diabetes management. Home glucose readings: fasting [#], post-prandial [#]. A1C target: <7%. Hypoglycemic episodes: none/[FREQUENCY]. Diet compliance: good/fair/poor. Foot exam: normal/abnormal.' },
        { key: 'Heart Failure', text: 'Patient with history of heart failure, EF [#]%. Current symptoms: NYHA Class [I/II/III/IV]. Weight today: [#] lbs. Dry weight: [#] lbs. Leg swelling: none/trace/1+/2+/3+. Medication compliance: good.' },
        { key: 'Palpitations', text: 'Patient presents with palpitations. Onset: [TIME]. Frequency: [FREQUENCY]. Duration of episodes: [DURATION]. Associated symptoms: dizziness, syncope, chest pain, SOB. Triggers: caffeine, stress, exercise, none.' },
    ];

    // Insert result into plan
    // Updated to insert into Results section with billing disclaimer
    // Updated to insert into Results section
    const handleResultImport = async (content, dateStr, item) => {
        // Link document to this visit if it's an imported document
        if (item && item.type === 'document' && currentVisitId) {
            try {
                const docId = (item.id || '').replace('doc-', '');
                await documentsAPIUpdate.update(docId, { visit_id: currentVisitId });
                // Update local state to show it immediately
                setVisitDocuments(prev => {
                    if (prev.find(d => d.id === docId)) return prev;
                    if (item.source) return [...prev, item.source];
                    return prev;
                });
            } catch (e) {
                console.error('Failed to link document to visit:', e);
            }
        }

        const isNotAvailable = content === 'Not available in records';
        const timestamp = dateStr || format(new Date(), 'MM/dd/yyyy');

        let entry;
        if (isNotAvailable) {
            entry = `${resultImportType}: Not available in current records.`;
        } else {
            // Enrich content with interpretation if available
            let richContent = content;
            if (item) {
                const details = [];
                const source = item.source || item;

                // Check common fields for interpretation/results
                const extraInfo = source.impression || source.interpretation || source.result || source.summary || source.result_value;

                // If extraInfo exists and is substantial and not already in content
                if (extraInfo && typeof extraInfo === 'string' && extraInfo.length > 0 && !content.includes(extraInfo)) {
                    details.push(`Interpretation: ${extraInfo}`);
                }

                // Check comments for documents (often used for interpretation notes)
                if (source.comments && Array.isArray(source.comments) && source.comments.length > 0) {
                    const commentsText = source.comments.map(c => `${c.userName}: ${c.comment}`).join('; ');
                    if (commentsText) details.push(`Notes: ${commentsText}`);
                } else if (source.comment) {
                    details.push(`Note: ${source.comment}`);
                }

                if (details.length > 0) {
                    richContent += `\n   ${details.join('\n   ')}`;
                }
            }
            entry = `${resultImportType} (${timestamp}): ${richContent}`;
        }

        setNoteData(prev => ({
            ...prev,
            results: prev.results ? `${prev.results}\n${entry}` : entry
        }));
        showToast(`${resultImportType} imported`, 'success');
        setResultImportType(null);
    };

    const openResultImport = (type) => {
        setResultImportType(type);
        setShowResultImportModal(true);
    };

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
            <div className="w-full max-w-[98%] mx-auto px-4">
                {/* Master Back Button */}
                <div className="mb-4">
                    <button onClick={() => navigate(`/patient/${id}/snapshot`)} className="flex items-center space-x-2 text-gray-600 hover:text-primary-900 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back to Patient Chart</span>
                    </button>
                </div>

                {isDirectEditing && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                                <Sparkles className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight">Direct Editing Mode</h3>
                                <p className="text-xs text-blue-700 font-medium">You are currently modifying the trainee's primary documentation. Your changes will be saved directly to the note.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsDirectEditing(false)}
                                className="px-3 py-1.5 text-blue-600 hover:bg-blue-100 rounded-md text-xs font-bold transition-colors uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleCosign(attestationText, 'Direct Edit')}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Finalize & Cosign
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <select
                                    value={visitType}
                                    onChange={(e) => setVisitType(e.target.value)}
                                    disabled={isSigned || isPreliminary}
                                    className="text-base font-semibold text-neutral-900 bg-transparent border-none rounded-md focus:ring-2 focus:ring-primary-500 cursor-pointer hover:bg-neutral-50 px-1 -ml-1 transition-all"
                                >
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="New Patient">New Patient</option>
                                    <option value="Sick Visit">Sick Visit</option>
                                    <option value="Physical">Physical</option>
                                    <option value="Telehealth Visit">Telehealth Visit</option>
                                    <option value="Consultation">Consultation</option>
                                    <option value="Office Visit">Office Visit</option>
                                </select>
                                <span className="text-base font-semibold text-neutral-900">Note</span>
                            </div>
                            <p className="text-xs text-neutral-600">{visitDate} • {providerName}</p>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <button
                                onClick={async () => {
                                    setShowChartReview(true);
                                    setChartReviewData({ visits: [], loading: true });
                                    try {
                                        const res = await visitsAPI.getByPatient(id);
                                        setChartReviewData({ visits: res.data || [], loading: false });
                                    } catch (e) {
                                        console.error('Error fetching visits for chart review:', e);
                                        setChartReviewData({ visits: [], loading: false });
                                    }
                                }}
                                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border bg-slate-900 text-white hover:bg-slate-800"
                                title="Quick Chart Review"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Review</span>
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
                            {!isSigned && !isPreliminary && (
                                <>
                                    {lastSaved && <span className="text-xs text-neutral-500 italic px-1.5">Saved {lastSaved.toLocaleTimeString()}</span>}
                                    <button onClick={handleSave} disabled={isSaving} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: isSaving ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')} onMouseLeave={(e) => !isSaving && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                    </button>
                                    <button onClick={handleSign} className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>{user?.role_name === 'Resident' || user?.role === 'Resident' ? 'Submit for Review' : 'Sign'}</span>
                                    </button>
                                </>
                            )}
                            {isPreliminary && (user?.role_name === 'Physician' || user?.role_name === 'CLINICIAN' || user?.role_name === 'Admin' || user?.role === 'admin' || user?.role === 'clinician') && (
                                <button
                                    onClick={() => setShowCosignModal(true)}
                                    className="px-2.5 py-1.5 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:shadow-md text-xs font-medium"
                                    style={{ background: 'linear-gradient(to right, #059669, #10B981)' }}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Cosign Note</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowPrintOrdersModal(true)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white text-primary-600 hover:bg-primary-50 text-[11px] font-bold rounded-full border border-primary-200 transition-all"
                                title="Print Orders"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Orders</span>
                            </button>
                            <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print Visit Note">
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                            {!isSigned && (
                                <button
                                    onClick={() => setShowQuickActions(!showQuickActions)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border ${showQuickActions ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-neutral-600 border-gray-200 hover:bg-gray-50'}`}
                                    title="Toggle Quick Actions Panel"
                                >
                                    <PanelRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {isSigned && !isRetracted && (
                                <button
                                    onClick={() => setShowRetractModal(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-xs font-medium transition-colors shadow-sm"
                                    title="Mark Note as Entered in Error (Retract)"
                                >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Retract</span>
                                </button>
                            )}
                            {isRetracted && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-md text-xs font-bold">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>RETRACTED</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Preliminary Banner */}
                {isPreliminary && (
                    <div className="bg-amber-500 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="w-6 h-6" />
                            <div>
                                <h3 className="text-base font-bold uppercase tracking-widest">Preliminary Report - Cosignature Required</h3>
                                <p className="text-xs text-amber-50 font-medium">
                                    {(visitData?.note_signed_by_role || '').match(/NP|PA|PRACTITIONER|ASSISTANT/i)
                                        ? "This clinical note requires review and cosignature by an attending physician."
                                        : "This documentation was authored by a trainee and requires clinical validation by an attending physician."
                                    }
                                    {visitData?.note_signed_by_name && ` (Signed by ${visitData.note_signed_by_name} on ${format(new Date(visitData.note_signed_at), 'MM/dd/yyyy')})`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Retraction Banner */}
                {isRetracted && (
                    <div className="bg-red-600 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-6 h-6" />
                            <div>
                                <h3 className="text-base font-bold uppercase tracking-widest">Retracted / Entered in Error</h3>
                                <p className="text-xs text-red-100 font-medium">
                                    This clinical note has been voided. Original documentation is preserved for audit purposes only.
                                    {retractionInfo && ` (Retracted by ${retractionInfo.retracted_by_name} on ${format(new Date(retractionInfo.retracted_at), 'MM/dd/yyyy')})`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setViewRetractedContent(!viewRetractedContent)}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-xs font-bold transition-all border border-white/40"
                        >
                            {viewRetractedContent ? 'Hide Original Content' : 'View Original Content'}
                        </button>
                    </div>
                )}
                {/* Main Content with Optional Sidebar */}
                <div className={`flex gap-4 ${showQuickActions && !isLocked ? '' : ''}`}>
                    {/* Left: Main Note Content */}
                    <div className={`${showQuickActions && !isLocked ? 'flex-1' : 'w-full'} transition-all duration-300 ${isRetracted && !viewRetractedContent ? 'opacity-40 blur-[1px] pointer-events-none grayscale' : ''}`}>

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
                                            disabled={isLocked}
                                            className={`w-14 px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                        />
                                        <span className="text-neutral-400 text-xs font-medium px-0.5">/</span>
                                        <input ref={diastolicRef} type="number" placeholder="80" value={vitals.diastolic}
                                            onChange={(e) => {
                                                const dia = e.target.value;
                                                const bp = vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '';
                                                setVitals({ ...vitals, diastolic: dia, bp });
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pulseRef.current?.focus(); } }}
                                            disabled={isLocked}
                                            className={`w-14 px-1.5 py-1 text-xs border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-accent-500 focus:border-accent-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-600 font-semibold border-red-300' : 'text-gray-900'}`}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 mb-1">HR (bpm)</label>
                                    <input ref={pulseRef} type="number" placeholder="72" value={vitals.pulse}
                                        onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); o2satRef.current?.focus(); } }}
                                        disabled={isLocked}
                                        className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors ${isAbnormalVital('pulse', vitals.pulse) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 mb-1">O2 Sat (%)</label>
                                    <input ref={o2satRef} type="number" placeholder="98" value={vitals.o2sat}
                                        onChange={(e) => setVitals({ ...vitals, o2sat: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tempRef.current?.focus(); } }}
                                        disabled={isLocked}
                                        className={`w-full px-1.5 py-1 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors ${isAbnormalVital('o2sat', vitals.o2sat) ? 'text-red-600 font-semibold border-red-300' : 'text-neutral-900'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 mb-1">Temp (°F)</label>
                                    <input ref={tempRef} type="number" step="0.1" placeholder="98.6" value={vitals.temp}
                                        onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); weightRef.current?.focus(); } }}
                                        disabled={isLocked}
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
                                            disabled={isLocked}
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
                                            }} disabled={isLocked} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'lbs' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.weightUnit === 'lbs' ? { background: '#3B82F6' } : {}}>lbs</button>
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
                                            }} disabled={isLocked} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.weightUnit === 'kg' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.weightUnit === 'kg' ? { background: '#3B82F6' } : {}}>kg</button>
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
                                            disabled={isLocked}
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
                                            }} disabled={isLocked} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'in' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.heightUnit === 'in' ? { background: '#3B82F6' } : {}}>in</button>
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
                                            }} disabled={isLocked} className={`px-1.5 py-1 text-xs font-medium transition-colors ${vitals.heightUnit === 'cm' ? 'text-white' : 'bg-white text-neutral-700 hover:bg-strong-azure/10'} disabled:bg-white disabled:text-neutral-700`} style={vitals.heightUnit === 'cm' ? { background: '#3B82F6' } : {}}>cm</button>
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
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-black text-slate-800 uppercase tracking-tight">Chief Complaint</label>
                                {editedSections.has('chiefComplaint') && (
                                    <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-black uppercase rounded border border-blue-600 shadow-sm shadow-blue-600/20 flex items-center gap-1">
                                        <Sparkles className="w-2 h-2" />
                                        Modified by Attending
                                    </span>
                                )}
                            </div>
                            <div className={`p-3 bg-neutral-50 rounded-xl border ${editedSections.has('chiefComplaint') ? 'border-blue-200 bg-blue-50/30' : 'border-neutral-100'} transition-all duration-300`}>
                                <input type="text" placeholder="Enter chief complaint..." value={noteData.chiefComplaint || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'chiefComplaint')}
                                    disabled={isLocked}
                                    className="w-full bg-transparent border-none text-xs font-medium focus:ring-0 text-slate-900 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* HPI */}
                        <Section title="History of Present Illness (HPI)" defaultOpen={true} isEdited={editedSections.has('hpi')}>
                            <div className="relative">
                                <textarea ref={hpiRef} value={noteData.hpi}
                                    disabled={isLocked}
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
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed leading-relaxed resize-y transition-colors text-neutral-900 min-h-[80px]"
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
                            <div className="mt-1.5 flex items-center space-x-3 text-xs text-neutral-500">
                                <button onClick={() => { setActiveTextArea('hpi'); setShowDotPhraseModal(true); }} className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 transition-colors">
                                    <Zap className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Dot Phrases (F2)</span>
                                </button>
                                {!isLocked && (
                                    <button onClick={() => openCarryForward('hpi')} className="flex items-center space-x-1 text-slate-600 hover:text-slate-800 transition-colors">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Pull Prior</span>
                                    </button>
                                )}
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
                                                disabled={isLocked}
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
                                                className="hidden"
                                            />
                                        </label>
                                    ))}
                                </div>
                                <textarea value={noteData.rosNotes} onChange={(e) => handleTextChange(e.target.value, 'rosNotes')}
                                    disabled={isLocked}
                                    rows={10}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px]"
                                    placeholder="ROS notes..."
                                />
                                <div className="mt-1.5 flex items-center gap-2">
                                    <button onClick={() => {
                                        const allRos = {};
                                        Object.keys(noteData.ros).forEach(key => { allRos[key] = true; });
                                        let rosText = '';
                                        Object.keys(rosFindings).forEach(key => {
                                            const systemName = key.charAt(0).toUpperCase() + key.slice(1);
                                            rosText += `${systemName}: ${rosFindings[key]}\n`;
                                        });
                                        setNoteData({ ...noteData, ros: allRos, rosNotes: rosText.trim() });
                                    }} disabled={isLocked} className="px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md disabled:opacity-50 transition-colors">
                                        Pre-fill Normal ROS
                                    </button>
                                    {!isLocked && (
                                        <button onClick={() => openCarryForward('ros')} className="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors flex items-center gap-1">
                                            <RotateCcw className="w-3 h-3" />
                                            Pull Prior
                                        </button>
                                    )}
                                </div>
                            </Section>

                            {/* Physical Exam */}
                            <Section title="Physical Examination" defaultOpen={true}>
                                <div className="grid grid-cols-2 gap-1 mb-1.5">
                                    {Object.keys(noteData.pe).map(system => (
                                        <label key={system} className="flex items-center space-x-1 cursor-pointer">
                                            {noteData.pe[system] ? <CheckSquare className="w-3 h-3 text-primary-600" /> : <Square className="w-3 h-3 text-neutral-400" />}
                                            <span className="text-xs text-neutral-700 capitalize">{system.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <input type="checkbox" checked={noteData.pe[system]}
                                                disabled={isLocked}
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
                                                className="hidden"
                                            />
                                        </label>
                                    ))}
                                </div>
                                <textarea value={noteData.peNotes} onChange={(e) => handleTextChange(e.target.value, 'peNotes')}
                                    disabled={isLocked}
                                    rows={10}
                                    className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed leading-relaxed resize-y transition-colors text-neutral-900 min-h-[120px]"
                                    placeholder="PE findings..."
                                />
                                <div className="mt-1.5 flex items-center gap-2">
                                    <button onClick={() => {
                                        const allPe = {};
                                        Object.keys(noteData.pe).forEach(key => { allPe[key] = true; });
                                        let peText = '';
                                        Object.keys(peFindings).forEach(key => {
                                            const systemName = key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                            peText += `${systemName}: ${peFindings[key]}\n`;
                                        });
                                        setNoteData({ ...noteData, pe: allPe, peNotes: peText.trim() });
                                    }} disabled={isLocked} className="px-2 py-1 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md disabled:opacity-50 transition-colors">
                                        Pre-fill Normal PE
                                    </button>
                                    {!isLocked && (
                                        <button onClick={() => openCarryForward('pe')} className="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors flex items-center gap-1">
                                            <RotateCcw className="w-3 h-3" />
                                            Pull Prior
                                        </button>
                                    )}
                                </div>
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
                                                    <span className="font-medium text-gray-900">
                                                        {(problem.problem_name || '')
                                                            .replace(/^(\d+(\.\d+)*\.?\s*)+/, '')
                                                            .replace(/&amp;/g, '&')
                                                            .replace(/&#x2f;/gi, '/')
                                                            .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                    </span>
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
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Problem added', 'success');
                                            } catch (e) { showToast('Failed to add problem', 'error'); }
                                        }}
                                        onDelete={async (itemId) => {
                                            if (!confirm('Are you sure?')) return;
                                            try {
                                                await patientsAPI.deleteProblem(itemId);
                                                setPatientData(prev => ({ ...prev, problems: prev.problems.filter(p => p.id !== itemId) }));
                                                window.dispatchEvent(new Event('patient-data-updated'));
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
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Allergy added', 'success');
                                            } catch (e) { showToast('Failed to add allergy', 'error'); }
                                        }}
                                        onDelete={async (itemId) => {
                                            if (!confirm('Are you sure?')) return;
                                            try {
                                                await patientsAPI.deleteAllergy(itemId);
                                                setPatientData(prev => ({ ...prev, allergies: prev.allergies.filter(a => a.id !== itemId) }));
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Allergy deleted', 'success');
                                            } catch (e) { showToast('Failed to delete allergy', 'error'); }
                                        }}
                                    />

                                    {/* M - Medications */}
                                    <HistoryList
                                        title="Home Medications"
                                        icon={<Pill className="w-4 h-4 text-blue-600" />}
                                        items={(patientData?.medications || []).filter(m => {
                                            // Only show active medications
                                            if (m.active === false) return false;

                                            // Only show medications started BEFORE this visit
                                            // Home medications = what patient was taking before today
                                            if (visitData?.visit_date) {
                                                const visitDate = new Date(visitData.visit_date);
                                                visitDate.setHours(0, 0, 0, 0); // Set to start of day

                                                if (m.start_date) {
                                                    const medStartDate = new Date(m.start_date);
                                                    medStartDate.setHours(0, 0, 0, 0); // Set to start of day

                                                    // Include if medication was started before or on the day of this visit
                                                    const shouldShow = medStartDate <= visitDate;
                                                    console.log(`[HomeMeds] ${m.medication_name}: medStart=${medStartDate.toISOString()}, visitDate=${visitDate.toISOString()}, show=${shouldShow}`);
                                                    return shouldShow;
                                                }
                                            }

                                            // If no dates available, default to showing it
                                            // (this handles legacy data without dates)
                                            return true;
                                        })}
                                        emptyMessage="No active medications"
                                        renderItem={(med) => {
                                            // Decode HTML entities in medication name
                                            const decodedName = (med.medication_name || '')
                                                .replace(/&amp;/g, '&')
                                                .replace(/&#x2f;/gi, '/')
                                                .replace(/&#47;/g, '/')
                                                .replace(/&quot;/g, '"')
                                                .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
                                            return (
                                                <div className="flex justify-between items-start w-full">
                                                    <span className="font-medium text-gray-900">{decodedName}</span>
                                                    <span className="text-gray-500 text-xs">
                                                        {[med.dosage, med.frequency, med.route].filter(Boolean).join(' ')}
                                                    </span>
                                                </div>
                                            );
                                        }}
                                        renderInput={(props) => <MedicationInput {...props} />}
                                        onAdd={async (data) => {
                                            try {
                                                const res = await patientsAPI.addMedication(id, data);
                                                setPatientData(prev => ({ ...prev, medications: [res.data, ...(prev.medications || [])] }));
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Medication added', 'success');
                                            } catch (e) { showToast('Failed to add medication', 'error'); }
                                        }}
                                        onDelete={async (itemId) => {
                                            if (!confirm('Are you sure?')) return;
                                            try {
                                                await patientsAPI.deleteMedication(itemId);
                                                setPatientData(prev => ({ ...prev, medications: prev.medications.filter(m => m.id !== itemId) }));
                                                window.dispatchEvent(new Event('patient-data-updated'));
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
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Family history added', 'success');
                                            } catch (e) { showToast('Failed to add family history', 'error'); }
                                        }}
                                        onDelete={async (itemId) => {
                                            if (!confirm('Are you sure?')) return;
                                            try {
                                                await patientsAPI.deleteFamilyHistory(itemId);
                                                setFamilyHistory(prev => prev.filter(h => h.id !== itemId));
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Family history deleted', 'success');
                                            } catch (e) { showToast('Failed to delete family history', 'error'); }
                                        }}
                                    />

                                    {/* S - Surgical History */}
                                    <HistoryList
                                        title="Surgical History"
                                        icon={<ActivitySquare className="w-4 h-4 text-blue-600" />}
                                        items={surgicalHistory}
                                        emptyMessage="No surgical history recorded"
                                        renderItem={(surg) => (
                                            <div className="flex justify-between items-start w-full">
                                                <div>
                                                    <span className="font-medium text-gray-900">{surg.procedure_name}</span>
                                                    {surg.date && (
                                                        <span className="text-gray-500 text-[10px] ml-2">
                                                            ({format(new Date(surg.date), 'MM/dd/yyyy')})
                                                        </span>
                                                    )}
                                                </div>
                                                {surg.surgeon && <span className="text-gray-500 text-xs">{surg.surgeon}</span>}
                                            </div>
                                        )}
                                        renderInput={(props) => <SurgicalHistoryInput {...props} />}
                                        onAdd={async (data) => {
                                            try {
                                                const res = await patientsAPI.addSurgicalHistory(id, data);
                                                setSurgicalHistory(prev => [res.data, ...prev]);
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Surgical history added', 'success');
                                            } catch (e) { showToast('Failed to add surgical history', 'error'); }
                                        }}
                                        onDelete={async (itemId) => {
                                            if (!confirm('Are you sure?')) return;
                                            try {
                                                await patientsAPI.deleteSurgicalHistory(itemId);
                                                setSurgicalHistory(prev => prev.filter(h => h.id !== itemId));
                                                window.dispatchEvent(new Event('patient-data-updated'));
                                                showToast('Surgical history deleted', 'success');
                                            } catch (e) { showToast('Failed to delete surgical history', 'error'); }
                                        }}
                                    />

                                    {/* O/S - Social History */}
                                    <div className="border rounded-md border-gray-100 bg-white">
                                        <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-100">
                                            <UserCircle className="w-4 h-4 text-teal-600" />
                                            <h4 className="text-sm font-semibold text-gray-800">Other / Social History</h4>
                                        </div>
                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            {/* Helper to transform and save social history */}
                                            {(() => {
                                                const saveSocialHistory = async (changes) => {
                                                    try {
                                                        const updatedState = { ...socialHistory, ...changes };
                                                        // Map snake_case state to camelCase payload for backend
                                                        const payload = {
                                                            smokingStatus: updatedState.smoking_status,
                                                            smokingPackYears: updatedState.smoking_pack_years,
                                                            alcoholUse: updatedState.alcohol_use,
                                                            alcoholQuantity: updatedState.alcohol_quantity,
                                                            drugUse: updatedState.drug_use,
                                                            exerciseFrequency: updatedState.exercise_frequency,
                                                            diet: updatedState.diet,
                                                            occupation: updatedState.occupation,
                                                            livingSituation: updatedState.living_situation,
                                                            notes: updatedState.notes
                                                        };
                                                        await patientsAPI.saveSocialHistory(id, payload);
                                                        setSocialHistory(updatedState);
                                                        window.dispatchEvent(new Event('patient-data-updated'));
                                                    } catch (e) {
                                                        console.error('Error saving social history:', e);
                                                        showToast('Failed to update social history', 'error');
                                                    }
                                                };

                                                return (
                                                    <>
                                                        <div>
                                                            <label className="text-xs text-gray-500 block mb-1">Smoking Status</label>
                                                            <select
                                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                                value={socialHistory?.smoking_status || ''}
                                                                onChange={(e) => saveSocialHistory({ smoking_status: e.target.value })}
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
                                                                onChange={(e) => saveSocialHistory({ alcohol_use: e.target.value })}
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
                                                                onBlur={(e) => saveSocialHistory({ occupation: e.target.value })}
                                                                onChange={(e) => setSocialHistory(prev => ({ ...prev, occupation: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-500 block mb-1">Diet</label>
                                                            <input
                                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                                value={socialHistory?.diet || ''}
                                                                placeholder="Diet details"
                                                                onBlur={(e) => saveSocialHistory({ diet: e.target.value })}
                                                                onChange={(e) => setSocialHistory(prev => ({ ...prev, diet: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-500 block mb-1">Exercise</label>
                                                            <input
                                                                className="w-full p-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                                value={socialHistory?.exercise_frequency || ''}
                                                                placeholder="Frequency"
                                                                onBlur={(e) => saveSocialHistory({ exercise_frequency: e.target.value })}
                                                                onChange={(e) => setSocialHistory(prev => ({ ...prev, exercise_frequency: e.target.value }))}
                                                            />
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Results / Data Section */}
                        <Section title="Results / Data" defaultOpen={true}>
                            {visitDocuments.length === 0 && (
                                <div className="py-12 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-300">
                                    <FilePlus className="w-10 h-10 mb-3 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">No Laboratory or Imaging Findings Linked</p>
                                    <p className="text-[10px] mt-1 opacity-40">Upload files via the patient chart to see results here.</p>
                                </div>
                            )}

                            {visitDocuments.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {visitDocuments.map(doc => (
                                        <div key={doc.id} className="relative group">
                                            <ResultImage doc={doc} />
                                            <div className="flex justify-between items-center mt-2 px-1">
                                                <div className="flex flex-col">
                                                    <p className="text-[10px] font-bold text-gray-900 truncate max-w-[200px]">{doc.filename}</p>
                                                    <p className="text-[8px] text-gray-400 uppercase font-black tracking-tighter">
                                                        Uploaded {format(new Date(doc.created_at || new Date()), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Remove image from note?')) {
                                                            // Unlink
                                                            documentsAPI.update(doc.id, { visit_id: null })
                                                                .then(() => setVisitDocuments(prev => prev.filter(d => d.id !== doc.id)));
                                                        }
                                                    }}
                                                    className="p-2 bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100 shadow-sm"
                                                    title="Unlink from visit"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Assessment */}
                        <Section title="Assessment" defaultOpen={true} isEdited={editedSections.has('assessment')}>
                            {/* Quick Add block removed */}

                            {/* ICD-10 Search - Show first for easy access */}
                            {hasPrivilege('search_icd10') && (
                                <div className="mb-2">
                                    <button
                                        onClick={() => setShowICD10Modal(true)}
                                        className="w-full px-3 py-1.5 text-xs font-medium bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-md border border-neutral-300 transition-colors flex items-center justify-center space-x-1"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        <span>Search ICD-10 Codes (Modal)</span>
                                    </button>

                                    {/* Simple inline search */}
                                    <div className="relative mt-2">
                                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                        <input
                                            id="icd10-quick-search"
                                            type="text"
                                            placeholder={editingDiagnosisIndex !== null ? `Editing: ${diagnoses[editingDiagnosisIndex]}` : "Quick search: Type diagnosis or code..."}
                                            value={icd10Search}
                                            onChange={(e) => {
                                                setIcd10Search(e.target.value);
                                                setShowIcd10Search(true);
                                            }}
                                            disabled={isLocked}
                                            className={`w-full pl-8 pr-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors ${editingDiagnosisIndex !== null ? 'border-primary-500 ring-1 ring-primary-500' : ''}`}
                                        />
                                    </div>

                                    {showIcd10Search && icd10Results.length > 0 && icd10Search.trim().length >= 2 && (
                                        <div className="absolute z-[60] mt-1 w-full border border-neutral-200 rounded-lg bg-white shadow-2xl max-h-80 overflow-y-auto py-1">
                                            {icd10Results.map((code) => (
                                                <button
                                                    key={code.id || code.code}
                                                    onClick={() => {
                                                        handleAddICD10(code, false);
                                                        setIcd10Search('');
                                                        setIcd10Results([]);
                                                        setShowIcd10Search(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 border-b border-neutral-50 last:border-0 hover:bg-primary-50 transition-colors group"
                                                >
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="font-bold text-primary-700 text-xs group-hover:text-primary-800 tracking-tight">{code.code}</span>
                                                        {!code.is_billable && (
                                                            <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">Non-Billable</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-neutral-700 leading-tight line-clamp-2">{code.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* No results message */}
                                    {showIcd10Search && icd10Results.length === 0 && icd10Search.trim().length >= 2 && (
                                        <div className="mt-1 border border-neutral-200 rounded-md bg-white p-3 text-center">
                                            <p className="text-xs text-neutral-500">No codes found for "{icd10Search}"</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Show structured list of diagnoses when not signed and diagnoses exist */}
                            {!isSigned && diagnoses.length > 0 && (
                                <div className="mb-2 border border-neutral-200 rounded-md bg-white p-2">
                                    <div className="space-y-1">
                                        {diagnoses.map((diag, idx) => (
                                            <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-neutral-50 rounded group transition-colors">
                                                <div className="flex-1 text-xs text-neutral-900 flex items-center">
                                                    <span className="font-medium mr-2">{idx + 1}.</span>
                                                    <button
                                                        onClick={() => {
                                                            // Use modal for editing instead of inline search
                                                            setEditingDiagnosisIndex(idx);
                                                            setShowICD10Modal(true);
                                                        }}
                                                        className="flex-1 text-left hover:text-primary-600 hover:underline transition-colors"
                                                    >
                                                        {diag.replace(/^\d+\.\s*/, '')}
                                                    </button>
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
                            {/* Free text assessment removed per request */}
                        </Section>

                        {/* Plan */}
                        <Section title="Plan" defaultOpen={true} isEdited={editedSections.has('plan')}>
                            <div className="relative">
                                {/* Show structured plan preview only when editing and there's structured data */}
                                {!isSigned && noteData.planStructured && noteData.planStructured.length > 0 && (
                                    <div className="mb-2 p-2 bg-neutral-50 rounded-md border border-neutral-200">
                                        <div className="space-y-3">
                                            {noteData.planStructured.map((item, index) => (
                                                <div key={index} className="border-b border-neutral-200 last:border-b-0 pb-2 last:pb-0 group">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDiagnosis(item.diagnosis);
                                                                setShowOrderModal(true);
                                                            }}
                                                            className="font-bold underline text-xs text-primary-700 hover:text-primary-900 text-left"
                                                        >
                                                            {index + 1}. {item.diagnosis}
                                                        </button>
                                                        {!isLocked && (
                                                            <button
                                                                onClick={() => removeFromPlan(index)}
                                                                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all p-1"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
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

                                {isSigned && (
                                    <div className="p-2 border border-neutral-200 rounded-md bg-neutral-50 text-xs">
                                        <PlanDisplay plan={noteData.plan} />
                                    </div>
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
                            {!isLocked && (
                                <div className="mt-2 flex space-x-1.5">
                                    {hasPrivilege('order_labs') && (
                                        <button
                                            onClick={() => {
                                                setOrderModalTab('labs');
                                                setShowOrderModal(true);
                                            }}
                                            className="px-2.5 py-1.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm transition-all flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Order</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setOrderModalTab('medications');
                                            setShowOrderModal(true);
                                        }}
                                        className="px-2.5 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md border border-neutral-300 transition-colors"
                                    >
                                        Prescribe Rx
                                    </button>
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


                        {/* Caregiver Training (CTS) */}
                        <Section title="Caregiver Training Services (CTS)" defaultOpen={false} isEdited={editedSections.has('cts')}>
                            <div className="relative">
                                <textarea
                                    value={noteData.cts || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'cts')}
                                    placeholder="Document topic (e.g. Wound Care), time spent, and if telehealth..."
                                    className="w-full text-xs p-2 border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-h-[60px]"
                                    disabled={isLocked}
                                />
                                {!isSigned && (
                                    <div className="mt-2 text-xs">
                                        <label className="block text-neutral-600 font-medium mb-1">Quick Templates:</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                'CTS: Wound Care Education (15 min)',
                                                'CTS: Infection Control (10 min)',
                                                'CTS: ADL Assistance Techniques',
                                                'CTS: Medication Administration'
                                            ].map((template) => (
                                                <button
                                                    key={template}
                                                    onClick={() => handleTextChange(noteData.cts ? `${noteData.cts}\n${template}` : template, 'cts')}
                                                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded text-xs transition-colors"
                                                >
                                                    {template}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* ASCVD Risk Management */}
                        <Section title="ASCVD Risk Management" defaultOpen={false} isEdited={editedSections.has('ascvd')}>
                            <div className="relative">
                                <textarea
                                    value={noteData.ascvd || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'ascvd')}
                                    placeholder="Risk score, category, and management plan..."
                                    className="w-full text-xs p-2 border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-h-[60px]"
                                    disabled={isLocked}
                                />
                                {!isSigned && (
                                    <div className="mt-2 text-xs">
                                        <label className="block text-neutral-600 font-medium mb-1">Risk Categories:</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['Low Risk (<5%)', 'Borderline (5-7.4%)', 'Intermediate (7.5-19.9%)', 'High Risk (≥20%)'].map((risk) => (
                                                <button
                                                    key={risk}
                                                    onClick={() => handleTextChange(noteData.ascvd ? `${noteData.ascvd}\nRisk Category: ${risk}` : `Risk Category: ${risk}`, 'ascvd')}
                                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs transition-colors"
                                                >
                                                    {risk}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* Behavioral Safety Plan */}
                        <Section title="Behavioral Safety Plan" defaultOpen={false} isEdited={editedSections.has('safetyPlan')}>
                            <div className="relative">
                                <textarea
                                    value={noteData.safetyPlan || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'safetyPlan')}
                                    placeholder="Warning signs, coping strategies, and contacts..."
                                    className="w-full text-xs p-2 border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-h-[60px]"
                                    disabled={isLocked}
                                />
                                {!isSigned && (
                                    <div className="mt-2 text-xs">
                                        <label className="block text-neutral-600 font-medium mb-1">Components:</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['Warning Signs', 'Coping Strategies', 'Social Contacts', 'Professional Contacts'].map((comp) => (
                                                <button
                                                    key={comp}
                                                    onClick={() => handleTextChange(noteData.safetyPlan ? `${noteData.safetyPlan}\n${comp}: ` : `${comp}: `, 'safetyPlan')}
                                                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs transition-colors"
                                                >
                                                    {comp}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* Care Plan */}
                        <Section title="Care Plan" defaultOpen={true} isEdited={editedSections.has('carePlan')}>
                            <div className="relative">
                                <textarea
                                    value={noteData.carePlan || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'carePlan')}
                                    placeholder="Summary of what needs to be done in preparation for the next visit..."
                                    className="w-full text-xs p-2 border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                                    disabled={isLocked}
                                />
                            </div>
                        </Section>

                        {/* Follow Up */}
                        <Section title="Follow Up" defaultOpen={true}>
                            <div className="relative">
                                <textarea
                                    value={noteData.followUp || ''}
                                    onChange={(e) => setNoteData({ ...noteData, followUp: e.target.value })}
                                    placeholder="Follow up instructions..."
                                    className="w-full text-xs p-2 border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-h-[60px]"
                                    disabled={isLocked}
                                />
                                {!isSigned && (
                                    <div className="mt-2 text-xs">
                                        <label className="block text-neutral-600 font-medium mb-1">Quick Select:</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['1 Week', '2 Weeks', '1 Month', '3 Months', '6 Months', '1 Year', 'PRN'].map((duration) => (
                                                <button
                                                    key={duration}
                                                    onClick={() => {
                                                        setNoteData({ ...noteData, followUp: duration });
                                                    }}
                                                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 rounded text-xs transition-colors"
                                                >
                                                    {duration}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* Signature Manifestation */}
                        {(isSigned || isPreliminary) && (
                            <div className="mt-8 space-y-4">
                                <SignatureCard
                                    type="Author"
                                    signerName={visitData?.note_signed_by_name || (visitData?.signed_by_first_name ? `${visitData.signed_by_first_name} ${visitData.signed_by_last_name}` : '')}
                                    role={visitData?.author_role}
                                    date={visitData?.note_signed_at}
                                    isPreliminary={isPreliminary}
                                />
                                {visitData?.cosigned_at && (
                                    <SignatureCard
                                        type="Cosigner"
                                        signerName={visitData?.cosigned_by_name || (visitData?.cosigned_by_first_name ? `${visitData.cosigned_by_first_name} ${visitData.cosigned_by_last_name}` : '')}
                                        role={visitData?.cosigner_role || 'Attending Physician'}
                                        date={visitData?.cosigned_at}
                                        attestationText={visitData?.attestation_text}
                                        authorshipModel={visitData?.authorship_model}
                                    />
                                )}
                            </div>
                        )}

                        {/* Bottom Action Buttons */}
                        {!isSigned && !isPreliminary && (
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
                                    <button
                                        onClick={handleCreateSuperbill}
                                        className="px-2.5 py-1.5 bg-slate-800 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:bg-slate-900 text-xs font-medium"
                                        title="Create/Open Commercial Superbill"
                                    >
                                        <DollarSign className="w-3.5 h-3.5" />
                                        <span>Superbill</span>
                                    </button>
                                    <button onClick={handleDelete} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-colors text-xs font-medium">
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate(`/patient/${id}/snapshot`)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1" title="Back to Patient Chart">
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Chart</span>
                                    </button>
                                    <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                        <Printer className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {isSigned && (
                            <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                    <button
                                        onClick={handleCreateSuperbill}
                                        className="px-2.5 py-1.5 bg-slate-800 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:bg-slate-900 text-xs font-medium"
                                        title="Create/Open Commercial Superbill"
                                    >
                                        <DollarSign className="w-3.5 h-3.5" />
                                        <span>Superbill</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate(`/patient/${id}/snapshot`)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1" title="Back to Patient Chart">
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Chart</span>
                                    </button>
                                    <button onClick={() => setShowPrintModal(true)} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors" title="Print">
                                        <Printer className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* End of main content div */}

                    {/* Right: Quick Actions Sidebar */}
                    {showQuickActions && !isSigned && (
                        <div className="w-72 flex-shrink-0 sticky top-4 h-fit">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                {/* Sidebar Header */}
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Quick Actions</span>
                                    <button onClick={() => setShowQuickActions(false)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                        <X className="w-3.5 h-3.5 text-slate-500" />
                                    </button>
                                </div>

                                {/* Problem List Section */}
                                <div className="border-b border-slate-100">
                                    <div className="px-3 py-2 bg-slate-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Problem List</span>
                                        </div>
                                    </div>
                                    <div className="p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {(patientData?.problems || []).filter(p => p.status === 'active').length > 0 ? (
                                            <div className="space-y-1">
                                                {(() => {
                                                    const seen = new Set();
                                                    return (patientData?.problems || [])
                                                        .filter(p => p.status === 'active')
                                                        .filter(p => {
                                                            const cleanName = (p.problem_name || p.name || '')
                                                                .replace(/^[\d.\s]+/, '')
                                                                .toLowerCase()
                                                                .trim();
                                                            if (seen.has(cleanName)) return false;
                                                            seen.add(cleanName);
                                                            return true;
                                                        })
                                                        .slice(0, 10)
                                                        .map((p, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => addProblemToAssessment(p)}
                                                                className="w-full text-left px-2 py-1.5 text-[11px] bg-white hover:bg-primary-50 rounded border border-slate-100 hover:border-primary-200 transition-all flex items-center gap-1.5 group"
                                                            >
                                                                <Plus className="w-3 h-3 text-slate-400 group-hover:text-primary-600" />
                                                                <span className="truncate flex-1 text-slate-700 group-hover:text-primary-700">
                                                                    {(p.problem_name || '').replace(/^[\d.\s]+/, '')}
                                                                </span>
                                                                {p.icd10_code && <span className="text-[9px] text-slate-400 font-mono">{p.icd10_code}</span>}
                                                            </button>
                                                        ));
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic text-center py-2">No active problems</div>
                                        )}
                                    </div>
                                </div>

                                {/* Medications Section */}
                                <div className="border-b border-slate-100">
                                    <div className="px-3 py-2 bg-slate-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <Pill className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Medications</span>
                                        </div>
                                    </div>
                                    <div className="p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {(patientData?.medications || []).filter(m => m.active !== false).length > 0 ? (
                                            <div className="space-y-1.5">
                                                {(patientData?.medications || []).filter(m => m.active !== false).slice(0, 8).map((m, idx) => (
                                                    <div key={idx} className="px-2 py-1.5 bg-white rounded border border-slate-100">
                                                        <div className="text-[11px] font-medium text-slate-800 truncate">
                                                            {(m.medication_name || '')
                                                                .replace(/&amp;/g, '&')
                                                                .replace(/&#x2f;/gi, '/')
                                                                .replace(/&#47;/g, '/')
                                                                .replace(/&quot;/g, '"')
                                                                .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500">{m.dosage} {m.frequency}</div>
                                                        <div className="flex gap-1 mt-1">
                                                            <button onClick={() => addMedicationToPlan(m, 'continue')} className="px-1.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors">
                                                                Continue
                                                            </button>
                                                            <button onClick={() => addMedicationToPlan(m, 'refill')} className="px-1.5 py-0.5 text-[9px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors flex items-center gap-0.5">
                                                                <RefreshCw className="w-2.5 h-2.5" />
                                                                Refill
                                                            </button>
                                                            <button onClick={() => addMedicationToPlan(m, 'stop')} className="px-1.5 py-0.5 text-[9px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors flex items-center gap-0.5">
                                                                <StopCircle className="w-2.5 h-2.5" />
                                                                Stop
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic text-center py-2">No medications</div>
                                        )}
                                    </div>
                                </div>

                                {/* HPI Templates Section */}
                                <div className="border-b border-slate-100">
                                    <div className="px-3 py-2 bg-slate-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">HPI Templates</span>
                                        </div>
                                    </div>
                                    <div className="p-2 max-h-36 overflow-y-auto custom-scrollbar">
                                        <div className="space-y-1">
                                            {hpiTemplates.map((t, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => insertHpiTemplate(t.key, t.text)}
                                                    className="w-full text-left px-2 py-1.5 text-[11px] bg-white hover:bg-blue-50 rounded border border-slate-100 hover:border-blue-200 transition-all flex items-center gap-1.5 group"
                                                >
                                                    <Zap className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                                                    <span className="text-slate-700 group-hover:text-blue-700">{t.key}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Results Import Section */}
                                <div>
                                    <div className="px-3 py-2 bg-slate-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Results</span>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                onClick={() => openResultImport('Labs')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-purple-50 rounded border border-slate-100 hover:border-purple-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <FlaskConical className="w-4 h-4 text-purple-500" />
                                                <span className="text-slate-600">Labs</span>
                                            </button>
                                            <button
                                                onClick={() => openResultImport('Imaging')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-blue-50 rounded border border-slate-100 hover:border-blue-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <FileImage className="w-4 h-4 text-blue-500" />
                                                <span className="text-slate-600">Image</span>
                                            </button>
                                            <button
                                                onClick={() => openResultImport('Echo')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-rose-50 rounded border border-slate-100 hover:border-rose-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <Heart className="w-4 h-4 text-rose-500" />
                                                <span className="text-slate-600">Echo</span>
                                            </button>
                                            <button
                                                onClick={() => openResultImport('EKG')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-rose-50 rounded border border-slate-100 hover:border-rose-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <Waves className="w-4 h-4 text-rose-500" />
                                                <span className="text-slate-600">EKG</span>
                                            </button>
                                            <button
                                                onClick={() => openResultImport('Cath')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-red-50 rounded border border-slate-100 hover:border-red-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <Stethoscope className="w-4 h-4 text-red-500" />
                                                <span className="text-slate-600">Cath</span>
                                            </button>
                                            <button
                                                onClick={() => openResultImport('Stress')}
                                                className="px-2 py-2 text-[10px] bg-white hover:bg-orange-50 rounded border border-slate-100 hover:border-orange-200 transition-all flex flex-col items-center gap-1"
                                            >
                                                <Activity className="w-4 h-4 text-orange-500" />
                                                <span className="text-slate-600">Stress</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* End of flex container */}

                {/* Modals */}
                {/* Premium Diagnosis Picker Modal */}
                {
                    showICD10Modal && (
                        <div
                            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm"
                            onClick={() => { setShowICD10Modal(false); setEditingDiagnosisIndex(null); }}
                        >
                            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
                                <DiagnosisPicker
                                    onSelect={(code) => handleAddICD10(code)}
                                    onClose={() => { setShowICD10Modal(false); setEditingDiagnosisIndex(null); }}
                                    existingDiagnoses={diagnoses}
                                />
                            </div>
                        </div>
                    )
                }
                <OrderModal
                    isOpen={showOrderModal}
                    onClose={() => { setShowOrderModal(false); setSelectedDiagnosis(null); }}
                    initialTab={orderModalTab}
                    diagnoses={diagnoses}
                    selectedDiagnosis={selectedDiagnosis}
                    existingOrders={noteData.planStructured}
                    onSave={handleUpdatePlan}
                    patientId={id}
                    visitId={currentVisitId || urlVisitId}
                    initialMedications={patientData?.medications}
                    patientProblems={patientData?.problems}
                />

                {showOrderPicker && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowOrderPicker(false)}>
                        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
                            <OrderPicker
                                type={orderPickerType}
                                onSelect={handleOrderSelect}
                                onClose={() => setShowOrderPicker(false)}
                                visitId={currentVisitId || urlVisitId}
                                patientId={id}
                            />
                        </div>
                    </div>
                )}

                {showPrintModal && <VisitPrint visitId={currentVisitId || urlVisitId} patientId={id} onClose={() => setShowPrintModal(false)} />}

                {/* Unified Patient Chart Panel */}
                <PatientChartPanel
                    patientId={id}
                    isOpen={showPatientChart}
                    onClose={() => setShowPatientChart(false)}
                    initialTab={patientChartTab}
                />

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Result Import Modal */}
                <ResultImportModal
                    isOpen={showResultImportModal}
                    onClose={() => setShowResultImportModal(false)}
                    onImport={handleResultImport}
                    patientId={id}
                    resultType={resultImportType}
                />

                {/* Diagnosis Link Modal for Meds */}
                {showDiagnosisLinkModal && (
                    <DiagnosisLinkModal
                        isOpen={showDiagnosisLinkModal}
                        onClose={() => setShowDiagnosisLinkModal(false)}
                        diagnoses={diagnoses}
                        onConfirm={(selectedDiagnoses) => {
                            const { action, medication } = pendingMedAction;
                            if (action === 'add') {
                                setPatientData(prev => ({
                                    ...prev,
                                    medications: [{ ...medication, related_diagnoses: selectedDiagnoses }, ...(prev.medications || [])]
                                }));
                            }
                            setShowDiagnosisLinkModal(false);
                        }}
                    />
                )}

                {showCosignModal && (
                    <CosignModal
                        isOpen={showCosignModal}
                        onClose={() => setShowCosignModal(false)}
                        visitData={visitData}
                        authorshipModel={authorshipModel}
                        setAuthorshipModel={setAuthorshipModel}
                        attestationText={attestationText}
                        setAttestationText={setAttestationText}
                        macros={attestationMacros}
                        onConfirm={() => {
                            handleCosign(attestationText, authorshipModel);
                        }}
                        onCreateMacro={handleCreateMacro}
                        onDeleteMacro={handleDeleteMacro}
                        isSaving={isSaving}
                    />
                )}

                {/* Dot Phrase Modal */}
                {
                    showDotPhraseModal && (
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
                    )
                }
                {showPrintOrdersModal && (
                    <PrintOrdersModal
                        patient={{ ...patientData, id }}
                        isOpen={showPrintOrdersModal}
                        onClose={() => setShowPrintOrdersModal(false)}
                    />
                )}

                {/* Chart Review Modal - Note Focused */}
                {showChartReview && (
                    <ChartReviewModal
                        isOpen={showChartReview}
                        onClose={() => setShowChartReview(false)}
                        visits={chartReviewData.visits}
                        isLoading={chartReviewData.loading}
                        patientData={patientData}
                        onViewFullChart={() => {
                            setShowChartReview(false);
                            setPatientChartTab('history');
                            setShowPatientChart(true);
                        }}
                        onOpenVisit={(visitId) => {
                            if (visitId !== (currentVisitId || urlVisitId)) {
                                navigate(`/patient/${id}/visit/${visitId}`);
                            }
                        }}
                    />
                )}

                {/* Carry Forward Modal */}
                {showCarryForward && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowCarryForward(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-600 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <RotateCcw className="w-5 h-5 text-white" />
                                    <h2 className="text-lg font-bold text-white">Pull from Previous Visit</h2>
                                    <span className="text-[11px] font-bold uppercase text-slate-300 bg-slate-500 px-2 py-0.5 rounded">
                                        {carryForwardField?.toUpperCase()}
                                    </span>
                                </div>
                                <button onClick={() => setShowCarryForward(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {loadingPrevVisits ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : previousVisits.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm font-medium">No previous visits with notes found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-xs text-slate-500 mb-4">
                                            Select a visit below to pull its <strong>{carryForwardField?.toUpperCase()}</strong> content into the current note.
                                        </p>
                                        {previousVisits.map((visit) => {
                                            const sectionContent = extractSectionFromNote(visit.note_draft, carryForwardField);
                                            const hasContent = sectionContent && sectionContent.trim().length > 0;

                                            return (
                                                <div key={visit.id} className={`p-4 rounded-xl border transition-all ${hasContent ? 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-md cursor-pointer' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-900">
                                                                    {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                                                                </span>
                                                                {visit.locked && <Lock className="w-3 h-3 text-slate-400" />}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 uppercase font-medium">
                                                                {visit.visit_type?.replace('_', ' ') || 'Office Visit'} • {visit.provider_last_name || 'Provider'}
                                                            </div>
                                                        </div>
                                                        {hasContent && (
                                                            <button
                                                                onClick={() => insertCarryForward(sectionContent)}
                                                                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                                Use This
                                                            </button>
                                                        )}
                                                    </div>

                                                    {hasContent ? (
                                                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                                                                {carryForwardField?.toUpperCase()} Content
                                                            </div>
                                                            <div className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4">
                                                                {sectionContent}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2 text-xs text-slate-400 italic">
                                                            No {carryForwardField?.toUpperCase()} content found in this visit
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                                <div className="text-xs text-slate-500">
                                    Content will replace the current {carryForwardField?.toUpperCase()} field
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <RetractionModal
                isOpen={showRetractModal}
                onClose={() => setShowRetractModal(false)}
                data={retractData}
                setData={setRetractData}
                onConfirm={async () => {
                    try {
                        setIsSaving(true);
                        await visitsAPI.retract(currentVisitId, retractData);
                        showToast('Note retracted successfully', 'success');
                        setShowRetractModal(false);
                        setIsRetracted(true);
                        setRefreshTrigger(prev => prev + 1);
                    } catch (e) {
                        console.error('Retraction failed:', e);
                        showToast(e.response?.data?.error || 'Failed to retract note', 'error');
                    } finally {
                        setIsSaving(false);
                    }
                }}
            />
            <SignPromptModal
                isOpen={showSignPrompt}
                onClose={() => setShowSignPrompt(false)}
                isSaving={isSaving}
                attendings={attendings}
                selectedAttendingId={selectedAttendingId}
                setSelectedAttendingId={setSelectedAttendingId}
                isResident={(user?.role_name || user?.role || '').toUpperCase().includes('STUDENT') || (user?.role_name || user?.role || '').toUpperCase().includes('RESIDENT')}
                onConfirm={handleSign}
            />
        </div>
    );
};

export default VisitNote;
