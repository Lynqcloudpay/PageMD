import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MessageSquare, Users, Settings, Maximize2,
  Clock, User, Calendar, FileText, Camera, ChevronRight,
  Shield, Signal, Wifi, Battery, X, MoreVertical, Layout
} from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsAPI, patientsAPI } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Jitsi Meet Hook
const useJitsiMeet = (active, roomName, userName, containerId) => {
  const [jitsiAPI, setJitsiAPI] = useState(null);

  useEffect(() => {
    if (!active || !roomName || !containerId) return;

    const domain = "meet.jit.si";
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: document.querySelector(`#${containerId}`),
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
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
          'security'
        ],
      }
    };

    // Dynamically load Jitsi script if not present
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = () => {
        const api = new window.JitsiMeetExternalAPI(domain, options);
        setJitsiAPI(api);
      };
      document.body.appendChild(script);
    } else {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      setJitsiAPI(api);
    }

    return () => {
      if (jitsiAPI) {
        jitsiAPI.dispose();
      }
    };
  }, [active, roomName, containerId]);

  return jitsiAPI;
};

const Telehealth = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');

  // Call State
  const [duration, setDuration] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const providerName = `Dr. ${currentUser.lastName || 'Provider'}`;

  const roomName = activeCall ? `PageMD-Clinic-${activeCall.id || 'Session'}-${activeCall.appointment_date || format(new Date(), 'yyyyMMdd')}` : null;

  const jitsiAPI = useJitsiMeet(!!activeCall, roomName, providerName, 'jitsi-container');

  // Fetch appointments on mount
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const response = await appointmentsAPI.get({ date: today });
        const telehealthAppts = (response.data || []).filter(appt => {
          const type = (appt.type || '').toLowerCase();
          return type.includes('telehealth') || type.includes('video') || type.includes('virtual');
        });

        // For demo purposes, we'll mark some as 'Ready' if they are close to now
        const enhancedAppts = telehealthAppts.map(appt => ({
          ...appt,
          status: Math.random() > 0.5 ? 'ready' : 'scheduled' // Mock status
        }));
        setAppointments(enhancedAppts);
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
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const handleStartCall = (patient) => {
    setActiveCall(patient);
    setDuration(0);
    // Add system message
    setChatMessages([{
      id: 'sys-1',
      sender: 'system',
      text: 'Secure HIPAA-compliant connection established via Jitsi Meet. Session is end-to-end encrypted.',
      time: new Date()
    }]);
  };

  const handleEndCall = () => {
    if (window.confirm("End this telehealth session?")) {
      if (jitsiAPI) jitsiAPI.executeCommand('hangup');
      setActiveCall(null);
      setDuration(0);
      setChatMessages([]);
      setNoteDraft('');
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'me',
      text: newMessage,
      time: new Date()
    }]);
    setNewMessage('');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- RENDERERS ---

  if (activeCall) {
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
                Commercial Grade
              </div>
            </div>
          </div>

          {/* Jitsi Video Center */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
              <div id="jitsi-container" className="w-full h-full" />
            </div>
          </div>

          {/* Control Bar */}
          <div className="h-20 bg-gray-900 border-t border-white/5 flex items-center justify-center gap-6 px-8 z-20">
            <button
              onClick={() => {
                if (jitsiAPI) jitsiAPI.executeCommand('toggleAudio');
              }}
              className={`p-4 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200`}
            >
              <Mic className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                if (jitsiAPI) jitsiAPI.executeCommand('toggleVideo');
              }}
              className={`p-4 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200`}
            >
              <Video className="w-6 h-6" />
            </button>

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transform hover:scale-105 transition-all duration-200 flex items-center gap-2 px-8"
            >
              <PhoneOff className="w-6 h-6" />
              <span className="font-semibold">End Call</span>
            </button>

            <button
              onClick={() => {
                if (jitsiAPI) jitsiAPI.executeCommand('toggleShareScreen');
              }}
              className="p-4 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200"
            >
              <Monitor className="w-6 h-6" />
            </button>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-4 rounded-full transition-all duration-200 ${isSidebarOpen ? 'bg-blue-600/20 text-blue-500' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              <Layout className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sidebar Panel */}
        {isSidebarOpen && (
          <div className="w-96 bg-gray-900 border-l border-white/5 flex flex-col shadow-2xl z-30 animate-slide-in-right">
            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {['notes', 'chat', 'info'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto bg-gray-800/50">
              {activeTab === 'notes' && (
                <div className="p-4 h-full flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Session Notes
                  </label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Type clinical notes here..."
                    className="flex-1 w-full bg-gray-900/50 border border-white/10 rounded-lg p-4 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-none font-sans leading-relaxed"
                  />
                  <div className="mt-4 flex justify-end">
                    <Button size="sm">Save to EMR</Button>
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.sender === 'system' ? 'w-full text-center bg-transparent text-gray-500 text-xs italic' :
                          msg.sender === 'me' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'
                          }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-gray-900">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-800 border-transparent rounded-full px-4 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button type="submit" className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-700">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'info' && (
                <div className="p-6 space-y-6">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-700 mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gray-400">
                      {(activeCall.patientName?.[0] || 'P')}
                    </div>
                    <h3 className="text-lg font-medium text-white">{activeCall.patientName}</h3>
                    <p className="text-sm text-gray-500">DOB: {activeCall.patientDob || 'N/A'}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Reason for Visit</label>
                      <p className="text-gray-300 text-sm mt-1">{activeCall.chiefComplaint || activeCall.reason || 'Follow-up'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Vitals (Last Visit)</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-gray-800 p-2 rounded text-center">
                          <div className="text-xs text-gray-500">BP</div>
                          <div className="text-sm text-white">120/80</div>
                        </div>
                        <div className="bg-gray-800 p-2 rounded text-center">
                          <div className="text-xs text-gray-500">HR</div>
                          <div className="text-sm text-white">72</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DASHBOARD VIEW ---

  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-8 animate-fade-in text-deep-gray">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-deep-gray tracking-tight">Telehealth Center</h1>
          <p className="text-deep-gray/70 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Operational • Ready for visits
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" icon={Settings}>Device Settings</Button>
          <Button variant="primary" icon={Wifi}>Test Connection</Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Col: Upcoming Schedule */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-t-4 border-t-strong-azure overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-deep-gray flex items-center gap-2">
                <Calendar className="w-5 h-5 text-strong-azure" />
                Today's Schedule
              </h2>
              <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                {appointments.length} Appointments
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-12 text-center text-gray-400">Loading schedule...</div>
              ) : appointments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-medium">No appointments today</h3>
                  <p className="text-gray-500 text-sm mt-1">Scheduled telehealth visits will appear here.</p>
                </div>
              ) : (
                appointments.map(appt => (
                  <div key={appt.id} className="p-6 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-deep-gray">{appt.time}</div>
                          <div className="text-xs text-gray-500 uppercase font-medium">{parseInt(appt.time) >= 12 ? 'PM' : 'AM'}</div>
                        </div>
                        <div>
                          <h3 className="font-bold text-deep-gray text-lg group-hover:text-strong-azure transition-colors">
                            {appt.patientName || appt.name}
                          </h3>
                          <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium text-gray-600">
                              {appt.type || 'Follow-up'}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{appt.reason || 'Routine Checkup'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {appt.status === 'ready' ? (
                          <span className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold border border-green-100">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Checked In
                          </span>
                        ) : (
                          <span className="hidden md:inline-flex px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                            Scheduled
                          </span>
                        )}

                        <Button
                          size="sm"
                          className={appt.status === 'ready' ? 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200' : ''}
                          onClick={() => handleStartCall(appt)}
                          icon={Video}
                        >
                          Start Visit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Col: Waiting Room & Quick Actions */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="p-6 relative z-10">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-white/80" />
                Virtual Waiting Room
              </h3>
              <div className="text-4xl font-bold mb-1">
                {appointments.filter(a => a.status === 'ready').length}
              </div>
              <p className="text-indigo-100 text-sm mb-6">Patients currently in waiting room</p>

              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/10">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-indigo-200">Average Wait Time</span>
                  <span className="font-bold">4m 12s</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                  <div className="w-[30%] h-full bg-green-400 rounded-full"></div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100 font-bold text-deep-gray">Quick Invite</div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Send an immediate telehealth link to a patient via SMS or Email.</p>
              <input
                type="text"
                placeholder="Enter phone number or email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-strong-azure/50 focus:border-strong-azure outline-none transition-all"
              />
              <Button variant="outline" className="w-full justify-center">Send Invite</Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default Telehealth;






