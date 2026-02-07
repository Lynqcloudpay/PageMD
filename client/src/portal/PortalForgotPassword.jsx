import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const PortalForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const apiBase = import.meta.env.VITE_API_URL || '/api';
            await axios.post(`${apiBase}/portal/auth/forgot`, { email });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center p-6">
            {/* Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-3xl" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-50/50 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 relative z-10 transition-all duration-500">
                    <div className="text-center mb-8">
                        <img
                            src="https://pagemdemr.com/logo.png"
                            alt="PageMD"
                            className="h-10 mx-auto mb-6 opacity-90 hover:opacity-100 transition-opacity"
                        />
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Forgot Password?</h1>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                            Enter your email address to receive a secure link to reset your password.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-md shadow-blue-100/50">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Check your email</h3>
                            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                                We've sent password reset instructions to <br />
                                <span className="font-semibold text-slate-800">{email}</span>
                            </p>
                            <Link
                                to="/portal/login"
                                className="inline-flex items-center justify-center gap-2 w-full bg-white border border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-sm"
                            >
                                <ArrowLeft size={16} />
                                Back to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                        <Mail size={20} />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                    <span className="font-medium">{error}</span>
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Sending Link...</span>
                                        </>
                                    ) : (
                                        <span>Send Reset Link</span>
                                    )}
                                </button>
                            </div>

                            <div className="text-center">
                                <Link
                                    to="/portal/login"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
                                >
                                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs font-semibold text-slate-400">
                        Secure Patient Portal &bull; HIPAA Compliant
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PortalForgotPassword;
