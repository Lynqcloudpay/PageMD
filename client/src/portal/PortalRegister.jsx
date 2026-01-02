import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const PortalRegister = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
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
                const response = await axios.get(`${apiBase}/portal/auth/invite/${token}`);
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
            });

            alert('Account created successfully! You can now log in.');
            navigate('/portal/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create account.');
        } finally {
            setLoading(false);
        }
    };

    if (verifying) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-pulse text-slate-400">Verifying invitation...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h1>
                    {inviteData && (
                        <p className="text-slate-500">
                            Welcome, <span className="font-semibold text-slate-900">{inviteData.patientName}</span>!
                            Please set a password to access your portal.
                        </p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {inviteData ? (
                    <form onSubmit={handleRegister} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 outline-none"
                                value={inviteData.email}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="At least 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Repeat your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {loading ? 'Creating Account...' : 'Complete Registration'}
                        </button>
                    </form>
                ) : (
                    <div className="text-center">
                        <button
                            onClick={() => navigate('/portal/login')}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortalRegister;
