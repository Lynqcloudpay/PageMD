/**
 * PlanSection.jsx
 * Per-diagnosis plan cards with inline ordering, medication actions, and order management.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, X, GripVertical, FlaskConical, FileImage, Pill, Share2, ChevronDown, ChevronUp, AlertCircle, Stethoscope } from 'lucide-react';

const PlanSection = ({
    planStructured = [], diagnoses = [], isLocked, addOrderToPlan, removeFromPlan,
    onOpenOrderPicker, onOpenReferral, onOpenPrescription, onReorderPlan,
}) => {
    const [expandedCards, setExpandedCards] = useState(new Set(diagnoses.map((_, i) => i)));
    const [freeTextByDiag, setFreeTextByDiag] = useState({});

    const toggleCard = (idx) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const handleAddFreeText = useCallback((diagIdx) => {
        const text = freeTextByDiag[diagIdx]?.trim();
        if (!text) return;
        const diagnosis = planStructured[diagIdx]?.diagnosis || diagnoses[diagIdx] || 'Unassigned';
        addOrderToPlan(diagnosis, text);
        setFreeTextByDiag(prev => ({ ...prev, [diagIdx]: '' }));
    }, [freeTextByDiag, planStructured, diagnoses, addOrderToPlan]);

    const getOrderIcon = (orderText) => {
        const lower = (orderText || '').toLowerCase();
        if (lower.startsWith('lab:') || lower.includes('[loinc')) return <FlaskConical className="w-3 h-3 text-blue-500" />;
        if (lower.startsWith('imaging:')) return <FileImage className="w-3 h-3 text-purple-500" />;
        if (lower.includes('continue') || lower.includes('refill') || lower.includes('discontinue') || lower.includes('prescribe')) return <Pill className="w-3 h-3 text-amber-500" />;
        if (lower.startsWith('refer') || lower.includes('referral')) return <Share2 className="w-3 h-3 text-teal-500" />;
        return <Stethoscope className="w-3 h-3 text-slate-400" />;
    };

    if (planStructured.length === 0 && diagnoses.length === 0) {
        return (
            <div className="text-center py-10">
                <AlertCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">No plan items yet</p>
                <p className="text-xs text-slate-300 mt-1">Add diagnoses in the Assessment section to begin building the plan.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {planStructured.map((item, dIdx) => {
                const isExpanded = expandedCards.has(dIdx);
                const orderCount = item.orders?.length || 0;

                return (
                    <div key={dIdx} className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-primary-100 transition-all shadow-sm">
                        {/* Diagnosis Header */}
                        <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-all"
                            onClick={() => toggleCard(dIdx)}
                        >
                            {!isLocked && <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-grab shrink-0" />}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-800 truncate">{dIdx + 1}. {item.diagnosis}</h4>
                            </div>
                            {orderCount > 0 && (
                                <span className="text-[10px] font-bold bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full shrink-0">
                                    {orderCount} order{orderCount !== 1 ? 's' : ''}
                                </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                            {!isLocked && (
                                <button onClick={(e) => { e.stopPropagation(); removeFromPlan(dIdx); }} className="p-1 text-slate-300 hover:text-red-500 transition-all shrink-0" title="Remove diagnosis from plan">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Orders List */}
                        {isExpanded && (
                            <div className="border-t border-slate-50 px-4 py-3">
                                {item.orders?.length > 0 ? (
                                    <div className="space-y-1.5 mb-3">
                                        {item.orders.map((order, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 group transition-all">
                                                {getOrderIcon(order)}
                                                <span className="text-sm text-slate-600 flex-1">{order}</span>
                                                {!isLocked && (
                                                    <button onClick={() => removeFromPlan(dIdx, oIdx)} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-300 italic mb-3 py-2">No orders placed for this diagnosis</p>
                                )}

                                {/* Quick Add Buttons */}
                                {!isLocked && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-50">
                                        <button onClick={() => onOpenOrderPicker?.('LAB', item.diagnosis)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all">
                                            <FlaskConical className="w-3 h-3" /> Lab
                                        </button>
                                        <button onClick={() => onOpenOrderPicker?.('IMAGING', item.diagnosis)} className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all">
                                            <FileImage className="w-3 h-3" /> Imaging
                                        </button>
                                        <button onClick={() => onOpenPrescription?.(item.diagnosis)} className="text-[10px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all">
                                            <Pill className="w-3 h-3" /> Rx
                                        </button>
                                        <button onClick={() => onOpenReferral?.(item.diagnosis)} className="text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all">
                                            <Share2 className="w-3 h-3" /> Referral
                                        </button>
                                        <div className="flex-1 min-w-[140px]">
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    placeholder="Free text order..."
                                                    value={freeTextByDiag[dIdx] || ''}
                                                    onChange={(e) => setFreeTextByDiag(prev => ({ ...prev, [dIdx]: e.target.value }))}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFreeText(dIdx); }}
                                                    className="flex-1 text-[11px] border-slate-200 rounded-lg px-2 py-1 focus:ring-primary-400 focus:border-primary-400"
                                                />
                                                <button onClick={() => handleAddFreeText(dIdx)} className="text-[10px] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PlanSection;
