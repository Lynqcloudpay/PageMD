import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Video, Clock, Phone, AlertCircle, RefreshCw, Loader2, Shield,
    Calendar, User, ArrowRight, Lock, PhoneOff
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

const apiBase = import.meta.env.VITE_API_URL || '/api';

// Daily.co Prebuilt Component (reused from PortalTelehealth)
const DailyVideoCall = ({ roomUrl, userName, onLeave }) => {
    const frameRef = useRef(null);
    const callFrameRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js';
        script.async = true;
        script.onload = () => {
            if (frameRef.current && window.DailyIframe) {
                const callFrame = window.DailyIframe.createFrame(frameRef.current, {
                    iframeStyle: {
                        width: '100%',
                        height: '100%',
                        border: '0',
                        borderRadius: '16px',
                    },
                    showLeaveButton: true,
                    showFullscreenButton: true,
                });

                callFrameRef.current = callFrame;
                callFrame.join({ url: roomUrl, userName });

                callFrame.on('joined-meeting', () => setIsLoading(false));
                callFrame.on('left-meeting', () => onLeave('completed'));
                callFrame.on('error', (e) => {
                    console.error('Daily.co error:', e);
                    setIsLoading(false);
                    onLeave('invalid'); // Show technical error screen
                });
            }
        };
        document.body.appendChild(script);

        return () => {
            if (callFrameRef.current) {
                callFrameRef.current.destroy();
                callFrameRef.current = null;
            }
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, [roomUrl, userName, onLeave]);

    return (
        <div className="w-full h-full bg-slate-900 relative">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                    <p className="text-slate-400">Connecting to video call...</p>
                </div>
            )}
            <div ref={frameRef} className="w-full h-full" />
        </div>
    );
};

// Status Screen Component
const StatusScreen = ({ icon: Icon, iconColor, title, message, children, clinicPhone }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-10 text-center animate-in fade-in duration-500">
            <div className={`w-20 h-20 rounded-2xl ${iconColor} mx-auto mb-6 flex items-center justify-center shadow-lg`}>
                <Icon size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-3">{title}</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">{message}</p>
            {children}
            {clinicPhone && (
                <a
                    href={`tel:${clinicPhone.replace(/[^\d]/g, '')}`}
                    className="mt-4 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                >
                    <Phone size={20} />
                    Call Office: {clinicPhone}
                </a>
            )}
        </div>
    </div>
);

const GuestVisitPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token')?.trim();

    const [status, setStatus] = useState('loading'); // loading, too_early, ready, verified, expired, invalid
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [dob, setDob] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [dobError, setDobError] = useState('');
    const [roomUrl, setRoomUrl] = useState(null);
    const [patientName, setPatientName] = useState('');

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            return;
        }

        const validateToken = async () => {
            try {
                const res = await axios.get(`${apiBase}/visit/guest/validate`, {
                    params: { token }
                });

                const data = res.data;
                if (data.status === 'invalid') {
                    console.error('Token validation returned invalid status from server', data);
                }
                setAppointmentInfo(data);
                setStatus(data.status);
            } catch (error) {
                console.error('Token validation failed:', error);
                setStatus('invalid');
            }
        };

        validateToken();
    }, [token]);

    // Handle DOB verification
    const handleVerifyDob = async (e) => {
        e.preventDefault();
        if (!dob) {
            setDobError('Please enter your date of birth');
            return;
        }

        setVerifying(true);
        setDobError('');

        try {
            const res = await axios.post(`${apiBase}/visit/guest/verify-dob`, {
                token,
                dob
            });

            if (res.data.success) {
                // Now join the call
                const joinRes = await axios.post(`${apiBase}/visit/guest/join`, { token });

                if (joinRes.data.success) {
                    setRoomUrl(joinRes.data.roomUrl);
                    setPatientName(joinRes.data.patientName);
                    setStatus('verified');
                } else {
                    setDobError(joinRes.data.error || 'Unable to join video room');
                }
            }
        } catch (error) {
            const msg = error.response?.data?.error || 'Verification failed';
            setDobError(msg);

            // If too many attempts, show invalid screen
            if (msg.includes('Too many')) {
                setStatus('invalid');
            }
        } finally {
            setVerifying(false);
        }
    };

    const handleLeaveCall = useCallback((reason = 'completed') => {
        setRoomUrl(null);
        setStatus(reason);
    }, []);

    // LOADING STATE
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Verifying your access link...</p>
                </div>
            </div>
        );
    }

    // COMPLETED / THANK YOU STATE
    if (status === 'completed') {
        return (
            <StatusScreen
                icon={Video}
                iconColor="bg-emerald-500 shadow-emerald-200"
                title="Visit Completed"
                message={`Thank you for attending your video visit with ${appointmentInfo?.providerName || 'your provider'}. Your session has successfully ended.`}
            >
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 italic">
                        "Your care is our priority. If you have follow-up questions, please reach out via the patient portal or call our office."
                    </div>
                    {/* Only show re-join if we think it's still alive (not from server status) */}
                    {roomUrl === null && appointmentInfo?.status !== 'completed' && (
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                            <RefreshCw size={20} />
                            Re-join Session
                        </button>
                    )}
                    <a
                        href="/portal/login"
                        className="block w-full py-3 text-slate-500 font-bold hover:text-blue-600 transition-colors text-sm"
                    >
                        Go to Patient Portal
                    </a>
                </div>
            </StatusScreen>
        );
    }

    // TOO EARLY STATE
    if (status === 'too_early') {
        const apptTime = appointmentInfo?.appointmentTime
            ? format(new Date(appointmentInfo.appointmentTime), 'h:mm a')
            : 'your scheduled time';

        return (
            <StatusScreen
                icon={Clock}
                iconColor="bg-amber-500 shadow-amber-200"
                title="You're a bit early"
                message={`Your appointment is scheduled for ${apptTime}. For your privacy, the secure video room will open 10 minutes before your start time.`}
            >
                <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                    <RefreshCw size={20} />
                    Refresh Page
                </button>
            </StatusScreen>
        );
    }

    // EXPIRED STATE
    if (status === 'expired') {
        return (
            <StatusScreen
                icon={Calendar}
                iconColor="bg-slate-400 shadow-slate-200"
                title="Link Expired"
                message="For security reasons, this temporary access link is no longer active. If you missed your appointment or need to reschedule, please contact our office."
                clinicPhone={appointmentInfo?.clinicPhone}
            >
                <a
                    href="/portal/login"
                    className="w-full py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 transition-all mb-4"
                >
                    Return to Patient Portal Login
                </a>
            </StatusScreen>
        );
    }

    // INVALID STATE
    if (status === 'invalid') {
        return (
            <StatusScreen
                icon={AlertCircle}
                iconColor="bg-red-500 shadow-red-200"
                title="Unable to Connect"
                message="We couldn't verify this secure link. This sometimes happens if the link was copied incorrectly or has already been used."
                clinicPhone={appointmentInfo?.clinicPhone || '(555) 555-5555'}
            />
        );
    }

    // VERIFIED STATE - Show Video
    if (status === 'verified' && roomUrl) {
        return (
            <div className="fixed inset-0 bg-slate-950 z-[99999] flex flex-col items-stretch overflow-hidden">
                {/* Header */}
                <div
                    className="bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0"
                    style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', height: 'calc(65px + env(safe-area-inset-top, 0px))' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-sm tracking-tight">Guest Video Visit</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-emerald-400" /> Secure • HIPAA Ready
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleLeaveCall}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl transition-all font-bold text-xs shadow-lg shadow-red-500/20"
                    >
                        <PhoneOff size={16} />
                        <span>Leave Session</span>
                    </button>
                </div>

                {/* Video Container */}
                <div className="flex-1 bg-black relative">
                    <div className="absolute inset-0 pt-2 px-1">
                        <DailyVideoCall
                            roomUrl={roomUrl}
                            userName={patientName}
                            onLeave={handleLeaveCall}
                        />
                    </div>
                </div>

                {/* Mobile Bottom Spacer */}
                <div className="h-[env(safe-area-inset-bottom)] bg-black shrink-0" />
            </div>
        );
    }

    // READY STATE - DOB Verification
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src="https://pagemdemr.com/logo.png"
                        alt="PageMD"
                        className="h-10 mx-auto mb-6"
                    />
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                        <Shield size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700">HIPAA Secure</span>
                    </div>
                </div>

                {/* Appointment Info */}
                {appointmentInfo && (
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Appointment</p>
                        <p className="text-lg font-bold text-slate-800">
                            {appointmentInfo.appointmentTime
                                ? format(new Date(appointmentInfo.appointmentTime), 'EEEE, MMMM d • h:mm a')
                                : 'Today'}
                        </p>
                        {appointmentInfo.providerName && (
                            <p className="text-sm text-slate-500">with {appointmentInfo.providerName}</p>
                        )}
                    </div>
                )}

                {/* DOB Verification Form */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-black text-slate-800 mb-2">Verify Your Identity</h1>
                    <p className="text-sm text-slate-500">
                        For your security, please confirm your date of birth to join the video visit.
                    </p>
                </div>

                <form onSubmit={handleVerifyDob} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                            Date of Birth
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                <Calendar size={20} />
                            </div>
                            <input
                                type="date"
                                value={dob}
                                onChange={(e) => setDob(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                required
                            />
                        </div>
                    </div>

                    {dobError && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm animate-in fade-in">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <span className="font-medium">{dobError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={verifying}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {verifying ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Verifying...</span>
                            </>
                        ) : (
                            <>
                                <Video size={20} />
                                <span>Join Video Visit</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Help Text */}
                {appointmentInfo?.clinicPhone && (
                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-400">
                            Need help? Call us at{' '}
                            <a href={`tel:${appointmentInfo.clinicPhone.replace(/[^\d]/g, '')}`} className="text-blue-600 font-semibold hover:underline">
                                {appointmentInfo.clinicPhone}
                            </a>
                        </p>
                    </div>
                )}

                <div className="mt-8 text-center">
                    <p className="text-xs font-semibold text-slate-400">
                        Secure Patient Portal • HIPAA Compliant
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GuestVisitPage;
