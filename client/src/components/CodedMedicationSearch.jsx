import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { medicationsAPI } from '../services/api';

const CodedMedicationSearch = ({ onSelect, label = "Medication Search", placeholder = "Search for medication (e.g. Lisinopril, Metformin)..." }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchTimer = setTimeout(async () => {
            if (query.trim().length >= 2) {
                setLoading(true);
                try {
                    const response = await medicationsAPI.search(query);
                    // Handle response being array or { data: [...] }
                    const data = Array.isArray(response) ? response : (response.data || []);
                    setResults(data);
                    setShowResults(true);
                } catch (error) {
                    console.error('Error searching medications:', error);
                    setResults([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(searchTimer);
    }, [query]);

    const handleSelect = (med) => {
        onSelect(med);
        setQuery(''); // Optionally clear, or keep the name: setQuery(med.name);
        setResults([]);
        setShowResults(false);
    };

    return (
        <div className="relative w-full" ref={searchRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    autoComplete="off"
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                    </div>
                )}
            </div>

            {showResults && (
                <div className="absolute z-[100] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-64 overflow-y-auto">
                    {results.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {results.map((med) => (
                                <button
                                    key={med.id || med.rxcui || med.code}
                                    onClick={() => handleSelect(med)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex flex-col gap-0.5 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-900 group-hover:text-primary-600">{med.name}</span>
                                        {(med.rxcui || med.code) && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                                                {med.rxcui ? `RXCUI: ${med.rxcui}` : `${med.code_type || 'CODE'}: ${med.code}`}
                                            </span>
                                        )}
                                    </div>
                                    {med.description && (
                                        <span className="text-xs text-gray-500 line-clamp-1">{med.description}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : query.length >= 2 && !loading ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            No medications found matching "{query}"
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default CodedMedicationSearch;
