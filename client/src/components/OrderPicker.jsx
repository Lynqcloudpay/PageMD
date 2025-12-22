import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Star, Clock, Plus, X, Hash, ChevronRight, Loader2,
    AlertCircle, Check, Info, FlaskConical, Image as ImageIcon, Activity
} from 'lucide-react';
import { ordersCatalogAPI } from '../services/api';

const OrderPicker = ({ type, onSelect, onClose, visitId, patientId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [recent, setRecent] = useState([]);
    const [activeTab, setActiveTab] = useState('search');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        loadFavorites();
        loadRecent();
        inputRef.current?.focus();
    }, [type]);

    const loadFavorites = async () => {
        try {
            const res = await ordersCatalogAPI.getFavorites();
            // Filter by type if provided
            const filtered = type ? res.data.filter(f => f.type === type) : res.data;
            setFavorites(filtered);
        } catch (err) {
            console.error('Failed to load favorites', err);
        }
    };

    const loadRecent = async () => {
        try {
            const res = await ordersCatalogAPI.getRecent(type);
            setRecent(res.data);
        } catch (err) {
            console.error('Failed to load recent', err);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 1) {
                performSearch(searchTerm);
            } else if (searchTerm.trim().length === 0) {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, type]);

    const performSearch = async (q) => {
        setLoading(true);
        setError(null);
        try {
            const res = await ordersCatalogAPI.search(q, type);
            setResults(res.data);
            setSelectedIndex(0);
            if (activeTab !== 'search') setActiveTab('search');
        } catch (err) {
            setError('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (order) => {
        try {
            await ordersCatalogAPI.trackUsage(order.id);
            onSelect(order);
        } catch (err) {
            console.error('Failed to track usage', err);
            onSelect(order);
        }
    };

    const toggleFavorite = async (e, order) => {
        e.stopPropagation();
        const isFav = favorites.find(f => f.id === order.id);
        try {
            if (isFav) {
                await ordersCatalogAPI.removeFavorite(order.id);
                setFavorites(prev => prev.filter(f => f.id !== order.id));
            } else {
                await ordersCatalogAPI.addFavorite(order.id);
                setFavorites(prev => [...prev, order]);
            }
        } catch (err) {
            console.error('Toggle favorite failed', err);
        }
    };

    const handleKeyDown = (e) => {
        const items = activeTab === 'search' ? results : (activeTab === 'favorites' ? favorites : recent);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev - 1));
        } else if (e.key === 'Enter') {
            if (items[selectedIndex]) {
                handleSelect(items[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    useEffect(() => {
        const selectedElement = listRef.current?.children[selectedIndex];
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const getTypeIcon = (orderType) => {
        switch (orderType) {
            case 'LAB': return <FlaskConical className="w-4 h-4" />;
            case 'IMAGING': return <ImageIcon className="w-4 h-4" />;
            case 'PROCEDURE': return <Activity className="w-4 h-4" />;
            default: return <Hash className="w-4 h-4" />;
        }
    };

    const renderList = (items, emptyMessage) => {
        if (items.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div ref={listRef} className="overflow-y-auto max-h-[400px]">
                {items.map((item, index) => {
                    const isSelected = selectedIndex === index;
                    const isFav = favorites.find(f => f.id === item.id);

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-all border-b border-neutral-50 last:border-0 ${isSelected ? 'bg-primary-50' : 'hover:bg-neutral-50'
                                }`}
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`mt-0.5 p-1.5 rounded-md ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                    {getTypeIcon(item.type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-sm ${isSelected ? 'text-primary-900' : 'text-neutral-900'}`}>
                                            {item.name}
                                        </span>
                                        {item.loinc_code && (
                                            <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight">
                                                LOINC {item.loinc_code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className={`text-xs ${isSelected ? 'text-primary-800' : 'text-neutral-500'}`}>
                                            {item.category || item.type}
                                        </p>
                                        {item.specimen && (
                                            <span className="text-[10px] text-neutral-400 font-medium px-1.5 py-0.5 bg-neutral-100 rounded">
                                                {item.specimen}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                <button
                                    onClick={(e) => toggleFavorite(e, item)}
                                    className={`p-2 rounded-full transition-colors ${isFav ? 'text-amber-400' : 'text-neutral-300 hover:text-amber-400 hover:bg-amber-50'
                                        }`}
                                >
                                    <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                </button>
                                <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-1 text-primary-400' : 'text-neutral-300'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            className="flex flex-col bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden max-w-xl w-full mx-auto outline-none"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            {/* Header */}
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    {type ? `${type} Order` : 'Add Order'}
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-full transition-colors">
                    <X className="w-5 h-5 text-neutral-500" />
                </button>
            </div>

            {/* Search Input */}
            <div className="px-4 py-3 border-b border-neutral-100">
                <div className="relative group">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${loading ? 'text-primary-500' : 'text-neutral-400 group-focus-within:text-primary-500'}`} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`Search ${type || ''} catalog... (Name, synonyms, category)`}
                        className="w-full pl-9 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium"
                    />
                    {loading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 bg-white">
                <button
                    onClick={() => { setActiveTab('search'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all relative ${activeTab === 'search' ? 'text-primary-600 bg-primary-50/30' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                >
                    <Search className="w-3.5 h-3.5" />
                    Catalog
                </button>
                <button
                    onClick={() => { setActiveTab('favorites'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all relative ${activeTab === 'favorites' ? 'text-primary-600 bg-primary-50/30' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                >
                    <Star className="w-3.5 h-3.5" />
                    Favorites
                    {favorites.length > 0 && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-full ml-1">{favorites.length}</span>}
                </button>
                <button
                    onClick={() => { setActiveTab('recent'); setSelectedIndex(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all relative ${activeTab === 'recent' ? 'text-primary-600 bg-primary-50/30' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                >
                    <Clock className="w-3.5 h-3.5" />
                    Recent
                </button>
            </div>

            {/* List content */}
            <div className="flex-1 min-h-[350px] bg-white overflow-hidden">
                {activeTab === 'search' && (
                    searchTerm.length < 1 && results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                            <Plus className="w-10 h-10 mb-3 opacity-10" />
                            <p className="text-xs font-bold uppercase tracking-wider">Search across cardiology catalog</p>
                            <p className="text-[10px] mt-1 opacity-60">Try "EKG", "BNP", or "Echo"</p>
                        </div>
                    ) : renderList(results, 'No catalog items found')
                )}
                {activeTab === 'favorites' && renderList(favorites, 'No favorite orders yet')}
                {activeTab === 'recent' && renderList(recent, 'No recently used orders')}
            </div>

            {/* Legend */}
            <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                <span>↑↓ Navigate  •  Enter Select  •  Esc Close</span>
                <span className="text-primary-500">HI-FIDELITY ORDERS</span>
            </div>
        </div>
    );
};

export default OrderPicker;
