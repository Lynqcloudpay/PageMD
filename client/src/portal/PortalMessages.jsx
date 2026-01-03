import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MessageSquare,
    Send,
    Plus,
    ChevronLeft,
    User,
    Clock,
    Search,
    MoreVertical,
    CheckCircle2
} from 'lucide-react';

const PortalMessages = () => {
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [newThreadSubject, setNewThreadSubject] = useState('');
    const [showNewThreadForm, setShowNewThreadForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchThreads();
    }, []);

    const fetchThreads = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${apiBase}/portal/messages/threads`, { headers });
            setThreads(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to load messages.');
        } finally {
            setLoading(false);
        }
    };

    const fetchThreadMessages = async (threadId) => {
        try {
            const response = await axios.get(`${apiBase}/portal/messages/threads/${threadId}`, { headers });
            setMessages(response.data.messages);
            setSelectedThread(response.data.thread);
        } catch (err) {
            setError('Failed to load conversation.');
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await axios.post(`${apiBase}/portal/messages/threads/${selectedThread.id}`,
                { body: newMessage },
                { headers }
            );
            setNewMessage('');
            fetchThreadMessages(selectedThread.id);
            fetchThreads(); // Update last message in list
        } catch (err) {
            setError('Failed to send message.');
        }
    };

    const handleCreateThread = async (e) => {
        e.preventDefault();
        if (!newThreadSubject.trim() || !newMessage.trim()) return;

        try {
            const response = await axios.post(`${apiBase}/portal/messages/threads`,
                { subject: newThreadSubject, body: newMessage },
                { headers }
            );
            setNewThreadSubject('');
            setNewMessage('');
            setShowNewThreadForm(false);
            fetchThreads();
            fetchThreadMessages(response.data.threadId);
        } catch (err) {
            setError('Failed to start new conversation.');
        }
    };

    if (loading && threads.length === 0) return (
        <div className="flex flex-col items-center justify-center p-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Secure Inbox...</p>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] max-h-[900px] border border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl shadow-slate-200/50 animate-in fade-in duration-500">
            <div className="flex flex-1 overflow-hidden">
                {/* Threads Sidebar */}
                <div className={`w-full md:w-80 lg:w-96 border-r border-slate-50 flex flex-col bg-slate-50/30 ${selectedThread || showNewThreadForm ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Messages</h2>
                        <button
                            onClick={() => setShowNewThreadForm(true)}
                            className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg shadow-slate-200"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 bg-white/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {threads.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
                            </div>
                        ) : threads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => { fetchThreadMessages(thread.id); setShowNewThreadForm(false); }}
                                className={`p-6 cursor-pointer border-b border-white hover:bg-white transition-all duration-300 relative group ${selectedThread?.id === thread.id ? 'bg-white shadow-xl shadow-slate-200/50 z-10' : ''}`}
                            >
                                {selectedThread?.id === thread.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900" />
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className={`font-black tracking-tight truncate flex-1 uppercase text-xs ${thread.unread_count > 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                                        {thread.subject}
                                    </h3>
                                    <span className="text-[10px] text-slate-400 font-bold ml-2">
                                        {new Date(thread.last_message_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className={`text-sm truncate ${thread.unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                    {thread.last_message_body || 'No messages'}
                                </p>
                                {thread.unread_count > 0 && (
                                    <div className="absolute right-6 bottom-6 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                                        {thread.unread_count}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conversation Area */}
                <div className={`flex-1 flex flex-col bg-white ${!selectedThread && !showNewThreadForm ? 'hidden md:flex' : 'flex'}`}>
                    {showNewThreadForm ? (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                                <button onClick={() => setShowNewThreadForm(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-900">
                                    <ChevronLeft />
                                </button>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">New Conversation</h1>
                            </div>
                            <div className="p-10 flex-1 overflow-y-auto">
                                <form onSubmit={handleCreateThread} className="max-w-2xl space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                                        <input
                                            type="text"
                                            value={newThreadSubject}
                                            onChange={(e) => setNewThreadSubject(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                                            placeholder="What is this regarding?"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Message</label>
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl h-60 focus:bg-white focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
                                            placeholder="Please provide details..."
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            type="submit"
                                            className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                                        >
                                            Send Message
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewThreadForm(false)}
                                            className="px-10 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : selectedThread ? (
                        <>
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setSelectedThread(null)} className="md:hidden p-2 text-slate-400 hover:text-slate-900">
                                        <ChevronLeft />
                                    </button>
                                    <div>
                                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Conversation</div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedThread.subject}</h3>
                                    </div>
                                </div>
                                <button className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-50 transition-colors">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-[#F8FAFC]">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${msg.sender_portal_account_id ? 'items-end text-right' : 'items-start text-left'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2 px-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {msg.sender_user_id ? `Dr/Nurse ${msg.staff_last_name}` : 'You'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className={`max-w-[85%] lg:max-w-[70%] p-5 rounded-[2rem] shadow-sm ${msg.sender_portal_account_id
                                            ? 'bg-slate-900 text-white rounded-tr-none'
                                            : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none'}`}>
                                            <p className="text-sm font-medium leading-relaxed">{msg.body}</p>
                                        </div>
                                    </div>
                                ))}
                                {messages.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center p-20 text-slate-300">
                                        No messages in this chat.
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-white border-t border-slate-50">
                                <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-slate-50 p-2 rounded-[2rem] focus-within:ring-4 focus-within:ring-blue-600/5 transition-all">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="flex-1 px-6 py-3 bg-transparent border-none outline-none font-medium text-slate-900 placeholder:text-slate-400"
                                        placeholder="Type your message..."
                                    />
                                    <button
                                        type="submit"
                                        className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 hover:-translate-y-0.5"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 flex-col p-10">
                            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                                <MessageSquare className="w-12 h-12 text-slate-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Select a Chat</h3>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Choose from your existing conversations</p>
                            <button
                                onClick={() => setShowNewThreadForm(true)}
                                className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                            >
                                Start New Conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {error && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 z-50 animate-bounce">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default PortalMessages;
