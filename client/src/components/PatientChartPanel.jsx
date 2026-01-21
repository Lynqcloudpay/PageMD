import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, FileText, Image, FlaskConical, Pill, ExternalLink,
    Database, CreditCard, Clock, CheckCircle2,
    XCircle, UserCircle, FileImage, Trash2, Plus, Activity, Printer,
    LayoutDashboard, ChevronRight, Search, FilePlus, ChevronDown, HeartPulse, ActivitySquare, Zap, Waves,
    Edit2, RotateCcw, Calendar, AlertCircle, Users, Receipt
} from 'lucide-react';
import { visitsAPI, documentsAPI, ordersAPI, referralsAPI, patientsAPI, eprescribeAPI } from '../services/api';
import { format } from 'date-fns';
import DoseSpotPrescribe from './DoseSpotPrescribe';
import VisitChartView from './VisitChartView';
import PrintOrdersModal from './PrintOrdersModal';
import { ProblemInput, MedicationInput, AllergyInput, FamilyHistoryInput, SurgicalHistoryInput } from './PAMFOSInputs';

const PatientChartPanel = ({ patientId, isOpen, onClose, initialTab = 'overview' }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);

    // History Panel State
    const [notes, setNotes] = useState([]);
    const [labs, setLabs] = useState([]);
    const [images, setImages] = useState([]);
    const [imagingOrders, setImagingOrders] = useState([]);
    const [ekgs, setEkgs] = useState([]);
    const [echos, setEchos] = useState([]);
    const [stressTests, setStressTests] = useState([]);
    const [cardiacCaths, setCardiacCaths] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [expandedNotes, setExpandedNotes] = useState({});
    const [selectedVisitForView, setSelectedVisitForView] = useState(null);

    // Patient Hub State
    const [patient, setPatient] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [eprescribePrescriptions, setEprescribePrescriptions] = useState([]);
    const [eprescribeEnabled, setEprescribeEnabled] = useState(false);
    const [showDoseSpotModal, setShowDoseSpotModal] = useState(false);
    const [activeMedications, setActiveMedications] = useState([]);
    const [hubDocuments, setHubDocuments] = useState([]);
    const [showPrintOrdersModal, setShowPrintOrdersModal] = useState(false);

    // Patient Details
    const [formData, setFormData] = useState({
        insuranceProvider: '',
        insuranceId: '',
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: ''
    });


    const [problems, setProblems] = useState([]);
    const [medications, setMedications] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [familyHistory, setFamilyHistory] = useState([]);
    const [surgicalHistory, setSurgicalHistory] = useState([]);
    const [socialHistory, setSocialHistory] = useState(null);

    // Form States
    const [showAddMedForm, setShowAddMedForm] = useState(false);
    const [medForm, setMedForm] = useState({ medicationName: '', dosage: '', frequency: '', route: '', startDate: format(new Date(), 'yyyy-MM-dd') });

    const [showAddProbForm, setShowAddProbForm] = useState(false);
    const [probForm, setProbForm] = useState({ problemName: '', icd10Code: '', onsetDate: format(new Date(), 'yyyy-MM-dd'), status: 'active' });

    const [showAddAllergyForm, setShowAddAllergyForm] = useState(false);
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: 'Moderate' });

    const [showAddFamilyForm, setShowAddFamilyForm] = useState(false);
    const [familyForm, setFamilyForm] = useState({ relationship: '', condition: '', onsetAge: '' });

    const [showEditSocialForm, setShowEditSocialForm] = useState(false);
    const [socialForm, setSocialForm] = useState({
        smoking_status: '', alcohol_use: '', drug_use: '',
        occupation: '', exercise_frequency: '', marital_status: ''
    });

    const [showAddSurgicalForm, setShowAddSurgicalForm] = useState(false);
    const [surgicalForm, setSurgicalForm] = useState({ procedure_name: '', date: format(new Date(), 'yyyy-MM-dd'), surgeon: '', facility: '', notes: '' });



    // Document Folder/Search State
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [selectedDocFolder, setSelectedDocFolder] = useState('all');

    const documentCategories = [
        { id: 'all', label: 'All Documents', icon: FileText, types: [] },
        { id: 'demographics', label: 'Demographics', icon: UserCircle, types: ['insurance', 'identification'] },
        { id: 'clinical', label: 'Clinical Notes', icon: FilePlus, types: ['consult', 'clinical_note', 'visit_note'] },
        { id: 'labs', label: 'Lab Results', icon: FlaskConical, types: ['lab'] },
        { id: 'imaging', label: 'Imaging & Studies', icon: Image, types: ['imaging', 'ekg', 'echo', 'stress_test', 'cardiac_cath'] },
        { id: 'referrals', label: 'Referrals', icon: ExternalLink, types: ['referral'] },
        { id: 'payments', label: 'Payments', icon: CreditCard, types: ['superbill', 'payment'] },
        { id: 'legal', label: 'Legal & Consent', icon: CheckCircle2, types: ['consent'], tags: ['legal', 'consent', 'hipaa', 'intake'] },
        { id: 'other', label: 'Other', icon: Database, types: ['other'], excludeTags: ['legal', 'consent', 'hipaa', 'intake'] },
    ];

    // Helper to decode HTML entities like &#x2F; and &amp;#x2F;
    const decodeHtmlEntities = (text) => {
        if (typeof text !== 'string') return String(text || '');
        let str = text;

        // Browser environment: use textarea for robust decoding
        if (typeof document !== 'undefined') {
            const txt = document.createElement('textarea');
            // Loop to handle double-encoding
            for (let i = 0; i < 4; i++) {
                const prev = str;
                txt.innerHTML = str;
                str = txt.value;
                // Manual backup for typically stubborn entities if textarea fails? 
                // Usually textarea works, but explicit replace checks don't hurt.
                str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/').replace(/&sol;/g, '/');
                if (str === prev) break;
            }
        } else {
            // Server-side / fallback
            str = str
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#x2F;/ig, '/')
                .replace(/&#47;/g, '/');
        }
        return str;
    };

    useEffect(() => {
        if (isOpen && patientId) {
            setActiveTab(initialTab === 'history' ? 'overview' : initialTab); // Default to overview
            fetchAllData();
        }
    }, [isOpen, patientId, initialTab]);

    // Listen for data updates
    useEffect(() => {
        const handleDataUpdate = () => {
            if (isOpen && patientId) {
                fetchAllData();
            }
        };

        window.addEventListener('patient-data-updated', handleDataUpdate);
        return () => window.removeEventListener('patient-data-updated', handleDataUpdate);
    }, [isOpen, patientId]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Parallelize requests for speed
            const [
                patientRes,
                visitsRes,
                ordersRes,
                referralsRes,
                eprescribeStatusRes,
                docsRes,
                activeMedsRes
            ] = await Promise.allSettled([
                patientsAPI.get(patientId),
                visitsAPI.getByPatient(patientId),
                ordersAPI.getByPatient(patientId),
                referralsAPI.getByPatient(patientId),
                eprescribeAPI.getStatus(),
                documentsAPI.getByPatient(patientId),
                patientsAPI.getMedications(patientId)
            ]);

            // Process Patient Data
            if (patientRes.status === 'fulfilled') {
                const pData = patientRes.value.data || patientRes.value;
                setPatient(pData);
                setFormData({
                    insuranceProvider: pData.insurance_provider || '',
                    insuranceId: pData.insurance_id || '',
                    pharmacyName: pData.pharmacy_name || '',
                    pharmacyAddress: pData.pharmacy_address || '',
                    pharmacyPhone: pData.pharmacy_phone || ''
                });
            }

            // Process Visits
            if (visitsRes.status === 'fulfilled') {
                let visitsData = Array.isArray(visitsRes.value) ? visitsRes.value : (visitsRes.value?.data || []);
                visitsData.sort((a, b) => new Date(b.visit_date || b.created_at || 0) - new Date(a.visit_date || a.created_at || 0));
                setNotes(visitsData);
            }

            // Process Orders (Meds, Labs, Imaging)
            if (ordersRes.status === 'fulfilled') {
                const orders = ordersRes.value.data || [];
                setPrescriptions(orders.filter(o => ['rx', 'prescription'].includes(o.order_type)));
                setLabs(orders.filter(o => o.order_type === 'lab'));
                setImagingOrders(orders.filter(o => o.order_type === 'imaging'));
            }

            // Process Referrals
            if (referralsRes.status === 'fulfilled') {
                const ordersData = Array.isArray(ordersRes.value?.data) ? ordersRes.value.data : [];
                const legacyReferrals = ordersData
                    .filter(o => o.order_type === 'referral')
                    .map(o => ({
                        id: o.id,
                        recipient_name: o.order_payload?.name || o.order_payload?.specialist || 'Specialist',
                        recipient_specialty: o.order_payload?.specialty || o.order_payload?.specialist || 'Specialty',
                        reason: o.order_payload?.reason || 'Reason not specified',
                        status: o.status,
                        created_at: o.created_at
                    }));

                const dedicatedReferrals = Array.isArray(referralsRes.value?.data) ? referralsRes.value.data : [];
                setReferrals([...dedicatedReferrals, ...legacyReferrals].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
            }

            // Process ePrescribe
            if (eprescribeStatusRes.status === 'fulfilled') {
                const enabled = eprescribeStatusRes.value.data?.enabled || false;
                setEprescribeEnabled(enabled);
                if (enabled) {
                    try {
                        const epScripts = await eprescribeAPI.getPrescriptions(patientId);
                        setEprescribePrescriptions(epScripts.data?.prescriptions || []);
                    } catch (e) { console.warn('Failed to fetch ePrescriptions', e); }
                }
            }

            // Process Active Medications
            if (activeMedsRes?.status === 'fulfilled') {
                const meds = activeMedsRes.value.data || [];
                setMedications(meds);
                setActiveMedications(meds.filter(m => m.active !== false));
            }

            // Fetch Problems & others
            try {
                const [probRes, allergiesRes, famRes, socRes, surgRes] = await Promise.all([
                    patientsAPI.getProblems(patientId),
                    patientsAPI.getAllergies(patientId),
                    patientsAPI.getFamilyHistory(patientId),
                    patientsAPI.getSocialHistory(patientId),
                    patientsAPI.getSurgicalHistory(patientId)
                ]);
                setProblems(probRes.data || []);
                setAllergies(allergiesRes.data || []);
                setFamilyHistory(famRes.data || []);
                setSocialHistory(socRes.data || null);
                setSurgicalHistory(surgRes.data || []);
            } catch (e) {
                console.warn('Failed to fetch additional patient data', e);
            }


            // Process Documents
            if (docsRes.status === 'fulfilled') {
                const docs = docsRes.value.data || [];

                const isEkg = (d) => d.doc_type === 'ekg' ||
                    (d.tags && d.tags.some(t => t.toLowerCase() === 'ekg')) ||
                    (d.file_name && d.file_name.toLowerCase().includes('ekg')) ||
                    (d.filename && d.filename.toLowerCase().includes('ekg'));

                const isEcho = (d) => d.doc_type === 'echo' ||
                    (d.tags && d.tags.some(t => t.toLowerCase() === 'echo')) ||
                    (d.file_name && d.file_name.toLowerCase().includes('echo')) ||
                    (d.filename && d.filename.toLowerCase().includes('echo')) ||
                    (d.file_name && d.file_name.toLowerCase().includes('echocardiogram')) ||
                    (d.filename && d.filename.toLowerCase().includes('echocardiogram'));

                const isStress = (d) => d.doc_type === 'stress_test' ||
                    (d.tags && d.tags.some(t => t.toLowerCase() === 'stress_test' || t.toLowerCase() === 'stress')) ||
                    (d.file_name && d.file_name.toLowerCase().includes('stress')) ||
                    (d.filename && d.filename.toLowerCase().includes('stress'));

                const isCath = (d) => d.doc_type === 'cardiac_cath' ||
                    (d.tags && d.tags.some(t => t.toLowerCase() === 'cardiac_cath' || t.toLowerCase() === 'cath')) ||
                    (d.file_name && d.file_name.toLowerCase().includes('cath')) ||
                    (d.filename && d.filename.toLowerCase().includes('cath'));

                setEkgs(docs.filter(isEkg).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setEchos(docs.filter(isEcho).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setStressTests(docs.filter(isStress).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setCardiacCaths(docs.filter(isCath).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));

                // Imaging is imaging BUT not any of the specific cardiology types
                setImages(docs.filter(d => (d.doc_type === 'imaging' || d.mime_type?.startsWith('image/')) && !isEkg(d) && !isEcho(d) && !isStress(d) && !isCath(d)).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));

                // Other documents
                setDocuments(docs.filter(d => !['imaging', 'ekg', 'echo', 'stress_test', 'cardiac_cath'].includes(d.doc_type) && !isEkg(d) && !isEcho(d) && !isStress(d) && !isCath(d)).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));

                setHubDocuments(docs);
            }


        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'history', label: 'Visit History', icon: FileText },
        { id: 'problems', label: 'Problems', icon: Activity },
        { id: 'medications', label: 'Medications', icon: Pill },
        { id: 'allergies', label: 'Allergies', icon: AlertCircle },
        { id: 'family', label: 'Family History', icon: Users },
        { id: 'surgical', label: 'Surgical History', icon: ActivitySquare },
        { id: 'social', label: 'Social History', icon: UserCircle },
        { id: 'labs', label: 'Labs / Studies', icon: FlaskConical },
        { id: 'documents', label: 'Documents', icon: FileImage },
        { id: 'images', label: 'Imaging', icon: Image },
        { id: 'ekg', label: 'EKG', icon: ActivitySquare },
        { id: 'echo', label: 'ECHO', icon: HeartPulse },
        { id: 'referrals', label: 'Referrals', icon: ExternalLink },
        { id: 'billing', label: 'Billing & Superbills', icon: Receipt }
    ];

    const getStatusBadge = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            sent: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            draft: 'bg-gray-100 text-gray-800'
        };
        const colorClass = colors[status?.toLowerCase()] || colors.pending;
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold ${colorClass}`}>
                {status || 'Pending'}
            </span>
        );
    };

    const handleUpdateMedication = async (medId, data) => {
        try {
            await patientsAPI.updateMedication(medId, data);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Error updating medication:', error);
            alert('Failed to update medication status');
        }
    };

    const handleDeleteMedication = async (medId) => {
        if (!confirm('Permanently delete this medication record?')) return;
        try {
            await patientsAPI.deleteMedication(medId);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Error deleting medication:', error);
            alert('Failed to delete medication');
        }
    };

    const handleDeleteProblem = async (probId) => {
        if (!confirm('Permanently delete this problem record?')) return;
        try {
            await patientsAPI.deleteProblem(probId);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Error deleting problem:', error);
            alert('Failed to delete problem');
        }
    };

    const handleDeleteAllergy = async (id) => {
        if (!confirm('Permanently delete this allergy?')) return;
        try {
            await patientsAPI.deleteAllergy(id);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Delete allergy error:', error);
            alert('Failed to delete allergy');
        }
    };

    const handleDeleteFamilyHistory = async (id) => {
        if (!confirm('Permanently delete this family history record?')) return;
        try {
            await patientsAPI.deleteFamilyHistory(id);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Delete fam error:', error);
            alert('Failed to delete family history');
        }
    };

    const handleDeleteSurgicalHistory = async (id) => {
        if (!confirm('Permanently delete this surgical history record?')) return;
        try {
            await patientsAPI.deleteSurgicalHistory(id);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Delete surgical error:', error);
            alert('Failed to delete surgical history');
        }
    };

    const handleUpdateSocialHistory = async (data) => {
        try {
            await patientsAPI.updateSocialHistory(patientId, data);
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Update social error:', error);
            alert('Failed to update social history');
        }
    };

    const handleQuickAddMed = async (e) => {
        e.preventDefault();
        try {
            await patientsAPI.addMedication(patientId, {
                ...medForm,
                active: true,
                status: 'active'
            });
            setShowAddMedForm(false);
            setMedForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: format(new Date(), 'yyyy-MM-dd') });
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Add med error:', error);
            alert('Failed to add medication');
        }
    };

    const handleQuickAddProb = async (e) => {
        e.preventDefault();
        try {
            await patientsAPI.addProblem(patientId, {
                problemName: probForm.problemName,
                icd10Code: probForm.icd10Code,
                onsetDate: probForm.onsetDate,
                status: probForm.status
            });
            setShowAddProbForm(false);
            setProbForm({ problemName: '', icd10Code: '', onsetDate: format(new Date(), 'yyyy-MM-dd'), status: 'active' });
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Add prob error:', error);
            alert('Failed to add problem');
        }
    };

    const handleQuickAddAllergy = async (e) => {
        e.preventDefault();
        try {
            await patientsAPI.addAllergy(patientId, allergyForm);
            setShowAddAllergyForm(false);
            setAllergyForm({ allergen: '', reaction: '', severity: 'Moderate' });
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Add allergy error:', error);
            alert('Failed to add allergy');
        }
    };

    const handleQuickAddFamilyHx = async (e) => {
        e.preventDefault();
        try {
            await patientsAPI.addFamilyHistory(patientId, {
                relationship: familyForm.relationship,
                condition: familyForm.condition,
                ageAtDiagnosis: familyForm.onsetAge || null,
                notes: ''
            });
            setShowAddFamilyForm(false);
            setFamilyForm({ relationship: '', condition: '', onsetAge: '' });
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Add family hx error:', error);
            alert('Failed to add family history');
        }
    };

    const handleQuickAddSurgicalHx = async (e) => {
        e.preventDefault();
        try {
            await patientsAPI.addSurgicalHistory(patientId, surgicalForm);
            setShowAddSurgicalForm(false);
            setSurgicalForm({ procedure_name: '', date: format(new Date(), 'yyyy-MM-dd'), surgeon: '', facility: '', notes: '' });
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Add surgical hx error:', error);
            alert('Failed to add surgical history');
        }
    };

    const handleQuickUpdateSocial = async (e) => {
        e.preventDefault();
        try {
            // Transform snake_case form fields to camelCase for API
            const payload = {
                smokingStatus: socialForm.smoking_status || '',
                smokingPackYears: socialForm.smoking_pack_years || null,
                alcoholUse: socialForm.alcohol_use || '',
                alcoholQuantity: socialForm.alcohol_quantity || null,
                drugUse: socialForm.drug_use || '',
                exerciseFrequency: socialForm.exercise_frequency || '',
                diet: socialForm.diet || '',
                occupation: socialForm.occupation || '',
                livingSituation: socialForm.living_situation || '',
                maritalStatus: socialForm.marital_status || '',
                notes: socialForm.notes || ''
            };
            await patientsAPI.saveSocialHistory(patientId, payload);
            // Keep form open - just trigger refresh
            window.dispatchEvent(new CustomEvent('patient-data-updated'));
            fetchAllData();
        } catch (error) {
            console.error('Update social error:', error);
            alert('Failed to update social history');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-[900px] bg-white h-full shadow-2xl flex flex-col md:flex-row overflow-hidden animate-slide-in-right transform duration-300">

                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-gray-50/80 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col backdrop-blur-xl">
                    <div className="p-5 border-b border-gray-200/60 bg-white/50">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold border border-primary-200 text-lg">
                                {patient?.first_name?.[0]}{patient?.last_name?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-bold text-gray-900 truncate tracking-tight">{patient?.first_name} {patient?.last_name}</h2>
                                <p className="text-xs text-gray-500 font-medium">
                                    {patient?.dob ? `${new Date(patient.dob).toLocaleDateString()} (${new Date().getFullYear() - new Date(patient.dob).getFullYear()}yo)` : 'DOB: N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                                        ${isActive
                                            ? 'bg-white text-primary-600 shadow-sm border border-gray-100 translate-x-1'
                                            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                    <span>{tab.label}</span>
                                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-primary-400" />}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-200 bg-white/50 text-xs text-gray-400 text-center">
                        Active Patient Chart
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            {tabs.find(t => t.id === activeTab)?.icon && React.createElement(tabs.find(t => t.id === activeTab).icon, { className: "w-5 h-5 text-gray-400" })}
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPrintOrdersModal(true)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white text-primary-600 hover:bg-primary-50 text-[11px] font-bold rounded-full border border-primary-200 transition-all"
                                title="Print Orders"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Orders</span>
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 scroll-smooth bg-gray-50/30">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                <span className="text-sm text-gray-400 font-medium">Loading details...</span>
                            </div>
                        ) : (
                            <div className="animate-fade-in-up">
                                {/* PROBLEMS TAB */}
                                {activeTab === 'problems' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-100 p-2 rounded-lg"><Activity className="w-5 h-5 text-orange-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Problem List</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active medical conditions</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowAddProbForm(!showAddProbForm)} className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-all shadow-sm">
                                                <Plus className="w-3.5 h-3.5" />{showAddProbForm ? 'Cancel' : 'Add Problem'}
                                            </button>
                                        </div>

                                        {showAddProbForm && (
                                            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 animate-fade-in mb-4">
                                                <ProblemInput
                                                    onSave={async (item) => {
                                                        try {
                                                            await patientsAPI.addProblem(patientId, {
                                                                problemName: item.problemName,
                                                                icd10Code: item.icd10Code,
                                                                onsetDate: item.onsetDate,
                                                                status: item.status
                                                            });
                                                            setShowAddProbForm(false);
                                                            window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                                            fetchAllData();
                                                        } catch (error) {
                                                            console.error('Add prob error:', error);
                                                            alert('Failed to add problem');
                                                        }
                                                    }}
                                                    onCancel={() => setShowAddProbForm(false)}
                                                    existingItems={problems}
                                                />
                                            </div>
                                        )}


                                        <div className="space-y-2">
                                            {problems.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">
                                                    No problems recorded for this patient.
                                                </div>
                                            ) : (
                                                problems.map((prob) => (
                                                    <div key={prob.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900">{prob.problem_name}</span>
                                                                {prob.icd10_code && <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{prob.icd10_code}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-medium">
                                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Onset: {prob.onset_date ? new Date(prob.onset_date).toLocaleDateString() : 'Unknown'}</span>
                                                                <span className={`px-1.5 py-0.5 rounded uppercase tracking-tighter border font-bold ${prob.status === 'active' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                                    {prob.status || 'Active'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteProblem(prob.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* OVERVIEW TAB */}
                                {activeTab === 'overview' && (
                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Recent Activity / Vitals Snapshot */}
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Recent Summary</h3>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors">
                                                    <span className="text-xs font-semibold text-blue-600 uppercase">Last Visit</span>
                                                    <div className="mt-1 font-bold text-gray-800">{notes[0] ? new Date(notes[0].visit_date || notes[0].created_at).toLocaleDateString() : 'None'}</div>
                                                </div>
                                                <div className="bg-green-50/50 p-3 rounded-lg border border-green-100 hover:bg-green-50 transition-colors">
                                                    <span className="text-xs font-semibold text-green-600 uppercase">Active Meds</span>
                                                    <div className="mt-1 font-bold text-gray-800">{medications.filter(m => m.active !== false).length}</div>
                                                </div>
                                                <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                                                    <span className="text-xs font-semibold text-red-600 uppercase">Allergies</span>
                                                    <div className="mt-1 font-bold text-gray-800">{allergies.length > 0 ? allergies.length : 'NKDA'}</div>
                                                </div>
                                                <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 hover:bg-orange-50 transition-colors">
                                                    <span className="text-xs font-semibold text-orange-600 uppercase">Problems</span>
                                                    <div className="mt-1 font-bold text-gray-800">{problems.length}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Data Summary */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Active Medications List */}
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-emerald-50/30">
                                                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                        <Pill className="w-4 h-4 text-emerald-600" />
                                                        Active Medications
                                                    </h3>
                                                    <button onClick={() => setActiveTab('medications')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">View All</button>
                                                </div>
                                                <div className="p-3 max-h-40 overflow-y-auto">
                                                    {medications.filter(m => m.active !== false).length > 0 ? (
                                                        <div className="space-y-1">
                                                            {medications.filter(m => m.active !== false).slice(0, 5).map(med => (
                                                                <div key={med.id} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-b-0">
                                                                    <span className="font-medium">{decodeHtmlEntities(med.medication_name)}</span>
                                                                    {med.dosage && <span className="text-gray-500 ml-2">{med.dosage}</span>}
                                                                </div>
                                                            ))}
                                                            {medications.filter(m => m.active !== false).length > 5 && (
                                                                <div className="text-xs text-gray-400 pt-1">+{medications.filter(m => m.active !== false).length - 5} more</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 italic py-2">No active medications</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Allergies List */}
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
                                                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                                        Allergies
                                                    </h3>
                                                    <button onClick={() => setActiveTab('allergies')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">View All</button>
                                                </div>
                                                <div className="p-3">
                                                    {allergies.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {allergies.map(all => (
                                                                <span key={all.id} className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-100">
                                                                    {all.allergen}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-green-600 font-medium">NKDA (No Known Drug Allergies)</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Problem List Summary */}
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-orange-50/30">
                                                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-orange-600" />
                                                    Active Problems
                                                </h3>
                                                <button onClick={() => setActiveTab('problems')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">View All</button>
                                            </div>
                                            <div className="p-3">
                                                {problems.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {problems.slice(0, 6).map(prob => (
                                                            <div key={prob.id} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                                                <span className="font-medium">{prob.problem_name}</span>
                                                                {prob.icd10_code && <span className="text-xs text-gray-400 font-mono">{prob.icd10_code}</span>}
                                                            </div>
                                                        ))}
                                                        {problems.length > 6 && (
                                                            <div className="text-xs text-gray-400 pt-1 col-span-2">+{problems.length - 6} more problems</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-400 italic py-2">No active problems documented</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recent Note */}
                                        {notes.length > 0 && (
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                                    <h3 className="text-sm font-semibold text-gray-800">Latest Note</h3>
                                                    <button onClick={() => setActiveTab('history')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">View All</button>
                                                </div>
                                                <div className="p-5">
                                                    {(() => {
                                                        const rawNote = notes[0]?.note_draft || '';
                                                        const noteText = decodeHtmlEntities(typeof rawNote === 'string' ? rawNote : String(rawNote || ''));
                                                        const ccMatch = String(noteText).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Assessment|Plan):|$)/is);
                                                        const hpiMatch = String(noteText).match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Assessment|Plan):|$)/is);
                                                        const cc = ccMatch ? ccMatch[1].trim() : null;
                                                        const hpi = hpiMatch ? hpiMatch[1].trim().substring(0, 300) : null;

                                                        return (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                    <Clock className="w-4 h-4" />
                                                                    <span>{new Date(notes[0].visit_date || notes[0].created_at).toLocaleDateString()}</span>
                                                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${notes[0].locked || notes[0].note_signed_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                        {notes[0].locked || notes[0].note_signed_at ? 'Signed' : 'Draft'}
                                                                    </span>
                                                                </div>
                                                                {cc && (
                                                                    <div>
                                                                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Chief Complaint</div>
                                                                        <div className="text-sm font-medium text-gray-900">{cc}</div>
                                                                    </div>
                                                                )}
                                                                {hpi && (
                                                                    <div>
                                                                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">HPI Summary</div>
                                                                        <div className="text-sm text-gray-600 leading-relaxed">{hpi}{hpi.length >= 300 ? '...' : ''}</div>
                                                                    </div>
                                                                )}
                                                                {!cc && !hpi && noteText && (
                                                                    <div className="text-sm text-gray-600 leading-relaxed">{noteText.substring(0, 300)}{noteText.length > 300 ? '...' : ''}</div>
                                                                )}
                                                                {!noteText && (
                                                                    <span className="italic text-gray-400">No content in latest note draft.</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* HISTORY TAB */}
                                {activeTab === 'history' && (
                                    <div className="space-y-3">
                                        {notes.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">No visit history found.</div>
                                        ) : (
                                            notes.map(note => {
                                                const rawNote = note.note_draft || "";
                                                const noteText = decodeHtmlEntities(typeof rawNote === 'string' ? rawNote : String(rawNote || ''));
                                                // Extract chief complaint
                                                const ccMatch = String(noteText).match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                                                const chiefComplaint = ccMatch ? ccMatch[1].trim() : "No Chief Complaint";

                                                return (
                                                    <div key={note.id} className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200">
                                                        <div
                                                            className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                                                            onClick={() => setExpandedNotes({ ...expandedNotes, [note.id]: !expandedNotes[note.id] })}
                                                        >
                                                            <div className="flex gap-3 items-center flex-1 min-w-0">
                                                                <div className={`p-2 rounded-lg text-gray-500 ${expandedNotes[note.id] ? 'bg-primary-50 text-primary-600' : 'bg-gray-100'}`}>
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-bold text-gray-900 text-sm">
                                                                            {note.visit_date ? new Date(note.visit_date).toLocaleDateString() : 'Unknown Date'}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500">• {note.visit_type || 'Office Visit'}</span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${note.locked || note.note_signed_at ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                                                            {note.locked || note.note_signed_at ? 'Signed' : 'Draft'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                                        <span>{note.signed_by_last_name ? `Dr. ${note.signed_by_last_name}` : 'Unknown Provider'}</span>
                                                                        <span className="text-gray-300">|</span>
                                                                        <span className="font-medium text-gray-700 truncate max-w-[300px] italic">
                                                                            {chiefComplaint}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="ml-2">
                                                                {expandedNotes[note.id] ? (
                                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {expandedNotes[note.id] && (
                                                            <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/30">
                                                                {(() => {
                                                                    // Parse note sections
                                                                    const parseNote = (textRaw) => {
                                                                        const text = String(textRaw || '');
                                                                        const ccMatch = text.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                                                                        const hpiMatch = text.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                                                                        const assessMatch = text.match(/(?:Assessment):\s*(.+?)(?:\n\n|\n(?:Plan):|$)/is);
                                                                        const planMatch = text.match(/(?:Plan):\s*(.+?)$/is);

                                                                        return {
                                                                            cc: ccMatch ? ccMatch[1].trim() : null,
                                                                            hpi: hpiMatch ? hpiMatch[1].trim().substring(0, 200) : null,
                                                                            assessment: assessMatch ? assessMatch[1].trim().substring(0, 300) : null,
                                                                            plan: planMatch ? planMatch[1].trim().substring(0, 300) : null
                                                                        };
                                                                    };

                                                                    const sections = parseNote(noteText);

                                                                    return (
                                                                        <div className="space-y-3">
                                                                            {sections.cc && (
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-gray-700 mb-1">Chief Complaint:</div>
                                                                                    <div className="text-sm text-gray-600 leading-relaxed">{sections.cc}</div>
                                                                                </div>
                                                                            )}
                                                                            {sections.hpi && (
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-gray-700 mb-1">History of Present Illness:</div>
                                                                                    <div className="text-sm text-gray-600 leading-relaxed">{sections.hpi}{sections.hpi.length >= 200 ? '...' : ''}</div>
                                                                                </div>
                                                                            )}
                                                                            {sections.assessment && (
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-gray-700 mb-1">Assessment:</div>
                                                                                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{sections.assessment}{sections.assessment.length >= 300 ? '...' : ''}</div>
                                                                                </div>
                                                                            )}
                                                                            {sections.plan && (
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-gray-700 mb-1">Plan:</div>
                                                                                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{sections.plan}{sections.plan.length >= 300 ? '...' : ''}</div>
                                                                                </div>
                                                                            )}

                                                                            <button
                                                                                onClick={() => setSelectedVisitForView({ visitId: note.id, patientId: patientId })}
                                                                                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                                                            >
                                                                                <FileText className="w-4 h-4" />
                                                                                View Full Note
                                                                                <ExternalLink className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                )}

                                {/* MEDICATIONS TAB */}
                                {activeTab === 'medications' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-emerald-100 p-2 rounded-lg"><Pill className="w-5 h-5 text-emerald-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Current Medications</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active prescriptions & home meds</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {eprescribeEnabled && (
                                                    <button onClick={() => setShowDoseSpotModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm">
                                                        <Plus className="w-3.5 h-3.5" />New Rx
                                                    </button>
                                                )}
                                                <button onClick={() => setShowAddMedForm(!showAddMedForm)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all border border-gray-200">
                                                    {showAddMedForm ? 'Cancel' : 'Add Medication'}
                                                </button>
                                            </div>
                                        </div>

                                        {showAddMedForm && (
                                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 animate-fade-in mb-4">
                                                <MedicationInput
                                                    existingItems={medications}
                                                    onSave={async (item) => {
                                                        try {
                                                            await patientsAPI.addMedication(patientId, {
                                                                medicationName: item.medicationName,
                                                                dosage: item.dosage,
                                                                frequency: item.frequency,
                                                                route: item.route,
                                                                startDate: new Date().toISOString()
                                                            });
                                                            setShowAddMedForm(false);
                                                            window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                                            fetchAllData();
                                                        } catch (error) {
                                                            console.error('Failed to add medication:', error);
                                                            alert('Failed to add medication.');
                                                        }
                                                    }}
                                                    onCancel={() => setShowAddMedForm(false)}
                                                />
                                            </div>
                                        )}


                                        {/* ACTIVE MEDICATIONS */}
                                        <div className="space-y-2">
                                            {medications.filter(m => m.active !== false).length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">
                                                    No active medications found.
                                                </div>
                                            ) : (
                                                medications.filter(m => m.active !== false).map((med) => (
                                                    <div key={med.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{decodeHtmlEntities(med.medication_name)}</div>
                                                            <div className="text-sm text-gray-600 mt-0.5">
                                                                {med.dosage && <span className="font-medium">{med.dosage} </span>}
                                                                {med.frequency && <span>{med.frequency} </span>}
                                                                {med.route && <span className="text-gray-400 italic">({med.route})</span>}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-medium">
                                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Started: {med.start_date ? new Date(med.start_date).toLocaleDateString() : 'Unknown'}</span>
                                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded uppercase tracking-tighter border border-emerald-100 font-bold">Active</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleUpdateMedication(med.id, { active: false, status: 'discontinued' })}
                                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                title="Discontinue"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteMedication(med.id)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* MEDICATION HISTORY */}
                                        <div className="pt-6 border-t border-gray-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Medication History ({medications.filter(m => m.active === false).length})</h4>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {medications.filter(m => m.active === false).map((med) => (
                                                    <div key={med.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between opacity-70 hover:opacity-100 grayscale hover:grayscale-0 transition-all">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-gray-700 truncate">{decodeHtmlEntities(med.medication_name)}</div>
                                                            <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                                                <span>{med.dosage} {med.frequency}</span>
                                                                <span className="bg-gray-200 px-1 py-0.25 rounded text-[9px] uppercase font-bold text-gray-600 border border-gray-200">{med.status || 'Inactive'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleUpdateMedication(med.id, { active: true, status: 'active' })}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                title="Re-activate"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteMedication(med.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {medications.filter(m => m.active === false).length === 0 && (
                                                    <div className="text-center py-4 text-[10px] text-gray-400 italic">No medication history on file</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ALLERGIES TAB */}
                                {activeTab === 'allergies' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-red-600 font-bold">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-red-100 p-2 rounded-lg"><AlertCircle className="w-5 h-5" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Allergies</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold italic">Critical warnings</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowAddAllergyForm(!showAddAllergyForm)} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all shadow-sm">
                                                <Plus className="w-3.5 h-3.5" />{showAddAllergyForm ? 'Cancel' : 'Add Allergy'}
                                            </button>
                                        </div>

                                        {showAddAllergyForm && (
                                            <form onSubmit={handleQuickAddAllergy} className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3 animate-fade-in">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Allergen</label>
                                                        <input required type="text" value={allergyForm.allergen} onChange={e => setAllergyForm({ ...allergyForm, allergen: e.target.value })} className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g. Penicillin" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Reaction</label>
                                                        <input type="text" value={allergyForm.reaction} onChange={e => setAllergyForm({ ...allergyForm, reaction: e.target.value })} className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g. Hives" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Severity</label>
                                                        <select value={allergyForm.severity} onChange={e => setAllergyForm({ ...allergyForm, severity: e.target.value })} className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white">
                                                            <option>Mild</option>
                                                            <option>Moderate</option>
                                                            <option>Severe</option>
                                                            <option>Critical</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button type="submit" className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 shadow-sm transition-all">Save Allergy</button>
                                                </div>
                                            </form>
                                        )}

                                        <div className="space-y-2">
                                            {allergies.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">NKDA (No Known Drug Allergies)</div>
                                            ) : (
                                                allergies.map(all => (
                                                    <div key={all.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-red-100 transition-all group flex items-start justify-between">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{all.allergen}</div>
                                                            <div className="text-sm text-red-600 font-medium mt-0.5">{all.reaction || 'Reaction unknown'}</div>
                                                            <div className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide font-bold">{all.severity || 'Moderate'} Severity</div>
                                                        </div>
                                                        <button onClick={() => handleDeleteAllergy(all.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* FAMILY HISTORY TAB */}
                                {activeTab === 'family' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-purple-100 p-2 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Family History</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Genetic & Hereditary markers</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowAddFamilyForm(!showAddFamilyForm)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all shadow-sm">
                                                <Plus className="w-3.5 h-3.5" />{showAddFamilyForm ? 'Cancel' : 'Add Entry'}
                                            </button>
                                        </div>

                                        {showAddFamilyForm && (
                                            <form onSubmit={handleQuickAddFamilyHx} className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3 animate-fade-in">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Relationship</label>
                                                        <input required type="text" value={familyForm.relationship} onChange={e => setFamilyForm({ ...familyForm, relationship: e.target.value })} className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Mother" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Condition</label>
                                                        <input required type="text" value={familyForm.condition} onChange={e => setFamilyForm({ ...familyForm, condition: e.target.value })} className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Hypertension" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Age of Onset</label>
                                                        <input type="text" value={familyForm.onsetAge} onChange={e => setFamilyForm({ ...familyForm, onsetAge: e.target.value })} className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. 45" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button type="submit" className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 shadow-sm transition-all">Save Record</button>
                                                </div>
                                            </form>
                                        )}

                                        <div className="space-y-2">
                                            {familyHistory.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">No family history on file</div>
                                            ) : (
                                                familyHistory.map(fam => (
                                                    <div key={fam.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex items-start justify-between">
                                                        <div>
                                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                                                {fam.relationship}
                                                                <span className="text-xs font-normal text-gray-500">— {fam.condition}</span>
                                                            </div>
                                                            {fam.age_at_diagnosis && <div className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Age of Onset: {fam.age_at_diagnosis} yr</div>}
                                                        </div>
                                                        <button onClick={() => handleDeleteFamilyHistory(fam.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SURGICAL HISTORY TAB */}
                                {activeTab === 'surgical' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded-lg"><ActivitySquare className="w-5 h-5 text-blue-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Surgical History</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Past procedures & operations</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowAddSurgicalForm(!showAddSurgicalForm)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                                                <Plus className="w-3.5 h-3.5" />{showAddSurgicalForm ? 'Cancel' : 'Add Procedure'}
                                            </button>
                                        </div>

                                        {showAddSurgicalForm && (
                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 animate-fade-in mb-4">
                                                <SurgicalHistoryInput
                                                    onSave={async (item) => {
                                                        try {
                                                            await patientsAPI.addSurgicalHistory(patientId, item);
                                                            setShowAddSurgicalForm(false);
                                                            window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                                            fetchAllData();
                                                        } catch (error) {
                                                            console.error('Add surgical error:', error);
                                                            alert('Failed to add surgical history');
                                                        }
                                                    }}
                                                    onCancel={() => setShowAddSurgicalForm(false)}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {surgicalHistory.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">No surgical history on file</div>
                                            ) : (
                                                surgicalHistory.map(surg => (
                                                    <div key={surg.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group flex items-start justify-between">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{surg.procedure_name}</div>
                                                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                                                {surg.date && <span>Date: {new Date(surg.date).toLocaleDateString()}</span>}
                                                                {surg.surgeon && <span>Surgeon: {surg.surgeon}</span>}
                                                            </div>
                                                            {surg.notes && <div className="text-xs text-gray-400 mt-2 line-clamp-2">{surg.notes}</div>}
                                                        </div>
                                                        <button onClick={() => handleDeleteSurgicalHistory(surg.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SOCIAL HISTORY TAB */}
                                {activeTab === 'social' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-100 p-2 rounded-lg"><UserCircle className="w-5 h-5 text-orange-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Social History</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Lifestyle & Environmental factors</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!showEditSocialForm) {
                                                        setSocialForm({
                                                            smoking_status: socialHistory?.smoking_status || '',
                                                            alcohol_use: socialHistory?.alcohol_use || '',
                                                            drug_use: socialHistory?.drug_use || '',
                                                            occupation: socialHistory?.occupation || '',
                                                            exercise_frequency: socialHistory?.exercise_frequency || '',
                                                            marital_status: socialHistory?.marital_status || ''
                                                        });
                                                    }
                                                    setShowEditSocialForm(!showEditSocialForm);
                                                }}
                                                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all border border-gray-200 shadow-sm"
                                            >
                                                {showEditSocialForm ? 'Cancel' : 'Update Social History'}
                                            </button>
                                        </div>

                                        {showEditSocialForm && (
                                            <form onSubmit={handleQuickUpdateSocial} className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-4 animate-fade-in mb-4">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Smoking Status</label>
                                                        <select value={socialForm.smoking_status} onChange={e => setSocialForm({ ...socialForm, smoking_status: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white">
                                                            <option value="">Select...</option>
                                                            <option>Never Smoked</option>
                                                            <option>Former Smoker</option>
                                                            <option>Current Every Day Smoker</option>
                                                            <option>Current Some Day Smoker</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Alcohol Use</label>
                                                        <input type="text" value={socialForm.alcohol_use} onChange={e => setSocialForm({ ...socialForm, alcohol_use: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Socially" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Drug Use</label>
                                                        <input type="text" value={socialForm.drug_use} onChange={e => setSocialForm({ ...socialForm, drug_use: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. None" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Occupation</label>
                                                        <input type="text" value={socialForm.occupation} onChange={e => setSocialForm({ ...socialForm, occupation: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Engineer" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Exercise</label>
                                                        <input type="text" value={socialForm.exercise_frequency} onChange={e => setSocialForm({ ...socialForm, exercise_frequency: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. 3x a week" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Marital Status</label>
                                                        <select value={socialForm.marital_status} onChange={e => setSocialForm({ ...socialForm, marital_status: e.target.value })} className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white">
                                                            <option value="">Select...</option>
                                                            <option>Single</option>
                                                            <option>Married</option>
                                                            <option>Divorced</option>
                                                            <option>Widowed</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button type="submit" className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 shadow-sm transition-all">Save Social History</button>
                                                </div>
                                            </form>
                                        )}

                                        {socialHistory ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Substance Use</h5>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Smoking Status</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.smoking_status || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Alcohol Use</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.alcohol_use || 'None'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Drug Use</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.drug_use || 'None'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Lifestyle</h5>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Occupation</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.occupation || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Exercise</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.exercise_frequency || 'None'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-medium">Marital Status</span>
                                                            <span className="text-xs font-bold text-gray-900">{socialHistory.marital_status || 'Unknown'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                <p className="text-sm text-gray-400 italic">No social history recorded</p>
                                                <button onClick={() => onOpenDataManager?.('social')} className="mt-2 text-xs text-primary-600 font-bold hover:underline">Add Social History</button>
                                            </div>
                                        )}
                                    </div>
                                )}


                                {/* LABS TAB */}
                                {activeTab === 'labs' && (
                                    <div className="space-y-4">
                                        {/* Cardiac Procedures Section */}
                                        {[...stressTests, ...cardiacCaths].length > 0 && (
                                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                                    <HeartPulse className="w-4 h-4 text-rose-500" />
                                                    Cardiac Procedures
                                                </h3>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {[...stressTests, ...cardiacCaths].map(study => {
                                                        const isStress = study.doc_type === 'stress_test';
                                                        const tagsStr = String(study.tags || '');
                                                        const mets = tagsStr.match(/mets:([^,]+)/)?.[1];
                                                        const ef = tagsStr.match(/ef:([^,]+)/)?.[1];
                                                        return (
                                                            <div key={study.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <div className="font-bold text-sm text-slate-900">{isStress ? 'Stress Test' : 'Cardiac Cath'}</div>
                                                                    <div className="text-[10px] text-slate-500">{new Date(study.created_at).toLocaleDateString()}</div>
                                                                </div>
                                                                <div className="text-xs text-slate-600 flex gap-4">
                                                                    {mets && <span>METS: <strong className="text-slate-900">{mets}</strong></span>}
                                                                    {ef && <span>LVEF: <strong className="text-slate-900">{ef}</strong></span>}
                                                                </div>
                                                                <button
                                                                    onClick={() => window.open(`/api/documents/${study.id}/file`, '_blank')}
                                                                    className="mt-2 text-[10px] text-primary-600 font-bold hover:underline flex items-center gap-1 uppercase tracking-wider"
                                                                >
                                                                    <FileImage className="w-3 h-3" /> View Report
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Lab Results Section */}
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                                <FlaskConical className="w-4 h-4 text-primary-500" />
                                                Lab Results
                                            </h3>
                                            <div className="space-y-2">
                                                {labs.length === 0 ? (
                                                    <p className="text-sm text-gray-400 italic">No lab results on file.</p>
                                                ) : (
                                                    labs.map(lab => (
                                                        <div key={lab.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                            <div>
                                                                <div className="font-medium text-sm text-gray-900">{lab.order_payload?.test_name || lab.order_payload?.name || 'Lab Test'}</div>
                                                                <div className="text-xs text-gray-500">{new Date(lab.created_at).toLocaleDateString()}</div>
                                                            </div>
                                                            {getStatusBadge(lab.status)}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DATA MANAGEMENT TAB (PAMFOS) */}
                                {activeTab === 'data' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'problems', label: 'Problems', desc: 'Manage active problems', color: 'blue' },
                                            { id: 'medications', label: 'Medications', desc: 'Reconcile home meds', color: 'green' },
                                            { id: 'allergies', label: 'Allergies', desc: 'Update allergy list', color: 'red' },
                                            { id: 'family', label: 'Family History', desc: 'Update family history', color: 'purple' },
                                            { id: 'social', label: 'Social History', desc: 'Update social/lifestyle', color: 'orange' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => { onClose(); onOpenDataManager?.(item.id); }}
                                                className={`p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-${item.color}-200 transition-all text-left group`}
                                            >
                                                <div className={`text-${item.color}-600 font-bold text-sm mb-1 group-hover:translate-x-1 transition-transform`}>{item.label}</div>
                                                <div className="text-xs text-gray-400">{item.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* DOCUMENTS & IMAGING (New Folder-Based Design) */}
                                {(activeTab === 'documents' || activeTab === 'images') && (
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center justify-between">
                                            {/* Search Bar */}
                                            <div className="relative w-full md:w-72">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search documents..."
                                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                                    value={docSearchTerm}
                                                    onChange={(e) => setDocSearchTerm(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 w-full md:w-auto">
                                                <label className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition-all shadow-sm">
                                                    <FilePlus className="w-4 h-4" />
                                                    <span>Upload to {documentCategories.find(c => c.id === selectedDocFolder)?.label || 'Folder'}</span>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (!file) return;
                                                            const fd = new FormData();
                                                            fd.append('file', file);
                                                            fd.append('patientId', patientId);

                                                            // Determine docType based on active tab or folder
                                                            let docType = 'other';
                                                            if (activeTab === 'images') docType = 'imaging';
                                                            else if (selectedDocFolder !== 'all') {
                                                                const cat = documentCategories.find(c => c.id === selectedDocFolder);
                                                                if (cat && cat.types.length > 0) docType = cat.types[0];
                                                            }

                                                            fd.append('docType', docType);
                                                            try {
                                                                await documentsAPI.upload(fd);
                                                                fetchAllData();
                                                                setDocSearchTerm('');
                                                            } catch (err) { alert('Upload failed'); }
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex flex-1 overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm font-sans">
                                            {/* Folder Sidebar */}
                                            <div className="w-48 bg-gray-50/50 border-r border-gray-100 flex-shrink-0 flex flex-col pt-3">
                                                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Categories</div>
                                                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                                                    {documentCategories.map(cat => {
                                                        const CatIcon = cat.icon;
                                                        const isSelected = selectedDocFolder === cat.id;
                                                        return (
                                                            <button
                                                                key={cat.id}
                                                                onClick={() => setSelectedDocFolder(cat.id)}
                                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all
                                                                    ${isSelected
                                                                        ? 'bg-blue-600 text-white shadow-md'
                                                                        : 'text-gray-500 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                <CatIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                                                                <span className="truncate">{cat.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Document List */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-white">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                                                    {(() => {
                                                        const category = documentCategories.find(c => c.id === selectedDocFolder);

                                                        // Filter logic
                                                        const filteredDocs = hubDocuments.filter(doc => {
                                                            // Folder filter
                                                            if (selectedDocFolder !== 'all') {
                                                                // Check if doc matches category by type OR by tags
                                                                const matchesType = category?.types?.includes(doc.doc_type);
                                                                const matchesTags = category?.tags?.some(tag => doc.tags?.includes(tag));

                                                                // Check if doc should be excluded (e.g. legal docs from 'Other')
                                                                const isExcluded = category?.excludeTags?.some(tag => doc.tags?.includes(tag));
                                                                if (isExcluded) return false;

                                                                if (!matchesType && !matchesTags) return false;
                                                            } else if (activeTab === 'images') {
                                                                // If in images tab but "all" folder, still filter for images
                                                                if (!['imaging', 'ekg', 'echo', 'stress_test', 'cardiac_cath'].includes(doc.doc_type)) return false;
                                                            }

                                                            // Search term filter
                                                            if (docSearchTerm.trim()) {
                                                                const term = docSearchTerm.toLowerCase();
                                                                const name = (doc.filename || doc.file_name || '').toLowerCase();
                                                                const type = (doc.doc_type || '').toLowerCase();
                                                                return name.includes(term) || type.includes(term);
                                                            }
                                                            return true;
                                                        });

                                                        if (filteredDocs.length === 0) {
                                                            return (
                                                                <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                                                                    <div className="p-4 bg-gray-50 rounded-full mb-3">
                                                                        <Search className="w-8 h-8 text-gray-200" />
                                                                    </div>
                                                                    <p className="text-sm font-medium">No documents found in this view</p>
                                                                    <button onClick={() => { setDocSearchTerm(''); setSelectedDocFolder('all'); }} className="mt-2 text-xs text-primary-600 hover:underline">Clear all filters</button>
                                                                </div>
                                                            );
                                                        }

                                                        return filteredDocs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(doc => {
                                                            let docLink = doc.file_url || doc.file_path || '#';
                                                            if (docLink !== '#' && !docLink.startsWith('http')) {
                                                                if (docLink.startsWith('uploads/')) docLink = `/api/${docLink}`;
                                                                else if (docLink.startsWith('/uploads/')) docLink = `/api${docLink}`;
                                                                else if (!docLink.startsWith('/')) docLink = `/${docLink}`;
                                                            }

                                                            const isImage = ['imaging', 'ekg', 'echo', 'stress_test', 'cardiac_cath'].includes(doc.doc_type) || doc.mime_type?.includes('image');

                                                            return (
                                                                <div key={doc.id} className="group bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md hover:border-primary-100 transition-all">
                                                                    <div className="flex justify-between items-start">
                                                                        <a href={docLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                                                                            <div className={`p-2 rounded-lg ${isImage ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'}`}>
                                                                                {isImage ? <Image className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="text-sm font-bold text-gray-900 truncate tracking-tight">{doc.filename || doc.file_name}</div>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase tracking-tighter">{doc.doc_type}</span>
                                                                                    <span className="text-[10px] text-gray-400 font-medium">{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                                                                                </div>
                                                                            </div>
                                                                        </a>
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                if (!confirm('Delete document?')) return;
                                                                                await documentsAPI.delete(doc.id);
                                                                                fetchAllData();
                                                                            }}
                                                                            className="text-gray-300 hover:text-rose-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-lg"
                                                                            title="Delete Document"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                    {/* Display Comments/Interpretations */}
                                                                    {doc.comments && Array.isArray(doc.comments) && doc.comments.length > 0 && (
                                                                        <div className="mt-3 px-3 py-2 bg-yellow-50 rounded-md border border-yellow-100 text-xs">
                                                                            <div className="font-semibold text-yellow-800 mb-1 flex items-center gap-1.5 border-b border-yellow-100/50 pb-1">
                                                                                <FileText className="w-3 h-3" /> Note/Interpretation:
                                                                            </div>
                                                                            <div className="space-y-1.5 pt-1">
                                                                                {doc.comments.map((c, idx) => (
                                                                                    <div key={idx} className="text-gray-700">
                                                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                                                            <span className="font-bold text-gray-900">{c.userName || 'Clinician'}</span>
                                                                                            <span className="text-gray-400 text-[10px]">{new Date(c.timestamp).toLocaleDateString()}</span>
                                                                                        </div>
                                                                                        <div className="text-gray-800 leading-relaxed">{c.comment}</div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EKG, ECHO, STRESS, CATH TABS */}
                                {(activeTab === 'ekg' || activeTab === 'echo' || activeTab === 'stress' || activeTab === 'cath') && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-gray-800">
                                                {activeTab === 'ekg' && 'EKG Records'}
                                                {activeTab === 'echo' && 'ECHO Records'}
                                                {activeTab === 'stress' && 'Stress Test Records'}
                                                {activeTab === 'cath' && 'Cardiac Cath Records'}
                                            </h3>
                                            <label className="btn btn-primary text-xs px-3 py-1.5 h-auto cursor-pointer">
                                                <FilePlus className="w-3.5 h-3.5 mr-1" />Upload
                                                <input type="file" className="hidden" onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    const fd = new FormData();
                                                    fd.append('file', file);
                                                    fd.append('patientId', patientId);
                                                    fd.append('docType', 'imaging');
                                                    fd.append('tags', activeTab === 'stress' ? 'stress_test' : activeTab === 'cath' ? 'cardiac_cath' : activeTab);
                                                    try {
                                                        await documentsAPI.upload(fd);
                                                        fetchAllData(); // Refresh
                                                    } catch (err) { alert('Upload failed'); }
                                                }} />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(() => {
                                                const currentDocs = activeTab === 'ekg' ? ekgs :
                                                    activeTab === 'echo' ? echos :
                                                        activeTab === 'stress' ? stressTests : cardiacCaths;

                                                if (currentDocs.length === 0) {
                                                    return <p className="col-span-2 text-center py-10 text-gray-400 text-sm italic">No {activeTab.toUpperCase()} records found.</p>;
                                                }

                                                return currentDocs.map(doc => {
                                                    let docLink = doc.file_path || doc.file_url || '#';
                                                    if (docLink !== '#' && !docLink.startsWith('http')) {
                                                        if (docLink.startsWith('uploads/')) docLink = `/api/${docLink}`;
                                                        else if (docLink.startsWith('/uploads/')) docLink = `/api${docLink}`;
                                                        else if (!docLink.startsWith('/')) docLink = `/${docLink}`;
                                                    }

                                                    return (
                                                        <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all flex justify-between items-start group">
                                                            <a href={docLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="bg-gray-100 p-2 rounded text-gray-500">
                                                                    <FileImage className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-medium text-gray-900 truncate">{doc.file_name || 'Study Result'}</div>
                                                                    <div className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</div>
                                                                    {doc.tags && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {doc.tags.filter(t => t.includes(':')).map(t => (
                                                                                <span key={t} className="px-1 bg-gray-100 text-[9px] text-gray-500 rounded">{t}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </a>
                                                            <button onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!confirm('Delete document?')) return;
                                                                await documentsAPI.delete(doc.id);
                                                                fetchAllData();
                                                            }} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* REFERRALS TAB */}
                                {activeTab === 'referrals' && (
                                    <div className="space-y-3">
                                        {referrals.length === 0 ? (
                                            <p className="text-center py-10 text-gray-400 text-sm">No referrals found.</p>
                                        ) : referrals.map(ref => (
                                            <div key={ref.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold text-gray-900 text-sm">{ref.recipient_name}</span>
                                                    {getStatusBadge(ref.status)}
                                                </div>
                                                <div className="text-xs text-gray-600 mb-2">{ref.recipient_specialty}</div>
                                                <div className="text-xs bg-gray-50 p-2 rounded text-gray-500">
                                                    Reason: {ref.reason}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* BILLING TAB */}
                                {activeTab === 'billing' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded-lg"><Receipt className="w-5 h-5 text-blue-600" /></div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">Billing & Fee Sheets</span>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">OpenEMR Billing System</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* List visits with a link to Fee Sheet */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Recent Visits</h4>
                                            {notes.length === 0 ? (
                                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                                                    No visits found for this patient.
                                                </div>
                                            ) : (
                                                notes.slice(0, 10).map(note => (
                                                    <div key={note.id} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-all">
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{format(new Date(note.visit_date || note.created_at), 'MMMM d, yyyy')}</div>
                                                            <div className="text-xs text-gray-400 font-mono">Ref: {note.id}</div>
                                                            <div className="text-[10px] text-gray-500">{note.visit_type || 'Office Visit'}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => navigate(`/patient/${patientId}/superbill/${note.id}`)}
                                                            className="px-4 py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all uppercase tracking-widest shadow-sm"
                                                        >
                                                            Open Superbill
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div >
            </div >

            {/* Keeping the existing logic for DoseSpot modal if needed */}
            {
                eprescribeEnabled && showDoseSpotModal && (
                    <DoseSpotPrescribe
                        patientId={patientId}
                        isOpen={showDoseSpotModal}
                        onClose={() => {
                            setShowDoseSpotModal(false);
                            fetchAllData(); // Refresh after closing
                        }}
                    />
                )
            }

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
            {showPrintOrdersModal && (
                <PrintOrdersModal
                    patient={{ ...patient, id: patientId }}
                    isOpen={showPrintOrdersModal}
                    onClose={() => setShowPrintOrdersModal(false)}
                />
            )}
        </div>
    );
};

export default PatientChartPanel;
