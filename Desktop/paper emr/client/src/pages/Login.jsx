import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const [email, setEmail] = useState('doctor@clinic.com');
    const [password, setPassword] = useState('Password123!');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Safety check
    if (!auth) {
        return (
            <div className="min-h-screen bg-paper-50 flex items-center justify-center">
                <div className="text-ink-500">Loading...</div>
            </div>
        );
    }

    const { login, user } = auth;

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard', { replace: true });
        } catch (error) {
            setError(error.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md p-8">
                <div className="flex items-center justify-center mb-8">
                    <img 
                        src="/logo.png" 
                        alt="PageMD Logo" 
                        className="h-16 w-auto object-contain max-w-[200px]"
                        onError={(e) => {
                            // Hide broken image
                            e.target.style.display = 'none';
                        }}
                    />
                </div>

                <h2 className="text-xl font-semibold text-primary-900 mb-6 text-center">Sign In</h2>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all duration-200 hover:border-gray-400 text-gray-900 placeholder:text-gray-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="doctor@clinic.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all duration-200 hover:border-gray-400 text-gray-900 placeholder:text-gray-400"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                        <LogIn className="w-5 h-5" />
                        <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                    </button>
                </form>

                <div className="mt-6 p-4 bg-neutral-100 rounded-lg border border-gray-200 text-sm text-gray-700">
                    <p className="font-semibold mb-3 text-primary-900">Available Users:</p>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                            <span className="font-medium text-gray-700">Doctor:</span>
                            <span className="font-mono text-xs text-gray-600 bg-neutral-100 px-2 py-1 rounded">doctor@clinic.com</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                            <span className="font-medium text-gray-700">Nurse:</span>
                            <span className="font-mono text-xs text-gray-600 bg-neutral-100 px-2 py-1 rounded">nurse@clinic.com</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                            <span className="font-medium text-gray-700">Admin:</span>
                            <span className="font-mono text-xs text-gray-600 bg-neutral-100 px-2 py-1 rounded">admin@clinic.com</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                            Password for all: <span className="font-mono font-semibold text-primary-700">Password123!</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

