import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search,
    Star,
    Clock,
    Plus,
    X,
    Hash,
    ChevronRight,
    Loader2,
    AlertCircle,
    Check
} from 'lucide-react';
import { icd10API } from '../services/api';

const DiagnosisPicker = ({ onSelect, onClose, existingDiagnoses = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [recent, setRecent] = useState([]);
    const [activeTab, setActiveTab] = useState('search'); // 'search', 'favorites', 'recent'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Initial Data Load
    useEffect(() => {
        loadFavorites();
        loadRecent();
        inputRef.current?.focus();
    }, []);

    const loadFavorites = async () => {
        try {
            const res = await icd10API.getFavorites();
            setFavorites(res.data);
        } catch (err) {
            console.error('Failed to load favorites', err);
        }
    };

    const loadRecent = async () => {
        try {
            const res = await icd10API.getRecent();
            setRecent(res.data);
        } catch (err) {
            console.error('Failed to load recent', err);
        }
    };

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 2) {
                performSearch(searchTerm);
            } else if (searchTerm.trim().length === 0) {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const performSearch = async (q) => {
        setLoading(true);
        setError(null);
        try {
            const res = await icd10API.search(q);
            setResults(res.data);
            setSelectedIndex(0);
            if (activeTab !== 'search') setActiveTab('search');
        } catch (err) {
            setError('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (code) => {
        try {
            // Track usage
            await icd10API.trackUsage(code.id);
            onSelect(code);
            onClose();
        } catch (err) {
            console.error('Failed to track usage', err);
            // Still select anyway even if tracking fails
            onSelect(code);
            onClose();
        }
    };

    const toggleFavorite = async (e, code) => {
        e.stopPropagation();
        const isFav = favorites.find(f => f.id === code.id);
        try {
            if (isFav) {
                await icd10API.removeFavorite(code.id);
                setFavorites(prev => prev.filter(f => f.id !== code.id));
            } else {
                await icd10API.addFavorite(code.id);
                setFavorites(prev => [...prev, code]);
            }
        } catch (err) {
            console.error('Toggle favorite failed', err);
        }
    };

    // Keyboard Navigation
    const handleKeyDown = (e) => {
        const items = activeTab === 'search' ? results : (activeTab === 'favorites' ? favorites : recent);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            if (items[selectedIndex]) {
                handleSelect(items[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        const selectedElement = listRef.current?.children[selectedIndex];
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const renderList = (items, emptyMessage) => {
        if (items.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div ref={listRef} className="overflow-y-auto max-h-[400px]">
                {items.map((item, index) => {
                    const isSelected = selectedIndex === index;
                    const isAlreadyAdded = existingDiagnoses.some(d => d.includes(item.code));
                    const isFav = favorites.find(f => f.id === item.id);

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-all border-b border-gray-50 last:border-0 ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`mt-0.5 p-1.5 rounded-md ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <Hash className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-sm ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>
                                            {item.code}
                                        </span>
                                        {isAlreadyAdded && (
                                            <span className="flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                                <Check className="w-2.5 h-2.5" />
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm leading-snug line-clamp-2 ${isSelected ? 'text-primary-800' : 'text-gray-600'}`}>
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                <button
                                    onClick={(e) => toggleFavorite(e, item)}
                                    className={`p-2 rounded-full transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-50'
                                        }`}
                                >
                                    <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                </button>
                                <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-1 text-primary-400' : 'text-gray-300'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            className="flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-w-2xl w-full mx-auto"
            onKeyDown={handleKeyDown}
        >
            {/* Search Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="relative group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${loading ? 'text-primary-500' : 'text-gray-400 group-focus-within:text-primary-500'}`} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search ICD-10 by code or description..."
                        className="w-full pl-12 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-md focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
                    />
                    {loading && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
                    )}
                    {searchTerm && !loading && (
                        <button
                            onClick={() => { setSearchTerm(''); setResults([]); inputRef.current?.focus(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
                <button
                    onClick={() => { setActiveTab('search'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative ${activeTab === 'search' ? 'text-primary-600 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <Search className="w-4 h-4" />
                    Search
                    {activeTab === 'search' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                </button>
                <button
                    onClick={() => { setActiveTab('favorites'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative ${activeTab === 'favorites' ? 'text-primary-600 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <Star className="w-4 h-4" />
                    Favorites
                    {favorites.length > 0 && (
                        <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded-full">
                            {favorites.length}
                        </span>
                    )}
                    {activeTab === 'favorites' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                </button>
                <button
                    onClick={() => { setActiveTab('recent'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative ${activeTab === 'recent' ? 'text-primary-600 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Recent
                    {activeTab === 'recent' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                </button>
            </div>

            {/* Results List */}
            <div className="flex-1 min-h-[300px] bg-white">
                {activeTab === 'search' && (
                    searchTerm.length < 2 && results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Plus className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-sm font-medium">Type at least 2 characters to search</p>
                            <p className="text-xs mt-1">Try "Hypertension" or "I10"</p>
                        </div>
                    ) : renderList(results, 'No matches found for your search')
                )}
                {activeTab === 'favorites' && renderList(favorites, 'You haven\'t added any favorites yet')}
                {activeTab === 'recent' && renderList(recent, 'Your recently used codes will appear here')}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-sans font-bold text-gray-700">↑↓</kbd>
                        Navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-sans font-bold text-gray-700">Enter</kbd>
                        Select
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-sans font-bold text-gray-700">Esc</kbd>
                        Close
                    </span>
                </div>
                <div className="font-medium text-primary-600">
                    ICD-10-CM v2024
                </div>
            </div>
        </div>
    );
};

export default DiagnosisPicker;
