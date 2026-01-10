import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, Shield, Activity, Info, X,
    CheckCircle, Clock, Plus, Trash2, ShieldAlert
} from 'lucide-react';
import { patientFlagsAPI } from '../services/api';
import { format } from 'date-fns';

const PatientFlagsManager = ({ patientId, onClose, onUpdate }) => {
    const [flags, setFlags] = useState([]);
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newFlag, setNewFlag] = useState({
        flag_type_id: '',
        note: '',
        expires_at: ''
    });

    useEffect(() => {
        fetchData();
    }, [patientId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [flagsRes, typesRes] = await Promise.all([
                patientFlagsAPI.getByPatient(patientId),
                patientFlagsAPI.getTypes()
            ]);
            setFlags(flagsRes.data || []);
            setTypes(typesRes.data || []);
        } catch (err) {
            console.error('Failed to fetch flags data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFlag = async (e) => {
        e.preventDefault();
        try {
            await patientFlagsAPI.create(patientId, newFlag);
            setAdding(false);
            setNewFlag({ flag_type_id: '', note: '', expires_at: '' });
            fetchData();
            onUpdate?.();
        } catch (err) {
            alert('Failed to add flag');
        }
    };

    const handleResolve = async (id) => {
        try {
            await patientFlagsAPI.resolve(id);
            fetchData();
            onUpdate?.();
        } catch (err) {
            alert('Failed to resolve flag');
        }
    };

    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'critical': return 'bg-red-50 text-red-700 border-red-200';
            case 'warn': return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getIcon = (severity) => {
        switch (severity) {
            case 'critical': return <ShieldAlert size={14} />;
            case 'warn': return <AlertTriangle size={14} />;
            case 'info': return <Info size={14} />;
            default: return <Shield size={14} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Shield className="text-blue-600" />
                    Patient Flags & Alerts
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="py-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
                        Loading clinical flags...
                    </div>
                ) : (
                    <>
                        {/* Summary Section */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Flags</div>
                                <div className="text-xl font-black text-slate-900">{flags.filter(f => f.status === 'active').length}</div>
                            </div>
                            <button
                                onClick={() => setAdding(true)}
                                className="bg-blue-600 p-3 rounded-xl text-white flex flex-col justify-center items-center hover:bg-blue-700 transition-all font-black"
                            >
                                <Plus size={18} />
                                <span className="text-[10px] uppercase tracking-widest">Add New Flag</span>
                            </button>
                        </div>

                        {/* Add Flag Form */}
                        {adding && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-black text-sm text-slate-900">New Patient Flag</h3>
                                    <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600">
                                        <X size={16} />
                                    </button>
                                </div>
                                <form onSubmit={handleAddFlag} className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Flag Type</label>
                                        <select
                                            required
                                            className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            value={newFlag.flag_type_id}
                                            onChange={(e) => setNewFlag({ ...newFlag, flag_type_id: e.target.value })}
                                        >
                                            <option value="">Select a flag type...</option>
                                            {types.map(t => (
                                                <option key={t.id} value={t.id}>{t.label} ({t.severity.toUpperCase()})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Notes (Optional)</label>
                                        <textarea
                                            className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Explain why this flag is being added..."
                                            rows={2}
                                            value={newFlag.note}
                                            onChange={(e) => setNewFlag({ ...newFlag, note: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Expires (Optional)</label>
                                            <input
                                                type="date"
                                                className="w-full text-sm border-slate-200 rounded-lg"
                                                value={newFlag.expires_at}
                                                onChange={(e) => setNewFlag({ ...newFlag, expires_at: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-black text-xs uppercase hover:bg-blue-700 transition-all">
                                                Create Flag
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* List of Flags */}
                        <div className="space-y-3">
                            {flags.length === 0 ? (
                                <div className="py-20 text-center">
                                    <ShieldCheck className="mx-auto text-slate-100 w-16 h-16 mb-4" />
                                    <p className="text-slate-400 font-bold italic">No active flags or history for this patient</p>
                                </div>
                            ) : (
                                flags.map(flag => (
                                    <div
                                        key={flag.id}
                                        className={`p-3 border rounded-xl relative transition-all ${flag.status === 'active' ? getSeverityStyles(flag.severity) : 'bg-slate-50 border-slate-200 grayscale opacity-60'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-1.5">
                                                {getIcon(flag.severity)}
                                                <span className="text-[11px] font-black uppercase tracking-tight">{flag.label}</span>
                                                {flag.status === 'active' && (
                                                    <span className="text-[8px] px-1 py-0.5 bg-white/50 rounded font-black text-slate-600 uppercase">Active</span>
                                                )}
                                            </div>
                                            {flag.status === 'active' && (
                                                <button
                                                    onClick={() => handleResolve(flag.id)}
                                                    className="p-1 hover:bg-black/5 rounded text-slate-500 hover:text-green-600 transition-colors"
                                                    title="Resolve Flag"
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {flag.note && (
                                            <p className="text-xs font-medium leading-relaxed mb-2 italic">
                                                "{flag.note}"
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-black/5">
                                            <div className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {format(new Date(flag.created_at), 'MMM d, h:mm a')}
                                                {flag.created_by_first && ` by ${flag.created_by_first} ${flag.created_by_last[0]}.`}
                                            </div>
                                            {flag.status === 'resolved' && (
                                                <div className="text-green-600">
                                                    Resolved {format(new Date(flag.resolved_at), 'MMM d')}
                                                </div>
                                            )}
                                            {flag.expires_at && flag.status === 'active' && (
                                                <div className="text-orange-600">
                                                    Exp: {format(new Date(flag.expires_at), 'MMM d')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PatientFlagsManager;
