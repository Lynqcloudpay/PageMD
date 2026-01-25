import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Search, Plus, XCircle, Database, Shield, ChevronRight, Users, MapPin, Mail, Phone, CheckCircle, Clock, Activity, Zap } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminClinics = () => {
    const navigate = useNavigate();
    const { apiCall } = usePlatformAdmin();
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Add Clinic Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newClinic, setNewClinic] = useState({
        displayName: '',
        slug: '',
        details: {
            address: '',
            specialty: '',
            contact_email: '',
            contact_phone: ''
        },
        dbConfig: {
            dbName: '',
        },
        adminUser: {
            email: '',
            password: '',
            firstName: '',
            lastName: ''
        }
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadClinics();
    }, []);

    const loadClinics = async () => {
        try {
            const data = await apiCall('GET', '/clinics');
            setClinics(data);
        } catch (error) {
            console.error('Failed to load clinics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClinic = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                clinic: {
                    name: newClinic.displayName,
                    slug: newClinic.slug,
                    address: newClinic.details.address,
                    contact_email: newClinic.details.contact_email,
                    contact_phone: newClinic.details.contact_phone,
                    specialty: newClinic.details.specialty
                },
                dbConfig: {
                    dbName: `emr_${newClinic.slug.replace(/-/g, '_')}`
                },
                adminUser: newClinic.adminUser
            };

            await apiCall('POST', '/clinics/onboard', payload);
            setSuccess(`Clinic "${newClinic.displayName}" created successfully!`);
            setShowAddModal(false);
            setNewClinic({
                displayName: '', slug: '', details: {}, dbConfig: { dbName: '' }, adminUser: { email: '', password: '', firstName: '', lastName: '' }
            });
            loadClinics();
        } catch (err) {
            console.error("Creation error:", err);
            setError(err.response?.data?.error || err.message || 'Failed to create clinic');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSlugChange = (e) => {
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setNewClinic({ ...newClinic, slug: val });
    };

    const filteredClinics = clinics.filter(c =>
        c.display_name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'trial': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'suspended': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-3xl"></div>
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
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Clinic Management</h1>
                    <p className="text-slate-500">Add, manage, and monitor all clinics on the platform</p>
                </div>

                {/* Actions Bar */}
                <div className="mb-8 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[300px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search clinics..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 rounded-2xl transition-all font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                    >
                        <Plus className="w-5 h-5" />
                        Onboard Clinic
                    </button>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
                        {success}
                    </div>
                )}

                {/* Clinics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                        </div>
                    ) : filteredClinics.length > 0 ? (
                        filteredClinics.map((clinic, idx) => (
                            <button
                                key={idx}
                                onClick={() => navigate(`/platform-admin/clinics/${clinic.id}`)}
                                className="group w-full text-left bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300"
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
                                        <Building2 className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-lg truncate">{clinic.display_name}</h3>
                                        <p className="text-sm text-slate-400 truncate">{clinic.slug}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Status
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {clinic.onboarding_complete ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                                                    <CheckCircle className="w-2.5 h-2.5" />
                                                    Setup Done
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    Onboarding
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusColor(clinic.status)}`}>
                                                {clinic.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Feature Badges */}
                                    <div className="flex items-center gap-2 py-1">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-1">Features</span>
                                        <div className="flex items-center gap-2">
                                            {clinic.enabled_features?.efax && <Activity className="w-3.5 h-3.5 text-indigo-400" title="eFax Enabled" />}
                                            {clinic.enabled_features?.labs && <Database className="w-3.5 h-3.5 text-blue-400" title="Labs Enabled" />}
                                            {clinic.enabled_features?.telehealth && <Zap className="w-3.5 h-3.5 text-orange-400" title="Telehealth Enabled" />}
                                            {clinic.enabled_features?.eprescribe && <Shield className="w-3.5 h-3.5 text-purple-400" title="ePrescribe Enabled" />}
                                            {!clinic.enabled_features || Object.values(clinic.enabled_features).every(v => !v) && (
                                                <span className="text-[10px] text-slate-300 italic">None enabled</span>
                                            )}
                                        </div>
                                    </div>
                                    {clinic.specialty && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Specialty</span>
                                            <span className="text-slate-700 font-medium">{clinic.specialty}</span>
                                        </div>
                                    )}
                                    {clinic.contact_email && (
                                        <div className="flex items-center gap-2 text-slate-400 text-xs">
                                            <Mail className="w-3.5 h-3.5" />
                                            <span className="truncate">{clinic.contact_email}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20">
                            <Building2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg font-medium">No clinics found</p>
                            <p className="text-slate-400 text-sm">Try adjusting your search or add a new clinic</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Clinic Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 relative my-8 border border-slate-100">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Onboard New Clinic</h2>
                                <p className="text-slate-500 text-sm">Create a new clinic with dedicated database</p>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleCreateClinic} className="space-y-6">
                            {/* Clinic Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Clinic Details
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Heart Center of Nevada"
                                            value={newClinic.displayName}
                                            onChange={e => setNewClinic({ ...newClinic, displayName: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Slug (Subdomain)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. heart-center-nv"
                                            value={newClinic.slug}
                                            onChange={handleSlugChange}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Unique URL identifier (auto-formatted)</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Specialty</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Cardiology"
                                            value={newClinic.details.specialty}
                                            onChange={e => setNewClinic({ ...newClinic, details: { ...newClinic.details, specialty: e.target.value } })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Initial Admin User */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Initial Admin User
                                </h3>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newClinic.adminUser.firstName}
                                                onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, firstName: e.target.value } })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newClinic.adminUser.lastName}
                                                onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, lastName: e.target.value } })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admin Email</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="admin@clinic.com"
                                            value={newClinic.adminUser.email}
                                            onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, email: e.target.value } })}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={8}
                                            placeholder="Min 8 characters"
                                            value={newClinic.adminUser.password}
                                            onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, password: e.target.value } })}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? 'Provisioning Clinic...' : (
                                        <>
                                            <Database className="w-5 h-5" />
                                            Provision Database & Create Clinic
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[10px] text-slate-400 mt-3">
                                    This will create a new dedicated database schema and initial admin account.
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformAdminClinics;
