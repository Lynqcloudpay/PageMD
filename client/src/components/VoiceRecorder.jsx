import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2, CheckCircle2 } from 'lucide-react';
import Button from './ui/Button';

// Voice Recorder Component - For ambient documentation (Epic-style)
const VoiceRecorder = ({ onTranscript, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // Simulate transcription (in production, use Web Speech API or cloud service)
        setTimeout(() => {
          const mockTranscript = generateMockTranscript();
          setTranscript(mockTranscript);
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }, 2000);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const generateMockTranscript = () => {
    return `Patient presents with chief complaint of chest pain. Pain started approximately 2 hours ago, described as pressure-like, substernal, radiating to left arm. Associated with shortness of breath and diaphoresis. No relief with rest. Denies nausea or vomiting. Past medical history significant for hypertension and hyperlipidemia. On examination, patient appears uncomfortable, diaphoretic. Blood pressure 150 over 90, heart rate 95, regular. Lungs clear to auscultation bilaterally. Heart regular rate and rhythm, no murmurs. Abdomen soft, non-tender. Extremities without edema.`;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInsert = () => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
            Voice Recording
          </h3>
          
          {/* Recording Status */}
          <div className="text-center py-8">
            {isRecording ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full bg-error-100 dark:bg-error-900/20 flex items-center justify-center animate-pulse">
                    <Mic className="w-12 h-12 text-error-600 dark:text-error-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-error-500 animate-ping opacity-75"></div>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Recording...
                  </p>
                  <p className="text-3xl font-mono text-error-600 dark:text-error-400 mt-2">
                    {formatTime(recordingTime)}
                  </p>
                </div>
              </div>
            ) : isProcessing ? (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto" />
                <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Processing audio...
                </p>
              </div>
            ) : transcript ? (
              <div className="space-y-4">
                <CheckCircle2 className="w-16 h-16 text-success-600 mx-auto" />
                <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Transcription Complete
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto">
                  <Mic className="w-12 h-12 text-neutral-400" />
                </div>
                <p className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Ready to Record
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Click the microphone to start recording
                </p>
              </div>
            )}
          </div>

          {/* Transcript Preview */}
          {transcript && (
            <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 max-h-48 overflow-y-auto">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center space-x-3">
            {!isRecording && !transcript && (
              <Button
                variant="primary"
                icon={Mic}
                onClick={startRecording}
                size="lg"
              >
                Start Recording
              </Button>
            )}
            {isRecording && (
              <Button
                variant="danger"
                icon={Square}
                onClick={stopRecording}
                size="lg"
              >
                Stop Recording
              </Button>
            )}
            {transcript && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTranscript('');
                    setIsProcessing(false);
                  }}
                >
                  Record Again
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInsert}
                >
                  Insert into Note
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;






























