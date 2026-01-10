import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Edit2, Shield, ShieldAlert, AlertTriangle,
    Info, Save, X, Check, Loader2, Settings2
} from 'lucide-react';
import { patientFlagsAPI } from '../services/api';

const FlagTypesSettings = () => {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showNewForm, setShowNewForm] = useState(false);

    const [form, setForm] = useState({
        label: '',
        category: 'clinical',
        severity: 'info',
        color: '#3B82F6',
        requires_acknowledgment: false,
        requires_expiration: false,
        default_expiration_days: 0
    });

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const res = await patientFlagsAPI.getTypes();
            setTypes(res.data || []);
        } catch (err) {
            console.error('Failed to fetch flag types:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await patientFlagsAPI.updateType(editingId, form);
            } else {
                await patientFlagsAPI.createType(form);
            }
            setShowNewForm(false);
            setEditingId(null);
            resetForm();
            fetchTypes();
        } catch (err) {
            alert('Failed to save flag type');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (type) => {
        setEditingId(type.id);
        setForm({
            label: type.label,
            category: type.category,
            severity: type.severity,
            color: type.color,
            requires_acknowledgment: type.requires_acknowledgment,
            requires_expiration: type.requires_expiration,
            default_expiration_days: type.default_expiration_days
        });
        setShowNewForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this flag type? This will not remove existing flags on patients but will prevent new ones from being created.')) return;
        try {
            await patientFlagsAPI.deleteType(id);
            fetchTypes();
        } catch (err) {
            alert('Failed to delete flag type');
        }
    };

    const resetForm = () => {
        setForm({
            label: '',
            category: 'clinical',
            severity: 'info',
            color: '#3B82F6',
            requires_acknowledgment: false,
            requires_expiration: false,
            default_expiration_days: 0
        });
    };

    const getIcon = (severity) => {
        switch (severity) {
            case 'critical': return <ShieldAlert className="text-red-600" size={18} />;
            case 'warn': return <AlertTriangle className="text-orange-500" size={18} />;
            default: return <Info className="text-blue-500" size={18} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest text-xs">
                <Loader2 className="animate-spin mr-2" />
                Loading Flag Configurations...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Shield className="text-blue-600" />
                        Patient Flag Types
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Configure reusable alerts and security flags used across the practice.</p>
                </div>
                {!showNewForm && (
                    <button
                        onClick={() => { resetForm(); setEditingId(null); setShowNewForm(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
                    >
                        <Plus size={16} />
                        New Flag type
                    </button>
                )}
            </div>

            {showNewForm && (
                <div className="bg-white p-6 rounded-2xl border-2 border-blue-50 shadow-xl animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 flex items-center gap-2">
                            <Settings2 size={18} className="text-blue-600" />
                            {editingId ? 'Edit Flag Type' : 'Configure New Flag Type'}
                        </h3>
                        <button onClick={() => { setShowNewForm(false); setEditingId(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Flag Label *</label>
                            <input
                                required
                                type="text"
                                className="w-full text-sm border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. VIP, Fall Risk, Security Alert"
                                value={form.label}
                                onChange={e => setForm({ ...form, label: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Severity Level</label>
                            <select
                                className="w-full text-sm border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={form.severity}
                                onChange={e => setForm({ ...form, severity: e.target.value })}
                            >
                                <option value="info">Information (Blue)</option>
                                <option value="warn">Warning (Orange)</option>
                                <option value="critical">Critical (Red/High Alert)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                            <select
                                className="w-full text-sm border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                            >
                                <option value="clinical">Clinical / Medical</option>
                                <option value="admin">Administrative</option>
                                <option value="safety">Safety / Security</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-4 py-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                    checked={form.requires_acknowledgment}
                                    onChange={e => setForm({ ...form, requires_acknowledgment: e.target.checked })}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Require Acknowledgment</span>
                                    <span className="text-[10px] text-slate-400 font-medium leading-none">Users must click 'Agree' to open chart</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center gap-4 py-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                    checked={form.requires_expiration}
                                    onChange={e => setForm({ ...form, requires_expiration: e.target.checked })}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Self-Expiring</span>
                                    <span className="text-[10px] text-slate-400 font-medium leading-none">Automatically resolve after X days</span>
                                </div>
                            </label>
                        </div>

                        {form.requires_expiration && (
                            <div className="animate-in fade-in duration-200">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Default Days</label>
                                <input
                                    type="number"
                                    className="w-full text-sm border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    value={form.default_expiration_days}
                                    onChange={e => setForm({ ...form, default_expiration_days: parseInt(e.target.value) })}
                                />
                            </div>
                        )}

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setShowNewForm(false); setEditingId(null); }}
                                className="px-6 py-2 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-8 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-100"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {editingId ? 'Update Config' : 'Create Type'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map(type => (
                    <div key={type.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${type.severity === 'critical' ? 'bg-red-500' :
                                type.severity === 'warn' ? 'bg-orange-500' :
                                    'bg-blue-500'
                            }`} />

                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                {getIcon(type.severity)}
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${type.severity === 'critical' ? 'bg-red-50 text-red-600' :
                                        type.severity === 'warn' ? 'bg-orange-50 text-orange-600' :
                                            'bg-blue-50 text-blue-600'
                                    }`}>
                                    {type.severity}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(type)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(type.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <h4 className="text-lg font-black text-slate-900 mb-1">{type.label}</h4>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{type.category} Category</div>

                        <div className="space-y-2 border-t border-slate-50 pt-4">
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                                <span>Requires Ack:</span>
                                {type.requires_acknowledgment ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-slate-300" />}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                                <span>Self-Expiring:</span>
                                {type.requires_expiration ? (
                                    <span className="text-blue-600 font-black">{type.default_expiration_days} Days</span>
                                ) : (
                                    <X size={14} className="text-slate-300" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FlagTypesSettings;
