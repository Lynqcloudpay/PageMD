import React, { useState, useEffect } from 'react';
import {
    Key, Globe, Shield, Zap, Plus, Copy, RotateCw,
    Trash2, AlertCircle, CheckCircle2, Loader2, Info,
    Eye, EyeOff, ExternalLink, Settings
} from 'lucide-react';
import { partnersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DeveloperPortalTab = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [apps, setApps] = useState([]);
    const [scopes, setScopes] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [showSecretModal, setShowSecretModal] = useState(null);
    const [isCreatingApp, setIsCreatingApp] = useState(false);
    const [newApp, setNewApp] = useState({
        name: '',
        description: '',
        env: 'production',
        allowed_scopes: [],
        redirect_uris: []
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [partnersRes, scopesRes, policiesRes] = await Promise.all([
                partnersAPI.getPartners(),
                partnersAPI.getScopes(),
                partnersAPI.getRateLimitPolicies()
            ]);

            setPartners(partnersRes.data.data);
            setScopes(scopesRes.data.data);
            setPolicies(policiesRes.data.data);

            if (partnersRes.data.data.length > 0) {
                handleSelectPartner(partnersRes.data.data[0]);
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
            const appsRes = await partnersAPI.getApps(partner.id);
            setApps(appsRes.data.data);
        } catch (error) {
            console.error('Error loading partner apps:', error);
        }
    };

    const handleCreateApp = async () => {
        if (!newApp.name) return;
        try {
            const res = await partnersAPI.createApp(selectedPartner.id, newApp);
            setApps([res.data.data, ...apps]);
            setShowSecretModal(res.data.data.client_secret); // res.data.data contains secret only on creation
            setIsCreatingApp(false);
            setNewApp({ name: '', description: '', env: 'production', allowed_scopes: [], redirect_uris: [] });
        } catch (error) {
            console.error('Error creating app:', error);
            alert('Failed to create application');
        }
    };

    const handleRotateSecret = async (appId) => {
        if (!confirm('Are you sure? Any systems using the old secret will lose access immediately.')) return;
        try {
            const res = await partnersAPI.rotateSecret(appId);
            setShowSecretModal(res.data.data.client_secret);
        } catch (error) {
            console.error('Error rotating secret:', error);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Could add toast here
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            {/* Header Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Zap className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-blue-900">Developer Portal</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">
                        Connect PageMD with 3rd party services like DoseSpot, Billing platforms, or custom apps.
                        Manage your API keys, secrets, and permissions from this dashboard.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                        <a href="/fhir/R4/metadata" target="_blank" className="text-xs font-semibold text-blue-600 flex items-center gap-1 hover:underline">
                            <Globe className="w-3 h-3" /> Capability Statement (FHIR)
                        </a>
                        <span className="text-blue-300">|</span>
                        <span className="text-xs text-blue-600 font-medium">Base URL: https://pagemdemr.com/api/v1</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Partner Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Partners</h4>
                        <button className="p-1 hover:bg-gray-100 rounded-lg text-primary-600">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        {partners.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleSelectPartner(p)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedPartner?.id === p.id
                                        ? 'bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-100'
                                        : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-bold text-sm">{p.name}</div>
                                <div className="text-[10px] opacity-70 truncate">{p.contact_email}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Apps Main View */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold text-gray-800">Applications</h4>
                        <button
                            onClick={() => setIsCreatingApp(true)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary-700 shadow-md transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Create App
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {apps.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium font-serif">No applications registered for this partner.</p>
                            </div>
                        ) : (
                            apps.map(app => (
                                <div key={app.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h5 className="text-lg font-bold text-gray-900">{app.name}</h5>
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${app.env === 'production' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {app.env}
                                                </span>
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${app.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {app.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{app.description || 'No description provided.'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRotateSecret(app.id)}
                                                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                title="Rotate Secret"
                                            >
                                                <RotateCw className="w-5 h-5" />
                                            </button>
                                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client ID</label>
                                            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                                <code className="text-xs font-mono text-gray-600 truncate flex-1">{app.client_id}</code>
                                                <button onClick={() => copyToClipboard(app.client_id)} className="p-1 hover:text-primary-600 text-gray-400">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client Secret</label>
                                            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                                <code className="text-xs font-mono text-gray-600 truncate flex-1">••••••••••••••••••••••••••••••••</code>
                                                <span className="text-[10px] text-gray-400 italic">Rotated {new Date().toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {app.allowed_scopes?.map(s => (
                                            <span key={s} className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-600">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Create App Modal */}
            {isCreatingApp && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-50/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 bg-gradient-to-r from-primary-600 to-indigo-600 text-white">
                            <h4 className="text-xl font-bold">Register New Application</h4>
                            <p className="text-primary-100 text-sm mt-1">Configure API access for {selectedPartner.name}</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Application Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="e.g. DoseSpot Connector"
                                        value={newApp.name}
                                        onChange={e => setNewApp({ ...newApp, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                                    <textarea
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="What will this app do?"
                                        rows={2}
                                        value={newApp.description}
                                        onChange={e => setNewApp({ ...newApp, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Environment</label>
                                    <div className="flex gap-2">
                                        {['sandbox', 'production'].map(e => (
                                            <button
                                                key={e}
                                                onClick={() => setNewApp({ ...newApp, env: e })}
                                                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${newApp.env === e ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200'
                                                    }`}
                                            >
                                                {e.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Required Permissions (Scopes)</label>
                                    <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        {scopes.map(s => (
                                            <label key={s.scope} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors group">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-primary-600"
                                                    checked={newApp.allowed_scopes.includes(s.scope)}
                                                    onChange={e => {
                                                        const sc = e.target.checked
                                                            ? [...newApp.allowed_scopes, s.scope]
                                                            : newApp.allowed_scopes.filter(x => x !== s.scope);
                                                        setNewApp({ ...newApp, allowed_scopes: sc });
                                                    }}
                                                />
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{s.scope}</p>
                                                    <p className="text-[10px] text-gray-500 group-hover:text-gray-700">{s.description}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setIsCreatingApp(false)}
                                    className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateApp}
                                    className="flex-1 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
                                >
                                    Register Application
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Secret Reveal Modal */}
            {showSecretModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-50/60 backdrop-blur-md">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-8 text-center space-y-6">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                                <ShieldCheck className="w-10 h-10" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-gray-900">Copy Client Secret</h4>
                                <p className="text-gray-500 text-sm mt-1">
                                    For security, we only show this secret once. Store it immediately and securely.
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center gap-3 break-all font-mono text-sm text-gray-700 selection:bg-emerald-200">
                                {showSecretModal}
                                <button onClick={() => copyToClipboard(showSecretModal)} className="shrink-0 p-2 hover:bg-white rounded-lg text-primary-600 shadow-sm transition-all active:scale-90">
                                    <Copy className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowSecretModal(null)}
                                className="w-full py-4 bg-gray-50 text-white rounded-2xl font-bold hover:bg-black transition-all"
                            >
                                I have saved the secret
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Mock ShieldCheck if not found in icons
const ShieldCheck = ({ className }) => <Shield className={className} />;

export default DeveloperPortalTab;
