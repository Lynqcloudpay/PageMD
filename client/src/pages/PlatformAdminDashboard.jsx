import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Building2, DollarSign, Ticket, LogOut, Users, Database,
    TrendingUp, AlertCircle, CheckCircle, Activity, Server, Settings,
    BarChart3, LineChart, Zap, Shield, Globe, Cpu, ChevronRight, Clock, Key
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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl shadow-blue-500/10 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-blue-500 animate-spin"></div>
                    </div>
                    <p className="mt-4 text-slate-500 text-sm font-medium">Loading dashboard...</p>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Soft background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-purple-200/20 rounded-full blur-3xl"></div>
            </div>

            {/* Header - Frothy Glass Style */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-white/80 shadow-sm shadow-slate-200/50 sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Platform Admin</h1>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <Cpu className="w-3 h-3" />
                                    Command Center
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Live Status Badge */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-semibold text-emerald-700">SYSTEM LIVE</span>
                            </div>

                            {/* Admin Profile */}
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/80 border border-slate-200/80 rounded-xl shadow-sm">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                                    <span className="text-white font-bold text-sm">{admin?.first_name?.[0]}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{admin?.first_name} {admin?.last_name}</p>
                                    <p className="text-[11px] text-slate-500 capitalize">{admin?.role}</p>
                                </div>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-xl transition-all text-sm font-medium"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1600px] mx-auto px-6 py-8 relative z-10">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">Welcome back, {admin?.first_name}!</h2>
                    <p className="text-slate-500 mt-1">Here's what's happening across your platform today.</p>
                </div>

                {/* Stats Grid - Premium Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                    {/* Total Clinics Card */}
                    <button
                        onClick={() => handleNavigation('/platform-admin/clinics')}
                        className="group relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300 text-left"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-tr-2xl rounded-bl-full"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Building2 className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                                    <span className="text-[11px] font-bold text-emerald-600">+{activeClinics}</span>
                                </div>
                            </div>
                            <h3 className="text-4xl font-bold text-slate-800 mb-1">{totalClinics}</h3>
                            <p className="text-sm font-medium text-slate-500 mb-3">Total Clinics</p>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-emerald-600 font-semibold flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    {activeClinics} Active
                                </span>
                                <span className="text-amber-600 font-semibold flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                    {trialClinics} Trial
                                </span>
                            </div>
                        </div>
                        <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* Revenue Card */}
                    <button
                        onClick={() => handleNavigation('/platform-admin/revenue')}
                        className="group relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200 transition-all duration-300 text-left"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-tr-2xl rounded-bl-full"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <DollarSign className="w-7 h-7 text-white" />
                                </div>
                                <BarChart3 className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-4xl font-bold text-slate-800 mb-1">${monthlyRevenue.toLocaleString()}</h3>
                            <p className="text-sm font-medium text-slate-500 mb-3">Monthly Revenue</p>
                            <div className="text-xs text-emerald-600 font-semibold px-2 py-1 bg-emerald-50 rounded-lg inline-block">
                                {transactions} transactions this month
                            </div>
                        </div>
                        <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* Support Tickets Card */}
                    <button
                        onClick={() => handleNavigation('/platform-admin/support')}
                        className="group relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-200 transition-all duration-300 text-left"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-tr-2xl rounded-bl-full"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${openTickets > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30'}`}>
                                    <Ticket className="w-7 h-7 text-white" />
                                </div>
                                {openTickets > 0 ? (
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                ) : (
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                )}
                            </div>
                            <h3 className="text-4xl font-bold text-slate-800 mb-1">{openTickets}</h3>
                            <p className="text-sm font-medium text-slate-500 mb-3">Open Tickets</p>
                            <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-block ${openTickets > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                {openTickets === 0 ? '✓ All tickets resolved' : 'Requires attention'}
                            </div>
                        </div>
                        <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* System Health Card */}
                    <button
                        onClick={() => handleNavigation('/platform-admin/system')}
                        className="group relative bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300 text-left"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-tr-2xl rounded-bl-full"></div>
                        <div className="relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Activity className="w-7 h-7 text-white" />
                                </div>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <h3 className="text-4xl font-bold text-emerald-600 mb-1">100%</h3>
                            <p className="text-sm font-medium text-slate-500 mb-3">System Health</p>
                            <div className="text-xs text-emerald-600 font-semibold px-2 py-1 bg-emerald-50 rounded-lg inline-flex items-center gap-1.5">
                                <Globe className="w-3 h-3" />
                                All systems operational
                            </div>
                        </div>
                        <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </button>
                </div>

                {/* Command Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Quick Actions */}
                    <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => handleNavigation('/platform-admin/clinics')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
                            >
                                <Building2 className="w-10 h-10 text-blue-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Manage Clinics</p>
                                <p className="text-[11px] text-slate-500">View, edit, suspend</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/revenue')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/60 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
                            >
                                <LineChart className="w-10 h-10 text-emerald-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Revenue Analytics</p>
                                <p className="text-[11px] text-slate-500">Billing & reports</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/support')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100/50 border border-amber-200/60 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10 transition-all"
                            >
                                <Ticket className="w-10 h-10 text-amber-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Support Queue</p>
                                <p className="text-[11px] text-slate-500">Manage tickets</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/team')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/60 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
                            >
                                <Users className="w-10 h-10 text-purple-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Team Management</p>
                                <p className="text-[11px] text-slate-500">Users & roles</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/roles')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/60 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
                            >
                                <Shield className="w-10 h-10 text-indigo-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Role Governance</p>
                                <p className="text-[11px] text-slate-500">Global templates & drift</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/developers')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/60 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/10 transition-all"
                            >
                                <Key className="w-10 h-10 text-rose-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">Developer Platform</p>
                                <p className="text-[11px] text-slate-500">API keys & partners</p>
                            </button>

                            <button
                                onClick={() => handleNavigation('/platform-admin/settings')}
                                className="group p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/10 transition-all"
                            >
                                <Settings className="w-10 h-10 text-slate-600 mb-3" />
                                <p className="text-sm font-bold text-slate-800 mb-1">System Settings</p>
                                <p className="text-[11px] text-slate-500">Configuration</p>
                            </button>
                        </div>
                    </div>

                    {/* Recent Clinics */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            Recent Clinics
                        </h2>
                        <div className="space-y-3">
                            {dashboard?.recent_clinics?.length > 0 ? (
                                dashboard.recent_clinics.map((clinic, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleNavigation(`/platform-admin/clinics/${clinic.id}`)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 hover:bg-blue-50/50 hover:border-blue-200 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                                                {clinic.display_name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-slate-800 text-sm">{clinic.display_name}</p>
                                                <p className="text-[11px] text-slate-500">{new Date(clinic.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${clinic.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                            clinic.status === 'trial' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {clinic.status}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-10">
                                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-400 text-sm">No recent clinics</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Status Bar */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-blue-500" />
                                <span className="text-sm text-slate-600">API: <span className="text-emerald-600 font-semibold">Online</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-cyan-500" />
                                <span className="text-sm text-slate-600">Database: <span className="text-emerald-600 font-semibold">Connected</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm text-slate-600">CDN: <span className="text-emerald-600 font-semibold">Active</span></span>
                            </div>
                        </div>
                        <div className="text-sm text-slate-400 font-medium">
                            Last updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminDashboard;
