import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Gift, ArrowRight, Shield, Check } from 'lucide-react';
import LandingNav from '../components/LandingNav';

const RegisterPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const referralCode = searchParams.get('ref');
    const referralToken = searchParams.get('token');

    useEffect(() => {
        // Store referral codes if present
        if (referralCode) {
            localStorage.setItem('pagemd_referral', referralCode);
            console.log('Referral code captured:', referralCode);
        }
        if (referralToken) {
            localStorage.setItem('pagemd_referral_token', referralToken);
            console.log('Referral token captured:', referralToken);
        }

        // Auto-redirect to contact after a short delay for branding
        const timer = setTimeout(() => {
            const params = new URLSearchParams();
            if (referralCode) params.set('ref', referralCode);
            if (referralToken) params.set('token', referralToken);
            const queryStr = params.toString();
            navigate(`/contact${queryStr ? `?${queryStr}` : ''}`);
        }, 3500);

        return () => clearTimeout(timer);
    }, [referralCode, navigate]);

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            <div className="pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Branded Icon */}
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-100 animate-bounce">
                            <Gift className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                            Referral Applied
                        </h1>
                        <p className="text-lg text-gray-600 leading-relaxed">
                            {referralCode ? (
                                <>We've captured your unique referral code: <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{referralCode}</span></>
                            ) : (
                                "Preparing your registration..."
                            )}
                        </p>
                    </div>

                    <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 flex flex-col items-center gap-6">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">Redirecting to Practice Setup</p>
                            <p className="text-xs text-gray-500">You're being redirected to our secure registration page.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-700">HIPAA Compliant Setup</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <ArrowRight className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-700">Priority Onboarding</span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate(`/contact${referralCode ? `?ref=${referralCode}` : ''}`)}
                        className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase tracking-[0.2em] transition-colors"
                    >
                        Click here if not redirected in 5 seconds
                    </button>
                </div>
            </div>

            {/* Background elements */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_70%_30%,#EEF2FF,transparent)] opacity-50"></div>
        </div>
    );
};

export default RegisterPage;
