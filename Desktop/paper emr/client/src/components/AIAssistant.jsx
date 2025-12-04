import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Loader2, Bot, User } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

// AI Assistant Component - Inspired by Epic's AI features and modern AI assistants
const AIAssistant = ({ context, onInsert, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI clinical assistant. I can help you with:\n• Generating clinical notes\n• Finding relevant dot phrases\n• Suggesting diagnoses\n• Answering clinical questions\n\nWhat would you like help with?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate AI response (in production, this would call an AI API)
    setTimeout(() => {
      const aiResponse = generateAIResponse(input, context);
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      setLoading(false);
    }, 1000);
  };

  const generateAIResponse = (userInput, context) => {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('note') || lowerInput.includes('document')) {
      return `Based on the visit context, here's a suggested note structure:\n\n**HPI:** [Patient presents with...]\n\n**Assessment:** [Consider these diagnoses based on symptoms]\n\n**Plan:** [Recommended treatment plan]\n\nWould you like me to generate a full note?`;
    }
    
    if (lowerInput.includes('diagnosis') || lowerInput.includes('diagnose')) {
      return `Based on the symptoms and findings, consider these diagnoses:\n\n1. Primary diagnosis: [Most likely]\n2. Differential diagnoses:\n   - [Alternative 1]\n   - [Alternative 2]\n\nWould you like ICD-10 codes for these?`;
    }
    
    if (lowerInput.includes('dot phrase') || lowerInput.includes('template')) {
      return `Here are relevant dot phrases for this visit:\n\n• .chest_pain - For chest pain evaluation\n• .hypertension_followup - For HTN follow-up\n• .diabetes_management - For diabetes care\n\nType the dot phrase (e.g., .chest_pain) to insert it.`;
    }
    
    return `I understand you're asking about: "${userInput}".\n\nI can help you with:\n• Generating clinical documentation\n• Finding relevant templates\n• Suggesting treatment plans\n• Answering clinical questions\n\nCould you be more specific about what you need?`;
  };

  const handleInsert = (text) => {
    if (onInsert) {
      onInsert(text);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#3B82F6' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">AI Clinical Assistant</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Powered by AI • Clinical decision support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-3 ${
                msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user' 
                  ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-white'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className={`flex-1 rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100'
                  : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.content.includes('Would you like') && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-2"
                    onClick={() => handleInsert(msg.content)}
                  >
                    Insert into Note
                  </Button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#3B82F6' }}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-800/50">
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-end space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything about this visit..."
              className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              icon={Send}
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;

