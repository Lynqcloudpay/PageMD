import React, { useState } from 'react';
import { MessageSquare, Send, X, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import Modal from './ui/Modal';
import { inboxAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';

const MessagingModal = ({ isOpen, onClose, patient, currentUser }) => {
    const [body, setBody] = useState('');
    const [subject, setSubject] = useState(`Message from ${currentUser?.first_name || 'your provider'}`);
    const [priority, setPriority] = useState('normal'); // 'normal', 'urgent'
    const [sending, setSending] = useState(false);

    if (!patient) return null;

    const handleSend = async () => {
        if (!body.trim()) {
            showError('Please enter a message body');
            return;
        }

        if (!patient.email) {
            showError('Patient does not have an email address on file.');
            return;
        }

        setSending(true);
        try {
            await inboxAPI.sendPatientMessage({
                patientId: patient.id,
                subject: subject || 'Message',
                body: body,
                priority: priority
            });
            showSuccess('Secure message sent to patient portal');
            setBody('');
            onClose();
        } catch (error) {
            console.error('Failed to send message:', error);
            showError(error.response?.data?.error || 'Failed to send secure message');
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Send Secure Message"
            size="md"
        >
            <div className="space-y-6">
                {/* Patient Context */}
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200 font-bold text-lg">
                        {patient.first_name?.[0]}{patient.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                        <h4 className="text-base font-bold text-slate-900">{patient.first_name} {patient.last_name}</h4>
                        <p className="text-xs text-blue-600 font-medium">To: {patient.email || <span className="text-red-500 italic">No email on file</span>}</p>
                    </div>
                    {patient.email && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 shadow-sm">
                            <ShieldCheck size={12} />
                            SECURE
                        </div>
                    )}
                </div>

                {!patient.email && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold mb-1">Missing Email Address</p>
                            <p>You cannot send a portal message without a valid email address on file. Please update the patient's demographics first.</p>
                        </div>
                    </div>
                )}

                {/* Message Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                            placeholder="Message Subject..."
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={sending}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Message Body</label>
                        <textarea
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[160px] resize-none"
                            placeholder="Type your secure message/reminder to the patient here..."
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            disabled={sending}
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPriority('normal')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${priority === 'normal'
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Normal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriority('urgent')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${priority === 'urgent'
                                            ? 'bg-red-50 border-red-200 text-red-700'
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Urgent
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Privacy Note */}
                <div className="flex items-start gap-2.5 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 italic">
                    <Clock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>The patient will receive a notification email and can view this message by logging into the secure HIPAA-compliant patient portal.</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        disabled={sending}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !patient.email || !body.trim()}
                        className={`flex-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${sending || !patient.email || !body.trim()
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 active:scale-95'
                            }`}
                    >
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Send Message
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MessagingModal;
