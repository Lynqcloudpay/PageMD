import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Activity, CreditCard, Shield, Settings, AlertTriangle, CheckCircle, XCircle, Trash2, Key, UserX, UserCheck, Mail, Clock, ChevronRight, AlertCircle, Database, Eye, Zap, Users, TrendingUp, X } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const ClinicPersonnelManager = ({ clinicId, clinicSlug, apiCall, users, setUsers }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, [clinicId]);

    const loadUsers = async () => {
        try {
            const data = await apiCall('GET', `/clinics/${clinicId}/users`);
            setUsers(data);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (user) => {
        const generatePassword = () => {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
            let pass = "";
            for (let i = 0; i < 12; i++) {
                pass += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return pass;
        };

        const suggestedPassword = generatePassword();
        const newPassword = prompt(`Enter a new temporary password for ${user.email} (min 8 chars):`, suggestedPassword);

        if (!newPassword) return; // Users cancelled

        if (newPassword.length < 8) {
            alert("Password must be at least 8 characters.");
            return;
        }

        try {
            await apiCall('POST', `/clinics/${clinicId}/users/${user.id}/reset-password`, { newPassword });
            alert(`Password reset successfully for ${user.email}.\n\nPASSWORD: ${newPassword}\n\nPlease copy this password now.`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reset password');
        }
    };

    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        if (!confirm(`Are you sure you want to set user ${user.email} to ${newStatus}?`)) return;

        try {
            await apiCall('PATCH', `/clinics/${clinicId}/users/${user.id}/status`, { status: newStatus });
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleImpersonate = async (user) => {
        const reason = prompt(`Enter reason for "Break Glass" impersonation of ${user.first_name} ${user.last_name}:`);
        if (!reason) return;

        try {
            const { token } = await apiCall('POST', `/clinics/${clinicId}/impersonate`, { userId: user.id, reason });

            // Redirect to clinic impersonation endpoint
            // In a real multi-tenant setup, this might be a different subdomain
            // For now, we'll try to use a standardized route
            const impersonateUrl = `/auth/impersonate?token=${token}&slug=${clinicSlug}`;
            window.open(impersonateUrl, '_blank');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to initiate impersonation');
        }
    };

    if (loading) return <div className="text-slate-400 text-sm animate-pulse">Loading personnel...</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-slate-400 border-b border-slate-100 uppercase text-[10px] tracking-widest bg-slate-50/50">
                    <tr>
                        <th className="px-4 py-3 font-semibold rounded-tl-lg">User / Role</th>
                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Last Login</th>
                        <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                        <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic">No users found in this clinical schema.</td></tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="text-slate-800 font-bold flex items-center gap-2">
                                            {user.first_name} {user.last_name}
                                            {user.is_admin && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200 uppercase font-bold tracking-wide">Admin</span>}
                                        </span>
                                        <span className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                                            <Mail className="w-3 h-3" />
                                            {user.email}
                                        </span>
                                        <span className="text-slate-400 text-[10px] mt-1 uppercase tracking-wider">{user.role_display_name || user.role}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wide border ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'
                                        }`}>
                                        {user.status || 'active'}
                                    </span>
                                </td>
                                <td className="p-4 text-right text-slate-500 text-xs font-mono">
                                    {user.last_login ? (
                                        <span className="flex items-center justify-end gap-1.5">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {new Date(user.last_login).toLocaleDateString()}
                                        </span>
                                    ) : 'Never'}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            title="Impersonate User (Break Glass)"
                                            onClick={() => handleImpersonate(user)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-orange-500 hover:border-orange-200 hover:shadow-sm transition-all"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            title="Reset Password"
                                            onClick={() => handleResetPassword(user)}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-200 hover:shadow-sm transition-all"
                                        >
                                            <Key className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            title={user.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                                            onClick={() => handleToggleStatus(user)}
                                            className={`p-2 rounded-lg bg-white border border-slate-200 transition-all hover:shadow-sm ${user.status === 'active' ? 'text-slate-500 hover:text-red-500 hover:border-red-200' : 'text-slate-500 hover:text-green-500 hover:border-green-200'
                                                }`}
                                        >
                                            {user.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};


const DriftManager = ({ clinicId, apiCall }) => {
    const [drift, setDrift] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(null);

    useEffect(() => {
        loadDrift();
    }, [clinicId]);

    const loadDrift = async () => {
        try {
            const data = await apiCall('GET', `/clinics/${clinicId}/governance/drift`);
            setDrift(data.drift);
        } catch (err) {
            console.error('Failed to load drift:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to load permission drift from server';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (roleKey) => {
        if (!confirm(`Are you sure you want to FORCE SYNC the ${roleKey} role? This will overwrite clinic-level customizations to match global standards.`)) return;

        setSyncing(roleKey);
        try {
            await apiCall('POST', `/clinics/${clinicId}/governance/sync`, { roleKey });
            await loadDrift();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to sync role');
        } finally {
            setSyncing(null);
        }
    };

    if (loading) return <div className="text-slate-400 text-sm animate-pulse p-4">Auditing permission schemas...</div>;

    return (
        <div className="space-y-4">
            {drift.map((report) => (
                <div key={report.roleKey} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${report.status === 'SYNCED' ? 'bg-emerald-100 text-emerald-600' :
                                report.status === 'DRIFTED' ? 'bg-orange-100 text-orange-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    {report.displayName}
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black tracking-tighter ${report.status === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-500' :
                                        report.status === 'DRIFTED' ? 'bg-orange-500/10 text-orange-500' :
                                            'bg-red-500/10 text-red-500'
                                        }`}>
                                        {report.status}
                                    </span>
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                    {report.status === 'SYNCED' && 'Matches Platform Gold Standard'}
                                    {report.status === 'DRIFTED' && `${report.missingPrivileges.length} Missing, ${report.extraPrivileges.length} Extra, ${report.unknownPrivileges?.length || 0} Unknown`}
                                    {report.status === 'MISSING' && 'Role missing from clinical schema'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => handleSync(report.roleKey)}
                            disabled={syncing === report.roleKey || report.status === 'SYNCED'}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${report.status === 'SYNCED' ? 'bg-emerald-50 text-emerald-600 cursor-default' :
                                'bg-white border border-slate-200 text-slate-700 hover:border-indigo-500 hover:text-indigo-600 shadow-sm'
                                }`}
                        >
                            {syncing === report.roleKey ? 'Syncing...' : report.status === 'SYNCED' ? 'Standardized' : 'Force Sync'}
                        </button>
                    </div>

                    {report.status === 'DRIFTED' && (
                        <div className="mt-4 pl-14 text-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.missingPrivileges.length > 0 && (
                                <div className="p-3 bg-white rounded-xl border border-dashed border-emerald-200">
                                    <span className="font-bold text-emerald-600 flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        Capabilities to be ADDED
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {report.missingPrivileges.map(p => (
                                            <span key={p} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-100 font-mono text-[10px] font-semibold">
                                                +{p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {report.extraPrivileges.length > 0 && (
                                <div className="p-3 bg-white rounded-xl border border-dashed border-amber-200">
                                    <span className="font-bold text-amber-600 flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                        Capabilities to be REMOVED (Extra)
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {report.extraPrivileges.map(p => (
                                            <span key={p} className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-100 font-mono text-[10px] font-semibold line-through opacity-70">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};


const ClinicGrowthOverview = ({ growth, billing }) => {
    if (!growth && !billing) return null;

    const { ghostSeats, referrals } = growth || { ghostSeats: 0, referrals: [] };
    const {
        physicalSeats = 1,
        totalBillingSeats = 1,
        currentTier = 'Solo',
        marginalRate = 399,
        avgRatePerSeat = 399,
        totalMonthly = 399,
        tiers = []
    } = billing || {};

    return (
        <div className="space-y-6">
            {/* Billing Tier Summary */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10">
                    <Zap className="w-32 h-32 -mr-10 -mt-10" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Current Billing Tier</p>
                            <p className="text-3xl font-black">{currentTier}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Monthly Total</p>
                            <p className="text-3xl font-black">${totalMonthly.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Math Breakdown Tooltip/Section */}
                    <div className="mb-4 p-3 bg-white/10 rounded-xl border border-white/20 space-y-2">
                        <p className="text-[9px] font-black text-indigo-100 uppercase tracking-widest">Average Cost Equation</p>
                        <div className="flex flex-col gap-1 text-[11px] font-medium text-white/90">
                            <div className="flex justify-between">
                                <span>Virtual Total ({totalBillingSeats} seats)</span>
                                <span>${(billing?.virtualTotal || totalMonthly).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Effective Rate</span>
                                <span>${(avgRatePerSeat).toFixed(2)}/MD</span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-white/20 flex justify-between font-black">
                                <span>{physicalSeats} MDs × ${avgRatePerSeat.toFixed(2)}</span>
                                <span>${totalMonthly.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
                        <div className="text-center">
                            <p className="text-2xl font-black">{physicalSeats}</p>
                            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Physical</p>
                        </div>
                        <div className="text-center border-x border-white/20">
                            <p className="text-2xl font-black">{ghostSeats}</p>
                            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Ghost</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-black">{totalBillingSeats}</p>
                            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Total Seats</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tier Breakdown */}
            {tiers.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Tier Breakdown</p>
                    <div className="space-y-2">
                        {tiers.map((tier, i) => {
                            const isActive = tier.name === currentTier;
                            return (
                                <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-all ${isActive ? 'bg-indigo-100 border border-indigo-200' : 'opacity-50'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                                        <span className={`text-xs font-bold ${isActive ? 'text-indigo-700' : 'text-slate-400'}`}>{tier.name}</span>
                                        <span className="text-[10px] text-slate-400">({tier.min === tier.max ? tier.min : `${tier.min}-${tier.max}`} seats)</span>
                                    </div>
                                    <span className={`text-xs font-black ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>${tier.rate}/seat</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Referrals Table */}
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3">Referred Clinic / Email</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-right">Referral Link Used</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {referrals?.length > 0 ? referrals.map((ref, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-800">{ref.referred_clinic_name || 'Prospect'}</div>
                                    <div className="text-slate-400 text-[10px]">{ref.referral_email}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${ref.status === 'active' ? 'bg-emerald-100 text-emerald-600' :
                                        ref.status === 'churned' ? 'bg-amber-100 text-amber-600' :
                                            'bg-slate-100 text-slate-400'
                                        }`}>
                                        {ref.status}
                                        {ref.status === 'churned' && ref.grace_period_expires_at && (
                                            <span className="ml-1 text-[8px] opacity-70">
                                                (Grace until {new Date(ref.grace_period_expires_at).toLocaleDateString()})
                                            </span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400 font-mono">
                                    {new Date(ref.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400 italic">No referral data recorded.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const ClinicOnboardingManager = ({ tenantId, apiCall }) => {
    const [setupData, setSetupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showFaxModal, setShowFaxModal] = useState(false);
    const [showLabModal, setShowLabModal] = useState(false);
    const [newFax, setNewFax] = useState({ phoneNumber: '', label: '' });
    const [newLab, setNewLab] = useState({ labName: '', facilityId: '', accountNumber: '', status: 'pending' });

    useEffect(() => {
        loadSetupData();
    }, [tenantId]);

    const loadSetupData = async () => {
        try {
            const data = await apiCall('GET', `/clinic-setup/${tenantId}`);
            setSetupData(data);
        } catch (err) {
            console.error('Failed to load setup data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleChecklist = async (field, value) => {
        try {
            await apiCall('PUT', `/clinic-setup/${tenantId}`, { [field]: value });
            loadSetupData();
        } catch (err) {
            alert('Failed to update setup step');
        }
    };

    const handleAddFax = async () => {
        if (!newFax.phoneNumber) return;
        setActionLoading(true);
        try {
            await apiCall('POST', `/clinic-setup/${tenantId}/fax`, newFax);
            setShowFaxModal(false);
            setNewFax({ phoneNumber: '', label: '' });
            loadSetupData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add fax number');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddLab = async () => {
        if (!newLab.labName) return;
        setActionLoading(true);
        try {
            await apiCall('POST', `/clinic-setup/${tenantId}/lab`, newLab);
            setShowLabModal(false);
            setNewLab({ labName: '', facilityId: '', accountNumber: '', status: 'pending' });
            loadSetupData();
        } catch (err) {
            alert('Failed to add lab interface');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteFax = async (faxId) => {
        if (!confirm('Are you sure you want to remove this fax number?')) return;
        try {
            await apiCall('DELETE', `/clinic-setup/${tenantId}/fax/${faxId}`);
            loadSetupData();
        } catch (err) {
            alert('Failed to delete fax number');
        }
    };

    if (loading) return <div className="text-slate-400 text-sm animate-pulse p-4">Loading onboarding status...</div>;
    if (!setupData) return null;

    const { checklist, faxNumbers, labInterfaces, completionPercent } = setupData;

    const steps = [
        { key: 'basic_info_complete', label: 'Basic Clinic Info', icon: Building2 },
        { key: 'users_created', label: 'Admin User Created', icon: Shield },
        { key: 'fax_configured', label: 'eFax Number Configured', icon: Activity },
        { key: 'quest_configured', label: 'Quest Lab Interface', icon: Database },
        { key: 'labcorp_configured', label: 'LabCorp Interface', icon: Database },
        { key: 'patient_portal_enabled', label: 'Patient Portal Enabled', icon: Key },
        { key: 'billing_configured', label: 'Billing System Linked', icon: CreditCard },
    ];

    return (
        <div className="space-y-6">
            {/* Completion Progress */}
            <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                            Onboarding Progress
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-indigo-600">
                            {completionPercent}%
                        </span>
                    </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-indigo-100">
                    <div style={{ width: `${completionPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"></div>
                </div>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {steps.map((step) => {
                    const isComplete = checklist[step.key];
                    const Icon = step.icon;
                    return (
                        <div key={step.key} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${isComplete ? 'text-emerald-800' : 'text-slate-600'}`}>{step.label}</h4>
                                    <p className="text-[10px] text-slate-400">{isComplete ? `Completed ${new Date(checklist[step.key.replace('_complete', '_date').replace('_configured', '_date').replace('_enabled', '_date')]).toLocaleDateString()}` : 'Pending setup'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggleChecklist(step.key, !isComplete)}
                                className={`p-2 rounded-lg transition-all ${isComplete ? 'text-emerald-500 hover:bg-emerald-100' : 'text-slate-300 hover:bg-slate-100'}`}
                            >
                                <CheckCircle className={`w-6 h-6 ${isComplete ? 'fill-emerald-500 text-white' : ''}`} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Integration Details Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                {/* Fax Numbers */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            Registered Fax Numbers
                        </h3>
                        <button onClick={() => setShowFaxModal(true)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors">
                            + Add Number
                        </button>
                    </div>
                    {faxNumbers.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                            No fax numbers assigned yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {faxNumbers.map(fax => (
                                <div key={fax.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="text-indigo-500 bg-indigo-50 p-2 rounded-lg">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{fax.phone_number}</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase">{fax.label || 'Direct Inward Dialing'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteFax(fax.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lab Interfaces */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-500" />
                            Lab Integrations (HL7)
                        </h3>
                        <button onClick={() => setShowLabModal(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors">
                            + Add Link
                        </button>
                    </div>
                    {labInterfaces.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                            No lab interfaces configured.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {labInterfaces.map(lab => (
                                <div key={lab.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${lab.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                            <span className="text-xs font-bold text-slate-800">{lab.lab_name}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${lab.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                                            {lab.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="text-slate-500">Facility ID: <span className="font-mono text-slate-800">{lab.facility_id || 'N/A'}</span></div>
                                        <div className="text-slate-500 text-right">Acct: <span className="font-mono text-slate-800">{lab.account_number || 'N/A'}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals - Simplified for MVP */}
            {showFaxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-white">
                        <h3 className="text-xl font-black text-slate-800 mb-6">Assign Fax Number</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="+1 555 000 0000"
                                    value={newFax.phoneNumber}
                                    onChange={(e) => setNewFax({ ...newFax, phoneNumber: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Internal Label</label>
                                <input
                                    type="text"
                                    placeholder="Main Intake"
                                    value={newFax.label}
                                    onChange={(e) => setNewFax({ ...newFax, label: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowFaxModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                            <button
                                disabled={actionLoading}
                                onClick={handleAddFax}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Assign Number'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLabModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-white">
                        <h3 className="text-xl font-black text-slate-800 mb-6">Link Lab Interface</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lab Provider</label>
                                <select
                                    value={newLab.labName}
                                    onChange={(e) => setNewLab({ ...newLab, labName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                                >
                                    <option value="">Select Lab...</option>
                                    <option value="Quest Diagnostics">Quest Diagnostics</option>
                                    <option value="LabCorp">LabCorp</option>
                                    <option value="Other">Other Hospital/Lab</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Facility Identifier (MSH-4)</label>
                                <input
                                    type="text"
                                    placeholder="QUEST_FL_123"
                                    value={newLab.facilityId}
                                    onChange={(e) => setNewLab({ ...newLab, facilityId: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-mono outline-none focus:border-blue-500 transition-all"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 pl-1">ID used in HL7 messages to route to this tenant</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lab Account #</label>
                                <input
                                    type="text"
                                    placeholder="ACCT-8822"
                                    value={newLab.accountNumber}
                                    onChange={(e) => setNewLab({ ...newLab, accountNumber: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowLabModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                            <button
                                disabled={actionLoading}
                                onClick={handleAddLab}
                                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Link Interface'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClinicFeatureManager = ({ clinicId, currentFeatures, apiCall, onUpdate }) => {
    const [updating, setUpdating] = useState(false);

    const toggleFeature = async (featureKey) => {
        setUpdating(true);
        try {
            const updated = { [featureKey]: !currentFeatures[featureKey] };
            await apiCall('PATCH', `/clinics/${clinicId}/features`, { features: updated });
            onUpdate();
        } catch (err) {
            alert('Failed to update feature');
        } finally {
            setUpdating(false);
        }
    };

    const features = [
        { key: 'efax', label: 'eFax Integration', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { key: 'labs', label: 'Lab Integration (HL7)', icon: Database, color: 'text-blue-500', bg: 'bg-blue-50' },
        { key: 'telehealth', label: 'Telehealth (Video)', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
        { key: 'eprescribe', label: 'e-Prescribing', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-50' },
    ];

    return (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    Feature Management
                </h3>
                {updating && <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>}
            </div>
            {features.map((f) => (
                <div key={f.key} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${f.bg} ${f.color} group-hover:scale-110 transition-transform`}>
                            <f.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{f.label}</span>
                    </div>
                    <button
                        onClick={() => toggleFeature(f.key)}
                        disabled={updating}
                        className={`w-11 h-5.5 rounded-full p-1 transition-all duration-300 ease-in-out ${currentFeatures?.[f.key] ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-slate-300'}`}
                    >
                        <div
                            className="w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out"
                            style={{ transform: currentFeatures?.[f.key] ? 'translateX(1.375rem)' : 'translateX(0)' }}
                        ></div>
                    </button>
                </div>
            ))}
            <p className="text-[10px] text-slate-400 italic mt-2 leading-tight">These toggles control access to specific clinical integrations regardless of subscription tier.</p>
        </div>
    );
};

const PlatformAuditTrail = ({ clinicId, apiCall }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, [clinicId]);

    const loadLogs = async () => {
        try {
            const data = await apiCall('GET', `/clinics/${clinicId}/audit-logs`);
            setLogs(data);
        } catch (err) {
            console.error('Failed to load clinic audit logs:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to fetch platform audit logs';
            setLogs([]); // Clear logs on error
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-slate-400 text-sm animate-pulse p-4">Fetching audit trail...</div>;

    return (
        <div className="space-y-3">
            {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-sm">No platform audit logs found for this clinic.</div>
            ) : (
                logs.map((log) => (
                    <div key={log.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-start gap-3 text-xs">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.action.includes('sync') ? 'bg-blue-50 text-blue-600' :
                            log.action.includes('impersonation') ? 'bg-orange-50 text-orange-600' :
                                'bg-slate-50 text-slate-600'
                            }`}>
                            <Activity className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-slate-800 uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <div className="text-slate-500 font-mono truncate bg-slate-50 p-1 rounded">
                                {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};


const ClinicDunningLog = ({ clinicId, apiCall }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await apiCall('GET', `/clinics/${clinicId}/billing`);
                setLogs(data.dunningLogs || []);
            } catch (err) {
                console.error('Failed to load dunning logs:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [clinicId]);

    if (loading) return <div className="text-slate-400 text-xs animate-pulse p-3">Loading logs...</div>;

    return (
        <>
            {selectedEmail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedEmail(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">{selectedEmail.subject}</h3>
                                <p className="text-xs text-slate-500">Sent to: {selectedEmail.recipient}</p>
                            </div>
                            <button onClick={() => setSelectedEmail(null)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-4 h-4 text-slate-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                        </div>
                    </div>
                </div>
            )}

            <table className="w-full text-[11px]">
                <thead>
                    <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                        <th className="px-3 py-2 text-left font-medium">Timestamp</th>
                        <th className="px-3 py-2 text-left font-medium">Event</th>
                        <th className="px-3 py-2 text-center font-medium">Phases</th>
                        <th className="px-3 py-2 text-left font-medium">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {logs.length > 0 ? logs.map((log) => {
                        let detailsObj = log.details;
                        if (typeof log.details === 'string') {
                            try { detailsObj = JSON.parse(log.details); } catch (e) { detailsObj = { raw: log.details }; }
                        }

                        const isEmail = log.event_type === 'email_sent';
                        const subject = detailsObj?.subject;
                        const bodyHtml = detailsObj?.body_html;
                        const recipient = detailsObj?.recipient;

                        const detailText = isEmail ? (subject || 'Email Sent') : (detailsObj?.message || detailsObj?.reason || (detailsObj ? JSON.stringify(detailsObj) : 'No details'));
                        const triggeredBy = detailsObj?.triggered_by || 'System';

                        return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap align-top">
                                    <div className="font-medium text-slate-700">
                                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-[9px] text-slate-400">
                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </td>
                                <td className="px-3 py-3 align-top">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${log.event_type === 'email_sent' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                        log.event_type === 'phase_escalated' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                            log.event_type === 'payment_failed' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}>
                                        {log.event_type.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center align-top">
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-600 bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">
                                        <span className="text-slate-400">P{log.previous_phase}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className={log.current_phase > log.previous_phase ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                                            P{log.current_phase}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-slate-600 text-[10px] leading-relaxed align-top">
                                    <div className="font-medium text-slate-800 mb-0.5 flex items-center gap-2">
                                        {detailText}
                                        {isEmail && bodyHtml && (
                                            <button
                                                onClick={() => setSelectedEmail({ subject, body_html: bodyHtml, recipient })}
                                                className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors uppercase font-bold"
                                            >
                                                View
                                            </button>
                                        )}
                                    </div>
                                    {isEmail && recipient && (
                                        <div className="text-[9px] text-slate-400">To: {recipient}</div>
                                    )}
                                    {triggeredBy && !isEmail && (
                                        <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            Triggered by: <span className="font-semibold text-slate-500">{triggeredBy}</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr><td colSpan="4" className="px-3 py-4 text-center text-slate-400 italic text-[10px]">No logs recorded.</td></tr>
                    )}
                </tbody>
            </table>
        </>
    );
};

const ClinicBillingStatus = ({ clinicId, apiCall }) => {
    const [billing, setBilling] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBilling();
    }, [clinicId]);

    const loadBilling = async () => {
        try {
            const data = await apiCall('GET', `/clinics/${clinicId}/billing`);
            setBilling(data);
        } catch (err) {
            console.error('Failed to load billing:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-slate-400 text-xs animate-pulse p-3">Loading billing...</div>;
    if (!billing || !billing.clinic) return <div className="text-[10px] text-slate-400 italic p-4 text-center">No subscription metadata found for this clinic.</div>;

    const { clinic, totals } = billing;
    const isActive = clinic.stripe_subscription_status === 'active';

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors",
                clinic.billing_grace_phase === 1 ? "bg-amber-50 text-amber-600 border-amber-100" :
                    clinic.billing_grace_phase === 2 ? "bg-orange-50 text-orange-600 border-orange-100" :
                        (clinic.billing_grace_phase === 3 || clinic.status === 'suspended') ? "bg-red-50 text-red-600 border-red-100" :
                            isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                "bg-slate-50 text-slate-500 border-slate-100"
            )}>
                <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    clinic.billing_grace_phase === 1 ? "bg-amber-400" :
                        clinic.billing_grace_phase === 2 ? "bg-orange-400" :
                            (clinic.billing_grace_phase === 3 || clinic.status === 'suspended') ? "bg-red-400" :
                                isActive ? "bg-emerald-400" :
                                    "bg-slate-300"
                )} />
                {clinic.billing_grace_phase === 1 ? 'Grace Period' :
                    clinic.billing_grace_phase === 2 ? 'Read-Only' :
                        (clinic.billing_grace_phase === 3 || clinic.status === 'suspended') ? 'Suspended' :
                            isActive ? 'Active' : clinic.stripe_subscription_status || 'None'}
            </span>

            <span className="text-xs text-slate-500">
                Revenue: <span className="font-semibold text-slate-700">${totals.totalRevenueDollars}</span>
            </span>

            <span className="text-xs text-slate-400">·</span>

            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Dunning Override:</span>
                <button
                    onClick={async () => {
                        if (!confirm(`Are you sure you want to ${clinic.billing_manual_override ? 'DISABLE' : 'ENABLE'} manual override? This will ${clinic.billing_manual_override ? 'RE-ENABLE' : 'BYPASS'} automated lockout for this clinic.`)) return;
                        try {
                            await apiCall('PATCH', `/clinics/${clinicId}/controls`, { billing_manual_override: !clinic.billing_manual_override });
                            loadBilling();
                        } catch (err) { alert('Failed to update override'); }
                    }}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border transition-colors ${clinic.billing_manual_override ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                    {clinic.billing_manual_override ? 'ON' : 'OFF'}
                </button>
            </div>

            {clinic.billing_grace_start_at && (
                <>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                        Grace Started: {new Date(clinic.billing_grace_start_at).toLocaleDateString()}
                    </span>
                </>
            )}
        </div>
    );
};

const CollapsibleCard = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-indigo-500" />}
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h2>
                    {badge && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold ml-2">{badge}</span>}
                </div>
                <div className={`p-1.5 rounded-lg border border-slate-100 bg-white transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                </div>
            </button>
            {isOpen && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="h-px bg-slate-50 mb-6 -mx-6" />
                    {children}
                </div>
            )}
        </div>
    );
};

const PlatformAdminClinicDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { apiCall } = usePlatformAdmin();
    const [clinicData, setClinicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [controlsUpdating, setControlsUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [impersonating, setImpersonating] = useState(false);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        loadClinic();
    }, [id]);

    const loadClinic = async () => {
        try {
            const [data, usersData] = await Promise.all([
                apiCall('GET', `/clinics/${id}`),
                apiCall('GET', `/clinics/${id}/users`)
            ]);
            setClinicData(data);
            setUsers(usersData);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load clinic details');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClinic = async () => {
        const confirm1 = confirm("⚠️ WARNING: This will PERMANENTLY DELETE the clinic and ALL of its clinical data (patients, visits, etc.). This cannot be undone.");
        if (!confirm1) return;

        const confirm2 = prompt(`To confirm deletion, type the clinic name "${clinicData.clinic.display_name}" below:`);
        if (confirm2 !== clinicData.clinic.display_name) {
            alert("Name mismatch. Deletion cancelled.");
            return;
        }

        setDeleting(true);
        try {
            await apiCall('DELETE', `/clinics/${id}`);
            alert("Clinic successfully deleted.");
            navigate('/platform-admin/clinics');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete clinic');
            setDeleting(false);
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

    const handleControlChange = async (update) => {
        setControlsUpdating(true);
        try {
            await apiCall('PATCH', `/clinics/${id}/controls`, update);
            loadClinic(); // Reload data
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update controls');
        } finally {
            setControlsUpdating(false);
        }
    };

    const handleMasterTakeover = async () => {
        const reason = prompt('Reason for clinic-wide takeover (required for audit):');
        if (!reason) return;

        setImpersonating(true);
        try {
            const { impersonateUrl } = await apiCall('POST', `/clinics/${id}/impersonate`, { reason });
            window.open(impersonateUrl, '_blank');
        } catch (err) {
            alert(err.response?.data?.error || 'Takeover failed');
        } finally {
            setImpersonating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center text-slate-800">
                    <p className="text-xl mb-4 font-bold">{error}</p>
                    <button onClick={() => navigate('/platform-admin/clinics')} className="text-blue-500 hover:underline">
                        Return to Clinics
                    </button>
                </div>
            </div>
        );
    }

    const { clinic, usage, recent_payments } = clinicData;

    const sections = [
        { id: 'overview', label: 'Overview', icon: Building2 },
        { id: 'personnel', label: 'Personnel', icon: Users },
        { id: 'billing', label: 'Billing & Dunning', icon: CreditCard },
        { id: 'governance', label: 'Governance & Audit', icon: Shield },
        { id: 'integrations', label: 'Onboarding & Integrations', icon: Zap },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
            {/* High-Density Sidebar */}
            <aside className="w-full lg:w-64 bg-white border-r border-slate-200 shrink-0 lg:h-screen lg:sticky lg:top-0 transition-all duration-300">
                <div className="p-6">
                    <button
                        onClick={() => navigate('/platform-admin/clinics')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-8 transition-colors text-xs font-semibold group uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        Back to List
                    </button>

                    <div className="space-y-1">
                        {sections.map((sec) => (
                            <button
                                key={sec.id}
                                onClick={() => setActiveTab(sec.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === sec.id
                                    ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <sec.icon className={`w-4 h-4 ${activeTab === sec.id ? 'text-indigo-500' : ''}`} />
                                {sec.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-auto p-6 border-t border-slate-50">
                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 mb-4">
                        <h3 className="text-[10px] font-black text-red-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Danger Zone
                        </h3>
                        <button
                            disabled={deleting}
                            onClick={handleDeleteClinic}
                            className="w-full text-left text-[10px] text-red-600 font-bold hover:underline"
                        >
                            {deleting ? 'Deleting...' : 'Delete Clinic'}
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono text-center">v{clinic.emr_version} • {clinic.slug}</p>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 h-screen overflow-y-auto scroll-smooth">
                {/* Header Strip */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                            {clinic.logo_url ? (
                                <img src={clinic.logo_url} className="w-full h-full rounded-xl object-cover" />
                            ) : clinic.display_name?.[0]}
                        </div>
                        <div>
                            <h1 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                                {clinic.display_name}
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border transition-colors",
                                    clinic.billing_grace_phase === 1 ? "bg-amber-50 text-amber-600 border-amber-100" :
                                        clinic.billing_grace_phase === 2 ? "bg-orange-50 text-orange-600 border-orange-100" :
                                            (clinic.billing_grace_phase === 3 || clinic.status === 'suspended') ? "bg-red-50 text-red-600 border-red-100" :
                                                clinic.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                    "bg-slate-50 text-slate-500 border-slate-100"
                                )}>
                                    {clinic.billing_grace_phase === 1 ? 'Grace Period' :
                                        clinic.billing_grace_phase === 2 ? 'Read-Only' :
                                            (clinic.billing_grace_phase === 3 || clinic.status === 'suspended') ? 'Suspended' :
                                                clinic.status}
                                </span>
                            </h1>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none mt-1">
                                {clinic.slug} • {clinicData?.billing?.currentTier || 'Solo'} Tier
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleMasterTakeover}
                            disabled={impersonating}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            <Zap className={`w-3.5 h-3.5 ${impersonating ? 'animate-pulse' : ''}`} />
                            {impersonating ? 'Preparing...' : 'Platform Takeover'}
                        </button>
                        <div className="h-8 w-px bg-slate-100 hidden md:block" />
                        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-100">
                            {[
                                { status: 'active', icon: CheckCircle, color: 'text-emerald-500' },
                                { status: 'suspended', icon: AlertTriangle, color: 'text-amber-500' },
                                { status: 'deactivated', icon: XCircle, color: 'text-slate-400' }
                            ].map((s) => (
                                <button
                                    key={s.status}
                                    onClick={() => handleStatusChange(s.status)}
                                    disabled={statusUpdating || clinic.status === s.status}
                                    className={`p-1.5 rounded-md transition-all ${clinic.status === s.status ? 'bg-white shadow-sm ring-1 ring-slate-200/50' : 'opacity-40 hover:opacity-100'}`}
                                    title={`Set as ${s.status}`}
                                >
                                    <s.icon className={`w-3.5 h-3.5 ${clinic.status === s.status ? s.color : 'text-slate-400'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="p-8 pb-20">
                    <div className="max-w-5xl mx-auto">
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="lg:col-span-2 space-y-2">
                                    <CollapsibleCard title="Growth & Referrals" icon={TrendingUp} defaultOpen={true}>
                                        <ClinicGrowthOverview growth={clinicData.growth} billing={clinicData.billing} />
                                    </CollapsibleCard>
                                    <CollapsibleCard title="Onboarding Checklist" icon={Zap} defaultOpen={false}>
                                        <ClinicOnboardingManager tenantId={clinic.slug} apiCall={apiCall} />
                                    </CollapsibleCard>
                                </div>
                                <div className="space-y-6">
                                    <ClinicFeatureManager clinicId={id} currentFeatures={clinic.enabled_features} apiCall={apiCall} onUpdate={loadClinic} />
                                    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Clinic Entity Meta</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Schema (Tenant ID)</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={clinic.slug}
                                                        readOnly
                                                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-500"
                                                    />
                                                    <button onClick={() => navigator.clipboard.writeText(clinic.slug)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <Key className="w-3.5 h-3.5 text-slate-400" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Go-Live Date</label>
                                                <input
                                                    type="date"
                                                    value={clinic.go_live_date ? new Date(clinic.go_live_date).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleControlChange({ go_live_date: e.target.value })}
                                                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-indigo-600 outline-none focus:ring-2 ring-indigo-500/20"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'personnel' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CollapsibleCard title="Clinical Personnel" icon={Users} badge={`${users?.length || 0} Registered`}>
                                    <ClinicPersonnelManager clinicId={id} clinicSlug={clinic.slug} apiCall={apiCall} users={users} setUsers={setUsers} />
                                </CollapsibleCard>
                            </div>
                        )}

                        {activeTab === 'billing' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CollapsibleCard title="Subscription Status" icon={CreditCard}>
                                    <ClinicBillingStatus clinicId={id} apiCall={apiCall} />
                                </CollapsibleCard>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <CollapsibleCard title="Payment History" icon={Clock} defaultOpen={true}>
                                        <div className="space-y-2">
                                            {recent_payments?.map((payment, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">${payment.amount}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{new Date(payment.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${payment.status === 'succeeded' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                        {payment.status}
                                                    </span>
                                                </div>
                                            ))}
                                            {(!recent_payments || recent_payments.length === 0) && <p className="text-xs text-slate-400 italic text-center py-4">No payment history.</p>}
                                        </div>
                                    </CollapsibleCard>

                                    <CollapsibleCard title="Automated Dunning Logs" icon={Activity} defaultOpen={true}>
                                        <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            <ClinicDunningLog clinicId={id} apiCall={apiCall} />
                                        </div>
                                    </CollapsibleCard>
                                </div>
                            </div>
                        )}

                        {activeTab === 'governance' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CollapsibleCard title="Role Governance & Drift" icon={Shield}>
                                    <DriftManager clinicId={id} apiCall={apiCall} />
                                </CollapsibleCard>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <CollapsibleCard title="Clinical Safety Kill-Switches" icon={AlertCircle}>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Read-Only Mode', key: 'is_read_only', color: 'bg-red-500', desc: 'Disables writes in tenant schema' },
                                                { label: 'Lock Billing', key: 'billing_locked', color: 'bg-amber-500', desc: 'Prevents automated plan updates' },
                                                { label: 'Lock Prescribing', key: 'prescribing_locked', color: 'bg-indigo-500', desc: 'Disables DoseSpot API' }
                                            ].map((sw) => (
                                                <div key={sw.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:border-slate-200">
                                                    <div>
                                                        <span className="text-xs font-black text-slate-700 block">{sw.label}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{sw.desc}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleControlChange({ [sw.key]: !clinic[sw.key] })}
                                                        disabled={controlsUpdating}
                                                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${clinic[sw.key] ? sw.color : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${clinic[sw.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleCard>

                                    <CollapsibleCard title="Platform Level Audit" icon={Activity} defaultOpen={false}>
                                        <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            <PlatformAuditTrail clinicId={id} apiCall={apiCall} />
                                        </div>
                                    </CollapsibleCard>
                                </div>
                            </div>
                        )}

                        {activeTab === 'integrations' && (
                            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-8">
                                    <Zap className="w-4 h-4 text-orange-500" />
                                    Integration Pipeline
                                </h2>
                                <ClinicOnboardingManager tenantId={clinic.slug} apiCall={apiCall} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminClinicDetails;
