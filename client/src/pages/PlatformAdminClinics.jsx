import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Search, Filter, Plus } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const ClinicsPage = () => {
    const navigate = useNavigate();
    const { apiCall } = usePlatformAdmin();
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="relative z-10 max-w-[1800px] mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/platform-admin/dashboard')}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">Clinic Management</h1>
                    <p className="text-slate-400">View and manage all clinics in your platform</p>
                </div>

                {/* Actions Bar */}
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search clinics..."
                            className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 backdrop-blur-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 rounded-2xl transition-all font-semibold">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-green-500/20 backdrop-blur-xl border border-green-500/30 text-green-400 hover:bg-green-500/30 rounded-2xl transition-all font-semibold">
                        <Plus className="w-4 h-4" />
                        Add Clinic
                    </button>
                </div>

                {/* Clinics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="text-slate-400 col-span-full text-center py-12">Loading clinics...</p>
                    ) : clinics.length > 0 ? (
                        clinics.map((clinic, idx) => (
                            <div key={idx} className="p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl hover:scale-105 transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
                                        <Building2 className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white">{clinic.display_name}</h3>
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
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-400 col-span-full text-center py-12">No clinics found</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClinicsPage;
