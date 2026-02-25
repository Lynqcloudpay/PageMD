import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const PortalLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const apiBase = 'https://pagemdemr.com/api'; // Hardcode for now to resolve iOS issues

    // Aggressive Scroll Locking
    useEffect(() => {
        // Lock body and html
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            // Cleanup
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
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
            console.error('Login error:', err);
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 w-full h-full bg-white flex items-center justify-center p-4"
            style={{
                backgroundImage: 'url("/portal-bg.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                overscrollBehavior: 'none',
                touchAction: 'none'
            }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-blue-900/40 backdrop-blur-[2px]" />

            {/* Login Card */}
            <div className="relative w-full max-w-[420px] animate-scale-in z-10">
                <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-white/40">
                    <div className="text-center mb-10">
                        <div className="mb-8">
                            <img src="/logo.png" alt="PageMD Logo" className="h-12 mx-auto object-contain" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 tracking-tight mb-2">Patient Portal</h1>
                        <p className="text-gray-500 text-sm font-medium">Secure access to your health records</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex flex-col gap-1 animate-shake break-words">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                                <span className="text-sm font-semibold">Login Failed</span>
                            </div>
                            <span className="text-xs text-red-500 font-mono mt-1 pl-5">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="username email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck="false"
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-gray-800"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="password" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                                <Link to="/portal/forgot-password" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">Forgot Password?</Link>
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 font-medium text-gray-800"
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
                                    <span>Sign In</span>
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Security Note */}
                <div className="mt-8 flex flex-col items-center justify-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-widest">
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
