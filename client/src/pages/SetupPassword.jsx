import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const SetupPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [token, setToken] = useState('');
    const [type, setType] = useState('emr'); // emr, platform, sales, reset
    const [user, setUser] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tokenParam = params.get('token');
        const typeParam = params.get('type') || (location.pathname === '/reset-password' ? 'reset' : 'emr');

        if (!tokenParam) {
            setError('Missing or invalid token. Please check your link.');
            setLoading(false);
            return;
        }

        setToken(tokenParam);
        setType(typeParam);

        // Verify token on mount
        const verifyToken = async () => {
            try {
                let endpoint = '';
                if (typeParam === 'platform') {
                    endpoint = `/api/platform-auth/verify-invite/${tokenParam}`;
                } else if (typeParam === 'platform_reset') {
                    endpoint = `/api/platform-auth/verify-reset/${tokenParam}`;
                } else if (typeParam === 'sales') {
                    endpoint = `/api/sales/auth/verify-invite/${tokenParam}`;
                } else if (typeParam === 'sales_reset') {
                    endpoint = `/api/sales/auth/verify-reset/${tokenParam}`;
                } else {
                    endpoint = `/api/auth/verify-token?token=${tokenParam}&type=${typeParam === 'reset' ? 'reset' : 'invite'}`;
                }

                const response = await axios.get(endpoint);
                setUser(response.data.user);
            } catch (err) {
                setError(err.response?.data?.error || 'Token is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, [location]);

    const getPasswordRequirements = () => {
        return [
            { label: '12+ Characters', met: password.length >= 12 },
            { label: 'Uppercase Letter', met: /[A-Z]/.test(password) },
            { label: 'Number', met: /[0-9]/.test(password) },
            { label: 'Special Character', met: /[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(password) },
            { label: 'Passwords Match', met: password.length > 0 && password === confirmPassword }
        ];
    };

    const validatePassword = () => {
        const reqs = getPasswordRequirements();
        return reqs.filter(r => !r.met).map(r => r.label);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const passErrors = validatePassword();
        if (passErrors.length > 0) {
            setError(`Missing requirements: ${passErrors.join(', ')}`);
            return;
        }

        setSubmitting(true);
        try {
            let endpoint = '';
            let payload = { token, password };

            if (type === 'platform') {
                endpoint = '/api/platform-auth/redeem-invite';
            } else if (type === 'platform_reset') {
                endpoint = '/api/platform-auth/reset-password';
            } else if (type === 'sales') {
                endpoint = '/api/sales/auth/redeem-invite';
            } else if (type === 'sales_reset') {
                endpoint = '/api/sales/auth/reset-password';
            } else {
                endpoint = '/api/auth/redeem-token';
                payload.type = type === 'reset' ? 'reset' : 'invite';
            }

            await axios.post(endpoint, payload);
            setSuccess(true);
            setTimeout(() => {
                // Determine redirect path
                if (type === 'platform' || type === 'platform_reset') navigate('/platform-admin');
                else if (type === 'sales' || type === 'sales_reset') navigate('/sales-admin');
                else navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to set password. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const requirements = getPasswordRequirements();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="PageMD" className="h-12 w-auto" />
                </div>
                <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
                    {type === 'invite' ? 'Welcome to PageMD' : 'Reset Your Password'}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600">
                    {user ? `Setting password for ${user.firstName} ${user.lastName}` : 'Please set your secure password'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
                    {success ? (
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Password Set!</h3>
                            <p className="text-slate-600">Your password has been successfully updated. Redirecting to login...</p>
                        </div>
                    ) : (
                        <>
                            {error ? (
                                <div className="text-center p-4 mb-4 bg-red-50 rounded-xl border border-red-100">
                                    <div className="flex items-center gap-2 text-red-700 mb-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-sm font-bold">Action Required</span>
                                    </div>
                                    <p className="text-red-600 text-xs text-left">{error}</p>
                                </div>
                            ) : null}

                            <form className="space-y-6" onSubmit={handleSubmit}>
                                <div>
                                    <label htmlFor="password" title="Required: 12+ characters, uppercase, lowercase, number, special character" className="block text-sm font-medium text-slate-700">
                                        New Password
                                    </label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full appearance-none rounded-xl border border-slate-200 pl-4 pr-12 py-3 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all duration-200"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" title="Must match password" className="block text-sm font-medium text-slate-700">
                                        Confirm Password
                                    </label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="block w-full appearance-none rounded-xl border border-slate-200 pl-4 pr-12 py-3 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all duration-200"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showConfirmPassword ? (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Security Requirements</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-600">
                                        {requirements.map((req, idx) => (
                                            <div key={idx} className={`flex items-center gap-1.5 font-medium transition-colors duration-200 ${req.met ? 'text-green-600' : 'text-slate-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${req.met ? 'bg-green-500 scale-110 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`} />
                                                {req.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex w-full justify-center rounded-xl border border-transparent bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        {submitting ? (
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            'Set Password & Log In'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetupPassword;
