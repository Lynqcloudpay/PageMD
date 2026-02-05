import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail } from 'lucide-react';

/**
 * VerifyDemo Page
 * Handles magic link verification and sandbox provisioning
 * URL: /verify-demo?token=<jwt>
 */
const VerifyDemo = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            setStatus('error');
            setErrorMessage('No verification token provided.');
            return;
        }

        verifyToken(token);
    }, [searchParams]);

    // Countdown and redirect after success
    useEffect(() => {
        if (status === 'success' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
        if (status === 'success' && countdown === 0) {
            navigate('/dashboard');
        }
    }, [status, countdown, navigate]);

    const verifyToken = async (token) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/sales/verify/${token}`);
            const data = await res.json();

            if (!res.ok) {
                setStatus('error');
                if (data.code === 'EXPIRED_TOKEN') {
                    setErrorMessage('This link has expired. Please request a new demo.');
                } else if (data.code === 'INVALID_TOKEN') {
                    setErrorMessage('This link is invalid or has already been used.');
                } else {
                    setErrorMessage(data.error || 'Verification failed. Please try again.');
                }
                return;
            }

            // Success! Store the sandbox token
            if (data.token) {
                localStorage.setItem('token', data.token);

                // Also set the demo cookie for returning user bypass
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30);
                document.cookie = `pagemd_demo_captured=true; expires=${expiry.toUTCString()}; path=/`;
            }

            setStatus('success');

        } catch (error) {
            console.error('Verification error:', error);
            setStatus('error');
            setErrorMessage('Network error. Please check your connection and try again.');
        }
    };

    const handleRetry = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                <div className="p-8 md:p-10 text-center">

                    {/* Verifying State */}
                    {status === 'verifying' && (
                        <>
                            <div className="mb-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                    Verifying Your Access
                                </h1>
                                <p className="text-slate-500">
                                    Setting up your demo environment...
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </>
                    )}

                    {/* Success State */}
                    {status === 'success' && (
                        <>
                            <div className="mb-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                    Email Verified!
                                </h1>
                                <p className="text-slate-500 mb-4">
                                    Your demo environment is ready.
                                </p>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Redirecting in {countdown}s...
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg transition-all"
                            >
                                Go to Dashboard Now
                            </button>
                        </>
                    )}

                    {/* Error State */}
                    {status === 'error' && (
                        <>
                            <div className="mb-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                                    <XCircle className="w-10 h-10 text-red-500" />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                    Verification Failed
                                </h1>
                                <p className="text-slate-500 mb-4">
                                    {errorMessage}
                                </p>
                            </div>
                            <div className="space-y-3">
                                <button
                                    onClick={handleRetry}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Request New Demo
                                </button>
                                <p className="text-xs text-slate-400">
                                    Need help? Contact us at support@pagemdemr.com
                                </p>
                            </div>
                        </>
                    )}

                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-8 py-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">
                        PageMD • HIPAA Compliant Demo Environment
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyDemo;
