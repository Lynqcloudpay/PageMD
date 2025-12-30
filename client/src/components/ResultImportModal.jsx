import React, { useState, useEffect } from 'react';
import { X, FileText, Activity, FlaskConical, Stethoscope, RefreshCw, AlertCircle, Clock, CheckCircle, FileImage, Heart, Waves } from 'lucide-react';
import { ordersAPI, documentsAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';

const ResultImportModal = ({ isOpen, onClose, onImport, patientId, resultType }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);

    // Filter configuration based on type
    const getFilterKeywords = (type) => {
        switch (type) {
            case 'Labs': return ['lab', 'blood', 'urine', 'panel', 'culture', 'bmp', 'cmp', 'cbc'];
            case 'Imaging': return ['x-ray', 'ct', 'mri', 'ultrasound', 'scan', 'radiology', 'imaging'];
            case 'Echo': return ['echo', 'tte', 'tee', 'echocardiogram'];
            case 'EKG': return ['ekg', 'ecg', 'electrocardiogram'];
            case 'Cath': return ['cath', 'angiogram', 'pci', 'coronary'];
            case 'Stress': return ['stress', 'exercise', 'nuclear', 'treadmill'];
            default: return [];
        }
    };

    const loadData = async () => {
        if (!patientId || !resultType) return;

        setLoading(true);
        setError(null);
        try {
            // Fetch orders, documents, AND full patient data (for arrays like ekgs, imaging, etc.)
            const [ordersRes, docsRes, patientRes] = await Promise.allSettled([
                ordersAPI.getByPatient(patientId),
                documentsAPI.getByPatient(patientId),
                patientsAPI.get(patientId) // This returns the "mother chart" data
            ]);

            let combinedItems = [];

            // 1. Process "Mother Chart" Data (Direct Arrays)
            if (patientRes.status === 'fulfilled' && patientRes.value.data) {
                const pData = patientRes.value.data;
                let specificItems = [];

                // Select the correct array based on resultType
                // Note: The property names must match what the backend/Snapshot uses
                switch (resultType) {
                    case 'Labs':
                        if (Array.isArray(pData.labs)) specificItems = pData.labs;
                        break;
                    case 'Imaging':
                        if (Array.isArray(pData.imaging)) specificItems = pData.imaging;
                        break;
                    case 'Echo':
                        if (Array.isArray(pData.echos)) specificItems = pData.echos;
                        break;
                    case 'EKG':
                        if (Array.isArray(pData.ekgs)) specificItems = pData.ekgs;
                        else if (Array.isArray(pData.ekg)) specificItems = pData.ekg;
                        break;
                    case 'Cath':
                        if (Array.isArray(pData.cardiac_caths)) specificItems = pData.cardiac_caths;
                        else if (Array.isArray(pData.caths)) specificItems = pData.caths;
                        break;
                    case 'Stress':
                        if (Array.isArray(pData.stress_tests)) specificItems = pData.stress_tests;
                        break;
                    default:
                        break;
                }

                const mappedSpecifics = specificItems.map((item, idx) => ({
                    id: `pat-${idx}-${item.id || idx}`,
                    type: 'record', // From patient record directly
                    title: item.type || item.name || item.study_type || `${resultType} Record`,
                    description: item.result || item.impression || item.summary || 'See full chart for details',
                    date: item.date || item.created_at || item.study_date,
                    status: 'Completed',
                    source: item
                }));

                combinedItems = [...combinedItems, ...mappedSpecifics];
            }

            // 2. Process Orders
            if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
                const orders = ordersRes.value.data.filter(o => {
                    const typeMatch = o.type?.toUpperCase() === resultType.toUpperCase(); // Direct match?
                    // Or keyword match
                    const keywords = getFilterKeywords(resultType);
                    const textMatch = keywords.some(k =>
                        o.name?.toLowerCase().includes(k) ||
                        o.description?.toLowerCase().includes(k) ||
                        o.type?.toLowerCase().includes(k)
                    );
                    return typeMatch || textMatch;
                }).map(o => ({
                    id: `ord-${o.id}`,
                    type: 'order',
                    title: o.name || o.description || 'Untitled Order',
                    date: o.created_at || o.order_date,
                    status: o.status,
                    source: o
                }));
                combinedItems = [...combinedItems, ...orders];
            }

            // 3. Process Documents
            if (docsRes.status === 'fulfilled' && docsRes.value.data) {
                const docs = docsRes.value.data.filter(d => {
                    const keywords = getFilterKeywords(resultType);
                    return keywords.some(k =>
                        d.filename?.toLowerCase().includes(k) ||
                        d.description?.toLowerCase().includes(k) ||
                        d.type?.toLowerCase().includes(k) ||
                        (d.tags && Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase().includes(k)))
                    );
                }).map(d => ({
                    id: `doc-${d.id}`,
                    type: 'document',
                    title: d.description || d.filename || 'Untitled Document',
                    date: d.created_at || d.uploaded_at,
                    status: 'Uploaded',
                    source: d
                }));
                combinedItems = [...combinedItems, ...docs];
            }

            // Sort by date desc
            combinedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
            setItems(combinedItems);

        } catch (err) {
            console.error('Error fetching results:', err);
            setError('Failed to load results. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, patientId, resultType]);

    const handleItemClick = (item) => {
        // Format the import string
        // Ex: Labs (10/24/2024): CBC - Completed. 
        const dateStr = item.date ? format(new Date(item.date), 'MM/dd/yyyy') : 'Unknown Date';
        const content = item.description || `${item.title} - ${item.status || 'Completed'}`;
        // Pass specific content AND the full item object
        onImport(content, dateStr, item);
        onClose();
    };

    const handleNotAvailable = () => {
        onImport('Not available in records', format(new Date(), 'MM/dd/yyyy'), null);
        onClose();
    };

    if (!isOpen) return null;

    const getTypeIcon = () => {
        switch (resultType) {
            case 'Labs': return <FlaskConical className="w-5 h-5 text-purple-500" />;
            case 'Imaging': return <FileImage className="w-5 h-5 text-blue-500" />;
            case 'Echo': return <Heart className="w-5 h-5 text-rose-500" />;
            case 'EKG': return <Waves className="w-5 h-5 text-rose-500" />;
            case 'Cath': return <Stethoscope className="w-5 h-5 text-red-500" />;
            case 'Stress': return <Activity className="w-5 h-5 text-orange-500" />;
            default: return <FileText className="w-5 h-5 text-slate-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        {getTypeIcon()}
                        <div>
                            <h3 className="font-bold text-gray-900">Import {resultType}</h3>
                            <p className="text-xs text-gray-500">Select a record to import</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                            <p className="text-xs text-gray-500">Searching records...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                            <p className="text-sm text-red-600 mb-2">{error}</p>
                            <button onClick={loadData} className="px-3 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50">Try Again</button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileText className="w-10 h-10 text-gray-200 mb-2" />
                            <p className="text-sm font-medium text-gray-600">No {resultType} records found</p>
                            <p className="text-xs text-gray-400 mb-4">No matching orders or documents found within patient records.</p>
                            <button
                                onClick={handleNotAvailable}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                            >
                                Insert "Not Available" Note
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="font-semibold text-sm text-gray-800 group-hover:text-primary-800">{item.title}</div>
                                        {item.type === 'record' && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">Record</span>}
                                        {item.type === 'order' && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">Order</span>}
                                        {item.type === 'document' && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 uppercase">Doc</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {item.date ? format(new Date(item.date), 'MM/dd/yyyy') : 'No Date'}
                                        </div>
                                        {item.status && (
                                            <div className="flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                {item.status}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                        <button
                            onClick={handleNotAvailable}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                            Or insert "Not Available"
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultImportModal;
