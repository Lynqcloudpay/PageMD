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

        callFrame.on('joined-meeting', () => {
          setIsLoading(false);
          setConnectionStatus('Connected');
        });
        callFrame.on('left-meeting', onLeave);
        callFrame.on('participant-joined', () => setParticipantCount(prev => prev + 1));
        callFrame.on('participant-left', () => setParticipantCount(prev => prev - 1));
        callFrame.on('error', (e) => {
          console.error('Daily.co error:', e);
          setIsLoading(false);
          setConnectionStatus('Error');
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

  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [participantCount, setParticipantCount] = useState(1); // Provider themselves

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
          <p className="text-gray-400">Connecting to secure video call...</p>
        </div>
      )}

      {/* Connection Status Overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-[10px] uppercase tracking-wider text-white font-medium">{connectionStatus}</span>
        </div>
        {connectionStatus === 'Connected' && (
          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] uppercase tracking-wider text-white font-medium">
              {participantCount > 1 ? 'Patient in Room' : 'Waiting for Patient...'}
            </span>
          </div>
        )}
      </div>

      <div ref={frameRef} className="w-full h-full" />
    </div>
  );
};

const Telehealth = () => {
  // --- NEW: Workspace Tabs ---
  const WORKSPACE_TABS = ['chart', 'note', 'orders', 'avs', 'info'];

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const [roomUrl, setRoomUrl] = useState(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('note'); // default to note during visit
  const [activeEncounter, setActiveEncounter] = useState(null);

  // --- NEW: Chart Snapshot (best-effort) ---
  const [patientSnapshot, setPatientSnapshot] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  // --- NEW: Structured note state ---
  const [note, setNote] = useState({
    chiefComplaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    dx: '',
  });

  const isLocked = activeEncounter?.status === 'signed';

  // --- NEW: Orders state (pended UX) ---
  const [pendedOrders, setPendedOrders] = useState([]);
  // { id, type: 'lab'|'imaging'|'med'|'referral', text, status:'pended'|'signed' }

  // --- NEW: AVS state ---
  const [avs, setAvs] = useState({
    instructions: '',
    followUp: '',
    returnPrecautions: '',
  });

  // Helpers
  const storageKeyFor = (apptId) => `telehealth_draft_${apptId}`;

  const safeJsonParse = (v) => {
    try { return JSON.parse(v); } catch { return null; }
  };

  const addOrder = async (type, text) => {
    const clean = (text || '').trim();
    if (!clean) return;

    if (activeEncounter) {
      try {
        const res = await api.post("/clinical_orders", {
          encounter_id: activeEncounter.id,
          type,
          text: clean
        });
        setPendedOrders(prev => [res.data, ...prev]);
        return;
      } catch (err) {
        console.error('Error adding order to server:', err);
      }
    }

    // Fallback/Local
    setPendedOrders(prev => [
      { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, type, text: clean, status: 'pended' },
      ...prev
    ]);
  };

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

  // --- NEW: Persistence Effects ---
  // When a call starts, load drafts (notes + orders + avs)
  useEffect(() => {
    if (!activeCall?.id) return;

    const cached = safeJsonParse(localStorage.getItem(storageKeyFor(activeCall.id)));
    if (cached?.note) setNote(cached.note);
    if (cached?.pendedOrders) setPendedOrders(cached.pendedOrders);
    if (cached?.avs) setAvs(cached.avs);

    // Default tab
    setActiveTab('note');
  }, [activeCall?.id]);

  // Autosave drafts (debounced)
  useEffect(() => {
    if (!activeCall?.id) return;

    const t = setTimeout(() => {
      localStorage.setItem(
        storageKeyFor(activeCall.id),
        JSON.stringify({
          note,
          pendedOrders,
          avs,
          updatedAt: new Date().toISOString(),
        })
      );
      // Also try server save if encounter active
      if (activeEncounter) handleSaveDraft();
    }, 1000); // 1s debounce

    return () => clearTimeout(t);
  }, [note, pendedOrders, avs, activeCall?.id, activeEncounter]);

  // Keep encounter alive (server heartbeat)
  useEffect(() => {
    if (!activeEncounter?.id) return;

    const interval = setInterval(async () => {
      try {
        await api.patch(`/encounters/${activeEncounter.id}`, {
          updated_at: new Date().toISOString()
        });
      } catch (e) { }
    }, 60000);

    return () => clearInterval(interval);
  }, [activeEncounter?.id]);

  // --- NEW: Chart Fetching ---
  const fetchPatientSnapshot = useCallback(async () => {
    if (!activeCall) return;
    const patientId = activeCall.patientId || activeCall.patient_id || activeCall.pid;

    setChartLoading(true);
    setPatientSnapshot(null);

    try {
      // Try a few common patterns; fail silently to keep UX smooth.
      let res = null;

      // Pattern A: patientsAPI.getById(id)
      if (patientsAPI?.getById && patientId) {
        res = await patientsAPI.getById(patientId);
        setPatientSnapshot(res?.data || res);
        return;
      }

      // Pattern B: /patients/:id
      if (patientId) {
        res = await api.get(`/patients/${patientId}`);
        setPatientSnapshot(res?.data || null);
        return;
      }

      // Pattern C: if appt already has basics, show those
      setPatientSnapshot({
        name: activeCall.patientName || activeCall.name,
        dob: activeCall.dob,
        phone: activeCall.phone,
      });
    } catch (e) {
      // graceful fallback
      setPatientSnapshot({
        name: activeCall.patientName || activeCall.name,
        dob: activeCall.dob,
        phone: activeCall.phone,
        _error: true,
      });
    } finally {
      setChartLoading(false);
    }
  }, [activeCall]);

  useEffect(() => {
    if (activeCall) fetchPatientSnapshot();
  }, [activeCall, fetchPatientSnapshot]);

  const handleStartCall = async (appt) => {
    setCreatingRoom(true);
    try {
      // 1. Create/Start Encounter in our backend
      const patientId = appt.patientId || appt.patient_id || appt.pid;

      // Check if encounter already exists for this appointment
      let encounter;
      try {
        const existing = await api.get(`/encounters?appointment_id=${appt.id}`);
        if (existing.data && existing.data.length > 0) {
          encounter = existing.data[0];
        } else {
          const encounterRes = await api.post("/encounters", {
            appointment_id: appt.id,
            provider_id: currentUser.id,
            patient_id: patientId,
            start_time: new Date().toISOString()
          });
          encounter = encounterRes.data;
        }
      } catch (e) {
        console.error("Encounter check failed:", e);
        // Fallback to try create anyway
        const encounterRes = await api.post("/encounters", {
          appointment_id: appt.id,
          provider_id: currentUser.id,
          patient_id: patientId,
          start_time: new Date().toISOString()
        });
        encounter = encounterRes.data;
      }

      setActiveEncounter(encounter);

      // 2. Create a Daily.co room via our backend
      const response = await api.post('/telehealth/rooms', {
        appointmentId: appt.id,
        patientName: appt.patientName || appt.name || 'Patient',
        providerName: providerName
      });

      if (response.data.success) {
        setRoomUrl(response.data.roomUrl);
        setActiveCall({ ...appt, roomName: response.data.roomName }); // Store roomName for cleanup
        setDuration(0);
      }
    } catch (err) {
      console.error('Error starting call/encounter:', err);
      alert('Failed to start visit. Please check your connection and try again.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleEndCall = useCallback(async () => {
    setActiveCall(null);
    setRoomUrl(null);
    setDuration(0);
    setActiveEncounter(null);
    setNote({
      chiefComplaint: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      dx: '',
    });
    setPendedOrders([]);
    setAvs({
      instructions: '',
      followUp: '',
      returnPrecautions: '',
    });
  }, []);

  const handleSaveDraft = async () => {
    if (!activeEncounter) return;
    try {
      // 1. Save Note
      await api.post("/clinical_notes", {
        encounter_id: activeEncounter.id,
        note: note,
        dx: note.dx.split(",").map(d => d.trim())
      });

      // 2. Save AVS
      await api.post("/after_visit_summaries", {
        encounter_id: activeEncounter.id,
        instructions: avs.instructions,
        follow_up: avs.followUp,
        return_precautions: avs.returnPrecautions
      });

      console.log('Draft saved to EHR.');
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  };

  const handleFinalizeVisit = async () => {
    if (!activeEncounter) return;
    if (isLocked) {
      alert("Encounter is already finalized.");
      return;
    }

    if (!window.confirm("Are you sure you want to finalize and sign this visit? This will lock the encounter for edits.")) {
      return;
    }

    try {
      // 1. Save everything
      await handleSaveDraft();

      // 2. Sign Note
      await api.patch(`/clinical_notes/${activeEncounter.id}/sign`);

      // 3. Sign pended orders
      for (let o of pendedOrders) {
        if (o.status === 'pending' || o.status === 'pended') {
          await api.patch(`/clinical_orders/${o.id}/sign`);
        }
      }
      setPendedOrders(prev => prev.map(o => ({ ...o, status: 'signed' })));

      // 4. Finalize Encounter
      await api.patch(`/encounters/${activeEncounter.id}/finalize`);

      // Clear local draft
      localStorage.removeItem(storageKeyFor(activeCall.id));

      alert('Visit finalized and pushed to record!');
      handleEndCall();
    } catch (err) {
      console.error('Error finalizing visit:', err);
      alert('Failed to finalize visit. Please ensure all required fields are complete.');
    }
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
              {WORKSPACE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-xs font-semibold uppercase tracking-wider transition-all
                    ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'chart' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm uppercase tracking-wider">CHART</h3>
                    <button
                      onClick={fetchPatientSnapshot}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="p-3 bg-gray-800 rounded-xl border border-white/5">
                    <p className="text-gray-500 text-xs uppercase mb-1">Patient</p>
                    <p className="text-white font-medium">{activeCall.patientName || activeCall.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-gray-900/40 rounded-lg">
                        <p className="text-gray-500">DOB</p>
                        <p className="text-gray-200">{patientSnapshot?.dob || activeCall.dob || '—'}</p>
                      </div>
                      <div className="p-2 bg-gray-900/40 rounded-lg">
                        <p className="text-gray-500">Phone</p>
                        <p className="text-gray-200">{patientSnapshot?.phone || activeCall.phone || '—'}</p>
                      </div>
                    </div>
                    {chartLoading && <p className="mt-2 text-xs text-gray-500">Loading chart…</p>}
                    {patientSnapshot?._error && (
                      <p className="mt-2 text-xs text-amber-400">
                        Couldn’t load full chart snapshot (showing available appointment data).
                      </p>
                    )}
                  </div>

                  {/* Quick chart nav placeholders (wire later) */}
                  <div className="grid grid-cols-2 gap-2">
                    {['Medications', 'Allergies', 'Problems', 'Labs', 'Imaging', 'Documents'].map(x => (
                      <button
                        key={x}
                        className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-left border border-white/5 transition-colors"
                        onClick={() => alert(`${x} panel coming next (wire to your chart endpoints).`)}
                      >
                        <p className="text-white text-sm font-semibold">{x}</p>
                        <p className="text-gray-500 text-xs">Open</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'note' && (
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm uppercase tracking-wider">NOTE BUILDER</h3>

                  <input
                    value={note.chiefComplaint}
                    onChange={(e) => setNote(n => ({ ...n, chiefComplaint: e.target.value }))}
                    placeholder="Chief Complaint"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    readOnly={isLocked}
                  />

                  <textarea
                    value={note.subjective}
                    onChange={(e) => setNote(n => ({ ...n, subjective: e.target.value }))}
                    placeholder="Subjective (HPI / ROS)"
                    className="w-full h-28 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />

                  <textarea
                    value={note.objective}
                    onChange={(e) => setNote(n => ({ ...n, objective: e.target.value }))}
                    placeholder="Objective (Vitals / Exam)"
                    className="w-full h-24 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />

                  <textarea
                    value={note.assessment}
                    onChange={(e) => setNote(n => ({ ...n, assessment: e.target.value }))}
                    placeholder="Assessment"
                    className="w-full h-20 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />

                  <textarea
                    value={note.plan}
                    onChange={(e) => setNote(n => ({ ...n, plan: e.target.value }))}
                    placeholder="Plan"
                    className="w-full h-28 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />

                  <input
                    value={note.dx}
                    onChange={(e) => setNote(n => ({ ...n, dx: e.target.value }))}
                    placeholder="Diagnoses (comma separated)"
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    readOnly={isLocked}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      onClick={() => setNote(n => ({ ...n, plan: (n.plan + (n.plan ? '\n' : '') + 'Return precautions reviewed.') }))}
                      disabled={isLocked}
                    >
                      + Return precautions
                    </button>
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      onClick={() => setNote(n => ({ ...n, plan: (n.plan + (n.plan ? '\n' : '') + 'Follow up in 2–4 weeks or sooner PRN.') }))}
                      disabled={isLocked}
                    >
                      + Follow-up
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm uppercase tracking-wider">ORDERS</h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      disabled={isLocked}
                      onClick={() => {
                        const text = prompt('Add Lab Order (e.g., CBC, CMP, A1c):');
                        if (text) addOrder('lab', text);
                      }}
                    >
                      + Lab
                    </button>
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      disabled={isLocked}
                      onClick={() => {
                        const text = prompt('Add Imaging Order (e.g., XR Chest, CT Abdomen):');
                        if (text) addOrder('imaging', text);
                      }}
                    >
                      + Imaging
                    </button>
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      disabled={isLocked}
                      onClick={() => {
                        const text = prompt('Add Medication (e.g., Amoxicillin 500mg BID x7d):');
                        if (text) addOrder('med', text);
                      }}
                    >
                      + Medication
                    </button>
                    <button
                      className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-white/5 disabled:opacity-50"
                      disabled={isLocked}
                      onClick={() => {
                        const text = prompt('Add Referral (e.g., Cardiology):');
                        if (text) addOrder('referral', text);
                      }}
                    >
                      + Referral
                    </button>
                  </div>

                  <div className="space-y-2">
                    {pendedOrders.length === 0 ? (
                      <div className="text-gray-500 text-sm p-3 bg-gray-800 rounded-xl border border-white/5">
                        No orders yet. Add orders while you talk, then sign at close-out.
                      </div>
                    ) : (
                      pendedOrders.map(o => (
                        <div key={o.id} className="p-3 bg-gray-800 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-white text-sm font-semibold capitalize">{o.type}</p>
                            <p className="text-gray-300 text-sm">{o.text}</p>
                            <p className="text-gray-500 text-xs mt-1">Status: {o.status}</p>
                          </div>
                          <button
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                            onClick={() => setPendedOrders(prev => prev.filter(x => x.id !== o.id))}
                            disabled={isLocked}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50"
                    onClick={async () => {
                      if (!activeEncounter) return;
                      try {
                        for (let o of pendedOrders) {
                          if (o.status === 'pending' || o.status === 'pended') {
                            await api.patch(`/clinical_orders/${o.id}/sign`);
                          }
                        }
                        setPendedOrders(prev => prev.map(o => ({ ...o, status: 'signed' })));
                        alert('Orders marked as signed.');
                      } catch (err) {
                        console.error('Error signing orders:', err);
                        alert('Failed to sign orders.');
                      }
                    }}
                    disabled={pendedOrders.length === 0 || isLocked}
                  >
                    Sign Orders
                  </button>
                </div>
              )}

              {activeTab === 'avs' && (
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm uppercase tracking-wider">AFTER VISIT SUMMARY</h3>

                  <textarea
                    value={avs.instructions}
                    onChange={(e) => setAvs(a => ({ ...a, instructions: e.target.value }))}
                    placeholder="Patient instructions"
                    className="w-full h-28 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />
                  <textarea
                    value={avs.followUp}
                    onChange={(e) => setAvs(a => ({ ...a, followUp: e.target.value }))}
                    placeholder="Follow-up plan"
                    className="w-full h-20 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />
                  <textarea
                    value={avs.returnPrecautions}
                    onChange={(e) => setAvs(a => ({ ...a, returnPrecautions: e.target.value }))}
                    placeholder="Return precautions"
                    className="w-full h-20 bg-gray-800 border border-white/10 rounded-xl p-3 text-white text-sm resize-none"
                    readOnly={isLocked}
                  />

                  <button
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-white/5"
                    onClick={async () => {
                      if (!activeEncounter) return;
                      try {
                        // 1. Save first
                        const res = await api.post("/after_visit_summaries", {
                          encounter_id: activeEncounter.id,
                          instructions: avs.instructions,
                          follow_up: avs.followUp,
                          return_precautions: avs.returnPrecautions
                        });
                        // 2. Send
                        await api.post(`/after_visit_summaries/${res.data.id}/send`);
                        alert('AVS sent to patient portal.');
                      } catch (err) {
                        console.error('Error sending AVS:', err);
                        alert('Failed to send AVS.');
                      }
                    }}
                  >
                    Send to Patient Portal
                  </button>
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

                  <div className="p-3 bg-gray-900/40 rounded-xl border border-white/5">
                    <p className="text-gray-500 text-xs">
                      Tip: Most systems require documenting modality (video/phone) in the note.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer Actions */}
            <div className="p-4 border-t border-white/10 space-y-2">
              <button
                onClick={handleSaveDraft}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors border border-white/5 disabled:opacity-50"
                disabled={isLocked}
              >
                Save Draft
              </button>
              <button
                onClick={handleFinalizeVisit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                disabled={isLocked}
              >
                {isLocked ? 'Visit Signed' : 'Finalize Visit'}
              </button>
            </div>
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
