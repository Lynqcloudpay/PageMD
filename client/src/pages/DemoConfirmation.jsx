import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, CalendarX, AlertCircle, ArrowRight, Loader2, Calendar } from 'lucide-react';

const DemoConfirmation = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading'); // loading, accepted, denied, error
    const [errorMessage, setErrorMessage] = useState(null);
    const [errorCode, setErrorCode] = useState(null);

    const demoId = searchParams.get('id');
    const action = searchParams.get('action'); // 'accept' or 'deny'

    useEffect(() => {
        const processAction = async () => {
            if (!demoId || !action) {
                setStatus('error');
                return;
            }

            try {
                const baseUrl = import.meta.env.VITE_API_URL || '/api';
                const res = await fetch(`${baseUrl}/sales/demos/${demoId}/confirm`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });

                if (res.ok) {
                    setStatus(action === 'accept' ? 'accepted' : 'denied');
                } else {
                    const data = await res.json();
                    setErrorMessage(data.error);
                    setErrorCode(data.code);
                    setStatus('error');
                }
            } catch (error) {
                console.error('Failed to confirm demo:', error);
                setStatus('error');
            }
        };

        processAction();
    }, [demoId, action]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center animate-pulse">
                    <img src="/logo.png" alt="PageMD" className="h-8 mb-6 opacity-50" />
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                    <p className="text-slate-400 text-sm font-medium">Updating appointment status...</p>
                </div>
            </div>
        );
    }

    // Determine specific UI state
    // 1. Success (Confirmed)
    // 2. Success (Denied/Declined by user just now)
    // 3. Error - Already Cancelled (Recover Lead)
    // 4. Error - Generic

    const renderContent = () => {
        // --- CASE: LINK EXPIRED / ALREADY CANCELLED (RECOVER LEAD) ---
        if (status === 'error' && (errorCode === 'APPOINTMENT_CANCELLED' || errorMessage?.includes('cancelled'))) {
            return (
                <>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-rose-100 rounded-full scale-150 opacity-20 filter blur-xl"></div>
                        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-rose-50 to-white border border-rose-100 rounded-full shadow-sm">
                            <CalendarX className="text-rose-500" size={32} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Let's Reschedule?</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
                        This appointment was previously cancelled. If you're ready to chat, we'd still love to connect at a time that works better for you!
                    </p>

                    <div className="space-y-3 w-full">
                        <a href="/" className="flex items-center justify-center w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 group">
                            <Calendar className="w-4 h-4 mr-2" />
                            Schedule New Demo
                            <ArrowRight className="w-4 h-4 ml-2 opacity-50 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="mailto:support@pagemd.com" className="flex items-center justify-center w-full py-3.5 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
                            Contact Support
                        </a>
                    </div>
                </>
            );
        }

        // --- CASE: SUCCESS (CONFIRMED) ---
        if (status === 'accepted') {
            return (
                <>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-emerald-100 rounded-full scale-150 opacity-20 filter blur-xl"></div>
                        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-emerald-50 to-white border border-emerald-100 rounded-full shadow-sm">
                            <CheckCircle2 className="text-emerald-500" size={36} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">You're All Set!</h2>
                    <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                        Your appointment has been confirmed. A calendar invitation with video details has been sent to your email.
                    </p>

                    <div className="bg-slate-50 rounded-2xl p-5 w-full border border-slate-100 text-left mb-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Next Steps</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-1 bg-blue-100 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                </div>
                                <span className="text-sm text-slate-600">Check your inbox for the meeting link</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-1 bg-blue-100 rounded-full">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                </div>
                                <span className="text-sm text-slate-600">Prepare any questions for our team</span>
                            </div>
                        </div>
                    </div>

                    <a href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                        Back to Homepage
                    </a>
                </>
            );
        }

        // --- CASE: SUCCESS (DECLINED) ---
        if (status === 'denied') {
            return (
                <>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-slate-100 rounded-full scale-150 opacity-20 filter blur-xl"></div>
                        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-slate-50 to-white border border-slate-100 rounded-full shadow-sm">
                            <XCircle className="text-slate-400" size={36} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Appointment Declined</h2>
                    <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                        We've notified the team. If your schedule opens up, feel free to book a new time!
                    </p>

                    <a href="/" className="flex items-center justify-center w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                        Return to Homepage
                    </a>
                </>
            );
        }

        // --- CASE: GENERIC ERROR ---
        return (
            <>
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-amber-100 rounded-full scale-150 opacity-20 filter blur-xl"></div>
                    <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-amber-50 to-white border border-amber-100 rounded-full shadow-sm">
                        <AlertCircle className="text-amber-500" size={36} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Link Expired</h2>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                    {errorMessage || "We couldn't process this request. The link may have expired or is invalid."}
                </p>
                <a href="/" className="flex items-center justify-center w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                    Return to Homepage
                </a>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 selection:bg-blue-100">
            {/* Main Card */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 w-full max-w-md overflow-hidden relative border border-white">

                {/* Decorative Top Border */}
                <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600"></div>

                {/* Content */}
                <div className="p-8 md:p-12 flex flex-col items-center text-center">
                    {/* Logo */}
                    <img src="/logo.png" alt="PageMD" className="h-8 mb-10 object-contain" />

                    {/* Dynamic Status Content */}
                    {renderContent()}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">PageMD EMR</p>
                <div className="flex gap-4 text-xs text-slate-400">
                    <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
                    <span>•</span>
                    <a href="#" className="hover:text-slate-600 transition-colors">Support</a>
                </div>
            </div>
        </div>
    );
};

export default DemoConfirmation;
