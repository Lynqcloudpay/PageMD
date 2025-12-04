import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Search, User, Clock, Paperclip, 
  Star, Archive, Trash2, Reply, Forward, MoreVertical,
  ChevronRight, X, Plus, Users, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, starred, patient, staff
  const [showCompose, setShowCompose] = useState(false);
  const messageEndRef = useRef(null);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchQuery || 
      conv.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.patient?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.from?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' ||
      (filter === 'unread' && conv.unread) ||
      (filter === 'starred' && conv.starred) ||
      (filter === 'patient' && conv.type === 'patient') ||
      (filter === 'staff' && conv.type === 'staff');
    
    return matchesSearch && matchesFilter;
  });

  // Scroll to bottom of messages
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation]);

  // Mark as read when selecting
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    if (conv.unread) {
      setConversations(conversations.map(c => 
        c.id === conv.id ? { ...c, unread: false } : c
      ));
    }
  };

  // Send message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    const updatedMessages = [
      ...selectedConversation.messages,
      {
        id: selectedConversation.messages.length + 1,
        from: 'provider',
        text: newMessage,
        date: new Date()
      }
    ];
    
    setConversations(conversations.map(c => 
      c.id === selectedConversation.id 
        ? { ...c, messages: updatedMessages, lastMessage: newMessage, lastMessageDate: new Date() }
        : c
    ));
    
    setSelectedConversation({ ...selectedConversation, messages: updatedMessages });
    setNewMessage('');
  };

  // Toggle star
  const toggleStar = (convId, e) => {
    e.stopPropagation();
    setConversations(conversations.map(c => 
      c.id === convId ? { ...c, starred: !c.starred } : c
    ));
  };

  const unreadCount = conversations.filter(c => c.unread).length;

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-paper-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-paper-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-ink-900 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-paper-600" />
              Messages
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <button 
              onClick={() => setShowCompose(true)}
              className="p-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
              style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-paper-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-2 border-b border-paper-200 flex space-x-1 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'starred', label: 'Starred' },
            { id: 'patient', label: 'Patients' },
            { id: 'staff', label: 'Staff' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                filter === f.id 
                  ? 'text-white' 
                  : 'bg-soft-gray text-deep-gray hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-ink-500 text-sm">
              No messages found
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`p-3 border-b border-paper-100 cursor-pointer hover:bg-paper-50 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-paper-100' : ''
                } ${conv.unread ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      conv.type === 'patient' ? 'bg-blue-100 text-blue-600' :
                      conv.type === 'staff' ? 'bg-green-100 text-green-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      <User className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        {conv.unread && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                        {conv.urgent && <span className="text-xs text-red-600 font-medium">URGENT</span>}
                        <span className={`text-sm truncate ${conv.unread ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                          {conv.type === 'patient' ? conv.patient.name : conv.from?.name}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${conv.unread ? 'font-medium text-ink-700' : 'text-ink-500'}`}>
                        {conv.subject}
                      </p>
                      <p className="text-xs text-ink-400 truncate mt-0.5">
                        {conv.lastMessage}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-1 ml-2">
                    <span className="text-xs text-ink-400">
                      {formatDistanceToNow(conv.lastMessageDate, { addSuffix: true })}
                    </span>
                    <button
                      onClick={(e) => toggleStar(conv.id, e)}
                      className={`p-1 rounded hover:bg-paper-200 ${conv.starred ? 'text-yellow-500' : 'text-ink-300'}`}
                    >
                      <Star className="w-3 h-3" fill={conv.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Message Thread */}
      <div className="flex-1 flex flex-col bg-paper-50">
        {selectedConversation ? (
          <>
            {/* Thread Header */}
            <div className="p-4 bg-white border-b border-paper-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink-900">{selectedConversation.subject}</h3>
                  <p className="text-sm text-ink-500">
                    {selectedConversation.type === 'patient' ? (
                      <>Patient: {selectedConversation.patient.name} (MRN: {selectedConversation.patient.mrn})</>
                    ) : selectedConversation.type === 'referral' ? (
                      <>From: {selectedConversation.from.name} ({selectedConversation.from.specialty}) | Patient: {selectedConversation.patient?.name}</>
                    ) : (
                      <>From: {selectedConversation.from?.name} ({selectedConversation.from?.role})</>
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 hover:bg-paper-100 rounded-md text-ink-600">
                    <Archive className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-paper-100 rounded-md text-ink-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-paper-100 rounded-md text-ink-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === 'provider' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-lg rounded-lg p-3 ${
                    msg.from === 'provider' 
                      ? 'text-white' 
                      : 'bg-white border border-deep-gray/20'
                  }`}>
                    <p className={`text-sm ${msg.from === 'provider' ? 'text-white' : 'text-ink-700'}`}>
                      {msg.text}
                    </p>
                    <p className={`text-xs mt-2 ${msg.from === 'provider' ? 'text-paper-200' : 'text-ink-400'}`}>
                      {format(msg.date, 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            {/* Reply Box */}
            <div className="p-4 bg-white border-t border-paper-200">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full p-3 border border-paper-300 rounded-md resize-none focus:ring-2 focus:ring-paper-400"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <button className="p-2 hover:bg-paper-100 rounded-md text-ink-600">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-ink-400 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-paper-400" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a message from the list to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-paper-200 flex items-center justify-between">
              <h3 className="font-bold text-ink-900">New Message</h3>
              <button onClick={() => setShowCompose(false)} className="p-1 hover:bg-paper-100 rounded">
                <X className="w-5 h-5 text-ink-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">To</label>
                <input
                  type="text"
                  placeholder="Search patients or staff..."
                  className="w-full p-2 border border-paper-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Message subject"
                  className="w-full p-2 border border-paper-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Message</label>
                <textarea
                  placeholder="Type your message..."
                  className="w-full p-2 border border-paper-300 rounded-md h-32"
                />
              </div>
            </div>
            <div className="p-4 border-t border-paper-200 flex justify-end space-x-2">
              <button 
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;

