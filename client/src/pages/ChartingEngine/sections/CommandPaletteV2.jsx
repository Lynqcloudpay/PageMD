/**
 * CommandPaletteV2.jsx
 * Enhanced Cmd+K palette with unified search across diagnoses, orders, phrases, and medications.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Stethoscope, FlaskConical, Pill, ScrollText, Hash, ArrowRight, Loader2 } from 'lucide-react';
import { codesAPI, ordersCatalogAPI, macrosAPI } from '../../../services/api';

const CATEGORY_ICONS = {
    diagnosis: <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />,
    order: <FlaskConical className="w-3.5 h-3.5 text-blue-500" />,
    medication: <Pill className="w-3.5 h-3.5 text-amber-500" />,
    phrase: <ScrollText className="w-3.5 h-3.5 text-indigo-500" />,
};

const CATEGORY_LABELS = {
    diagnosis: 'Diagnoses',
    order: 'Orders',
    medication: 'Medications',
    phrase: 'Smart Phrases',
};

const CommandPaletteV2 = ({ isOpen, onClose, onSelect, dotPhrases = [] }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Search across all sources
    useEffect(() => {
        if (!isOpen || query.length < 2) { setResults([]); return; }
        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setIsLoading(true);
            try {
                const [icd10Res, ordersRes] = await Promise.all([
                    codesAPI.searchICD10(query).catch(() => ({ data: [] })),
                    ordersCatalogAPI.search(query).catch(() => ({ data: [] })),
                ]);

                const items = [];

                // Diagnoses
                (icd10Res.data || []).slice(0, 5).forEach(i => items.push({
                    type: 'diagnosis', title: i.description, subtitle: i.code, source: i,
                }));

                // Orders
                (ordersRes.data || []).slice(0, 5).forEach(o => items.push({
                    type: 'order', title: o.name, subtitle: o.category || o.type, source: o,
                }));

                // Dot phrases (local search)
                const q = query.toLowerCase();
                dotPhrases.filter(p => p.key?.toLowerCase().includes(q) || p.text?.toLowerCase().includes(q))
                    .slice(0, 3).forEach(p => items.push({
                        type: 'phrase', title: `.${p.key}`, subtitle: p.text?.substring(0, 60) + '...', source: p,
                    }));

                if (!controller.signal.aborted) {
                    setResults(items);
                    setSelectedIdx(0);
                }
            } catch (e) { if (!controller.signal.aborted) setResults([]); }
            finally { if (!controller.signal.aborted) setIsLoading(false); }
        }, 250);

        return () => { controller.abort(); clearTimeout(timeout); };
    }, [query, isOpen, dotPhrases]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') { onClose(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(prev => Math.min(prev + 1, results.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(prev => Math.max(prev - 1, 0)); return; }
        if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); onSelect(results[selectedIdx]); onClose(); }
    }, [results, selectedIdx, onSelect, onClose]);

    // Scroll selection into view
    useEffect(() => {
        listRef.current?.children[selectedIdx]?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    // Group results by type
    const grouped = useMemo(() => {
        const groups = {};
        results.forEach(r => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push(r);
        });
        return groups;
    }, [results]);

    if (!isOpen) return null;

    let flatIdx = 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <Search className="w-5 h-5 text-gray-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search diagnoses, orders, medications, phrases..."
                        className="flex-1 text-base text-gray-800 placeholder-slate-400 outline-none bg-transparent"
                    />
                    {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
                    {query.length < 2 ? (
                        <div className="px-5 py-8 text-center">
                            <Hash className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Type to search across diagnoses, orders, and phrases</p>
                            <p className="text-xs text-gray-400 mt-1">⌘K to open · ESC to close · ↑↓ to navigate · Enter to select</p>
                        </div>
                    ) : results.length === 0 && !isLoading ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-sm text-gray-400">No results for "{query}"</p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([type, items]) => (
                            <div key={type}>
                                <div className="px-5 py-2 bg-gray-50/50 border-b border-slate-50">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        {CATEGORY_ICONS[type]} {CATEGORY_LABELS[type] || type}
                                    </span>
                                </div>
                                {items.map((item) => {
                                    const thisIdx = flatIdx++;
                                    return (
                                        <button
                                            key={`${type}-${thisIdx}`}
                                            className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all ${thisIdx === selectedIdx ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            onClick={() => { onSelect(item); onClose(); }}
                                            onMouseEnter={() => setSelectedIdx(thisIdx)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{item.title}</p>
                                                {item.subtitle && <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>}
                                            </div>
                                            <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${thisIdx === selectedIdx ? 'opacity-100 text-primary-500' : 'opacity-0'}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {results.length > 0 && (
                    <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                            <span>↑↓ Navigate</span>
                            <span>↵ Select</span>
                            <span>ESC Close</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommandPaletteV2;
