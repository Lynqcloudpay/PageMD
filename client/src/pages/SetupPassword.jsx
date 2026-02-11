import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const SetupPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [token, setToken] = useState('');
    const [type, setType] = useState('invite');
    const [user, setUser] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tokenParam = params.get('token');
        const typeParam = location.pathname === '/reset-password' ? 'reset' : 'invite';

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
                const response = await axios.get(`/api/auth/verify-token?token=${tokenParam}&type=${typeParam}`);
                setUser(response.data.user);
            } catch (err) {
                setError(err.response?.data?.error || 'Token is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, [location]);

    const validatePassword = () => {
        const errors = [];
        if (password.length < 8) errors.push('8+ characters');
        if (!/[A-Z]/.test(password)) errors.push('Uppercase');
        if (!/[a-z]/.test(password)) errors.push('Lowercase');
        if (!/[0-9]/.test(password)) errors.push('Number');
        if (!/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(password)) errors.push('Special char');
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const passErrors = validatePassword();
        if (passErrors.length > 0) {
            setError(`Missing: ${passErrors.join(', ')}`);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/auth/redeem-token', {
                token,
                password,
                type
            });
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
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
                                <div className="text-center p-6 space-y-4">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-2">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">Link Invalid</h3>
                                    <p className="text-slate-600 text-sm">{error}</p>
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="mt-4 text-blue-600 font-semibold hover:text-blue-500"
                                    >
                                        Return to Login
                                    </button>
                                </div>
                            ) : (
                                <form className="space-y-6" onSubmit={handleSubmit}>
                                    <div>
                                        <label htmlFor="password" title="Required: 8+ characters, uppercase, lowercase, number, special character" className="block text-sm font-medium text-slate-700">
                                            New Password
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="password"
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="block w-full appearance-none rounded-xl border border-slate-200 px-4 py-3 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all duration-200"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="confirmPassword" title="Must match password" className="block text-sm font-medium text-slate-700">
                                            Confirm Password
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="confirmPassword"
                                                type="password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="block w-full appearance-none rounded-xl border border-slate-200 px-4 py-3 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all duration-200"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Password Requirements</p>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <div className={`w-1 h-1 rounded-full ${password.length >= 8 ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                8+ Characters
                                            </div>
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <div className={`w-1 h-1 rounded-full ${(password.length > 0 && /[A-Z]/.test(password)) ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                Uppercase Letter
                                            </div>
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <div className={`w-1 h-1 rounded-full ${(password.length > 0 && /[0-9]/.test(password)) ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                Number
                                            </div>
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <div className={`w-1 h-1 rounded-full ${(password.length > 0 && /[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\;',./]/.test(password)) ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                Special Character
                                            </div>
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
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetupPassword;
