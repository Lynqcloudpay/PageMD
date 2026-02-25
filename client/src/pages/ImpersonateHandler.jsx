import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ImpersonateHandler = () => {
    const [searchParams] = useSearchParams();
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { impersonateLogin } = useAuth();

    useEffect(() => {
        const performImpersonation = async () => {
            const token = searchParams.get('token');
            const slug = searchParams.get('slug');

            if (!token) {
                setError('No impersonation token provided');
                return;
            }

            try {
                // Call the endpoint on the target clinic API
                const response = await axios.get(`/api/auth/impersonate?token=${token}`);

                // Establish the session via AuthContext
                await impersonateLogin({
                    token: response.data.token,
                    user: response.data.user,
                    clinic_slug: slug
                });

                // Small delay to ensure state propagation and prevent race conditions
                setTimeout(() => {
                    navigate('/dashboard', { replace: true });
                }, 100);
            } catch (err) {
                console.error('Impersonation error:', err);
                setError(err.response?.data?.error || 'Impersonation failed. The token may be expired.');
            }
        };

        performImpersonation();
    }, [searchParams, navigate, impersonateLogin]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-red-100 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="px-6 py-2 bg-gray-100 text-white rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 animate-bounce shadow-lg shadow-blue-500/20">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight mb-2">Securing "Break Glass" Session</h1>
            <p className="text-gray-500 font-medium">Verifying audit clearance and establishing secure tunnel...</p>
        </div>
    );
};

export default ImpersonateHandler;
