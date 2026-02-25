import React, { useState, useEffect } from 'react';
import {
    X, Activity, Heart, Zap, Waves, Calendar, Eye,
    Maximize2, Download, History, Ruler, Info, ExternalLink,
    ChevronRight, ChevronLeft, ZoomIn, ZoomOut, RotateCw, Trash2
} from 'lucide-react';
import Modal from './ui/Modal';
import { documentsAPI } from '../services/api';

const CardiologyViewer = ({ isOpen, onClose, type, documents, patientName }) => {
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [compareDoc, setCompareDoc] = useState(null);
    const [isComparing, setIsComparing] = useState(false);
    const [showCalipers, setShowCalipers] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Filter documents by type
    const filteredDocs = documents.filter(doc => {
        const tags = doc.tags || [];
        const name = (doc.file_name || '').toLowerCase();

        if (type === 'EKG') return tags.includes('ekg') || name.includes('ekg');
        if (type === 'ECHO') return tags.includes('echo') || name.includes('echo') || name.includes('echocardiogram');
        if (type === 'STRESS') return tags.includes('stress') || tags.includes('stress_test') || name.includes('stress');
        if (type === 'CATH') return tags.includes('cath') || tags.includes('cardiac_cath') || name.includes('cath') || name.includes('catheterization');
        return false;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    useEffect(() => {
        if (isOpen) {
            // Reset state when opening a new type of study
            setSelectedDoc(filteredDocs.length > 0 ? filteredDocs[0] : null);
            setCompareDoc(null);
            setIsComparing(false);
            setZoom(1);
            setRotation(0);
        }
    }, [isOpen, type]); // Depend on isOpen and type to reset fresh each time it's opened

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'EKG': return <Activity className="w-5 h-5 text-red-600" />;
            case 'ECHO': return <Heart className="w-5 h-5 text-indigo-600" />;
            case 'STRESS': return <Zap className="w-5 h-5 text-fuchsia-600" />;
            case 'CATH': return <Waves className="w-5 h-5 text-emerald-600" />;
            default: return <Activity className="w-5 h-5" />;
        }
    };

    const getThemeColor = () => {
        switch (type) {
            case 'EKG': return 'red';
            case 'ECHO': return 'indigo';
            case 'STRESS': return 'fuchsia';
            case 'CATH': return 'emerald';
            default: return 'blue';
        }
    };

    const color = getThemeColor();

    const parseTags = (doc) => {
        if (!doc || !doc.tags) return {};
        const data = {};
        doc.tags.forEach(tag => {
            if (tag.includes(':')) {
                const [key, value] = tag.split(':');
                data[key] = value;
            }
        });
        return data;
    };

    const StudyCard = ({ doc, isSelected, onSelect, isSmall = false }) => {
        const data = parseTags(doc);
        const date = new Date(doc.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        return (
            <button
                onClick={() => onSelect(doc)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected
                    ? `bg-${color}-50 border-${color}-200 ring-2 ring-${color}-500/20`
                    : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider text-${color}-600`}>{date}</span>
                    <History className="w-3 h-3 text-gray-400" />
                </div>
                <h4 className="font-bold text-sm text-gray-900 truncate">{doc.file_name || `${type} Study`}</h4>

                <div className="mt-2 flex flex-wrap gap-1">
                    {type === 'EKG' && data.rhythm && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-white border rounded text-red-700 font-bold">{data.rhythm}</span>
                    )}
                    {type === 'ECHO' && data.ef && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-white border rounded text-indigo-700 font-bold">EF {data.ef}</span>
                    )}
                    {type === 'STRESS' && data.mets && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-white border rounded text-fuchsia-700 font-bold">{data.mets} METS</span>
                    )}
                </div>
            </button>
        );
    };

    const CaliperTool = () => (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="relative w-40 h-2 bg-red-500/50 rounded-full cursor-move pointer-events-auto">
                <div className="absolute left-0 -top-4 -bottom-4 w-1 bg-red-600"></div>
                <div className="absolute right-0 -top-4 -bottom-4 w-1 bg-red-600"></div>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-1 rounded font-bold">200ms</div>
            </div>
        </div>
    );

    const docUrl = (doc) => {
        if (!doc) return null;
        let path = doc.file_path || doc.file_url;
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // If it's an absolute path from the server (e.g., /app/uploads/...), extract the relative part
        if (path.includes('/uploads/')) {
            const index = path.indexOf('/uploads/');
            path = path.substring(index); // results in /uploads/...
        }

        // Ensure we use the /api/uploads proxy
        if (path.startsWith('/uploads/')) {
            path = `/api${path}`;
        } else if (path.startsWith('uploads/')) {
            path = `/api/${path}`;
        } else if (!path.startsWith('/') && !path.includes('/')) {
            // If it's just a filename, assume it's in a default uploads location
            // Checking common subdirs if we can guess, but defaulting to root uploads
            path = `/api/uploads/${path}`;
        }

        return path.startsWith('/') ? path : `/${path}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-50 w-full max-w-[1400px] h-full max-h-[900px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
                {/* Header */}
                <div className={`p-4 border-b border-gray-200 bg-white flex items-center justify-between`}>
                    <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-xl bg-${color}-100`}>
                            {getIcon()}
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h2 className="text-xl font-bold text-gray-900">{type} Review Center</h2>
                                <span className={`px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-700 text-[10px] font-bold uppercase`}>Commercial Grade</span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">Patient: <span className="text-gray-900 font-bold">{patientName}</span> • History: {filteredDocs.length} Studies</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsComparing(!isComparing)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isComparing
                                ? `bg-${color}-600 text-white shadow-lg`
                                : `bg-white text-gray-700 border border-gray-200 hover:border-${color}-300 hover:text-${color}-600`
                                }`}
                        >
                            <History className="w-4 h-4" />
                            <span>{isComparing ? 'Close Comparison' : 'Compare Studies'}</span>
                        </button>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar: Study History */}
                    <div className="w-72 bg-white border-r border-gray-100 flex flex-col">
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-2">
                                <History className="w-3 h-3" />
                                <span>Study Repository</span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {filteredDocs.map(doc => (
                                <div key={doc.id} className="relative group">
                                    <StudyCard
                                        doc={doc}
                                        isSelected={selectedDoc?.id === doc.id || compareDoc?.id === doc.id}
                                        onSelect={(d) => {
                                            if (isComparing) {
                                                setCompareDoc(d);
                                            } else {
                                                setSelectedDoc(d);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Are you sure you want to delete this study? This action cannot be undone.')) {
                                                try {
                                                    await documentsAPI.delete(doc.id);
                                                    window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                                    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
                                                    if (compareDoc?.id === doc.id) setCompareDoc(null);
                                                } catch (err) {
                                                    alert('Failed to delete study');
                                                }
                                            }
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg shadow-sm hover:bg-red-500 hover:text-white border border-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                                        title="Delete Study"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Viewer Area */}
                    <div className="flex-1 flex flex-col relative bg-gray-200/50">
                        {/* Toolbar */}
                        <div className="p-2 border-b border-gray-200/50 bg-white/80 backdrop-blur-md flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ZoomOut className="w-4 h-4 text-gray-600" /></button>
                                <span className="text-[10px] font-bold text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ZoomIn className="w-4 h-4 text-gray-600" /></button>
                                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><RotateCw className="w-4 h-4 text-gray-600" /></button>
                                {type === 'EKG' && (
                                    <>
                                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                        <button
                                            onClick={() => setShowCalipers(!showCalipers)}
                                            className={`p-2 rounded-lg transition-all ${showCalipers ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'}`}
                                            title="Enable Digital Calipers"
                                        >
                                            <Ruler className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Analysis Engine</span>
                                    <span className={`text-[11px] font-bold text-${color}-600 underline decoration-2 underline-offset-4 ring-offset-2 ring-1 ring-${color}-200 px-2 rounded-full`}>High-Fidelity Viewing</span>
                                </div>
                                <a
                                    href={docUrl(selectedDoc)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-${color}-300 hover:text-${color}-600 transition-colors shadow-sm`}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Viewer Body */}
                        <div className={`flex-1 flex overflow-hidden ${isComparing ? 'flex-row gap-4 p-4' : ''}`}>
                            {/* Primary Viewer */}
                            <div className="flex-1 relative flex items-center justify-center bg-[#1a1a1a] shadow-inner overflow-auto ring-1 ring-black">
                                {selectedDoc ? (
                                    <img
                                        src={docUrl(selectedDoc)}
                                        alt="Study View"
                                        style={{
                                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-gray-500 flex flex-col items-center">
                                        <Eye className="w-12 h-12 mb-2 opacity-20" />
                                        <p className="font-bold">Select a study to view</p>
                                    </div>
                                )}
                                {showCalipers && type === 'EKG' && <CaliperTool />}

                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[10px] font-bold tracking-wider">
                                    STUDY DATE: {selectedDoc ? new Date(selectedDoc.created_at).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>

                            {/* Comparison Viewer */}
                            {isComparing && (
                                <div className="flex-1 relative flex items-center justify-center bg-[#1a1a1a] shadow-inner overflow-auto ring-1 ring-black animate-in slide-in-from-right-10">
                                    {compareDoc ? (
                                        <img
                                            src={docUrl(compareDoc)}
                                            alt="Comparison View"
                                            style={{
                                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <div className="text-gray-500 flex flex-col items-center border-2 border-dashed border-gray-700/50 p-12 rounded-3xl">
                                            <History className="w-12 h-12 mb-2 opacity-20" />
                                            <p className="font-bold">Select a previous study</p>
                                            <p className="text-[10px] mt-2 text-gray-600">Click a record in the repository to compare</p>
                                        </div>
                                    )}
                                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[10px] font-bold tracking-wider">
                                        COMPARISON: {compareDoc ? new Date(compareDoc.created_at).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Analysis Footer */}
                        <div className="h-48 bg-white border-t border-gray-100 p-6 flex gap-8">
                            <div className="flex-1">
                                <h4 className={`text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2`}>
                                    <Info className="w-3 h-3" />
                                    <span>Clinical Interpretation</span>
                                </h4>
                                <div className="grid grid-cols-4 gap-4">
                                    {Object.entries(parseTags(selectedDoc)).map(([key, value]) => (
                                        <div key={key} className={`p-3 rounded-2xl bg-${color}-50/50 border border-${color}-100/50`}>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{key.replace('_', ' ')}</p>
                                            <p className={`text-sm font-bold text-${color}-900`}>{value}</p>
                                        </div>
                                    ))}
                                    {Object.keys(parseTags(selectedDoc)).length === 0 && (
                                        <div className="col-span-4 py-8 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                            <p className="text-xs text-gray-400 font-bold">No structured analysis data available for this study</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-80 border-l border-gray-100 pl-8">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</h4>
                                <div className="space-y-2">
                                    <button className={`w-full py-3 bg-${color}-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-${color}-200 hover:bg-${color}-700 transition-all flex items-center justify-center gap-2`}>
                                        <Download className="w-4 h-4" /> Download Original DICOM/PDF
                                    </button>
                                    <button className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">
                                        Request Specialist Review
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!selectedDoc) return;
                                            if (window.confirm('PERMANENT DELETION: Are you sure you want to delete this cardiology study? This cannot be undone.')) {
                                                try {
                                                    await documentsAPI.delete(selectedDoc.id);
                                                    window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                                    setSelectedDoc(null);
                                                    if (compareDoc?.id === selectedDoc.id) setCompareDoc(null);
                                                    // Force a refresh of the parent's document list
                                                    if (onClose) {
                                                        alert('Study deleted successfully');
                                                        onClose();
                                                    }
                                                } catch (err) {
                                                    alert('Failed to delete study');
                                                }
                                            }
                                        }}
                                        className="w-full py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all border border-red-100 mt-2 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete This Study
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CardiologyViewer;
