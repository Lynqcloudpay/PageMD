import React, { useState, useEffect } from 'react';
import { X, FileText, Image, FlaskConical, Pill, ExternalLink, Database, CreditCard, Calendar, Clock, CheckCircle2, XCircle, UserCircle, FileImage, Trash2, Activity, Heart, Upload } from 'lucide-react';
import { UploadModal } from './ActionModals';
import { visitsAPI, documentsAPI, ordersAPI, referralsAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';

const PatientChartPanel = ({ patientId, isOpen, onClose, initialTab = 'history', initialDataTab = 'problems', onOpenDataManager }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);

    // History Panel State
    const [notes, setNotes] = useState([]);
    const [labs, setLabs] = useState([]);
    const [images, setImages] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [expandedNotes, setExpandedNotes] = useState({});

    // Patient Hub State
    const [patient, setPatient] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [hubDocuments, setHubDocuments] = useState([]);
    const [editing, setEditing] = useState(false);
    const [allergies, setAllergies] = useState([]);
    const [problems, setProblems] = useState([]);
    const [formData, setFormData] = useState({
        insuranceProvider: '',
        insuranceId: '',
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: ''
    });

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);


    useEffect(() => {
        if (isOpen && patientId) {
            setActiveTab(initialTab);
            fetchAllData();
        }
    }, [isOpen, patientId, initialTab]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch patient data
            const patientResponse = await patientsAPI.get(patientId);
            const patientData = patientResponse.data || patientResponse;
            setPatient(patientData);

            if (patientData) {
                setFormData({
                    insuranceProvider: patientData.insurance_provider || '',
                    insuranceId: patientData.insurance_id || '',
                    pharmacyName: patientData.pharmacy_name || '',
                    pharmacyAddress: patientData.pharmacy_address || '',
                    pharmacyPhone: patientData.pharmacy_phone || ''
                });
            }

            // Fetch allergies and problems for hub stats
            try {
                const [allergiesRes, problemsRes] = await Promise.all([
                    patientsAPI.getAllergies(patientId).catch(() => ({ data: [] })),
                    patientsAPI.getProblems(patientId).catch(() => ({ data: [] }))
                ]);
                setAllergies(Array.isArray(allergiesRes.data) ? allergiesRes.data : []);
                setProblems(Array.isArray(problemsRes.data) ? problemsRes.data : []);
            } catch (error) {
                console.error('Error fetching allergies/problems:', error);
                setAllergies([]);
                setProblems([]);
            }

            // Fetch visits/notes
            try {
                const visitsResponse = await visitsAPI.getByPatient(patientId);
                let visitsData = [];
                if (Array.isArray(visitsResponse)) {
                    visitsData = visitsResponse;
                } else if (visitsResponse?.data) {
                    visitsData = Array.isArray(visitsResponse.data) ? visitsResponse.data : [];
                }
                visitsData.sort((a, b) => {
                    const dateA = new Date(a.visit_date || a.created_at || 0);
                    const dateB = new Date(b.visit_date || b.created_at || 0);
                    return dateB - dateA;
                });
                setNotes(visitsData);
            } catch (error) {
                console.error('Error fetching visits:', error);
                setNotes([]);
            }

            // Fetch orders (prescriptions and labs)
            try {
                const ordersResponse = await ordersAPI.getByPatient(patientId);
                const orders = ordersResponse.data || [];

                // Filter prescriptions
                const rxOrders = orders.filter(order => order.order_type === 'rx');
                setPrescriptions(rxOrders);

                // Filter labs
                const labOrders = orders.filter(order => order.order_type === 'lab');
                setLabs(labOrders);
            } catch (error) {
                console.error('Error fetching orders:', error);
                setPrescriptions([]);
                setLabs([]);
            }

            // Fetch referrals
            try {
                const referralsResponse = await referralsAPI.getByPatient(patientId);
                setReferrals(referralsResponse.data || []);
            } catch (error) {
                console.error('Error fetching referrals:', error);
                setReferrals([]);
            }

            // Fetch documents
            try {
                const docsResponse = await documentsAPI.getByPatient(patientId);
                const docs = docsResponse.data || [];

                // Separate images from other documents
                const imageDocs = docs.filter(d => d.doc_type === 'imaging');
                const otherDocs = docs.filter(d => d.doc_type !== 'imaging');

                // Sort by date, most recent first
                imageDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                otherDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                setImages(imageDocs);
                setDocuments(otherDocs);
                setHubDocuments(docs);
            } catch (error) {
                console.error('Error fetching documents:', error);
                setImages([]);
                setDocuments([]);
                setHubDocuments([]);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = () => {
        fetchAllData();
        setShowUploadModal(false);
    };

    const tabs = [
        { id: 'history', label: 'History', icon: FileText },
        { id: 'hub', label: 'Hub', icon: UserCircle },
        { id: 'data', label: 'Data', icon: Database },
        { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
        { id: 'referrals', label: 'Referrals', icon: ExternalLink },
        { id: 'labs', label: 'Labs', icon: FlaskConical },
        { id: 'images', label: 'Images', icon: Image },
        { id: 'documents', label: 'Documents', icon: FileImage },
        { id: 'ekg', label: 'EKG', icon: Activity },
        { id: 'echo', label: 'ECHO', icon: Heart }
    ];

    const toggleNote = (noteId) => {
        setExpandedNotes(prev => ({
            ...prev,
            [noteId]: !prev[noteId]
        }));
    };

    const truncateNote = (noteText) => {
        if (!noteText || noteText.trim() === '') return 'No note content available';
        return noteText.length > 200 ? noteText.substring(0, 200) + '...' : noteText;
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            sent: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
            completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
            cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle }
        };
        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${config.color}`}>
                <Icon className="w-3 h-3" />
                <span>{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}</span>
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Modern Header with Gradient */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-5 py-4 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Patient Chart</h2>
                            <p className="text-primary-100 text-xs mt-0.5">Visit history and patient information</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Modern Tabs */}
                <div className="bg-white border-b border-gray-200 px-5">
                    <div className="flex gap-1 flex-wrap">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-3 transition-all flex-shrink-0 ${isActive
                                        ? 'text-primary-700 bg-primary-50'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    style={isActive ? { borderBottomWidth: '3px', borderBottomColor: '#3B82F6' } : { borderBottomWidth: '3px', borderBottomColor: 'transparent' }}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            <p className="mt-4 text-gray-600 font-medium">Loading...</p>
                        </div>
                    ) : (
                        <>
                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div className="space-y-2">
                                    {notes.length === 0 ? (
                                        <p className="text-gray-500 text-sm text-center py-8">No visit notes found</p>
                                    ) : (
                                        notes.map((note) => {
                                            const noteText = note.note_draft || '';

                                            // Parse chief complaint
                                            const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                                            const chiefComplaint = ccMatch ? ccMatch[1].trim() : null;

                                            // Format date and time
                                            const visitDateObj = note.visit_date ? new Date(note.visit_date) : (note.created_at ? new Date(note.created_at) : new Date());
                                            const createdDateObj = note.created_at ? new Date(note.created_at) : visitDateObj;
                                            const dateStr = visitDateObj.toLocaleDateString();

                                            // Check if visit_date has time component
                                            const hasTime = visitDateObj.getHours() !== 0 || visitDateObj.getMinutes() !== 0 || visitDateObj.getSeconds() !== 0;
                                            const timeSource = hasTime ? visitDateObj : createdDateObj;
                                            const timeStr = timeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            const dateTimeStr = `${dateStr} ${timeStr}`;

                                            const visitType = note.visit_type || "Office Visit";
                                            const isSigned = note.locked || !!note.note_signed_by;

                                            // Use signed_by name if note is signed, but fallback to provider if signed_by is "System Administrator"
                                            const signedByName = note.signed_by_first_name && note.signed_by_last_name
                                                ? `${note.signed_by_first_name} ${note.signed_by_last_name}`
                                                : null;

                                            const providerNameFallback = (note.provider_first_name && note.provider_last_name)
                                                ? `${note.provider_first_name} ${note.provider_last_name}`
                                                : note.provider_first_name || note.provider_last_name || "Provider";

                                            // Use signed_by name unless it's "System Administrator", then use provider name
                                            const providerName = (isSigned && signedByName && signedByName !== 'System Administrator')
                                                ? signedByName
                                                : providerNameFallback;
                                            const isExpanded = expandedNotes[note.id];

                                            const handleDeleteNote = async (e) => {
                                                e.stopPropagation();
                                                if (!window.confirm('Are you sure you want to delete this draft note? This action cannot be undone.')) {
                                                    return;
                                                }

                                                try {
                                                    await visitsAPI.delete(note.id);
                                                    // Refresh notes
                                                    fetchAllData();
                                                    alert('Draft note deleted successfully!');
                                                } catch (error) {
                                                    console.error('Error deleting draft note:', error);
                                                    alert('Failed to delete draft note.');
                                                }
                                            };

                                            return (
                                                <div
                                                    key={note.id}
                                                    className="relative p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:bg-primary-50 transition-all duration-200 cursor-pointer group"
                                                    onClick={() => toggleNote(note.id)}
                                                >
                                                    <div className="flex items-center space-x-2 flex-wrap">
                                                        <span className="text-xs font-bold text-gray-900">{visitType}</span>
                                                        {isSigned ? (
                                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">Signed</span>
                                                        ) : (
                                                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex-shrink-0">Draft</span>
                                                        )}
                                                        <span className="text-xs text-gray-500 flex-shrink-0">{dateTimeStr} • {providerName}</span>
                                                        {chiefComplaint && (
                                                            <span className="text-xs text-gray-700 italic">
                                                                • "{chiefComplaint.substring(0, 60)}{chiefComplaint.length > 60 ? '...' : ''}"
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isSigned && (
                                                        <button
                                                            onClick={handleDeleteNote}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all absolute right-2 top-2"
                                                            title="Delete draft"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                                        </button>
                                                    )}
                                                    {isExpanded && noteText && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                                            <div className="text-xs text-gray-700 whitespace-pre-wrap">
                                                                {noteText}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Hub Tab */}
                            {activeTab === 'hub' && patient && (
                                <div className="space-y-2">
                                    {/* Quick Stats Grid */}
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-white border-2 border-gray-200 rounded-lg p-2 shadow-sm">
                                            <div className="text-xs text-gray-500 uppercase font-semibold">Visits</div>
                                            <div className="text-lg font-bold text-gray-900">{notes.length}</div>
                                        </div>
                                        <div className="bg-white border-2 border-gray-200 rounded-lg p-2 shadow-sm">
                                            <div className="text-xs text-gray-500 uppercase font-semibold">Medications</div>
                                            <div className="text-lg font-bold text-gray-900">{prescriptions.length}</div>
                                        </div>
                                        <div className="bg-white border-2 border-gray-200 rounded-lg p-2 shadow-sm">
                                            <div className="text-xs text-gray-500 uppercase font-semibold">Allergies</div>
                                            <div className="text-lg font-bold text-red-600">{allergies.length}</div>
                                        </div>
                                        <div className="bg-white border-2 border-gray-200 rounded-lg p-2 shadow-sm">
                                            <div className="text-xs text-gray-500 uppercase font-semibold">Problems</div>
                                            <div className="text-lg font-bold text-gray-900">{problems.length}</div>
                                        </div>
                                    </div>

                                    {/* Demographics */}
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase">Demographics</h3>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div><span className="font-semibold text-gray-600">DOB:</span> <span className="text-gray-900">{patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'Not set'}</span></div>
                                            <div><span className="font-semibold text-gray-600">Age:</span> <span className="text-gray-900">{patient.dob ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'}</span></div>
                                            <div><span className="font-semibold text-gray-600">Gender:</span> <span className="text-gray-900">{patient.gender || 'Not set'}</span></div>
                                            <div><span className="font-semibold text-gray-600">MRN:</span> <span className="text-gray-900 font-mono">{patient.mrn || 'N/A'}</span></div>
                                        </div>
                                    </div>

                                    {/* Contact Information */}
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase">Contact</h3>
                                        <div className="space-y-1 text-xs">
                                            {patient.phone && (
                                                <div><span className="font-semibold text-gray-600">Phone:</span> <span className="text-gray-900">{patient.phone}</span></div>
                                            )}
                                            {patient.email && (
                                                <div><span className="font-semibold text-gray-600">Email:</span> <span className="text-gray-900">{patient.email}</span></div>
                                            )}
                                            {patient.address_line1 && (
                                                <div><span className="font-semibold text-gray-600">Address:</span> <span className="text-gray-900">{[patient.address_line1, patient.city, patient.state, patient.zip].filter(Boolean).join(', ')}</span></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Insurance */}
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase">Insurance</h3>
                                        <div className="space-y-1 text-xs">
                                            <div><span className="font-semibold text-gray-600">Provider:</span> <span className="text-gray-900">{formData.insuranceProvider || 'Not set'}</span></div>
                                            <div><span className="font-semibold text-gray-600">ID:</span> <span className="text-gray-900 font-mono">{formData.insuranceId || 'Not set'}</span></div>
                                        </div>
                                    </div>

                                    {/* Pharmacy */}
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase">Pharmacy</h3>
                                        <div className="space-y-1 text-xs">
                                            <div><span className="font-semibold text-gray-600">Name:</span> <span className="text-gray-900">{formData.pharmacyName || 'Not set'}</span></div>
                                            {formData.pharmacyAddress && (
                                                <div><span className="font-semibold text-gray-600">Address:</span> <span className="text-gray-900">{formData.pharmacyAddress}</span></div>
                                            )}
                                            {formData.pharmacyPhone && (
                                                <div><span className="font-semibold text-gray-600">Phone:</span> <span className="text-gray-900">{formData.pharmacyPhone}</span></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Activity */}
                                    {notes.length > 0 && (
                                        <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm">
                                            <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase">Last Visit</h3>
                                            <div className="text-xs text-gray-700">
                                                <div className="font-semibold">{notes[0].visit_type || 'Office Visit'}</div>
                                                <div className="text-gray-500">{notes[0].visit_date ? format(new Date(notes[0].visit_date), 'MMM d, yyyy') : format(new Date(notes[0].created_at), 'MMM d, yyyy')}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Data Tab - Close this panel and open PatientDataManager */}
                            {activeTab === 'data' && (
                                <div className="space-y-3">
                                    <div className="mb-4">
                                        <h3 className="text-base font-bold text-gray-900 mb-2">Patient Data Management</h3>
                                        <p className="text-gray-600 text-sm mb-4">Manage problems, medications, allergies, family history, and social history.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('problems');
                                                }
                                            }}
                                            className="p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-primary-300 hover:border-primary-600/40 hover:bg-primary-50 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Problems</div>
                                            <div className="text-xs text-gray-500">Manage active problems</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('medications');
                                                }
                                            }}
                                            className="p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-primary-300 hover:border-primary-600/40 hover:bg-primary-50 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Medications</div>
                                            <div className="text-xs text-gray-500">Manage medications</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('allergies');
                                                }
                                            }}
                                            className="p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-primary-300 hover:border-primary-600/40 hover:bg-primary-50 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Allergies</div>
                                            <div className="text-xs text-gray-500">Manage allergies</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('family');
                                                }
                                            }}
                                            className="p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-primary-300 hover:border-primary-600/40 hover:bg-primary-50 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Family History</div>
                                            <div className="text-xs text-gray-500">Manage family history</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('social');
                                                }
                                            }}
                                            className="p-3 border-2 border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md hover:border-primary-300 hover:border-primary-600/40 hover:bg-primary-50 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Social History</div>
                                            <div className="text-xs text-gray-500">Manage social history</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Prescriptions Tab */}
                            {activeTab === 'prescriptions' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">Prescription Log ({prescriptions.length})</h3>
                                    {prescriptions.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">No Prescriptions</h4>
                                            <p className="text-gray-600">No prescriptions have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {prescriptions.map((prescription) => {
                                                const payload = prescription.order_payload || {};
                                                const medicationName = payload.medication_name || payload.medication || 'Unknown Medication';
                                                const sig = payload.sig || payload.instructions || '';
                                                const dispense = payload.dispense || payload.quantity || '';
                                                const diagnosis = payload.diagnosis || '';
                                                const date = prescription.created_at ? format(new Date(prescription.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={prescription.id} className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:shadow-lg hover:border-primary-600/30 transition-all duration-200">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <h4 className="text-base font-bold text-gray-900">{medicationName}</h4>
                                                                    {getStatusBadge(prescription.status)}
                                                                </div>
                                                                {sig && (
                                                                    <p className="text-xs text-gray-700 mb-1">
                                                                        <span className="font-medium">Sig:</span> {sig}
                                                                    </p>
                                                                )}
                                                                {dispense && (
                                                                    <p className="text-xs text-gray-700 mb-1">
                                                                        <span className="font-medium">Dispense:</span> {dispense}
                                                                    </p>
                                                                )}
                                                                {diagnosis && (
                                                                    <p className="text-sm text-gray-600 mt-2">
                                                                        <span className="font-medium">Diagnosis:</span> {diagnosis}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Referrals Tab */}
                            {activeTab === 'referrals' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">Referral Log ({referrals.length})</h3>
                                    {referrals.length === 0 ? (
                                        <div className="text-center py-8">
                                            <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">No Referrals</h4>
                                            <p className="text-gray-600">No referrals have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {referrals.map((referral) => {
                                                const recipientName = referral.recipient_name || 'Unknown Provider';
                                                const specialty = referral.recipient_specialty || '';
                                                const reason = referral.reason || '';
                                                const date = referral.created_at ? format(new Date(referral.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={referral.id} className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <h4 className="text-base font-bold text-gray-900">{recipientName}</h4>
                                                                    {getStatusBadge(referral.status)}
                                                                </div>
                                                                {specialty && (
                                                                    <p className="text-xs text-gray-700 mb-1">
                                                                        <span className="font-medium">Specialty:</span> {specialty}
                                                                    </p>
                                                                )}
                                                                {reason && (
                                                                    <p className="text-xs text-gray-700 mb-1 mt-2">
                                                                        <span className="font-medium">Reason:</span> {reason}
                                                                    </p>
                                                                )}
                                                                {referral.recipient_address && (
                                                                    <p className="text-sm text-gray-600 mt-2">
                                                                        <span className="font-medium">Address:</span> {referral.recipient_address}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Labs Tab */}
                            {activeTab === 'labs' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">Lab Orders ({labs.length})</h3>
                                    {labs.length === 0 ? (
                                        <div className="text-center py-8">
                                            <FlaskConical className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">No Lab Orders</h4>
                                            <p className="text-gray-600">No lab orders have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {labs.map((lab) => {
                                                const payload = lab.order_payload || {};
                                                const labName = payload.test_name || payload.testName || payload.name || 'Lab Order';
                                                const date = lab.created_at ? format(new Date(lab.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={lab.id} className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <FlaskConical className="w-5 h-5 text-blue-600" />
                                                                    <h4 className="text-base font-bold text-gray-900">{labName}</h4>
                                                                    {getStatusBadge(lab.status)}
                                                                </div>
                                                                {payload.results && (
                                                                    <div className="mt-2 text-xs text-gray-700">
                                                                        <span className="font-medium">Results: </span>
                                                                        <span>{typeof payload.results === 'object' ? JSON.stringify(payload.results) : payload.results}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Images Tab */}
                            {activeTab === 'images' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">Imaging Studies ({images.length})</h3>
                                    {images.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">No Imaging Studies</h4>
                                            <p className="text-gray-600">No imaging studies have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {images.map((image) => {
                                                const date = image.created_at ? format(new Date(image.created_at), 'MMM d, yyyy') : '';
                                                const metadata = typeof image.metadata === 'string' ? JSON.parse(image.metadata || '{}') : (image.metadata || {});

                                                return (
                                                    <div key={image.id} className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <Image className="w-5 h-5 text-purple-600" />
                                                                    <h4 className="text-base font-bold text-gray-900">{image.filename || 'Imaging Study'}</h4>
                                                                </div>
                                                                <div className="text-xs text-gray-700 space-y-1">
                                                                    <div><span className="font-medium">Type:</span> {image.doc_type || 'Imaging'}</div>
                                                                    {metadata.study_type && (
                                                                        <div><span className="font-medium">Study:</span> {metadata.study_type}</div>
                                                                    )}
                                                                    {metadata.body_part && (
                                                                        <div><span className="font-medium">Body Part:</span> {metadata.body_part}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Documents Tab */}
                            {activeTab === 'documents' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-base font-bold text-gray-900">Documents ({documents.length})</h3>
                                        <button
                                            onClick={() => setShowUploadModal(true)}
                                            className="flex items-center space-x-1 text-sm font-medium text-primary-600 hover:text-primary-700 bg-white border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 transition-colors"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span>Upload</span>
                                        </button>
                                    </div>
                                    {documents.length === 0 ? (
                                        <div className="text-center py-8">
                                            <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">No Documents</h4>
                                            <p className="text-gray-600">No documents have been uploaded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {documents.map((doc) => {
                                                const date = doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={doc.id} className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <FileImage className="w-5 h-5 text-gray-600" />
                                                                    <h4 className="text-base font-bold text-gray-900">{doc.filename || 'Document'}</h4>
                                                                </div>
                                                                <div className="text-xs text-gray-700 space-y-1">
                                                                    <div><span className="font-medium">Type:</span> {doc.doc_type || 'Document'}</div>
                                                                    {doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                                            {doc.tags.map((tag, idx) => (
                                                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                                                    {tag}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ekg' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">EKG Studies</h3>
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                                        <div className="text-center py-8">
                                            <Activity className="w-12 h-12 text-red-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">EKG Viewer</h4>
                                            <p className="text-gray-600 mb-4">View and manage EKG studies for this patient.</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    // TODO: Implement EKG upload
                                                    console.log('Upload EKG');
                                                }}
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                            >
                                                Upload EKG
                                            </button>
                                        </div>
                                        <div className="mt-6 space-y-3">
                                            <div className="text-sm font-semibold text-gray-700 mb-2">Recent EKGs</div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <div className="flex items-center space-x-3">
                                                        <FileImage className="w-5 h-5 text-gray-600" />
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">EKG - 01/15/2025</div>
                                                            <div className="text-xs text-gray-500">12-Lead EKG</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // TODO: Open EKG viewer
                                                            console.log('View EKG');
                                                        }}
                                                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <div className="flex items-center space-x-3">
                                                        <FileImage className="w-5 h-5 text-gray-600" />
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">EKG - 12/10/2024</div>
                                                            <div className="text-xs text-gray-500">12-Lead EKG</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // TODO: Open EKG viewer
                                                            console.log('View EKG');
                                                        }}
                                                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'echo' && (
                                <div className="space-y-3">
                                    <h3 className="text-base font-bold text-gray-900 mb-2">ECHO Studies</h3>
                                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                                        <div className="text-center py-8">
                                            <Heart className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-900 mb-2">ECHO Viewer</h4>
                                            <p className="text-gray-600 mb-4">View and manage echocardiogram studies for this patient.</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    // TODO: Implement ECHO upload
                                                    console.log('Upload ECHO');
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                Upload ECHO
                                            </button>
                                        </div>
                                        <div className="mt-6 space-y-3">
                                            <div className="text-sm font-semibold text-gray-700 mb-2">Recent ECHOs</div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <div className="flex items-center space-x-3">
                                                        <FileImage className="w-5 h-5 text-gray-600" />
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">ECHO - 01/10/2025</div>
                                                            <div className="text-xs text-gray-500">Transthoracic Echocardiogram</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // TODO: Open ECHO viewer
                                                            console.log('View ECHO');
                                                        }}
                                                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <div className="flex items-center space-x-3">
                                                        <FileImage className="w-5 h-5 text-gray-600" />
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">ECHO - 11/15/2024</div>
                                                            <div className="text-xs text-gray-500">Transthoracic Echocardiogram</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // TODO: Open ECHO viewer
                                                            console.log('View ECHO');
                                                        }}
                                                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                patientId={patientId}
                onSuccess={handleUploadSuccess}
            />

        </>
    );
};

export default PatientChartPanel;

