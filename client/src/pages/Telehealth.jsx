import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
  Monitor, MessageSquare, Users, Settings, Maximize2,
  Clock, User, Calendar, FileText, Camera, ChevronRight,
  Shield, Signal, Wifi, Battery, X, MoreVertical, Layout, Loader2,
  ClipboardList, Activity, Pill, AlertCircle, RefreshCcw, Save, Search, FlaskConical, ChevronDown, Trash2, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { appointmentsAPI, patientsAPI, visitsAPI } from '../services/api';
import api from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PatientChartPanel from '../components/PatientChartPanel';
import Modal from '../components/ui/Modal';
import { OrderModal } from '../components/ActionModals';
import { icd10API } from '../services/api';

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
          setConnectionStatus('In Visit');
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


      <div ref={frameRef} className="w-full h-full bg-slate-100 rounded-2xl" />
    </div>
  );
};

const Telehealth = () => {
  // --- NEW: Workspace Tabs ---
  const WORKSPACE_TABS = ['chart', 'note', 'info'];

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);
  const [roomUrl, setRoomUrl] = useState(null);
  const [creatingRoom, setCreatingRoom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('note'); // default to note during visit
  const [activeEncounter, setActiveEncounter] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [viewingPatientId, setViewingPatientId] = useState(null);

  // --- NEW: Patient Chart Panel State ---
  const [showFullChart, setShowFullChart] = useState(false);

  // --- NEW: Chart Snapshot (best-effort) ---
  const [patientSnapshot, setPatientSnapshot] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  // --- NEW: Structured note state (Aligned with VisitNote.jsx) ---
  const [note, setNote] = useState({
    chiefComplaint: '',
    hpi: '',
    rosNotes: '',
    peNotes: '',
    results: '',
    assessment: '',
    plan: '',
    planNarrative: '', // Free text plan
    dx: '',
    planStructured: [],
  });

  const [patientChartTab, setPatientChartTab] = useState('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDiagnosisPicker, setShowDiagnosisPicker] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalTab, setOrderModalTab] = useState('labs');

  // ICD10 Search State
  const [icd10Search, setIcd10Search] = useState('');
  const [icd10Results, setIcd10Results] = useState([]);
  const [showIcd10Search, setShowIcd10Search] = useState(false);

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

  // Fetch appointments
  const fetchSchedule = useCallback(async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await appointmentsAPI.get({ date: today });
      const telehealthAppts = (response.data || []).filter(appt => {
        // Filter out completed/cancelled appointments
        const status = (appt.status || '').toLowerCase();
        if (['checked_out', 'completed', 'cancelled', 'no_show', 'no-show'].includes(status)) return false;

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
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

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
  useEffect(() => {
    if (!activeCall?.id) return;

    const cached = safeJsonParse(localStorage.getItem(storageKeyFor(activeCall.id)));
    if (cached?.note) setNote(cached.note);
    if (cached?.pendedOrders) setPendedOrders(cached.pendedOrders);
    if (cached?.avs) setAvs(cached.avs);
  }, [activeCall?.id]);

  // ICD10 Search Effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (icd10Search.trim().length >= 2) {
        try {
          const res = await icd10API.search(icd10Search);
          setIcd10Results(res.data || []);
        } catch (err) {
          console.error("ICD10 search failed", err);
        }
      } else {
        setIcd10Results([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [icd10Search]);

  const handleAddDiagnosis = (code) => {
    const codeStr = `${code.code} - ${code.description}`;
    const currentDx = note.dx.split(',').filter(Boolean).map(c => c.trim());
    if (!currentDx.includes(codeStr)) {
      setNote(n => ({ ...n, dx: [...currentDx, codeStr].join(', ') }));
    }
    setIcd10Search('');
    setIcd10Results([]);
    setShowIcd10Search(false);
  };

  // When call starts, ensure we're on the Note tab
  useEffect(() => {
    if (activeCall) {
      setActiveTab('note');
    }
  }, [activeCall?.id]);

  // Autosave drafts (debounced)
  useEffect(() => {
    if (!activeCall?.id || isSubmitting) return;

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
      // Also try server save if encounter active and not signed
      if (activeEncounter && activeEncounter.status !== 'signed') handleSaveDraft();
    }, 1000); // 1s debounce

    return () => clearTimeout(t);
  }, [note, pendedOrders, avs, activeCall?.id, activeEncounter, isSubmitting]);

  // Keep encounter alive (server heartbeat)
  useEffect(() => {
    if (!activeEncounter?.id || activeEncounter.status === 'signed') return;

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

  const handleStartCall = async (appt, options = { video: true }) => {
    if (creatingRoom || isSubmitting) return;
    setCreatingRoom(appt.id);

    try {
      // 1. Ensure encounter exists
      let encounter;
      const patientId = appt.patient_id || appt.patientId || appt.pid;
      const providerName = currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Provider';

      try {
        const existing = await api.get(`/encounters?appointment_id=${appt.id}`);
        const found = existing.data && existing.data.length > 0 ? existing.data[0] : null;

        if (found && found.status !== 'signed') {
          encounter = found;
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
        const encounterRes = await api.post("/encounters", {
          appointment_id: appt.id,
          provider_id: currentUser.id,
          patient_id: patientId,
          start_time: new Date().toISOString()
        });
        encounter = encounterRes.data;
      }

      setActiveEncounter(encounter);

      // Update appointment status to 'in-progress' for queue visibility
      // NOTE: Using 'in-progress' with hyphen to match DB constraint
      try {
        await appointmentsAPI.update(appt.id, { status: 'in-progress' });
      } catch (e) {
        console.error('Failed to update appointment status:', e);
      }

      if (options.video) {
        // 2. Create a Daily.co room via our backend
        const response = await api.post('/telehealth/rooms', {
          appointmentId: appt.id,
          encounterId: encounter.id,
          patientName: appt.patientName || appt.name || 'Patient',
          providerName: providerName
        });

        if (response.data.success) {
          setRoomUrl(response.data.roomUrl);
          setActiveCall({ ...appt, roomName: response.data.roomName });
          setDuration(0);
        }
      } else {
        // Just opening workspace for documentation
        setRoomUrl(null);
        setActiveCall(appt);
        setDuration(0);
      }
    } catch (err) {
      console.error('Error starting call/encounter:', err);
      alert('Failed to start visit. Please check your connection and try again.');
    } finally {
      setCreatingRoom(null);
    }
  };

  const handleCloseWorkspace = useCallback(async () => {
    setActiveCall(null);
    setRoomUrl(null);
    setDuration(0);
    setActiveEncounter(null);
    setNote({
      chiefComplaint: '',
      hpi: '',
      rosNotes: '',
      peNotes: '',
      results: '',
      assessment: '',
      plan: '',
      planNarrative: '',
      dx: '',
      planStructured: [],
    });
    setPendedOrders([]);
    setAvs({
      instructions: '',
      followUp: '',
      returnPrecautions: '',
    });
  }, []);

  const handleEndCall = useCallback(() => {
    setRoomUrl(null);
    setCreatingRoom(false);
    // Don't clear activeCall/Encounter/Note
  }, []);

  const handleSaveDraft = async () => {
    if (!activeEncounter || isLocked) return;
    try {
      // Build Plan Section (Narrative + Structured)
      const structuredText = (note.planStructured || []).map(group => {
        const lines = (group.orders || []).map(o => `  • ${o}`).join('\n');
        return `${group.diagnosis}\n${lines}`;
      }).join('\n\n');
      const fullPlan = [note.planNarrative, structuredText].filter(Boolean).join('\n\n---\n\n');

      // Aligned with VisitNote.jsx combined format
      const combinedNote = [
        "MODALITY: Telehealth Video Visit",
        note.chiefComplaint ? `Chief Complaint: ${note.chiefComplaint}` : '',
        note.hpi ? `HPI: ${note.hpi}` : '',
        note.rosNotes ? `Review of Systems: ${note.rosNotes}` : '',
        note.peNotes ? `Physical Exam: ${note.peNotes}` : '',
        note.results ? `Results: ${note.results}` : '',
        note.assessment ? `Assessment: ${note.assessment}` : '',
        fullPlan ? `Plan: ${fullPlan}` : ''
      ].filter(Boolean).join('\n\n');

      // 1. Save Note using visitsAPI format
      await visitsAPI.update(activeEncounter.id, {
        note_draft: combinedNote,
        dx: note.dx.split(",").map(d => d.trim()).filter(Boolean)
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
    if (!activeEncounter || isSubmitting) return;
    if (isLocked) {
      handleCloseWorkspace();
      return;
    }

    if (!window.confirm("Are you sure you want to finalize and sign this visit? This will lock the encounter for edits.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save everything one last time
      await handleSaveDraft();

      // 2. Sign All Orders for this encounter (prior to locking note)
      await api.patch(`/encounters/${activeEncounter.id}/sign-orders`);

      // 3. Sign/Lock Note (This now captures clinical snapshot server-side)
      await api.patch(`/clinical_notes/${activeEncounter.id}/sign`);

      console.log('Visit finalized and signed.');
      setActiveEncounter(prev => ({ ...prev, status: 'signed' })); // Update local state to block autosave
      setPendedOrders(prev => prev.map(o => ({ ...o, status: 'signed' })));

      // 5. Update Appointment to 'completed' and 'checked_out' (Out) for schedule sync
      if (activeCall?.id) {
        try {
          const now = new Date();
          await appointmentsAPI.update(activeCall.id, {
            status: 'completed',
            patient_status: 'checked_out',
            checkout_time: now.toISOString(),
            room_sub_status: null,
            current_room: null
          });
        } catch (e) {
          console.error('Failed to update final appointment status:', e);
        }
      }

      // 6. Cleanup & Auto-close Workspace
      handleCloseWorkspace();
      fetchSchedule(); // Refresh queue to hide completed visit

      // Cleanup local draft
      localStorage.removeItem(storageKeyFor(activeCall.id));

      console.log('Visit finalized and checked out.');

    } catch (err) {
      console.error('Error finalizing visit:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      if (errorMsg.includes('already signed')) {
        handleCloseWorkspace();
      } else {
        alert('Failed to finalize visit: ' + errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- ACTIVE CALL VIEW ---
  if (activeCall) {
    return (
      <div className="flex h-[calc(100vh-64px)] bg-slate-50 overflow-hidden relative">
        {/* Main Video Stage OR Placeholder */}
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
              {/* Badges removed for cleaner UI */}
            </div>
          </div>

          {/* Daily.co Video or Call Ended Placeholder */}
          <div className="flex-1 flex items-center justify-center p-4">
            {roomUrl ? (
              <div className="relative w-full h-full bg-slate-100 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <DailyVideoCall
                  roomUrl={roomUrl}
                  userName={providerName}
                  onLeave={handleEndCall}
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100/50 rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <PhoneOff className="w-8 h-8 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-700">Call Ended</h3>
                  <p className="text-slate-500 max-w-sm mx-auto">The video connection has been terminated. You can simply continue documenting and finalize the visit when ready.</p>
                </div>
                <button
                  onClick={handleCloseWorkspace}
                  className="px-6 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Close Workspace
                </button>
              </div>
            )}
          </div>

          {/* Control Bar */}
          <div className="h-20 bg-white border-t border-slate-200 flex items-center justify-center gap-6 px-8 z-20 shadow-sm">
            {roomUrl ? (
              <button
                onClick={handleEndCall}
                className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transform hover:scale-105 transition-all duration-200 flex items-center gap-2 px-8"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="font-bold text-sm">End Call</span>
              </button>
            ) : (
              <button
                onClick={handleCloseWorkspace}
                className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 px-8"
              >
                <X className="w-5 h-5" />
                <span className="font-bold text-sm">Close Workspace</span>
              </button>
            )}

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-4 rounded-full transition-all duration-200 border shadow-sm ${isSidebarOpen
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Layout className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {WORKSPACE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.15em] transition-all
                    ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'chart' && (
                <div className="space-y-5 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="text-slate-900 font-bold text-xs uppercase tracking-widest">PATIENT CHART</h3>
                    <button
                      onClick={fetchPatientSnapshot}
                      className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                      title="Refresh Chart"
                    >
                      <RefreshCcw className={`w-4 h-4 ${chartLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Patient</p>
                    <p className="text-slate-900 font-bold text-lg leading-tight">{activeCall.patientName || activeCall.name}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 shadow-sm">
                        {patientSnapshot?.dob ? `DOB: ${patientSnapshot.dob}` : 'Loading...'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowFullChart(true);
                      setPatientChartTab('overview');
                    }}
                    className="w-full group flex items-center justify-between p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg shadow-blue-900/10 hover:shadow-blue-900/20 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-white/10 p-2.5 rounded-xl">
                        <ClipboardList className="w-5 h-5 font-bold" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">Full Patient Chart</p>
                        <p className="text-[10px] text-blue-100 opacity-80 uppercase tracking-widest">History & Labs</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-all" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'medications', label: 'Meds', icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { id: 'problems', label: 'Problems', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { id: 'allergies', label: 'Allergies', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                      { id: 'labs', label: 'Labs', icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-50' },
                    ].map(x => (
                      <button
                        key={x.id}
                        className="p-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-2xl text-left transition-all group"
                        onClick={() => {
                          setPatientChartTab(x.id);
                          setShowFullChart(true);
                        }}
                      >
                        <div className={`${x.bg} p-2 rounded-xl w-fit mb-3 transition-colors`}>
                          <x.icon className={`w-4 h-4 ${x.color}`} />
                        </div>
                        <p className="text-slate-900 text-[10px] font-bold uppercase tracking-wider">{x.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'note' && (
                <div className="space-y-6 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="text-slate-900 font-bold text-xs uppercase tracking-widest">Encounter Note</h3>
                    <button onClick={handleSaveDraft} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors border border-blue-100">
                      <Save className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">Chief Complaint</label>
                      <input
                        value={note.chiefComplaint}
                        onChange={(e) => setNote(n => ({ ...n, chiefComplaint: e.target.value }))}
                        placeholder="Reason for visit..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                        readOnly={isLocked}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">HPI</label>
                      <textarea
                        value={note.hpi}
                        onChange={(e) => setNote(n => ({ ...n, hpi: e.target.value }))}
                        placeholder="History of Present Illness..."
                        className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none leading-relaxed shadow-sm"
                        readOnly={isLocked}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">ROS</label>
                        <textarea
                          value={note.rosNotes}
                          onChange={(e) => setNote(n => ({ ...n, rosNotes: e.target.value }))}
                          placeholder="Review of Systems..."
                          className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                          readOnly={isLocked}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">Exam</label>
                        <textarea
                          value={note.peNotes}
                          onChange={(e) => setNote(n => ({ ...n, peNotes: e.target.value }))}
                          placeholder="Objective findings..."
                          className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm"
                          readOnly={isLocked}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1">Assessments (Diagnoses)</label>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={icd10Search}
                          onChange={(e) => {
                            setIcd10Search(e.target.value);
                            setShowIcd10Search(true);
                          }}
                          placeholder="Search diagnosis code..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                        />
                        {showIcd10Search && icd10Results.length > 0 && (
                          <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1">
                            {icd10Results.map(res => (
                              <button
                                key={res.code}
                                onClick={() => handleAddDiagnosis(res)}
                                className="w-full text-left px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0"
                              >
                                <p className="text-blue-600 text-xs font-bold mb-0.5">{res.code}</p>
                                <p className="text-slate-600 text-xs line-clamp-1">{res.description}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {note.dx ? (
                        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-sm overflow-hidden text-left">
                          {note.dx.split(',').filter(Boolean).map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-3 group hover:bg-slate-50 transition-colors">
                              <span className="text-sm text-slate-700 font-medium">{d.trim()}</span>
                              <button
                                onClick={() => {
                                  const current = note.dx.split(',').filter(Boolean).map(c => c.trim());
                                  setNote(n => ({ ...n, dx: current.filter((_, idx) => idx !== i).join(', ') }));
                                }}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No diagnoses added</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-slate-100 text-left">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clinical Plan</label>
                        <button
                          onClick={() => { setOrderModalTab('labs'); setShowOrderModal(true); }}
                          className="text-[10px] bg-blue-600 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 active:scale-95"
                        >
                          <Plus className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                          Add Order
                        </button>
                      </div>

                      {note.planStructured && note.planStructured.length > 0 ? (
                        <div className="space-y-4">
                          {note.planStructured.map((group, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left shadow-sm">
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-2">{group.diagnosis}</p>
                              <div className="space-y-2">
                                {group.orders.map((order, oIdx) => (
                                  <div key={oIdx} className="flex items-start gap-3 text-xs text-slate-700 leading-relaxed group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0 group-hover:scale-125 transition-transform" />
                                    {order}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                          <p className="text-[11px] text-slate-400 font-medium italic">No clinical orders for this visit yet</p>
                        </div>
                      )}
                    </div>

                    {/* Narrative Plan */}
                    <div className="mt-6 space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan of Care (Narrative)</label>
                      <textarea
                        value={note.planNarrative || ''}
                        onChange={(e) => setNote(prev => ({ ...prev, planNarrative: e.target.value }))}
                        placeholder="Free text details, patient instructions, rationale..."
                        className="w-full h-32 p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none shadow-sm placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-5 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="text-slate-900 font-bold text-xs uppercase tracking-widest">Clinical Orders</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setOrderModalTab('labs'); setShowOrderModal(true); }}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all text-[10px] font-bold uppercase tracking-wider shadow-sm"
                      >
                        + NEW ORDER
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'labs', label: 'Labs', icon: Activity, tab: 'labs', color: 'text-purple-600', bg: 'bg-purple-50' },
                      { id: 'meds', label: 'Meds', icon: Pill, tab: 'medications', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { id: 'referrals', label: 'Referrals', icon: User, tab: 'referrals', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { id: 'procs', label: 'Procs', icon: Settings, tab: 'procedures', color: 'text-slate-600', bg: 'bg-slate-50' },
                    ].map(x => (
                      <button
                        key={x.id}
                        className="p-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl text-left transition-all group"
                        onClick={() => {
                          setOrderModalTab(x.tab);
                          setShowOrderModal(true);
                        }}
                      >
                        <div className={`${x.bg} p-2 rounded-xl w-fit mb-3 transition-colors`}>
                          <x.icon className={`w-4 h-4 ${x.color}`} />
                        </div>
                        <p className="text-slate-900 text-[10px] font-bold uppercase tracking-[1px]">{x.label}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 mt-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] ml-1">Pended Items</p>
                    {pendedOrders.length === 0 ? (
                      <div className="p-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                        <p className="text-[11px] text-slate-400 font-medium">No orders pended yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pendedOrders.map(o => (
                          <div key={o.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-start justify-between gap-3 group hover:border-slate-300 transition-all">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${o.status === 'signed' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                                <p className="text-slate-900 text-xs font-bold capitalize">{o.type}</p>
                              </div>
                              <p className="text-slate-500 text-[11px] leading-relaxed">{o.text}</p>
                            </div>
                            <button
                              className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                              onClick={() => setPendedOrders(prev => prev.filter(x => x.id !== o.id))}
                              disabled={isLocked}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {pendedOrders.length > 0 && (
                    <button
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/10 text-xs uppercase tracking-widest disabled:opacity-50 mt-6"
                      onClick={async () => {
                        if (!activeEncounter) return;
                        try {
                          for (let o of pendedOrders) {
                            if (o.status === 'pending' || o.status === 'pended') {
                              await api.patch(`/clinical_orders/${o.id}/sign`);
                            }
                          }
                          setPendedOrders(prev => prev.map(o => ({ ...o, status: 'signed' })));
                          alert('Orders signed and sent.');
                        } catch (err) {
                          console.error('Error signing orders:', err);
                          alert('Failed to sign some orders.');
                        }
                      }}
                      disabled={isLocked || !pendedOrders.some(o => o.status !== 'signed')}
                    >
                      Sign {pendedOrders.filter(o => o.status !== 'signed').length} Orders
                    </button>
                  )}
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
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Patient</p>
                    <p className="text-slate-900 font-bold text-base">{activeCall.patientName || activeCall.name}</p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Appointment Type</p>
                    <p className="text-slate-900 font-bold text-base">{activeCall.type || activeCall.appointment_type || 'Telehealth Visit'}</p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-slate-900 font-bold text-base">{formatTime(duration)}</p>
                  </div>

                  <div className="p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100">
                    <p className="text-xs font-medium">
                      Tip: Most systems require documenting modality (video/phone) in the note.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
              <button
                onClick={handleSaveDraft}
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-colors border border-slate-200 shadow-sm disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                onClick={handleFinalizeVisit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-blue-900/10 disabled:opacity-50"
              >
                {isLocked ? 'Visit Signed' : 'Finalize Visit'}
              </button>
            </div>
          </div>
        )}

        {/* --- MODALS --- */}
        <PatientChartPanel
          patientId={viewingPatientId || activeEncounter?.patient_id || activeCall?.patientId}
          isOpen={showFullChart}
          onClose={() => {
            setShowFullChart(false);
            setViewingPatientId(null);
          }}
          initialTab={patientChartTab || 'overview'}
        />

        {showDiagnosisPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <DiagnosisPicker
              onSelect={(code) => {
                const current = note.dx.split(',').filter(Boolean).map(c => c.trim());
                if (!current.includes(code.code)) {
                  setNote(n => ({ ...n, dx: [...current, code.code].join(', ') }));
                }
                setShowDiagnosisPicker(false);
              }}
              onClose={() => setShowDiagnosisPicker(false)}
              existingDiagnoses={note.dx.split(',')}
            />
          </div>
        )}

        {/* --- ORDER MODAL (COMPREHENSIVE) --- */}
        <OrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          initialTab={orderModalTab}
          diagnoses={note.dx.split(',').filter(Boolean).map(d => d.trim())}
          patientId={activeCall?.patientId}
          visitId={activeEncounter?.id}
          onSave={(updatedPlanStructured) => {
            // Update the note's structured plan
            setNote(n => {
              const newPlanStructured = updatedPlanStructured;

              return {
                ...n,
                planStructured: newPlanStructured
              };
            });

            // Re-sync pended orders for the sidebar view
            const newPendedItems = [];
            updatedPlanStructured.forEach(group => {
              (group.orders || []).forEach(orderText => {
                let type = 'other';
                if (orderText.startsWith('Lab:')) type = 'lab';
                else if (orderText.startsWith('Imaging:')) type = 'imaging';
                else if (orderText.startsWith('Referral:')) type = 'referral';
                else if (orderText.startsWith('Prescription:')) type = 'medication';

                newPendedItems.push({
                  id: `${Date.now()}_${Math.random()}`,
                  type,
                  text: orderText,
                  status: 'pended'
                });
              });
            });
            setPendedOrders(prev => [...newPendedItems]); // Overwrite with structured state
            setShowOrderModal(false);
          }}
        />
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
          {appointments
            .filter(appt => appt.patient_status !== 'checked_out' && appt.status !== 'completed')
            .map(appt => (
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
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === appt.id ? null : appt.id)}
                        className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 flex items-center gap-2 font-semibold"
                      >
                        Actions
                        <ChevronDown size={18} className={`transition-transform duration-200 ${activeDropdown === appt.id ? 'rotate-180' : ''}`} />
                      </button>

                      {activeDropdown === appt.id && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => {
                              handleStartCall(appt, { video: true });
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 text-slate-700 flex items-center gap-3 transition-colors border-b border-slate-50 group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <Video size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">Join Video Call</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">With Patient</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              handleStartCall(appt, { video: false });
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-emerald-50 text-slate-700 flex items-center gap-3 transition-colors border-b border-slate-50 group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">Resume Note</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Documentation Only</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setViewingPatientId(appt.patient_id || appt.patientId);
                              setShowFullChart(true);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">View Chart</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Patient Record</p>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleStartCall(appt)}
                      disabled={creatingRoom !== null}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
                    >
                      {creatingRoom === appt.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Video size={18} />
                      )}
                      {creatingRoom === appt.id
                        ? 'Connecting...'
                        : (appt.status === 'in_progress' || appt.status === 'arrived')
                          ? 'Resume Visit'
                          : 'Start Call'
                      }
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default Telehealth;
