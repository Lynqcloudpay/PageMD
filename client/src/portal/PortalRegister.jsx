import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { showSuccess } from '../utils/toast';

const PortalRegister = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const clinic = searchParams.get('clinic');
    const [inviteData, setInviteData] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('No invitation token provided.');
                setVerifying(false);
                return;
            }

            try {
                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const response = await axios.get(`${apiBase}/portal/auth/invite/${token}`, {
                    headers: { 'x-clinic-slug': clinic }
                });
                setInviteData(response.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Invalid or expired invitation.');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const apiBase = import.meta.env.VITE_API_URL || '/api';
            await axios.post(`${apiBase}/portal/auth/register`, {
                token,
                password
            }, {
                headers: { 'x-clinic-slug': clinic }
            });

            showSuccess('Account created successfully! You can now log in.');
            navigate('/portal/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create account.');
        } finally {
            setLoading(false);
        }
    };

    if (verifying) return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
                style={{ backgroundImage: 'url("/portal-bg.png")' }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/60 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <div className="text-white font-black uppercase tracking-widest text-xs">Verifying Invitation...</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
                style={{ backgroundImage: 'url("/portal-bg.png")' }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/60 backdrop-blur-[2px]" />

            {/* Registration Card */}
            <div className="relative w-full max-w-[480px] animate-scale-in">
                <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 md:p-10 border border-white/20">
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20 rotate-3 transform hover:rotate-0 transition-transform duration-500">
                            <span className="text-white text-4xl font-black">PM</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Create Account</h1>
                        {inviteData && (
                            <p className="text-slate-500 font-medium">
                                Welcome, <span className="text-blue-600 font-bold">{inviteData.patientName}</span>!
                            </p>
                        )}
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Set your portal password</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-8 flex items-center gap-3 animate-shake">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-sm font-semibold">{error}</span>
                        </div>
                    )}

                    {inviteData ? (
                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                <input
                                    type="email"
                                    disabled
                                    className="w-full px-5 py-4 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 font-bold outline-none cursor-not-allowed"
                                    value={inviteData.email}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-slate-900"
                                        placeholder="Min. 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirm</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-slate-900"
                                        placeholder="Repeat password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-6 rounded-xl transition-all duration-300 shadow-xl shadow-slate-200 hover:shadow-slate-300 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 group"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        <span>Create My Account</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Invalid Invitation</h3>
                            <p className="text-slate-500 mb-8">This link may have expired or already been used.</p>
                            <button
                                onClick={() => navigate('/portal/login')}
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                            >
                                Back to Login
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Security Note */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[10px] font-bold text-white/60 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        HIPAA COMPLIANT
                    </div>
                    <span>•</span>
                    <div>ENCRYPTED SESSION</div>
                    <span>•</span>
                    <div>256-BIT SSL</div>
                </div>
            </div>
        </div>
    );
};

export default PortalRegister;
