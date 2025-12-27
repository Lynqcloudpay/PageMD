import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Building2, DollarSign, Ticket, LogOut, Users, Database,
    TrendingUp, AlertCircle, CheckCircle, Activity, Server, Settings,
    BarChart3, PieChart, LineChart, Zap, Shield, Eye, Globe, Cpu, Droplets
} from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminDashboard = () => {
    const navigate = useNavigate();
    const { logout, apiCall, admin } = usePlatformAdmin();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
        const interval = setInterval(loadDashboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadDashboard = async () => {
        try {
            const data = await apiCall('GET', '/dashboard');
            setDashboard(data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/platform-admin/login');
        }
    };

    const handleNavigation = (path) => {
        navigate(path);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                        </div>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                    </div>
                    <p className="mt-6 text-blue-200/80 text-lg font-light">Initializing Command Center...</p>
                </div>
            </div>
        );
    }

    const totalClinics = dashboard?.clinics?.reduce((sum, c) => sum + parseInt(c.count), 0) || 0;
    const activeClinics = dashboard?.clinics?.find(c => c.status === 'active')?.count || 0;
    const trialClinics = dashboard?.clinics?.find(c => c.status === 'trial')?.count || 0;
    const monthlyRevenue = parseFloat(dashboard?.revenue?.total || 0);
    const transactions = dashboard?.revenue?.transactions || 0;
    const openTickets = dashboard?.support_tickets?.reduce((sum, t) => sum + parseInt(t.count), 0) || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
            {/* Liquid Glass Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Floating orbs */}
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

                {/* Liquid gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>

                {/* Glass shards */}
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-white/5 backdrop-blur-3xl rounded-full blur-2xl rotate-45 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>

            {/* Header - Frosted Glass */}
            <header className="bg-slate-900/30 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-50 shadow-2xl shadow-black/50">
                <div className="max-w-[1800px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/40 to-purple-500/40 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Shield className="w-7 h-7 text-white drop-shadow-lg" />
                                </div>
                                <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                <Droplets className="absolute -top-1 -right-1 w-4 h-4 text-cyan-400 animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-lg">
                                    Platform Command Center
                                </h1>
                                <p className="text-sm text-slate-400/80 flex items-center gap-2 font-light">
                                    <Cpu className="w-3 h-3" />
                                    Omnipotent System Control
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Live Indicator */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 backdrop-blur-xl border border-green-500/30 rounded-full shadow-lg shadow-green-500/20">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400"></div>
                                <span className="text-xs font-semibold text-green-400 tracking-wider">LIVE</span>
                            </div>

                            {/* Admin Profile - Frosted Glass */}
                            <div className="px-4 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500/60 to-purple-600/60 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-lg">
                                        <span className="text-white font-bold text-sm drop-shadow">{admin?.first_name?.[0]}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white drop-shadow">{admin?.first_name} {admin?.last_name}</p>
                                        <p className="text-xs text-slate-400 font-light">{admin?.role}</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 backdrop-blur-xl border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-full transition-all font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1800px] mx-auto px-6 py-8 relative z-10">
                {/* Stats - Liquid Glass Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <button
                        onClick={() => handleNavigation('/platform-admin/clinics')}
                        className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 hover:scale-105 transition-all duration-500 shadow-2xl hover:shadow-blue-500/30"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-xl border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                    <Building2 className="w-8 h-8 text-blue-400 drop-shadow-lg" />
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 backdrop-blur-xl rounded-full border border-green-500/30">
                                    <TrendingUp className="w-3 h-3 text-green-400" />
                                    <span className="text-xs font-bold text-green-400">+{activeClinics}</span>
                                </div>
                            </div>
                            <h3 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">{totalClinics}</h3>
                            <p className="text-sm font-medium text-slate-300 mb-3">Total Clinics</p>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-green-400 font-semibold flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400"></div>
                                    {activeClinics} Active
                                </span>
                                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full shadow-lg shadow-amber-400"></div>
                                    {trialClinics} Trial
                                </span>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/revenue')}
                        className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 hover:scale-105 transition-all duration-500 shadow-2xl hover:shadow-green-500/30"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-xl border border-green-500/30 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-8 h-8 text-green-400 drop-shadow-lg" />
                                </div>
                                <BarChart3 className="w-5 h-5 text-green-400/60" />
                            </div>
                            <h3 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">${monthlyRevenue.toLocaleString()}</h3>
                            <p className="text-sm font-medium text-slate-300 mb-3">Monthly Revenue</p>
                            <div className="text-xs text-green-400/80 font-semibold">
                                {transactions} transactions
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/support')}
                        className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 hover:scale-105 transition-all duration-500 shadow-2xl hover:shadow-amber-500/30"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${openTickets > 0 ? 'from-amber-500/20 to-orange-600/20 border-amber-500/30' : 'from-green-500/20 to-emerald-600/20 border-green-500/30'} backdrop-blur-xl border flex items-center justify-center shadow-lg ${openTickets > 0 ? 'shadow-amber-500/30' : 'shadow-green-500/30'} group-hover:scale-110 transition-transform`}>
                                    <Ticket className={`w-8 h-8 ${openTickets > 0 ? 'text-amber-400' : 'text-green-400'} drop-shadow-lg`} />
                                </div>
                                {openTickets > 0 ? (
                                    <AlertCircle className="w-5 h-5 text-amber-400 animate-pulse" />
                                ) : (
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                )}
                            </div>
                            <h3 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">{openTickets}</h3>
                            <p className="text-sm font-medium text-slate-300 mb-3">Open Tickets</p>
                            <div className={`text-xs font-semibold ${openTickets > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                                {openTickets === 0 ? '✓ All resolved' : 'Needs attention'}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/system')}
                        className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 hover:scale-105 transition-all duration-500 shadow-2xl hover:shadow-purple-500/30"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                    <Activity className="w-8 h-8 text-purple-400 drop-shadow-lg" />
                                </div>
                                <CheckCircle className="w-5 h-5 text-green-400 animate-pulse" />
                            </div>
                            <h3 className="text-5xl font-bold text-green-400 mb-2 drop-shadow-lg">100%</h3>
                            <p className="text-sm font-medium text-slate-300 mb-3">System Health</p>
                            <div className="text-xs text-green-400/80 font-semibold flex items-center gap-2">
                                <Globe className="w-3 h-3" />
                                All operational
                            </div>
                        </div>
                    </button>
                </div>

                {/* Command Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Command Center - Darker Glass */}
                    <div className="lg:col-span-2 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl flex items-center justify-center border border-yellow-500/30 shadow-lg shadow-yellow-500/20">
                                <Zap className="w-5 h-5 text-yellow-400" />
                            </div>
                            Command Center
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleNavigation('/platform-admin/clinics')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl hover:from-blue-500/20 hover:to-blue-600/10 border border-blue-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Building2 className="w-12 h-12 text-blue-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">Manage Clinics</p>
                                <p className="text-sm text-slate-400 relative z-10">View, edit, suspend</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/revenue')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-600/5 backdrop-blur-xl hover:from-green-500/20 hover:to-emerald-600/10 border border-green-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-green-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <LineChart className="w-12 h-12 text-green-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">Revenue Analytics</p>
                                <p className="text-sm text-slate-400 relative z-10">Billing & reports</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/support')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/5 backdrop-blur-xl hover:from-amber-500/20 hover:to-orange-600/10 border border-amber-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-amber-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Ticket className="w-12 h-12 text-amber-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">Support Queue</p>
                                <p className="text-sm text-slate-400 relative z-10">Manage tickets</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/team')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-600/5 backdrop-blur-xl hover:from-purple-500/20 hover:to-pink-600/10 border border-purple-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Users className="w-12 h-12 text-purple-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">Team Management</p>
                                <p className="text-sm text-slate-400 relative z-10">Users & roles</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/database')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/5 backdrop-blur-xl hover:from-cyan-500/20 hover:to-blue-600/10 border border-cyan-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Database className="w-12 h-12 text-cyan-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">Database Control</p>
                                <p className="text-sm text-slate-400 relative z-10">Monitor DBs</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/settings')}
                                className="group relative p-6 rounded-2xl bg-gradient-to-br from-slate-500/10 to-slate-600/5 backdrop-blur-xl hover:from-slate-500/20 hover:to-slate-600/10 border border-slate-500/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-slate-500/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-slate-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Settings className="w-12 h-12 text-slate-400 mb-3 group-hover:scale-110 transition-transform drop-shadow-lg relative z-10" />
                                <p className="text-lg font-bold text-white mb-1 relative z-10">System Settings</p>
                                <p className="text-sm text-slate-400 relative z-10">Configuration</p>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity - Liquid Glass */}
                    <div className="rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-400" />
                            Recent Clinics
                        </h2>
                        <div className="space-y-3">
                            {dashboard?.recent_clinics?.length > 0 ? (
                                dashboard.recent_clinics.map((clinic, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleNavigation(`/platform-admin/clinics`)}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/10 hover:bg-white/5 backdrop-blur-xl transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-xl rounded-xl flex items-center justify-center text-white font-bold shadow-lg border border-white/20">
                                                {clinic.display_name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-white text-sm drop-shadow">{clinic.display_name}</p>
                                                <p className="text-xs text-slate-400">{new Date(clinic.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full backdrop-blur-xl ${clinic.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                clinic.status === 'trial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                            }`}>
                                            {clinic.status}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-sm">No recent clinics</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Status Bar - Frosted Glass */}
                <div className="rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-5 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-blue-400" />
                                <span className="text-sm text-slate-300">API: <span className="text-green-400 font-bold">Online</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm text-slate-300">Database: <span className="text-green-400 font-bold">Connected</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-slate-300">CDN: <span className="text-green-400 font-bold">Active</span></span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">
                            Last updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminDashboard;
