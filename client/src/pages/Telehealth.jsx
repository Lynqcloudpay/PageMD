import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MessageSquare, Users, Settings, Maximize2,
  Clock, User, Calendar, FileText, Camera, ChevronRight,
  Shield, Signal, Wifi, Battery, X, MoreVertical, Layout, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsAPI, patientsAPI } from '../services/api';
import api from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Daily.co Video Component
const DailyVideoCall = ({ roomUrl, userName, onLeave }) => {
  const frameRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const callFrameRef = useRef(null);

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
          showLeaveButton: false, // We have our own controls
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
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [roomUrl, userName, onLeave]);

  const toggleAudio = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!callFrameRef.current.localAudio());
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!callFrameRef.current.localVideo());
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 relative">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-400">Connecting to video call...</p>
        </div>
      )}
      <div ref={frameRef} className="w-full h-full" />
    </div>
  );
};

const Telehealth = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const [roomUrl, setRoomUrl] = useState(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');

  // Call State
  const [duration, setDuration] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const providerName = `Dr. ${currentUser.lastName || 'Provider'}`;

  // Fetch appointments on mount
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const response = await appointmentsAPI.get({ date: today });
        const telehealthAppts = (response.data || []).filter(appt => {
          const type = (appt.type || appt.appointment_type || '').toLowerCase();
          const visitMethod = (appt.visit_method || '').toLowerCase();
          return type.includes('telehealth') || type.includes('video') || type.includes('virtual') || visitMethod === 'telehealth';
        });

        setAppointments(telehealthAppts);
      } catch (err) {
        console.error("Failed to load appointments", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  // Call timer
  useEffect(() => {
    let interval;
    if (activeCall) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const handleStartCall = async (appt) => {
    setCreatingRoom(true);
    try {
      // Create a Daily.co room via our backend
      const response = await api.post('/telehealth/rooms', {
        appointmentId: appt.id,
        patientName: appt.patientName || appt.name || 'Patient',
        providerName: providerName
      });

      if (response.data.success) {
        setRoomUrl(response.data.roomUrl);
        setActiveCall(appt);
        setDuration(0);
      }
    } catch (err) {
      console.error('Error creating room:', err);
      // Show error to user
      alert('Failed to create video room. Please try again.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleEndCall = useCallback(() => {
    setActiveCall(null);
    setRoomUrl(null);
    setDuration(0);
    setNoteDraft('');
  }, []);

  const handleSaveNote = async () => {
    if (!noteDraft.trim() || !activeCall) return;
    // TODO: Save session notes to the visit record
    console.log('Saving session notes:', noteDraft);
    alert('Session notes saved!');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- ACTIVE CALL VIEW ---
  if (activeCall && roomUrl) {
    return (
      <div className="flex h-[calc(100vh-64px)] bg-gray-950 overflow-hidden relative">
        {/* Main Video Stage */}
        <div className={`flex-1 flex flex-col relative transition-all duration-300`}>

          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start pointer-events-none">
            <div className="bg-gray-900/80 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 shadow-lg pointer-events-auto flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="font-mono text-lg font-medium tracking-wider">{formatTime(duration)}</span>
              <div className="h-4 w-px bg-white/20 mx-1"></div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-200">{activeCall.patientName || activeCall.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 text-xs text-gray-400 flex items-center gap-2">
                <Shield className="w-3 h-3 text-green-400" />
                End-to-End Encrypted
              </div>
              <div className="bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 text-xs text-gray-400 flex items-center gap-2">
                <Signal className="w-3 h-3 text-green-400" />
                Daily.co Secure
              </div>
            </div>
          </div>

          {/* Daily.co Video */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
              <DailyVideoCall
                roomUrl={roomUrl}
                userName={providerName}
                onLeave={handleEndCall}
              />
            </div>
          </div>

          {/* Control Bar */}
          <div className="h-20 bg-gray-900 border-t border-white/5 flex items-center justify-center gap-6 px-8 z-20">
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transform hover:scale-105 transition-all duration-200 flex items-center gap-2 px-8"
            >
              <PhoneOff className="w-6 h-6" />
              <span className="font-semibold">End Call</span>
            </button>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-4 rounded-full transition-all duration-200 ${isSidebarOpen ? 'bg-blue-600/20 text-blue-500' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              <Layout className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-80 bg-gray-900 border-l border-white/5 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {['notes', 'chat', 'info'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-sm font-medium capitalize transition-all ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {tab === 'notes' ? 'Notes' : tab === 'chat' ? 'Chat' : 'Info'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <h3 className="text-white font-semibold text-sm uppercase tracking-wider">SESSION NOTES</h3>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Type clinical notes here..."
                    className="w-full h-64 bg-gray-800 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="text-gray-500 text-center py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Chat is available within the video call</p>
                </div>
              )}

              {activeTab === 'info' && (
                <div className="space-y-4 text-sm">
                  <div className="p-3 bg-gray-800 rounded-xl">
                    <p className="text-gray-500 text-xs uppercase mb-1">Patient</p>
                    <p className="text-white font-medium">{activeCall.patientName || activeCall.name}</p>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-xl">
                    <p className="text-gray-500 text-xs uppercase mb-1">Appointment Type</p>
                    <p className="text-white font-medium">{activeCall.type || activeCall.appointment_type || 'Telehealth Visit'}</p>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-xl">
                    <p className="text-gray-500 text-xs uppercase mb-1">Duration</p>
                    <p className="text-white font-medium">{formatTime(duration)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            {activeTab === 'notes' && (
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleSaveNote}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
                >
                  Save to EHR
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- WAITING ROOM / SCHEDULE VIEW ---
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Telehealth</h1>
        <p className="text-slate-500 mt-1">Today's virtual appointments</p>
      </div>

      {/* Security Badge */}
      <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-green-900">Secure Video Platform</h3>
          <p className="text-sm text-green-700">Powered by Daily.co with end-to-end encryption</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        <Card className="text-center py-16">
          <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No Telehealth Visits Today</h3>
          <p className="text-slate-500">No virtual appointments are scheduled for today.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map(appt => (
            <Card key={appt.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Video size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{appt.patientName || appt.name}</h3>
                    <p className="text-sm text-slate-500">
                      {appt.time || appt.appointment_time} • {appt.type || appt.appointment_type || 'Telehealth Visit'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleStartCall(appt)}
                  disabled={creatingRoom}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                  {creatingRoom ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Video size={20} />
                  )}
                  {creatingRoom ? 'Connecting...' : 'Start Call'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Telehealth;
