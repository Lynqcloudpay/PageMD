import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Key, Globe, Shield, Zap, Plus, Copy, RotateCw,
    Trash2, AlertCircle, CheckCircle2, Loader2, Info,
    Eye, EyeOff, ExternalLink, Settings, Layout, Code, Server
} from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminDevelopers = () => {
    const navigate = useNavigate();
    const { apiCall } = usePlatformAdmin();
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [apps, setApps] = useState([]);
    const [scopes, setScopes] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [showSecretModal, setShowSecretModal] = useState(null);
    const [isCreatingApp, setIsCreatingApp] = useState(false);
    const [isCreatingPartner, setIsCreatingPartner] = useState(false);
    const [newPartner, setNewPartner] = useState({ name: '', contact_email: '', description: '' });
    const [newApp, setNewApp] = useState({
        name: '',
        description: '',
        env: 'production',
        allowed_scopes: []
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [partnersRes, scopesRes, policiesRes] = await Promise.all([
                apiCall('GET', '/partners'),
                apiCall('GET', '/scopes'),
                apiCall('GET', '/rate-limit-policies')
            ]);

            setPartners(partnersRes.data);
            setScopes(scopesRes.data);
            setPolicies(policiesRes.data);

            if (partnersRes.data.length > 0) {
                handleSelectPartner(partnersRes.data[0]);
            }
        } catch (error) {
            console.error('Error loading developer data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPartner = async (partner) => {
        setSelectedPartner(partner);
        try {
            const appsRes = await apiCall('GET', `/partners/${partner.id}/apps`);
            setApps(appsRes.data);
        } catch (error) {
            console.error('Error loading partner apps:', error);
        }
    };

    const handleCreatePartner = async () => {
        if (!newPartner.name || !newPartner.contact_email) return;
        try {
            const res = await apiCall('POST', '/partners', newPartner);
            setPartners([...partners, res.data]);
            setIsCreatingPartner(false);
            setNewPartner({ name: '', contact_email: '', description: '' });
            handleSelectPartner(res.data);
        } catch (error) {
            alert('Failed to create partner');
        }
    };

    const handleCreateApp = async () => {
        if (!newApp.name) return;
        try {
            const res = await apiCall('POST', `/partners/${selectedPartner.id}/apps`, newApp);
            setApps([res.data, ...apps]);
            setShowSecretModal(res.data.client_secret);
            setIsCreatingApp(false);
            setNewApp({ name: '', description: '', env: 'production', allowed_scopes: [] });
        } catch (error) {
            console.error('Error creating app:', error);
            alert('Failed to create application');
        }
    };

    const handleRotateSecret = async (appId) => {
        if (!confirm('Are you sure? Any systems using the old secret will lose access immediately.')) return;
        try {
            const res = await apiCall('POST', `/apps/${appId}/rotate-secret`);
            setShowSecretModal(res.data.client_secret);
        } catch (error) {
            console.error('Error rotating secret:', error);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/platform-admin/dashboard')}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">Developer Platform</h1>
                            <p className="text-slate-500 font-medium">Manage API partners, secure credentials, and third-party integrations</p>
                        </div>
                        <button
                            onClick={() => setIsCreatingPartner(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Partner
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Sidebar: Partners List */}
                    <div className="col-span-3 space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Partners</h3>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {partners.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-xs text-slate-400">No partners found</p>
                                </div>
                            ) : (
                                partners.map(partner => (
                                    <button
                                        key={partner.id}
                                        onClick={() => handleSelectPartner(partner)}
                                        className={`w-full text-left px-4 py-4 flex items-center gap-3 transition-all border-b border-slate-100 last:border-0 ${selectedPartner?.id === partner.id
                                                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                            }`}
                                    >
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
                                            <Server className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`font-bold text-sm truncate ${selectedPartner?.id === partner.id ? 'text-blue-900' : 'text-slate-700'}`}>
                                                {partner.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">{partner.contact_email}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Main Content: Partner Details & Apps */}
                    <div className="col-span-9 space-y-6">
                        {selectedPartner ? (
                            <>
                                {/* Partner Stats / Info */}
                                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800">{selectedPartner.name}</h2>
                                            <p className="text-slate-500 text-sm mt-1">{selectedPartner.description || 'No description provided'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
                                                {selectedPartner.status?.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Applications</p>
                                            <p className="text-xl font-bold text-slate-800">{apps.length}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Partner Since</p>
                                            <p className="text-md font-bold text-slate-800">
                                                {new Date(selectedPartner.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contact</p>
                                            <p className="text-sm font-bold text-slate-800 truncate">{selectedPartner.contact_email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Applications Section */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-slate-800">Applications</h3>
                                        <button
                                            onClick={() => setIsCreatingApp(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all text-xs font-bold"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Create New App
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {apps.length === 0 ? (
                                            <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                                                <Code className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                                <h4 className="font-bold text-slate-500">No applications found</h4>
                                                <p className="text-sm text-slate-400">Create an application to generate API credentials</p>
                                            </div>
                                        ) : (
                                            apps.map(app => (
                                                <div key={app.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center gap-6">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${app.env === 'production' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                                                        }`}>
                                                        <Zap className="w-6 h-6" />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-slate-800">{app.name}</h4>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${app.env === 'production' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                                                }`}>
                                                                {app.env}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-mono">ID: {app.client_id}</p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 w-48 justify-end">
                                                        {app.allowed_scopes?.slice(0, 2).map(s => (
                                                            <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium border border-slate-200">
                                                                {s}
                                                            </span>
                                                        ))}
                                                        {app.allowed_scopes?.length > 2 && <span className="text-[9px] text-slate-400">+{app.allowed_scopes.length - 2} more</span>}
                                                    </div>

                                                    <div className="flex items-center gap-2 border-l border-slate-100 pl-6 shrink-0">
                                                        <button
                                                            onClick={() => handleRotateSecret(app.id)}
                                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="Rotate Secret"
                                                        >
                                                            <RotateCw className="w-5 h-5" />
                                                        </button>
                                                        <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white rounded-3xl p-20 text-center border border-slate-200 shadow-sm flex flex-col items-center">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                    <Server className="w-10 h-10 text-slate-200" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800">Select a Partner</h2>
                                <p className="text-slate-500 mt-2 max-w-sm">Choose a partner from the sidebar to manage their API applications and credentials.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Partner Modal */}
            {isCreatingPartner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">Create New Partner</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Partner Name</label>
                                <input
                                    type="text"
                                    value={newPartner.name}
                                    onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    placeholder="e.g. DoseSpot Inc"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Contact Email</label>
                                <input
                                    type="email"
                                    value={newPartner.contact_email}
                                    onChange={e => setNewPartner({ ...newPartner, contact_email: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    placeholder="api@partner.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Description</label>
                                <textarea
                                    value={newPartner.description}
                                    onChange={e => setNewPartner({ ...newPartner, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all h-24"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsCreatingPartner(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePartner}
                                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                            >
                                Create Partner
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New App Modal */}
            {isCreatingApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-xl bg-white rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">Create Integration App</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">App Name</label>
                                    <input
                                        type="text"
                                        value={newApp.name}
                                        onChange={e => setNewApp({ ...newApp, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Environment</label>
                                    <select
                                        value={newApp.env}
                                        onChange={e => setNewApp({ ...newApp, env: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    >
                                        <option value="sandbox">Sandbox / Dev</option>
                                        <option value="production">Production</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-3">Permissions (Scopes)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {scopes.map(s => (
                                        <label key={s.scope} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newApp.allowed_scopes.includes(s.scope)}
                                                onChange={e => {
                                                    if (e.target.checked) setNewApp({ ...newApp, allowed_scopes: [...newApp.allowed_scopes, s.scope] });
                                                    else setNewApp({ ...newApp, allowed_scopes: newApp.allowed_scopes.filter(i => i !== s.scope) });
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-700 truncate">{s.scope}</p>
                                                <p className="text-[9px] text-slate-400 truncate">{s.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsCreatingApp(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateApp}
                                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl"
                            >
                                Create Application
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Secret Display Modal */}
            {showSecretModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                    <div className="w-full max-w-lg bg-white rounded-[2rem] p-10 text-center relative shadow-2xl">
                        <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/40">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Save Your Secret</h2>
                        <p className="text-sm text-slate-500 mt-2 mb-8">
                            This secret will be shown **only once**. If you lose it, you will need to rotate it and update all systems.
                        </p>

                        <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 flex items-center gap-4 mb-8">
                            <code className="flex-1 text-sm font-bold text-blue-600 font-mono break-all">{showSecretModal}</code>
                            <button
                                onClick={() => copyToClipboard(showSecretModal)}
                                className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-blue-500"
                            >
                                <Copy className="w-5 h-5" />
                            </button>
                        </div>

                        <button
                            onClick={() => setShowSecretModal(null)}
                            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-xl shadow-slate-900/20"
                        >
                            I have saved it securely
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformAdminDevelopers;
