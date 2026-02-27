import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CosignModal from '../components/CosignModal';
import {
    Save, Lock, FileText, ChevronDown, ChevronUp, Plus, ClipboardList,
    Sparkles, ArrowLeft, Zap, Search, X, Printer, History,
    Activity, ActivitySquare, CheckCircle2, CheckSquare, Square, Trash2, Pill, Users, UserCircle, ChevronRight,
    DollarSign, Eye, Calendar, AlertCircle, AlertTriangle, Stethoscope, ScrollText, Copy, RotateCcw,
    PanelRight, RefreshCw, StopCircle, FileImage, FlaskConical, Heart, Waves, FilePlus, Share2
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

// Modular Redesign Components
import './VisitNote.css';
import VisitNoteHeader from './VisitNoteComponent/VisitNoteHeader';
import QuickNav from './VisitNoteComponent/QuickNav';
import VisitNoteSection from './VisitNoteComponent/VisitNoteSection';
import VitalsGrid from './VisitNoteComponent/VitalsGrid';
import PlanDisplay from './VisitNoteComponent/PlanDisplay';
import CommandPalette from './VisitNoteComponent/CommandPalette';

const normalizeDiagnosis = (diag) => {
    if (!diag) return '';

    // 1. Remove leading numbers like "1. ", "1) ", "1- "
    let clean = diag.replace(/^\d+[\.\)\-]?\s*/, '').trim();

    // 2. Extract code and description
    // Pattern A: "I10 - Essential Hypertension"
    // Pattern B: "Essential Hypertension (I10)"

    let code = '';
    let description = clean;

    // Check Pattern A: Starting with a code followed by dash or space
    // e.g. "I10 - Essential (primary) hypertension"
    const patternAMatch = clean.match(/^([A-Z]\d{2,}\.?\d{0,})\s*[\-\:]\s*(.*)$/i);
    if (patternAMatch) {
        code = patternAMatch[1].toUpperCase();
        description = patternAMatch[2];
    } else {
        // Check Pattern B: Description followed by code in parentheses
        // e.g. "Essential (primary) hypertension (I10)"
        const patternBMatch = clean.match(/^(.*)\s*\((([A-Z]\d{2,}\.?\d{0,}))\)$/i);
        if (patternBMatch) {
            code = patternBMatch[2].toUpperCase();
            description = patternBMatch[1];
        } else {
            // Check for lone code
            const loneCodeMatch = clean.match(/^([A-Z]\d{2,}\.?\d{0,})$/i);
            if (loneCodeMatch) {
                code = loneCodeMatch[1].toUpperCase();
                description = '';
            }
        }
    }

    // 3. Clean up description
    description = description.trim();

    // 4. Return standard format: "CODE - DESCRIPTION" or just "DESCRIPTION"
    if (code && description) return `${code} - ${description}`;
    if (code) return code;
    return description;
};

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
                            <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1">{m.label}</span>
                            <span className="text-[11px] font-bold text-gray-800 tabular-nums">{m.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {interpretation && (
                <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-lg mt-1">
                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Clinical Interpretation</span>
                    <div className="text-[12px] font-bold text-gray-700 leading-tight italic">"{interpretation}"</div>
                </div>
            )}
        </div>
    );
};

// Collapsible Section Component - Refined UX
const SectionLegacy = ({ title, children, defaultOpen = true, isEdited = false, id, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div id={id} className={`scroll-mt-20 border ${isEdited ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200/80'} rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm shadow-slate-100/50 mb-4 overflow-hidden transition-all duration-200`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-2.5 ${isEdited ? 'bg-blue-50/30' : 'bg-gradient-to-r from-slate-50/80 to-white'} border-b ${isEdited ? 'border-blue-100/50' : 'border-gray-100'} flex items-center justify-between hover:bg-gray-50/80 transition-colors group`}
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-gray-700 tracking-wide">{title}</h3>
                    {badge !== undefined && (
                        <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded-full">{badge}</span>
                    )}
                    {isEdited && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-medium rounded-full flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Edited
                        </span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-all duration-200 ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 bg-white/50">{children}</div>
            </div>
        </div>
    );
};

// Plan Display Component
const PlanDisplayLegacy = ({ plan }) => {
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
                            <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mt-0.5">Entered in Error</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        This action will mark the note as <span className="font-bold">Retracted/Entered-in-Error</span>. The original content will be preserved but hidden by default. This cannot be undone.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Primary Reason</label>
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Explanation / Audit Journal</label>
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
                            <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Workflow Routing Required</p>
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
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

    // Quick actions state
    const [quickOrdersList, setQuickOrdersList] = useState([]);
    const [sidebarMacrosList, setSidebarMacrosList] = useState([]);
    const [showQuickActionDxModal, setShowQuickActionDxModal] = useState(false);
    const [pendingQuickAction, setPendingQuickAction] = useState(null); // {item: object, type: 'order'|'macro'}
    const [isAddingProblemFromSidebar, setIsAddingProblemFromSidebar] = useState(false);
    const [isAddingMedicationFromSidebar, setIsAddingMedicationFromSidebar] = useState(false);
    const [showMacroAddModal, setShowMacroAddModal] = useState(false);
    const [newMacroData, setNewMacroData] = useState({ shortcut_code: '', template_text: '' });

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

    // Multi-user Presence Detection
    const [othersOnNote, setOthersOnNote] = useState([]);

    // Presence Heartbeat Effect
    useEffect(() => {
        if (!id || isSigned) return;

        const performHeartbeat = async () => {
            try {
                const res = await visitsAPI.heartbeat(id);
                if (res.data && Array.isArray(res.data.others)) {
                    setOthersOnNote(res.data.others);
                }
            } catch (error) {
                console.error('Presence heartbeat failed:', error);
            }
        };

        // Run immediately
        performHeartbeat();

        // Then every 5 seconds
        const interval = setInterval(performHeartbeat, 5000);
        return () => clearInterval(interval);
    }, [id, isSigned]);

    // Refs for textareas
    const hpiRef = useRef(null);
    const assessmentRef = useRef(null);
    const planRef = useRef(null);

    // Command Palette State
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [commandSearchQuery, setCommandSearchQuery] = useState('');
    const [commandSuggestions, setCommandSuggestions] = useState([]);
    const [isCommandLoading, setIsCommandLoading] = useState(false);

    // Command Palette Trigger Logic
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Trigger with '/' or 'Cmd/Ctrl + K'
            if ((e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') ||
                ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Command Palette Search Logic
    useEffect(() => {
        if (!commandPaletteOpen || commandSearchQuery.length < 2) {
            setCommandSuggestions([]);
            return;
        }

        const performSearch = async () => {
            setIsCommandLoading(true);
            try {
                const [icd10Res, ordersRes] = await Promise.all([
                    codesAPI.searchICD10(commandSearchQuery),
                    ordersCatalogAPI.search(commandSearchQuery)
                ]);

                const suggestions = [
                    ...(icd10Res.data || []).slice(0, 5).map(i => ({
                        type: 'diagnosis',
                        title: i.description,
                        code: i.code,
                        source: i
                    })),
                    ...(ordersRes.data || []).slice(0, 5).map(o => ({
                        type: 'order',
                        title: o.name,
                        code: o.category,
                        source: o
                    }))
                ];
                setCommandSuggestions(suggestions);
            } catch (error) {
                console.error('Command Palette Search Error:', error);
            } finally {
                setIsCommandLoading(false);
            }
        };

        const timeout = setTimeout(performSearch, 300);
        return () => clearTimeout(timeout);
    }, [commandSearchQuery, commandPaletteOpen]);

    const handleCommandSelect = (item) => {
        if (item.type === 'diagnosis') {
            handleAddICD10(item.source, true);
        } else if (item.type === 'order') {
            handleOrderSelect(item.source);
        }
        setCommandPaletteOpen(false);
        setCommandSearchQuery('');
    };

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
        if (typeof text !== 'string') return String(text || '');
        let str = text;
        if (typeof document !== 'undefined') {
            const txt = document.createElement('textarea');
            for (let i = 0; i < 4; i++) {
                const prev = str;
                txt.innerHTML = str;
                str = txt.value;
                // Aggressively handle slashes and other common entities
                str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/').replace(/&sol;/g, '/').replace(/&amp;/g, '&');
                if (str === prev) break;
            }
        } else {
            str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/ig, '/');
        }
        return str;
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
        const planMatch = safeDecodedText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|CP|Follow Up|FU):|$)/is);

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
        let currentMDM = null;
        let currentInstructions = null;

        const finalizePrev = () => {
            if (currentDiagnosis) {
                structured.push({
                    diagnosis: currentDiagnosis,
                    orders: [...currentOrders],
                    mdm: currentMDM
                });
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const safeLine = typeof line === 'string' ? line : String(line || '');
            const diagnosisMatch = safeLine.match(/^(\d+)\.\s*(.+)$/);

            if (diagnosisMatch) {
                finalizePrev();
                currentDiagnosis = diagnosisMatch[2].trim();
                currentOrders = [];
                currentMDM = null;
            } else if (line.startsWith('MDM:')) {
                currentMDM = line.replace(/^MDM:\s*/, '').trim();
            } else if (line.startsWith('•') || line.startsWith('-')) {
                const orderText = line.replace(/^[•\-]\s*/, '').trim();
                if (orderText && currentDiagnosis) {
                    currentOrders.push(orderText);
                }
            } else if (line && currentDiagnosis) {
                currentOrders.push(line);
            }
        }
        finalizePrev();
        return structured;
    };

    const formatPlanText = (structuredPlan) => {
        if (!structuredPlan || structuredPlan.length === 0) return '';
        return structuredPlan.map((item, index) => {
            const lines = [`${index + 1}. ${item.diagnosis}`];
            item.orders.forEach(order => lines.push(`  • ${order}`));
            if (item.mdm) lines.push(`MDM: ${item.mdm}`);
            return lines.join('\n');
        }).join('\n\n');
    };

    const combineNoteSections = (sourceData = noteData) => {
        const sections = [];
        if (sourceData.chiefComplaint) sections.push(`Chief Complaint: ${sourceData.chiefComplaint}`);
        if (sourceData.hpi) sections.push(`HPI: ${sourceData.hpi}`);

        // ROS - use rosNotes directly (ros checkbox object may not exist)
        if (sourceData.rosNotes) {
            sections.push(`Review of Systems: ${sourceData.rosNotes}`);
        }

        // PE - use peNotes directly (pe checkbox object may not exist)
        if (sourceData.peNotes) {
            sections.push(`Physical Exam: ${sourceData.peNotes}`);
        }

        if (sourceData.results) {
            sections.push(`Results: ${sourceData.results}`);
        }

        if (sourceData.assessment) sections.push(`Assessment: ${sourceData.assessment}`);

        // Use structured plan if available, otherwise use plain plan text
        let planText = '';
        if (sourceData.planStructured && sourceData.planStructured.length > 0) {
            planText = formatPlanText(sourceData.planStructured);
        } else if (sourceData.plan) {
            planText = sourceData.plan;
        }
        if (planText) sections.push(`Plan: ${planText}`);

        if (sourceData.carePlan) sections.push(`Care Plan: ${sourceData.carePlan}`);
        if (sourceData.followUp) sections.push(`Follow Up: ${sourceData.followUp}`);

        const combined = sections.join('\n\n');
        console.log('Combined note sections length:', combined.length);
        return combined;
    };

    // Load Quick Actions (Favorites/Macros)
    const fetchQuickActions = useCallback(async () => {
        try {
            const [ordersRes, macrosRes] = await Promise.all([
                ordersCatalogAPI.getFavorites(),
                macrosAPI.getAll({ category: 'Sidebar' })
            ]);

            let orders = ordersRes.data || [];
            if (orders.length === 0) {
                orders = [
                    { name: '12-Lead EKG', type: 'PROCEDURE', loinc_code: '93000' },
                    { name: 'Echo Complete', type: 'IMAGING', loinc_code: '93306' },
                    { name: 'Stress Test', type: 'PROCEDURE', loinc_code: '93015' },
                    { name: 'CMP', type: 'LAB', loinc_code: '80053' },
                    { name: 'CBC', type: 'LAB', loinc_code: '85025' }
                ];
            }
            setQuickOrdersList(orders);

            let macros = macrosRes.data || [];
            if (macros.length === 0) {
                macros = [
                    { shortcut_code: '.cp_typical', template_text: hpiDotPhrases['.cp_typical'] },
                    { shortcut_code: '.sob_exertional', template_text: hpiDotPhrases['.sob_exertional'] },
                    { shortcut_code: '.htn_followup', template_text: hpiDotPhrases['.htn_followup'] }
                ];
            }
            setSidebarMacrosList(macros);
        } catch (error) {
            console.error('Failed to fetch quick actions:', error);
        }
    }, []);

    const refreshPatientData = useCallback(async () => {
        if (!id) return;
        try {
            const [problemsRes, medsRes, famRes, surgRes, socRes] = await Promise.all([
                patientsAPI.getProblems(id),
                patientsAPI.getMedications(id),
                patientsAPI.getFamilyHistory(id),
                patientsAPI.getSurgicalHistory(id),
                patientsAPI.getSocialHistory(id)
            ]);

            setFamilyHistory(famRes.data || []);
            setSurgicalHistory(surgRes.data || []);
            setSocialHistory(socRes.data || {});

            const snapshotRes = await patientsAPI.getSnapshot(id);
            const data = snapshotRes.data;
            if (data) {
                data.problems = problemsRes.data || [];
                data.medications = medsRes.data || [];
                setPatientData(data);
            }
        } catch (error) {
            console.error('Error refreshing patient data:', error);
        }
    }, [id]);

    useEffect(() => {
        fetchQuickActions();
    }, [fetchQuickActions]);

    // Listen for Eko AI writing into this note
    useEffect(() => {
        const handleEkoNoteUpdate = async (e) => {
            const { visitId } = e.detail || {};
            if (!visitId || visitId !== currentVisitId) return;

            console.log('[VisitNote] Eko wrote to note, reloading...', visitId);
            try {
                const response = await visitsAPI.get(visitId);
                const visit = response.data;
                if (visit?.note_draft) {
                    const parsed = parseNoteText(visit.note_draft);
                    const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                    setNoteData(prev => ({
                        ...prev,
                        ...parsed,
                        planStructured: planStructured.length > 0 ? planStructured : prev.planStructured
                    }));
                    showToast('Eko inserted content into your note', 'success');
                }
            } catch (err) {
                console.error('[VisitNote] Failed to reload after Eko update:', err);
            }
        };

        window.addEventListener('eko-note-updated', handleEkoNoteUpdate);
        return () => window.removeEventListener('eko-note-updated', handleEkoNoteUpdate);
    }, [currentVisitId, parseNoteText, showToast]);

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

            // Fetch History Data
            refreshPatientData();

            const handlePatientDataUpdate = () => refreshPatientData();

            window.addEventListener('patient-data-updated', handlePatientDataUpdate);
            return () => {
                window.removeEventListener('patient-data-updated', handlePatientDataUpdate);
            };
        }
    }, [id, refreshPatientData]);

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
                            bp: decodeHtmlEntities(v.bp) || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : ''),
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

            // *** CRITICAL: Universal Save Logic ***
            // Check refs as backup: even if isDirectEditing is false, if we have active content in refs, we must save it.
            const hasActiveRefs = !!(hpiRef.current?.value || assessmentRef.current?.value || planRef.current?.value);

            if (isDirectEditing || hasActiveRefs) {
                // Cancel any pending auto-save to prevent race conditions
                if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                }

                // Gather latest values directly from refs to ensure we catch the very latest edits
                const latestData = { ...noteData };
                if (hpiRef.current) latestData.hpi = hpiRef.current.value;
                if (assessmentRef.current) latestData.assessment = assessmentRef.current.value;
                if (planRef.current) latestData.plan = planRef.current.value;

                const noteDraft = combineNoteSections(latestData);
                console.log('[Direct Edit] Saving note draft before cosign (from refs):', noteDraft); // DEBUG LOG

                // DEBUG ALERT REMOVED (Moved to top)

                const vitalsToSave = {
                    bloodPressure: vitals.bloodPressure || null,
                    pulse: vitals.pulse || null,
                    temperature: vitals.temperature || null,
                    respiratoryRate: vitals.respiratoryRate || null,
                    oxygenSaturation: vitals.oxygenSaturation || null,
                    weight: vitals.weight || null,
                    height: vitals.height || null,
                    bmi: vitals.bmi || null,
                    weightUnit: vitals.weightUnit || 'lbs',
                    heightUnit: vitals.heightUnit || 'in'
                };

                try {
                    await visitsAPI.update(visitId, { noteDraft, vitals: vitalsToSave });
                    console.log('[Direct Edit] Updated note successfully');
                } catch (updateErr) {
                    console.error('[Direct Edit] Failed to save note changes:', updateErr);
                    showToast('Warning: Could not save note edits. ' + (updateErr.response?.data?.error || updateErr.message), 'error');
                    alert('ERROR: Save failed! ' + (updateErr.response?.data?.error || updateErr.message));
                    setIsSaving(false);
                    return; // Stop cosign if save fails
                }
            }

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
        if (addToProblem || isAddingProblemFromSidebar) {
            try {
                await patientsAPI.addProblem(id, { problemName: code.description, icd10Code: code.code, status: 'active' });
                showToast(`Added ${code.code} to Chart`, 'success');
                refreshPatientData(); // Refresh sidebar list
                setIsAddingProblemFromSidebar(false);
                if (isAddingProblemFromSidebar) {
                    setShowICD10Modal(false);
                    return; // Don't add to note if just managing chart
                }
            } catch (error) {
                console.error('Error adding to chart:', error);
                showToast('Error adding to chart', 'error');
            }
        }

        if (editingDiagnosisIndex !== null) {
            // Replace existing diagnosis
            setNoteData(prev => {
                const lines = prev.assessment.split('\n').filter(l => l.trim());
                const oldName = lines[editingDiagnosisIndex];
                const newName = normalizeDiagnosis(`${code.code} - ${code.description}`);
                lines[editingDiagnosisIndex] = newName;

                // Sync Plan Structured
                let updatedPlanStructured = prev.planStructured || [];
                if (oldName && updatedPlanStructured.length > 0) {
                    const cleanOld = normalizeDiagnosis(oldName);
                    const matchIndex = updatedPlanStructured.findIndex(item => {
                        return normalizeDiagnosis(item.diagnosis) === cleanOld;
                    });
                    if (matchIndex !== -1) {
                        updatedPlanStructured = [...updatedPlanStructured];
                        updatedPlanStructured[matchIndex] = {
                            ...updatedPlanStructured[matchIndex],
                            diagnosis: normalizeDiagnosis(newName)
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
            // Add new diagnosis - check for duplicates first
            const cleanNewDx = normalizeDiagnosis(`${code.code} - ${code.description}`);
            const currentAssessments = noteData.assessment ? noteData.assessment.split('\n').filter(l => l.trim()) : [];
            const alreadyInAssessment = currentAssessments.some(line => {
                return normalizeDiagnosis(line).toLowerCase() === cleanNewDx.toLowerCase();
            });

            if (alreadyInAssessment) {
                showToast('This diagnosis is already in the assessment', 'info');
            } else {
                const newDx = cleanNewDx;
                const newAssessment = noteData.assessment
                    ? `${noteData.assessment}\n${currentAssessments.length + 1}. ${newDx}`
                    : `1. ${newDx}`;

                setNoteData(prev => {
                    const currentPlan = prev.planStructured || [];
                    const existsInPlan = currentPlan.some(item =>
                        item.diagnosis.replace(/^\d+[\.\)]?\s*/, '').trim().toLowerCase() === newDx.toLowerCase()
                    );

                    return {
                        ...prev,
                        assessment: newAssessment,
                        planStructured: existsInPlan ? prev.planStructured : [...currentPlan, { diagnosis: newDx, orders: [] }]
                    };
                });
            }
        }

        setShowIcd10Search(false);
        setIcd10Search('');
        setShowICD10Modal(false);
    };

    // Parse assessment to extract diagnoses - memoized to prevent infinite re-renders
    const diagnoses = useMemo(() => {
        if (!noteData.assessment) return [];
        const lines = noteData.assessment.split('\n').filter(line => line.trim());
        return lines.map(normalizeDiagnosis);
    }, [noteData.assessment]);

    // Ensure Plan stays in sync with Assessment (Diagnoses -> Plan Items)
    useEffect(() => {
        setNoteData(prev => {
            const currentPlan = prev.planStructured || [];
            let planUpdated = false;

            // 1. Process existing plan items
            const assessmentDiagsClean = diagnoses.map(d => normalizeDiagnosis(d).toLowerCase());
            let newPlan = [];
            let ordersToMove = [];

            currentPlan.forEach(item => {
                const cleanItemDx = normalizeDiagnosis(item.diagnosis).toLowerCase();
                const stillInAssessment = assessmentDiagsClean.includes(cleanItemDx);

                if (cleanItemDx === 'other' || cleanItemDx === 'unassigned') {
                    // Always keep unassigned/other groupings if they exist
                    newPlan.push(item);
                } else if (stillInAssessment) {
                    newPlan.push(item);
                } else {
                    // Diagnosis was removed!
                    if (item.orders && item.orders.length > 0) {
                        ordersToMove.push(...item.orders);
                    }
                    planUpdated = true;
                }
            });

            // 2. Add missing diagnoses from Assessment to Plan
            diagnoses.forEach(diag => {
                const cleanDiag = normalizeDiagnosis(diag);
                const exists = newPlan.some(item => {
                    return normalizeDiagnosis(item.diagnosis).toLowerCase() === cleanDiag.toLowerCase();
                });

                if (!exists && cleanDiag) {
                    newPlan.push({ diagnosis: cleanDiag, orders: [] });
                    planUpdated = true;
                }
            });

            // 3. Handle orphaned orders by moving them to "Other"
            if (ordersToMove.length > 0) {
                const otherIndex = newPlan.findIndex(p => normalizeDiagnosis(p.diagnosis).toLowerCase() === 'other');
                if (otherIndex !== -1) {
                    newPlan[otherIndex] = {
                        ...newPlan[otherIndex],
                        orders: [...newPlan[otherIndex].orders, ...ordersToMove]
                    };
                } else {
                    newPlan.push({ diagnosis: 'Other', orders: ordersToMove });
                }
                planUpdated = true;
            }

            if (planUpdated) {
                const formatted = formatPlanText(newPlan);
                return {
                    ...prev,
                    planStructured: newPlan,
                    plan: formatted
                };
            }
            return prev;
        });
    }, [diagnoses]);

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
        if (isAddingMedicationFromSidebar) {
            setIsAddingMedicationFromSidebar(false);
            refreshPatientData();
        }
        setNoteData(prev => {
            const formattedPlan = formatPlanText(updatedPlanStructured);
            const planDiagnoses = updatedPlanStructured
                .map(item => normalizeDiagnosis(item.diagnosis))
                .filter(d => d && d !== 'Unassigned');

            // Sync with Assessment
            let currentAssessment = prev.assessment || '';
            const existingDxLines = (currentAssessment.split('\n') || []).filter(l => l.trim()).map(l => l.trim());
            const existingDxClean = existingDxLines.map(l => normalizeDiagnosis(l).toLowerCase());

            let assessmentUpdated = false;
            let newAssessmentLines = [...existingDxLines];

            planDiagnoses.forEach(dx => {
                const cleanDxLower = dx.toLowerCase();
                if (!existingDxClean.includes(cleanDxLower)) {
                    newAssessmentLines.push(`${newAssessmentLines.length + 1}. ${dx}`);
                    existingDxClean.push(cleanDxLower);
                    assessmentUpdated = true;
                }
            });

            return {
                ...prev,
                planStructured: updatedPlanStructured,
                plan: formattedPlan,
                assessment: assessmentUpdated ? newAssessmentLines.join('\n') : prev.assessment
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
            const diagnosisToUseClean = normalizeDiagnosis(diagnosisToUse);
            const dxIndex = currentPlan.findIndex(p => normalizeDiagnosis(p.diagnosis).toLowerCase() === diagnosisToUseClean.toLowerCase());

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
            const existingDxClean = existingDxLines.map(l => normalizeDiagnosis(l).toLowerCase());

            let assessmentUpdated = false;
            let newAssessment = currentAssessment;

            if (diagnosisToUseClean !== 'Unassigned') {
                const alreadyTagged = existingDxClean.some(edx => edx === diagnosisToUseClean.toLowerCase());
                if (!alreadyTagged) {
                    const nextNum = existingDxLines.length + 1;
                    if (newAssessment && !newAssessment.endsWith('\n')) newAssessment += '\n';
                    newAssessment += `${nextNum}. ${diagnosisToUseClean}`;
                    assessmentUpdated = true;
                }
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

    const updatePlanDetails = (index, field, value) => {
        setNoteData(prev => {
            const updatedPlan = [...(prev.planStructured || [])];
            updatedPlan[index] = {
                ...updatedPlan[index],
                [field]: value
            };
            const formattedPlan = formatPlanText(updatedPlan);
            return {
                ...prev,
                planStructured: updatedPlan,
                plan: formattedPlan
            };
        });
    };

    const removeDiagnosisFromAssessment = (index) => {
        setNoteData(prev => {
            const lines = prev.assessment.split('\n').filter(l => l.trim());
            lines.splice(index, 1);

            // Note: Plan sync is now handled automatically by the useEffect[diagnoses]
            // which will detect the missing diagnosis and move orphaned orders to "Other".
            return {
                ...prev,
                assessment: lines.join('\n')
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

    const refineSectionWithAI = async (section, diagnosis = null, planIndex = null) => {
        if (!currentVisitId || isLocked) return;

        showToast(`AI is crafting ${section.toUpperCase()}...`, 'info', { duration: 3000 });

        try {
            const response = await api.post('/echo/refine-section', {
                visitId: currentVisitId,
                section,
                diagnosis
            });

            if (response.data.success && response.data.draftedText) {
                const draftedValue = response.data.draftedText;

                if (planIndex !== null && section === 'mdm') {
                    updatePlanDetails(planIndex, 'mdm', draftedValue);
                } else if (section === 'hpi') {
                    handleTextChange(draftedValue, 'hpi');
                    setNoteData(prev => ({ ...prev, hpi: draftedValue }));
                } else if (section === 'ros') {
                    handleTextChange(draftedValue, 'rosNotes');
                    setNoteData(prev => ({ ...prev, rosNotes: draftedValue }));
                } else if (section === 'pe') {
                    handleTextChange(draftedValue, 'peNotes');
                    setNoteData(prev => ({ ...prev, peNotes: draftedValue }));
                } else if (section === 'assessment') {
                    handleTextChange(draftedValue, 'assessment');
                    setNoteData(prev => ({ ...prev, assessment: draftedValue }));
                } else if (section === 'pamfos') {
                    // Logic for history sections could be more complex, but we'll put it in summary for now
                    handleTextChange(draftedValue, 'chiefComplaint'); // Or a general summary field
                }

                showToast(`AI successfully ${diagnosis ? `drafted MDM for ${diagnosis}` : `updated ${section.toUpperCase()}`}`, 'success');
            }
        } catch (err) {
            console.error('Refine error:', err);
            showToast('AI failed to refine this section. Ensure you have transcribed audio first.', 'error');
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

    // Fetch history for Chart Review Modal
    useEffect(() => {
        const fetchHistory = async () => {
            if (!id) return;
            setChartReviewData(prev => ({ ...prev, loading: true }));
            try {
                const response = await visitsAPI.getByPatient(id);
                setChartReviewData({ visits: response.data || [], loading: false });
            } catch (error) {
                console.error('Error fetching history for chart review:', error);
                setChartReviewData({ visits: [], loading: false });
            }
        };
        fetchHistory();
    }, [id]);

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
        const diagText = normalizeDiagnosis(problem.icd10_code
            ? `${problem.icd10_code} - ${problem.problem_name}`
            : problem.problem_name);

        // Check if already in assessment with robust comparison
        const cleanDiag = diagText.toLowerCase();
        const alreadyInAssessment = diagnoses.some(d => {
            return d.toLowerCase() === cleanDiag;
        });

        if (alreadyInAssessment) {
            showToast('This diagnosis is already in the assessment', 'info');
            return;
        }

        const newAssessment = noteData.assessment
            ? `${noteData.assessment}\n${diagnoses.length + 1}. ${diagText}`
            : `1. ${diagText}`;

        setNoteData(prev => {
            const currentPlan = prev.planStructured || [];
            const cleanDx = diagText;
            const existsInPlan = currentPlan.some(item =>
                normalizeDiagnosis(item.diagnosis).toLowerCase() === cleanDx.toLowerCase()
            );

            return {
                ...prev,
                assessment: newAssessment,
                planStructured: existsInPlan ? prev.planStructured : [...(prev.planStructured || []), { diagnosis: cleanDx, orders: [] }]
            };
        });

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

        // Use standard normalization
        const cleanDiagnosis = normalizeDiagnosis(diagnosisText);
        let targetIndex = -1;

        if (noteData.planStructured) {
            targetIndex = noteData.planStructured.findIndex(item =>
                normalizeDiagnosis(item.diagnosis).toLowerCase() === cleanDiagnosis.toLowerCase()
            );
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

    const quickOrders = quickOrdersList;

    const sidebarMacros = sidebarMacrosList;

    // Quick Actions Logic
    const handleQuickOrderClick = (order) => {
        if (diagnoses.length > 1) {
            setPendingQuickAction({ item: order, type: 'order' });
            setShowQuickActionDxModal(true);
        } else {
            const dx = diagnoses[0] || 'Unassigned';
            handleOrderSelect(order, dx);
        }
    };

    const handleQuickMacroClick = (macro) => {
        if (diagnoses.length > 1) {
            setPendingQuickAction({ item: macro, type: 'macro' });
            setShowQuickActionDxModal(true);
        } else {
            insertHpiTemplate(macro.shortcut_code || macro.key, macro.template_text || macro.text);
        }
    };

    const handleQuickActionDxSelect = (dx) => {
        if (!pendingQuickAction) return;

        if (pendingQuickAction.type === 'order') {
            handleOrderSelect(pendingQuickAction.item, dx);
        } else {
            const macro = pendingQuickAction.item;
            insertHpiTemplate(macro.shortcut_code || macro.key, macro.template_text || macro.text);
        }

        setShowQuickActionDxModal(false);
        setPendingQuickAction(null);
    };

    const addFavoriteOrder = async (order) => {
        try {
            if (order.catalog_id) {
                await ordersCatalogAPI.addFavorite(order.catalog_id);
            }
            await fetchQuickActions();
            showToast('Added to Favorite Orders', 'success');
        } catch (error) {
            console.error('Failed to add favorite order:', error);
        }
    };

    const deleteFavoriteOrder = async (order) => {
        try {
            if (order.catalog_id) {
                await ordersCatalogAPI.removeFavorite(order.catalog_id);
            } else {
                setQuickOrdersList(prev => prev.filter(o => o.name !== order.name));
            }
            await fetchQuickActions();
            showToast('Order removed from favorites', 'info');
        } catch (error) {
            console.error('Failed to delete favorite order:', error);
        }
    };

    const addSidebarMacro = async (macroData) => {
        try {
            await macrosAPI.create({ ...macroData, category: 'Sidebar' });
            await fetchQuickActions();
            setShowMacroAddModal(false);
            setNewMacroData({ shortcut_code: '', template_text: '' });
            showToast('Macro added to sidebar', 'success');
        } catch (error) {
            console.error('Failed to add macro:', error);
            showToast('Failed to add macro', 'error');
        }
    };

    const deleteSidebarMacro = async (macroId) => {
        if (!confirm('Are you sure you want to delete this macro?')) return;
        try {
            await macrosAPI.delete(macroId);
            await fetchQuickActions();
            showToast('Macro removed', 'info');
        } catch (error) {
            console.error('Failed to delete macro:', error);
        }
    };

    const deleteProblemFromChart = async (problemId) => {
        if (!confirm('Permanently delete this problem from the patient chart?')) return;
        try {
            await patientsAPI.deleteProblem(problemId);
            showToast('Problem deleted', 'success');
            refreshPatientData();
        } catch (error) {
            console.error('Failed to delete problem:', error);
        }
    };

    const deleteMedicationFromChart = async (medId) => {
        if (!confirm('Permanently delete this medication from the patient record?')) return;
        try {
            await patientsAPI.deleteMedication(medId);
            showToast('Medication deleted', 'success');
            refreshPatientData();
        } catch (error) {
            console.error('Failed to delete medication:', error);
        }
    };

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
        <div className="vn-soft-ui min-h-screen pb-20">
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onSelect={handleCommandSelect}
                searchQuery={commandSearchQuery}
                setSearchQuery={setCommandSearchQuery}
                suggestions={commandSuggestions}
                isLoading={isCommandLoading}
            />

            <div className="w-full max-w-[1400px] mx-auto px-4 pt-6">
                <VisitNoteHeader
                    visitData={visitData}
                    visitType={visitType}
                    setVisitType={setVisitType}
                    isSigned={isSigned}
                    isPreliminary={isPreliminary}
                    isLocked={isLocked}
                    isRetracted={isRetracted}
                    isSaving={isSaving}
                    lastSaved={lastSaved}
                    handleSave={handleSave}
                    handleSign={handleSign}
                    setShowCosignModal={setShowCosignModal}
                    setShowPrintModal={setShowPrintModal}
                    setShowPrintOrdersModal={setShowPrintOrdersModal}
                    setShowChartReview={setShowChartReview}
                    showQuickActions={showQuickActions}
                    setShowQuickActions={setShowQuickActions}
                    setShowRetractModal={setShowRetractModal}
                    viewRetractedContent={viewRetractedContent}
                    setViewRetractedContent={setViewRetractedContent}
                    retractionInfo={retractionInfo}
                    isDirectEditing={isDirectEditing}
                    setIsDirectEditing={setIsDirectEditing}
                    handleCosign={handleCosign}
                    navigate={navigate}
                    id={id}
                    providerName={providerName}
                />

                {/* Multi-user Collision Warning */}
                {othersOnNote.length > 0 && (
                    <div className="bg-amber-500/10 backdrop-blur-sm border border-amber-200 p-4 rounded-3xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm">
                        <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-[11px] font-bold text-amber-900 uppercase tracking-widest leading-none mb-1">Concurrent Session Alert</h3>
                            <p className="text-xs text-amber-800 font-medium tracking-tight">
                                <span className="font-bold underline">{othersOnNote.join(', ')}</span> {othersOnNote.length === 1 ? 'is' : 'are'} currently working on this note. Your data may be compromised if you save simultaneously.
                            </p>
                        </div>
                    </div>
                )}

                <div className="vn-quick-bar-container">
                    <QuickNav
                        sections={[
                            { id: 'vitals', label: 'Vitals' },
                            { id: 'hpi', label: 'HPI' },
                            { id: 'ros-pe', label: 'ROS/PE' },
                            { id: 'pamfos', label: 'History' },
                            { id: 'results', label: 'Results' },
                            { id: 'assessment', label: 'Assessment' },
                            { id: 'plan', label: 'Plan' },
                        ]}
                    />
                </div>

                {/* Retraction Banner */}
                {isRetracted && (
                    <div className="bg-red-500/10 backdrop-blur-sm border border-red-200 p-5 rounded-3xl mb-8 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-200">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-red-900 uppercase tracking-widest">Retracted / Entered in Error</h3>
                                <p className="text-xs text-red-700 font-medium">
                                    Voided for clinical audit.
                                    {retractionInfo && ` (By ${retractionInfo.retracted_by_name} on ${format(new Date(retractionInfo.retracted_at), 'MM/dd/yyyy')})`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setViewRetractedContent(!viewRetractedContent)}
                            className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-bold border border-red-100 shadow-sm hover:bg-red-50 transition-all"
                        >
                            {viewRetractedContent ? 'Hide original content' : 'Review original content'}
                        </button>
                    </div>
                )}
                {/* Main Content with Optional Sidebar */}
                <div className={`flex gap-4 ${showQuickActions && !isLocked ? '' : ''}`}>
                    {/* Left: Main Note Content */}
                    <div className={`${showQuickActions && !isLocked ? 'flex-1' : 'w-full'} transition-all duration-300 ${isRetracted && !viewRetractedContent ? 'opacity-40 blur-[1px] pointer-events-none grayscale' : ''}`}>

                        {/* Vitals */}
                        <VisitNoteSection title="Vital Signs" defaultOpen={true} id="vitals">
                            <VitalsGrid vitals={vitals} setVitals={setVitals} isLocked={isLocked} isAbnormalVital={isAbnormalVital} calculateBMI={calculateBMI} heightRef={heightRef} systolicRef={systolicRef} diastolicRef={diastolicRef} pulseRef={pulseRef} o2satRef={o2satRef} tempRef={tempRef} weightRef={weightRef} hpiRef={hpiRef} previousWeight={previousWeight} getWeightChange={getWeightChange} />
                        </VisitNoteSection>

                        {/* Chief Complaint */}
                        <div className="mb-5">
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <label className="text-sm font-bold text-gray-800 uppercase tracking-widest">Chief Complaint</label>
                                {editedSections.has('chiefComplaint') && (
                                    <span className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-bold uppercase rounded-full shadow-sm shadow-blue-200 flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        Modified
                                    </span>
                                )}
                            </div>
                            <div className={`vn-card p-4 bg-white/50 border ${editedSections.has('chiefComplaint') ? 'border-primary-200 ring-4 ring-primary-50/30' : 'border-gray-100'} transition-all duration-300`}>
                                <input
                                    type="text"
                                    placeholder="Enter chief complaint..."
                                    value={noteData.chiefComplaint || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'chiefComplaint')}
                                    disabled={isLocked}
                                    className="vn-input px-3 text-base font-bold"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('hpi-textarea')?.focus();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* HPI */}
                        <VisitNoteSection
                            title="History of Present Illness (HPI)"
                            defaultOpen={true}
                            isEdited={editedSections.has('hpi')}
                            id="hpi"
                            onDraftWithAI={() => refineSectionWithAI('hpi')}
                        >
                            <div className="relative">
                                <span className="absolute -top-1.5 right-4 z-10 text-[9px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-slate-50 uppercase tracking-widest group-focus-within:text-primary-400 transition-colors">F2 for placeholders</span>
                                <textarea
                                    ref={hpiRef}
                                    value={noteData.hpi}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNoteData({ ...noteData, hpi: val });
                                        handleTextChange(val, 'hpi');
                                        handleDotPhraseAutocomplete(val, 'hpi', hpiRef);
                                    }}
                                    disabled={isLocked}
                                    onKeyDown={(e) => {
                                        if (autocompleteState.show) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setAutocompleteState(prev => ({ ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1) }));
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setAutocompleteState(prev => ({ ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) }));
                                            } else if (e.key === 'Enter' || e.key === 'Tab') {
                                                if (autocompleteState.suggestions[autocompleteState.selectedIndex]) {
                                                    e.preventDefault();
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
                                    className="vn-textarea min-h-[180px] pt-4"
                                    placeholder="Describe the clinical history..."
                                />
                                {autocompleteState.show && autocompleteState.field === 'hpi' && autocompleteState.suggestions.length > 0 && (
                                    <div className="absolute z-50 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto mt-2 w-72" style={{ top: `${autocompleteState.position.top}px` }}>
                                        {autocompleteState.suggestions.map((item, index) => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => insertDotPhrase(item.key, autocompleteState)}
                                                className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-gray-50 transition-colors ${index === autocompleteState.selectedIndex ? 'bg-primary-50/50' : ''}`}
                                            >
                                                <div className="font-bold text-gray-900 text-xs tracking-tight mb-0.5">.{item.key}</div>
                                                <div className="text-[10px] text-gray-500 truncate font-medium">{item.template}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex items-center gap-4">
                                <button
                                    onClick={() => { setActiveTextArea('hpi'); setShowDotPhraseModal(true); }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-primary-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-50 transition-all border border-gray-100 hover:border-primary-100"
                                >
                                    <Zap className="w-4 h-4" />
                                    Templates
                                </button>
                                {!isLocked && (
                                    <button
                                        onClick={() => openCarryForward('hpi')}
                                        className="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-gray-800 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                        <History className="w-4 h-4" />
                                        Pull Prior
                                    </button>
                                )}
                            </div>
                        </VisitNoteSection>

                        {/* ROS and PE Side by Side */}
                        <div id="ros-pe" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 scroll-mt-32">
                            {/* ROS */}
                            <VisitNoteSection
                                title="Review of Systems"
                                defaultOpen={true}
                                id="ros"
                                onDraftWithAI={() => refineSectionWithAI('ros')}
                            >
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {Object.keys(noteData.ros).map(system => {
                                        const isSelected = noteData.ros[system];
                                        return (
                                            <button
                                                key={system}
                                                onClick={() => {
                                                    if (isLocked) return;
                                                    const isChecked = !noteData.ros[system];
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
                                                className={`
                                                    relative px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-1.5
                                                    ${isSelected
                                                        ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-100 translate-y-[-1px]'
                                                        : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:shadow-sm'
                                                    }
                                                `}
                                            >
                                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                                {system}
                                            </button>
                                        );
                                    })}
                                </div>
                                <textarea
                                    value={noteData.rosNotes}
                                    onChange={(e) => handleTextChange(e.target.value, 'rosNotes')}
                                    disabled={isLocked}
                                    rows={6}
                                    className="vn-textarea text-xs min-h-[100px]"
                                    placeholder="Abnormal findings in ROS..."
                                />
                                <div className="mt-4 flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            const allRos = {};
                                            Object.keys(noteData.ros).forEach(key => { allRos[key] = true; });
                                            let rosText = '';
                                            Object.keys(rosFindings).forEach(key => {
                                                const systemName = key.charAt(0).toUpperCase() + key.slice(1);
                                                rosText += `**${systemName}:** ${rosFindings[key]}\n`;
                                            });
                                            setNoteData({ ...noteData, ros: allRos, rosNotes: rosText.trim() });
                                        }}
                                        disabled={isLocked}
                                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[10px] font-bold uppercase tracking-wider"
                                    >
                                        Pre-fill Normal
                                    </button>
                                    {!isLocked && (
                                        <button
                                            onClick={() => openCarryForward('ros')}
                                            className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-50 transition-all text-[10px] font-bold uppercase tracking-wider"
                                        >
                                            Pull Prior
                                        </button>
                                    )}
                                </div>
                            </VisitNoteSection>

                            {/* Physical Exam */}
                            <VisitNoteSection
                                title="Physical Examination"
                                defaultOpen={true}
                                id="pe"
                                onDraftWithAI={() => refineSectionWithAI('pe')}
                            >
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {Object.keys(noteData.pe).map(system => {
                                        const isSelected = noteData.pe[system];
                                        return (
                                            <button
                                                key={system}
                                                onClick={() => {
                                                    if (isLocked) return;
                                                    const isChecked = !noteData.pe[system];
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
                                                className={`
                                                    relative px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-1.5
                                                    ${isSelected
                                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-100 translate-y-[-1px]'
                                                        : 'bg-white text-gray-400 border-gray-100 hover:border-emerald-200 hover:text-emerald-600 hover:shadow-sm'
                                                    }
                                                `}
                                            >
                                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                                {system.replace(/([A-Z])/g, ' $1').trim()}
                                            </button>
                                        );
                                    })}
                                </div>
                                <textarea
                                    value={noteData.peNotes}
                                    onChange={(e) => handleTextChange(e.target.value, 'peNotes')}
                                    disabled={isLocked}
                                    rows={6}
                                    className="vn-textarea text-xs min-h-[100px]"
                                    placeholder="Abnormal findings in exam..."
                                />
                                <div className="mt-4 flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            const allPe = {};
                                            Object.keys(noteData.pe).forEach(key => { allPe[key] = true; });
                                            let peText = '';
                                            Object.keys(peFindings).forEach(key => {
                                                const systemName = key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                                peText += `**${systemName}:** ${peFindings[key]}\n`;
                                            });
                                            setNoteData({ ...noteData, pe: allPe, peNotes: peText.trim() });
                                        }}
                                        disabled={isLocked}
                                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[10px] font-bold uppercase tracking-wider"
                                    >
                                        Pre-fill Normal
                                    </button>
                                    {!isLocked && (
                                        <button
                                            onClick={() => openCarryForward('pe')}
                                            className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-50 transition-all text-[10px] font-bold uppercase tracking-wider"
                                        >
                                            Pull Prior
                                        </button>
                                    )}
                                </div>
                            </VisitNoteSection>
                        </div>


                        {/* PAMFOS Section - Past Medical, Allergies, Meds, Family, Social/Other */}
                        <VisitNoteSection
                            title="Patient History (PAMFOS)"
                            defaultOpen={false}
                            id="pamfos"
                            badge={(patientData?.problems?.length || 0) + (patientData?.medications?.length || 0) + (patientData?.allergies?.length || 0)}
                            onDraftWithAI={() => refineSectionWithAI('pamfos')}
                        >
                            <div className="space-y-8 py-2">
                                {/* P - Past Medical History */}
                                <HistoryList
                                    title="Past Medical History"
                                    icon={<Activity className="w-4 h-4 text-rose-500" />}
                                    items={patientData?.problems || []}
                                    emptyMessage="No active problems"
                                    renderItem={(problem) => (
                                        <div className="flex justify-between items-start w-full group/item">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-gray-800 text-sm leading-tight">
                                                    {(problem.problem_name || '')
                                                        .replace(/^(\d+(\.\d+)*\.?\s*)+/, '')
                                                        .replace(/&amp;/g, '&')
                                                        .replace(/&#x2f;/gi, '/')
                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                </span>
                                                {problem.icd10_code && <span className="text-[10px] font-bold text-gray-400 tracking-wider">ICD-10: {problem.icd10_code}</span>}
                                            </div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border ${problem.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                                }`}>
                                                {problem.status}
                                            </span>
                                        </div>
                                    )}
                                    renderInput={(props) => <ProblemInput {...props} />}
                                    onAdd={async (data) => {
                                        // Check for duplicates in patient chart
                                        const cleanNewName = (data.problem_name || '').toLowerCase().trim();
                                        const isDuplicate = (patientData?.problems || []).some(p => {
                                            const cleanExisting = (p.problem_name || '').toLowerCase().trim();
                                            return cleanExisting === cleanNewName;
                                        });

                                        if (isDuplicate) {
                                            showToast('This diagnosis already exists in the Problem List', 'info');
                                            return;
                                        }

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
                                    icon={<Activity className="w-4 h-4 text-orange-500" />}
                                    items={patientData?.allergies || []}
                                    emptyMessage="No known allergies"
                                    renderItem={(allergy) => (
                                        <div className="flex justify-between items-start w-full">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-red-600 text-sm leading-tight">{allergy.allergen}</span>
                                                {allergy.reaction && <span className="text-[10px] text-gray-500 font-medium">Reaction: {allergy.reaction}</span>}
                                            </div>
                                            {allergy.severity && allergy.severity !== 'unknown' && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest bg-red-50 text-red-600 border border-red-100">
                                                    {allergy.severity}
                                                </span>
                                            )}
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
                                    icon={<Pill className="w-4 h-4 text-blue-500" />}
                                    items={(patientData?.medications || []).filter(m => {
                                        if (m.active === false) return false;
                                        if (visitData?.visit_date) {
                                            const visitDate = new Date(visitData.visit_date);
                                            visitDate.setHours(0, 0, 0, 0);
                                            if (m.start_date) {
                                                const medStartDate = new Date(m.start_date);
                                                medStartDate.setHours(0, 0, 0, 0);
                                                return medStartDate <= visitDate;
                                            }
                                        }
                                        return true;
                                    })}
                                    emptyMessage="No active medications"
                                    renderItem={(med) => {
                                        const decodedName = (med.medication_name || '')
                                            .replace(/&amp;/g, '&')
                                            .replace(/&#x2f;/gi, '/')
                                            .replace(/&#47;/g, '/')
                                            .replace(/&quot;/g, '"')
                                            .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
                                        return (
                                            <div className="flex justify-between items-start w-full">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-gray-800 text-sm leading-tight">{decodedName}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium italic">
                                                        {[med.dosage, med.frequency, med.route].filter(Boolean).join(' • ')}
                                                    </span>
                                                </div>
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
                                            <span className="font-bold text-gray-800 text-sm">{hist.condition}</span>
                                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{hist.relationship}</span>
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
                                                <span className="font-bold text-gray-800 text-sm">{surg.procedure_name}</span>
                                                {surg.date && (
                                                    <span className="text-gray-400 text-[10px] ml-2 font-medium">
                                                        ({format(new Date(surg.date), 'MM/dd/yyyy')})
                                                    </span>
                                                )}
                                            </div>
                                            {surg.surgeon && <span className="text-[10px] text-gray-500 font-medium italic">{surg.surgeon}</span>}
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
                                <div className="vn-card overflow-hidden">
                                    <div className="flex items-center gap-2 px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                                        <UserCircle className="w-4 h-4 text-teal-600" />
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Social History</h4>
                                    </div>
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                        {/* Helper to transform and save social history */}
                                        {(() => {
                                            const saveSocialHistory = async (changes) => {
                                                try {
                                                    const updatedState = { ...socialHistory, ...changes };
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
                                                    showToast('Failed to update social history', 'error');
                                                }
                                            };

                                            return (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Smoking Status</label>
                                                        <select
                                                            className="vn-input px-3 !py-2 !text-xs !bg-gray-50 border-none rounded-xl"
                                                            value={socialHistory?.smoking_status || ''}
                                                            onChange={(e) => saveSocialHistory({ smoking_status: e.target.value })}
                                                        >
                                                            <option value="">Unknown</option>
                                                            <option value="Never smoker">Never smoker</option>
                                                            <option value="Former smoker">Former smoker</option>
                                                            <option value="Current smoker">Current smoker</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Alcohol Use</label>
                                                        <select
                                                            className="vn-input px-3 !py-2 !text-xs !bg-gray-50 border-none rounded-xl"
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
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Occupation</label>
                                                        <input
                                                            className="vn-input px-3 !py-2 !text-xs !bg-gray-50 border-none rounded-xl"
                                                            value={socialHistory?.occupation || ''}
                                                            placeholder="Occupation"
                                                            onBlur={(e) => saveSocialHistory({ occupation: e.target.value })}
                                                            onChange={(e) => setSocialHistory(prev => ({ ...prev, occupation: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1 md:col-span-2">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Exercise & Diet</label>
                                                        <input
                                                            className="vn-input px-3 !py-2 !text-xs !bg-gray-50 border-none rounded-xl"
                                                            value={socialHistory?.exercise_frequency || ''}
                                                            placeholder="Exercise & Diet Details"
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
                        </VisitNoteSection>

                        {/* Results / Data Section */}
                        <VisitNoteSection title="Results / Data" defaultOpen={true} id="results" badge={visitDocuments.length}>
                            {visitDocuments.length === 0 && (
                                <div className="py-12 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                                    <FilePlus className="w-10 h-10 mb-3 opacity-20" />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">No Results Linked</p>
                                </div>
                            )}

                            {visitDocuments.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {visitDocuments.map(doc => (
                                        <div key={doc.id} className="relative group bg-white border border-gray-100 p-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="rounded-xl overflow-hidden border border-slate-50/50">
                                                <ResultImage doc={doc} />
                                            </div>
                                            <div className="flex justify-between items-center mt-3 px-1">
                                                <div className="flex flex-col min-w-0">
                                                    <p className="text-xs font-bold text-gray-700 truncate">{doc.filename}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                                        {format(new Date(doc.created_at || new Date()), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Remove image from note?')) {
                                                            documentsAPI.update(doc.id, { visit_id: null })
                                                                .then(() => setVisitDocuments(prev => prev.filter(d => d.id !== doc.id)));
                                                        }
                                                    }}
                                                    className="p-2 bg-rose-50 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100"
                                                    title="Unlink from visit"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </VisitNoteSection>

                        <div className="mb-5">
                            {/* Assessment */}
                            <VisitNoteSection
                                title="Assessment"
                                defaultOpen={true}
                                isEdited={editedSections.has('assessment')}
                                id="assessment"
                                onDraftWithAI={() => refineSectionWithAI('assessment')}
                            >
                                {/* ICD-10 Search - Simple inline search */}
                                {hasPrivilege('search_icd10') && (
                                    <div className="mb-3 relative">
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                                            <input
                                                id="icd10-quick-search"
                                                type="text"
                                                placeholder={editingDiagnosisIndex !== null ? `Editing: ${diagnoses[editingDiagnosisIndex]}` : "Search ICD-10 diagnosis..."}
                                                value={icd10Search}
                                                onChange={(e) => {
                                                    setIcd10Search(e.target.value);
                                                    setShowIcd10Search(true);
                                                }}
                                                disabled={isLocked}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        // Assessment logic
                                                    }
                                                }}
                                                className="vn-input !pl-14 pr-10"
                                            />
                                            <button
                                                onClick={() => setShowICD10Modal(true)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                title="Advanced Search"
                                            >
                                                <Search className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {showIcd10Search && icd10Results.length > 0 && icd10Search.trim().length >= 2 && (
                                            <div className="absolute z-[100] mt-2 w-full border border-gray-200 rounded-2xl bg-white shadow-2xl max-h-80 overflow-y-auto py-2">
                                                {icd10Results.map((code) => (
                                                    <button
                                                        key={code.id || code.code}
                                                        onClick={() => {
                                                            handleAddICD10(code, false);
                                                            setIcd10Search('');
                                                            setIcd10Results([]);
                                                            setShowIcd10Search(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-gray-50 transition-colors group"
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-primary-600 text-xs tracking-tight">{code.code}</span>
                                                            {!code.is_billable && (
                                                                <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-100 uppercase tracking-widest">Non-Billable</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-600 leading-relaxed line-clamp-2 font-medium">{code.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {showIcd10Search && icd10Results.length === 0 && icd10Search.trim().length >= 2 && (
                                            <div className="mt-2 border border-gray-100 rounded-2xl bg-white p-4 text-center">
                                                <p className="text-xs text-gray-400 font-medium italic">No codes found for "{icd10Search}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!isSigned && diagnoses.length > 0 && (
                                    <div className="mt-2 divide-y divide-gray-100/50">
                                        {diagnoses.map((diag, idx) => (
                                            <div key={idx} className="vn-list-item-compact group">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}.</span>
                                                    <button
                                                        onClick={() => {
                                                            setEditingDiagnosisIndex(idx);
                                                            setShowICD10Modal(true);
                                                        }}
                                                        className="vn-link-diagnosis text-left"
                                                    >
                                                        {diag.replace(/^\d+[\.\)]?\s*/, '')}
                                                    </button>
                                                </div>
                                                {!isLocked && (
                                                    <button
                                                        onClick={() => removeDiagnosisFromAssessment(idx)}
                                                        className="p-1 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </VisitNoteSection>
                        </div>

                        {/* Plan */}
                        <VisitNoteSection
                            title="Plan"
                            defaultOpen={true}
                            isEdited={editedSections.has('plan')}
                            id="plan"
                            className="z-10 relative"
                        >
                            <div className="relative">
                                {!isSigned && noteData.planStructured && noteData.planStructured.length > 0 && (
                                    <div className="space-y-4 px-1">
                                        {noteData.planStructured.map((item, index) => (
                                            <div key={index} className="group">
                                                {/* Diagnosis Link Row */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-bold text-gray-400 w-4">{index + 1}.</span>
                                                        <span
                                                            className="vn-link-diagnosis cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedDiagnosis(item.diagnosis);
                                                                setShowOrderModal(true);
                                                            }}
                                                        >
                                                            {item.diagnosis.replace(/^\d+[\.\)]?\s*/, '')}
                                                        </span>
                                                        <span
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDiagnosis(item.diagnosis);
                                                                setShowOrderModal(true);
                                                            }}
                                                            className="vn-add-order-link"
                                                        >
                                                            + Add Order
                                                        </span>
                                                    </div>
                                                    {!isLocked && (
                                                        <button
                                                            onClick={() => removeFromPlan(index)}
                                                            className="p-1 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Remove Diagnosis"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Orders List beneath the diagnosis */}
                                                <div className="mt-1">
                                                    {item.orders.length === 0 ? (
                                                        <p className="vn-order-item-compact border-dashed border-l border-gray-100 text-gray-400 italic">No orders pending</p>
                                                    ) : (
                                                        <div className="space-y-0.5">
                                                            {item.orders.flatMap((order, orderIdx) => {
                                                                const orderParts = (typeof order === 'string' ? order : '').split(';').map(part => part.trim()).filter(Boolean);
                                                                return orderParts.map((part, partIdx) => (
                                                                    <div key={`${orderIdx}-${partIdx}`} className="vn-order-item-compact group/order">
                                                                        <span className="leading-tight">{part}</span>
                                                                        {!isLocked && (
                                                                            <button
                                                                                onClick={() => removeFromPlan(index, orderIdx)}
                                                                                className="opacity-0 group-hover/order:opacity-100 p-0.5 text-gray-400 hover:text-rose-500 transition-all"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ));
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* MDM & Plan for each diagnosis - NOW BELOW ORDERS */}
                                                {!isLocked ? (
                                                    <div className="mt-4 mb-4 space-y-4 pl-4 border-l-2 border-primary-50 px-1 py-1">
                                                        <div className="group/mdm relative">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1 bg-blue-50 rounded-md">
                                                                        <Sparkles className="w-3 h-3 text-blue-500" />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Clinical Logic (MDM)</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => refineSectionWithAI('mdm', item.diagnosis, index)}
                                                                    className="p-1 text-primary-500 hover:bg-primary-50 rounded-md transition-all flex items-center gap-1 border border-primary-100/50 bg-white"
                                                                    title="Draft MDM with AI"
                                                                >
                                                                    <Sparkles className="w-2.5 h-2.5" />
                                                                    <span className="text-[9px] font-bold uppercase">AI Draft</span>
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                value={item.mdm || ''}
                                                                onChange={(e) => updatePlanDetails(index, 'mdm', e.target.value)}
                                                                placeholder="Add clinical reasoning for billing justification..."
                                                                className="w-full bg-blue-50/10 border border-blue-100/30 rounded-xl p-3 text-[13px] italic text-gray-700 outline-none focus:border-blue-400 focus:bg-blue-50/20 transition-all min-h-[60px] shadow-sm placeholder:text-gray-300"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    item.mdm && (
                                                        <div className="mt-3 mb-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 shadow-sm shadow-blue-50/50">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Clinical Logic (MDM)</span>
                                                                </div>
                                                                <p className="text-[13px] text-gray-700 leading-relaxed font-medium italic">"{item.mdm}"</p>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isSigned && (
                                    <div className="vn-card p-5 bg-gray-50/50 text-sm leading-relaxed text-gray-700 font-medium">
                                        <PlanDisplayLegacy plan={noteData.plan} />
                                    </div>
                                )}

                                {autocompleteState.show && autocompleteState.field === 'plan' && autocompleteState.suggestions.length > 0 && (
                                    <div className="absolute z-50 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto mt-2 w-72" style={{ top: `${autocompleteState.position.top}px` }}>
                                        {autocompleteState.suggestions.map((item, index) => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => insertDotPhrase(item.key, autocompleteState)}
                                                className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-gray-50 transition-colors ${index === autocompleteState.selectedIndex ? 'bg-primary-50/50' : ''}`}
                                            >
                                                <div className="font-bold text-gray-900 text-xs tracking-tight mb-0.5">.{item.key}</div>
                                                <div className="text-[10px] text-gray-500 truncate font-medium">{item.template}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isLocked && (
                                <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-gray-100">
                                    {hasPrivilege('order_labs') && (
                                        <button
                                            onClick={() => {
                                                setOrderModalTab('labs');
                                                setShowOrderModal(true);
                                            }}
                                            className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-slate-200 flex items-center gap-2"
                                        >
                                            <FlaskConical className="w-4 h-4" />
                                            Order Labs
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setOrderModalTab('medications');
                                            setShowOrderModal(true);
                                        }}
                                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Pill className="w-4 h-4 text-blue-500" />
                                        Prescribe Rx
                                    </button>
                                    {hasPrivilege('create_referrals') && (
                                        <button
                                            onClick={() => {
                                                setOrderModalTab('referrals');
                                                setShowOrderModal(true);
                                            }}
                                            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <Share2 className="w-4 h-4 text-purple-500" />
                                            Referral
                                        </button>
                                    )}
                                </div>
                            )}
                        </VisitNoteSection>

                        <div className="mb-5">
                            {/* Care Plan */}
                            <VisitNoteSection title="Care Plan" defaultOpen={true} isEdited={editedSections.has('carePlan')}>
                                <textarea
                                    value={noteData.carePlan || ''}
                                    onChange={(e) => handleTextChange(e.target.value, 'carePlan')}
                                    placeholder="Next steps, coordination of care, patient goals..."
                                    className="vn-textarea min-h-[120px]"
                                    disabled={isLocked}
                                />
                            </VisitNoteSection>
                        </div>

                        {/* Follow Up */}
                        <VisitNoteSection title="Follow Up" defaultOpen={true}>
                            <div className="space-y-4">
                                <textarea
                                    value={noteData.followUp || ''}
                                    onChange={(e) => setNoteData({ ...noteData, followUp: e.target.value })}
                                    placeholder="Return for follow up in..."
                                    className="vn-textarea min-h-[80px]"
                                    disabled={isLocked}
                                />
                                {!isSigned && (
                                    <div className="flex flex-wrap gap-2">
                                        {['1 Week', '2 Weeks', '1 Month', '3 Months', '6 Months', '1 Year', 'PRN'].map((duration) => (
                                            <button
                                                key={duration}
                                                onClick={() => setNoteData({ ...noteData, followUp: duration })}
                                                className="px-4 py-2 bg-gray-50 hover:bg-gray-50 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-gray-100"
                                            >
                                                {duration}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </VisitNoteSection>

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
                            <div className="mt-10 pt-8 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-5 py-2.5 bg-primary-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-200 flex items-center gap-2 min-w-[120px] justify-center"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{isSaving ? 'Saving...' : 'Save Progress'}</span>
                                    </button>
                                    <button
                                        onClick={handleSign}
                                        className="px-5 py-2.5 bg-gray-800 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-md shadow-slate-200 flex items-center gap-2 min-w-[120px] justify-center"
                                    >
                                        <Lock className="w-4 h-4" />
                                        <span>Sign Note</span>
                                    </button>
                                    {lastSaved && (
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
                                            Saved {lastSaved.toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleCreateSuperbill}
                                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                        title="Create/Open Commercial Superbill"
                                    >
                                        <DollarSign className="w-4 h-4" />
                                        <span>Superbill</span>
                                    </button>
                                    <button
                                        onClick={() => navigate(`/patient/${id}/snapshot`)}
                                        className="p-2.5 bg-white border border-gray-200 text-gray-500 hover:text-gray-800 rounded-2xl transition-all shadow-sm"
                                        title="Back to Patient Chart"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowPrintModal(true)}
                                        className="p-2.5 bg-white border border-gray-200 text-gray-500 hover:text-gray-800 rounded-2xl transition-all shadow-sm"
                                        title="Print"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-2xl transition-all shadow-sm border border-rose-100"
                                        title="Delete Note"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {isSigned && (
                            <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                    <button
                                        onClick={handleCreateSuperbill}
                                        className="px-2.5 py-1.5 bg-gray-100 text-white rounded-md shadow-sm flex items-center space-x-1.5 transition-all duration-200 hover:bg-gray-50 text-xs font-medium"
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
                    {
                        showQuickActions && !isSigned && (
                            <div className="w-72 flex-shrink-0 sticky top-4 h-fit z-10">
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    {/* Sidebar Header */}
                                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Quick Actions</span>
                                        <button onClick={() => setShowQuickActions(false)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                                            <X className="w-3.5 h-3.5 text-gray-500" />
                                        </button>
                                    </div>

                                    {/* Macros Section — TOP */}
                                    <div className="border-b border-gray-100">
                                        <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Macros</span>
                                            </div>
                                            <button
                                                onClick={() => setShowMacroAddModal(true)}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-amber-600 transition-colors"
                                                title="Create New Macro"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 max-h-36 overflow-y-auto custom-scrollbar">
                                            <div className="space-y-1">
                                                {sidebarMacros.map((m, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 group/macro">
                                                        <button
                                                            onClick={() => handleQuickMacroClick(m)}
                                                            className="flex-1 text-left px-2 py-1.5 text-[11px] bg-white hover:bg-amber-50 rounded border border-gray-100 hover:border-amber-200 transition-all flex items-center gap-1.5 group"
                                                        >
                                                            <Sparkles className="w-3 h-3 text-gray-400 group-hover:text-amber-500" />
                                                            <span className="text-gray-700 group-hover:text-amber-700 font-medium">
                                                                {m.shortcut_code || m.key}
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteSidebarMacro(m.id)}
                                                            className="px-1 text-gray-300 hover:text-rose-400 opacity-0 group-hover/macro:opacity-100 transition-all"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Problem List Section */}
                                    <div className="border-b border-gray-100">
                                        <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Problem List</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsAddingProblemFromSidebar(true);
                                                    setShowICD10Modal(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary-600 transition-colors"
                                                title="Add New Problem to Chart"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
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
                                                                <div key={idx} className="flex items-center gap-1 group/item">
                                                                    <button
                                                                        onClick={() => addProblemToAssessment(p)}
                                                                        className="flex-1 text-left px-2 py-1.5 text-[11px] bg-white hover:bg-primary-50 rounded border border-gray-100 hover:border-primary-200 transition-all flex items-center gap-1.5 group"
                                                                    >
                                                                        <Plus className="w-3 h-3 text-gray-400 group-hover:text-primary-600" />
                                                                        <span className="truncate flex-1 text-gray-700 group-hover:text-primary-700">
                                                                            {(p.problem_name || '').replace(/^[\d.\s]+/, '')}
                                                                        </span>
                                                                        {p.icd10_code && <span className="text-[9px] text-gray-400 font-mono">{p.icd10_code}</span>}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteProblemFromChart(p.id);
                                                                        }}
                                                                        className="p-1 text-gray-400 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                                                        title="Delete Problem from Chart"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ));
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-gray-400 italic text-center py-2">No active problems</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Medications Section */}
                                    <div className="border-b border-gray-100">
                                        <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Pill className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Medications</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsAddingMedicationFromSidebar(true);
                                                    setOrderModalTab('medications');
                                                    setShowOrderModal(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-emerald-600 transition-colors"
                                                title="Add New Medication to Chart"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {(patientData?.medications || []).filter(m => m.active !== false).length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {(patientData?.medications || []).filter(m => m.active !== false).slice(0, 8).map((m, idx) => (
                                                        <div key={idx} className="group/med border border-gray-100 rounded overflow-hidden">
                                                            <div className="p-2 bg-white relative">
                                                                <div className="text-[11px] font-medium text-gray-800 pr-5">
                                                                    {(m.medication_name || '')
                                                                        .replace(/&amp;/g, '&')
                                                                        .replace(/&#x2f;/gi, '/')
                                                                        .replace(/&#47;/g, '/')
                                                                        .replace(/&quot;/g, '"')
                                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                                </div>
                                                                <button
                                                                    onClick={() => deleteMedicationFromChart(m.id)}
                                                                    className="absolute top-1.5 right-1.5 p-1 text-gray-400 hover:text-rose-500 opacity-0 group-hover/med:opacity-100 transition-all"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                </button>
                                                                <div className="text-[9px] text-gray-500">{m.dosage} {m.frequency}</div>
                                                                <div className="flex gap-1 mt-1.5">
                                                                    <button onClick={() => addMedicationToPlan(m, 'continue')} className="flex-1 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors font-bold">
                                                                        Cont.
                                                                    </button>
                                                                    <button onClick={() => addMedicationToPlan(m, 'refill')} className="flex-1 py-0.5 text-[9px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors font-bold flex items-center justify-center gap-0.5">
                                                                        Refill
                                                                    </button>
                                                                    <button onClick={() => addMedicationToPlan(m, 'stop')} className="flex-1 py-0.5 text-[9px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors font-bold">
                                                                        Stop
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-gray-400 italic text-center py-2">No medications</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Orders Section */}
                                    <div className="border-b border-gray-100">
                                        <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Quick Orders</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setOrderPickerType('ALL');
                                                    setShowOrderPicker(true);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Browse & Add to Favorites"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            <div className="grid grid-cols-1 gap-1">
                                                {sidebarMacros.length > 0 && quickOrders.map((o, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 group/qorder">
                                                        <button
                                                            onClick={() => handleQuickOrderClick(o)}
                                                            className="flex-1 text-left px-2 py-1.5 bg-white hover:bg-blue-50 rounded border border-gray-100 hover:border-blue-200 transition-all flex items-center justify-between group"
                                                        >
                                                            <span className="text-[11px] text-gray-700 font-medium truncate">{o.name}</span>
                                                            <Plus className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteFavoriteOrder(o)}
                                                            className="px-1 text-gray-300 hover:text-rose-400 opacity-0 group-hover/qorder:opacity-100 transition-all"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>


                                    {/* Results Import Section */}
                                    <div>
                                        <div className="px-3 py-2 bg-gray-50/50">
                                            <div className="flex items-center gap-1.5">
                                                <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">Results</span>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    onClick={() => openResultImport('Labs')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-purple-50 rounded border border-gray-100 hover:border-purple-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <FlaskConical className="w-4 h-4 text-purple-500" />
                                                    <span className="text-gray-600">Labs</span>
                                                </button>
                                                <button
                                                    onClick={() => openResultImport('Imaging')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-blue-50 rounded border border-gray-100 hover:border-blue-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <FileImage className="w-4 h-4 text-blue-500" />
                                                    <span className="text-gray-600">Image</span>
                                                </button>
                                                <button
                                                    onClick={() => openResultImport('Echo')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-rose-50 rounded border border-gray-100 hover:border-rose-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <Heart className="w-4 h-4 text-rose-500" />
                                                    <span className="text-gray-600">Echo</span>
                                                </button>
                                                <button
                                                    onClick={() => openResultImport('EKG')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-rose-50 rounded border border-gray-100 hover:border-rose-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <Waves className="w-4 h-4 text-rose-500" />
                                                    <span className="text-gray-600">EKG</span>
                                                </button>
                                                <button
                                                    onClick={() => openResultImport('Cath')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-red-50 rounded border border-gray-100 hover:border-red-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <Stethoscope className="w-4 h-4 text-red-500" />
                                                    <span className="text-gray-600">Cath</span>
                                                </button>
                                                <button
                                                    onClick={() => openResultImport('Stress')}
                                                    className="px-2 py-2 text-[10px] bg-white hover:bg-orange-50 rounded border border-gray-100 hover:border-orange-200 transition-all flex flex-col items-center gap-1"
                                                >
                                                    <Activity className="w-4 h-4 text-orange-500" />
                                                    <span className="text-gray-600">Stress</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
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

                {
                    showOrderPicker && (
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
                    )
                }

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
                {
                    showDiagnosisLinkModal && (
                        <DiagnosisLinkModal
                            isOpen={showDiagnosisLinkModal}
                            onClose={() => setShowDiagnosisLinkModal(false)}
                            diagnoses={diagnoses}
                            onConfirm={(selectedDiagnoses) => {
                                if (pendingMedAction) {
                                    // Handle each selected diagnosis
                                    selectedDiagnoses.forEach(dx => handleMedicationDiagnosisSelect(dx));
                                }
                                setShowDiagnosisLinkModal(false);
                            }}
                        />
                    )
                }

                {
                    showCosignModal && (
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
                    )
                }

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
                {
                    showQuickActionDxModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-gray-50/40 backdrop-blur-sm">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-700">Link to Diagnosis</h3>
                                    <button onClick={() => setShowQuickActionDxModal(false)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4">
                                    <p className="text-xs text-gray-500 mb-4">Select a diagnosis to link this {pendingQuickAction?.type} to:</p>
                                    <div className="space-y-2">
                                        {diagnoses.map((dx, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleQuickActionDxSelect(dx)}
                                                className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-xs font-medium text-gray-700"
                                            >
                                                {dx}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    showMacroAddModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-gray-50/40 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                                <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">Create New Sidebar Macro</h3>
                                        <p className="text-xs text-gray-500">Add a custom dot-phrase to your quick actions</p>
                                    </div>
                                    <button onClick={() => setShowMacroAddModal(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Shortcut Code</label>
                                        <input
                                            type="text"
                                            value={newMacroData.shortcut_code}
                                            onChange={(e) => setNewMacroData(prev => ({ ...prev, shortcut_code: e.target.value }))}
                                            placeholder=".htn_fup"
                                            className="w-full px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Template Text Content</label>
                                        <textarea
                                            rows={6}
                                            value={newMacroData.template_text}
                                            onChange={(e) => setNewMacroData(prev => ({ ...prev, template_text: e.target.value }))}
                                            placeholder="Patient presents for follow-up of hypertension..."
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all text-sm font-medium resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => setShowMacroAddModal(false)}
                                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => addSidebarMacro(newMacroData)}
                                        disabled={!newMacroData.shortcut_code || !newMacroData.template_text}
                                        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary-600/20 transition-all"
                                    >
                                        Save Macro
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    showPrintOrdersModal && (
                        <PrintOrdersModal
                            patient={{ ...patientData, id }}
                            isOpen={showPrintOrdersModal}
                            onClose={() => setShowPrintOrdersModal(false)}
                        />
                    )
                }

                {/* Chart Review Modal - Note Focused */}
                {
                    showChartReview && (
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
                    )
                }

                {/* Carry Forward Modal */}
                {
                    showCarryForward && (
                        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowCarryForward(false)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                                {/* Header */}
                                <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-600 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <History className="w-5 h-5 text-white" />
                                        <h2 className="text-lg font-bold text-white">Pull from Previous Visit</h2>
                                        <span className="text-[11px] font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
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
                                        <div className="text-center py-12 text-gray-400">
                                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="text-sm font-medium">No previous visits with notes found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-xs text-gray-500 mb-4">
                                                Select a visit below to pull its <strong>{carryForwardField?.toUpperCase()}</strong> content into the current note.
                                            </p>
                                            {previousVisits.map((visit) => {
                                                const sectionContent = extractSectionFromNote(visit.note_draft, carryForwardField);
                                                const hasContent = sectionContent && sectionContent.trim().length > 0;

                                                return (
                                                    <div key={visit.id} className={`p-4 rounded-xl border transition-all ${hasContent ? 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-md cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-gray-900">
                                                                        {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                                                                    </span>
                                                                    {visit.locked && <Lock className="w-3 h-3 text-gray-400" />}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 uppercase font-medium">
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
                                                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                                                                    {carryForwardField?.toUpperCase()} Content
                                                                </div>
                                                                <div className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">
                                                                    {sectionContent}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-xs text-gray-400 italic">
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
                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                    <div className="text-xs text-gray-500">
                                        Content will replace the current {carryForwardField?.toUpperCase()} field
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >

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
        </div >
    );
};

export default VisitNote;
