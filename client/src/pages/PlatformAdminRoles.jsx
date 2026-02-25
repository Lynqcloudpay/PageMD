import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, CheckCircle, AlertCircle, Loader2, Save, X, Edit } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminRoles = () => {
    const { apiCall } = usePlatformAdmin();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        role_key: '',
        display_name: '',
        description: '',
        version: '1.0',
        privileges: []
    });

    const ALL_PRIVILEGES = [
        'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
        'patients:edit_demographics', 'patients:edit_insurance', 'patients:create', 'patients:delete',
        'notes:view', 'notes:create', 'notes:edit', 'notes:sign', 'notes:delete',
        'visits:create', 'visits:edit', 'visits:sign', 'visits:delete',
        'orders:create', 'orders:edit', 'orders:delete', 'orders:view',
        'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'prescriptions:delete', 'meds:prescribe',
        'referrals:create', 'referrals:edit', 'referrals:view', 'referrals:delete',
        'schedule:view', 'schedule:edit', 'schedule:status_update', 'schedule:assign_provider', 'schedule:delete',
        'users:manage', 'roles:manage', 'permissions:manage',
        'billing:view', 'billing:create', 'billing:edit', 'claims:submit',
        'reports:view', 'settings:edit', 'admin:access', 'audit:view',
        'clinical:document', 'clinical:order', 'clinical:rx'
    ];

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await apiCall('GET', '/governance/roles');
            setTemplates(data || []);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (tpl) => {
        setEditingId(tpl.id);
        setFormData({
            role_key: tpl.role_key,
            display_name: tpl.display_name,
            description: tpl.description || '',
            version: tpl.version || '1.0',
            privileges: tpl.privilege_set || tpl.privileges || []
        });
        setShowModal(true);
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({
            role_key: '',
            display_name: '',
            description: '',
            version: '1.0',
            privileges: []
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this role template? This will not affect existing clinics immediately but may cause drift.')) return;

        try {
            await apiCall('DELETE', `/governance/roles/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            alert('Failed to delete template: ' + err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await apiCall('PUT', `/governance/roles/${editingId}`, formData);
            } else {
                await apiCall('POST', '/governance/roles', formData);
            }
            setShowModal(false);
            loadTemplates();
        } catch (err) {
            alert('Failed to save template: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const togglePrivilege = (priv) => {
        setFormData(prev => {
            const exists = prev.privileges.includes(priv);
            return {
                ...prev,
                privileges: exists
                    ? prev.privileges.filter(p => p !== priv)
                    : [...prev.privileges, priv]
            };
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden p-8">
            <div className="max-w-6xl mx-auto relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Global Role Templates</h1>
                        <p className="text-gray-500 font-medium">Define canonical permission schemas for all clinic tenants.</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-50 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-gray-100 transition-all active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5" />
                        New Template
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(templates || []).map((tpl) => (
                        <div key={tpl.id} className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-widest">
                                    {(tpl.privilege_set || tpl.privileges || []).length} Privileges
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-gray-800 mb-2">{tpl.display_name || tpl.name || tpl.role_key}</h3>
                            <p className="text-sm text-gray-500 mb-6 line-clamp-2">{tpl.description || 'No description available'}</p>

                            <div className="flex flex-wrap gap-2 mb-6 max-h-32 overflow-y-auto p-1">
                                {(tpl.privilege_set || tpl.privileges || []).map((p, idx) => (
                                    <span key={idx} className="text-[10px] font-bold text-gray-600 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200">
                                        {p}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(tpl)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit Privileges
                                </button>
                                <button
                                    onClick={() => handleDelete(tpl.id)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-red-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit/Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-50/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingId ? 'Edit Role Template' : 'Create New Template'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="roleForm" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Role Key (ID)</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={!!editingId}
                                            value={formData.role_key}
                                            onChange={e => setFormData({ ...formData, role_key: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                                            placeholder="e.g. CLINICAL_ADMIN"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.display_name}
                                            onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                                            placeholder="e.g. Clinical Administrator"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-20 text-sm"
                                        placeholder="Describe the responsibilities of this role..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Privileges</label>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {ALL_PRIVILEGES.map(priv => (
                                            <label key={priv} className={`
                                                flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                                ${formData.privileges.includes(priv)
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                    : 'bg-white border-gray-100 hover:border-gray-200 text-gray-600'}
                                            `}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.privileges.includes(priv)}
                                                    onChange={() => togglePrivilege(priv)}
                                                    className="w-4 h-4 text-indigo-600 rounded-md border-gray-200 focus:ring-indigo-500"
                                                />
                                                <span className="font-medium font-mono text-xs">{priv}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="roleForm"
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingId ? 'Save Changes' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl -mr-64 -mt-64"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-400/5 rounded-full blur-3xl -ml-64 -mb-64"></div>
        </div>
    );
};

export default PlatformAdminRoles;
