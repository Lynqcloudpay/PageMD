import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const EkoContext = createContext(null);

export function EkoProvider({ children }) {
    // conversations: { [key: string]: { messages, conversationId, patientName, proactiveGaps, lastActive } }
    const [conversations, setConversations] = useState({});
    const [activeKey, setActiveKey] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [ambientMode, setAmbientMode] = useState(false);
    const [isSilent, setIsSilent] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Recording Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const recordingModeRef = useRef(null);
    const ambientModeRef = useRef(false);
    const isRecordingRef = useRef(false);

    useEffect(() => {
        ambientModeRef.current = ambientMode;
    }, [ambientMode]);

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
    }, []);

    const location = useLocation();

    // Safety: Auto-stop if user navigates away while recording
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isRecordingRef.current) {
                handleStopRecording();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [handleStopRecording]);

    // Track route changes to stop recording if we leave the visit note
    useEffect(() => {
        if (isRecordingRef.current && !location.pathname.includes('/visit/')) {
            console.log('[EkoContext] Route changed, stopping recording safely...');
            handleStopRecording();
            setAmbientMode(false);
        }
    }, [location.pathname, handleStopRecording]);

    const handleStartRecording = useCallback(async (forcedMode = null) => {
        const isAmbient = forcedMode !== null ? forcedMode : ambientModeRef.current;
        recordingModeRef.current = isAmbient ? 'ambient' : 'dictation';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            if (isAmbient) {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioContextRef.current = audioContext;
                    const source = audioContext.createMediaStreamSource(stream);
                    const analyser = audioContext.createAnalyser();
                    analyser.fftSize = 512;
                    source.connect(analyser);
                    analyserRef.current = analyser;

                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    let silenceStart = null;
                    const checkSilence = () => {
                        if (!analyserRef.current) return;
                        analyserRef.current.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                        if (average < 15) {
                            if (!silenceStart) silenceStart = Date.now();
                            if (Date.now() - silenceStart > 3000) setIsSilent(true);
                        } else {
                            silenceStart = null;
                            setIsSilent(false);
                        }
                        silenceTimerRef.current = requestAnimationFrame(checkSilence);
                    };
                    checkSilence();
                } catch (e) { console.warn('VAD failed:', e); }
            }

            const currentAudioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) currentAudioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                // Ensure the global ref only contains THIS session's chunks
                audioChunksRef.current = currentAudioChunks;

                if (silenceTimerRef.current) cancelAnimationFrame(silenceTimerRef.current);
                if (audioContextRef.current) {
                    audioContextRef.current.close().catch(() => { });
                    audioContextRef.current = null;
                }
                analyserRef.current = null;
                setIsSilent(false);

                if (audioChunksRef.current.length > 0) {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (blob.size > 1000) {
                        await handleAudioUpload(blob, recordingModeRef.current);
                    }
                }
                stream.getTracks().forEach(t => t.stop());
                setIsRecording(false);
            };

            mediaRecorder.start(isAmbient ? 1000 : undefined);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Recording error:', err);
            setError('Microphone access denied.');
        }
    }, []);



    const handleAudioUpload = async (blob, mode) => {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('mode', mode);

        // Extract visitId from URL to provide context to backend
        const visitMatch = location.pathname.match(/\/visit\/([a-f0-9-]+)/i);
        if (visitMatch) {
            formData.append('visitId', visitMatch[1]);
        }

        setIsProcessing(true);
        try {
            const { data } = await api.post('/echo/transcribe', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.success) {
                // Broadcast results via custom event for UI updates
                window.dispatchEvent(new CustomEvent('eko-transcription-complete', { detail: data }));

                if (data.mode === 'ambient' && data.parsedSections) {
                    const path = window.location.pathname;
                    const visitMatch = path.match(/\/visit\/([a-f0-9-]+)/i);
                    const patientMatch = path.match(/\/patient\/([a-f0-9-]+)/i);

                    if (visitMatch) {
                        const visitId = visitMatch[1];
                        const patientId = patientMatch ? patientMatch[1] : null;

                        // IMPORTANT: Only auto-write HPI, ROS, PE, chiefComplaint.
                        // Assessment and Plan are physician-controlled — only generated on demand via AI Draft buttons.
                        const { assessment, plan, ...safeSections } = data.parsedSections;

                        await api.post('/echo/write-to-note', {
                            visitId,
                            patientId,
                            sections: safeSections
                        });
                        window.dispatchEvent(new CustomEvent('eko-note-updated', { detail: { visitId } }));
                    }
                }
            }
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const getConversationKey = (patientId) => patientId || 'global';

    const getConversation = useCallback((key) => {
        return conversations[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null };
    }, [conversations]);

    const updateConversation = useCallback((key, updates) => {
        setConversations(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null }),
                ...updates,
                lastActive: Date.now()
            }
        }));
    }, []);

    const setMessages = useCallback((key, messagesOrUpdater) => {
        setConversations(prev => {
            const current = prev[key] || { messages: [], conversationId: null, patientName: null, proactiveGaps: null, lastActive: null };
            const newMessages = typeof messagesOrUpdater === 'function'
                ? messagesOrUpdater(current.messages)
                : messagesOrUpdater;
            return {
                ...prev,
                [key]: { ...current, messages: newMessages, lastActive: Date.now() }
            };
        });
    }, []);

    const closeConversation = useCallback((key) => {
        setConversations(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        // If the closed one was active, switch to another or null
        setActiveKey(prev => {
            if (prev === key) {
                const remaining = Object.keys(conversations).filter(k => k !== key);
                return remaining.length > 0 ? remaining[remaining.length - 1] : null;
            }
            return prev;
        });
    }, [conversations]);

    const clearConversation = useCallback((key) => {
        setConversations(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                messages: [],
                conversationId: null,
                lastActive: Date.now()
            }
        }));
    }, []);

    const openConversations = Object.keys(conversations).filter(
        k => conversations[k]?.messages?.length > 0 || conversations[k]?.conversationId
    );

    return (
        <EkoContext.Provider value={{
            conversations,
            activeKey,
            setActiveKey,
            isOpen,
            setIsOpen,
            isRecording,
            setIsRecording,
            recordingTime,
            setRecordingTime,
            ambientMode,
            setAmbientMode,
            isSilent,
            isProcessing,
            error,
            setError,
            handleStartRecording,
            handleStopRecording,
            getConversationKey,
            getConversation,
            updateConversation,
            setMessages,
            closeConversation,
            clearConversation,
            openConversations
        }}>
            {children}
        </EkoContext.Provider>
    );
}

export function useEko() {
    const ctx = useContext(EkoContext);
    if (!ctx) throw new Error('useEko must be used within EkoProvider');
    return ctx;
}

export default EkoContext;
