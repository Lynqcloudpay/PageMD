import React, { useState, useEffect } from 'react';
import { X, Search, AlertCircle, Check } from 'lucide-react';
import { icd10API } from '../services/api';

const DiagnosisLinkModal = ({ isOpen, onClose, onSelect, activeDiagnoses = [], medicationName, actionType }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSearchResults([]);
        }
    }, [isOpen]);

    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await icd10API.search(term);
            const results = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setSearchResults(results.map(r => ({ ...r, label: `${r.description} (${r.code})` })));
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const actionLabel = actionType === 'continue' ? 'Continuing' : actionType === 'refill' ? 'Refilling' : 'Stopping';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900">Link Diagnosis</h3>
                        <p className="text-xs text-gray-500">{actionLabel} {medicationName}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 1. Select from Current Assessment Diagnoses */}
                    {activeDiagnoses.length > 0 && (
                        <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">From Assessment</div>
                            <div className="space-y-1">
                                {activeDiagnoses.map((diag, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onSelect(diag)}
                                        className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-800 rounded border border-blue-100 transition-colors flex items-center gap-2"
                                    >
                                        <Check className="w-3.5 h-3.5 opacity-60" />
                                        {diag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Search for linked diagnosis (if not in assessment) */}
                    <div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Search Diagnosis</div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Search ICD-10..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {isLoading && <div className="text-center py-2 text-xs text-gray-400">Searching...</div>}

                        {searchResults.length > 0 && (
                            <div className="mt-2 text-xs border border-gray-100 rounded overflow-hidden">
                                {searchResults.map((result, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onSelect(`${result.description} (${result.code})`)}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 truncate"
                                    >
                                        <span className="font-bold mr-1">{result.code}</span>
                                        {result.description}
                                    </button>
                                ))}
                            </div>
                        )}

                        {!isLoading && searchTerm.length > 2 && searchResults.length === 0 && (
                            <div className="text-center py-2 text-xs text-gray-400">No results found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiagnosisLinkModal;
