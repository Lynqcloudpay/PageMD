import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const PortalLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const navigate = useNavigate();
    const apiBase = import.meta.env.VITE_API_URL || '/api';

    // Initialize Apple Sign In on mount
    useEffect(() => {
        // Load Apple JS SDK
        const script = document.createElement('script');
        script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
        script.async = true;
        script.onload = () => {
            if (window.AppleID) {
                window.AppleID.auth.init({
                    clientId: 'com.pagemd.portal.signin', // Service ID from Apple Developer
                    scope: 'name email',
                    redirectURI: `${window.location.origin}/portal/apple-callback`,
                    usePopup: true
                });
            }
        };
        document.head.appendChild(script);

        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(`${apiBase}/portal/auth/login`, {
                email,
                password
            });

            localStorage.setItem('portalToken', response.data.token);
            localStorage.setItem('portalPatient', JSON.stringify(response.data.patient));
            localStorage.setItem('portalClinic', JSON.stringify(response.data.clinic));

            navigate('/portal/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        setError('');
        setAppleLoading(true);

        try {
            // Use Apple's popup-based auth
            const response = await window.AppleID.auth.signIn();

            // Send the authorization code to our backend
            const backendResponse = await axios.post(`${apiBase}/portal/auth/apple`, {
                code: response.authorization.code,
                id_token: response.authorization.id_token,
                user: response.user // Only provided on first sign-in
            });

            if (backendResponse.data.token) {
                localStorage.setItem('portalToken', backendResponse.data.token);
                localStorage.setItem('portalPatient', JSON.stringify(backendResponse.data.patient));
                localStorage.setItem('portalClinic', JSON.stringify(backendResponse.data.clinic));
                navigate('/portal/dashboard');
            } else {
                setError(backendResponse.data.error || 'Apple Sign In failed');
            }
        } catch (err) {
            console.error('Apple Sign In error:', err);
            if (err.error === 'popup_closed_by_user') {
                // User cancelled, don't show error
            } else {
                setError('Apple Sign In failed. Please try again or use email/password.');
            }
        } finally {
            setAppleLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
                style={{ backgroundImage: 'url("/portal-bg.png")' }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-blue-900/40 backdrop-blur-[2px]" />

            {/* Login Card */}
            <div className="relative w-full max-w-[420px] animate-scale-in">
                <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-white/40">
                    <div className="text-center mb-8">
                        <div className="mb-6">
                            <img src="/logo.png" alt="PageMD Logo" className="h-12 mx-auto object-contain" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Patient Portal</h1>
                        <p className="text-slate-500 text-sm font-medium">Secure access to your health records</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 animate-shake">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            <span className="text-sm font-semibold">{error}</span>
                        </div>
                    )}

                    {/* Sign in with Apple Button */}
                    <button
                        onClick={handleAppleSignIn}
                        disabled={appleLoading}
                        className="w-full bg-black hover:bg-gray-900 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 mb-6 shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                        {appleLoading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <>
                                {/* Apple Logo SVG */}
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                </svg>
                                <span>Sign in with Apple</span>
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-4 text-slate-400 font-bold tracking-wider">or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                type="email"
                                required
                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-slate-800"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <Link to="/portal/forgot-password" size="sm" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">Forgot Password?</Link>
                            </div>
                            <input
                                type="password"
                                required
                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-slate-800"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 group"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <>
                                    <span>Sign in with Email</span>
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                            Don't have access? <br />
                            <span className="text-slate-400">Please contact your healthcare provider for an invitation.</span>
                        </p>
                    </div>
                </div>

                {/* Footer Security Note */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        HIPAA COMPLIANT
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortalLogin;

