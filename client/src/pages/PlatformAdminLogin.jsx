import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, LogIn } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminLogin = () => {
    const navigate = useNavigate();
    const { login } = usePlatformAdmin();
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(secret);
            navigate('/platform-admin/dashboard');
        } catch (err) {
            setError('Invalid Super Admin secret. Access denied.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItMnptMCAwdjItMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>

            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-md p-8 relative overflow-hidden">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>

                <div className="relative z-10">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-white text-center mb-2">
                        Platform Admin
                    </h1>
                    <p className="text-blue-200 text-center mb-8 text-sm">
                        Super Administrator Access Only
                    </p>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-blue-100 mb-2">
                                Super Admin Secret
                            </label>
                            <input
                                type="password"
                                required
                                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white placeholder:text-blue-200/50"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="Enter your admin secret key"
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-blue-200/70">
                                This is your platform-level access key. Never share this with anyone.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !secret}
                            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:scale-105 active:scale-100"
                        >
                            <LogIn className="w-5 h-5" />
                            <span>{loading ? 'Authenticating...' : 'Access Platform'}</span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-center text-xs text-blue-200/70">
                            All platform actions are audited and logged.
                            <br />
                            Unauthorized access attempts will be reported.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformAdminLogin;
