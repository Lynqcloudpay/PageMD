import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

    if (loading && threads.length === 0) return <div className="p-8 text-center text-slate-500">Loading messages...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] max-h-[800px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl">
            <div className="flex flex-1 overflow-hidden">
                {/* Threads Sidebar */}
                <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/30">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                        <h2 className="text-lg font-bold text-slate-800">Messages</h2>
                        <button
                            onClick={() => setShowNewThreadForm(true)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {threads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => fetchThreadMessages(thread.id)}
                                className={`p-4 cursor-pointer border-b border-slate-50 hover:bg-white transition ${selectedThread?.id === thread.id ? 'bg-white border-l-4 border-l-blue-600' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-semibold truncate ${thread.unread_count > 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                                        {thread.subject}
                                    </h3>
                                    {thread.unread_count > 0 && (
                                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {thread.unread_count}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500 truncate">{thread.last_message_body}</p>
                                <span className="text-[10px] text-slate-400 mt-2 block">
                                    {new Date(thread.last_message_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conversation Area */}
                <div className="flex-1 flex flex-col bg-white">
                    {showNewThreadForm ? (
                        <div className="p-8 flex flex-col h-full">
                            <h2 className="text-2xl font-bold mb-6 text-slate-800">New Message</h2>
                            <form onSubmit={handleCreateThread} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                                    <input
                                        type="text"
                                        value={newThreadSubject}
                                        onChange={(e) => setNewThreadSubject(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                                        placeholder="e.g. Question about my medication"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl h-40 focus:ring-2 focus:ring-blue-600 outline-none"
                                        placeholder="Enter your message here..."
                                        required
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                                    >
                                        Send Message
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewThreadForm(false)}
                                        className="px-6 py-3 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : selectedThread ? (
                        <>
                            <div className="p-4 border-b border-slate-100 flex items-center bg-white shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800">{selectedThread.subject}</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender_portal_account_id ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_portal_account_id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                                            <p className="text-sm">{msg.body}</p>
                                            <div className={`text-[10px] mt-1 ${msg.sender_portal_account_id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {msg.sender_user_id ? `Dr/Nurse ${msg.staff_last_name}` : 'You'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                                    placeholder="Type a message..."
                                />
                                <button
                                    type="submit"
                                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 flex-col">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            <p>Select a conversation to read</p>
                            <button
                                onClick={() => setShowNewThreadForm(true)}
                                className="mt-4 text-blue-600 font-semibold hover:underline"
                            >
                                Start a new conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm text-center border-t border-red-100">
                    {error}
                </div>
            )}
        </div>
    );
};

export default PortalMessages;
