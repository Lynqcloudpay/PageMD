import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200 p-10">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-100">
                        <span className="text-white text-3xl font-black italic">P</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-3">Forgot Password?</h1>
                    <p className="text-slate-500">Enter your email and we'll send you a link to reset your password.</p>
                </div>

                {submitted ? (
                    <div className="bg-blue-50 p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-4">📧</div>
                        <h3 className="text-lg font-bold text-blue-800 mb-2">Check your email</h3>
                        <p className="text-blue-600 text-sm">We've sent a password reset link to <strong>{email}</strong>.</p>
                        <Link to="/portal/login" className="mt-6 inline-block text-blue-600 font-bold hover:underline">Back to Login</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all"
                                placeholder="name@example.com"
                            />
                        </div>

                        {error && <div className="text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-xl">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? 'Sending link...' : 'Send Reset Link'}
                        </button>

                        <div className="text-center pt-4">
                            <Link to="/portal/login" className="text-slate-500 hover:text-blue-600 font-bold transition-colors">
                                ← Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PortalForgotPassword;
