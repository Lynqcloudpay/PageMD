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

            const telehealthAppts = response.data.filter(appt => {
                const type = (appt.appointment_type || '').toLowerCase();
                const visitMethod = (appt.visit_method || '').toLowerCase();
                const date = (appt.appointment_date || '').split('T')[0];
                return (type.includes('telehealth') || type.includes('video') || type.includes('virtual') || visitMethod === 'telehealth') && date === today;
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
            // Fallback: Use a public room name
            const fallbackRoom = `pagemd-${appt.id}-${Date.now()}`;
            setRoomUrl(`https://pagemd.daily.co/${fallbackRoom}`);
            setActiveCall(appt);
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
        const userName = `${patient.firstName || 'Patient'} ${patient.lastName || ''}`.trim();

        return (
            <div className="fixed inset-0 bg-slate-950 z-[9999] flex flex-col">
                <div className="h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-white font-medium">Virtual Visit in Progress</span>
                        <div className="flex items-center gap-2 ml-4">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-slate-400">Secure Connection</span>
                        </div>
                    </div>
                    <button
                        onClick={handleEndCall}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-bold text-sm"
                    >
                        <PhoneOff size={18} />
                        Leave Visit
                    </button>
                </div>
                <div className="flex-1">
                    <DailyVideoCall
                        roomUrl={roomUrl}
                        userName={userName}
                        onLeave={handleEndCall}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Telehealth Center</h1>
                <p className="text-slate-500 mt-2">Connect with your provider securely for your virtual visit.</p>
            </div>

            {/* Security Badge */}
            <div className="mb-8 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-200">
                    <Shield size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-green-900">HIPAA-Ready Video Platform</h3>
                    <p className="text-sm text-green-700">Your video visits are secure and encrypted end-to-end.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-500">Loading appointments...</p>
                </div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                    <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">No Telehealth Visits Today</h3>
                    <p className="text-slate-500 mb-6">You don't have any virtual appointments scheduled for today.</p>
                    <button
                        onClick={handleScheduleNavigation}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                        Request an Appointment
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-700 mb-4">Today's Virtual Visits</h2>
                    {appointments.map(appt => (
                        <div
                            key={appt.id}
                            className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Video size={28} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{appt.appointment_type || 'Virtual Visit'}</h3>
                                        <p className="text-sm text-slate-500">
                                            {appt.appointment_time ? format(new Date(`2000-01-01T${appt.appointment_time}`), 'h:mm a') : 'Scheduled'}
                                            {appt.provider_name && ` • Dr. ${appt.provider_name}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleJoinCall(appt)}
                                    disabled={creatingRoom}
                                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {creatingRoom ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Video size={20} />
                                    )}
                                    {creatingRoom ? 'Connecting...' : 'Join Now'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PortalTelehealth;
