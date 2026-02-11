import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Search, Plus, Shield, Mail, Calendar, CheckCircle, XCircle, Lock, Edit2, UserPlus } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminTeam = () => {
    const navigate = useNavigate();
    const { apiCall, admin: currentAdmin } = usePlatformAdmin();
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({
        firstName: '',
        lastName: '',
        email: '',
        role: 'support'
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadTeam();
    }, []);

    const loadTeam = async () => {
        try {
            const data = await apiCall('GET', '/platform-auth/team');
            setTeam(data.team || []);
        } catch (error) {
            console.error('Failed to load team:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const response = await apiCall('POST', '/platform-auth/register', newUser);
            if (response.success) {
                setSuccess(`User ${newUser.firstName} created successfully!`);
                setShowAddModal(false);
                setNewUser({ firstName: '', lastName: '', email: '', role: 'support' });
                loadTeam();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        }
    };

    const roles = [
        { value: 'super_admin', label: 'Super Admin', desc: 'Full access to everything' },
        { value: 'support', label: 'Support', desc: 'Manage clinics & tickets' },
        { value: 'billing', label: 'Billing', desc: 'View revenue & subscriptions' },
        { value: 'it_manager', label: 'IT Manager', desc: 'System & database access' },
        { value: 'analyst', label: 'Analyst', desc: 'Read-only access to metrics' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/platform-admin/dashboard')}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-3 transition-colors text-sm font-medium group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Dashboard
                        </button>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/20">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            Team Management
                        </h1>
                        <p className="text-slate-500 text-sm mt-2 ml-14 font-medium">Manage platform administrators and their roles</p>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 rounded-xl transition-all font-bold shadow-lg shadow-purple-500/25 active:scale-[0.98]"
                    >
                        <UserPlus className="w-5 h-5" />
                        Add Team Member
                    </button>
                </div>

                {/* Team List */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Last Login</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center">
                                            <div className="flex justify-center mb-4">
                                                <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                                            </div>
                                            <p className="text-slate-400 font-medium">Loading team members...</p>
                                        </td>
                                    </tr>
                                ) : team.length > 0 ? (
                                    team.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">{user.first_name} {user.last_name}</p>
                                                        <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                    user.role === 'it_manager' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.is_active ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                                        <span className="text-xs text-emerald-600 font-bold">Active</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                                        <span className="text-xs text-slate-500 font-bold">Inactive</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center text-slate-400">
                                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                            <p className="font-medium">No team members found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Add Team Member</h2>
                                <p className="text-sm text-slate-500 font-medium">Provide access details</p>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold flex items-center gap-2">
                                <XCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAddUser} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.firstName}
                                        onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.lastName}
                                        onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-700 flex items-start gap-3">
                                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Secure Invitation Flow</p>
                                    <p className="mt-1 opacity-80">This team member will receive an email invitation to set up their own secure password. Direct password assignment is disabled for security compliance.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Role Assignment</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {roles.map((role) => (
                                        <label
                                            key={role.value}
                                            className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${newUser.role === role.value
                                                ? 'bg-purple-50 border-purple-200 shadow-sm'
                                                : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="relative flex items-center mt-0.5">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={role.value}
                                                    checked={newUser.role === role.value}
                                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                                    className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500 "
                                                />
                                            </div>
                                            <div className="ml-3">
                                                <div className={`text-sm font-bold ${newUser.role === role.value ? 'text-purple-700' : 'text-slate-700'}`}>
                                                    {role.label}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-medium">{role.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/25 transition-all mt-4 active:scale-[0.98]"
                            >
                                Create Staff Account
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformAdminTeam;
