import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    AlertCircle, Activity, Pill, FileText, Clock, Eye, ChevronDown, ChevronUp, ChevronRight, Plus,
    Phone, Mail, MapPin, CreditCard, Building2, Users, Heart, Calendar, Stethoscope, CheckCircle2,
    Edit, ArrowRight, ExternalLink, UserCircle, Camera, User, X, FileImage, Save, FlaskConical,
    Database, Trash2, Upload, Layout, RotateCcw, FileSearch, Ruler, Calculator
} from 'lucide-react';
import { visitsAPI, patientsAPI, ordersAPI, referralsAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';
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

const Snapshot = ({ showNotesOnly = false }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [patient, setPatient] = useState(null);
    const [recentNotes, setRecentNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [todaysOpenNote, setTodaysOpenNote] = useState(null); // Track today's open (unsigned) note
    const [showNewVisitDropdown, setShowNewVisitDropdown] = useState(false); // Dropdown for new visit options
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
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [photoMode, setPhotoMode] = useState(null);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [photoVersion, setPhotoVersion] = useState(0); // Track photo updates for cache busting
    const fileInputRef = React.useRef(null);
    const videoRef = React.useRef(null);
    const [webcamStream, setWebcamStream] = useState(null);
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
    const [showEKGUploadModal, setShowEKGUploadModal] = useState(false);
    const [ekgUploadFile, setEkgUploadFile] = useState(null);
    const [selectedEKG, setSelectedEKG] = useState(null);
    const [showEKGViewer, setShowEKGViewer] = useState(false);
    const [ekgViewerMode, setEkgViewerMode] = useState('view'); // 'view', 'interpret', 'measure'
    const [showECHOUploadModal, setShowECHOUploadModal] = useState(false);
    const [echoUploadFile, setEchoUploadFile] = useState(null);
    const [selectedECHO, setSelectedECHO] = useState(null);
    const [showECHOViewer, setShowECHOViewer] = useState(false);
    const [echoViewerMode, setEchoViewerMode] = useState('view'); // 'view', 'calculate', 'measure'
    const { hasPrivilege } = usePrivileges();
    const [editPatientForm, setEditPatientForm] = useState({
        first_name: '',
        last_name: '',
        dob: '',
        sex: '',
        mrn: ''
    });
    const documentUploadInputRef = React.useRef(null);
    const ekgUploadInputRef = React.useRef(null);
    const echoUploadInputRef = React.useRef(null);

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

    // Function to refresh all patient data
    const refreshPatientData = async () => {
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

            // Fetch additional data
            try {
                const [familyHistResponse, socialHistResponse] = await Promise.all([
                    patientsAPI.getFamilyHistory(id).catch(() => ({ data: [] })),
                    patientsAPI.getSocialHistory(id).catch(() => ({ data: null }))
                ]);

                setFamilyHistory(familyHistResponse?.data || []);
                setSocialHistory(socialHistResponse?.data || null);
            } catch (error) {
                console.error('Error fetching additional data:', error);
                setFamilyHistory([]);
                setSocialHistory(null);
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
                            if (bpValue !== 'N/A' && typeof bpValue === 'string') {
                                bpValue = bpValue.replace(/&#x2F;/g, '/').replace(/&#47;/g, '/');
                            }
                            return {
                                date: new Date(v.visit_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                                bp: bpValue,
                                hr: vData.hr || vData.heart_rate || vData.pulse || 'N/A',
                                temp: vData.temp || vData.temperature || 'N/A',
                                rr: vData.rr || vData.respiratory_rate || vData.resp || 'N/A',
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

    useEffect(() => {
        const fetchNotes = async () => {
            if (!id) return;
            try {
                setLoadingNotes(true);
                const response = await visitsAPI.getByPatient(id);
                if (response.data && response.data.length > 0) {
                    // Check for today's open (unsigned) note
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const openNoteToday = response.data.find(visit => {
                        if (!visit.note_draft || !visit.note_draft.trim()) return false;
                        // Check if note is unsigned (not locked and not signed)
                        const isUnsigned = !visit.locked && !visit.note_signed_by && !visit.note_signed_at;
                        if (!isUnsigned) return false;

                        // Check if visit_date is today
                        const visitDate = new Date(visit.visit_date);
                        visitDate.setHours(0, 0, 0, 0);
                        return visitDate.getTime() === today.getTime();
                    });

                    setTodaysOpenNote(openNoteToday || null);

                    // Show all visits, not just those with note_draft content
                    const notesToShow = response.data;

                    const formattedNotes = notesToShow.map(visit => {
                        const noteText = visit.note_draft || "";
                        const hpiMatch = noteText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
                        const planMatch = noteText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|$)/is);
                        const assessmentMatch = noteText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
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
                    setTodaysOpenNote(null);
                }
            } catch (error) {
                console.error('Could not fetch notes from API:', error);
                setRecentNotes([]);
                setTodaysOpenNote(null);
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
            // First, try to delete any associated orders and referrals manually
            // This is a fallback in case the backend doesn't handle it properly
            try {
                // Delete orders (ignore 404s - order might already be deleted or endpoint might not exist)
                try {
                    const ordersRes = await ordersAPI.getByVisit(noteId);
                    const ordersForVisit = Array.isArray(ordersRes.data) ? ordersRes.data : [];

                    for (const order of ordersForVisit) {
                        try {
                            await ordersAPI.delete(order.id).catch(() => {
                                // Ignore 404s - order might already be deleted
                            });
                        } catch (orderErr) {
                            if (orderErr.response?.status !== 404) {
                                console.warn('Error deleting order', order.id, orderErr);
                            }
                            // Continue even if one order fails
                        }
                    }
                } catch (ordersErr) {
                    if (ordersErr.response?.status !== 404) {
                        console.warn('Error fetching orders for visit', noteId, ordersErr);
                    }
                }

                // Delete referrals (ignore 404s - referral might already be deleted or endpoint might not exist)
                try {
                    const referralsRes = await referralsAPI.getByVisit(noteId);
                    const referralsForVisit = Array.isArray(referralsRes.data) ? referralsRes.data : [];

                    for (const referral of referralsForVisit) {
                        try {
                            await referralsAPI.delete(referral.id).catch(() => {
                                // Ignore 404s - referral might already be deleted
                            });
                        } catch (referralErr) {
                            if (referralErr.response?.status !== 404) {
                                console.warn('Error deleting referral', referral.id, referralErr);
                            }
                            // Continue even if one referral fails
                        }
                    }
                } catch (referralsErr) {
                    if (referralsErr.response?.status !== 404) {
                        console.warn('Error fetching referrals for visit', noteId, referralsErr);
                    }
                }
            } catch (childErr) {
                console.warn('Error fetching/deleting child records for visit', noteId, childErr);
                // Continue with visit deletion even if child deletion fails
            }

            // Now delete the visit (backend should handle cleanup, but we tried frontend cleanup first)
            await visitsAPI.delete(noteId);
            // Refresh notes
            const response = await visitsAPI.getByPatient(id);
            if (response.data && response.data.length > 0) {
                // Show all visits, not just those with note_draft content
                const notesToShow = response.data;
                // Format notes using the same logic as in fetchNotes
                const formattedNotes = notesToShow.map(visit => {
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
            console.error('Error response:', error.response?.data);

            let errorMessage = 'Failed to delete note. Please try again.';

            if (error.response?.status === 403) {
                errorMessage = error.response?.data?.error || 'Cannot delete signed notes. Once a note is signed, it cannot be deleted.';
            } else if (error.response?.status === 404) {
                errorMessage = 'Note not found. It may have already been deleted.';
            } else if (error.response?.status === 500) {
                // Check for foreign key constraint errors
                const errorDetails = error.response?.data?.details || error.response?.data?.error || '';
                if (errorDetails.includes('foreign key') || errorDetails.includes('orders_visit_id_fkey') || errorDetails.includes('referrals_visit_id_fkey')) {
                    errorMessage = 'This note has associated orders or referrals. The system should automatically delete them, but if this error persists, please contact support.';
                } else {
                    errorMessage = error.response?.data?.error || 'Server error occurred while deleting the note. Please try again or contact support.';
                }
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }

            alert(errorMessage);

            // Refresh notes list even on error to ensure UI is up to date
            try {
                const response = await visitsAPI.getByPatient(id);
                if (response.data && response.data.length > 0) {
                    // Show all visits, not just those with note_draft content
                    const notesToShow = response.data;
                    const formattedNotes = notesToShow.map(visit => {
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
                                return ((visit.locked || visit.note_signed_by) && signedByName && signedByName !== 'System Administrator')
                                    ? signedByName
                                    : providerNameFallback;
                            })(),
                            chiefComplaint: chiefComplaint,
                            signed: visit.locked || !!visit.note_signed_by,
                        };
                    });
                    setRecentNotes(formattedNotes);
                } else {
                    setRecentNotes([]);
                }
            } catch (refreshError) {
                console.error('Error refreshing notes after delete failure:', refreshError);
            }
        }
    };

    const handleViewNote = (noteId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const note = recentNotes.find(n => n.id === noteId) || filteredNotes.find(n => n.id === noteId);
        if (note && !note.signed) {
            navigate(`/patient/${id}/visit/${noteId}`);
        } else {
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

    const handleEKGUpload = async () => {
        if (!ekgUploadFile || !id) return;

        try {
            const formData = new FormData();
            formData.append('file', ekgUploadFile);
            formData.append('patientId', id);
            formData.append('docType', 'ekg');

            await documentsAPI.upload(formData);

            // Refresh documents
            const docsResponse = await documentsAPI.getByPatient(id);
            const docs = docsResponse.data || [];
            setDocuments(docs);

            // Close modal and reset
            setShowEKGUploadModal(false);
            setEkgUploadFile(null);
            if (ekgUploadInputRef.current) {
                ekgUploadInputRef.current.value = '';
            }

            alert('EKG uploaded successfully!');
        } catch (error) {
            console.error('Error uploading EKG:', error);
            alert('Failed to upload EKG. Please try again.');
        }
    };

    const handleECHOUpload = async () => {
        if (!echoUploadFile || !id) return;

        try {
            const formData = new FormData();
            formData.append('file', echoUploadFile);
            formData.append('patientId', id);
            formData.append('docType', 'echo');

            await documentsAPI.upload(formData);

            // Refresh documents
            const docsResponse = await documentsAPI.getByPatient(id);
            const docs = docsResponse.data || [];
            setDocuments(docs);

            // Close modal and reset
            setShowECHOUploadModal(false);
            setEchoUploadFile(null);
            if (echoUploadInputRef.current) {
                echoUploadInputRef.current.value = '';
            }

            alert('ECHO uploaded successfully!');
        } catch (error) {
            console.error('Error uploading ECHO:', error);
            alert('Failed to upload ECHO. Please try again.');
        }
    };

    // Filter EKG documents from all documents
    const ekgDocuments = useMemo(() => {
        return documents
            .filter(doc => doc.doc_type === 'ekg' || doc.doc_type === 'EKG' || (doc.filename && String(doc.filename).toLowerCase().includes('ekg')))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }, [documents]);

    // Filter ECHO documents from all documents
    const echoDocuments = useMemo(() => {
        return documents
            .filter(doc => doc.doc_type === 'echo' || doc.doc_type === 'ECHO' || (doc.filename && String(doc.filename).toLowerCase().includes('echo')))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }, [documents]);

    const handleViewEKG = (ekgDoc) => {
        setSelectedEKG(ekgDoc);
        setEkgViewerMode('view');
        setShowEKGViewer(true);
    };

    const handleInterpretEKG = (ekgDoc) => {
        setSelectedEKG(ekgDoc);
        setEkgViewerMode('interpret');
        setShowEKGViewer(true);
    };

    const handleMeasureEKG = (ekgDoc) => {
        setSelectedEKG(ekgDoc);
        setEkgViewerMode('measure');
        setShowEKGViewer(true);
    };

    const handleViewECHO = (echoDoc) => {
        setSelectedECHO(echoDoc);
        setEchoViewerMode('view');
        setShowECHOViewer(true);
    };

    const handleCalculateECHO = (echoDoc) => {
        setSelectedECHO(echoDoc);
        setEchoViewerMode('calculate');
        setShowECHOViewer(true);
    };

    const handleMeasureECHO = (echoDoc) => {
        setSelectedECHO(echoDoc);
        setEchoViewerMode('measure');
        setShowECHOViewer(true);
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

            // Close modal and reset
            setShowEditPatientModal(false);

            alert('Patient information updated successfully!');
        } catch (error) {
            console.error('Error updating patient:', error);
            alert('Failed to update patient information. Please try again.');
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

    // Photo upload functions
    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setWebcamStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing webcam:', error);
        }
    };

    const stopWebcam = () => {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            setWebcamStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedPhoto(dataUrl);
            stopWebcam();
        }
    };

    const handleFileUpload = (e) => {
        console.log('handleFileUpload called', e.target.files);
        const file = e.target.files?.[0];
        if (file) {
            console.log('File selected:', file.name, file.type, file.size);
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
                e.target.value = ''; // Reset file input
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                e.target.value = ''; // Reset file input
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                console.log('File read complete, setting captured photo');
                setCapturedPhoto(reader.result);
                setPhotoMode('upload'); // Ensure photoMode is set
            };
            reader.onerror = () => {
                console.error('Error reading file');
                alert('Error reading file. Please try again.');
                e.target.value = ''; // Reset file input
            };
            reader.readAsDataURL(file);
        } else {
            console.log('No file selected');
        }
    };

    const handleSavePhoto = async () => {
        if (!capturedPhoto || !id) return;
        try {
            const uploadResponse = await patientsAPI.uploadPhotoBase64(id, capturedPhoto);
            console.log('Photo upload response:', uploadResponse);

            // Update patient state with new photo_url immediately
            if (uploadResponse.data?.photoUrl || uploadResponse.data?.patient?.photo_url) {
                const newPhotoUrl = uploadResponse.data?.photoUrl || uploadResponse.data?.patient?.photo_url;
                setPatient(prev => ({
                    ...prev,
                    photo_url: newPhotoUrl
                }));
                // Increment photo version to force cache bust
                setPhotoVersion(prev => prev + 1);
            }

            setShowPhotoModal(false);
            setPhotoMode(null);
            setCapturedPhoto(null);

            // Refresh patient data after a short delay to ensure everything is synced
            setTimeout(() => {
                patientsAPI.get(id).then(res => {
                    if (res.data) {
                        setPatient(prev => ({
                            ...prev,
                            ...res.data,
                            photo_url: res.data.photo_url
                        }));
                        // Increment photo version again after refresh
                        setPhotoVersion(prev => prev + 1);
                    }
                }).catch(err => console.error('Error refreshing patient:', err));
            }, 300);
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        }
    };

    React.useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [webcamStream]);

    // Generate photo URL with cache-busting (must be before early returns)
    const photoUrl = useMemo(() => {
        if (!patient?.photo_url) return null;
        const baseUrl = patient.photo_url.startsWith('http')
            ? patient.photo_url
            : patient.photo_url.startsWith('/')
                ? patient.photo_url
                : `/api${patient.photo_url}`;
        return `${baseUrl}?v=${photoVersion}`;
    }, [patient?.photo_url, photoVersion]);

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
            <div className="max-w-7xl mx-auto">
                {/* Patient Hub Header Section */}
                <div className="bg-white border-b border-gray-200 shadow-sm mb-6">
                    {/* Patient Info Header */}
                    <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(to right, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08), transparent)' }}>
                        <div className="flex items-center justify-between">
                            {/* Left: Photo and Basic Info */}
                            <div className="flex items-center space-x-4">
                                {/* Patient Photo */}
                                <button
                                    onClick={() => setShowPhotoModal(true)}
                                    className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-300 transition-all cursor-pointer relative group overflow-hidden flex-shrink-0 ring-2 ring-white shadow-md"
                                    title="Click to add/change photo"
                                >
                                    {photoUrl ? (
                                        <>
                                            <img
                                                src={photoUrl}
                                                alt={patient?.first_name || 'Patient'}
                                                className="w-full h-full object-cover rounded-full"
                                                key={`${patient.photo_url}-${photoVersion}`}
                                                onError={(e) => {
                                                    console.error('Error loading patient photo:', patient.photo_url);
                                                    e.target.style.display = 'none';
                                                }}
                                                onLoad={(e) => {
                                                    e.target.style.display = 'block';
                                                }}
                                            />
                                            <div className="absolute inset-0 hidden items-center justify-center bg-black bg-opacity-50 group-hover:flex transition-opacity rounded-full">
                                                <Camera className="w-4 h-4 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <User className="w-8 h-8" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 transition-opacity rounded-full">
                                                <Camera className="w-4 h-4 text-white" />
                                            </div>
                                        </>
                                    )}
                                </button>

                                {/* Patient Name and Info */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h1
                                            onClick={() => navigate(`/patient/${id}/snapshot`)}
                                            className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-primary-700 transition-colors"
                                        >
                                            {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient Chart'}
                                        </h1>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (patient) {
                                                    setEditPatientForm({
                                                        first_name: patient.first_name || '',
                                                        last_name: patient.last_name || '',
                                                        dob: patient.dob ? patient.dob.split('T')[0] : '',
                                                        sex: patient.sex || '',
                                                        mrn: patient.mrn || ''
                                                    });
                                                    setShowEditPatientModal(true);
                                                }
                                            }}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="Edit Patient Information"
                                        >
                                            <Edit className="w-4 h-4 text-gray-600" />
                                        </button>
                                    </div>
                                    {patient && (
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <span>{age !== null && `${age} years old`}</span>
                                            <span className="text-gray-300">•</span>
                                            <span>MRN: <span className="font-semibold text-gray-700">{patient.mrn}</span></span>
                                            <span className="text-gray-300">•</span>
                                            <span>DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Open Chart Button */}
                            <button
                                onClick={() => {
                                    setPatientChartTab('history');
                                    setShowPatientChart(true);
                                }}
                                className="flex items-center space-x-2 px-5 py-2.5 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-medium text-sm flex-shrink-0"
                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                title="Open Patient Chart"
                            >
                                <Eye className="w-5 h-5" />
                                <span>Open Chart</span>
                            </button>
                        </div>
                    </div>

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
                            <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                                {/* New Visit Button with Dropdown for existing drafts */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            console.log('New Visit button clicked, patient id:', id);
                                            if (id) {
                                                // If there's an open note from today by the current user, show options
                                                if (todaysOpenNote && todaysOpenNote.id) {
                                                    // Toggle dropdown to let user choose
                                                    setShowNewVisitDropdown(!showNewVisitDropdown);
                                                } else {
                                                    const targetPath = `/patient/${id}/visit/new`;
                                                    console.log('Creating new visit:', targetPath);
                                                    navigate(targetPath);
                                                }
                                            } else {
                                                console.error('Patient ID is missing, cannot navigate');
                                                alert('Patient ID is missing. Please refresh the page.');
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md transition-all duration-200 hover:shadow-md whitespace-nowrap"
                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                    >
                                        {todaysOpenNote ? (
                                            <>
                                                <FileText className="w-3.5 h-3.5" />
                                                <span>Open Note ▾</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>New Visit</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Dropdown for existing draft options */}
                                    {showNewVisitDropdown && todaysOpenNote && (
                                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                            <button
                                                onClick={() => {
                                                    const targetPath = `/patient/${id}/visit/${todaysOpenNote.id}`;
                                                    navigate(targetPath);
                                                    setShowNewVisitDropdown(false);
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-orange-600" />
                                                <div>
                                                    <div className="font-medium text-gray-900">Open Today's Draft</div>
                                                    <div className="text-gray-500">Continue working on existing note</div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const targetPath = `/patient/${id}/visit/new?fresh=true`;
                                                    navigate(targetPath);
                                                    setShowNewVisitDropdown(false);
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                                            >
                                                <Plus className="w-3.5 h-3.5 text-blue-600" />
                                                <div>
                                                    <div className="font-medium text-gray-900">Start Fresh Visit</div>
                                                    <div className="text-gray-500">Create a new blank note</div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Demographics Section */}
                    {patient && (
                        <div className="px-6 py-1.5">
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
                                {/* Phone */}
                                <div
                                    onClick={() => handleOpenDemographics('phone')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <Phone className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Phone</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight">{formatPhone(patient.phone) || 'Not provided'}</div>
                                </div>

                                {/* Email */}
                                <div
                                    onClick={() => handleOpenDemographics('email')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <Mail className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Email</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.email || 'Not provided'}</div>
                                </div>

                                {/* Address */}
                                <div
                                    onClick={() => handleOpenDemographics('address')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <MapPin className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Address</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2">{formatAddress(patient)}</div>
                                </div>

                                {/* Insurance */}
                                <div
                                    onClick={() => handleOpenDemographics('insurance')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <CreditCard className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Insurance</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.insurance_provider || 'Not on file'}</div>
                                    {patient.insurance_id && (
                                        <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                            Policy: {patient.insurance_id}
                                        </div>
                                    )}
                                </div>

                                {/* Pharmacy */}
                                <div
                                    onClick={() => handleOpenDemographics('pharmacy')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <Building2 className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Pharmacy</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.pharmacy_name || 'Not on file'}</div>
                                    {patient.pharmacy_phone && (
                                        <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                            {formatPhone(patient.pharmacy_phone)}
                                        </div>
                                    )}
                                    {patient.pharmacy_address && (
                                        <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                            {patient.pharmacy_address}
                                        </div>
                                    )}
                                </div>

                                {/* Emergency Contact */}
                                {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
                                    <div
                                        onClick={() => handleOpenDemographics('emergency')}
                                        className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                    >
                                        <div className="flex items-center justify-center mb-0.5 relative">
                                            <div className="flex items-center space-x-0.5">
                                                <Users className="w-2.5 h-2.5 text-primary-600" />
                                                <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Emergency</span>
                                            </div>
                                            <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                        </div>
                                        <div className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2">
                                            {patient.emergency_contact_name && (
                                                <div>
                                                    {patient.emergency_contact_name}
                                                    {patient.emergency_contact_phone && (
                                                        <span className="text-[9px] text-gray-600"> • {formatPhone(patient.emergency_contact_phone)}</span>
                                                    )}
                                                </div>
                                            )}
                                            {!patient.emergency_contact_name && patient.emergency_contact_phone && (
                                                <div>{formatPhone(patient.emergency_contact_phone)}</div>
                                            )}
                                            {patient.emergency_contact_relationship && (
                                                <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                                    {patient.emergency_contact_relationship}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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
                                    onClick={() => {
                                        console.log('Visit History header clicked');
                                        setShowVisitFoldersModal(true);
                                    }}
                                >
                                    Visit History
                                </h2>
                                {filteredNotes.length > 0 && (
                                    <span className="text-xs text-gray-500">({filteredNotes.length} visits)</span>
                                )}
                            </div>
                            {visitHistoryExpanded && filteredNotes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        console.log('View All visits button clicked');
                                        setShowVisitFoldersModal(true);
                                    }}
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
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                {/* Medications and Problem List - Side by side, thinner */}
                                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                                    {/* Medications Module - Taller */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                <Pill className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                                                <h3 className="font-semibold text-xs text-gray-900 truncate">Medications</h3>
                                                {medications.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 flex-shrink-0">({medications.length})</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Medications Manage button clicked');
                                                    setPatientDataManagerTab('medications');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-[10px] text-primary-600 hover:text-primary-700 font-medium flex-shrink-0 ml-1"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                        <div className="p-1.5 max-h-[400px] overflow-y-auto">
                                            {medications.length > 0 ? (
                                                <div className="space-y-0.5">
                                                    {medications.map(med => (
                                                        <div key={med.id} className="py-0.5 border-b border-gray-100 last:border-b-0">
                                                            <div className="flex items-start justify-between gap-1">
                                                                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                                                                    <p className="font-medium text-[11px] text-gray-900 leading-tight truncate">
                                                                        {med.medication_name}
                                                                    </p>
                                                                    {(med.dosage || med.frequency) && (
                                                                        <p className="text-[10px] text-gray-600 leading-tight flex-shrink-0">
                                                                            {med.dosage && `${med.dosage}`}
                                                                            {med.dosage && med.frequency && ' • '}
                                                                            {med.frequency && `${med.frequency}`}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-gray-500 text-center py-4">No medications</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Problem List Module - Taller */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                <AlertCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                                                <h3 className="font-semibold text-xs text-gray-900 truncate">Problem List</h3>
                                                {problems.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 flex-shrink-0">({problems.length})</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Problems Manage button clicked');
                                                    setPatientDataManagerTab('problems');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-[10px] text-primary-600 hover:text-primary-700 font-medium flex-shrink-0 ml-1"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                        <div className="p-1.5 max-h-[400px] overflow-y-auto">
                                            {problems.length > 0 ? (
                                                <div className="space-y-0.5">
                                                    {problems.map(prob => (
                                                        <div key={prob.id} className="py-0.5 border-b border-gray-100 last:border-b-0">
                                                            <div className="flex items-start justify-between gap-1">
                                                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                                    <p className="font-medium text-[11px] text-gray-900 leading-tight truncate">
                                                                        {prob.name || prob.problem_name}
                                                                    </p>
                                                                    <span
                                                                        className={`inline-block text-[9px] px-1 py-0.5 rounded-full font-medium flex-shrink-0 ${prob.status === 'active'
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : 'bg-gray-100 text-gray-800'
                                                                            }`}
                                                                    >
                                                                        {prob.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-gray-500 text-center py-4">No active problems</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Other modules arranged in 2 columns */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* EKG Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Activity className="w-4 h-4 text-red-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">EKG</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPatientChartTab('ekg');
                                                    setShowPatientChart(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                View All
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowEKGUploadModal(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    Upload EKG
                                                </button>
                                                <div className="space-y-1.5">
                                                    <div className="text-xs text-gray-500 font-medium mb-1">
                                                        Recent EKGs {ekgDocuments.length > 0 && `(${ekgDocuments.length})`}
                                                    </div>
                                                    {ekgDocuments.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {ekgDocuments.slice(0, 2).map((ekg) => {
                                                                const date = ekg.created_at
                                                                    ? format(new Date(ekg.created_at), 'M/d/yyyy')
                                                                    : 'Unknown date';
                                                                const filename = ekg.filename || 'EKG';
                                                                return (
                                                                    <div
                                                                        key={ekg.id}
                                                                        onClick={() => handleViewEKG(ekg)}
                                                                        className="flex items-center justify-between p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                                                    >
                                                                        <div className="flex items-center space-x-2">
                                                                            <FileImage className="w-3 h-3 text-gray-600" />
                                                                            <span className="text-xs text-gray-900">
                                                                                {filename.includes('EKG') || filename.includes('ekg')
                                                                                    ? filename
                                                                                    : `EKG - ${date}`}
                                                                            </span>
                                                                        </div>
                                                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-500 text-center py-2">No EKGs uploaded</p>
                                                    )}
                                                </div>
                                                {ekgDocuments.length > 0 && (
                                                    <div className="pt-2 border-t border-gray-200">
                                                        <div className="text-xs text-gray-500 font-medium mb-1">Quick Actions</div>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleInterpretEKG(ekgDocuments[0])}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors"
                                                                title="Interpret EKG: Analyze rhythm, intervals, and identify abnormalities"
                                                            >
                                                                <FileSearch className="w-3 h-3" />
                                                                Interpret
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMeasureEKG(ekgDocuments[0])}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition-colors"
                                                                title="Measure EKG: Measure intervals (PR, QRS, QT) and calculate heart rate"
                                                            >
                                                                <Ruler className="w-3 h-3" />
                                                                Measure
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ECHO Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Heart className="w-4 h-4 text-blue-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">ECHO</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPatientChartTab('echo');
                                                    setShowPatientChart(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                View All
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowECHOUploadModal(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    Upload ECHO
                                                </button>
                                                <div className="space-y-1.5">
                                                    <div className="text-xs text-gray-500 font-medium mb-1">
                                                        Recent ECHOs {echoDocuments.length > 0 && `(${echoDocuments.length})`}
                                                    </div>
                                                    {echoDocuments.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {echoDocuments.slice(0, 2).map((echo) => {
                                                                const date = echo.created_at
                                                                    ? format(new Date(echo.created_at), 'M/d/yyyy')
                                                                    : 'Unknown date';
                                                                const filename = echo.filename || 'ECHO';
                                                                return (
                                                                    <div
                                                                        key={echo.id}
                                                                        onClick={() => handleViewECHO(echo)}
                                                                        className="flex items-center justify-between p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                                                    >
                                                                        <div className="flex items-center space-x-2">
                                                                            <FileImage className="w-3 h-3 text-gray-600" />
                                                                            <span className="text-xs text-gray-900">
                                                                                {filename.includes('ECHO') || filename.includes('echo')
                                                                                    ? filename
                                                                                    : `ECHO - ${date}`}
                                                                            </span>
                                                                        </div>
                                                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-500 text-center py-2">No ECHOs uploaded</p>
                                                    )}
                                                </div>
                                                {echoDocuments.length > 0 && (
                                                    <div className="pt-2 border-t border-gray-200">
                                                        <div className="text-xs text-gray-500 font-medium mb-1">Quick Actions</div>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCalculateECHO(echoDocuments[0])}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors"
                                                                title="Calculate ECHO: Calculate ejection fraction, stroke volume, and other cardiac parameters"
                                                            >
                                                                <Calculator className="w-3 h-3" />
                                                                Calculate
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMeasureECHO(echoDocuments[0])}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition-colors"
                                                                title="Measure ECHO: Measure chamber dimensions, wall thickness, and valve areas"
                                                            >
                                                                <Ruler className="w-3 h-3" />
                                                                Measure
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Family History Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Heart className="w-4 h-4 text-primary-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">Family History</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Family History Manage button clicked');
                                                    setPatientDataManagerTab('family');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            {familyHistory.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {familyHistory.slice(0, 3).map(hist => (
                                                        <div key={hist.id} className="pb-1.5 border-b border-gray-100 last:border-b-0 last:pb-0">
                                                            <p className="font-medium text-xs text-gray-900">{hist.condition}</p>
                                                            <p className="text-xs text-gray-600">{hist.relationship}</p>
                                                        </div>
                                                    ))}
                                                    {familyHistory.length > 3 && (
                                                        <p className="text-xs text-gray-500 text-center pt-1">
                                                            +{familyHistory.length - 3} more
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-2">No family history</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Social History Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <UserCircle className="w-4 h-4 text-primary-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">Social History</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Social History Manage button clicked');
                                                    setPatientDataManagerTab('social');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            {socialHistory ? (
                                                <div className="space-y-1 text-xs">
                                                    {socialHistory.smoking_status && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Smoking: </span>
                                                            <span className="text-gray-600">{socialHistory.smoking_status}</span>
                                                        </div>
                                                    )}
                                                    {socialHistory.alcohol_use && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Alcohol: </span>
                                                            <span className="text-gray-600">{socialHistory.alcohol_use}</span>
                                                        </div>
                                                    )}
                                                    {socialHistory.exercise_frequency && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Exercise: </span>
                                                            <span className="text-gray-600">
                                                                {socialHistory.exercise_frequency}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {socialHistory.occupation && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Occupation: </span>
                                                            <span className="text-gray-600">{socialHistory.occupation}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-2">No social history</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Allergies Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-red-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <AlertCircle className="w-4 h-4 text-red-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">Allergies</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Allergies Manage button clicked');
                                                    setPatientDataManagerTab('allergies');
                                                    setShowPatientDataManager(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            {allergies.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {allergies.slice(0, 3).map(allergy => (
                                                        <div key={allergy.id} className="pb-1.5 border-b border-gray-100 last:border-b-0 last:pb-0">
                                                            <p className="font-medium text-xs text-red-900">{allergy.allergen}</p>
                                                            {allergy.reaction && (
                                                                <p className="text-xs text-gray-600">Reaction: {allergy.reaction}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {allergies.length > 3 && (
                                                        <p className="text-xs text-gray-500 text-center pt-1">
                                                            +{allergies.length - 3} more
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-2">No known allergies</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Vitals Module */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Activity className="w-4 h-4 text-primary-600" />
                                                <h3 className="font-semibold text-sm text-gray-900">Recent Vitals</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    console.log('Vitals View All button clicked');
                                                    setPatientChartTab('history');
                                                    setShowPatientChart(true);
                                                }}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                View All
                                            </button>
                                        </div>
                                        <div className="p-2">
                                            {vitals.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {vitals.slice(0, 3).map((vital, idx) => (
                                                        <div key={idx} className="pb-1.5 border-b border-gray-100 last:border-b-0 last:pb-0">
                                                            <p className="text-xs text-gray-500 mb-0.5">{vital.date}</p>
                                                            <div className="grid grid-cols-2 gap-1 text-xs">
                                                                <div>
                                                                    <span className="text-gray-500">BP: </span>
                                                                    <span className="font-medium text-gray-900">
                                                                        {vital.bp || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">HR: </span>
                                                                    <span className="font-medium text-gray-900">
                                                                        {vital.hr || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Temp: </span>
                                                                    <span className="font-medium text-gray-900">
                                                                        {vital.temp || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">SpO2: </span>
                                                                    <span className="font-medium text-gray-900">
                                                                        {vital.spo2 || 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-2">No vitals recorded</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Modals and Components */}
                <PatientChartPanel
                    isOpen={showPatientChart}
                    patientId={id}
                    patient={patient}
                    initialTab={patientChartTab}
                    onClose={() => setShowPatientChart(false)}
                />

                <PatientDataManager
                    isOpen={showPatientDataManager}
                    patientId={id}
                    initialTab={patientDataManagerTab}
                    onClose={() => setShowPatientDataManager(false)}
                    onUpdate={refreshPatientData}
                />

                {showVisitFoldersModal && (
                    <VisitFoldersModal
                        isOpen={showVisitFoldersModal}
                        patientId={id}
                        onClose={() => setShowVisitFoldersModal(false)}
                        onViewVisit={(visitId) => {
                            setShowVisitFoldersModal(false);
                            setSelectedVisitForView({ visitId, patientId: id });
                        }}
                    />
                )}

                {selectedVisitForView && (
                    <VisitChartView
                        visitId={selectedVisitForView.visitId}
                        patientId={selectedVisitForView.patientId}
                        onClose={() => setSelectedVisitForView(null)}
                    />
                )}

                <EPrescribeEnhanced
                    isOpen={showEPrescribeEnhanced}
                    patientId={id}
                    patientName={patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : ''}
                    onClose={() => setShowEPrescribeEnhanced(false)}
                    currentMedications={medications}
                    assessmentDiagnoses={[]}
                    onAddToAssessment={null}
                />

                {/* Photo Modal */}
                {showPhotoModal && (
                    <Modal
                        isOpen={showPhotoModal}
                        onClose={() => {
                            setShowPhotoModal(false);
                            setPhotoMode(null);
                            setCapturedPhoto(null);
                            stopWebcam();
                        }}
                        title="Patient Photo"
                    >
                        <div className="space-y-4">
                            {!photoMode && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={async () => {
                                            setPhotoMode('webcam');
                                            await startWebcam();
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Use Webcam
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPhotoMode('upload');
                                            fileInputRef.current?.click();
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                    >
                                        Upload File
                                    </button>
                                </div>
                            )}

                            {photoMode === 'webcam' && (
                                <div className="space-y-3">
                                    <div className="relative bg-black rounded-lg overflow-hidden">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            className="w-full max-h-96 object-contain"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={capturePhoto}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            Capture
                                        </button>
                                        <button
                                            onClick={() => {
                                                stopWebcam();
                                                setPhotoMode(null);
                                            }}
                                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {photoMode === 'upload' && (
                                <div className="space-y-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {capturedPhoto && (
                                        <div className="relative bg-black rounded-lg overflow-hidden">
                                            <img
                                                src={capturedPhoto}
                                                alt="Preview"
                                                className="w-full max-h-96 object-contain"
                                            />
                                        </div>
                                    )}
                                    {!capturedPhoto && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                        >
                                            Select File
                                        </button>
                                    )}
                                </div>
                            )}

                            {capturedPhoto && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSavePhoto}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        Save Photo
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCapturedPhoto(null);
                                            if (photoMode === 'webcam') {
                                                stopWebcam();
                                            }
                                            setPhotoMode(null);
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Demographics Modal */}
                {showDemographicsModal && demographicsField && (
                    <Modal
                        isOpen={showDemographicsModal}
                        onClose={() => {
                            setShowDemographicsModal(false);
                            setDemographicsField(null);
                        }}
                        title={`Edit ${demographicsField.charAt(0).toUpperCase() + demographicsField.slice(1)}`}
                    >
                        <div className="space-y-4">
                            {demographicsField === 'phone' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="text"
                                        value={demographicsForm.phone}
                                        onChange={(e) => setDemographicsForm(prev => ({ ...prev, phone: formatPhoneInput(e.target.value) }))}
                                        placeholder="(555) 123-4567"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            )}

                            {demographicsField === 'email' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={demographicsForm.email}
                                        onChange={(e) => setDemographicsForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="patient@example.com"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            )}

                            {demographicsField === 'address' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.address_line1}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, address_line1: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.city}
                                                onChange={(e) => setDemographicsForm(prev => ({ ...prev, city: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.state}
                                                onChange={(e) => setDemographicsForm(prev => ({ ...prev, state: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.zip}
                                                onChange={(e) => setDemographicsForm(prev => ({ ...prev, zip: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {demographicsField === 'insurance' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.insurance_provider}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, insurance_provider: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Policy ID</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.insurance_id}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, insurance_id: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </>
                            )}

                            {demographicsField === 'pharmacy' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.pharmacy_name}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, pharmacy_name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Phone</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.pharmacy_phone}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, pharmacy_phone: formatPhoneInput(e.target.value) }))}
                                            placeholder="(555) 123-4567"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </>
                            )}

                            {demographicsField === 'emergency' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.emergency_contact_name}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.emergency_contact_phone}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, emergency_contact_phone: formatPhoneInput(e.target.value) }))}
                                            placeholder="(555) 123-4567"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.emergency_contact_relationship}
                                            onChange={(e) => setDemographicsForm(prev => ({ ...prev, emergency_contact_relationship: e.target.value }))}
                                            placeholder="Spouse, Parent, etc."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleSaveDemographics}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDemographicsModal(false);
                                        setDemographicsField(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Document Upload Modal */}
                {showDocumentUploadModal && (
                    <Modal
                        isOpen={showDocumentUploadModal}
                        onClose={() => {
                            setShowDocumentUploadModal(false);
                            setDocumentUploadFile(null);
                            setDocumentUploadType('other');
                        }}
                        title="Upload Document"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                                <select
                                    value={documentUploadType}
                                    onChange={(e) => setDocumentUploadType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="other">Other</option>
                                    <option value="imaging">Imaging</option>
                                    <option value="lab">Lab Result</option>
                                    <option value="referral">Referral</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                                <input
                                    ref={documentUploadInputRef}
                                    type="file"
                                    onChange={(e) => setDocumentUploadFile(e.target.files?.[0] || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleDocumentUpload}
                                    disabled={!documentUploadFile}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Upload
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDocumentUploadModal(false);
                                        setDocumentUploadFile(null);
                                        setDocumentUploadType('other');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Edit Patient Modal */}
                {showEditPatientModal && (
                    <Modal
                        isOpen={showEditPatientModal}
                        onClose={() => setShowEditPatientModal(false)}
                        title="Edit Patient Information"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={editPatientForm.first_name}
                                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, first_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={editPatientForm.last_name}
                                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, last_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                <input
                                    type="date"
                                    value={editPatientForm.dob}
                                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, dob: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                                <select
                                    value={editPatientForm.sex}
                                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, sex: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="">Select</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="O">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">MRN</label>
                                <input
                                    type="text"
                                    value={editPatientForm.mrn}
                                    onChange={(e) => setEditPatientForm(prev => ({ ...prev, mrn: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleEditPatient}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setShowEditPatientModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* EKG Upload Modal */}
                {showEKGUploadModal && (
                    <Modal
                        isOpen={showEKGUploadModal}
                        onClose={() => {
                            setShowEKGUploadModal(false);
                            setEkgUploadFile(null);
                            if (ekgUploadInputRef.current) {
                                ekgUploadInputRef.current.value = '';
                            }
                        }}
                        title="Upload EKG"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">EKG File</label>
                                <input
                                    ref={ekgUploadInputRef}
                                    type="file"
                                    accept="image/*,.pdf,.dcm"
                                    onChange={(e) => setEkgUploadFile(e.target.files?.[0] || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                <p className="text-xs text-gray-500 mt-1">Supported formats: Images (PNG, JPG), PDF, DICOM</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleEKGUpload}
                                    disabled={!ekgUploadFile}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Upload EKG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEKGUploadModal(false);
                                        setEkgUploadFile(null);
                                        if (ekgUploadInputRef.current) {
                                            ekgUploadInputRef.current.value = '';
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* EKG Viewer Modal */}
                {showEKGViewer && selectedEKG && (
                    <Modal
                        isOpen={showEKGViewer}
                        onClose={() => {
                            setShowEKGViewer(false);
                            setSelectedEKG(null);
                        }}
                        title={`EKG ${ekgViewerMode === 'interpret' ? 'Interpretation' : ekgViewerMode === 'measure' ? 'Measurement' : 'Viewer'} - ${selectedEKG.filename || 'EKG Document'}`}
                        size="xl"
                    >
                        <div className="space-y-4">
                            {ekgViewerMode !== 'view' && (
                                <div className={`p-3 rounded-lg ${ekgViewerMode === 'interpret' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                                    <p className={`text-sm font-medium ${ekgViewerMode === 'interpret' ? 'text-blue-800' : 'text-green-800'}`}>
                                        {ekgViewerMode === 'interpret'
                                            ? '📊 Interpretation Mode: Analyze rhythm, intervals, and identify abnormalities'
                                            : '📏 Measurement Mode: Measure intervals (PR, QRS, QT) and calculate heart rate'}
                                    </p>
                                </div>
                            )}
                            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                {selectedEKG.id ? (
                                    <div className="space-y-3">
                                        {(() => {
                                            const token = localStorage.getItem('token');
                                            const fileUrl = `/api/documents/${selectedEKG.id}/file${token ? `?token=${token}` : ''}`;
                                            const filename = selectedEKG.filename || 'EKG';
                                            const isImage = filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) || selectedEKG.mime_type?.startsWith('image/');

                                            return isImage ? (
                                                <img
                                                    src={fileUrl}
                                                    alt={filename}
                                                    className="w-full h-auto rounded-lg border border-gray-300"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        const errorDiv = e.target.nextElementSibling;
                                                        if (errorDiv) errorDiv.style.display = 'block';
                                                    }}
                                                />
                                            ) : (
                                                <iframe
                                                    src={fileUrl}
                                                    className="w-full h-96 rounded-lg border border-gray-300"
                                                    title={filename}
                                                />
                                            );
                                        })()}
                                        <div style={{ display: 'none' }} className="text-center py-8">
                                            <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">Unable to load EKG file</p>
                                            <p className="text-xs text-gray-500 mt-2">Please try downloading the file instead</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600">EKG file not available for viewing</p>
                                        <p className="text-sm text-gray-500 mt-2">{selectedEKG.filename || 'No filename'}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedEKG.id) {
                                            const token = localStorage.getItem('token');
                                            const fileUrl = `/api/documents/${selectedEKG.id}/file${token ? `?token=${token}` : ''}`;
                                            window.open(fileUrl, '_blank');
                                        } else {
                                            alert('EKG file not available');
                                        }
                                    }}
                                    disabled={!selectedEKG.id}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Open in New Tab
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEKGViewer(false);
                                        setSelectedEKG(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* ECHO Upload Modal */}
                {showECHOUploadModal && (
                    <Modal
                        isOpen={showECHOUploadModal}
                        onClose={() => {
                            setShowECHOUploadModal(false);
                            setEchoUploadFile(null);
                            if (echoUploadInputRef.current) {
                                echoUploadInputRef.current.value = '';
                            }
                        }}
                        title="Upload ECHO"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ECHO File</label>
                                <input
                                    ref={echoUploadInputRef}
                                    type="file"
                                    accept="image/*,.pdf,.dcm"
                                    onChange={(e) => setEchoUploadFile(e.target.files?.[0] || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                <p className="text-xs text-gray-500 mt-1">Supported formats: Images (PNG, JPG), PDF, DICOM</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleECHOUpload}
                                    disabled={!echoUploadFile}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Upload ECHO
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowECHOUploadModal(false);
                                        setEchoUploadFile(null);
                                        if (echoUploadInputRef.current) {
                                            echoUploadInputRef.current.value = '';
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* ECHO Viewer Modal */}
                {showECHOViewer && selectedECHO && (
                    <Modal
                        isOpen={showECHOViewer}
                        onClose={() => {
                            setShowECHOViewer(false);
                            setSelectedECHO(null);
                        }}
                        title={`ECHO ${echoViewerMode === 'calculate' ? 'Calculator' : echoViewerMode === 'measure' ? 'Measurement' : 'Viewer'} - ${selectedECHO.filename || 'ECHO Document'}`}
                        size="xl"
                    >
                        <div className="space-y-4">
                            {echoViewerMode !== 'view' && (
                                <div className={`p-3 rounded-lg ${echoViewerMode === 'calculate' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                                    <p className={`text-sm font-medium ${echoViewerMode === 'calculate' ? 'text-blue-800' : 'text-green-800'}`}>
                                        {echoViewerMode === 'calculate'
                                            ? '🧮 Calculator Mode: Calculate ejection fraction, stroke volume, and other cardiac parameters'
                                            : '📏 Measurement Mode: Measure chamber dimensions, wall thickness, and valve areas'}
                                    </p>
                                </div>
                            )}
                            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                {selectedECHO.id ? (
                                    <div className="space-y-3">
                                        {(() => {
                                            const token = localStorage.getItem('token');
                                            const fileUrl = `/api/documents/${selectedECHO.id}/file${token ? `?token=${token}` : ''}`;
                                            const filename = selectedECHO.filename || 'ECHO';
                                            const isImage = filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) || selectedECHO.mime_type?.startsWith('image/');

                                            return isImage ? (
                                                <img
                                                    src={fileUrl}
                                                    alt={filename}
                                                    className="w-full h-auto rounded-lg border border-gray-300"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        const errorDiv = e.target.nextElementSibling;
                                                        if (errorDiv) errorDiv.style.display = 'block';
                                                    }}
                                                />
                                            ) : (
                                                <iframe
                                                    src={fileUrl}
                                                    className="w-full h-96 rounded-lg border border-gray-300"
                                                    title={filename}
                                                />
                                            );
                                        })()}
                                        <div style={{ display: 'none' }} className="text-center py-8">
                                            <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">Unable to load ECHO file</p>
                                            <p className="text-xs text-gray-500 mt-2">Please try downloading the file instead</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600">ECHO file not available for viewing</p>
                                        <p className="text-sm text-gray-500 mt-2">{selectedECHO.filename || 'No filename'}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedECHO.id) {
                                            const token = localStorage.getItem('token');
                                            const fileUrl = `/api/documents/${selectedECHO.id}/file${token ? `?token=${token}` : ''}`;
                                            window.open(fileUrl, '_blank');
                                        } else {
                                            alert('ECHO file not available');
                                        }
                                    }}
                                    disabled={!selectedECHO.id}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Open in New Tab
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowECHOViewer(false);
                                        setSelectedECHO(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}
export default Snapshot;
