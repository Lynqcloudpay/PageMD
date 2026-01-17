import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AIAssistant from './AIAssistant';

const FloatingActionButton = ({ context }) => { // Kept component name to minimize refactoring in Layout
  const params = useParams(); // Get params for context fallback
  const [showAI, setShowAI] = useState(false);

  // Derive context from params if not provided
  const activeContext = context || (params.id ? { patientId: params.id } : null);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowAI(true)}
          className="w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          style={{ background: 'linear-gradient(to right, #8B5CF6, #6366F1)' }} // AI-themed gradient (Purple/Indigo)
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

