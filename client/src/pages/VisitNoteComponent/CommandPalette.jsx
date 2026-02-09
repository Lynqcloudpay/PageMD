import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, Plus, FileText, ClipboardList, Pill } from 'lucide-react';

const CommandPalette = ({
    isOpen,
    onClose,
    onSelect,
    searchQuery,
    setSearchQuery,
    suggestions = [],
    isLoading = false
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef(null);

    useEffect(() => {
        if (suggestions.length > 0) {
            setSelectedIndex(0);
        }
    }, [suggestions]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    onSelect(suggestions[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, suggestions, selectedIndex, onSelect, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />

            <div
                ref={containerRef}
                className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 pointer-events-auto overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="p-2 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-100">
                        <Zap className="w-5 h-5" />
                    </div>
                    <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for diagnosis, order, or template..."
                        className="flex-1 bg-transparent border-none p-0 text-base font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0"
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-tighter shadow-sm">
                        ESC to Close
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 gap-3">
                            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-sm font-medium">Searching clinical records...</span>
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-1">
                            {suggestions.map((item, idx) => {
                                const Icon = item.type === 'diagnosis' ? ClipboardList : item.type === 'order' ? Pill : FileText;
                                const isActive = idx === selectedIndex;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => onSelect(item)}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold leading-tight mb-0.5">{item.title}</div>
                                                <div className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                                                    {item.type} {item.code ? `• ${item.code}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                                            Select
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : searchQuery.length > 1 ? (
                        <div className="py-12 text-center text-slate-400">
                            <div className="text-sm font-medium mb-1">No clinical matches found</div>
                            <div className="text-xs">Try searching for a different term or keyword</div>
                        </div>
                    ) : (
                        <div className="py-8 px-6">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Suggestions</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {['Diabetes', 'Hypertension', 'Lisinopril', 'Blood Work'].map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSearchQuery(s)}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                                    >
                                        <Search className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-600">{s}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 grayscale opacity-50">
                            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">AI Assisted Search Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
