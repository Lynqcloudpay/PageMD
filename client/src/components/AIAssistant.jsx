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
    <div className="fixed bottom-24 right-6 z-50 animate-slide-up origin-bottom-right">
      <div
        className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 w-[400px] h-[500px] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)' }}
      >
        {/* Header - Minimalist */}
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-white/50 dark:bg-neutral-900/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">AI Assistant</h3>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">Clinical Support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-gradient-to-b from-transparent to-neutral-50/30 dark:to-neutral-900/30">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
            >
              {msg.role !== 'user' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-purple-600 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-tl-sm'
                  }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && msg.content.includes('Would you like') && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={() => handleInsert(msg.content)}
                  >
                    Insert text
                  </Button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center space-x-2 text-neutral-400 px-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - Seamless */}
        <div className="p-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-t border-neutral-100 dark:border-neutral-800">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              className="w-full pl-4 pr-10 py-3 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-purple-500/20 resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`absolute right-1.5 bottom-1.5 p-2 rounded-lg transition-all ${input.trim() && !loading
                  ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700 hover:scale-105'
                  : 'text-neutral-400 cursor-not-allowed'
                }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-center mt-2 opacity-60 hover:opacity-100 transition-opacity">
            <p className="text-[9px] flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500">
              <Sparkles className="w-2.5 h-2.5" /> AI can make mistakes. Review generated content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;

