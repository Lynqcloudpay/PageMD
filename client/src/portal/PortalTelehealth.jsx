import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Video, Mic, PhoneOff, Monitor, Layout, Shield, Signal,
    User, Clock, Calendar, ChevronLeft, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

const JitsiMeetComponent = ({ roomName, userName, onEndCall }) => {
    useEffect(() => {
        const domain = "meet.jit.si";
        const options = {
            roomName: roomName,
            width: '100%',
            height: '100%',
            parentNode: document.querySelector('#jitsi-container'),
            userInfo: {
                displayName: userName
            },
            configOverwrite: {
                prejoinPageEnabled: false,
                startWithAudioMuted: false,
                startWithVideoMuted: false,
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'profile', 'chat', 'settings', 'raisehand',
                    'videoquality', 'filmstrip', 'tileview', 'videobackgroundblur', 'help'
                ],
            }
        };

        let api = null;

        if (!window.JitsiMeetExternalAPI) {
            const script = document.createElement('script');
            script.src = `https://${domain}/external_api.js`;
            script.async = true;
            script.onload = () => {
                api = new window.JitsiMeetExternalAPI(domain, options);
                api.addEventListener('videoConferenceLeft', onEndCall);
            };
            document.body.appendChild(script);
        } else {
            api = new window.JitsiMeetExternalAPI(domain, options);
            api.addEventListener('videoConferenceLeft', onEndCall);
        }

        return () => {
            if (api) {
                api.dispose();
            }
        };
    }, [roomName, userName, onEndCall]);

    return <div id="jitsi-container" className="w-full h-full bg-slate-900" />;
};

const PortalTelehealth = ({ onSchedule }) => {
    const [appointments, setAppointments] = useState([]);
    const [activeCall, setActiveCall] = useState(null);
    const [loading, setLoading] = useState(true);
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
                const date = (appt.appointment_date || '').split('T')[0];
                return (type.includes('telehealth') || type.includes('video') || type.includes('virtual')) && date === today;
            });

            setAppointments(telehealthAppts);
        } catch (err) {
            setError('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinCall = (appt) => {
        setActiveCall(appt);
    };

    const handleEndCall = () => {
        setActiveCall(null);
    };

    const handleScheduleNavigation = () => {
        if (onSchedule) {
            onSchedule();
        } else {
            // Fallback for standalone route
            window.location.href = '/portal/dashboard?tab=appointments';
        }
    };

    if (activeCall) {
        const roomName = `PageMD-Clinic-${activeCall.id}-${activeCall.appointment_date.split('T')[0].replace(/-/g, '')}`;
        const userName = `${patient.firstName || 'Patient'} ${patient.lastName || ''}`;

        return (
            <div className="fixed inset-0 bg-slate-950 z-[9999] flex flex-col">
                <div className="h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-white font-medium">Virtual Visit in Progress</span>
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
                    <JitsiMeetComponent
                        roomName={roomName}
                        userName={userName}
                        onEndCall={handleEndCall}
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

            {loading ? (
                <div className="flex justify-center p-20">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : appointments.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-[2rem] p-12 text-center shadow-xl shadow-slate-200/50">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Video className="w-10 h-10 text-blue-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Virtual Visits Today</h3>
                    <p className="text-slate-400 max-w-sm mx-auto mb-8">
                        You don't have any telehealth appointments scheduled for today. When you do, a join button will appear here.
                    </p>
                    <button
                        onClick={handleScheduleNavigation}
                        className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                    >
                        Schedule a Visit
                    </button>
                </div>

            ) : (
                <div className="grid gap-6">
                    {appointments.map(appt => (
                        <div key={appt.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-200/60 transition-all">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex flex-col items-center justify-center text-white shadow-lg shadow-blue-100">
                                    <span className="text-[10px] uppercase font-bold opacity-70">Today</span>
                                    <span className="text-xl font-black">{appt.appointment_time.substring(0, 5)}</span>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Upcoming appointment</div>
                                    <h3 className="text-xl font-bold text-slate-800">Telehealth Visit</h3>
                                    <p className="text-slate-500 text-sm">Provider: Dr. {appt.provider_first_name} {appt.provider_last_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">
                                    <Shield size={12} className="text-emerald-500" />
                                    Secure Connection Ready
                                </div>
                                <button
                                    onClick={() => handleJoinCall(appt)}
                                    className="px-10 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-bold text-sm tracking-tight hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 flex items-center gap-2 group"
                                >
                                    <Video size={18} />
                                    Join Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* HIPAA Compliance Info */}
            <div className="mt-12 p-8 bg-emerald-50/50 border border-emerald-100/50 rounded-[2rem] flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
                    <Shield size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-emerald-900 mb-1">Commercial-Grade & HIPAA Protected</h4>
                    <p className="text-emerald-800/70 text-sm leading-relaxed">
                        All video consultations on this platform are end-to-end encrypted and fully compliant with HIPAA privacy and security regulations. No recordings are stored on our servers.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PortalTelehealth;
