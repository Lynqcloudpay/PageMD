/**
 * AssessmentSection.jsx
 * Unified ICD-10 search with inline results, diagnosis cards, edit/delete, and plan auto-sync.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, GripVertical, Edit3, AlertCircle, ChevronDown } from 'lucide-react';
import { icd10API, patientsAPI } from '../../../services/api';
import ICD10HierarchySelector from '../../../components/ICD10HierarchySelector';

const AssessmentSection = ({
    diagnoses, isLocked, addDiagnosis, removeDiagnosis, replaceDiagnosis,
    patientId, showToast, onReorder,
}) => {
    const [searchText, setSearchText] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [showHierarchy, setShowHierarchy] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [dragIndex, setDragIndex] = useState(null);
    const searchRef = useRef(null);
    const resultsRef = useRef(null);

    // Debounced ICD-10 search
    useEffect(() => {
        if (searchText.trim().length < 2) { setResults([]); setShowResults(false); return; }
        const timeout = setTimeout(async () => {
            try {
                const res = await icd10API.search(searchText.trim());
                setResults(res.data || []);
                if (res.data?.length > 0) setShowResults(true);
            } catch { setResults([]); }
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchText]);

    // Close results on outside click
    useEffect(() => {
        const handler = (e) => {
            if (resultsRef.current && !resultsRef.current.contains(e.target) && !searchRef.current?.contains(e.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelectCode = useCallback(async (code, addToProblem = false) => {
        if (addToProblem) {
            try {
                await patientsAPI.addProblem(patientId, { problemName: code.description, icd10Code: code.code, status: 'active' });
                showToast?.(`Added ${code.code} to problem list`, 'success');
            } catch { showToast?.('Error adding to problem list', 'error'); }
        }

        if (editingIndex !== null) {
            replaceDiagnosis(editingIndex, code.code, code.description);
            setEditingIndex(null);
        } else {
            addDiagnosis(code.code, code.description);
        }
        setSearchText('');
        setShowResults(false);
        setShowHierarchy(false);
    }, [editingIndex, patientId, addDiagnosis, replaceDiagnosis, showToast]);

    // Drag and drop
    const handleDragStart = (idx) => setDragIndex(idx);
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (targetIdx) => {
        if (dragIndex === null || dragIndex === targetIdx) return;
        onReorder?.(dragIndex, targetIdx);
        setDragIndex(null);
    };

    return (
        <div className="space-y-3">
            {/* Diagnosis Cards */}
            {diagnoses.map((dx, idx) => (
                <div
                    key={idx}
                    draggable={!isLocked}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    className={`flex items-center gap-3 p-3 bg-white rounded-xl border transition-all group ${dragIndex === idx ? 'border-primary-400 shadow-lg opacity-70' : 'border-slate-100 hover:border-primary-200'
                        }`}
                >
                    {!isLocked && <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                    <span className="text-sm font-bold text-slate-800 flex-1">{idx + 1}. {dx.replace(/^\d+\.\s*/, '')}</span>
                    {!isLocked && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingIndex(idx); setShowHierarchy(true); }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all" title="Change code">
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeDiagnosis(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            ))}

            {/* Search Bar */}
            {!isLocked && (
                <div className="relative mt-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1" ref={searchRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search ICD-10 codes or diagnoses..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                            />
                        </div>
                        <button onClick={() => { setEditingIndex(null); setShowHierarchy(true); }} className="p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all shadow-sm" title="Browse ICD-10 hierarchy">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Inline Results Dropdown */}
                    {showResults && results.length > 0 && (
                        <div ref={resultsRef} className="absolute z-30 top-full left-0 right-0 mt-1 border border-slate-200 rounded-xl bg-white shadow-xl max-h-64 overflow-y-auto">
                            {results.slice(0, 12).map((r, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-primary-50 text-sm border-b border-slate-50 last:border-0 group/item">
                                    <button className="flex-1 text-left" onClick={() => handleSelectCode(r)}>
                                        <span className="font-bold text-primary-600">{r.code}</span>
                                        <span className="text-slate-600 ml-2">{r.description}</span>
                                    </button>
                                    <button onClick={() => handleSelectCode(r, true)} className="opacity-0 group-hover/item:opacity-100 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-all shrink-0 ml-2">
                                        + Problem List
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {diagnoses.length === 0 && (
                <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No diagnoses yet. Search ICD-10 codes above or import from the problem list.</p>
                </div>
            )}

            {/* ICD-10 Hierarchy Modal */}
            {showHierarchy && (
                <ICD10HierarchySelector
                    onSelect={(code) => handleSelectCode(code)}
                    onClose={() => { setShowHierarchy(false); setEditingIndex(null); }}
                />
            )}
        </div>
    );
};

export default AssessmentSection;
