import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    AlertCircle, Activity, Pill, FileText, Clock, Eye, ChevronDown, ChevronUp, ChevronRight, Plus,
    Phone, Mail, MapPin, CreditCard, Building2, Users, Heart,
    CheckCircle2, Edit, ArrowRight, ExternalLink, UserCircle, Camera, User, X, FileImage, Save, FlaskConical, Database, Trash2, Upload, Layout, RotateCcw, Waves
} from 'lucide-react';
import { visitsAPI, patientsAPI, ordersAPI, referralsAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';
import { showError, showSuccess } from '../utils/toast';
// GridLayout temporarily disabled to fix 500 error
// TODO: Re-enable with proper implementation
// import GridLayout from 'react-grid-layout';
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
import PatientChartPanel from '../components/PatientChartPanel';
import PatientDataManager from '../components/PatientDataManager';
import VisitFoldersModal from '../components/VisitFoldersModal';
import VisitChartView from '../components/VisitChartView';
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import Modal from '../components/ui/Modal';
import { usePrivileges } from '../hooks/usePrivileges';
import CardiologyViewer from '../components/CardiologyViewer';
// AuthedImg removed
import PatientHeader from '../components/PatientHeader';

const Snapshot = ({ showNotesOnly = false }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

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
    const [patientChartTab, setPatientChartTab] = useState('history');
    const [patientChartDataTab, setPatientChartDataTab] = useState('problems');
    const [showPatientDataManager, setShowPatientDataManager] = useState(false);
    const [patientDataManagerTab, setPatientDataManagerTab] = useState('problems');
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
    const refreshPatientData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Refresh today's draft visit
            await fetchTodayDraft();
            // Fetch patient snapshot (includes basic info)
            const snapshotResponse = await patientsAPI.getSnapshot(id);
            const snapshot = snapshotResponse.data;
            setPatient(snapshot.patient);

            // Also fetch full patient data to ensure we have photo_url
            try {
                const fullPatientResponse = await patientsAPI.get(id);
                if (fullPatientResponse.data) {
                    setPatient(prev => ({ ...prev, ...fullPatientResponse.data }));
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
            if (snapshot.medications && snapshot.medications.length > 0) {
                setMedications(snapshot.medications);
            } else {
                try {
                    const medsResponse = await patientsAPI.getMedications(id);
                    setMedications(medsResponse?.data || []);
                } catch (e) {
                    console.warn('Error fetching medications:', e);
                    setMedications([]);
                }
            }

            // Set allergies
            if (snapshot.allergies && snapshot.allergies.length > 0) {
                setAllergies(snapshot.allergies);
            } else {
                try {
                    const allergiesResponse = await patientsAPI.getAllergies(id);
                    setAllergies(allergiesResponse?.data || []);
                } catch (e) {
                    console.warn('Error fetching allergies:', e);
                    setAllergies([]);
                }
            }

            // Fetch additional data
            try {
                const [familyHistResponse, socialHistResponse, ordersResponse, referralsResponse, docsResponse] = await Promise.all([
                    patientsAPI.getFamilyHistory(id).catch(() => ({ data: [] })),
                    patientsAPI.getSocialHistory(id).catch(() => ({ data: null })),
                    ordersAPI.getByPatient(id).catch(() => ({ data: [] })),
                    referralsAPI.getByPatient(id).catch(() => ({ data: [] })),
                    documentsAPI.getByPatient(id).catch(() => ({ data: [] }))
                ]);

                setFamilyHistory(familyHistResponse?.data || []);
                setSocialHistory(socialHistResponse?.data || null);
                setOrders(ordersResponse?.data || []);
                setReferrals(referralsResponse?.data || []);
                setDocuments(docsResponse?.data || []);
            } catch (error) {
                console.error('Error fetching additional data:', error);
                setFamilyHistory([]);
                setSocialHistory(null);
                setOrders([]);
                setReferrals([]);
            }
        } catch (error) {
            console.error('Could not refresh patient data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch all patient data
    useEffect(() => {
        const fetchAllData = async () => {
            if (!id) return;

            setLoading(true);
            try {
                // Fetch patient snapshot (includes basic info)
                const snapshotResponse = await patientsAPI.getSnapshot(id);
                const snapshot = snapshotResponse.data;
                setPatient(snapshot.patient);

                // Also fetch full patient data to ensure we have photo_url
                try {
                    const fullPatientResponse = await patientsAPI.get(id);
                    if (fullPatientResponse.data) {
                        setPatient(prev => ({ ...prev, ...fullPatientResponse.data }));
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
                if (snapshot.medications && snapshot.medications.length > 0) {
                    setMedications(snapshot.medications);
                } else {
                    try {
                        const medsResponse = await patientsAPI.getMedications(id);
                        setMedications(medsResponse?.data || []);
                    } catch (e) {
                        console.warn('Error fetching medications:', e);
                        setMedications([]);
                    }
                }

                // Set allergies
                if (snapshot.allergies && snapshot.allergies.length > 0) {
                    setAllergies(snapshot.allergies);
                } else {
                    try {
                        const allergiesResponse = await patientsAPI.getAllergies(id);
                        setAllergies(allergiesResponse?.data || []);
                    } catch (e) {
                        console.warn('Error fetching allergies:', e);
                        setAllergies([]);
                    }
                }

                // Set vitals from recent visits
                if (snapshot.recentVisits && snapshot.recentVisits.length > 0) {
                    const vitalsList = snapshot.recentVisits
                        .filter(v => v.vitals)
                        .map(v => {
                            const vData = typeof v.vitals === 'string' ? JSON.parse(v.vitals) : v.vitals;
                            let bpValue = vData.bp || vData.blood_pressure || 'N/A';
                            // Helper to clean potentially double-encoded values
                            const cleanValue = (val) => {
                                if (!val || val === 'N/A') return 'N/A';
                                if (typeof val !== 'string') return val;
                                let str = val;
                                let prev = '';
                                let i = 0;
                                while (str !== prev && i < 5) {
                                    prev = str;
                                    str = str.replace(/&amp;/g, '&')
                                        .replace(/&#x2F;/g, '/')
                                        .replace(/&#47;/g, '/');
                                    i++;
                                }
                                return str;
                            };

                            return {
                                date: new Date(v.visit_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                                bp: cleanValue(bpValue),
                                hr: cleanValue(vData.hr || vData.heart_rate || vData.pulse || 'N/A'),
                                temp: cleanValue(vData.temp || vData.temperature || 'N/A'),
                                rr: cleanValue(vData.rr || vData.respiratory_rate || vData.resp || 'N/A'),
                                spo2: vData.spo2 || vData.oxygen_saturation || vData.o2sat || 'N/A',
                                weight: vData.weight || 'N/A'
                            };
                        });
                    setVitals(vitalsList);
                } else {
                    setVitals([]);
                }

                // Fetch additional data
                try {
                    const [familyHistResponse, socialHistResponse, ordersResponse, referralsResponse, documentsResponse] = await Promise.all([
                        patientsAPI.getFamilyHistory(id).catch(() => ({ data: [] })),
                        patientsAPI.getSocialHistory(id).catch(() => ({ data: null })),
                        ordersAPI.getByPatient(id).catch(() => ({ data: [] })),
                        referralsAPI.getByPatient(id).catch(() => ({ data: [] })),
                        documentsAPI.getByPatient(id).catch(() => ({ data: [] }))
                    ]);

                    setFamilyHistory(familyHistResponse?.data || []);
                    setSocialHistory(socialHistResponse?.data || null);
                    setOrders(ordersResponse?.data || []);
                    setReferrals(referralsResponse?.data || []);
                    setDocuments(documentsResponse?.data || []);
                } catch (error) {
                    console.error('Error fetching additional data:', error);
                    // Set defaults on error
                    setFamilyHistory([]);
                    setSocialHistory(null);
                    setOrders([]);
                    setReferrals([]);
                    setDocuments([]);
                }
            } catch (error) {
                console.error('Could not fetch snapshot from API:', error);
                // Set defaults on error
                setProblems([]);
                setMedications([]);
                setAllergies([]);
                setVitals([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [id]);

    // Listen for data updates from other components (e.g. ActionModals)
    useEffect(() => {
        const handleDataUpdate = () => {
            if (id) {
                refreshPatientData();
            }
        };

        window.addEventListener('patient-data-updated', handleDataUpdate);
        return () => window.removeEventListener('patient-data-updated', handleDataUpdate);
    }, [id, refreshPatientData]); // refreshPatientData is stable via useCallback if it was one, but it's not. I'll make it stable or just depend on id.

    // Check for today's draft visit
    const fetchTodayDraft = useCallback(async () => {
        if (!id) return;
        try {
            console.log('Fetching today\'s draft for patient:', id);
            const response = await visitsAPI.getTodayDraft(id);
            console.log('Today draft response:', response.data);
            // New API returns { note: ... } or { note: null }
            const note = response.data?.note || null;
            console.log('Setting todayDraftVisit to:', note?.id || 'null', note);
            setTodayDraftVisit(note);
            // Force re-render check
            if (note && note.id) {
                console.log('✅ Draft found, should show "Open Today\'s Note" button');
            } else {
                console.log('❌ No draft found, should show "New Visit" button');
            }
        } catch (error) {
            console.error('Error fetching today\'s draft visit:', error);
            console.error('Error details:', error.response?.data || error.message);
            setTodayDraftVisit(null);
        }
    }, [id]);

    useEffect(() => {
        fetchTodayDraft();
    }, [fetchTodayDraft]);

    useEffect(() => {
        const fetchNotes = async () => {
            if (!id) return;
            try {
                setLoadingNotes(true);
                const response = await visitsAPI.getByPatient(id);
                if (response.data && response.data.length > 0) {
                    // Show all visits for this patient in Visit History (both signed and drafts)
                    const formattedNotes = response.data.map(visit => {
                        const noteText = visit.note_draft || "";
                        const hpiMatch = noteText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
                        const planMatch = noteText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n(?:Care Plan|CP|Follow Up|FU):|$)/is);
                        const assessmentMatch = noteText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
                        const carePlanMatch = noteText.match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|\n(?:Follow Up|FU):|$)/is);
                        const followUpMatch = noteText.match(/(?:Follow Up|FU):\s*(.+?)(?:\n\n|$)/is);
                        // Extract chief complaint
                        const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
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
                            createdAt: visit.created_at || visit.visit_date, // Fallback to visit_date if created_at not available
                            fullNote: noteText
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
        const planMatch = noteText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|\n[A-Z]:|$)/is);
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
            // Refresh today's draft visit
            try {
                const draftResponse = await visitsAPI.getTodayDraft(id);
                // New API returns { note: ... } or { note: null }
                setTodayDraftVisit(draftResponse.data?.note || null);
            } catch (error) {
                console.error('Error refreshing today\'s draft visit:', error);
            }
            // Refresh notes
            const response = await visitsAPI.getByPatient(id);
            if (response.data && response.data.length > 0) {
                // Format notes using the same logic as in fetchNotes, but include all visits
                const formattedNotes = response.data.map(visit => {
                    const noteText = visit.note_draft || "";
                    const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                    const chiefComplaint = ccMatch ? ccMatch[1].trim() : null;
                    const visitDateObj = new Date(visit.visit_date);
                    const createdDateObj = visit.created_at ? new Date(visit.created_at) : visitDateObj;
                    const dateStr = visitDateObj.toLocaleDateString();
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
                        chiefComplaint: chiefComplaint,
                        signed: visit.locked || !!visit.note_signed_by,
                    };
                });
                setRecentNotes(formattedNotes);
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Failed to delete note. Please try again.');
        }
    };

    const handleViewNote = (noteId, e) => {
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
            formData.append('file', ekgFile);
            formData.append('patientId', id);
            formData.append('docType', 'imaging');  // Use 'imaging' - 'ekg' is not a valid doc_type. Type is distinguished via tags.
            // Tags for EKG data
            const tags = [
                'ekg',
                `date:${ekgData.date}`,
                `rhythm:${ekgData.rhythm}`,
                `rate:${ekgData.rate}`,
                `qtc:${ekgData.qtc}`,
                `interpretation:${ekgData.interpretation}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));

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
            formData.append('file', echoFile);
            formData.append('patientId', id);
            formData.append('docType', 'imaging');  // Use 'imaging' - 'echo' is not a valid doc_type. Type is distinguished via tags.
            // Tags for ECHO data
            const tags = [
                'echo',
                `date:${echoData.date}`,
                `ef:${echoData.ef}%`,
                `la_size:${echoData.la_size}`,
                `lv_size:${echoData.lv_size}`,
                `valve_findings:${echoData.valve_findings}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));

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
            formData.append('file', stressTestFile);
            formData.append('patientId', id);
            formData.append('docType', 'imaging');
            const tags = [
                'stress_test',
                `type:${stressTestData.type}`,
                `stressor:${stressTestData.stressor}`,
                `mets:${stressTestData.mets}`,
                `peak_hr:${stressTestData.peak_hr}`,
                `bp_response:${stressTestData.bp_response}`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));

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
            formData.append('file', cardiacCathFile);
            formData.append('patientId', id);
            formData.append('docType', 'imaging');
            const tags = [
                'cardiac_cath',
                `facility:${cardiacCathData.facility}`,
                `findings:${cardiacCathData.findings}`,
                `ef:${cardiacCathData.ef}%`
            ].filter(Boolean);
            formData.append('tags', tags.join(','));

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

    const filteredNotes = recentNotes.filter(note => {
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
                                All ({recentNotes.length})
                            </button>
                            <button
                                onClick={() => setNoteFilter('draft')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${noteFilter === 'draft'
                                    ? 'bg-orange-600 text-white font-medium'
                                    : 'bg-white text-ink-700 hover:bg-paper-50 border border-paper-300'
                                    }`}
                            >
                                Draft ({recentNotes.filter(n => !n.signed).length})
                            </button>
                            <button
                                onClick={() => setNoteFilter('signed')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${noteFilter === 'signed'
                                    ? 'bg-green-600 text-white font-medium'
                                    : 'bg-white text-ink-700 hover:bg-paper-50 border border-paper-300'
                                    }`}
                            >
                                Signed ({recentNotes.filter(n => n.signed).length})
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
                                {recentNotes.length === 0
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

                {/* Quick Navigation Bar */}
                <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 mb-4">
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
                                {documents.filter(d => d.doc_type === 'imaging').length > 0 && (
                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        {documents.filter(d => d.doc_type === 'imaging').length}
                                    </span>
                                )}
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
                                {orders.filter(o => o.order_type === 'lab').length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        {orders.filter(o => o.order_type === 'lab').length}
                                    </span>
                                )}
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
                                {documents.filter(d => d.doc_type !== 'imaging').length > 0 && (
                                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        {documents.filter(d => d.doc_type !== 'imaging').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setShowDocumentUploadModal(true)}
                                className="flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Upload Document"
                            >
                                <Upload className="w-3 h-3" />
                            </button>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            {hasPrivilege('e_prescribe') && (
                                <button
                                    onClick={() => setShowEPrescribeEnhanced(true)}
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
                                {orders.filter(o => o.order_type === 'rx').length > 0 && (
                                    <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        {orders.filter(o => o.order_type === 'rx').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setPatientChartTab('referrals');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-primary-700 hover:bg-white rounded-md transition-colors whitespace-nowrap border border-transparent hover:border-gray-300"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-primary-600" />
                                <span>Referral Log</span>
                                {(referrals.length > 0 || orders.filter(o => o.order_type === 'referral').length > 0) && (
                                    <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        {referrals.length + orders.filter(o => o.order_type === 'referral').length}
                                    </span>
                                )}
                            </button>
                        </div>
                        <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                            {/* Primary visit action: New Visit or Open Today's Visit (moved to right side for spacing) */}
                            <div className="relative flex items-center shadow-md rounded-md transition-all hover:shadow-lg group" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!id) {
                                            alert('Patient ID is missing. Please refresh the page.');
                                            return;
                                        }

                                        // If we already have a draft for today, just open it
                                        if (todayDraftVisit && todayDraftVisit.id) {
                                            navigate(`/patient/${id}/visit/${todayDraftVisit.id}`);
                                            return;
                                        }

                                        // Otherwise, create new
                                        handleCreateNewVisit();
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white ${todayDraftVisit && todayDraftVisit.id ? 'rounded-l-md border-r border-blue-400/30' : 'rounded-md'}`}
                                >
                                    {todayDraftVisit && todayDraftVisit.id ? (
                                        <>
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>Open Today&apos;s Visit</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>New Visit</span>
                                        </>
                                    )}
                                </button>

                                {todayDraftVisit && todayDraftVisit.id && (
                                    <>
                                        <button
                                            onClick={() => setShowNewVisitDropdown(!showNewVisitDropdown)}
                                            className="px-1.5 py-1.5 rounded-r-md text-white hover:bg-white/10 h-full flex items-center justify-center transition-colors"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>

                                        {showNewVisitDropdown && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-30"
                                                    onClick={() => setShowNewVisitDropdown(false)}
                                                />
                                                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-40 py-1 animate-fade-in-up">
                                                    <div className="px-3 py-2 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                        Actions
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setShowNewVisitDropdown(false);
                                                            handleCreateNewVisit();
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 flex items-center gap-2 transition-colors"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Start New Visit
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {layoutEditMode && (
                                <button
                                    onClick={resetLayout}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors whitespace-nowrap"
                                    title="Reset to Default Layout"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reset</span>
                                </button>
                            )}

                            {/* Note actions are now in the patient header (Open Chart / New Visit / Open Today's Visit / Telephone Encounter) */}
                        </div>
                    </div>
                </div>

                <div className="px-6">

                    {/* Visit History Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setVisitHistoryExpanded(!visitHistoryExpanded)}
                                    className="hover:bg-gray-100 rounded p-0.5 transition-colors"
                                >
                                    {visitHistoryExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                                <FileText className="w-4 h-4 text-primary-600" />
                                <h2
                                    className="font-semibold text-sm text-gray-900 cursor-pointer hover:text-primary-600 hover:underline transition-colors"
                                    onClick={() => setShowVisitFoldersModal(true)}
                                >
                                    Visit History
                                </h2>
                                {filteredNotes.length > 0 && (
                                    <span className="text-xs text-gray-500">({filteredNotes.length} visits)</span>
                                )}
                            </div>
                            {visitHistoryExpanded && filteredNotes.length > 0 && (
                                <button
                                    onClick={() => setShowVisitFoldersModal(true)}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    View All
                                </button>
                            )}
                        </div>
                        {visitHistoryExpanded && (
                            <div className="p-2">
                                {filteredNotes.length > 0 ? (
                                    <div className="space-y-1">
                                        {filteredNotes.slice(0, 5).map(note => (
                                            <div
                                                key={note.id}
                                                className="px-2 py-1.5 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors relative group"
                                                onClick={() => handleViewNote(note.id)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0 pr-6">
                                                        <div className="flex items-center space-x-2 flex-wrap">
                                                            <span className="text-xs font-medium text-gray-900">{note.type}</span>
                                                            {note.signed ? (
                                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">Signed</span>
                                                            ) : (
                                                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex-shrink-0">Draft</span>
                                                            )}
                                                            <span className="text-xs text-gray-500 flex-shrink-0">{note.dateTime || `${note.date} ${note.time || ''}` || note.date} • {note.provider}</span>
                                                            {note.chiefComplaint && (
                                                                <span className="text-xs text-gray-700 italic">
                                                                    • "{note.chiefComplaint.substring(0, 60)}{note.chiefComplaint.length > 60 ? '...' : ''}"
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 absolute right-2 top-1/2 transform -translate-y-1/2">
                                                        {!note.signed && (
                                                            <button
                                                                onClick={(e) => handleDeleteNote(note.id, e)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                                                                title="Delete draft"
                                                            >
                                                                <Trash2 className="w-3 h-3 text-red-600" />
                                                            </button>
                                                        )}
                                                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredNotes.length > 5 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowVisitFoldersModal(true);
                                                }}
                                                className="w-full text-center text-xs text-primary-600 hover:text-primary-700 py-1.5"
                                            >
                                                View {filteredNotes.length - 5} more visits
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 text-center py-4">No visits recorded</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Modular Grid - With Layout Editor Support */}
                    <div className="mb-6">
                        {layoutEditMode ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-blue-800">
                                        <strong>Layout Editor Mode:</strong> The drag-and-drop layout editor is currently being set up.
                                        For now, please exit edit mode to view your modules. Full functionality coming soon!
                                    </p>
                                    <button
                                        onClick={() => setLayoutEditMode(false)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {!layoutEditMode ? (
                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                                {/* Left Column: Compact Reference Cards */}
                                <div className="lg:col-span-1 space-y-4">
                                    {/* Allergies Module - Smallest Card */}
                                    <div className="bg-white rounded-lg shadow-sm border border-red-100 hover:shadow-md transition-shadow">
                                        <div className="p-1.5 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-1">
                                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                                <h3 className="font-semibold text-[11px] text-gray-900 uppercase tracking-wider">Allergies</h3>
                                                {allergies.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 font-bold">({allergies.length})</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setPatientDataManagerTab('allergies');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-[9px] text-primary-600 hover:text-primary-700 font-bold"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                        <div className="p-1.5">
                                            {allergies.length > 0 ? (
                                                <div className="space-y-1">
                                                    {allergies.slice(0, 3).map(allergy => (
                                                        <div key={allergy.id} className="pb-1 border-b border-gray-50 last:border-b-0 last:pb-0">
                                                            <p className="font-bold text-[10px] text-red-900 leading-tight">{allergy.allergen}</p>
                                                            {allergy.reaction && (
                                                                <p className="text-[9px] text-gray-600 leading-tight truncate">Rxn: {allergy.reaction}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {allergies.length > 3 && (
                                                        <p className="text-[9px] text-gray-400 text-center font-medium pt-0.5">+{allergies.length - 3} more</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-gray-500 text-center py-1 font-bold">NKA</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Family History Module - Compact */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                        <div className="p-1.5 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-1">
                                                <Heart className="w-3.5 h-3.5 text-purple-600" />
                                                <h3 className="font-semibold text-[11px] text-gray-900 uppercase tracking-wider">Family Hx</h3>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setPatientDataManagerTab('family');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-[9px] text-primary-600 hover:text-primary-700 font-bold"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                        <div className="p-1.5">
                                            {familyHistory.length > 0 ? (
                                                <div className="space-y-1">
                                                    {familyHistory.slice(0, 3).map(hist => (
                                                        <div key={hist.id} className="pb-1 border-b border-gray-50 last:border-b-0 last:pb-0">
                                                            <p className="font-bold text-[10px] text-purple-900 leading-tight">{hist.condition}</p>
                                                            <p className="text-[9px] text-gray-600 leading-tight">{hist.relationship}</p>
                                                        </div>
                                                    ))}
                                                    {familyHistory.length > 3 && (
                                                        <p className="text-[9px] text-gray-400 text-center font-medium pt-0.5">+{familyHistory.length - 3} more</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-gray-400 text-center py-1 italic">Not recorded</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Social History Module - Compact */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                        <div className="p-1.5 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-1">
                                                <UserCircle className="w-3.5 h-3.5 text-blue-600" />
                                                <h3 className="font-semibold text-[11px] text-gray-900 uppercase tracking-wider">Social Hx</h3>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setPatientDataManagerTab('social');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-[9px] text-primary-600 hover:text-primary-700 font-bold"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                        <div className="p-1.5">
                                            {socialHistory ? (
                                                <div className="space-y-1 text-[10px]">
                                                    {socialHistory.smoking_status && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Smoking:</span>
                                                            <span className="font-bold text-gray-900">{socialHistory.smoking_status}</span>
                                                        </div>
                                                    )}
                                                    {socialHistory.alcohol_use && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Alcohol:</span>
                                                            <span className="font-bold text-gray-900">{socialHistory.alcohol_use}</span>
                                                        </div>
                                                    )}
                                                    {socialHistory.exercise_frequency && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Exercise:</span>
                                                            <span className="font-bold text-gray-900">{socialHistory.exercise_frequency}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-gray-400 text-center py-1 italic">Not recorded</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Main Grid */}
                                <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {/* Medications Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-emerald-50/50">
                                            <div className="flex items-center space-x-1.5">
                                                <Pill className="w-4 h-4 text-emerald-600" />
                                                <h3 className="font-bold text-sm text-gray-900">Medications</h3>
                                                {medications.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{medications.length}</span>}
                                            </div>
                                            <button onClick={() => { setPatientDataManagerTab('medications'); setShowPatientDataManager(true); }} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold uppercase tracking-wider">Manage</button>
                                        </div>
                                        <div className="p-2 max-h-[200px] overflow-y-auto">
                                            {medications.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {medications.filter(m => m.active !== false).slice(0, 10).map(med => (
                                                        <div key={med.id} className="pb-1 border-b border-gray-50 last:border-b-0">
                                                            <p className="font-bold text-xs text-gray-900 truncate">{med.medication_name}</p>
                                                            <p className="text-[10px] text-gray-600">{med.dosage} {med.frequency}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-6">No active medications</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Problem List Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-orange-50/50">
                                            <div className="flex items-center space-x-1.5">
                                                <AlertCircle className="w-4 h-4 text-orange-600" />
                                                <h3 className="font-bold text-sm text-gray-900">Problem List</h3>
                                                {problems.length > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{problems.length}</span>}
                                            </div>
                                            <button onClick={() => { setPatientDataManagerTab('problems'); setShowPatientDataManager(true); }} className="text-[10px] text-orange-600 hover:text-orange-700 font-bold uppercase tracking-wider">Manage</button>
                                        </div>
                                        <div className="p-2 max-h-[200px] overflow-y-auto">
                                            {problems.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {problems.filter(p => p.status === 'active').slice(0, 10).map(prob => (
                                                        <div key={prob.id} className="pb-1 border-b border-gray-50 last:border-b-0 flex items-center justify-between gap-2">
                                                            <p className="font-bold text-xs text-gray-900 truncate">{prob.name || prob.problem_name}</p>
                                                            <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded font-bold uppercase">Active</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-6">No active problems</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Vitals Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-blue-50/50">
                                            <div className="flex items-center space-x-2">
                                                <Activity className="w-4 h-4 text-blue-600" />
                                                <h3 className="font-bold text-sm text-gray-900">Recent Vitals</h3>
                                            </div>
                                            <button onClick={() => { setPatientChartTab('history'); setShowPatientChart(true); }} className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase tracking-wider">View All</button>
                                        </div>
                                        <div className="p-2 space-y-2">
                                            {vitals.slice(0, 1).map((vital, idx) => (
                                                <div key={idx} className="bg-blue-50/30 rounded-lg p-2 border border-blue-100/50">
                                                    <div className="grid grid-cols-2 gap-y-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase">BP</span>
                                                            <span className="text-sm font-medium text-blue-900">{vital.bp || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase">HR</span>
                                                            <span className="text-sm font-medium text-blue-900">{vital.hr || 'N/A'} <span className="text-[10px] font-medium text-gray-400">bpm</span></span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase">SpO2</span>
                                                            <span className="text-sm font-medium text-blue-900">{vital.spo2 || 'N/A'}%</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Temp</span>
                                                            <span className="text-sm font-medium text-blue-900">{vital.temp || 'N/A'}°F</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] text-gray-400 font-bold mt-2 text-right">{new Date(vital.date).toLocaleDateString()} {vital.time}</p>
                                                </div>
                                            ))}
                                            {vitals.length === 0 && <p className="text-xs text-gray-500 text-center py-6">No vitals recorded</p>}
                                        </div>
                                    </div>

                                    {/* Cardiology Studies Section */}
                                    {/* EKG Studies */}
                                    <div className="bg-white rounded-lg shadow-sm border border-red-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-red-50/50">
                                            <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setCardiologyViewerType('EKG'); setShowCardiologyViewer(true); }}>
                                                <Activity className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                                                <h3 className="font-bold text-sm text-gray-900 group-hover:text-red-600 transition-colors">EKG</h3>
                                                {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('ekg') || d.file_name?.toLowerCase().includes('ekg'))).length > 0 &&
                                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('ekg') || d.file_name?.toLowerCase().includes('ekg'))).length}</span>
                                                }
                                            </div>
                                            <button onClick={() => setShowEKGModal(true)} className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('ekg') || d.file_name?.toLowerCase().includes('ekg'))).slice(0, 3).map(doc => {
                                                const rhythm = doc.tags?.find(t => t.startsWith('rhythm:'))?.split(':')[1] || '';
                                                const rate = doc.tags?.find(t => t.startsWith('rate:'))?.split(':')[1] || '';
                                                return (
                                                    <div key={doc.id} className="flex flex-col p-2 bg-red-50/30 rounded border border-red-100/50 hover:bg-red-50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-red-900 text-[11px] truncate">{doc.file_name || 'EKG'}</span>
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-red-500 text-[10px] whitespace-nowrap">{new Date(doc.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        {(rhythm || rate) && (
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {rhythm && <span className="text-[9px] px-1 bg-white border border-red-100 rounded text-red-700 font-bold uppercase">{rhythm}</span>}
                                                                {rate && <span className="text-[9px] text-gray-500 font-medium">{rate} bpm</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('ekg') || d.file_name?.toLowerCase().includes('ekg'))).length === 0 && <p className="text-xs text-gray-500 text-center py-4">No EKGs recorded</p>}
                                        </div>
                                    </div>

                                    {/* ECHO Studies */}
                                    <div className="bg-white rounded-lg shadow-sm border border-indigo-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-indigo-50/50">
                                            <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setCardiologyViewerType('ECHO'); setShowCardiologyViewer(true); }}>
                                                <Heart className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                                                <h3 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">ECHO</h3>
                                                {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('echo') || d.file_name?.toLowerCase().includes('echo') || d.file_name?.toLowerCase().includes('echocardiogram'))).length > 0 &&
                                                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('echo') || d.file_name?.toLowerCase().includes('echo') || d.file_name?.toLowerCase().includes('echocardiogram'))).length}</span>
                                                }
                                            </div>
                                            <button onClick={() => setShowECHOModal(true)} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('echo') || d.file_name?.toLowerCase().includes('echo') || d.file_name?.toLowerCase().includes('echocardiogram'))).slice(0, 3).map(doc => {
                                                const ef = doc.tags?.find(t => t.startsWith('ef:'))?.split(':')[1] || '';
                                                const la = doc.tags?.find(t => t.startsWith('la_size:'))?.split(':')[1] || '';
                                                const lv = doc.tags?.find(t => t.startsWith('lv_size:'))?.split(':')[1] || '';
                                                return (
                                                    <div key={doc.id} className="flex flex-col p-2 bg-indigo-50/30 rounded border border-indigo-100/50 hover:bg-indigo-50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-indigo-900 text-[11px] truncate">{doc.file_name || 'Echo Study'}</span>
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-indigo-500 text-[10px] whitespace-nowrap">{new Date(doc.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        {(ef || la || lv) && (
                                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                                {ef && <span className="text-[9px] px-1 bg-white border border-indigo-100 rounded text-indigo-700 font-black">EF {ef}</span>}
                                                                {la && <span className="text-[9px] text-gray-500">LA: <span className="font-bold">{la}</span></span>}
                                                                {lv && <span className="text-[9px] text-gray-500">LV: <span className="font-bold">{lv}</span></span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {documents.filter(d => d.doc_type === 'imaging' && (d.tags?.includes('echo') || d.file_name?.toLowerCase().includes('echo') || d.file_name?.toLowerCase().includes('echocardiogram'))).length === 0 && <p className="text-xs text-gray-500 text-center py-4">No ECHO studies</p>}
                                        </div>
                                    </div>

                                    {/* Stress Tests (New) */}
                                    <div className="bg-white rounded-lg shadow-sm border border-fuchsia-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-fuchsia-50/50">
                                            <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setCardiologyViewerType('STRESS'); setShowCardiologyViewer(true); }}>
                                                <Activity className="w-4 h-4 text-fuchsia-600 group-hover:scale-110 transition-transform" />
                                                <h3 className="font-bold text-sm text-gray-900 group-hover:text-fuchsia-600 transition-colors">Stress Test</h3>
                                                {(documents.filter(d => d.tags?.includes('stress_test')).length > 0 || documents.filter(d => d.doc_type === 'imaging' && d.file_name?.toLowerCase().includes('stress')).length > 0) &&
                                                    <span className="bg-fuchsia-100 text-fuchsia-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{documents.filter(d => d.tags?.includes('stress_test') || (d.doc_type === 'imaging' && d.file_name?.toLowerCase().includes('stress'))).length}</span>
                                                }
                                            </div>
                                            <button onClick={() => setShowStressTestModal(true)} className="p-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700 transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {documents.filter(d => d.tags?.includes('stress_test')).slice(0, 3).map(doc => {
                                                const typeTag = doc.tags?.find(t => t.startsWith('type:'))?.split(':')[1] || '';
                                                const stressorTag = doc.tags?.find(t => t.startsWith('stressor:'))?.split(':')[1] || '';
                                                return (
                                                    <div key={doc.id} className="block text-[11px] p-2 bg-fuchsia-50/30 rounded border border-fuchsia-100/50 hover:bg-fuchsia-50 transition-colors cursor-pointer" onClick={() => { setPatientChartTab('images'); setShowPatientChart(true); }}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-black text-fuchsia-900 uppercase tracking-tighter">{typeTag || 'Cardiac Stress'}</span>
                                                            <span className="text-fuchsia-500 font-bold">{new Date(doc.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 bg-white border border-fuchsia-100 rounded text-[9px] font-bold text-fuchsia-700 uppercase">{stressorTag}</span>
                                                            <span className="truncate text-gray-500 italic">{doc.file_name}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {documents.filter(d => d.tags?.includes('stress_test')).length === 0 && <p className="text-xs text-gray-500 text-center py-4">No Stress tests recorded</p>}
                                        </div>
                                    </div>

                                    {/* Cardiac Cath (New) */}
                                    <div className="bg-white rounded-lg shadow-sm border border-slate-300 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-slate-50/50">
                                            <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setCardiologyViewerType('CATH'); setShowCardiologyViewer(true); }}>
                                                <Waves className="w-4 h-4 text-slate-700 group-hover:scale-110 transition-transform" />
                                                <h3 className="font-bold text-sm text-gray-900 group-hover:text-slate-700 transition-colors">Cardiac Cath</h3>
                                                {(documents.filter(d => d.tags?.includes('cardiac_cath')).length > 0 || documents.filter(d => d.doc_type === 'imaging' && d.file_name?.toLowerCase().includes('cath')).length > 0) &&
                                                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{documents.filter(d => d.tags?.includes('cardiac_cath') || (d.doc_type === 'imaging' && d.file_name?.toLowerCase().includes('cath'))).length}</span>
                                                }
                                            </div>
                                            <button onClick={() => setShowCardiacCathModal(true)} className="p-1 bg-slate-700 text-white rounded hover:bg-slate-800 transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {documents.filter(d => d.tags?.includes('cardiac_cath')).slice(0, 3).map(doc => {
                                                const facility = doc.tags?.find(t => t.startsWith('facility:'))?.split(':')[1] || '';
                                                return (
                                                    <div key={doc.id} className="block text-[11px] p-2 bg-slate-50/30 rounded border border-slate-200/50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setPatientChartTab('images'); setShowPatientChart(true); }}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-black text-slate-900 uppercase tracking-tighter">{facility || 'Cardiac Cath'}</span>
                                                            <span className="text-slate-500 font-bold">{new Date(doc.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <span className="truncate text-gray-500 italic text-[10px]">{doc.file_name}</span>
                                                    </div>
                                                );
                                            })}
                                            {documents.filter(d => d.tags?.includes('cardiac_cath')).length === 0 && <p className="text-xs text-gray-500 text-center py-4">No Cardiac Cath records</p>}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ) : null}
                    </div>

                </div>

                {/* Demographics Modal */}
                {showDemographicsModal && demographicsField && (
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
                )}

                {/* Unified Patient Chart Panel */}
                <PatientChartPanel
                    patientId={id}
                    isOpen={showPatientChart}
                    onClose={() => setShowPatientChart(false)}
                    initialTab={patientChartTab}
                    initialDataTab={patientChartDataTab}
                    onOpenDataManager={(tab) => {
                        setShowPatientChart(false);
                        setPatientDataManagerTab(tab);
                        setShowPatientDataManager(true);
                    }}
                />

                {/* Patient Data Manager - Opens separately, not stacked */}
                <PatientDataManager
                    patientId={id}
                    isOpen={showPatientDataManager}
                    initialTab={patientDataManagerTab}
                    onClose={() => setShowPatientDataManager(false)}
                    onUpdate={refreshPatientData}
                    onBack={() => {
                        setShowPatientDataManager(false);
                        setShowPatientChart(true);
                        setPatientChartTab('data');
                        setPatientChartDataTab(patientDataManagerTab);
                    }}
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
                {selectedVisitForView && (
                    <VisitChartView
                        visitId={selectedVisitForView.visitId}
                        patientId={selectedVisitForView.patientId}
                        onClose={() => setSelectedVisitForView(null)}
                    />
                )}


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
                {hasPrivilege('e_prescribe') && (
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
                )}

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
            </div>
            {/* Cardiology Review Center */}
            <CardiologyViewer
                isOpen={showCardiologyViewer}
                onClose={() => setShowCardiologyViewer(false)}
                type={cardiologyViewerType}
                documents={documents}
                patientName={patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
            />
        </div >
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
