import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LogIn, Lock, Mail } from 'lucide-react';
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
        <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-slate-900">
            {/* Vivid Background with Animation */}
            <div className="absolute inset-0 w-full h-full">
                <img
                    src={loginBg}
                    alt="Medical Background"
                    className="w-full h-full object-cover opacity-90 scale-105 animate-float-slow"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900/20 to-slate-900/80 mix-blend-multiply" />
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
            </div>

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-full max-w-md p-8 sm:p-10 mx-4">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl transform transition-all hover:scale-[1.01] duration-500" />

                <div className="relative z-20">
                    <div className="flex flex-col items-center justify-center mb-10">
                        <div className="relative mb-6 group">
                            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                            <div className="relative bg-white/90 p-4 rounded-2xl shadow-lg border border-white/50 backdrop-blur-sm transform transition-transform group-hover:scale-105 duration-300">
                                <img
                                    src="/logo.png"
                                    alt="PageMD Logo"
                                    className="h-12 w-auto object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md text-center">
                            Welcome Back
                        </h2>
                        <p className="text-blue-100 text-sm mt-2 text-center font-medium opacity-90">
                            Secure Access for Healthcare Professionals
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-100 text-sm backdrop-blur-md animate-fade-in flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-blue-100 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-200 group-focus-within:text-white transition-colors">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent focus:bg-white/20 transition-all duration-300"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="doctor@pagemd.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-blue-100 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-200 group-focus-within:text-white transition-colors">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent focus:bg-white/20 transition-all duration-300"
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
                                className="w-full border-white/30 text-white hover:text-white"
                            />
                        </div>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <p className="text-blue-200/70">
                            Forgot your password?{' '}
                            <button className="text-white hover:text-blue-300 font-medium transition-colors underline decoration-blue-400/30 hover:decoration-blue-400">
                                Contact Administrator
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 text-center w-full">
                <p className="text-white/30 text-xs font-light tracking-widest uppercase">
                    HIPAA Compliant & Secure • PageMD EMR v1.0
                </p>
            </div>
        </div>
    );
};

export default Login;
