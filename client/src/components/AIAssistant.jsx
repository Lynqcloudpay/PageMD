import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Loader2, Bot, User } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { aiAPI } from '../services/api';

// AI Assistant Component - Integrated with real LLM services
const AIAssistant = ({ context, onInsert, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI clinical assistant. I'm connected and ready to assist you with:\n• Generating clinical notes\n• Finding relevant dot phrases\n• Suggesting diagnoses\n• Answering clinical questions\n\nHow can I help you with this patient today?",
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

    const patientId = context?.patientId || context?.id;
    if (!patientId) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: No patient context found. Please open a patient chart to use the assistant." }]);
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiAPI.ask(patientId, input, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      const errorMessage = error.response?.data?.message || "I encountered an error connecting to my core intelligence. Please check your connection or API configuration.";
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    } finally {
      setLoading(false);
    }
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
              className={`flex items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-white'
                }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className={`flex-1 rounded-lg p-3 ${msg.role === 'user'
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
          <div className="flex flex-col space-y-1 mt-2">
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Press Enter to send, Shift+Enter for new line
            </p>
            <p className="text-[10px] items-center flex gap-1 font-bold text-amber-600 dark:text-amber-500 uppercase tracking-tighter">
              <Bot className="w-3 h-3" /> Clinical Decision Support: AI responses must be reviewed by a licensed provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;

