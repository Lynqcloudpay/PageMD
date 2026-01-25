import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
    Video, Mic, PhoneOff, Monitor, Layout, Shield, Signal,
    User, Clock, Calendar, ChevronLeft, AlertCircle, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

// Daily.co Prebuilt Component
const DailyVideoCall = ({ roomUrl, userName, onLeave }) => {
    const frameRef = useRef(null);
    const callFrameRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load Daily.co script
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
                callFrame.on('left-meeting', onLeave);
                callFrame.on('error', (e) => {
                    console.error('Daily.co error:', e);
                    setIsLoading(false);
                });
            }
        };
        document.body.appendChild(script);

        return () => {
            // Cleanup: Destroy call frame if it exists
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

const PortalTelehealth = ({ onSchedule }) => {
    const [appointments, setAppointments] = useState([]);
    const [activeCall, setActiveCall] = useState(null);
    const [roomUrl, setRoomUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [error, setError] = useState(null);

    // --- NEW: Prep & Consent State ---
    const [prepAppt, setPrepAppt] = useState(null);
    const [prepConsent, setPrepConsent] = useState(false);
    const [prepReady, setPrepReady] = useState({
        camera: false,
        mic: false,
        privacy: false,
        wifi: false,
    });

    const openPrep = (appt) => {
        setPrepAppt(appt);
        setPrepConsent(false);
        setPrepReady({ camera: false, mic: false, privacy: false, wifi: false });
    };

    const canJoin = prepConsent && Object.values(prepReady).every(Boolean);

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');
    const headers = { Authorization: `Bearer ${token}` };
    const patientStr = localStorage.getItem('patient');
    const patient = patientStr ? JSON.parse(patientStr) : {};

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const today = format(new Date(), 'yyyy-MM-dd');
            const response = await axios.get(`${apiBase}/portal/appointments`, { headers });

            const now = new Date();
            const telehealthAppts = response.data.filter(appt => {
                const type = (appt.appointment_type || '').toLowerCase();
                const visitMethod = (appt.visit_method || '').toLowerCase();

                const d = new Date(appt.appointment_date);
                const isToday = d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();

                return (type.includes('telehealth') || type.includes('video') || type.includes('virtual') || visitMethod === 'telehealth') &&
                    isToday &&
                    appt.status !== 'completed' &&
                    appt.patient_status !== 'checked_out';
            });

            setAppointments(telehealthAppts);
        } catch (err) {
            setError('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinCall = async (appt) => {
        setCreatingRoom(true);
        setError(null);

        try {
            // Create a Daily.co room via our portal backend endpoint
            const response = await axios.post(`${apiBase}/portal/telehealth/rooms`, {
                appointmentId: appt.id,
                patientName: `${patient.firstName || 'Patient'} ${patient.lastName || ''}`.trim(),
                providerName: appt.provider_name || 'Provider'
            }, { headers });

            if (response.data.success) {
                setRoomUrl(response.data.roomUrl);
                setActiveCall({ ...appt, roomName: response.data.roomName }); // Store roomName for cleanup
            } else {
                throw new Error('Failed to create room');
            }
        } catch (err) {
            console.error('Error joining call:', err);
            setError('Failed to join the secure video room. This may happen if the provider hasn\'t started the session yet.');
        } finally {
            setCreatingRoom(false);
        }
    };

    const handleEndCall = useCallback(async () => {
        setActiveCall(null);
        setRoomUrl(null);
    }, []);

    const handleScheduleNavigation = () => {
        if (onSchedule) {
            onSchedule();
        } else {
            window.location.href = '/portal/dashboard?tab=appointments';
        }
    };

    if (activeCall && roomUrl) {
        const userName = `${patient.firstName || 'Patient'} ${patient.lastName || 'User'}`.trim();

        return (
            <div className="fixed inset-0 bg-slate-950 z-[99999] flex flex-col items-stretch overflow-hidden">
                {/* Header with safe area padding */}
                <div
                    className="bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0"
                    style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', height: 'calc(65px + env(safe-area-inset-top, 0px))' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-sm tracking-tight">Active Visit</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-emerald-400" /> Secure • HIPAA Ready
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleEndCall}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl transition-all font-bold text-xs shadow-lg shadow-red-500/20"
                    >
                        <PhoneOff size={16} />
                        <span>Leave Session</span>
                    </button>
                </div>

                {/* Video container - with extra top padding for Daily.co UI icons */}
                <div className="flex-1 bg-black relative">
                    <div className="absolute inset-0 pt-2 px-1">
                        <DailyVideoCall
                            roomUrl={roomUrl}
                            userName={userName}
                            onLeave={handleEndCall}
                        />
                    </div>
                </div>

                {/* Mobile Bottom Spacer for iOS Home Indicator */}
                <div className="h-[env(safe-area-inset-bottom)] bg-black shrink-0" />
            </div>
        );
    }

    return (
        <div className="pb-28 animate-in fade-in duration-500">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Telehealth Center</h1>
                <p className="text-slate-500 text-sm mt-1">Connect securely with your provider.</p>
            </div>

            {/* Security Badge */}
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-200 shrink-0">
                    <Shield size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-green-900 text-sm">HIPAA-Ready Video</h3>
                    <p className="text-xs text-green-700">Secure and encrypted end-to-end.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">Loading appointments...</p>
                </div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                    <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700 mb-1">No Telehealth Visits Today</h3>
                    <p className="text-slate-500 text-sm mb-4">No virtual appointments for today.</p>
                    <button
                        onClick={handleScheduleNavigation}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                    >
                        Request Appointment
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Today's Virtual Visits</h2>
                    {appointments.map(appt => (
                        <div
                            key={appt.id}
                            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                    <Video size={22} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{appt.appointment_type || 'Virtual Visit'}</h3>
                                    <p className="text-xs text-slate-500">
                                        {appt.appointment_time ? format(new Date(`2000-01-01T${appt.appointment_time}`), 'h:mm a') : 'Scheduled'}
                                        {appt.provider_name && ` • Dr. ${appt.provider_name}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => openPrep(appt)}
                                disabled={creatingRoom}
                                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {creatingRoom ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Video size={18} />
                                )}
                                {creatingRoom ? 'Connecting...' : 'Join Visit Now'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* PREP MODAL */}
            {prepAppt && (
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300">
                    <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
                            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Prepare for your visit</h3>
                            <p className="text-slate-500 text-sm mt-2">
                                Please complete this quick checklist for a smooth video experience.
                            </p>
                        </div>

                        <div className="p-6 md:p-8 space-y-4 overflow-y-auto scrollbar-hide">
                            {[
                                ['camera', 'Allow camera access', 'Check your device settings'],
                                ['mic', 'Allow microphone access', 'Ensure your mic is working'],
                                ['privacy', 'I’m in a private place', 'Quiet environment for HIPAA privacy'],
                                ['wifi', 'I have a stable connection', 'Strong Wi-Fi or LTE signal'],
                            ].map(([k, label, sub]) => (
                                <label key={k} className="group flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${prepReady[k] ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={prepReady[k]}
                                            onChange={(e) => setPrepReady(r => ({ ...r, [k]: e.target.checked }))}
                                        />
                                        {prepReady[k] && <Video size={14} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-slate-700 font-bold block">{label}</span>
                                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{sub}</span>
                                    </div>
                                </label>
                            ))}

                            <label className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 hover:shadow-md transition-all cursor-pointer">
                                <div className={`w-6 h-6 rounded-lg border-2 mt-0.5 flex items-center justify-center transition-all ${prepConsent ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-300'}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={prepConsent}
                                        onChange={(e) => setPrepConsent(e.target.checked)}
                                    />
                                    {prepConsent && <Shield size={14} className="text-white" />}
                                </div>
                                <span className="text-emerald-900 text-sm leading-relaxed">
                                    I consent to a secure telehealth visit and understand that my personal health information will be protected.
                                </span>
                            </label>

                            <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-2 mt-2">
                                <button
                                    onClick={() => setPrepAppt(null)}
                                    className="flex-1 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!canJoin || creatingRoom}
                                    onClick={() => {
                                        setPrepAppt(null); // Close modal
                                        handleJoinCall(prepAppt);
                                    }}
                                    className="flex-1 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none"
                                >
                                    {creatingRoom ? 'Connecting…' : 'Join Visit Now'}
                                </button>
                            </div>

                            <p className="text-center text-[11px] text-slate-400 font-medium">
                                Technical support: If video fails, your provider may contact you via phone.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalTelehealth;
