import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const REMEMBERED_USERNAME_KEY = 'pageMD_remembered_username';

const Login = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    // Load remembered username from localStorage
    const [email, setEmail] = useState(() => {
        const remembered = localStorage.getItem(REMEMBERED_USERNAME_KEY);
        return remembered || '';
    });
    const [password, setPassword] = useState('');
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

        // Debug: Log form values
        console.log('Form submit - email:', email, 'password length:', password?.length || 0);

        try {
            // Login with extended timeout (Argon2 password verification can take time)
            await login(email, password);
            
            // Save username to localStorage on successful login
            if (email) {
                localStorage.setItem(REMEMBERED_USERNAME_KEY, email);
            }
            navigate('/dashboard', { replace: true });
        } catch (error) {
            let errorMessage = 'Login failed. Please check your credentials.';
            
            // Log full error details for debugging
            const errorDetails = {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                requestData: { email, password: password ? '***' : 'empty' }
            };
            console.error('Login error details:', JSON.stringify(errorDetails, null, 2));
            if (error.response?.data) {
                console.error('Server response data:', JSON.stringify(error.response.data, null, 2));
            }
            
            if (error.message?.includes('timeout')) {
                errorMessage = 'Login request timed out. The server may be slow or unreachable. Please try again.';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.response?.data?.errors) {
                // Handle validation errors
                const validationErrors = error.response.data.errors;
                errorMessage = validationErrors.map(e => e.msg || e.message).join(', ');
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
            console.error('Login error:', error);
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
                            placeholder="Enter your email address"
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
                        className="w-full py-3 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                    >
                        <LogIn className="w-5 h-5" />
                        <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                    </button>
                </form>

                <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                    <p className="text-center">
                        Forgot your password? Contact your system administrator.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;

