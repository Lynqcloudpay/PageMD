import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Info, FlaskConical, Image as ImageIcon, Activity, ChevronRight } from 'lucide-react';

const OrderDetailsModal = ({ order, initialDiagnoses = [], onSave, onClose }) => {
    const [details, setDetails] = useState({
        priority: order.default_priority || 'ROUTINE',
        instructions: order.instructions || '',
        diagnosis_icd10_ids: initialDiagnoses.map(d => d.code || d),
        order_details: {
            laterality: 'N/A',
            contrast: 'No',
            fasting: 'No',
            duration: '',
            ...order.order_details
        }
    });

    const handleSave = () => {
        onSave(details);
    };

    const renderLabDetails = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Priority</label>
                    <div className="flex bg-neutral-100 p-1 rounded-lg">
                        {['ROUTINE', 'STAT'].map(p => (
                            <button
                                key={p}
                                onClick={() => setDetails({ ...details, priority: p })}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${details.priority === p ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Fasting Required</label>
                    <div className="flex bg-neutral-100 p-1 rounded-lg">
                        {['No', 'Yes'].map(f => (
                            <button
                                key={f}
                                onClick={() => setDetails({ ...details, order_details: { ...details.order_details, fasting: f } })}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${details.order_details.fasting === f ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Specimen / Collection Notes</label>
                <textarea
                    value={details.instructions}
                    onChange={(e) => setDetails({ ...details, instructions: e.target.value })}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 outline-none min-h-[80px]"
                    placeholder="Special handling or collection instructions..."
                />
            </div>
        </div>
    );

    const renderImagingDetails = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Laterality</label>
                    <select
                        value={details.order_details.laterality}
                        onChange={(e) => setDetails({ ...details, order_details: { ...details.order_details, laterality: e.target.value } })}
                        className="w-full p-2 bg-neutral-100 border-none rounded-lg text-xs font-bold"
                    >
                        <option value="N/A">Not Applicable</option>
                        <option value="Left">Left</option>
                        <option value="Right">Right</option>
                        <option value="Bilateral">Bilateral</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Contrast</label>
                    <div className="flex bg-neutral-100 p-1 rounded-lg">
                        {['No', 'Yes', 'W/WO'].map(c => (
                            <button
                                key={c}
                                onClick={() => setDetails({ ...details, order_details: { ...details.order_details, contrast: c } })}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${details.order_details.contrast === c ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                                    }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Clinical Indication / Notes</label>
                <textarea
                    value={details.order_details.notes || ''}
                    onChange={(e) => setDetails({ ...details, order_details: { ...details.order_details, notes: e.target.value } })}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 outline-none min-h-[80px]"
                    placeholder="Provide clinical context for the radiologist..."
                />
            </div>
        </div>
    );

    const renderProcedureDetails = () => (
        <div className="space-y-4">
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Duration / Specifics</label>
                <input
                    type="text"
                    value={details.order_details.duration || ''}
                    onChange={(e) => setDetails({ ...details, order_details: { ...details.order_details, duration: e.target.value } })}
                    className="w-full p-2.5 bg-neutral-100 border-none rounded-lg text-xs font-bold"
                    placeholder="e.g. 24 hours, 12-lead, dual chamber..."
                />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Procedure Comments</label>
                <textarea
                    value={details.order_details.comments || ''}
                    onChange={(e) => setDetails({ ...details, order_details: { ...details.order_details, comments: e.target.value } })}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 outline-none min-h-[80px]"
                    placeholder="Special setup or technician instructions..."
                />
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden w-full max-w-lg mx-auto">
            {/* Header */}
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                        {order.type === 'LAB' && <FlaskConical className="w-5 h-5 text-indigo-400" />}
                        {order.type === 'IMAGING' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
                        {order.type === 'PROCEDURE' && <Activity className="w-5 h-5 text-rose-400" />}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold leading-tight">{order.name}</h2>
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{order.type} ORDER • {order.category}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="p-6">
                {/* Dynamic Form */}
                {order.type === 'LAB' && renderLabDetails()}
                {order.type === 'IMAGING' && renderImagingDetails()}
                {order.type === 'PROCEDURE' && renderProcedureDetails()}

                {/* Diagnoses Checklist (Simplified) */}
                <div className="mt-6">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                        Linked Diagnoses
                        <span className="text-[9px] lowercase opacity-50 font-medium">(at least one required)</span>
                    </label>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                        {initialDiagnoses.map((diag, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 p-2 bg-neutral-50 hover:bg-white border border-neutral-100 rounded-lg transition-all group">
                                <input
                                    type="checkbox"
                                    checked={details.diagnosis_icd10_ids.includes(diag.code || diag)}
                                    onChange={() => {
                                        const code = diag.code || diag;
                                        const exists = details.diagnosis_icd10_ids.includes(code);
                                        if (exists) {
                                            setDetails({ ...details, diagnosis_icd10_ids: details.diagnosis_icd10_ids.filter(id => id !== code) });
                                        } else {
                                            setDetails({ ...details, diagnosis_icd10_ids: [...details.diagnosis_icd10_ids, code] });
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-neutral-900 mr-2">{diag.code || diag}</span>
                                    <span className="text-xs text-neutral-500 truncate">{diag.description || ''}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 transition-colors uppercase tracking-widest"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-8 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                    <Save className="w-4 h-4" />
                    Create Order
                </button>
            </div>
        </div>
    );
};

export default OrderDetailsModal;
