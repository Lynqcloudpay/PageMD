import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Save, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminProfile = () => {
    const navigate = useNavigate();
    const { apiCall, admin } = usePlatformAdmin();
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const getPasswordRequirements = () => {
        return [
            { label: '12+ Characters', met: passwords.new.length >= 12 },
            { label: 'Uppercase Letter', met: /[A-Z]/.test(passwords.new) },
            { label: 'Lowercase Letter', met: /[a-z]/.test(passwords.new) },
            { label: 'Number', met: /[0-9]/.test(passwords.new) },
            { label: 'Special Character', met: /[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(passwords.new) },
            { label: 'Passwords Match', met: passwords.new.length > 0 && passwords.new === passwords.confirm }
        ];
    };

    const validatePassword = () => {
        const reqs = getPasswordRequirements();
        return reqs.filter(r => !r.met).map(r => r.label);
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        const passErrors = validatePassword();
        if (passErrors.length > 0) {
            setMessage({ type: 'error', text: `Missing requirements: ${passErrors.join(', ')}` });
            return;
        }

        setLoading(true);
        try {
            await apiCall('POST', '/platform-auth/change-password', {
                currentPassword: passwords.current,
                newPassword: passwords.new
            });
            setMessage({ type: 'success', text: 'Password updated successfully' });
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update password' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-1/4 w-[400px] h-[400px] bg-purple-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[800px] mx-auto px-6 py-8">
                <button
                    onClick={() => navigate('/platform-admin/dashboard')}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors text-sm font-medium group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboard
                </button>

                <div className="grid gap-8">
                    {/* Profile Info */}
                    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <User className="w-5 h-5 text-blue-600" />
                            </div>
                            My Profile
                        </h2>

                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-blue-500/25">
                                {admin?.first_name?.[0]}{admin?.last_name?.[0]}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{admin?.first_name} {admin?.last_name}</h3>
                                <p className="text-slate-500 font-medium">{admin?.email}</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-600 font-bold uppercase tracking-wider shadow-sm">
                                        {admin?.role?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Lock className="w-5 h-5 text-purple-600" />
                            </div>
                            Change Password
                        </h2>

                        {message.text && (
                            <div className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 border ${message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdatePassword} className="space-y-5 max-w-md">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.current}
                                    onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder-slate-400"
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={passwords.new}
                                    onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder-slate-400"
                                    placeholder="Enter new password"
                                />

                                <div className="mt-3 grid grid-cols-1 gap-2 p-3 bg-slate-100/50 rounded-xl border border-slate-200/50">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {getPasswordRequirements().map((req, idx) => (
                                            <div key={idx} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight transition-colors duration-200 ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${req.met ? 'bg-emerald-500 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
                                                {req.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.confirm}
                                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder-slate-400"
                                    placeholder="Repeat new password"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Update Password
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformAdminProfile;
