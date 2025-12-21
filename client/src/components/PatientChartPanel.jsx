import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Image, FlaskConical, Pill, ExternalLink, Database, CreditCard, Calendar, Clock, CheckCircle2, XCircle, UserCircle, FileImage, Trash2, Plus, Activity } from 'lucide-react';
import { visitsAPI, documentsAPI, ordersAPI, referralsAPI, patientsAPI, eprescribeAPI } from '../services/api';
import { format } from 'date-fns';
import DoseSpotPrescribe from './DoseSpotPrescribe';

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
    const [eprescribePrescriptions, setEprescribePrescriptions] = useState([]);
    const [eprescribeEnabled, setEprescribeEnabled] = useState(false);
    const [showDoseSpotModal, setShowDoseSpotModal] = useState(false);
    const [hubDocuments, setHubDocuments] = useState([]);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        insuranceProvider: '',
        insuranceId: '',
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: ''
    });


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

            // Fetch ePrescribe prescriptions and status
            try {
                const eprescribeStatus = await eprescribeAPI.getStatus();
                setEprescribeEnabled(eprescribeStatus.data?.enabled || false);

                if (eprescribeStatus.data?.enabled) {
                    const eprescribeResponse = await eprescribeAPI.getPrescriptions(patientId);
                    setEprescribePrescriptions(eprescribeResponse.data?.prescriptions || []);
                }
            } catch (error) {
                console.error('Error fetching ePrescribe data:', error);
                setEprescribeEnabled(false);
                setEprescribePrescriptions([]);
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

    const tabs = [
        { id: 'history', label: 'History', icon: FileText },
        { id: 'hub', label: 'Hub', icon: UserCircle },
        { id: 'data', label: 'Data', icon: Database },
        { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
        { id: 'referrals', label: 'Referrals', icon: ExternalLink },
        { id: 'labs', label: 'Labs', icon: FlaskConical },
        { id: 'images', label: 'Images', icon: Image },
        { id: 'documents', label: 'Documents', icon: FileImage }
    ];

    const toggleNote = (noteId) => {
        setExpandedNotes(prev => ({
            ...prev,
            [noteId]: !prev[noteId]
        }));
    };

    // Document Upload Logic
    const fileInputRef = useRef(null);
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('patientId', patientId);
        formData.append('docType', 'other'); // Default type
        // formData.append('visitId', ...); // Optional if linked to visit

        try {
            await documentsAPI.upload(formData);
            // Refresh documents
            const docsResponse = await documentsAPI.getByPatient(patientId);
            const docs = docsResponse.data || [];
            const imageDocs = docs.filter(d => d.doc_type === 'imaging');
            const otherDocs = docs.filter(d => d.doc_type !== 'imaging');

            setImages(imageDocs);
            setDocuments(otherDocs);
            setHubDocuments(docs);

            alert('Document uploaded successfully');
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Failed to upload document');
        }
    };

    const handleDeleteDocument = async (docId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            await documentsAPI.delete(docId);
            // Update state locally
            setDocuments(prev => prev.filter(d => d.id !== docId));
            setImages(prev => prev.filter(d => d.id !== docId));
            setHubDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Failed to delete document');
        }
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
            <div className="fixed inset-0 bg-deep-gray/30 backdrop-blur-md z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Header - Modern Design */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-deep-gray/10 bg-white">
                    <h2 className="text-2xl font-bold text-deep-gray">Patient Chart</h2>
                    <button onClick={onClose} className="p-2 hover:bg-soft-gray rounded-lg text-deep-gray/60 hover:text-deep-gray transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs - Modern Futuristic Design */}
                <div className="flex border-b border-deep-gray/10 bg-white overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200 ${isActive
                                    ? 'border-strong-azure text-strong-azure'
                                    : 'border-transparent text-deep-gray/60 hover:text-deep-gray hover:bg-soft-gray'
                                    }`}
                                style={isActive ? {
                                    background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.08), transparent)',
                                    borderBottomColor: '#3B82F6'
                                } : {}}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-strong-azure' : ''}`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-16">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-strong-azure"></div>
                            <p className="mt-4 text-deep-gray/70 font-medium">Loading...</p>
                        </div>
                    ) : (
                        <>
                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1 mb-2">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Note History</h3>
                                        <button className="text-blue-600 text-xs font-medium hover:underline">View All</button>
                                    </div>
                                    {notes.length === 0 ? (
                                        <p className="text-deep-gray/60 text-sm text-center py-8">No visit notes found</p>
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
                                                    className="relative p-3.5 border border-gray-100 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 cursor-pointer group mb-2"
                                                    onClick={() => toggleNote(note.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            {/* Icon & Type */}
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <span className="font-semibold text-gray-900 text-sm">{visitType}</span>
                                                            </div>

                                                            {/* Status Badge - Pill Style */}
                                                            {isSigned ? (
                                                                <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100/50 flex-shrink-0">
                                                                    Signed
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100/50 flex-shrink-0">
                                                                    Draft
                                                                </span>
                                                            )}

                                                            {/* Date & Provider */}
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                                                                <span>{dateTimeStr}</span>
                                                                <span>•</span>
                                                                <span className="text-gray-700">{providerName}</span>
                                                            </div>

                                                            {/* Snippet */}
                                                            {chiefComplaint && (
                                                                <span className="hidden md:inline-block text-xs text-gray-400 italic truncate max-w-[200px]">
                                                                    — {chiefComplaint}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isSigned && (
                                                        <button
                                                            onClick={handleDeleteNote}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-all absolute right-2 top-2"
                                                            title="Delete draft"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {isExpanded && noteText && (
                                                        <div className="mt-3 pt-3 border-t border-gray-50 pl-10">
                                                            <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50/50 p-3 rounded-lg">
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
                            {activeTab === 'hub' && (
                                <div className="space-y-6">
                                    {/* Insurance */}
                                    <div>
                                        <h3 className="text-lg font-bold text-deep-gray mb-3">Insurance Information</h3>
                                        <div className="space-y-2">
                                            <div><span className="font-medium">Provider:</span> {formData.insuranceProvider || 'Not set'}</div>
                                            <div><span className="font-medium">ID:</span> {formData.insuranceId || 'Not set'}</div>
                                        </div>
                                    </div>

                                    {/* Pharmacy */}
                                    <div>
                                        <h3 className="text-lg font-bold text-deep-gray mb-3">Pharmacy</h3>
                                        <div className="space-y-2">
                                            <div><span className="font-medium">Name:</span> {formData.pharmacyName || 'Not set'}</div>
                                            <div><span className="font-medium">Address:</span> {formData.pharmacyAddress || 'Not set'}</div>
                                            <div><span className="font-medium">Phone:</span> {formData.pharmacyPhone || 'Not set'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data Tab - Close this panel and open PatientDataManager */}
                            {activeTab === 'data' && (
                                <div className="space-y-4">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-deep-gray mb-2">Patient Data Management</h3>
                                        <p className="text-deep-gray/70 text-sm mb-4">Manage problems, medications, allergies, family history, and social history.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('problems');
                                                }
                                            }}
                                            className="p-4 border-2 border-deep-gray/10 rounded-xl hover:border-strong-azure/40 hover:bg-strong-azure/5 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Problems</div>
                                            <div className="text-xs text-deep-gray/60">Manage active problems</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('medications');
                                                }
                                            }}
                                            className="p-4 border-2 border-deep-gray/10 rounded-xl hover:border-strong-azure/40 hover:bg-strong-azure/5 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Medications</div>
                                            <div className="text-xs text-deep-gray/60">Manage medications</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('allergies');
                                                }
                                            }}
                                            className="p-4 border-2 border-deep-gray/10 rounded-xl hover:border-strong-azure/40 hover:bg-strong-azure/5 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Allergies</div>
                                            <div className="text-xs text-deep-gray/60">Manage allergies</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('family');
                                                }
                                            }}
                                            className="p-4 border-2 border-deep-gray/10 rounded-xl hover:border-strong-azure/40 hover:bg-strong-azure/5 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Family History</div>
                                            <div className="text-xs text-deep-gray/60">Manage family history</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                if (onOpenDataManager) {
                                                    onOpenDataManager('social');
                                                }
                                            }}
                                            className="p-4 border-2 border-deep-gray/10 rounded-xl hover:border-strong-azure/40 hover:bg-strong-azure/5 text-left transition-all duration-200"
                                        >
                                            <div className="font-semibold text-deep-gray mb-1">Social History</div>
                                            <div className="text-xs text-deep-gray/60">Manage social history</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Prescriptions Tab */}
                            {activeTab === 'prescriptions' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-bold text-deep-gray">
                                            Prescription Log ({prescriptions.length + eprescribePrescriptions.length})
                                        </h3>
                                        {eprescribeEnabled && (
                                            <button
                                                onClick={() => setShowDoseSpotModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium"
                                            >
                                                <Plus className="w-4 h-4" />
                                                New Prescription
                                            </button>
                                        )}
                                    </div>

                                    {/* Rx Activity Section (ePrescribe statuses) */}
                                    {eprescribeEnabled && eprescribePrescriptions.length > 0 && (
                                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Activity className="w-5 h-5 text-blue-600" />
                                                <h4 className="font-semibold text-blue-900">Rx Activity</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {eprescribePrescriptions.slice(0, 5).map((rx) => (
                                                    <div key={rx.id} className="flex items-center justify-between text-sm">
                                                        <span className="text-blue-800">{rx.medication_name}</span>
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${rx.status === 'SENT' || rx.status === 'sent' ? 'bg-green-100 text-green-800' :
                                                            rx.status === 'DRAFT' || rx.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                                                rx.status === 'CANCELLED' || rx.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {rx.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Combined Prescriptions List */}
                                    {prescriptions.length === 0 && eprescribePrescriptions.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Pill className="w-16 h-16 text-deep-gray/20 mx-auto mb-4" />
                                            <h4 className="text-lg font-bold text-deep-gray mb-2">No Prescriptions</h4>
                                            <p className="text-deep-gray/70">No prescriptions have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* ePrescribe Prescriptions */}
                                            {eprescribePrescriptions.map((prescription) => {
                                                const date = prescription.created_at ? format(new Date(prescription.created_at), 'MMM d, yyyy') : '';
                                                const sentDate = prescription.sent_at ? format(new Date(prescription.sent_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={prescription.id} className="bg-white border border-deep-gray/10 rounded-xl p-4 hover:shadow-lg hover:border-strong-azure/30 transition-all duration-200">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <h4 className="text-lg font-bold text-deep-gray">{prescription.medication_name}</h4>
                                                                    {getStatusBadge(prescription.status)}
                                                                </div>
                                                                {prescription.sig && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Sig:</span> {prescription.sig}
                                                                    </p>
                                                                )}
                                                                {prescription.quantity && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Quantity:</span> {prescription.quantity}
                                                                    </p>
                                                                )}
                                                                {prescription.refills !== undefined && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Refills:</span> {prescription.refills}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {(date || sentDate) && (
                                                                <div className="flex items-center space-x-1 text-xs text-deep-gray/60 ml-4">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{sentDate || date}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Legacy Prescriptions */}
                                            {prescriptions.map((prescription) => {
                                                const payload = prescription.order_payload || {};
                                                const medicationName = payload.medication_name || payload.medication || 'Unknown Medication';
                                                const sig = payload.sig || payload.instructions || '';
                                                const dispense = payload.dispense || payload.quantity || '';
                                                const diagnosis = payload.diagnosis || '';
                                                const date = prescription.created_at ? format(new Date(prescription.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={prescription.id} className="bg-white border border-deep-gray/10 rounded-xl p-4 hover:shadow-lg hover:border-strong-azure/30 transition-all duration-200">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <h4 className="text-lg font-bold text-deep-gray">{medicationName}</h4>
                                                                    {getStatusBadge(prescription.status)}
                                                                </div>
                                                                {sig && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Sig:</span> {sig}
                                                                    </p>
                                                                )}
                                                                {dispense && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Dispense:</span> {dispense}
                                                                    </p>
                                                                )}
                                                                {diagnosis && (
                                                                    <p className="text-sm text-deep-gray/70 mt-2">
                                                                        <span className="font-medium">Diagnosis:</span> {diagnosis}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-deep-gray/60 ml-4">
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
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-deep-gray mb-3">Referral Log ({referrals.length})</h3>
                                    {referrals.length === 0 ? (
                                        <div className="text-center py-12">
                                            <ExternalLink className="w-16 h-16 text-deep-gray/20 mx-auto mb-4" />
                                            <h4 className="text-lg font-bold text-deep-gray mb-2">No Referrals</h4>
                                            <p className="text-deep-gray/70">No referrals have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {referrals.map((referral) => {
                                                const recipientName = referral.recipient_name || 'Unknown Provider';
                                                const specialty = referral.recipient_specialty || '';
                                                const reason = referral.reason || '';
                                                const date = referral.created_at ? format(new Date(referral.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={referral.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <h4 className="text-lg font-semibold text-deep-gray">{recipientName}</h4>
                                                                    {getStatusBadge(referral.status)}
                                                                </div>
                                                                {specialty && (
                                                                    <p className="text-sm text-deep-gray/80 mb-1">
                                                                        <span className="font-medium">Specialty:</span> {specialty}
                                                                    </p>
                                                                )}
                                                                {reason && (
                                                                    <p className="text-sm text-gray-700 mb-1 mt-2">
                                                                        <span className="font-medium">Reason:</span> {reason}
                                                                    </p>
                                                                )}
                                                                {referral.recipient_address && (
                                                                    <p className="text-sm text-deep-gray/70 mt-2">
                                                                        <span className="font-medium">Address:</span> {referral.recipient_address}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-deep-gray/60 ml-4">
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
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-deep-gray mb-3">Lab Orders ({labs.length})</h3>
                                    {labs.length === 0 ? (
                                        <div className="text-center py-12">
                                            <FlaskConical className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                            <h4 className="text-lg font-semibold text-deep-gray mb-2">No Lab Orders</h4>
                                            <p className="text-deep-gray/70">No lab orders have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {labs.map((lab) => {
                                                const payload = lab.order_payload || {};
                                                const labName = payload.test_name || payload.testName || payload.name || 'Lab Order';
                                                const date = lab.created_at ? format(new Date(lab.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={lab.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <FlaskConical className="w-5 h-5 text-blue-600" />
                                                                    <h4 className="text-lg font-semibold text-deep-gray">{labName}</h4>
                                                                    {getStatusBadge(lab.status)}
                                                                </div>
                                                                {payload.results && (
                                                                    <div className="mt-2 text-sm text-gray-700">
                                                                        <span className="font-medium">Results: </span>
                                                                        <span>{typeof payload.results === 'object' ? JSON.stringify(payload.results) : payload.results}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {date && (
                                                                <div className="flex items-center space-x-1 text-xs text-deep-gray/60 ml-4">
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
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-deep-gray mb-3">Imaging Studies ({images.length})</h3>
                                    {images.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                            <h4 className="text-lg font-semibold text-deep-gray mb-2">No Imaging Studies</h4>
                                            <p className="text-deep-gray/70">No imaging studies have been recorded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {images.map((image) => {
                                                const date = image.created_at ? format(new Date(image.created_at), 'MMM d, yyyy') : '';
                                                const metadata = typeof image.metadata === 'string' ? JSON.parse(image.metadata || '{}') : (image.metadata || {});

                                                return (
                                                    <div key={image.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <Image className="w-5 h-5 text-purple-600" />
                                                                    <h4 className="text-lg font-semibold text-deep-gray">{image.filename || 'Imaging Study'}</h4>
                                                                </div>
                                                                <div className="text-sm text-gray-700 space-y-1">
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
                                                                <div className="flex items-center space-x-1 text-xs text-deep-gray/60 ml-4">
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
                                <div className="space-y-4">
                                    {/* Removed duplicate div */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-800">Documents ({documents.length})</h3>
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Upload Document
                                            </button>
                                        </div>
                                    </div>

                                    {documents.length === 0 ? (
                                        <div className="text-center py-16 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                                            <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <h4 className="text-base font-semibold text-gray-600 mb-1">No Documents</h4>
                                            <p className="text-gray-400 text-sm">Upload a document to get started</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {documents.map((doc) => {
                                                const date = doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : '';

                                                return (
                                                    <div key={doc.id} className="group bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all flex items-center justify-between">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                                                <FileText className="w-5 h-5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-sm font-semibold text-gray-900 truncate pr-4" title={doc.filename}>{doc.filename || 'Document'}</h4>
                                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                    <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded">{doc.doc_type || 'Document'}</span>
                                                                    <span>•</span>
                                                                    <span>{date}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <a
                                                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/documents/${doc.id}/file`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                                title="View"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                            <button
                                                                onClick={(e) => handleDeleteDocument(doc.id, e)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>



            {/* DoseSpot Prescribing Modal */}
            {patient && (
                <DoseSpotPrescribe
                    isOpen={showDoseSpotModal}
                    onClose={() => setShowDoseSpotModal(false)}
                    patientId={patientId}
                    patientName={patient ? `${patient.first_name} ${patient.last_name}` : ''}
                    onPrescriptionSent={async (newPrescriptions) => {
                        // Refresh prescriptions list
                        try {
                            const eprescribeResponse = await eprescribeAPI.getPrescriptions(patientId);
                            setEprescribePrescriptions(eprescribeResponse.data?.prescriptions || []);
                        } catch (error) {
                            console.error('Error refreshing prescriptions:', error);
                        }
                        setShowDoseSpotModal(false);
                    }}
                />
            )}
        </>
    );
};

export default PatientChartPanel;

