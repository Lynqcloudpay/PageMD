import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Search, Filter, Plus, XCircle, Database, Mail, Lock, Shield } from 'lucide-react';
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
            dbName: '',  // will be auto-generated from slug
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
            // Structure payload for /api/super/clinics/onboard
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
                    dbName: `emr_${newClinic.slug.replace(/-/g, '_')}` // Auto-generate DB name
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1800px] mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/platform-admin/dashboard')}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-white mb-2">Clinic Management</h1>
                    <p className="text-slate-400">Add, manage, and monitor all clinics on the platform</p>
                </div>

                {/* Actions Bar */}
                <div className="mb-6 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[300px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search clinics..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    {/* <button className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 backdrop-blur-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 rounded-2xl transition-all font-semibold">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button> */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-green-500/20 backdrop-blur-xl border border-green-500/30 text-green-400 hover:bg-green-500/30 rounded-2xl transition-all font-semibold shadow-lg shadow-green-500/10"
                    >
                        <Plus className="w-4 h-4" />
                        Onboard Clinic
                    </button>
                </div>

                {/* Clinics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="text-slate-400 col-span-full text-center py-12">Loading clinics...</p>
                    ) : filteredClinics.length > 0 ? (
                        filteredClinics.map((clinic, idx) => (
                            <button
                                key={idx}
                                onClick={() => navigate(`/platform-admin/clinics/${clinic.id}`)}
                                className="w-full text-left p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl hover:scale-105 transition-all group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                                        <Building2 className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors">{clinic.display_name}</h3>
                                        <p className="text-sm text-slate-400">{clinic.slug}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Status:</span>
                                        <span className={`font-semibold ${clinic.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                                            {clinic.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Specialty:</span>
                                        <span className="text-white">{clinic.specialty || 'N/A'}</span>
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <p className="text-slate-400 col-span-full text-center py-12">No clinics found</p>
                    )}
                </div>
            </div>

            {/* Add Clinic Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-8 relative my-8">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Plus className="w-6 h-6 text-green-400" />
                            Onboard New Clinic
                        </h2>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-200 text-sm font-medium">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleCreateClinic} className="space-y-8">
                            {/* Clinic Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Clinic Details
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Heart Center of Nevada"
                                            value={newClinic.displayName}
                                            onChange={e => setNewClinic({ ...newClinic, displayName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Slug (Subdomain)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. heat-center-nv"
                                            value={newClinic.slug}
                                            onChange={handleSlugChange}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Unique URL identifier (auto-formatted)</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Specialty</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Cardiology"
                                            value={newClinic.details.specialty}
                                            onChange={e => setNewClinic({ ...newClinic, details: { ...newClinic.details, specialty: e.target.value } })}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Initial Admin User */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Initial Admin User
                                </h3>
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newClinic.adminUser.firstName}
                                                onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, firstName: e.target.value } })}
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newClinic.adminUser.lastName}
                                                onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, lastName: e.target.value } })}
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Admin Email</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="admin@clinic.com"
                                            value={newClinic.adminUser.email}
                                            onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, email: e.target.value } })}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Temporary Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={8}
                                            placeholder="Min 8 characters"
                                            value={newClinic.adminUser.password}
                                            onChange={e => setNewClinic({ ...newClinic, adminUser: { ...newClinic.adminUser, password: e.target.value } })}
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? 'Provisioning Clinic...' : (
                                        <>
                                            <Database className="w-5 h-5" />
                                            Provision Database & Create Clinic
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[10px] text-slate-500 mt-3">
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
