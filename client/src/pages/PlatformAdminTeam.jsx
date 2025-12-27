import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Search, Plus, Shield, Mail, Calendar, CheckCircle, XCircle, Lock, Edit2 } from 'lucide-react';
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
        password: '',
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
                setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'support' });
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1200px] mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button
                            onClick={() => navigate('/platform-admin/dashboard')}
                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-2 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-purple-400" />
                            Team Management
                        </h1>
                        <p className="text-slate-400 text-sm">Manage platform administrators and their roles</p>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 backdrop-blur-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 rounded-lg transition-all font-semibold text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Team Member
                    </button>
                </div>

                {/* Team List */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Login</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                                    <th className="p-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-400">Loading team...</td>
                                    </tr>
                                ) : team.length > 0 ? (
                                    team.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-600/20 flex items-center justify-center text-white font-semibold text-sm border border-white/10">
                                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{user.first_name} {user.last_name}</p>
                                                        <p className="text-xs text-slate-400">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border ${user.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                        user.role === 'it_manager' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                            'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                                    }`}>
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {user.is_active ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                                        <span className="text-xs text-green-400 font-medium">Active</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                                        <span className="text-xs text-slate-500 font-medium">Inactive</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-slate-400">
                                                {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="p-4 text-xs text-slate-400">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-400">No team members found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-purple-400" />
                            Add Team Member
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.firstName}
                                        onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.lastName}
                                        onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Must be at least 8 characters</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                                <div className="grid gap-2">
                                    {roles.map((role) => (
                                        <label
                                            key={role.value}
                                            className={`flex items-start p-2 rounded-lg border cursor-pointer transition-all ${newUser.role === role.value
                                                    ? 'bg-purple-500/20 border-purple-500/50'
                                                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                value={role.value}
                                                checked={newUser.role === role.value}
                                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                                className="mt-1 mr-2"
                                            />
                                            <div>
                                                <div className={`text-sm font-medium ${newUser.role === role.value ? 'text-white' : 'text-slate-300'}`}>
                                                    {role.label}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{role.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-sm transition-colors mt-4"
                            >
                                Create User
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformAdminTeam;
