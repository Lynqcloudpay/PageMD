import React, { useState, useEffect } from 'react';
import { X, FileText, Image, FlaskConical, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { visitsAPI, documentsAPI, ordersAPI } from '../services/api';
import { format } from 'date-fns';

const PatientHistoryPanel = ({ patientId, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('notes');
    const [notes, setNotes] = useState([]);
    const [labs, setLabs] = useState([]);
    const [images, setImages] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState({});

    useEffect(() => {
        if (isOpen && patientId) {
            fetchAllData();
        }
    }, [isOpen, patientId]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch visits/notes
            try {
                const visitsResponse = await visitsAPI.getByPatient(patientId);
                // Handle both axios response format and direct array
                let visitsData = [];
                if (Array.isArray(visitsResponse)) {
                    visitsData = visitsResponse;
                } else if (visitsResponse?.data) {
                    visitsData = Array.isArray(visitsResponse.data) ? visitsResponse.data : [];
                } else if (visitsResponse?.response?.data) {
                    visitsData = Array.isArray(visitsResponse.response.data) ? visitsResponse.response.data : [];
                }
                
                console.log('Fetched visits for patient:', patientId, 'Count:', visitsData.length);
                if (visitsData.length > 0) {
                    console.log('Sample visit:', {
                        id: visitsData[0].id,
                        visit_date: visitsData[0].visit_date,
                        locked: visitsData[0].locked,
                        has_note_draft: !!visitsData[0].note_draft,
                        note_draft_length: visitsData[0].note_draft?.length || 0
                    });
                }
                
                // Sort by date, most recent first
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

            // Fetch orders (labs) - get all labs, not just recent
            const ordersResponse = await ordersAPI.getByPatient(patientId);
            const labOrders = (ordersResponse.data || []).filter(o => o.order_type === 'lab');
            // Sort by date, most recent first
            labOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setLabs(labOrders);

            // Fetch documents - get all documents
            const docsResponse = await documentsAPI.getByPatient(patientId);
            const imageDocs = (docsResponse.data || []).filter(d => d.doc_type === 'imaging');
            const otherDocs = (docsResponse.data || []).filter(d => d.doc_type !== 'imaging');
            // Sort by date, most recent first
            imageDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            otherDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setImages(imageDocs);
            setDocuments(otherDocs);
        } catch (error) {
            console.error('Error fetching patient history:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleNoteExpansion = (noteId) => {
        setExpandedNotes(prev => ({
            ...prev,
            [noteId]: !prev[noteId]
        }));
    };

    const formatNotePreview = (note) => {
        if (!note) return 'No note available';
        // The database only has note_draft field (not note_signed)
        // When locked=true, note_draft contains the signed note
        const noteText = note.note_draft || '';
        if (!noteText || noteText.trim() === '') return 'No note content available';
        return noteText.length > 200 ? noteText.substring(0, 200) + '...' : noteText;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-paper-200 shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-paper-200 flex items-center justify-between">
                <h2 className="font-serif font-bold text-lg text-ink-900">Patient History</h2>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-paper-100 rounded transition-colors"
                >
                    <X className="w-5 h-5 text-ink-600" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-paper-200">
                {[
                    { id: 'notes', label: 'Notes', icon: FileText, count: notes.length },
                    { id: 'labs', label: 'Labs', icon: FlaskConical, count: labs.length },
                    { id: 'images', label: 'Images', icon: Image, count: images.length },
                    { id: 'docs', label: 'Documents', icon: FileText, count: documents.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors
                            ${activeTab === tab.id
                                ? 'border-paper-700 text-ink-900 bg-paper-50'
                                : 'border-transparent text-ink-600 hover:text-ink-900 hover:bg-paper-50'
                            }
                        `}
                    >
                        <div className="flex items-center justify-center space-x-1">
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className="bg-paper-200 text-ink-700 text-xs px-1.5 py-0.5 rounded">
                                    {tab.count}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center text-ink-500 py-8">Loading...</div>
                ) : (
                    <>
                        {/* Notes Tab */}
                        {activeTab === 'notes' && (
                            <div className="space-y-3">
                                {notes.length === 0 ? (
                                    <div className="text-center text-ink-500 py-8">No visit notes found</div>
                                ) : (
                                    notes.map((note) => {
                                        const isExpanded = expandedNotes[note.id];
                                        const preview = formatNotePreview(note);
                                        return (
                                            <div
                                                key={note.id}
                                                className="border border-paper-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <Calendar className="w-4 h-4 text-ink-400" />
                                                            <span className="text-sm font-medium text-ink-900">
                                                                {note.visit_date ? format(new Date(note.visit_date), 'MMM d, yyyy') : 'No date'}
                                                            </span>
                                                            {note.locked && (
                                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                                                    Signed
                                                                </span>
                                                            )}
                                                        </div>
                                                        {note.provider_first_name && (
                                                            <div className="text-xs text-ink-500">
                                                                Provider: {note.provider_first_name} {note.provider_last_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => toggleNoteExpansion(note.id)}
                                                        className="p-1 hover:bg-paper-100 rounded"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-4 h-4 text-ink-500" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-ink-500" />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="text-sm text-ink-700 whitespace-pre-wrap">
                                                    {isExpanded ? (note.note_draft || 'No note content') : preview}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Labs Tab */}
                        {activeTab === 'labs' && (
                            <div className="space-y-3">
                                {labs.length === 0 ? (
                                    <div className="text-center text-ink-500 py-8">No lab orders found</div>
                                ) : (
                                    labs
                                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                                        .map((lab) => {
                                        const payload = typeof lab.order_payload === 'string' 
                                            ? JSON.parse(lab.order_payload) 
                                            : lab.order_payload || {};
                                        
                                        // Handle different result formats
                                        let results = [];
                                        if (payload?.results) {
                                            if (Array.isArray(payload.results)) {
                                                results = payload.results;
                                            } else if (typeof payload.results === 'object') {
                                                // Convert object to array format
                                                results = Object.entries(payload.results).map(([key, val]) => {
                                                    if (typeof val === 'object' && val !== null) {
                                                        return { test: key, ...val };
                                                    }
                                                    return { test: key, value: val };
                                                });
                                            }
                                        }
                                        
                                        // If no results array, try to extract from payload directly
                                        if (results.length === 0 && payload) {
                                            // Check for common lab value fields
                                            const testName = payload.test_name || payload.testName || payload.name;
                                            if (testName && (payload.value || payload.result || payload.amount)) {
                                                results = [{
                                                    test: testName,
                                                    value: payload.value || payload.result || payload.amount,
                                                    unit: payload.unit || '',
                                                    range: payload.range || payload.reference_range || payload.normal_range || '',
                                                    flag: payload.flag || (payload.normal === false ? 'A' : 'N'),
                                                    abnormal: payload.normal === false || payload.critical === true
                                                }];
                                            }
                                        }
                                        
                                        const labIsAbnormal = payload?.normal === false || payload?.critical === true;
                                        
                                        return (
                                            <div
                                                key={lab.id}
                                                className="border border-paper-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center space-x-2">
                                                        <FlaskConical className="w-4 h-4 text-blue-600" />
                                                        <span className="font-medium text-ink-900">
                                                            {payload?.test_name || payload?.testName || payload?.name || 'Lab Order'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-ink-500">
                                                        {lab.created_at ? format(new Date(lab.created_at), 'MMM d, yyyy') : 'N/A'}
                                                    </div>
                                                </div>
                                                
                                                {/* Lab Results Table */}
                                                {results && results.length > 0 ? (
                                                    <div className="mt-3 border-t border-paper-100 pt-2">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-ink-600 border-b border-paper-100">
                                                                    <th className="text-left py-1 font-semibold">Test</th>
                                                                    <th className="text-left py-1 font-semibold">Result</th>
                                                                    <th className="text-left py-1 font-semibold">Range</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {results.map((result, idx) => {
                                                                    const testName = result.test || result.name || result.testName || 'Unknown';
                                                                    const value = result.value || result.result || result.amount || 'N/A';
                                                                    const unit = result.unit || '';
                                                                    const displayValue = unit ? `${value} ${unit}` : value;
                                                                    const range = result.range || result.reference_range || result.referenceRange || result.normal_range || 'N/A';
                                                                    const isAbnormal = result.flag === 'H' || result.flag === 'L' || result.flag === 'A' || result.abnormal === true || result.flag === 'Abnormal';
                                                                    const isCritical = result.critical === true || result.flag === 'Critical';
                                                                    
                                                                    return (
                                                                        <tr key={idx} className="border-b border-paper-50">
                                                                            <td className="py-1.5 font-medium text-ink-900">{testName}</td>
                                                                            <td className={`py-1.5 font-semibold ${isAbnormal || isCritical ? 'text-red-600' : 'text-ink-700'}`}>
                                                                                {displayValue}
                                                                            </td>
                                                                            <td className="py-1.5 text-ink-600">{range}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-ink-500 mt-2 italic">
                                                        Results pending
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Images Tab */}
                        {activeTab === 'images' && (
                            <div className="space-y-3">
                                {images.length === 0 ? (
                                    <div className="text-center text-ink-500 py-8">No imaging studies found</div>
                                ) : (
                                    images
                                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                                        .map((image) => {
                                        const payload = typeof image.metadata === 'string' 
                                            ? JSON.parse(image.metadata) 
                                            : image.metadata || {};
                                        
                                        return (
                                            <div
                                                key={image.id}
                                                className="border border-paper-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Image className="w-4 h-4 text-purple-600" />
                                                        <span className="font-medium text-ink-900">{image.filename}</span>
                                                    </div>
                                                    <div className="text-xs text-ink-500">
                                                        {image.created_at ? format(new Date(image.created_at), 'MMM d, yyyy') : 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-ink-600 space-y-1">
                                                    <div>Type: <span className="font-medium">{image.doc_type || 'Imaging'}</span></div>
                                                    {payload?.study_type && (
                                                        <div>Study: <span className="font-medium">{payload.study_type}</span></div>
                                                    )}
                                                    {payload?.body_part && (
                                                        <div>Body Part: <span className="font-medium">{payload.body_part}</span></div>
                                                    )}
                                                    {payload?.impression && (
                                                        <div className="mt-2 pt-2 border-t border-paper-100">
                                                            <div className="font-semibold text-ink-700 mb-1">Impression:</div>
                                                            <div className="text-ink-600">{payload.impression}</div>
                                                        </div>
                                                    )}
                                                    {payload?.findings && (
                                                        <div className="mt-2 pt-2 border-t border-paper-100">
                                                            <div className="font-semibold text-ink-700 mb-1">Findings:</div>
                                                            <div className="text-ink-600 whitespace-pre-wrap">{payload.findings}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Documents Tab */}
                        {activeTab === 'docs' && (
                            <div className="space-y-3">
                                {documents.length === 0 ? (
                                    <div className="text-center text-ink-500 py-8">No documents found</div>
                                ) : (
                                    documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="border border-paper-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-center space-x-2 mb-2">
                                                <FileText className="w-4 h-4 text-ink-600" />
                                                <span className="font-medium text-ink-900">{doc.filename}</span>
                                            </div>
                                            <div className="text-xs text-ink-600 space-y-1">
                                                <div>Type: <span className="font-medium">{doc.doc_type || 'Document'}</span></div>
                                                <div>Date: {doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : 'N/A'}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PatientHistoryPanel;

