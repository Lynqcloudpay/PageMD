import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, CheckCircle, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminRoles = () => {
    const { apiCall } = usePlatformAdmin();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: '', description: '', privileges: [] });

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await apiCall('GET', '/governance/roles');
            setTemplates(data);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden p-8">
            <div className="max-w-6xl mx-auto relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Global Role Templates</h1>
                        <p className="text-slate-500 font-medium">Define canonical permission schemas for all clinic tenants.</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5" />
                        New Template
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templates.map((tpl) => (
                        <div key={tpl.id} className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-widest">
                                    {tpl.privileges.length} Privileges
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2">{tpl.name}</h3>
                            <p className="text-sm text-slate-500 mb-6 line-clamp-2">{tpl.description}</p>

                            <div className="flex flex-wrap gap-2 mb-6 max-h-32 overflow-y-auto p-1">
                                {tpl.privileges.map((p, idx) => (
                                    <span key={idx} className="text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200">
                                        {p}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Edit Privileges</button>
                                <button className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors">Delete Template</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl -mr-64 -mt-64"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-400/5 rounded-full blur-3xl -ml-64 -mb-64"></div>
        </div>
    );
};

export default PlatformAdminRoles;
