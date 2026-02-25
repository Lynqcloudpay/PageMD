import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, CreditCard, BarChart3, AlertCircle, Calendar, PieChart } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminRevenue = () => {
    const navigate = useNavigate();
    const { apiCall, isAuthenticated, loading: authLoading } = usePlatformAdmin();
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState(null);

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            loadRevenueData();
        }
    }, [isAuthenticated, authLoading]);

    const loadRevenueData = async () => {
        try {
            // Try to fetch revenue data from the dashboard endpoint
            const data = await apiCall('GET', '/dashboard');
            setRevenueData(data?.revenue || { total: 0, transactions: 0 });
        } catch (error) {
            console.error('Failed to load revenue data:', error);
            setRevenueData({ total: 0, transactions: 0 });
        } finally {
            setLoading(false);
        }
    };

    // Redirect if not authenticated
    if (!authLoading && !isAuthenticated) {
        navigate('/platform-admin/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-3xl"></div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Revenue Analytics</h1>
                    <p className="text-gray-500">Track billing, subscriptions, and financial metrics</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-lg shadow-slate-200/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                        <DollarSign className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-gray-800">
                                            ${parseFloat(revenueData?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-sm text-gray-500">Monthly Revenue</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-lg shadow-slate-200/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                                        <CreditCard className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-gray-800">{revenueData?.transactions || 0}</div>
                                        <div className="text-sm text-gray-500">Transactions</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-lg shadow-slate-200/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                                        <TrendingUp className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-gray-800">$0</div>
                                        <div className="text-sm text-gray-500">Avg. Per Clinic</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-lg shadow-slate-200/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                                        <PieChart className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-gray-800">0%</div>
                                        <div className="text-sm text-gray-500">MoM Growth</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Coming Soon Section */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-12 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <BarChart3 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Revenue Dashboard Coming Soon</h2>
                            <p className="text-gray-500 max-w-lg mx-auto mb-8">
                                Detailed billing analytics, subscription management, and financial reports will be available here.
                                This feature is being developed to support Stripe integration and clinic billing.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-700">Subscription Tracking</h3>
                                    <p className="text-sm text-gray-500 mt-1">Monitor active subscriptions and renewals</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <TrendingUp className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-700">Revenue Charts</h3>
                                    <p className="text-sm text-gray-500 mt-1">Visualize revenue trends over time</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <CreditCard className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-700">Invoice History</h3>
                                    <p className="text-sm text-gray-500 mt-1">View and export transaction records</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PlatformAdminRevenue;
