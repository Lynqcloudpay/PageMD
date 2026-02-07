import React, { useState } from 'react';
import { Send, X, AlertCircle, Clock, ShieldCheck, Mail } from 'lucide-react';
import Modal from './ui/Modal';
import { inboxAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';

const MessagingModal = ({ isOpen, onClose, patient, currentUser }) => {
    const [body, setBody] = useState('');
    const [subject, setSubject] = useState(`Message from ${currentUser?.first_name || 'your provider'}`);
    const [priority, setPriority] = useState('normal'); // 'normal', 'urgent'
    const [notifyPatient, setNotifyPatient] = useState(false);
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
                priority: priority,
                notifyPatient: notifyPatient
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
            title={
                <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600" />
                    <span>New Secure Message</span>
                </div>
            }
            size="lg" // Widen the modal slightly to allow side-by-side layout if needed
        >
            <div className="flex flex-col h-full gap-4">
                {/* Header Context - Compact */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {patient.first_name?.[0]}{patient.last_name?.[0]}
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">{patient.first_name} {patient.last_name}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium h-4">
                                {patient.email || <span className="text-red-500 italic">No email on file</span>}
                            </div>
                        </div>
                    </div>
                    {/* Priority Toggle - Compact */}
                    <div className="flex p-1 bg-white border border-slate-200 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setPriority('normal')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${priority === 'normal'
                                ? 'bg-blue-50 text-blue-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Normal
                        </button>
                        <button
                            type="button"
                            onClick={() => setPriority('urgent')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${priority === 'urgent'
                                ? 'bg-red-50 text-red-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Urgent
                        </button>
                    </div>
                </div>

                {!patient.email && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                        <AlertCircle size={14} />
                        <span className="font-medium">Cannot send message: No email address on file.</span>
                    </div>
                )}

                {/* Input Fields */}
                <div className="space-y-3 flex-1 flex flex-col">
                    <input
                        type="text"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={sending}
                    />

                    <textarea
                        className="w-full flex-1 p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none shadow-sm min-h-[200px]"
                        placeholder="Type your secure message here..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={sending}
                    />
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-4">
                    {/* Notification Toggle - Compact Switch Style */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={notifyPatient}
                                onChange={(e) => {
                                    console.log('Toggling email notification:', e.target.checked);
                                    setNotifyPatient(e.target.checked);
                                }}
                                disabled={!patient.email}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-xs font-bold ${notifyPatient ? 'text-blue-700' : 'text-slate-500'}`}>Email Notification</span>
                            <span className="text-[9px] text-slate-400">
                                {notifyPatient ? 'Patient will be emailed' : 'Silent (Portal only)'}
                            </span>
                        </div>
                    </label>

                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                            disabled={sending}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={sending || !patient.email || !body.trim()}
                            className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-white shadow-md transition-all flex items-center gap-2 ${sending || !patient.email || !body.trim()
                                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                                }`}
                        >
                            {sending ? 'Sending...' : (
                                <>
                                    <Send size={14} />
                                    Send now
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default MessagingModal;
