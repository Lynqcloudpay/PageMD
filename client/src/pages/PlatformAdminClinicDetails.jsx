import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Activity, CreditCard, Shield, Settings, AlertTriangle, CheckCircle, XCircle, Trash2, Key, UserX, UserCheck, Mail, Clock, ChevronRight, AlertCircle, Database, Eye, Zap } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const ClinicPersonnelManager = ({ clinicId, clinicSlug, apiCall }) => {
    const [users, setUsers] = useState([]);
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">
                <button
                    onClick={() => navigate('/platform-admin/clinics')}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors text-sm font-medium group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Clinics
                </button>

                {/* Header Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 mb-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6">
                        <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border shadow-sm ${clinic.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            clinic.status === 'suspended' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                            {clinic.status}
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start gap-8 relative z-10">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-4xl shadow-lg shadow-blue-500/25 shrink-0">
                            {clinic.display_name?.[0]}
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">{clinic.display_name}</h1>
                                <p className="text-slate-500 font-medium flex items-center gap-2">
                                    Platform Clinic Entity
                                    {clinic.plan_name && (
                                        <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest">
                                            {clinic.plan_name} Plan
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-600 font-medium" title="Clinic Slug">
                                    <Database className="w-4 h-4 text-blue-500" />
                                    <span className="font-mono text-xs">{clinic.slug}</span>
                                </span>
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-600 font-medium" title="Tenant Type">
                                    <Building2 className="w-4 h-4 text-indigo-500" />
                                    {clinic.tenant_type || 'Solo'}
                                </span>
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-600 font-medium" title="Compliance Zone">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    {Array.isArray(clinic.compliance_zones) && clinic.compliance_zones.length > 0 ? clinic.compliance_zones.join(', ') : 'HIPAA (Default)'}
                                </span>
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-600 font-medium" title="EMR Version">
                                    <Zap className="w-4 h-4 text-orange-500" />
                                    v{clinic.emr_version || '1.0.0'}
                                </span>
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-600 font-medium" title="Go-Live Date">
                                    <Activity className="w-4 h-4 text-slate-400" />
                                    Go-Live: {clinic.go_live_date ? new Date(clinic.go_live_date).toLocaleDateString() : 'TBD'}
                                </span>
                                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-400 font-medium">
                                    <Clock className="w-4 h-4" />
                                    Provisioned {new Date(clinic.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Clinic Personnel */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-500" />
                                    Authorized Personnel
                                </h2>
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">Users & Roles</span>
                            </div>
                            <ClinicPersonnelManager clinicId={id} clinicSlug={clinic.slug} apiCall={apiCall} />
                        </div>

                        {/* Role Governance (New Phase 2 Section) */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <Shield className="w-6 h-6 text-indigo-500" />
                                    Role Governance
                                </h2>
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">Template Drift</span>
                            </div>
                            <DriftManager clinicId={id} apiCall={apiCall} />
                        </div>

                        {/* Platform Audit Trail */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-slate-500/10 transition-colors"></div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <Activity className="w-6 h-6 text-slate-400" />
                                    Platform Audit Trail
                                </h2>
                                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Critical Events</span>
                            </div>
                            <PlatformAuditTrail clinicId={id} apiCall={apiCall} />
                        </div>

                        {/* Onboarding & Integration Setup (New Section) */}
                        <div id="setup" className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-lg shadow-slate-200/40 relative overflow-hidden group scroll-mt-8">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-1">
                                        <Zap className="w-7 h-7 text-indigo-500" />
                                        Clinic Onboarding & Integrations
                                    </h2>
                                    <p className="text-slate-500 text-sm font-medium">Tenant-safe technical setup for clinical operations</p>
                                </div>
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Setup Wizard</span>
                            </div>
                            <ClinicOnboardingManager tenantId={clinic.slug} apiCall={apiCall} />
                        </div>

                        {/* Metrics & Activity */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" />
                                Recent Activity
                            </h2>
                            {usage && usage.length > 0 ? (
                                <div className="space-y-3">
                                    {usage.map((metric, i) => (
                                        <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-blue-100 hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <Activity className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-medium text-slate-700">System Event</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400">{new Date(metric.metric_date).toLocaleDateString()}</div>
                                                <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1">{JSON.stringify(metric.details)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm font-medium">No recent activity recorded.</p>
                                </div>
                            )}
                        </div>

                        {/* Payment History */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-500" />
                                Billing History
                            </h2>
                            {recent_payments && recent_payments.length > 0 ? (
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-100">
                                            <th className="pb-3 pl-4 font-semibold">Date</th>
                                            <th className="pb-3 font-semibold">Amount</th>
                                            <th className="pb-3 pr-4 text-right font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recent_payments.map((payment, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-4 pl-4 text-slate-600">{new Date(payment.created_at).toLocaleDateString()}</td>
                                                <td className="py-4 text-slate-900 font-bold">${payment.amount}</td>
                                                <td className="py-4 pr-4 text-right">
                                                    <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider ${payment.status === 'succeeded' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                                        }`}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm font-medium">No payment history available.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-slate-400" />
                                Actions
                            </h2>
                            <div className="space-y-3">
                                {clinic.status !== 'active' && (
                                    <button
                                        disabled={statusUpdating || deleting}
                                        onClick={() => handleStatusChange('active')}
                                        className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Activate Clinic
                                    </button>
                                )}

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Shield className="w-3.5 h-3.5" />
                                        Kill Switches
                                    </h3>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Read-Only Mode</span>
                                        <button
                                            onClick={() => handleControlChange({ is_read_only: !clinic.is_read_only })}
                                            disabled={controlsUpdating}
                                            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out ${clinic.is_read_only ? 'bg-red-500 shadow-inner' : 'bg-slate-300'}`}
                                        >
                                            <div
                                                className="w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out"
                                                style={{ transform: clinic.is_read_only ? 'translateX(1.5rem)' : 'translateX(0)' }}
                                            ></div>
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Lock Billing</span>
                                        <button
                                            onClick={() => handleControlChange({ billing_locked: !clinic.billing_locked })}
                                            disabled={controlsUpdating}
                                            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out ${clinic.billing_locked ? 'bg-amber-500 shadow-inner' : 'bg-slate-300'}`}
                                        >
                                            <div
                                                className="w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out"
                                                style={{ transform: clinic.billing_locked ? 'translateX(1.5rem)' : 'translateX(0)' }}
                                            ></div>
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Lock Prescribing</span>
                                        <button
                                            onClick={() => handleControlChange({ prescribing_locked: !clinic.prescribing_locked })}
                                            disabled={controlsUpdating}
                                            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out ${clinic.prescribing_locked ? 'bg-purple-500 shadow-inner' : 'bg-slate-300'}`}
                                        >
                                            <div
                                                className="w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out"
                                                style={{ transform: clinic.prescribing_locked ? 'translateX(1.5rem)' : 'translateX(0)' }}
                                            ></div>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic">Changes take effect immediately for all users.</p>
                                </div>

                                <ClinicFeatureManager
                                    clinicId={id}
                                    currentFeatures={clinic.enabled_features}
                                    apiCall={apiCall}
                                    onUpdate={loadClinic}
                                />

                                <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-4">
                                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Settings className="w-3.5 h-3.5" />
                                        Platform Configuration
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">EMR Version</label>
                                        <select
                                            value={clinic.emr_version || '1.0.0'}
                                            onChange={(e) => handleControlChange({ emr_version: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                        >
                                            <option value="1.0.0">v1.0.0 (Legacy)</option>
                                            <option value="2.0.0">v2.0.0 (Current)</option>
                                            <option value="2.1.0-alpha">v2.1.0-alpha</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tenant Type</label>
                                        <select
                                            value={clinic.tenant_type || 'Solo'}
                                            onChange={(e) => handleControlChange({ tenant_type: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                        >
                                            <option value="Solo">Solo Practice</option>
                                            <option value="Group">Group Practice</option>
                                            <option value="Enterprise">Enterprise</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Compliance Zones</label>
                                        <input
                                            type="text"
                                            placeholder="HIPAA, GDPR, etc."
                                            defaultValue={Array.isArray(clinic.compliance_zones) ? clinic.compliance_zones.join(', ') : clinic.compliance_zones}
                                            onBlur={(e) => {
                                                const zones = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                                handleControlChange({ compliance_zones: zones });
                                            }}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Go-Live Date</label>
                                        <input
                                            type="date"
                                            value={clinic.go_live_date ? new Date(clinic.go_live_date).toISOString().split('T')[0] : ''}
                                            onChange={(e) => handleControlChange({ go_live_date: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                {clinic.status !== 'suspended' && (
                                    <button
                                        disabled={statusUpdating || deleting}
                                        onClick={() => handleStatusChange('suspended')}
                                        className="w-full flex items-center justify-center gap-2 p-4 bg-white border border-amber-200 hover:bg-amber-50 rounded-xl text-amber-600 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <AlertTriangle className="w-5 h-5" />
                                        Suspend Clinic
                                    </button>
                                )}

                                {clinic.status !== 'deactivated' && (
                                    <button
                                        disabled={statusUpdating || deleting}
                                        onClick={() => handleStatusChange('deactivated')}
                                        className="w-full flex items-center justify-center gap-2 p-4 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <XCircle className="w-5 h-5" />
                                        Deactivate
                                    </button>
                                )}

                                <div className="pt-6 mt-6 border-t border-slate-100">
                                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                                        <h3 className="text-xs font-black text-red-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Danger Zone
                                        </h3>
                                        <p className="text-[10px] text-red-700/70 mb-4 leading-relaxed">
                                            Deleting a clinic is irreversible. All data including patient records will be permanently destroyed.
                                        </p>
                                        <button
                                            disabled={statusUpdating || deleting}
                                            onClick={handleDeleteClinic}
                                            className="w-full flex items-center justify-center gap-2 p-3 bg-red-100 hover:bg-red-200 border border-red-200 rounded-xl text-red-600 text-sm font-bold transition-all duration-200"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {deleting ? 'Deleting...' : 'Permanently Delete'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg shadow-slate-200/40">
                            <h2 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-wider">
                                Contact Information
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Email Address</p>
                                        <p className="text-sm font-semibold text-slate-700 break-all">{clinic.contact_email || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-500 shrink-0">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Phone Number</p>
                                        <p className="text-sm font-semibold text-slate-700">{clinic.contact_phone || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">EMR Version</p>
                                        <select
                                            value={clinic.emr_version}
                                            onChange={(e) => handleControlChange({ emr_version: e.target.value })}
                                            className="text-xs font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                                        >
                                            <option value="1.0.0">1.0.0 (Stable)</option>
                                            <option value="1.1.0-beta">1.1.0 (Beta)</option>
                                            <option value="2.0.0">2.0.0 (Next Gen)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Tenant Type</p>
                                        <select
                                            value={clinic.tenant_type}
                                            onChange={(e) => handleControlChange({ tenant_type: e.target.value })}
                                            className="text-xs font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                                        >
                                            <option value="Solo">Solo Practice</option>
                                            <option value="Group">Group Practice</option>
                                            <option value="Enterprise">Enterprise</option>
                                        </select>
                                    </div>
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
