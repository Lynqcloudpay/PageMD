import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    AlertCircle, Activity, Pill, FileText, Clock, Eye, ChevronDown, ChevronUp, ChevronRight, Plus,
    Phone, Mail, MapPin, CreditCard, Building2, Users, Heart, Printer, Scissors,
    CheckCircle2, Edit, ArrowRight, ExternalLink, UserCircle, Camera, User, X, FileImage, Save, FlaskConical, Database, Trash2, Upload, Layout, RotateCcw, Waves,
    Shield, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { visitsAPI, patientsAPI, ordersAPI, referralsAPI, documentsAPI, patientFlagsAPI } from '../services/api';
import { format } from 'date-fns';
import { showError, showSuccess } from '../utils/toast';
// GridLayout temporarily disabled to fix 500 error
// TODO: Re-enable with proper implementation
// import GridLayout from 'react-grid-layout';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
import PatientChartPanel from '../components/PatientChartPanel';
import ChartReviewModal from '../components/ChartReviewModal';
import VisitFoldersModal from '../components/VisitFoldersModal';
import VisitChartView from '../components/VisitChartView';
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import Modal from '../components/ui/Modal';
import { usePrivileges } from '../hooks/usePrivileges';
import CardiologyViewer from '../components/CardiologyViewer';
import PrintOrdersModal from '../components/PrintOrdersModal';
import PatientHeader from '../components/PatientHeader';
import { usePatientTabs } from '../context/PatientTabsContext';
import SpecialtyTracker from '../components/SpecialtyTracker';

const Snapshot = ({ showNotesOnly = false }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { addTab } = usePatientTabs();

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
                str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/').replace(/&sol;/g, '/');
                if (str === prev) break;
            }
        } else {
            str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/ig, '/');
        }
        return str;
    };

    const [patient, setPatient] = useState(null);
    const [recentNotes, setRecentNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [problems, setProblems] = useState([]);
    const [medications, setMedications] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [familyHistory, setFamilyHistory] = useState([]);
    const [socialHistory, setSocialHistory] = useState(null);
    const [vitals, setVitals] = useState([]);
    const [orders, setOrders] = useState([]);
    const [referrals, setReferrals] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [expandedNotes, setExpandedNotes] = useState(new Set());
    const [showPatientChart, setShowPatientChart] = useState(false);
    const [patientChartTab, setPatientChartTab] = useState('overview');

    const [showVisitFoldersModal, setShowVisitFoldersModal] = useState(false);
    const [selectedVisitForView, setSelectedVisitForView] = useState(null);
    const [noteFilter, setNoteFilter] = useState('all');
    const [visitHistoryExpanded, setVisitHistoryExpanded] = useState(true);
    // Photo state removed
    const [showDemographicsModal, setShowDemographicsModal] = useState(false);
    const [demographicsField, setDemographicsField] = useState(null); // 'phone', 'email', 'address', 'insurance', 'pharmacy', 'emergency'
    const [demographicsForm, setDemographicsForm] = useState({
        phone: '',
        email: '',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        insurance_provider: '',
        insurance_id: '',
        pharmacy_name: '',
        pharmacy_phone: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: ''
    });
    const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
    const [documentUploadFile, setDocumentUploadFile] = useState(null);
    const [documentUploadType, setDocumentUploadType] = useState('other');
    const [showEditPatientModal, setShowEditPatientModal] = useState(false);
    const [showEPrescribeEnhanced, setShowEPrescribeEnhanced] = useState(false);
    const { hasPrivilege } = usePrivileges();
    const [editPatientForm, setEditPatientForm] = useState({
        first_name: '',
        last_name: '',
        dob: '',
        sex: '',
        mrn: ''
    });
    const documentUploadInputRef = React.useRef(null);
    const [todayDraftVisit, setTodayDraftVisit] = useState(null);
    const [showNewVisitDropdown, setShowNewVisitDropdown] = useState(false);
    const [showPrintOrdersModal, setShowPrintOrdersModal] = useState(false);
    const [activeFlags, setActiveFlags] = useState([]);

    useEffect(() => {
        const fetchFlags = async () => {
            if (!id) return;
            try {
                const response = await patientFlagsAPI.getByPatient(id);
                const active = (response.data || []).filter(f => f.status === 'active');
                setActiveFlags(active);
            } catch (err) {
                console.error('Error fetching sticky notes (flags):', err);
            }
        };
        fetchFlags();
    }, [id]);

    // EKG States
    const [showEKGModal, setShowEKGModal] = useState(false);
    const [ekgData, setEKGData] = useState({
        date: new Date().toISOString().split('T')[0],
        rhythm: 'NSR',
        rate: '',
        pr: '',
        qrs: '',
        qtc: '',
        axis: '',
        interpretation: ''
    });
    const [ekgFile, setEKGFile] = useState(null);
    const [showChartReview, setShowChartReview] = useState(false);
    const [showSpecialtyTracker, setShowSpecialtyTracker] = useState(false);

    // ECHO States
    const [showECHOModal, setShowECHOModal] = useState(false);
    const [echoData, setECHOData] = useState({
        date: new Date().toISOString().split('T')[0],
        ef: '',
        la_size: '',
        lv_size: '',
        rv_size: '',
        valve_findings: '',
        notes: ''
    });
    const [echoFile, setECHOFile] = useState(null);

    // Stress Test States
    const [showStressTestModal, setShowStressTestModal] = useState(false);
    const [stressTestData, setStressTestData] = useState({
        type: 'treadmill',
        stressor: 'exercise',
        date: new Date().toISOString().split('T')[0],
        mets: '',
        peak_hr: '',
        bp_response: '',
        notes: ''
    });
    const [stressTestFile, setStressTestFile] = useState(null);

    // Cardiac Cath States
    const [showCardiacCathModal, setShowCardiacCathModal] = useState(false);
    const [cardiacCathData, setCardiacCathData] = useState({
        facility: '',
        date: new Date().toISOString().split('T')[0],
        findings: '', // LM, LAD, LCx, RCA
        ef: '',
        notes: ''
    });
    const [cardiacCathFile, setCardiacCathFile] = useState(null);

    // Helper to get authenticated file link
    const getAuthenticatedLink = (doc) => {
        if (!doc.file_path) return '#';
        if (doc.file_path.startsWith('http')) return doc.file_path;

        const token = localStorage.getItem('token');
        const baseUrl = `/api/documents/${doc.id}/file`;
        return token ? `${baseUrl}?token=${token}` : baseUrl;
    };

    // Handle URL parameters for navigation from other pages
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        const action = params.get('action');

        if (tab) {
            setPatientChartTab(tab);
            setShowPatientChart(true);
        }

        if (action === 'eprescribe') {
            setShowEPrescribeEnhanced(true);
        } else if (action === 'upload') {
            setShowDocumentUploadModal(true);
        }
    }, [location.search]);

    // Cardiology Viewer States
    const [showCardiologyViewer, setShowCardiologyViewer] = useState(false);
    const [cardiologyViewerType, setCardiologyViewerType] = useState(null); // 'EKG', 'ECHO', 'STRESS', 'CATH'

    // Layout Editor State
    const [layoutEditMode, setLayoutEditMode] = useState(false);
    const [moduleLayout, setModuleLayout] = useState([]);

    // Default layout configuration for modules
    const getDefaultLayout = () => [
        { i: 'medications', x: 0, y: 0, w: 2, h: 8, minW: 2, minH: 4 },
        { i: 'problems', x: 2, y: 0, w: 2, h: 8, minW: 2, minH: 4 },
        { i: 'allergies', x: 4, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'vitals', x: 6, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'familyHistory', x: 4, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'socialHistory', x: 6, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'screening', x: 0, y: 8, w: 4, h: 3, minW: 2, minH: 2 }
    ];

    // Load layout from localStorage or use default
    useEffect(() => {
        if (!id) return;
        const savedLayout = localStorage.getItem(`patient-chart-layout-${id}`);
        if (savedLayout) {
            try {
                setModuleLayout(JSON.parse(savedLayout));
            } catch (e) {
                setModuleLayout(getDefaultLayout());
            }
        } else {
            setModuleLayout(getDefaultLayout());
        }
    }, [id]);

    // Save layout to localStorage
    const saveLayout = useCallback((layout) => {
        localStorage.setItem(`patient-chart-layout-${id}`, JSON.stringify(layout));
        setModuleLayout(layout);
    }, [id]);

    // Reset to default layout
    const resetLayout = useCallback(() => {
        if (confirm('Reset layout to default? This will discard your custom arrangement.')) {
            localStorage.removeItem(`patient-chart-layout-${id}`);
            setModuleLayout(getDefaultLayout());
        }
    }, [id]);

    // Handle layout change
    const handleLayoutChange = useCallback((layout) => {
        saveLayout(layout);
    }, [saveLayout]);

    // Create new visit helper
    const handleCreateNewVisit = async () => {
        if (!id) return;
        try {
            setActionLoading(true);
            // Force create new visit using the updated API
            const response = await visitsAPI.findOrCreate(id, 'Office Visit', true);
            const newNote = response.data;
            if (newNote?.id) {
                navigate(`/patient/${id}/visit/${newNote.id}`);
            } else {
                alert('Failed to create new visit.');
            }
        } catch (error) {
            console.error('Error creating new visit:', error);
            alert('Failed to create new visit.');
        } finally {
            setActionLoading(false);
        }
    };

    // Function to refresh all patient data
    // Unified function to refresh all patient data
    const refreshPatientData = useCallback(async () => {
        if (!id) return;

        // Only show full loading screen if we don't have patient data yet
        if (!patient) {
            setLoading(true);
        }
        try {
            // Fetch patient snapshot (includes basic info, problems, meds, allergies, and recent visits)
            const snapshotResponse = await patientsAPI.getSnapshot(id);
            const snapshot = snapshotResponse.data;
            setPatient(snapshot.patient);

            // Also fetch full patient data to ensure we have photo_url and other details
            try {
                const fullPatientResponse = await patientsAPI.get(id);
                if (fullPatientResponse.data) {
                    const patientData = { ...snapshot.patient, ...fullPatientResponse.data };
                    setPatient(prev => ({ ...prev, ...patientData }));

                    // Add to patient tabs for session-based switching
                    addTab({
                        id: patientData.id,
                        first_name: patientData.first_name,
                        last_name: patientData.last_name,
                        mrn: patientData.mrn
                    });
                }
            } catch (error) {
                console.warn('Could not fetch full patient data:', error);
            }

            // Set problems
            if (snapshot.problems && snapshot.problems.length > 0) {
                setProblems(snapshot.problems.map(p => ({
                    id: p.id,
                    name: p.problem_name,
                    icd: p.icd10_code,
                    status: p.status,
                    onset: p.onset_date
                })));
            } else {
                setProblems([]);
            }

            // Set medications
            setMedications(snapshot.medications || []);

            // Set allergies
            setAllergies(snapshot.allergies || []);

            // Set vitals from recent visits & merge with notes for maximum completeness
            let combinedVitals = [];

            // 1. Process recent visits from snapshot
            if (snapshot.recentVisits && snapshot.recentVisits.length > 0) {
                combinedVitals = snapshot.recentVisits
                    .filter(v => v.vitals)
                    .map(v => {
                        const vData = typeof v.vitals === 'string' ? JSON.parse(v.vitals) : v.vitals;
                        let bpValue = vData.bp || vData.blood_pressure;
                        if (!bpValue && vData.systolic && vData.diastolic) {
                            bpValue = `${vData.systolic}/${vData.diastolic}`;
                        }
                        return {
                            id: v.id,
                            date: v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'Today',
                            bp: bpValue || 'N/A',
                            hr: vData.hr || vData.heart_rate || vData.pulse || 'N/A',
                            temp: vData.temp || vData.temperature || 'N/A',
                            rr: vData.rr || vData.respiratory_rate || vData.resp || 'N/A',
                            spo2: vData.spo2 || vData.oxygen_saturation || vData.o2sat || 'N/A',
                            weight: vData.weight || 'N/A'
                        };
                    });
            }

            // 2. If no vitals found in recent visits, check dedicated lastVitals field
            if (combinedVitals.length === 0 && snapshot.lastVitals) {
                const vData = typeof snapshot.lastVitals === 'string' ? JSON.parse(snapshot.lastVitals) : snapshot.lastVitals;
                let bpValue = vData.bp || vData.blood_pressure;
                if (!bpValue && vData.systolic && vData.diastolic) {
                    bpValue = `${vData.systolic}/${vData.diastolic}`;
                }
                combinedVitals.push({
                    id: 'last-known',
                    date: 'Last Known',
                    bp: bpValue || 'N/A',
                    hr: vData.hr || vData.heart_rate || vData.pulse || 'N/A',
                    temp: vData.temp || vData.temperature || 'N/A',
                    rr: vData.rr || vData.respiratory_rate || vData.resp || 'N/A',
                    spo2: vData.spo2 || vData.oxygen_saturation || vData.o2sat || 'N/A',
                    weight: vData.weight || 'N/A'
                });
            }

            setVitals(combinedVitals);

            // Fetch additional data in parallel
            try {
                const [familyHistResponse, socialHistResponse, ordersResponse, referralsResponse, documentsResponse, todayDraftResponse] = await Promise.all([
                    patientsAPI.getFamilyHistory(id).catch(() => ({ data: [] })),
                    patientsAPI.getSocialHistory(id).catch(() => ({ data: null })),
                    ordersAPI.getByPatient(id).catch(() => ({ data: [] })),
                    referralsAPI.getByPatient(id).catch(() => ({ data: [] })),
                    documentsAPI.getByPatient(id).catch(() => ({ data: [] })),
                    visitsAPI.getTodayDraft(id).catch(() => ({ data: { note: null } }))
                ]);

                setFamilyHistory(familyHistResponse?.data || []);
                setSocialHistory(socialHistResponse?.data || null);
                setOrders(ordersResponse?.data || []);
                setReferrals(referralsResponse?.data || []);
                setDocuments(documentsResponse?.data || []);
                const draftNote = todayDraftResponse.data?.note;
                setTodayDraftVisit(draftNote || null);

                if (draftNote?.vitals) {
                    try {
                        const vData = typeof draftNote.vitals === 'string' ? JSON.parse(draftNote.vitals) : draftNote.vitals;
                        const draftVitals = {
                            id: draftNote.id,
                            date: 'Today (Draft)',
                            bp: vData.bp || (vData.systolic && vData.diastolic ? `${vData.systolic}/${vData.diastolic}` : 'N/A'),
                            hr: vData.hr || vData.heart_rate || vData.pulse || 'N/A',
                            temp: vData.temp || vData.temperature || 'N/A',
                            rr: vData.rr || vData.respiratory_rate || vData.resp || 'N/A',
                            spo2: vData.spo2 || vData.oxygen_saturation || vData.o2sat || 'N/A',
                            weight: vData.weight || 'N/A'
                        };
                        setVitals(prev => [draftVitals, ...prev.filter(v => v.id !== draftNote.id)]);
                    } catch (e) { console.warn('Failed to parse draft vitals', e); }
                }
            } catch (error) {
                console.error('Error fetching supplementary data:', error);
            }
        } catch (error) {
            console.error('Core data refresh failed:', error);
            setProblems([]);
            setMedications([]);
            setAllergies([]);
            setVitals([]);
        } finally {
            setLoading(false);
        }
    }, [id, addTab]);

    // Handle Break-the-Glass authorization
    useEffect(() => {
        const handlePrivacyAuthorized = (event) => {
            // Robust ID comparison - convert both to strings to avoid type mismatch (string vs number)
            const authorizedId = String(event.detail?.patientId || '');
            const currentId = String(id || '');

            if (authorizedId === currentId && currentId !== '') {
                console.log('Privacy authorized for patient, refreshing data...', id);
                refreshPatientData();
            }
        };

        window.addEventListener('privacy:authorized', handlePrivacyAuthorized);
        return () => window.removeEventListener('privacy:authorized', handlePrivacyAuthorized);
    }, [id, refreshPatientData]);

    // Initial load and data update listeners
    useEffect(() => {
        refreshPatientData();

        const handlePatientDataUpdate = () => {
            console.log('Patient data update detected, refreshing...');
            refreshPatientData();
        };

        window.addEventListener('patient-data-updated', handlePatientDataUpdate);
        return () => window.removeEventListener('patient-data-updated', handlePatientDataUpdate);
    }, [refreshPatientData]);

    // Separate effect for fetching visit notes (history)
    useEffect(() => {
        const fetchNotes = async () => {
            if (!id) return;
            try {
                setLoadingNotes(true);
                const response = await visitsAPI.getByPatient(id);
                if (response.data && response.data.length > 0) {
                    // Show all visits for this patient in Visit History (both signed and drafts)
                    const formattedNotes = response.data.map(visit => {
                        const rawNote = visit.note_draft || "";
                        const noteText = typeof rawNote === 'string' ? rawNote : (typeof rawNote === 'object' ? JSON.stringify(rawNote) : String(rawNote));

                        const hpiMatch = String(noteText).match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
                        const planMatch = String(noteText).match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|CP|Follow Up|FU):|$)/is);
                        const assessmentMatch = String(noteText).match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
                        const carePlanMatch = String(noteText).match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|\n(?:Follow Up|FU):|$)/is);
                        const followUpMatch = String(noteText).match(/(?:Follow Up|FU):\s*(.+?)(?:\n\n|$)/is);
                        // Extract chief complaint
                        const ccMatch = String(noteText).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                        const chiefComplaint = ccMatch ? ccMatch[1].trim() : null;

                        // Format date and time for display
                        // Use visit_date for date, but use created_at for time if visit_date doesn't have time
                        const visitDateObj = new Date(visit.visit_date);
                        const createdDateObj = visit.created_at ? new Date(visit.created_at) : visitDateObj;
                        const dateStr = visitDateObj.toLocaleDateString();

                        // Check if visit_date has time component (not midnight)
                        const hasTime = visitDateObj.getHours() !== 0 || visitDateObj.getMinutes() !== 0 || visitDateObj.getSeconds() !== 0;
                        const timeSource = hasTime ? visitDateObj : createdDateObj;
                        const timeStr = timeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateTimeStr = `${dateStr} ${timeStr}`;

                        return {
                            id: visit.id,
                            date: dateStr,
                            time: timeStr,
                            dateTime: dateTimeStr,
                            type: visit.visit_type || "Office Visit",
                            provider: (() => {
                                const signedByName = visit.signed_by_first_name && visit.signed_by_last_name
                                    ? `${visit.signed_by_first_name} ${visit.signed_by_last_name}`
                                    : null;
                                const providerNameFallback = visit.provider_first_name
                                    ? `${visit.provider_first_name} ${visit.provider_last_name}`
                                    : "Provider";
                                // Use signed_by name unless it's "System Administrator", then use provider name
                                return ((visit.locked || visit.note_signed_by) && signedByName && signedByName !== 'System Administrator')
                                    ? signedByName
                                    : providerNameFallback;
                            })(),
                            summary: hpiMatch ? hpiMatch[1].trim().substring(0, 200) : (noteText.substring(0, 200) || "No note available"),
                            plan: planMatch ? planMatch[1].trim() : extractPlan(noteText),
                            assessment: assessmentMatch ? assessmentMatch[1].trim() : "",
                            carePlan: carePlanMatch ? carePlanMatch[1].trim() : "",
                            followUp: followUpMatch ? followUpMatch[1].trim() : "",
                            chiefComplaint: chiefComplaint,
                            signed: visit.locked || !!visit.note_signed_by,
                            visitDate: visit.visit_date,
                            visit_date: visit.visit_date, // For ChartReviewModal
                            createdAt: visit.created_at || visit.visit_date, // Fallback to visit_date if created_at not available
                            fullNote: noteText,
                            vitals: visit.vitals, // For ChartReviewModal
                            visit_type: visit.visit_type, // For ChartReviewModal
                        };
                    });

                    // Sort by visit date and time, then by created_at (latest first)
                    formattedNotes.sort((a, b) => {
                        // Primary sort: visit_date
                        const dateA = new Date(a.visitDate);
                        const dateB = new Date(b.visitDate);
                        const dateDiff = dateB - dateA;

                        // If dates are the same (same day), sort by created_at (most recent first)
                        if (dateDiff === 0 || (Math.abs(dateDiff) < 24 * 60 * 60 * 1000)) {
                            const createdA = new Date(a.createdAt);
                            const createdB = new Date(b.createdAt);
                            return createdB - createdA;
                        }

                        return dateDiff; // Descending order (newest first)
                    });

                    setRecentNotes(formattedNotes);
                } else {
                    setRecentNotes([]);
                }
            } catch (error) {
                console.error('Could not fetch notes from API:', error);
                setRecentNotes([]);
            } finally {
                setLoadingNotes(false);
            }
        };
        if (id) {
            fetchNotes();
        }
    }, [id]);

    const extractPlan = (noteText) => {
        if (!noteText) return '';
        const text = typeof noteText === 'string' ? noteText : String(noteText);
        const safeText = String(text || '');
        const planMatch = safeText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n[A-Z]:|$)/is);
        return planMatch ? planMatch[1].trim() : '';
    };

    const handleDeleteNote = async (noteId, e) => {
        if (e) {
            e.stopPropagation();
        }

        if (!window.confirm('Are you sure you want to delete this draft note? This action cannot be undone.')) {
            return;
        }

        try {
            await visitsAPI.delete(noteId);
            // Refresh patient data which will refresh today's draft and notes
            refreshPatientData();
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Failed to delete note. Please try again.');
        }
    };

    const handleViewNote = (noteId, e) => {
        console.log('handleViewNote called for note:', noteId);
        console.log('Type of navigate:', typeof navigate);
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Find the note in our local state to check its status
        const note = recentNotes.find(n => n.id === noteId);

        // If it's a draft, go to the full visit editor
        if (note && !note.signed) {
            console.log('Opening draft note editor for visit:', noteId);
            navigate(`/patient/${id}/visit/${noteId}`);
        } else {
            // If it's signed or not found (fallback), open the modal view
            console.log('Opening signed note modal for visit:', noteId);
            setSelectedVisitForView({ visitId: noteId, patientId: id });
        }
    };

    const handleOpenDemographics = (field) => {
        setDemographicsField(field);
        // Pre-fill form with current patient data
        // Format phone numbers for display in the form
        const currentPhone = patient?.phone ? formatPhone(patient.phone) : '';
        const currentPharmacyPhone = patient?.pharmacy_phone ? formatPhone(patient.pharmacy_phone) : '';
        const currentEmergencyPhone = patient?.emergency_contact_phone ? formatPhone(patient.emergency_contact_phone) : '';

        setDemographicsForm({
            phone: currentPhone,
            email: patient?.email || '',
            address_line1: patient?.address_line1 || '',
            city: patient?.city || '',
            state: patient?.state || '',
            zip: patient?.zip || '',
            insurance_provider: patient?.insurance_provider || '',
            insurance_id: patient?.insurance_id || '',
            pharmacy_name: patient?.pharmacy_name || '',
            pharmacy_phone: currentPharmacyPhone,
            emergency_contact_name: patient?.emergency_contact_name || '',
            emergency_contact_phone: currentEmergencyPhone,
            emergency_contact_relationship: patient?.emergency_contact_relationship || ''
        });
        setShowDemographicsModal(true);
    };

    const handleSaveDemographics = async () => {
        if (!id) return;

        try {
            const updateData = {};

            // Only update the field being edited
            // Convert snake_case to camelCase for API compatibility
            switch (demographicsField) {
                case 'phone':
                    // Remove formatting and save as digits only
                    const cleanedPhone = demographicsForm.phone ? demographicsForm.phone.replace(/\D/g, '') : null;
                    updateData.phone = cleanedPhone || null;
                    break;
                case 'email':
                    updateData.email = demographicsForm.email || null;
                    break;
                case 'address':
                    updateData.addressLine1 = demographicsForm.address_line1 || null;
                    updateData.city = demographicsForm.city || null;
                    updateData.state = demographicsForm.state || null;
                    updateData.zip = demographicsForm.zip || null;
                    break;
                case 'insurance':
                    updateData.insuranceProvider = demographicsForm.insurance_provider || null;
                    updateData.insuranceId = demographicsForm.insurance_id || null;
                    break;
                case 'pharmacy':
                    updateData.pharmacyName = demographicsForm.pharmacy_name || null;
                    // Remove formatting and save as digits only
                    const cleanedPharmacyPhone = demographicsForm.pharmacy_phone ? demographicsForm.pharmacy_phone.replace(/\D/g, '') : null;
                    updateData.pharmacyPhone = cleanedPharmacyPhone || null;
                    break;
                case 'emergency':
                    updateData.emergencyContactName = demographicsForm.emergency_contact_name || null;
                    // Remove formatting and save as digits only
                    const cleanedEmergencyPhone = demographicsForm.emergency_contact_phone ? demographicsForm.emergency_contact_phone.replace(/\D/g, '') : null;
                    updateData.emergencyContactPhone = cleanedEmergencyPhone || null;
                    updateData.emergencyContactRelationship = demographicsForm.emergency_contact_relationship || null;
                    break;
            }

            console.log('Updating patient with data:', updateData);
            const response = await patientsAPI.update(id, updateData);
            console.log('Update response:', response);

            // Refresh patient data
            const refreshResponse = await patientsAPI.get(id);
            if (refreshResponse.data) {
                setPatient(prev => ({ ...prev, ...refreshResponse.data }));
            }
            setShowDemographicsModal(false);
            setDemographicsField(null);
        } catch (error) {
            console.error('Error updating patient demographics:', error);
            console.error('Error response:', error.response?.data);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to update patient information';
            alert(errorMessage);
        }
    };

    const handleDocumentUpload = async () => {
        if (!documentUploadFile || !id) return;

        try {
            const formData = new FormData();
            formData.append('file', documentUploadFile);
            formData.append('patientId', id);
            formData.append('docType', documentUploadType);

            await documentsAPI.upload(formData);

            // Refresh documents
            const docsResponse = await documentsAPI.getByPatient(id);
            const docs = docsResponse.data || [];
            const imageDocs = docs.filter(d => d.doc_type === 'imaging');
            const otherDocs = docs.filter(d => d.doc_type !== 'imaging');
            imageDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            otherDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setDocuments(docs);

            // Close modal and reset
            setShowDocumentUploadModal(false);
            setDocumentUploadFile(null);
            setDocumentUploadType('other');
            if (documentUploadInputRef.current) {
                documentUploadInputRef.current.value = '';
            }

            alert('Document uploaded successfully!');
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Failed to upload document. Please try again.');
        }
    };

    const handleEditPatient = async () => {
        if (!id) return;

        try {
            const updateData = {
                firstName: editPatientForm.first_name,
                lastName: editPatientForm.last_name,
                dob: editPatientForm.dob || null,
                sex: editPatientForm.sex || null,
                mrn: editPatientForm.mrn || null
            };

            await patientsAPI.update(id, updateData);

            // Refresh patient data
            await refreshPatientData();

            alert('Patient information updated successfully!');
            setShowEditPatientModal(false);
            refreshPatientData();
        } catch (error) {
            console.error('Error updating patient:', error);
            alert('Failed to update patient information.');
        }
    };

    const handleEKGUpload = async () => {
        if (!ekgFile || !id) return;
        try {
            const formData = new FormData();
            formData.append('patientId', id);
            formData.append('docType', 'imaging');
            // Tags for EKG data - interpretation is the user notes
            const tags = [
                'ekg',
                `date:${ekgData.date}`,
                `rhythm:${ekgData.rhythm}`,
                `rate:${ekgData.rate}`,
                `interval_pr:${ekgData.pr}`,
                `interval_qrs:${ekgData.qrs}`,
                `interval_qtc:${ekgData.qtc}`,
                `axis:${ekgData.axis}`,
                `interpretation:${ekgData.interpretation}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));
            formData.append('file', ekgFile);

            await documentsAPI.upload(formData);
            const docsResponse = await documentsAPI.getByPatient(id);
            setDocuments(docsResponse.data || []);
            setShowEKGModal(false);
            setEKGFile(null);
            alert('EKG saved successfully!');
        } catch (error) {
            console.error('Error saving EKG:', error);
            alert('Failed to save EKG.');
        }
    };

    const handleECHOUpload = async () => {
        if (!echoFile || !id) return;
        try {
            const formData = new FormData();
            formData.append('patientId', id);
            formData.append('docType', 'imaging');  // Use 'imaging' - 'echo' is not a valid doc_type. Type is distinguished via tags.
            // Tags for ECHO data
            const tags = [
                'echo',
                `date:${echoData.date}`,
                `ef:${echoData.ef}%`,
                `la_size:${echoData.la_size}`,
                `lv_size:${echoData.lv_size}`,
                `rv_size:${echoData.rv_size}`,
                `valve_findings:${echoData.valve_findings}`,
                `interpretation:${echoData.notes}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));
            formData.append('file', echoFile);

            await documentsAPI.upload(formData);
            const docsResponse = await documentsAPI.getByPatient(id);
            setDocuments(docsResponse.data || []);
            setShowECHOModal(false);
            setECHOFile(null);
            alert('ECHO saved successfully!');
        } catch (error) {
            console.error('Error saving ECHO:', error);
            alert('Failed to save ECHO.');
        }
    };

    const handleStressTestUpload = async () => {
        if (!stressTestFile || !id) return;
        try {
            const formData = new FormData();
            formData.append('patientId', id);
            formData.append('docType', 'imaging');
            const tags = [
                'stress_test',
                `type:${stressTestData.type}`,
                `stressor:${stressTestData.stressor}`,
                `date:${stressTestData.date}`,
                `mets:${stressTestData.mets}`,
                `peak_hr:${stressTestData.peak_hr}`,
                `bp_response:${stressTestData.bp_response}`,
                `interpretation:${stressTestData.notes}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));
            formData.append('file', stressTestFile);

            await documentsAPI.upload(formData);
            const docsResponse = await documentsAPI.getByPatient(id);
            setDocuments(docsResponse.data || []);
            setShowStressTestModal(false);
            setStressTestFile(null);
            alert('Stress Test saved successfully!');
        } catch (error) {
            console.error('Error saving Stress Test:', error);
            alert('Failed to save Stress Test.');
        }
    };

    const handleCardiacCathUpload = async () => {
        if (!cardiacCathFile || !id) return;
        try {
            const formData = new FormData();
            formData.append('patientId', id);
            formData.append('docType', 'imaging');
            const tags = [
                'cardiac_cath',
                `date:${cardiacCathData.date}`,
                `facility:${cardiacCathData.facility}`,
                `findings:${cardiacCathData.findings}`,
                `ef:${cardiacCathData.ef}%`,
                `interpretation:${cardiacCathData.notes}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));
            formData.append('file', cardiacCathFile);

            await documentsAPI.upload(formData);
            const docsResponse = await documentsAPI.getByPatient(id);
            setDocuments(docsResponse.data || []);
            setShowCardiacCathModal(false);
            setCardiacCathFile(null);
            alert('Cardiac Cath saved successfully!');
        } catch (error) {
            console.error('Error saving Cardiac Cath:', error);
            alert('Failed to save Cardiac Cath.');
        }
    };

    const toggleNote = (noteId) => {
        setExpandedNotes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(noteId)) {
                newSet.delete(noteId);
            } else {
                newSet.add(noteId);
            }
            return newSet;
        });
    };

    const isNoteExpanded = (noteId) => {
        return expandedNotes.has(noteId);
    };

    const filteredNotes = (recentNotes || []).filter(note => {
        if (noteFilter === 'all') return true;
        if (noteFilter === 'draft') return !note.signed;
        if (noteFilter === 'signed') return note.signed;
        return true;
    });

    // Format phone number to (xxx) xxx-xxxx
    const formatPhone = (phone) => {
        if (!phone) return null;
        // Remove all non-digits
        const cleaned = phone.replace(/\D/g, '');
        // Format to (xxx) xxx-xxxx
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        // Return original if not 10 digits
        return phone;
    };

    // Format phone number input as user types
    const formatPhoneInput = (value) => {
        // Remove all non-digits
        const cleaned = value.replace(/\D/g, '');
        // Limit to 10 digits
        const limited = cleaned.slice(0, 10);
        // Format to (xxx) xxx-xxxx
        if (limited.length === 0) return '';
        if (limited.length <= 3) return `(${limited}`;
        if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
        return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    };

    // Format full address for display
    const formatAddress = (patient) => {
        if (!patient) return 'Not provided';
        const parts = [];
        if (patient.address_line1) parts.push(patient.address_line1);
        if (patient.city) parts.push(patient.city);
        if (patient.state) parts.push(patient.state);
        if (patient.zip) parts.push(patient.zip);
        return parts.length > 0 ? parts.join(', ') : 'Not provided';
    };

    // Calculate age from DOB using robust string parsing (avoids timezone shifts)
    const calculateAge = (dob) => {
        if (!dob) return null;
        try {
            const datePart = dob.split('T')[0];
            const [year, month, day] = datePart.split('-').map(num => parseInt(num));
            const today = new Date();
            let age = today.getFullYear() - year;
            const m = (today.getMonth() + 1) - month;
            if (m < 0 || (m === 0 && today.getDate() < day)) {
                age--;
            }
            return age;
        } catch (e) {
            console.error('Error calculating age:', e);
            return null;
        }
    };

    // Format DOB using robust string parsing
    const formatDOB = (dob) => {
        if (!dob) return 'N/A';
        try {
            const datePart = dob.split('T')[0];
            const [year, month, day] = datePart.split('-');
            return `${parseInt(month)}/${parseInt(day)}/${year}`;
        } catch (e) {
            return 'N/A';
        }
    };




    if (showNotesOnly) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-5 h-5 text-gray-700" />
                                <h2 className="font-serif font-bold text-gray-900">All Prior Notes</h2>
                            </div>
                            <button onClick={() => navigate(`/patient/${id}/snapshot`)} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
                                Back to Snapshot
                            </button>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-ink-600 font-medium">Filter:</span>
                            <button
                                onClick={() => setNoteFilter('all')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${noteFilter === 'all'
                                    ? 'text-white font-medium'
                                    : 'bg-white text-deep-gray hover:bg-soft-gray border border-deep-gray/20'
                                    }`}
                            >
                                All ({(recentNotes || []).length})
                            </button>
                            <button
                                onClick={() => setNoteFilter('draft')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${noteFilter === 'draft'
                                    ? 'bg-orange-600 text-white font-medium'
                                    : 'bg-white text-ink-700 hover:bg-paper-50 border border-paper-300'
                                    }`}
                            >
                                Draft ({(recentNotes || []).filter(n => !n.signed).length})
                            </button>
                            <button
                                onClick={() => setNoteFilter('signed')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${noteFilter === 'signed'
                                    ? 'bg-green-600 text-white font-medium'
                                    : 'bg-white text-ink-700 hover:bg-paper-50 border border-paper-300'
                                    }`}
                            >
                                Signed ({(recentNotes || []).filter(n => n.signed).length})
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-paper-100">
                        {loadingNotes ? (
                            <div className="p-8 text-center text-ink-500">Loading notes...</div>
                        ) : filteredNotes.length > 0 ? (
                            filteredNotes.map((note) => {
                                const isExpanded = isNoteExpanded(note.id);
                                return (
                                    <div key={note.id} className="border-b border-paper-100 last:border-b-0">
                                        <div className="w-full p-4 hover:bg-paper-50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleNote(note.id);
                                                        }}
                                                        className="p-1 hover:bg-paper-100 rounded flex-shrink-0"
                                                        title="Expand/Collapse"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-ink-400" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-ink-400" />
                                                        )}
                                                    </button>
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewNote(note.id, e);
                                                        }}
                                                    >
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <h3 className="font-bold text-ink-900">{note.type}</h3>
                                                            {note.signed ? (
                                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Signed</span>
                                                            ) : (
                                                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Draft</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center space-x-3 text-xs text-ink-500">
                                                            <span className="flex items-center">
                                                                <Clock className="w-3 h-3 mr-1" /> {note.dateTime || note.date}
                                                            </span>
                                                            <span>by {note.provider}</span>
                                                        </div>
                                                        {!isExpanded && (
                                                            <p className="text-sm text-ink-600 mt-2 line-clamp-2">{note.summary}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {!isExpanded && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewNote(note.id, e);
                                                        }}
                                                        className={`ml-4 text-xs font-medium flex items-center space-x-1 flex-shrink-0 px-3 py-1.5 rounded-md ${note.signed
                                                            ? 'bg-paper-100 text-paper-700 hover:bg-paper-200 hover:text-paper-900'
                                                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-900 font-semibold'
                                                            }`}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        <span>{note.signed ? 'View Chart' : 'Edit'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 pl-11 bg-paper-25 border-t border-paper-100">
                                                <div className="space-y-3 pt-2">
                                                    {note.summary && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-ink-700 mb-1">Summary:</p>
                                                            <p className="text-sm text-ink-700 whitespace-pre-wrap">{note.summary}</p>
                                                        </div>
                                                    )}
                                                    {note.assessment && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-ink-700 mb-1">Assessment:</p>
                                                            <p className="text-sm text-ink-700 whitespace-pre-wrap">{note.assessment}</p>
                                                        </div>
                                                    )}
                                                    {note.plan && (
                                                        <div className="p-2 bg-paper-50 rounded border-l-2 border-paper-400">
                                                            <p className="text-xs font-semibold text-ink-700 mb-1">Plan:</p>
                                                            <p className="text-xs text-ink-600 whitespace-pre-wrap">{note.plan}</p>
                                                        </div>
                                                    )}
                                                    {note.carePlan && (
                                                        <div className="p-2 bg-paper-50 rounded border-l-2 border-primary-400">
                                                            <p className="text-xs font-semibold text-ink-700 mb-1">Care Plan:</p>
                                                            <p className="text-xs text-ink-600 whitespace-pre-wrap">{note.carePlan}</p>
                                                        </div>
                                                    )}
                                                    {note.followUp && (
                                                        <div className="p-2 bg-paper-50 rounded border-l-2 border-green-400">
                                                            <p className="text-xs font-semibold text-ink-700 mb-1">Follow Up:</p>
                                                            <p className="text-xs text-ink-600 whitespace-pre-wrap">{note.followUp}</p>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-end pt-2">
                                                        <button
                                                            onClick={(e) => handleViewNote(note.id, e)}
                                                            className={`text-xs font-medium flex items-center space-x-1 px-3 py-1.5 rounded-md ${note.signed
                                                                ? 'bg-paper-100 text-paper-700 hover:bg-paper-200 hover:text-paper-900'
                                                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-900 font-semibold'
                                                                }`}
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            <span>{note.signed ? 'View Chart' : 'Edit Note'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-ink-500">
                                {(recentNotes || []).length === 0
                                    ? 'No prior notes found'
                                    : `No ${noteFilter === 'draft' ? 'draft' : noteFilter === 'signed' ? 'signed' : ''} notes found`}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-gray-600">Loading patient chart...</p>
                </div>
            </div>
        );
    }

    const age = patient ? calculateAge(patient.dob) : null;

    return (
        <div className="min-h-screen bg-neutral-50">
            <div className="w-full px-4">
                <PatientHeader
                    patient={patient}
                    onUpdate={refreshPatientData}
                    onOpenChart={() => {
                        setPatientChartTab('hub');
                        setShowPatientChart(true);
                    }}
                    onOpenToday={() => {
                        if (todayDraftVisit) {
                            navigate(`/patient/${id}/visit/${todayDraftVisit.id}`);
                        } else {
                            handleCreateNewVisit();
                        }
                    }}
                />

                {/* Quick Navigation Bar - Neutralized */}
                <div className="px-6 py-2 bg-white border-b border-gray-200 mb-6 shadow-sm sticky top-0 z-10">
                    <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-hide">
                            <button
                                onClick={() => {
                                    setPatientChartTab('hub');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all whitespace-nowrap border border-transparent hover:border-slate-200"
                            >
                                <UserCircle className="w-3.5 h-3.5 text-slate-500" />
                                <span>Patient Hub</span>
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1 shrink-0"></div>
                            <button
                                onClick={() => {
                                    setPatientChartTab('images');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all whitespace-nowrap border border-transparent hover:border-slate-200"
                            >
                                <FileImage className="w-3.5 h-3.5 text-slate-500" />
                                <span>Images</span>
                                {(documents || []).filter(d => d.doc_type === 'imaging').length > 0 && (
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {(documents || []).filter(d => d.doc_type === 'imaging').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setPatientChartTab('labs');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all whitespace-nowrap border border-transparent hover:border-slate-200"
                            >
                                <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
                                <span>Labs</span>
                                {(orders || []).filter(o => o.order_type === 'lab').length > 0 && (
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {(orders || []).filter(o => o.order_type === 'lab').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setPatientChartTab('documents');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all whitespace-nowrap border border-transparent hover:border-slate-200"
                            >
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                <span>Documents</span>
                                {(documents || []).filter(d => d.doc_type !== 'imaging').length > 0 && (
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {(documents || []).filter(d => d.doc_type !== 'imaging').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setShowDocumentUploadModal(true)}
                                className="flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
                                title="Upload Document"
                            >
                                <Upload className="w-4 h-4" />
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1 shrink-0"></div>
                            <button
                                onClick={() => setShowPrintOrdersModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md transition-all hover:bg-slate-50 hover:shadow-sm whitespace-nowrap"
                                title="Print Orders"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Orders</span>
                            </button>
                            <button
                                onClick={() => setShowChartReview(true)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white text-indigo-600 hover:bg-indigo-50 text-[11px] font-bold rounded-full border border-indigo-200 transition-all"
                                title="Chart Review"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Review Chart</span>
                            </button>
                            <button
                                onClick={() => setShowSpecialtyTracker(true)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 text-[11px] font-bold rounded-full transition-all shadow-sm"
                                title="Specialty Tracker - At-a-glance trends"
                            >
                                <Activity className="w-3.5 h-3.5" />
                                <span>Tracker</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative group/visit">
                                <button
                                    onClick={() => todayDraftVisit ? navigate(`/patient/${id}/visit/${todayDraftVisit.id}`) : handleCreateNewVisit()}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-800 rounded-md transition-all hover:bg-slate-900 hover:shadow-md"
                                >
                                    {todayDraftVisit ? (
                                        <>
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>Open Today's Note</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Start New Visit</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {layoutEditMode && (
                                <button
                                    onClick={resetLayout}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                                    title="Reset to Default Layout"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reset Layout</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6">

                    {/* Modular Grid - With Layout Editor Support */}
                    <div className="mb-8">
                        {layoutEditMode ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                            Layout Editor Active
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setLayoutEditMode(false)}
                                        className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-sm"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {!layoutEditMode ? (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Left Column: Compact Reference Cards + Visit History */}
                                <div className="lg:col-span-1 space-y-4">
                                    {/* Visit History Section - Now in Sidebar */}
                                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                                        <div
                                            className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white cursor-pointer hover:bg-slate-50 transition-colors group/header"
                                            onClick={() => setShowVisitFoldersModal(true)}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <FileText className="w-3.5 h-3.5 text-slate-400 group-hover/header:text-slate-600" />
                                                <h3 className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">Visit History</h3>
                                                {filteredNotes.length > 0 && (
                                                    <span className="text-[10px] text-slate-400 font-medium ml-1">({filteredNotes.length})</span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover/header:text-slate-500 transition-all transform group-hover/header:translate-x-0.5" />
                                        </div>
                                        <div className="p-3 overflow-y-auto scrollbar-hide max-h-[300px]">
                                            {filteredNotes.length > 0 ? (
                                                <div className="space-y-2">
                                                    {filteredNotes.slice(0, 6).map(note => (
                                                        <div
                                                            key={note.id}
                                                            className="px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer transition-colors group relative pl-3"
                                                            onClick={() => handleViewNote(note.id)}
                                                        >
                                                            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-200 group-hover:bg-blue-400 rounded-full transition-colors" />
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-slate-800">{note.type}</span>
                                                                <span className="text-[9px] text-slate-400 font-medium tabular-nums">{note.date}</span>
                                                            </div>
                                                            <p className="text-[9px] text-slate-500 truncate mt-0.5">{note.chiefComplaint || "No complaint recorded"}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6">
                                                    <FileText className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                                                    <p className="text-[10px] text-slate-400">No clinical visits</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <AlertCircle className="w-3.5 h-3.5 text-rose-500 opacity-70" />
                                                <h3 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider">Allergies</h3>
                                            </div>
                                            <button
                                                onClick={() => { setPatientChartTab('allergies'); setShowPatientChart(true); }}
                                                className="text-[9px] text-blue-500 font-bold hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="p-3">
                                            {allergies.length > 0 ? (
                                                <div className="space-y-2">
                                                    {allergies.slice(0, 3).map(allergy => (
                                                        <div key={allergy.id} className="group">
                                                            <p className="font-bold text-[10px] text-slate-800 leading-tight">{allergy.allergen}</p>
                                                            <p className="text-[9px] text-slate-400 leading-tight">{allergy.reaction || 'No reaction recorded'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 text-center py-2 italic font-medium">NKA</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Family History Module */}
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                                <h3 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider">Family History</h3>
                                            </div>
                                            <button
                                                onClick={() => { setPatientChartTab('family'); setShowPatientChart(true); }}
                                                className="text-[9px] text-blue-500 font-bold hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="p-3">
                                            {familyHistory.length > 0 ? (
                                                <div className="space-y-2">
                                                    {familyHistory.slice(0, 3).map(hist => (
                                                        <div key={hist.id}>
                                                            <p className="font-bold text-[10px] text-slate-800 leading-tight">{hist.condition}</p>
                                                            <p className="text-[9px] text-slate-400 leading-tight">{hist.relationship}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 text-center py-2 italic font-medium">Not recorded</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100 flex items-center space-x-2">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            <h3 className="font-bold text-[10px] text-slate-800 uppercase tracking-wider">Social History</h3>
                                        </div>
                                        <div className="p-3">
                                            {socialHistory ? (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-400 font-medium">Smoking</span>
                                                        <span className="font-bold text-slate-700">{socialHistory.smoking_status || '—'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-400 font-medium">Alcohol</span>
                                                        <span className="font-bold text-slate-700">{socialHistory.alcohol_use || '—'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-400 font-medium">Occupation</span>
                                                        <span className="font-bold text-slate-700 truncate ml-2 max-w-[80px] text-right">{socialHistory.occupation || '—'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 text-center py-2 italic">Not recorded</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Main Dashboard Content */}
                                <div className="lg:col-span-3 space-y-5">
                                    {/* Clinical Alerts Banner - High Visibility Inline version */}
                                    {activeFlags.length > 0 && (
                                        <div className="space-y-1.5">
                                            {activeFlags.map(flag => (
                                                <div key={flag.id} className="bg-white border-l-4 border-l-rose-500 border-y border-r border-rose-100 rounded-lg p-2.5 flex items-center justify-between shadow-sm hover:shadow-md transition-all animate-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="p-1 px-2 bg-rose-500 text-white rounded text-[8px] font-black uppercase tracking-widest">
                                                            Alert
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-black text-rose-900 uppercase tracking-tight">{flag.display_label}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                <span className="text-[10px] text-slate-500 font-medium">{flag.severity || 'Medium Severity'}</span>
                                                            </div>
                                                            {flag.note && <p className="text-[10px] text-slate-600 font-semibold mt-0.5">{flag.note}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors mr-2">
                                                            Acknowledge
                                                        </button>
                                                        <button
                                                            onClick={refreshPatientData}
                                                            className="p-1 hover:bg-slate-100 rounded text-slate-300 transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick Metrics Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Blood Pressure', value: vitals[0]?.bp, unit: 'mmHg', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', last: vitals[1]?.bp },
                                            { label: 'Heart Rate', value: vitals[0]?.hr, unit: 'bpm', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50', last: vitals[1]?.hr },
                                            { label: 'Oxygen Sat', value: vitals[0]?.spo2, unit: '%', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50', last: vitals[1]?.spo2 },
                                            { label: 'Temperature', value: vitals[0]?.temp, unit: '°F', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-50', last: vitals[1]?.temp }
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                                    <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                                                        <stat.icon className="w-3.5 h-3.5" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black text-slate-900 tabular-nums leading-none tracking-tight">{stat.value || '--'}</span>
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{stat.unit}</span>
                                                </div>
                                                {stat.last && (
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className="text-[9px] font-medium text-slate-400">Previous: {stat.last}</span>
                                                        <div className="w-8 h-1 bg-slate-50 rounded-full overflow-hidden">
                                                            <div className={`h-full ${stat.bg.replace('/50', '').replace('bg-', 'bg-')}`} style={{ width: '60%' }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Insights Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Plan of Care & Continuity Card */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow group">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Plan of Care & Next Steps</h3>
                                                </div>
                                                <span className="text-[10px] text-slate-300 font-bold uppercase">Latest Enc: {recentNotes[0]?.date || 'None'}</span>
                                            </div>

                                            {recentNotes[0] ? (
                                                <div className="space-y-4">
                                                    <div className="relative">
                                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-100 rounded-full" />
                                                        <div className="pl-4">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Current Clinical Plan</span>
                                                            <div className="text-[11px] text-slate-700 leading-relaxed font-medium line-clamp-4 italic">
                                                                "{recentNotes[0].plan || recentNotes[0].assessment || 'No specific clinical plan was documented in the latest visit note.'}"
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(recentNotes[0].followUp || recentNotes[0].carePlan) && (
                                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2.5">
                                                            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Follow-up & Coordination</span>
                                                                <p className="text-[11px] text-slate-900 font-bold leading-tight">
                                                                    {recentNotes[0].followUp || recentNotes[0].carePlan}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => handleViewNote(recentNotes[0].id)}
                                                            className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            Open Full Visit Plan
                                                        </button>
                                                        <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                            <Printer className="w-3.5 h-3.5 text-slate-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-10 text-center flex flex-col items-center">
                                                    <div className="p-3 bg-slate-50 rounded-full mb-3">
                                                        <FileText className="w-6 h-6 text-slate-200" />
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 font-medium">No active care plans found</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Reminders & Pending Actions Card */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Clinical Reminders</h3>
                                            </div>

                                            <div className="space-y-3">
                                                {/* Smart-derived Reminders */}
                                                {(orders.filter(o => o.status === 'pending').length > 0) && (
                                                    <div className="flex items-start gap-3 p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                                                        <div className="p-1 bg-amber-100 rounded text-amber-600">
                                                            <FlaskConical className="w-3 h-3" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-amber-900">Pending Lab Result</p>
                                                            <p className="text-[10px] text-amber-700/80">Patient has {orders.filter(o => o.status === 'pending').length} unfinalized orders</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-start gap-3 p-2.5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                                                    <div className="p-1 bg-slate-100 rounded text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                        <Users className="w-3 h-3" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-slate-800 group-hover:text-blue-600">Annual Wellness Visit</p>
                                                        <p className="text-[10px] text-slate-400">Due in 14 days (suggested sloting)</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3 p-2.5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                                                    <div className="p-1 bg-slate-100 rounded text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                                                        <Activity className="w-3 h-3" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-slate-800 group-hover:text-rose-600">HTN Screening</p>
                                                        <p className="text-[10px] text-slate-400">Last BP: {vitals[0]?.bp || 'None'} ({vitals[0]?.date || 'Today'})</p>
                                                    </div>
                                                </div>

                                                <button className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors border-t border-slate-50 mt-1">
                                                    View All Tasks
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Boards Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Medications Module */}
                                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
                                                        <Pill className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">Medications</h3>
                                                </div>
                                                <button onClick={() => { setPatientChartTab('medications'); setShowPatientChart(true); }} className="text-[10px] text-blue-500 font-bold hover:underline">View All</button>
                                            </div>
                                            <div className="p-3">
                                                {(medications || []).filter(m => m.active !== false).length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {(medications || []).filter(m => m.active !== false).slice(0, 10).map(med => (
                                                            <div key={med.id} className="p-2 border border-slate-50 rounded-xl bg-slate-50/30 hover:bg-slate-50 transition-colors">
                                                                <p className="font-bold text-[11px] text-slate-800 truncate">{decodeHtmlEntities(med.medication_name)}</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">{med.dosage} {med.frequency}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 text-center py-6 italic">No active medications</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Problems Module */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-100 flex items-center bg-white justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">Problems</h3>
                                                </div>
                                                <button onClick={() => { setPatientChartTab('problems'); setShowPatientChart(true); }} className="text-[10px] text-amber-600 font-bold hover:underline">Edit</button>
                                            </div>
                                            <div className="p-3">
                                                {(problems || []).length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {(problems || []).slice(0, 8).map(prob => (
                                                            <div key={prob.id} className="flex justify-between items-center group">
                                                                <span className="text-[11px] font-semibold text-slate-700 truncate mr-2">{prob.name}</span>
                                                                <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-bold uppercase shrink-0">Active</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 text-center py-6 italic">No problems listed</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Results Module */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-100 flex items-center bg-white justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                                                        <FileText className="w-3.5 h-3.5" />
                                                    </div>
                                                    <h3 className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">Results</h3>
                                                </div>
                                                <button onClick={() => { setPatientChartTab('labs'); setShowPatientChart(true); }} className="text-[10px] text-indigo-500 font-bold hover:underline">View</button>
                                            </div>
                                            <div className="p-3">
                                                {orders.length > 0 || documents.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {[...orders.slice(0, 4), ...documents.slice(0, 4)].map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between gap-2 overflow-hidden">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-bold text-[10px] text-slate-700 truncate leading-tight">{item.order_name || item.name || item.doc_type}</p>
                                                                    <p className="text-[8px] text-slate-400 font-medium">{item.order_date || item.upload_date || 'Recent'}</p>
                                                                </div>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 text-center py-6 italic">No recent results</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                </div>

            </div>

            {/* Demographics Modal */}
            {
                showDemographicsModal && demographicsField && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => {
                        setShowDemographicsModal(false);
                        setDemographicsField(null);
                    }}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {demographicsField === 'phone' && 'Edit Phone'}
                                    {demographicsField === 'email' && 'Edit Email'}
                                    {demographicsField === 'address' && 'Edit Address'}
                                    {demographicsField === 'insurance' && 'Edit Insurance'}
                                    {demographicsField === 'pharmacy' && 'Edit Pharmacy'}
                                    {demographicsField === 'emergency' && 'Edit Emergency Contact'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowDemographicsModal(false);
                                        setDemographicsField(null);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Phone */}
                                {demographicsField === 'phone' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={demographicsForm.phone}
                                            onChange={(e) => {
                                                const formatted = formatPhoneInput(e.target.value);
                                                setDemographicsForm({ ...demographicsForm, phone: formatted });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="(555) 123-4567"
                                            maxLength={14}
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {/* Email */}
                                {demographicsField === 'email' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={demographicsForm.email}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="patient@example.com"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {/* Address */}
                                {demographicsField === 'address' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.address_line1}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, address_line1: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="123 Main St"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                                <input
                                                    type="text"
                                                    value={demographicsForm.city}
                                                    onChange={(e) => setDemographicsForm({ ...demographicsForm, city: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    placeholder="City"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                                <input
                                                    type="text"
                                                    value={demographicsForm.state}
                                                    onChange={(e) => setDemographicsForm({ ...demographicsForm, state: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    placeholder="State"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.zip}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, zip: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="12345"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Insurance */}
                                {demographicsField === 'insurance' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.insurance_provider}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, insurance_provider: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Insurance Company Name"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Policy/Group Number</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.insurance_id}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, insurance_id: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Policy or Group Number"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Pharmacy */}
                                {demographicsField === 'pharmacy' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.pharmacy_name}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, pharmacy_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Pharmacy Name"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Phone</label>
                                            <input
                                                type="tel"
                                                value={demographicsForm.pharmacy_phone}
                                                onChange={(e) => {
                                                    const formatted = formatPhoneInput(e.target.value);
                                                    setDemographicsForm({ ...demographicsForm, pharmacy_phone: formatted });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="(555) 123-4567"
                                                maxLength={14}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Emergency Contact */}
                                {demographicsField === 'emergency' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.emergency_contact_name}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, emergency_contact_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Full Name"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                            <input
                                                type="tel"
                                                value={demographicsForm.emergency_contact_phone}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, emergency_contact_phone: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.emergency_contact_relationship}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, emergency_contact_relationship: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="e.g., Spouse, Parent, Friend"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex space-x-3 pt-2">
                                    <button
                                        onClick={handleSaveDemographics}
                                        className="flex-1 px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>Save</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Clear the field
                                            const clearedForm = { ...demographicsForm };
                                            switch (demographicsField) {
                                                case 'phone':
                                                    clearedForm.phone = '';
                                                    break;
                                                case 'email':
                                                    clearedForm.email = '';
                                                    break;
                                                case 'address':
                                                    clearedForm.address_line1 = '';
                                                    clearedForm.city = '';
                                                    clearedForm.state = '';
                                                    clearedForm.zip = '';
                                                    break;
                                                case 'insurance':
                                                    clearedForm.insurance_provider = '';
                                                    clearedForm.insurance_id = '';
                                                    break;
                                                case 'pharmacy':
                                                    clearedForm.pharmacy_name = '';
                                                    clearedForm.pharmacy_phone = '';
                                                    break;
                                                case 'emergency':
                                                    clearedForm.emergency_contact_name = '';
                                                    clearedForm.emergency_contact_phone = '';
                                                    clearedForm.emergency_contact_relationship = '';
                                                    break;
                                            }
                                            setDemographicsForm(clearedForm);
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDemographicsModal(false);
                                            setDemographicsField(null);
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Unified Patient Chart Panel */}
            <PatientChartPanel
                isOpen={showPatientChart}
                onClose={() => setShowPatientChart(false)}
                patientId={id}
                initialTab={patientChartTab}
            />


            {/* Visit Folders Modal */}
            <VisitFoldersModal
                isOpen={showVisitFoldersModal}
                onClose={() => setShowVisitFoldersModal(false)}
                visits={filteredNotes.map(note => ({
                    id: note.id,
                    type: note.type,
                    date: note.date,
                    time: note.time,
                    dateTime: note.dateTime,
                    visitDate: note.visitDate,
                    createdAt: note.createdAt,
                    provider: note.provider,
                    summary: note.summary,
                    assessment: note.assessment,
                    plan: note.plan,
                    chiefComplaint: note.chiefComplaint,
                    fullNote: note.fullNote,
                    signed: note.signed
                }))}
                onViewVisit={(visitId) => {
                    setShowVisitFoldersModal(false);
                    handleViewNote(visitId);
                }}
                onDeleteVisit={async (visitId) => {
                    await handleDeleteNote(visitId);
                    refreshPatientData();
                    setShowVisitFoldersModal(false);
                }}
            />

            {/* Visit Chart View Modal */}
            {
                selectedVisitForView && (
                    <VisitChartView
                        visitId={selectedVisitForView.visitId}
                        patientId={selectedVisitForView.patientId}
                        onClose={() => setSelectedVisitForView(null)}
                    />
                )
            }


            {/* Document Upload Modal */}
            <Modal
                isOpen={showDocumentUploadModal}
                onClose={() => {
                    setShowDocumentUploadModal(false);
                    setDocumentUploadFile(null);
                    setDocumentUploadType('other');
                    if (documentUploadInputRef.current) {
                        documentUploadInputRef.current.value = '';
                    }
                }}
                title="Upload Document"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                        <select
                            value={documentUploadType}
                            onChange={(e) => setDocumentUploadType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="other">Other</option>
                            <option value="imaging">Imaging</option>
                            <option value="lab">Lab Result</option>
                            <option value="consult">Consult Note</option>
                            <option value="letter">Letter</option>
                            <option value="form">Form</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                        <input
                            ref={documentUploadInputRef}
                            type="file"
                            onChange={(e) => setDocumentUploadFile(e.target.files?.[0] || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        />
                        <p className="text-xs text-gray-500 mt-1">PDF, images, or documents (max 50MB)</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            onClick={() => {
                                setShowDocumentUploadModal(false);
                                setDocumentUploadFile(null);
                                setDocumentUploadType('other');
                                if (documentUploadInputRef.current) {
                                    documentUploadInputRef.current.value = '';
                                }
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDocumentUpload}
                            disabled={!documentUploadFile}
                            className="px-4 py-2 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                        >
                            Upload
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Patient Modal */}
            <Modal
                isOpen={showEditPatientModal}
                onClose={() => setShowEditPatientModal(false)}
                title="Edit Patient Information"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <input
                                type="text"
                                value={editPatientForm.first_name}
                                onChange={(e) => setEditPatientForm({ ...editPatientForm, first_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="First Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <input
                                type="text"
                                value={editPatientForm.last_name}
                                onChange={(e) => setEditPatientForm({ ...editPatientForm, last_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Last Name"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                            <input
                                type="date"
                                value={editPatientForm.dob}
                                onChange={(e) => setEditPatientForm({ ...editPatientForm, dob: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                            <select
                                value={editPatientForm.sex}
                                onChange={(e) => setEditPatientForm({ ...editPatientForm, sex: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Select</option>
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">MRN</label>
                        <input
                            type="text"
                            value={editPatientForm.mrn}
                            onChange={(e) => setEditPatientForm({ ...editPatientForm, mrn: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Medical Record Number"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            onClick={() => setShowEditPatientModal(false)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleEditPatient}
                            className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Enhanced E-Prescribe Modal */}
            {
                hasPrivilege('e_prescribe') && (
                    <EPrescribeEnhanced
                        isOpen={showEPrescribeEnhanced}
                        onClose={() => setShowEPrescribeEnhanced(false)}
                        onSuccess={() => {
                            // Refresh patient data to show new prescription
                            refreshPatientData();
                            setShowEPrescribeEnhanced(false);
                        }}
                        patientId={id}
                    />
                )
            }

            {/* Stress Test Upload Modal */}
            <Modal
                isOpen={showStressTestModal}
                onClose={() => setShowStressTestModal(false)}
                title="Log Cardiac Stress Test"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Test Type</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md font-medium"
                                value={stressTestData.type}
                                onChange={(e) => setStressTestData({ ...stressTestData, type: e.target.value })}
                            >
                                <option value="treadmill">Treadmill (Exercise)</option>
                                <option value="nuclear">Nuclear</option>
                                <option value="spect">SPECT</option>
                                <option value="pet">PET</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Stressor</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md font-medium"
                                value={stressTestData.stressor}
                                onChange={(e) => setStressTestData({ ...stressTestData, stressor: e.target.value })}
                            >
                                <option value="exercise">Exercise</option>
                                <option value="regadenoson">Regadenoson (Lexiscan)</option>
                                <option value="adenosine">Adenosine</option>
                                <option value="dobutamine">Dobutamine</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Date of Test</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border rounded-md"
                            value={stressTestData.date}
                            onChange={(e) => setStressTestData({ ...stressTestData, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Attach Final Report</label>
                        <input
                            type="file"
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-fuchsia-50 file:text-fuchsia-700 hover:file:bg-fuchsia-100"
                            onChange={(e) => setStressTestFile(e.target.files?.[0] || null)}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">METS</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={stressTestData.mets} onChange={e => setStressTestData({ ...stressTestData, mets: e.target.value })} placeholder="e.g. 10.2" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Peak HR</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={stressTestData.peak_hr} onChange={e => setStressTestData({ ...stressTestData, peak_hr: e.target.value })} placeholder="e.g. 165" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">BP Resp</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={stressTestData.bp_response} onChange={e => setStressTestData({ ...stressTestData, bp_response: e.target.value })} placeholder="Normal/Hypertensive" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Results Summary</label>
                        <textarea
                            className="w-full px-3 py-2 border rounded-md h-20"
                            placeholder="e.g. Negative for ischemia, Normal EF 60%"
                            value={stressTestData.notes}
                            onChange={(e) => setStressTestData({ ...stressTestData, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setShowStressTestModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                        <button
                            onClick={handleStressTestUpload}
                            disabled={!stressTestFile}
                            className="px-6 py-2 bg-fuchsia-600 text-white rounded-md font-bold shadow-md hover:bg-fuchsia-700 disabled:bg-gray-300"
                        >
                            Save Result
                        </button>
                    </div>
                </div>
            </Modal>

            {/* EKG Result Modal */}
            <Modal
                isOpen={showEKGModal}
                onClose={() => setShowEKGModal(false)}
                title="Log EKG Study"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                            <input type="date" className="w-full px-3 py-2 border rounded-md" value={ekgData.date} onChange={e => setEKGData({ ...ekgData, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Rhythm</label>
                            <select className="w-full px-3 py-2 border rounded-md" value={ekgData.rhythm} onChange={e => setEKGData({ ...ekgData, rhythm: e.target.value })}>
                                <option value="NSR">NSR</option>
                                <option value="Sinus Brady">Sinus Brady</option>
                                <option value="Sinus Tachy">Sinus Tachy</option>
                                <option value="Afib">Atrial Fibrillation</option>
                                <option value="Aflutter">Atrial Flutter</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Rate</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={ekgData.rate} onChange={e => setEKGData({ ...ekgData, rate: e.target.value })} placeholder="72" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">PR</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={ekgData.pr} onChange={e => setEKGData({ ...ekgData, pr: e.target.value })} placeholder="160" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">QRS</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={ekgData.qrs} onChange={e => setEKGData({ ...ekgData, qrs: e.target.value })} placeholder="90" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">QTc</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={ekgData.qtc} onChange={e => setEKGData({ ...ekgData, qtc: e.target.value })} placeholder="420" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Attach Image/Scan</label>
                        <input type="file" className="w-full text-sm" onChange={e => setEKGFile(e.target.files[0])} accept="image/*,.pdf" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Interpretation</label>
                        <textarea className="w-full px-3 py-2 border rounded-md h-16" value={ekgData.interpretation} onChange={e => setEKGData({ ...ekgData, interpretation: e.target.value })} placeholder="e.g. Normal EKG, no ST changes" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowEKGModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                        <button onClick={handleEKGUpload} disabled={!ekgFile} className="px-6 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 disabled:bg-gray-300">Save EKG</button>
                    </div>
                </div>
            </Modal>

            {/* ECHO Result Modal */}
            <Modal
                isOpen={showECHOModal}
                onClose={() => setShowECHOModal(false)}
                title="Log Echocardiogram"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                            <input type="date" className="w-full px-3 py-2 border rounded-md" value={echoData.date} onChange={e => setECHOData({ ...echoData, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">LVEF (%)</label>
                            <input type="text" className="w-full px-3 py-2 border rounded-md" value={echoData.ef} onChange={e => setECHOData({ ...echoData, ef: e.target.value })} placeholder="e.g. 60-65" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">LA Size</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={echoData.la_size} onChange={e => setECHOData({ ...echoData, la_size: e.target.value })} placeholder="Normal/Enlarged" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">LV Size</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={echoData.lv_size} onChange={e => setECHOData({ ...echoData, lv_size: e.target.value })} placeholder="Normal/Dilated" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">RV Size</label>
                            <input type="text" className="w-full px-2 py-1.5 border rounded-md" value={echoData.rv_size} onChange={e => setECHOData({ ...echoData, rv_size: e.target.value })} placeholder="Normal" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Valve Findings</label>
                        <textarea className="w-full px-3 py-2 border rounded-md h-16" value={echoData.valve_findings} onChange={e => setECHOData({ ...echoData, valve_findings: e.target.value })} placeholder="e.g. Trace MR, No stenosis" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Attach Final Report</label>
                        <input type="file" className="w-full text-sm" onChange={e => setECHOFile(e.target.files[0])} accept=".pdf,image/*" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowECHOModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                        <button onClick={handleECHOUpload} disabled={!echoFile} className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 disabled:bg-gray-300">Save ECHO</button>
                    </div>
                </div>
            </Modal>

            {/* Cardiac Cath Upload Modal */}
            <Modal
                isOpen={showCardiacCathModal}
                onClose={() => setShowCardiacCathModal(false)}
                title="Log Cardiac Catheterization"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Facility / Performing Center</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="e.g. Memorial Hospital"
                            value={cardiacCathData.facility}
                            onChange={(e) => setCardiacCathData({ ...cardiacCathData, facility: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                            <input type="date" className="w-full px-3 py-2 border rounded-md" value={cardiacCathData.date} onChange={e => setCardiacCathData({ ...cardiacCathData, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">LVEF (%)</label>
                            <input type="text" className="w-full px-3 py-2 border rounded-md" value={cardiacCathData.ef} onChange={e => setCardiacCathData({ ...cardiacCathData, ef: e.target.value })} placeholder="e.g. 55" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Coronary Findings</label>
                        <textarea className="w-full px-3 py-2 border rounded-md h-20" value={cardiacCathData.findings} onChange={e => setCardiacCathData({ ...cardiacCathData, findings: e.target.value })} placeholder="e.g. LAD 80% (stented), LCx clean, RCA 40%" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Attach Final Report</label>
                        <input type="file" className="w-full text-sm" onChange={e => setCardiacCathFile(e.target.files[0])} accept=".pdf,image/*" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCardiacCathModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                        <button onClick={handleCardiacCathUpload} disabled={!cardiacCathFile} className="px-6 py-2 bg-slate-700 text-white rounded-md font-bold hover:bg-slate-800 disabled:bg-gray-300">Save Result</button>
                    </div>
                </div>
            </Modal>
            {/* Cardiology Review Center */}
            <CardiologyViewer
                isOpen={showCardiologyViewer}
                onClose={() => setShowCardiologyViewer(false)}
                type={cardiologyViewerType}
                documents={documents}
                patientName={patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
            />
            {
                showPrintOrdersModal && (
                    <PrintOrdersModal
                        patient={{ ...patient, id }}
                        isOpen={showPrintOrdersModal}
                        onClose={() => setShowPrintOrdersModal(false)}
                    />
                )
            }
            {
                showChartReview && (
                    <ChartReviewModal
                        isOpen={showChartReview}
                        onClose={() => setShowChartReview(false)}
                        visits={recentNotes}
                        isLoading={loadingNotes}
                        patientData={{ ...patient, problems, medications, allergies }}
                        onViewFullChart={() => {
                            setShowChartReview(false);
                            setPatientChartTab('history');
                            setShowPatientChart(true);
                        }}
                        onOpenVisit={(visitId) => {
                            navigate(`/patient/${id}/visit/${visitId}`);
                            setShowChartReview(false);
                        }}
                    />
                )
            }
            {/* Specialty Tracker Drawer */}
            <SpecialtyTracker
                isOpen={showSpecialtyTracker}
                onClose={() => setShowSpecialtyTracker(false)}
                patientId={id}
                patientData={patient}
                vitals={vitals}
                labs={orders.filter(o => o.order_type === 'lab')}
                medications={medications}
                documents={documents}
                problems={problems}
                onOpenChart={(tab) => {
                    setShowSpecialtyTracker(false);
                    setPatientChartTab(tab || 'hub');
                    setShowPatientChart(true);
                }}
            />
        </div>
    );
};

/**
 * PatientHeaderPhoto - Displays the patient profile picture with retry logic
 * Defined outside Snapshot component to avoid unnecessary remounts
 */
const PatientHeaderPhoto = ({ firstName, lastName }) => {
    return (
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-primary-300 shadow-md ring-4 ring-white shrink-0 select-none border border-white/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-0"></div>
            <div className="w-full h-full absolute top-0 left-0 bg-gradient-to-tr from-white/0 to-white/40 opacity-50 z-10"></div>
            <User className="w-10 h-10 relative z-20 text-primary-300 opacity-80" strokeWidth={1.5} />
        </div>
    );
};

export default Snapshot;
