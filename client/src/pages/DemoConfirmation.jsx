import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Calendar, Video, Clock, RefreshCw } from 'lucide-react';

const DemoConfirmation = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading'); // loading, accepted, denied, error
    const [demoData, setDemoData] = useState(null);

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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Processing your request...</p>
                </div>
            </div>
        );
    }

    const isAccepted = status === 'accepted';

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

                {/* Header Branding */}
                <div className="bg-[#001f3f] p-6 text-center">
                    <h1 className="text-white text-2xl font-bold tracking-tight uppercase">PageMD</h1>
                </div>

                <div className="p-8 text-center">
                    {status === 'error' ? (
                        <>
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
                                <RefreshCw className="text-amber-600" size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
                            <p className="text-slate-500 mb-8">We couldn't process this link. It may have expired or is invalid.</p>
                            <a href="/" className="inline-block w-full py-3 bg-[#001f3f] text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition">
                                Return to Homepage
                            </a>
                        </>
                    ) : isAccepted ? (
                        <>
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                                <CheckCircle2 className="text-green-600" size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Demo Confirmed!</h2>
                            <p className="text-slate-500 mb-8">We've updated the schedule. Your specialist has been notified.</p>

                            {/* Information Card */}
                            <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-200 mb-6 space-y-4">
                                <div className="flex items-center gap-3 text-slate-700">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <CheckCircle2 size={18} className="text-[#0074D9]" />
                                    </div>
                                    <span className="font-semibold text-sm">Attendance Confirmed</span>
                                </div>
                                <p className="text-xs text-slate-400">Please refer to the calendar invitation in your inbox for the video meeting link and dial-in details.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                                <XCircle className="text-red-600" size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Meeting Declined</h2>
                            <p className="text-slate-500 mb-8">No worries! We've notified your specialist. They will reach out to find a better time.</p>

                            <a href="/" className="inline-block w-full py-3 bg-[#001f3f] text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 transition">
                                Back to PageMD
                            </a>
                        </>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-300">
                        PageMD EMR • Secure Scheduling System
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoConfirmation;
