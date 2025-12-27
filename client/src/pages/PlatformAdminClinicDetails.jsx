import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Activity, CreditCard, Shield, Settings, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminClinicDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { apiCall } = usePlatformAdmin();
    const [clinicData, setClinicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        loadClinic();
    }, [id]);

    const loadClinic = async () => {
        try {
            const data = await apiCall('GET', `/clinics/${id}`);
            setClinicData(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load clinic details');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

        setStatusUpdating(true);
        try {
            await apiCall('PATCH', `/clinics/${id}/status`, { status: newStatus });
            loadClinic(); // Reload data
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status');
        } finally {
            setStatusUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center text-white">
                    <p className="text-xl mb-4">{error}</p>
                    <button onClick={() => navigate('/platform-admin/clinics')} className="text-blue-400 hover:underline">
                        Return to Clinics
                    </button>
                </div>
            </div>
        );
    }

    const { clinic, usage, recent_payments } = clinicData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1200px] mx-auto px-4 py-6">
                <button
                    onClick={() => navigate('/platform-admin/clinics')}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Clinics
                </button>

                {/* Header Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 mb-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${clinic.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                clinic.status === 'suspended' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                    'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }`}>
                            {clinic.status}
                        </span>
                    </div>

                    <div className="flex items-start gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center text-white font-bold text-3xl border border-white/10 shadow-lg">
                            {clinic.display_name?.[0]}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{clinic.display_name}</h1>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                                    <Shield className="w-3.5 h-3.5" />
                                    ID: {clinic.slug}
                                </span>
                                <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {clinic.address || 'No address provided'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Usage Metrics */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-400" />
                                Recent Activity
                            </h2>
                            {usage && usage.length > 0 ? (
                                <div className="space-y-3">
                                    {usage.map((metric, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                            <span className="text-sm text-slate-300">{new Date(metric.metric_date).toLocaleDateString()}</span>
                                            <span className="text-sm font-mono text-blue-300">{JSON.stringify(metric.details)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm italic">No recent activity recorded.</p>
                            )}
                        </div>

                        {/* Payment History */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-green-400" />
                                Billing History
                            </h2>
                            {recent_payments && recent_payments.length > 0 ? (
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-white/10">
                                            <th className="pb-2">Date</th>
                                            <th className="pb-2">Amount</th>
                                            <th className="pb-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {recent_payments.map((payment, i) => (
                                            <tr key={i}>
                                                <td className="py-3 text-slate-300">{new Date(payment.created_at).toLocaleDateString()}</td>
                                                <td className="py-3 text-white font-medium">${payment.amount}</td>
                                                <td className="py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${payment.status === 'succeeded' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                                        }`}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-slate-500 text-sm italic">No payment history available.</p>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-slate-400" />
                                Actions
                            </h2>
                            <div className="space-y-3">
                                {clinic.status !== 'active' && (
                                    <button
                                        disabled={statusUpdating}
                                        onClick={() => handleStatusChange('active')}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Activate Clinic
                                    </button>
                                )}

                                {clinic.status !== 'suspended' && (
                                    <button
                                        disabled={statusUpdating}
                                        onClick={() => handleStatusChange('suspended')}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        Suspend Clinic
                                    </button>
                                )}

                                {clinic.status !== 'deactivated' && (
                                    <button
                                        disabled={statusUpdating}
                                        onClick={() => handleStatusChange('deactivated')}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-red-900/50 border border-red-500/30 hover:bg-red-900/80 rounded-lg text-red-300 font-medium transition-colors disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Deactivate
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                            <h2 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                Contact Info
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="text-slate-500 text-xs">Email</p>
                                    <p className="text-blue-400">{clinic.contact_email || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Phone</p>
                                    <p className="text-slate-300">{clinic.contact_phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Created At</p>
                                    <p className="text-slate-300">{new Date(clinic.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformAdminClinicDetails;
