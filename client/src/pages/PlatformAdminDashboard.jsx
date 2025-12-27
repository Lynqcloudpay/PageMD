import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Building2, DollarSign, Ticket, LogOut, Users, Database,
    TrendingUp, AlertCircle, CheckCircle, Activity, Server, Settings,
    BarChart3, LineChart, Zap, Shield, Globe, Cpu, Droplets
} from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminDashboard = () => {
    const navigate = useNavigate();
    const { logout, apiCall, admin, isAuthenticated } = usePlatformAdmin();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated && !loading) {
            navigate('/platform-admin/login');
            return;
        }

        if (isAuthenticated) {
            loadDashboard();
            const interval = setInterval(loadDashboard, 30000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, loading]);

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
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/60 animate-spin"></div>
                    </div>
                    <p className="mt-4 text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    };

    const totalClinics = dashboard?.clinics?.reduce((sum, c) => sum + parseInt(c.count), 0) || 0;
    const activeClinics = dashboard?.clinics?.find(c => c.status === 'active')?.count || 0;
    const trialClinics = dashboard?.clinics?.find(c => c.status === 'trial')?.count || 0;
    const monthlyRevenue = parseFloat(dashboard?.revenue?.total || 0);
    const transactions = dashboard?.revenue?.transactions || 0;
    const openTickets = dashboard?.support_tickets?.reduce((sum, t) => sum + parseInt(t.count), 0) || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            {/* Subtle background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3"></div>
            </div>

            {/* Header - Compact */}
            <header className="bg-slate-900/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-[1800px] mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-white/90" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">Platform Command Center</h1>
                                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <Cpu className="w-2.5 h-2.5" />
                                    System Control
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 backdrop-blur-xl border border-green-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                <span className="text-xs font-medium text-green-400">LIVE</span>
                            </div>

                            <div className="px-3 py-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500/40 to-purple-600/40 rounded-lg flex items-center justify-center border border-white/10">
                                        <span className="text-white font-semibold text-xs">{admin?.first_name?.[0]}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-white">{admin?.first_name} {admin?.last_name}</p>
                                        <p className="text-[10px] text-slate-400">{admin?.role}</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 backdrop-blur-xl border border-red-500/20 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors text-sm font-medium"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - Compact */}
            <main className="max-w-[1800px] mx-auto px-4 py-4 relative z-10">
                {/* Stats Grid - Compact */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <button
                        onClick={() => handleNavigation('/platform-admin/clinics')}
                        className="group rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 hover:bg-white/8 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-600/15 border border-blue-500/20 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/15 rounded border border-green-500/20">
                                <TrendingUp className="w-2.5 h-2.5 text-green-400" />
                                <span className="text-[10px] font-semibold text-green-400">+{activeClinics}</span>
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">{totalClinics}</h3>
                        <p className="text-xs font-medium text-slate-300 mb-2">Total Clinics</p>
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-green-400 font-medium flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                {activeClinics} Active
                            </span>
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                                {trialClinics} Trial
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/revenue')}
                        className="group rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 hover:bg-white/8 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-green-400" />
                            </div>
                            <BarChart3 className="w-4 h-4 text-green-400/50" />
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">${monthlyRevenue.toLocaleString()}</h3>
                        <p className="text-xs font-medium text-slate-300 mb-2">Monthly Revenue</p>
                        <div className="text-[10px] text-green-400/70 font-medium">
                            {transactions} transactions
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/support')}
                        className="group rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 hover:bg-white/8 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${openTickets > 0 ? 'from-amber-500/15 to-orange-600/15 border-amber-500/20' : 'from-green-500/15 to-emerald-600/15 border-green-500/20'} border flex items-center justify-center`}>
                                <Ticket className={`w-5 h-5 ${openTickets > 0 ? 'text-amber-400' : 'text-green-400'}`} />
                            </div>
                            {openTickets > 0 ? (
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">{openTickets}</h3>
                        <p className="text-xs font-medium text-slate-300 mb-2">Open Tickets</p>
                        <div className={`text-[10px] font-medium ${openTickets > 0 ? 'text-amber-400/70' : 'text-green-400/70'}`}>
                            {openTickets === 0 ? '✓ All resolved' : 'Needs attention'}
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation('/platform-admin/system')}
                        className="group rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 hover:bg-white/8 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500/15 to-pink-600/15 border border-purple-500/20 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-purple-400" />
                            </div>
                            <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        <h3 className="text-3xl font-bold text-green-400 mb-1">100%</h3>
                        <p className="text-xs font-medium text-slate-300 mb-2">System Health</p>
                        <div className="text-[10px] text-green-400/70 font-medium flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            All operational
                        </div>
                    </button>
                </div>

                {/* Command Grid - Compact */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                    <div className="lg:col-span-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
                        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-yellow-400" />
                            </div>
                            Command Center
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleNavigation('/platform-admin/clinics')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-blue-500/8 to-blue-600/5 border border-blue-500/15 hover:from-blue-500/15 hover:to-blue-600/10 transition-all"
                            >
                                <Building2 className="w-8 h-8 text-blue-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">Manage Clinics</p>
                                <p className="text-[10px] text-slate-400">View, edit, suspend</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/revenue')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-green-500/8 to-emerald-600/5 border border-green-500/15 hover:from-green-500/15 hover:to-emerald-600/10 transition-all"
                            >
                                <LineChart className="w-8 h-8 text-green-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">Revenue Analytics</p>
                                <p className="text-[10px] text-slate-400">Billing & reports</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/support')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-amber-500/8 to-orange-600/5 border border-amber-500/15 hover:from-amber-500/15 hover:to-orange-600/10 transition-all"
                            >
                                <Ticket className="w-8 h-8 text-amber-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">Support Queue</p>
                                <p className="text-[10px] text-slate-400">Manage tickets</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/team')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-purple-500/8 to-pink-600/5 border border-purple-500/15 hover:from-purple-500/15 hover:to-pink-600/10 transition-all"
                            >
                                <Users className="w-8 h-8 text-purple-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">Team Management</p>
                                <p className="text-[10px] text-slate-400">Users & roles</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/database')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-cyan-500/8 to-blue-600/5 border border-cyan-500/15 hover:from-cyan-500/15 hover:to-blue-600/10 transition-all"
                            >
                                <Database className="w-8 h-8 text-cyan-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">Database Control</p>
                                <p className="text-[10px] text-slate-400">Monitor DBs</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/settings')}
                                className="group p-3 rounded-lg bg-gradient-to-br from-slate-500/8 to-slate-600/5 border border-slate-500/15 hover:from-slate-500/15 hover:to-slate-600/10 transition-all"
                            >
                                <Settings className="w-8 h-8 text-slate-400 mb-2" />
                                <p className="text-sm font-semibold text-white mb-0.5">System Settings</p>
                                <p className="text-[10px] text-slate-400">Configuration</p>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity - Compact */}
                    <div className="rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
                        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            Recent Clinics
                        </h2>
                        <div className="space-y-2">
                            {dashboard?.recent_clinics?.length > 0 ? (
                                dashboard.recent_clinics.map((clinic, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleNavigation(`/platform-admin/clinics/${clinic.id}`)}
                                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center text-white font-semibold text-xs border border-white/10">
                                                {clinic.display_name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium text-white text-xs">{clinic.display_name}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(clinic.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${clinic.status === 'active' ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                                            clinic.status === 'trial' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                                                'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                                            }`}>
                                            {clinic.status}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-center text-slate-400 py-6 text-xs">No recent clinics</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Status Bar - Compact */}
                <div className="rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <Server className="w-3 h-3 text-blue-400" />
                                <span className="text-xs text-slate-300">API: <span className="text-green-400 font-medium">Online</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Database className="w-3 h-3 text-cyan-400" />
                                <span className="text-xs text-slate-300">Database: <span className="text-green-400 font-medium">Connected</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-purple-400" />
                                <span className="text-xs text-slate-300">CDN: <span className="text-green-400 font-medium">Active</span></span>
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-500">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </main >
        </div >
    );
};

export default PlatformAdminDashboard;
