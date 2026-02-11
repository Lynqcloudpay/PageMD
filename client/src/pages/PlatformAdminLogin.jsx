import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, LogIn, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminLogin = () => {
    const navigate = useNavigate();
    const { login } = usePlatformAdmin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log('Attempting login with:', email);
            await login(email, password);
            console.log('Login successful, navigating...');
            navigate('/platform-admin/dashboard');
        } catch (err) {
            console.error('Login error in component:', err);
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-200/30 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-purple-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Login Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 border border-white/80 p-8 relative overflow-hidden">
                    {/* Subtle gradient overlay */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-bl-full pointer-events-none"></div>

                    <div className="relative z-10">
                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                                <Shield className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl font-bold text-slate-800 text-center mb-2">
                            Platform Admin
                        </h1>
                        <p className="text-slate-500 text-center mb-8 text-sm">
                            PageMD IT Team Access
                        </p>

                        {/* Error */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your.email@pagemd.com"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !email || !password}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-100"
                            >
                                <LogIn className="w-5 h-5" />
                                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => navigate('/forgot-password', { state: { type: 'platform' } })}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <p className="text-center text-xs text-slate-400">
                                PageMD Platform Management System
                                <br />
                                All access is audited and logged
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformAdminLogin;
