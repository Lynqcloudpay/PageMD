import React, { useState, useEffect, useRef } from 'react';
import {
    X, FileText, Image, FlaskConical, Pill, ExternalLink,
    Database, CreditCard, Calendar, Clock, CheckCircle2,
    XCircle, UserCircle, FileImage, Trash2, Plus, Activity,
    LayoutDashboard, ChevronRight, Search, FilePlus, ChevronDown, HeartPulse, ActivitySquare
} from 'lucide-react';
import { visitsAPI, documentsAPI, ordersAPI, referralsAPI, patientsAPI, eprescribeAPI } from '../services/api';
import { format } from 'date-fns';
import DoseSpotPrescribe from './DoseSpotPrescribe';
import VisitChartView from './VisitChartView';

const PatientChartPanel = ({ patientId, isOpen, onClose, initialTab = 'overview', initialDataTab = 'problems', onOpenDataManager }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);

    // History Panel State
    const [notes, setNotes] = useState([]);
    const [labs, setLabs] = useState([]);
    const [images, setImages] = useState([]);
    const [ekgs, setEkgs] = useState([]);
    const [echos, setEchos] = useState([]);
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
    const [hubDocuments, setHubDocuments] = useState([]);

    // Patient Details
    const [formData, setFormData] = useState({
        insuranceProvider: '',
        insuranceId: '',
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: ''
    });

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
                docsRes
            ] = await Promise.allSettled([
                patientsAPI.get(patientId),
                visitsAPI.getByPatient(patientId),
                ordersAPI.getByPatient(patientId),
                referralsAPI.getByPatient(patientId),
                eprescribeAPI.getStatus(),
                documentsAPI.getByPatient(patientId)
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

            // Process Orders (Meds & Labs)
            if (ordersRes.status === 'fulfilled') {
                const orders = ordersRes.value.data || [];
                setPrescriptions(orders.filter(o => o.order_type === 'rx'));
                setLabs(orders.filter(o => o.order_type === 'lab'));
            }

            // Process Referrals
            if (referralsRes.status === 'fulfilled') {
                const legacyReferrals = (ordersRes.status === 'fulfilled' ? ordersRes.value.data : [])
                    .filter(o => o.order_type === 'referral')
                    .map(o => ({
                        id: o.id,
                        recipient_name: o.order_payload?.specialist || 'Specialist',
                        recipient_specialty: o.order_payload?.specialist || 'Specialty',
                        reason: o.order_payload?.reason || 'Reason not specified',
                        status: o.status,
                        created_at: o.created_at
                    }));

                const dedicatedReferrals = referralsRes.value.data || [];
                setReferrals([...dedicatedReferrals, ...legacyReferrals]);
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

            // Process Documents
            if (docsRes.status === 'fulfilled') {
                const docs = docsRes.value.data || [];
                setImages(docs.filter(d => d.doc_type === 'imaging').sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setEkgs(docs.filter(d => d.doc_type === 'ekg').sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setEchos(docs.filter(d => d.doc_type === 'echo').sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
                setDocuments(docs.filter(d => !['imaging', 'ekg', 'echo'].includes(d.doc_type)).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
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
        { id: 'prescriptions', label: 'Medications', icon: Pill },
        { id: 'labs', label: 'Labs / Studies', icon: FlaskConical },
        { id: 'documents', label: 'Documents', icon: FileImage },
        { id: 'images', label: 'Imaging', icon: Image },
        { id: 'ekg', label: 'EKG', icon: ActivitySquare },
        { id: 'echo', label: 'ECHO', icon: HeartPulse },
        { id: 'referrals', label: 'Referrals', icon: ExternalLink },
        { id: 'data', label: 'PAMFOS Data', icon: Database },
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
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            {tabs.find(t => t.id === activeTab)?.icon && React.createElement(tabs.find(t => t.id === activeTab).icon, { className: "w-5 h-5 text-gray-400" })}
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all">
                            <X className="w-5 h-5" />
                        </button>
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
                                                    <div className="mt-1 font-bold text-gray-800">{prescriptions.length + eprescribePrescriptions.length}</div>
                                                </div>
                                                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 hover:bg-purple-50 transition-colors">
                                                    <span className="text-xs font-semibold text-purple-600 uppercase">Allergies</span>
                                                    <div className="mt-1 font-bold text-gray-800">{patient?.allergies?.length || 0}</div>
                                                </div>
                                                <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 hover:bg-orange-50 transition-colors">
                                                    <span className="text-xs font-semibold text-orange-600 uppercase">Pending Labs</span>
                                                    <div className="mt-1 font-bold text-gray-800">{labs.filter(l => l.status === 'pending').length}</div>
                                                </div>
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
                                                    <div className="text-sm text-gray-600 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                                                        {notes[0].note_draft ? (
                                                            <div className="whitespace-pre-wrap font-mono text-xs">{notes[0].note_draft.substring(0, 500)}...</div>
                                                        ) : (
                                                            <span className="italic text-gray-400">No content in latest note draft.</span>
                                                        )}
                                                    </div>
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
                                                const noteText = note.note_draft || "";
                                                // Extract chief complaint
                                                const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
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
                                                                    const parseNote = (text) => {
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

                                {/* PRESCRIPTIONS TAB */}
                                {activeTab === 'prescriptions' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-blue-100 p-1.5 rounded-md"><Pill className="w-4 h-4 text-blue-600" /></div>
                                                <span className="text-sm font-semibold text-gray-700">All Medications</span>
                                            </div>
                                            {eprescribeEnabled && (
                                                <button onClick={() => setShowDoseSpotModal(true)} className="btn btn-primary text-xs px-3 py-1.5 h-auto">
                                                    <Plus className="w-3.5 h-3.5 mr-1" />New Rx
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {(() => {
                                                const homeMeds = (patient?.medications || []).map(med => ({
                                                    id: med.id,
                                                    medication_name: med.name || med.medication,
                                                    sig: med.dosage || med.instructions || '',
                                                    created_at: med.created_at,
                                                    source: 'home'
                                                }));
                                                const allMeds = [...homeMeds, ...eprescribePrescriptions, ...prescriptions];

                                                if (allMeds.length === 0) {
                                                    return <div className="text-center py-10 text-gray-400 text-sm">No medications found.</div>;
                                                }

                                                return allMeds.map((rx, idx) => {
                                                    const name = rx.medication_name || rx.order_payload?.medication_name || rx.order_payload?.medication || 'Unknown Med';
                                                    const sig = rx.sig || rx.order_payload?.sig || rx.order_payload?.instructions || '';
                                                    const date = rx.created_at || rx.sent_at ? new Date(rx.created_at || rx.sent_at).toLocaleDateString() : 'N/A';

                                                    return (
                                                        <div key={rx.id || `med-${idx}`} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-primary-200 hover:shadow-sm transition-all">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="font-bold text-gray-900 text-sm">{name}</div>
                                                                    <div className="text-xs text-gray-500 mt-1">{sig}</div>
                                                                    {rx.order_payload?.dispense && <div className="text-xs text-gray-400 mt-0.5">Qty: {rx.order_payload.dispense}</div>}
                                                                </div>
                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    {rx.source === 'home' ? (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold bg-blue-100 text-blue-800">Home Med</span>
                                                                    ) : (
                                                                        getStatusBadge(rx.status)
                                                                    )}
                                                                    <span className="text-[10px] text-gray-400">{date}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* LABS TAB */}
                                {activeTab === 'labs' && (
                                    <div className="space-y-4">
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
                                                                <div className="font-medium text-sm text-gray-900">{lab.order_payload?.test_name || 'Lab Test'}</div>
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

                                {/* DOCUMENTS & IMAGING (Reuse logic for both tabs) */}
                                {(activeTab === 'documents' || activeTab === 'images') && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-gray-800">{activeTab === 'images' ? 'Imaging Results' : 'Patient Documents'}</h3>
                                            <label className="btn btn-primary text-xs px-3 py-1.5 h-auto cursor-pointer">
                                                <FilePlus className="w-3.5 h-3.5 mr-1" />Upload
                                                <input type="file" className="hidden" onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    const fd = new FormData();
                                                    fd.append('file', file);
                                                    fd.append('patientId', patientId);
                                                    fd.append('docType', activeTab === 'images' ? 'imaging' : 'other');
                                                    try {
                                                        await documentsAPI.upload(fd);
                                                        fetchAllData(); // Refresh
                                                    } catch (err) { alert('Upload failed'); }
                                                }} />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(activeTab === 'images' ? images : documents).length === 0 ? (
                                                <p className="col-span-2 text-center py-10 text-gray-400 text-sm italic">No {activeTab} found.</p>
                                            ) : (activeTab === 'images' ? images : documents).map(doc => (
                                                <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all flex justify-between items-start group">
                                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className="bg-gray-100 p-2 rounded text-gray-500">
                                                            {activeTab === 'images' ? <Image className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-gray-900 truncate">{doc.filename}</div>
                                                            <div className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</div>
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
                                            ))}
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

                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Keeping the existing logic for DoseSpot modal if needed */}
            {eprescribeEnabled && showDoseSpotModal && (
                <DoseSpotPrescribe
                    patientId={patientId}
                    isOpen={showDoseSpotModal}
                    onClose={() => {
                        setShowDoseSpotModal(false);
                        fetchAllData(); // Refresh after closing
                    }}
                />
            )}

            {/* Visit Chart View Modal */}
            {selectedVisitForView && (
                <VisitChartView
                    visitId={selectedVisitForView.visitId}
                    patientId={selectedVisitForView.patientId}
                    onClose={() => setSelectedVisitForView(null)}
                />
            )}
        </div>
    );
};

export default PatientChartPanel;
