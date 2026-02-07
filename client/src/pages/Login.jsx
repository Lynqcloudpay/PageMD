import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LogIn, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import tokenManager from '../services/tokenManager';
import { InteractiveHoverButton } from '../components/ui/InteractiveHoverButton';
import loginBg from '../assets/login-bg.png';

const Login = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Safety check
    if (!auth) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500 animate-pulse">Loading secure environment...</div>
            </div>
        );
    }

    const { login, user } = auth;

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(email, password);
            console.log('Login successful, result:', result);

            // Verify token was set
            const token = tokenManager.getToken();
            if (!token) {
                console.error('Login succeeded but token not set!');
                setError('Login succeeded but authentication failed. Please try again.');
                setLoading(false);
                return;
            }

            console.log('Token verified, navigating to dashboard');
            // Small delay to ensure state is updated
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 100);
        } catch (error) {
            console.error('Login error:', error);
            setError(error.response?.data?.error || error.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-cyan-50/50">
            {/* Vivid Background with Animation */}
            <div className="absolute inset-0 w-full h-full">
                <img
                    src={loginBg}
                    alt="Medical Background"
                    className="w-full h-full object-cover opacity-30 scale-105 animate-float-slow"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white/40 to-cyan-50/90 mix-blend-overlay" />
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[4px]" />
            </div>

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-full max-w-md p-8 sm:p-10 mx-4">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[3rem] transform transition-all hover:scale-[1.005] duration-500" />

                <div className="relative z-20 pt-6">
                    <div className="flex flex-col items-center justify-center mb-10">
                        <div className="relative mb-8 group mt-8">
                            <div className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                            <div className="relative transform transition-transform group-hover:scale-105 duration-500">
                                <img
                                    src="/logo.png"
                                    alt="PageMD Logo"
                                    className="h-16 w-auto object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <h2 className="text-3xl font-semibold text-slate-800 tracking-tight">
                                Welcome Back
                            </h2>
                            <p className="text-slate-400 text-[10px] sm:text-xs mt-2 font-semibold uppercase tracking-[0.2em] opacity-80">
                                Secure Access for Professionals
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-semibold animate-fade-in flex items-center gap-3">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="block w-full pl-11 pr-4 py-4 bg-white/30 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white/60 transition-all duration-300 font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="doctor@pagemd.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-4 bg-white/30 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white/60 transition-all duration-300 font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <InteractiveHoverButton
                                text={loading ? 'Authenticating...' : 'Sign In Securely'}
                                disabled={loading}
                                type="submit"
                                className="w-full bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20"
                            />
                        </div>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <p className="text-slate-400 font-medium">
                            Forgot your password?{' '}
                            <button className="text-blue-600 hover:text-blue-700 font-semibold transition-colors underline decoration-blue-500/20 hover:decoration-blue-500">
                                Contact Administrator
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-10 text-center w-full">
                <p className="text-slate-300 text-[10px] font-semibold tracking-[0.3em] uppercase">
                    HIPAA Compliant & Secure • PageMD EMR v1.0
                </p>
            </div>
        </div >
    );
};

export default Login;
