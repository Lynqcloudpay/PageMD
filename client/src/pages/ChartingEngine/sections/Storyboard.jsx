/**
 * Storyboard.jsx
 * Persistent context sidebar: problem list, medications, allergies, HPI templates, result import, orders.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
    ClipboardList, Pill, AlertCircle, ScrollText, Plus, Search,
    FlaskConical, FileImage, Share2, ChevronDown, ChevronUp, Activity,
    Sparkles, X,
} from 'lucide-react';
import { decodeHtmlEntities } from '../utils/noteSerializer';

const SidebarPanel = ({ title, icon, badge, defaultOpen = true, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50/50 transition-all" onClick={() => setOpen(!open)}>
                {icon}
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest flex-1 text-left">{title}</span>
                {badge != null && badge > 0 && (
                    <span className="text-[9px] font-bold bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
                {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {open && <div className="border-t border-slate-50 px-3 py-2">{children}</div>}
        </div>
    );
};

const Storyboard = ({
    patientData, diagnoses, isLocked,
    onAddProblem, onMedicationAction, onInsertTemplate, onResultImport,
    onOpenOrderPicker, onOpenReferral, hpiTemplates = [],
}) => {
    const [medSearch, setMedSearch] = useState('');
    const [problemSearch, setProblemSearch] = useState('');

    const activeProblems = useMemo(() =>
        (patientData?.problems || []).filter(p => p.status === 'active').filter(p =>
            !problemSearch || p.problem_name?.toLowerCase().includes(problemSearch.toLowerCase())
        ), [patientData?.problems, problemSearch]);

    const activeMeds = useMemo(() =>
        (patientData?.medications || []).filter(m => m.active !== false).filter(m =>
            !medSearch || m.medication_name?.toLowerCase().includes(medSearch.toLowerCase())
        ), [patientData?.medications, medSearch]);

    const allergies = useMemo(() => patientData?.allergies || [], [patientData?.allergies]);

    return (
        <div className="w-72 shrink-0 space-y-3 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
            {/* Problem List */}
            <SidebarPanel title="Problems" icon={<ClipboardList className="w-3.5 h-3.5 text-primary-500" />} badge={activeProblems.length}>
                {activeProblems.length > 3 && (
                    <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input type="text" value={problemSearch} onChange={(e) => setProblemSearch(e.target.value)} placeholder="Filter problems..." className="w-full pl-7 pr-2 py-1 text-[10px] border-slate-200 rounded-lg focus:ring-primary-400" />
                    </div>
                )}
                <div className="space-y-0.5 max-h-44 overflow-y-auto">
                    {activeProblems.length > 0 ? activeProblems.map((p, i) => (
                        <button key={i} onClick={() => onAddProblem?.(p)} className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-primary-50 rounded-lg transition-all group" disabled={isLocked}>
                            <span className="font-bold text-slate-700 group-hover:text-primary-700">{p.problem_name}</span>
                            {p.icd10_code && <span className="text-slate-400 ml-1 text-[9px]">({p.icd10_code})</span>}
                        </button>
                    )) : (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">No active problems</p>
                    )}
                </div>
            </SidebarPanel>

            {/* Medications */}
            <SidebarPanel title="Medications" icon={<Pill className="w-3.5 h-3.5 text-amber-500" />} badge={activeMeds.length}>
                {activeMeds.length > 3 && (
                    <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input type="text" value={medSearch} onChange={(e) => setMedSearch(e.target.value)} placeholder="Filter medications..." className="w-full pl-7 pr-2 py-1 text-[10px] border-slate-200 rounded-lg focus:ring-primary-400" />
                    </div>
                )}
                <div className="space-y-0.5 max-h-44 overflow-y-auto">
                    {activeMeds.length > 0 ? activeMeds.map((med, i) => (
                        <div key={i} className="flex items-center justify-between px-2 py-1.5 text-[11px] hover:bg-slate-50 rounded-lg group">
                            <span className="font-medium text-slate-700 truncate flex-1 mr-1">{decodeHtmlEntities(med.medication_name)}</span>
                            {!isLocked && (
                                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onMedicationAction?.(med, 'continue')} className="px-1.5 py-0.5 text-[8px] font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-all">Cont</button>
                                    <button onClick={() => onMedicationAction?.(med, 'refill')} className="px-1.5 py-0.5 text-[8px] font-bold bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-all">Refill</button>
                                    <button onClick={() => onMedicationAction?.(med, 'stop')} className="px-1.5 py-0.5 text-[8px] font-bold bg-red-50 text-red-600 rounded hover:bg-red-100 transition-all">Stop</button>
                                </div>
                            )}
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">No active medications</p>
                    )}
                </div>
            </SidebarPanel>

            {/* Allergies */}
            <SidebarPanel title="Allergies" icon={<AlertCircle className="w-3.5 h-3.5 text-red-500" />} badge={allergies.length} defaultOpen={allergies.length > 0}>
                {allergies.length > 0 ? (
                    <div className="space-y-0.5">
                        {allergies.map((a, i) => (
                            <div key={i} className="px-2 py-1 text-[11px]">
                                <span className="font-bold text-red-700">{a.allergen || a.allergy_name}</span>
                                {a.reaction && <span className="text-slate-500 ml-1">→ {a.reaction}</span>}
                                {a.severity && <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${a.severity === 'severe' ? 'bg-red-100 text-red-700' : a.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{a.severity}</span>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-emerald-600 font-bold py-2 text-center">NKDA – No Known Drug Allergies</p>
                )}
            </SidebarPanel>

            {/* HPI Templates */}
            {hpiTemplates.length > 0 && (
                <SidebarPanel title="HPI Templates" icon={<ScrollText className="w-3.5 h-3.5 text-indigo-500" />} defaultOpen={false}>
                    <div className="space-y-0.5">
                        {hpiTemplates.map((t, i) => (
                            <button key={i} onClick={() => onInsertTemplate?.(t.key, t.text)} disabled={isLocked}
                                className="w-full text-left px-2 py-1.5 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-all">
                                {t.key}
                            </button>
                        ))}
                    </div>
                </SidebarPanel>
            )}

            {/* Result Import */}
            <SidebarPanel title="Import Results" icon={<Activity className="w-3.5 h-3.5 text-teal-500" />} defaultOpen={false}>
                <div className="space-y-1">
                    {['Labs', 'Imaging', 'EKG', 'Echo', 'PFT', 'Sleep Study'].map(type => (
                        <button key={type} onClick={() => onResultImport?.(type)} disabled={isLocked}
                            className="w-full text-left px-2 py-1.5 text-[11px] text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-all flex items-center gap-2">
                            {type === 'Labs' ? <FlaskConical className="w-3 h-3" /> : <FileImage className="w-3 h-3" />} {type}
                        </button>
                    ))}
                </div>
            </SidebarPanel>

            {/* Place Orders */}
            <SidebarPanel title="Place Orders" icon={<Plus className="w-3.5 h-3.5 text-primary-500" />} defaultOpen={false}>
                <div className="space-y-1">
                    <button onClick={() => onOpenOrderPicker?.('LAB')} disabled={isLocked} className="w-full text-left px-2 py-1.5 text-[11px] text-slate-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"><FlaskConical className="w-3 h-3 text-blue-500" /> Lab Orders</button>
                    <button onClick={() => onOpenOrderPicker?.('IMAGING')} disabled={isLocked} className="w-full text-left px-2 py-1.5 text-[11px] text-slate-600 hover:bg-purple-50 rounded-lg flex items-center gap-2"><FileImage className="w-3 h-3 text-purple-500" /> Imaging</button>
                    <button onClick={() => onOpenReferral?.()} disabled={isLocked} className="w-full text-left px-2 py-1.5 text-[11px] text-slate-600 hover:bg-teal-50 rounded-lg flex items-center gap-2"><Share2 className="w-3 h-3 text-teal-500" /> Referral</button>
                </div>
            </SidebarPanel>
        </div>
    );
};

export default Storyboard;
