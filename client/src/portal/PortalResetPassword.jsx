import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

const PortalResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        if (!token || !email) {
            setError('Missing reset token or email. Please check your link.');
        }
    }, [token, email]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            await axios.post(`${apiBase}/portal/auth/reset`, { token, email, password });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200 p-10">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-100">
                        <span className="text-white text-3xl font-black italic">P</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-3">Reset Password</h1>
                    <p className="text-slate-500">Create a new, strong password for your portal account.</p>
                </div>

                {success ? (
                    <div className="bg-green-50 p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <h3 className="text-lg font-bold text-green-800 mb-2">Password Reset Successful</h3>
                        <p className="text-green-600 text-sm">Your password has been updated. you can now log in with your new password.</p>
                        <button
                            onClick={() => navigate('/portal/login')}
                            className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-all"
                        >
                            Log In Now
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
                            <input
                                type="password"
                                required
                                minLength={12}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all"
                                placeholder="••••••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all"
                                placeholder="••••••••••••"
                            />
                        </div>

                        {error && <div className="text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-xl">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading || !token}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? 'Updating Password...' : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PortalResetPassword;
