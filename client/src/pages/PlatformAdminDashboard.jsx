import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Building2, DollarSign, Ticket, LogOut,
    TrendingUp, Users, AlertCircle, CheckCircle, Clock,
    ArrowUp, ArrowDown, Activity, Server
} from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminDashboard = () => {
    const navigate = useNavigate();
    const { logout, apiCall } = usePlatformAdmin();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-slate-600">Loading platform data...</p>
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
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Server className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Platform Admin</h1>
                                <p className="text-sm text-slate-500">System Overview</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Clinics */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-blue-600" />
                            </div>
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">{totalClinics}</h3>
                        <p className="text-sm text-slate-600 mt-1">Total Clinics</p>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="text-green-600 font-medium">{activeClinics} active</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-amber-600 font-medium">{trialClinics} trial</span>
                        </div>
                    </div>

                    {/* Monthly Revenue */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-green-600" />
                            </div>
                            <ArrowUp className="w-5 h-5 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">${monthlyRevenue.toLocaleString()}</h3>
                        <p className="text-sm text-slate-600 mt-1">This Month</p>
                        <div className="mt-3 text-xs text-slate-500">
                            {transactions} transactions
                        </div>
                    </div>

                    {/* Support Tickets */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Ticket className="w-6 h-6 text-amber-600" />
                            </div>
                            {openTickets > 0 ? (
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">{openTickets}</h3>
                        <p className="text-sm text-slate-600 mt-1">Open Tickets</p>
                        <div className="mt-3 text-xs text-slate-500">
                            {openTickets === 0 ? 'All clear!' : 'Requires attention'}
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Activity className="w-6 h-6 text-purple-600" />
                            </div>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-600">Online</h3>
                        <p className="text-sm text-slate-600 mt-1">System Status</p>
                        <div className="mt-3 text-xs text-slate-500">
                            All services operational
                        </div>
                    </div>
                </div>

                {/* Recent Clinics & Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Clinics */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            Recent Clinics
                        </h2>
                        <div className="space-y-3">
                            {dashboard?.recent_clinics?.length > 0 ? (
                                dashboard.recent_clinics.map((clinic, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                                {clinic.display_name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{clinic.display_name}</p>
                                                <p className="text-xs text-slate-500">{clinic.slug}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${clinic.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    clinic.status === 'trial' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {clinic.status}
                                            </span>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(clinic.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm text-center py-8">No recent clinics</p>
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/platform-admin/clinics')}
                            className="mt-4 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                        >
                            View All Clinics →
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <LayoutDashboard className="w-5 h-5 text-purple-600" />
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/platform-admin/clinics')}
                                className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all group"
                            >
                                <Building2 className="w-8 h-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-semibold text-slate-900">Manage Clinics</p>
                            </button>

                            <button
                                onClick={() => navigate('/platform-admin/subscriptions')}
                                className="p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg transition-all group"
                            >
                                <DollarSign className="w-8 h-8 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-semibold text-slate-900">Billing</p>
                            </button>

                            <button
                                onClick={() => navigate('/platform-admin/tickets')}
                                className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-lg transition-all group"
                            >
                                <Ticket className="w-8 h-8 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-semibold text-slate-900">Support</p>
                            </button>

                            <button
                                onClick={() => navigate('/platform-admin/onboard')}
                                className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all group"
                            >
                                <Users className="w-8 h-8 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-semibold text-slate-900">Onboard</p>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminDashboard;
