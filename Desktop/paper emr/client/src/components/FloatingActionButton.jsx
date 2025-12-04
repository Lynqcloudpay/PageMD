import React, { useState } from 'react';
import { Plus, X, FileText, Video, Calendar, User, MessageSquare, Sparkles, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AIAssistant from './AIAssistant';
import VoiceRecorder from './VoiceRecorder';

const FloatingActionButton = ({ context }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const actions = [
    { icon: User, label: 'New Patient', action: () => navigate('/patients'), bgColor: 'bg-primary-100 dark:bg-primary-900/20', textColor: 'text-primary-600 dark:text-primary-400' },
    { icon: Calendar, label: 'New Appointment', action: () => navigate('/schedule'), bgColor: 'bg-success-100 dark:bg-success-900/20', textColor: 'text-success-600 dark:text-success-400' },
    { icon: FileText, label: 'New Note', action: () => navigate('/pending-notes'), bgColor: 'bg-primary-100 dark:bg-primary-900/20', textColor: 'text-primary-600 dark:text-primary-400' },
    { icon: Video, label: 'Telehealth', action: () => navigate('/telehealth'), bgColor: 'bg-primary-100 dark:bg-primary-900/20', textColor: 'text-primary-600 dark:text-primary-400' },
    { icon: MessageSquare, label: 'New Message', action: () => navigate('/messages'), bgColor: 'bg-primary-100 dark:bg-primary-900/20', textColor: 'text-primary-600 dark:text-primary-400' },
    { icon: Sparkles, label: 'AI Assistant', action: () => setShowAI(true), bgColor: 'bg-warning-100 dark:bg-warning-900/20', textColor: 'text-warning-600 dark:text-warning-400' },
    { icon: Mic, label: 'Voice Record', action: () => setShowVoice(true), bgColor: 'bg-error-100 dark:bg-error-900/20', textColor: 'text-error-600 dark:text-error-400' },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Action Buttons */}
        {isOpen && (
          <div className="absolute bottom-20 right-0 space-y-2 animate-slide-up">
            {actions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    action.action();
                    setIsOpen(false);
                  }}
                  className="flex items-center space-x-3 px-4 py-3 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 hover:shadow-xl transition-all hover-lift group w-48"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className={`p-2 rounded-lg ${action.bgColor} ${action.textColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center active-scale ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
          aria-label="Quick actions"
          style={{ 
            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4), 0 8px 10px -6px rgba(37, 99, 235, 0.4)'
          }}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* AI Assistant Modal */}
      {showAI && (
        <AIAssistant
          context={context}
          onInsert={(text) => {
            // Handle text insertion
            console.log('Insert:', text);
          }}
          onClose={() => setShowAI(false)}
        />
      )}

      {/* Voice Recorder Modal */}
      {showVoice && (
        <VoiceRecorder
          onTranscript={(text) => {
            // Handle transcript insertion
            console.log('Transcript:', text);
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
    </>
  );
};

export default FloatingActionButton;

