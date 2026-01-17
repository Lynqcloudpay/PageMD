import React, { useState } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AIAssistant from './AIAssistant';

const FloatingActionButton = ({ context, onHelp }) => { // Kept component name to minimize refactoring in Layout
  const params = useParams(); // Get params for context fallback
  const [showAI, setShowAI] = useState(false);

  // Derive context from params if not provided
  const activeContext = context || (params.id ? { patientId: params.id } : null);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-center">
        {/* Help Button */}
        {onHelp && (
          <button
            onClick={onHelp}
            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 hover:text-primary-600 dark:hover:text-primary-400 border border-neutral-200 dark:border-neutral-700"
            aria-label="Get Help"
            title="Help & Support"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        )}

        {/* AI Assistant Button */}
        <button
          onClick={() => setShowAI(true)}
          className="w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 animate-pulse-subtle"
          style={{ background: 'linear-gradient(to right, #8B5CF6, #6366F1)' }}
          aria-label="AI Assistant"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      </div>

      {/* AI Assistant Modal */}
      {showAI && (
        <AIAssistant
          context={activeContext}
          onInsert={(text) => {
            // Handle text insertion
            console.log('Insert:', text);
          }}
          onClose={() => setShowAI(false)}
        />
      )}
    </>
  );
};

export default FloatingActionButton;

