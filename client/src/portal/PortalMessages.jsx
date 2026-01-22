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
    CheckCircle2,
    Calendar,
    ChevronRight,
    ArrowRight,
    Trash2
} from 'lucide-react';

const PortalMessages = () => {
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [newThreadSubject, setNewThreadSubject] = useState('');
    const [assignedUserId, setAssignedUserId] = useState('');
    const [staff, setStaff] = useState([]);
    const [showNewThreadForm, setShowNewThreadForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchThreads();
        fetchStaff();
        fetchPatientProfile();
    }, []);

    // Poll for new messages every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchThreads(true); // true = silent refresh
            if (selectedThread) {
                fetchThreadMessages(selectedThread.id, true);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedThread]);

    const fetchThreads = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const response = await axios.get(`${apiBase}/portal/messages/threads`, { headers });
            setThreads(response.data);
            setError(null);
        } catch (err) {
            if (!silent) setError('Failed to load messages.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchThreadMessages = async (threadId, silent = false) => {
        try {
            const response = await axios.get(`${apiBase}/portal/messages/threads/${threadId}`, { headers });
            setMessages(response.data.messages);
            if (!silent) setSelectedThread(response.data.thread);
        } catch (err) {
            if (!silent) setError('Failed to load conversation.');
        }
    };

    // ... existing helper functions ...

    // (This part replaces the fetching logic, skipping to valid JSX rendering for thread list)

    // ...

    return (
        <div className="flex flex-col h-[70vh] md:h-[calc(100vh-180px)] max-h-[850px] border border-slate-100 rounded-[2rem] overflow-hidden bg-white shadow-xl shadow-slate-200/50 animate-in fade-in duration-500">
            <div className="flex flex-1 overflow-hidden">
                {/* Threads Sidebar */}
                <div className={`w-full md:w-80 lg:w-96 border-r border-slate-50 flex flex-col bg-slate-50/20 ${selectedThread || showNewThreadForm ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Messages</h2>
                        <button
                            onClick={() => setShowNewThreadForm(true)}
                            className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                            <Plus className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    <div className="p-4 bg-white/50 border-b border-slate-50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-100/50 border-none rounded-xl text-[12px] focus:ring-2 focus:ring-blue-600/10 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {threads.length === 0 ? (
                            <div className="p-10 text-center text-slate-300">
                                <MessageSquare className="w-10 h-10 mx-auto mb-4 opacity-5" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No messages yet</p>
                            </div>
                        ) : threads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => { fetchThreadMessages(thread.id); setShowNewThreadForm(false); }}
                                className={`p-4 px-5 cursor-pointer border-b border-slate-50/50 hover:bg-white transition-all duration-300 relative group ${selectedThread?.id === thread.id ? 'bg-white shadow-md z-10' : ''}`}
                            >
                                {selectedThread?.id === thread.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                                )}

                                {/* iMessage Style Blue Dot for Unread */}
                                {thread.unread_count > 0 && (
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse shadow-sm shadow-blue-300" />
                                )}

                                <div className="flex justify-between items-start mb-1.5 pl-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-bold tracking-tight truncate text-sm ${thread.unread_count > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {thread.last_sender_name ? `Dr. ${thread.last_sender_name}` : (thread.staff_first_name ? `Dr. ${thread.staff_first_name} ${thread.staff_last_name}` : 'Care Team')}
                                        </h3>
                                        <p className="text-[10px] text-slate-400 truncate font-medium">{thread.subject}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                                            {new Date(thread.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                        <button
                                            onClick={(e) => handleDeleteThread(thread.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                            title="Delete conversation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className={`text-[12px] truncate pl-2 ${thread.unread_count > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
                                    {thread.last_message_body || 'No messages'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conversation Area */}
                <div className={`flex-1 flex flex-col bg-white ${!selectedThread && !showNewThreadForm ? 'hidden md:flex' : 'flex'}`}>
                    {showNewThreadForm ? (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-6 border-b border-slate-50 flex items-center gap-4">
                                <button onClick={() => setShowNewThreadForm(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-800">
                                    <ChevronLeft />
                                </button>
                                <h1 className="text-xl font-bold text-slate-800 tracking-tight">New Conversation</h1>
                            </div>
                            <div className="p-8 flex-1 overflow-y-auto">
                                <form onSubmit={handleCreateThread} className="max-w-xl space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Send to Staff Member</label>
                                        <select
                                            value={assignedUserId}
                                            onChange={(e) => setAssignedUserId(e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-[12px] text-slate-800 appearance-none"
                                        >
                                            <option value="">Select a specific clinician (optional)</option>
                                            {staff.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.role === 'clinician' ? 'Dr.' : ''} {s.first_name} {s.last_name} ({s.role.toUpperCase()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                                        <input
                                            type="text"
                                            value={newThreadSubject}
                                            onChange={(e) => setNewThreadSubject(e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-bold text-[13px] text-slate-800 placeholder:text-slate-300"
                                            placeholder="What is this regarding?"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Message Detail</label>
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl h-48 focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-medium text-[13px] text-slate-800 placeholder:text-slate-300"
                                            placeholder="Please describe your inquiry..."
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-4 pt-2">
                                        <button
                                            type="submit"
                                            className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                        >
                                            Send Message
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewThreadForm(false)}
                                            className="px-8 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : selectedThread ? (
                        <>
                            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setSelectedThread(null)} className="md:hidden p-2 text-slate-400 hover:text-slate-800">
                                        <ChevronLeft />
                                    </button>
                                    <div>
                                        <div className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-0.5">Secure Conversation</div>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-none">{selectedThread.subject}</h3>
                                    </div>
                                </div>
                                <button className="p-2 text-slate-300 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
                                    <MoreVertical className="w-4.5 h-4.5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-[#F8FAFC]/50">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${msg.sender_portal_account_id ? 'items-end' : 'items-start'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5 px-2">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                {msg.sender_user_id ? `Dr. ${msg.staff_first_name} ${msg.staff_last_name}` : 'You'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className={`max-w-[85%] lg:max-w-[75%] p-4 px-5 rounded-[1.8rem] shadow-sm text-sm ${msg.sender_portal_account_id
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-slate-200/50'}`}>
                                            <div className="font-medium leading-relaxed">
                                                {msg.body.split('\n').map((line, i) => {
                                                    const suggestMatch = line.match(/\[SUGGEST_SLOT:(.+?)T(.+?)\]/i);
                                                    if (suggestMatch) {
                                                        const [_, date, time] = suggestMatch;
                                                        const cleanLine = line.replace(/\[SUGGEST_SLOT:.+?\]/i, '').trim();
                                                        return (
                                                            <div key={i} className="my-4 p-5 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in zoom-in duration-300">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
                                                                        <Calendar size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Suggested Time</div>
                                                                        <span className="text-emerald-900 font-bold text-sm tracking-tight">{cleanLine}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const confirmText = `I accept the appointment on ${date} at ${time}. [ACCEPTED_SLOT:${date}T${time}]`;
                                                                        axios.post(`${apiBase}/portal/messages/threads/${selectedThread.id}`,
                                                                            { body: confirmText },
                                                                            { headers }
                                                                        ).then(() => {
                                                                            fetchThreadMessages(selectedThread.id);
                                                                        });
                                                                    }}
                                                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2 shrink-0 group"
                                                                >
                                                                    Accept Slot <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                                </button>
                                                            </div>
                                                        );
                                                    }
                                                    return <p key={i} className="mb-1">{line}</p>;
                                                })}
                                            </div>
                                        </div>
                                        {msg.read_at && msg.sender_portal_account_id && (
                                            <div className="flex items-center gap-1 mt-1 px-2 text-[8px] font-bold text-blue-400 uppercase tracking-widest">
                                                <CheckCircle2 size={10} /> Read
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 md:p-5 bg-white border-t border-slate-50">
                                <form onSubmit={handleSendMessage} className="flex items-end gap-3 bg-slate-100/50 p-1.5 pl-5 rounded-[1.5rem] focus-within:ring-4 focus-within:ring-blue-600/5 transition-all">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="flex-1 py-2.5 bg-transparent border-none outline-none font-medium text-[13px] text-slate-800 placeholder:text-slate-400 resize-none max-h-32 min-h-[40px] custom-scrollbar"
                                        placeholder="Type your reply..."
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:-translate-y-0.5 mb-0.5 shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 flex-col p-10">
                            <div className="w-24 h-24 bg-blue-50/50 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="w-8 h-8 text-blue-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1.5 tracking-tight">Messaging Center</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">Send secure information to your care team</p>
                            <button
                                onClick={() => setShowNewThreadForm(true)}
                                className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                            >
                                New Conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {error && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-2.5 rounded-full font-bold text-[10px] uppercase shadow-xl flex items-center gap-3 z-50 animate-bounce">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default PortalMessages;
