import React, { useState, useEffect } from 'react';
import {
    CheckCircle, XCircle, AlertTriangle, User, Building,
    ClipboardList, FileCheck, Search, ArrowRight, Save,
    UserPlus, Link as LinkIcon, AlertCircle, Clock
} from 'lucide-react';
import Modal from './ui/Modal';
import { intakeAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { format } from 'date-fns';

const IntakeReviewModal = ({ isOpen, onClose, sessionId, onApproved }) => {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [duplicates, setDuplicates] = useState([]);
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);
    const [sendBackNote, setSendBackNote] = useState('');
    const [showSendBack, setShowSendBack] = useState(false);
    const [approving, setApproving] = useState(false);
    const [selectedDuplicateId, setSelectedDuplicateId] = useState(null);

    useEffect(() => {
        if (isOpen && sessionId) {
            loadSession();
        }
    }, [isOpen, sessionId]);

    const loadSession = async () => {
        setLoading(true);
        try {
            const res = await intakeAPI.getSession(sessionId);
            setSession(res.data);

            // Check for duplicates automatically
            setCheckingDuplicates(true);
            const dupRes = await intakeAPI.getDuplicates(sessionId);
            setDuplicates(dupRes.data || []);
        } catch (e) {
            showError('Failed to load session');
            onClose();
        } finally {
            setLoading(false);
            setCheckingDuplicates(false);
        }
    };

    const handleApprove = async () => {
        setApproving(true);
        try {
            const res = await intakeAPI.approve(sessionId, selectedDuplicateId);
            showSuccess(selectedDuplicateId ? 'Data linked to existing patient' : 'New patient record created');
            if (onApproved) onApproved(res.data.patientId);
            onClose();
        } catch (e) {
            showError(e.response?.data?.error || 'Approval failed');
        } finally {
            setApproving(false);
        }
    };

    const handleSendBack = async () => {
        if (!sendBackNote.trim()) return;
        try {
            await intakeAPI.needsEdits(sessionId, sendBackNote);
            showSuccess('Sent back to patient for edits');
            onClose();
        } catch (e) {
            showError('Failed to send back');
        }
    };

    if (!session && !loading) return null;

    const data = session?.data_json || {};
    const prefill = session?.prefill_json || {};

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Review Patient Registration"
            size="xl"
        >
            {loading ? (
                <div className="p-12 text-center text-gray-400">Loading session data...</div>
            ) : (
                <div className="flex flex-col h-[70vh]">
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Status Alert */}
                        {session.status === 'NEEDS_EDITS' && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 text-red-800 italic">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>This session was previously sent back for edits. Review the latest changes.</span>
                            </div>
                        )}

                        {/* Duplicate Checker */}
                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
                            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-4">
                                <Search className="w-4 h-4" /> Duplicate Check
                            </h3>
                            {checkingDuplicates ? (
                                <div className="text-xs text-amber-600 animate-pulse">Scanning database for likely matches...</div>
                            ) : duplicates.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-amber-800 font-medium">Found {duplicates.length} potential matches in the database:</p>
                                    <div className="space-y-2">
                                        {duplicates.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => setSelectedDuplicateId(p.id === selectedDuplicateId ? null : p.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedDuplicateId === p.id ? 'bg-amber-100 border-amber-300 shadow-sm' : 'bg-white border-amber-200 hover:border-amber-300'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                                                        {p.first_name?.[0]}{p.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{p.first_name} {p.last_name}</div>
                                                        <div className="text-[10px] text-gray-500">MRN: {p.mrn} • DOB: {p.dob ? format(new Date(p.dob), 'MM/dd/yyyy') : 'N/A'}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedDuplicateId === p.id ? 'bg-amber-600 border-amber-600' : 'border-gray-200'}`}>
                                                    {selectedDuplicateId === p.id && <CheckCircle className="w-3 h-3 text-white" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-700 mt-2">Selecting a match will <b>update</b> that patient's record instead of creating a new one.</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                                    <CheckCircle className="w-4 h-4" /> No potential duplicates found. Safe to create new patient.
                                </div>
                            )}
                        </div>

                        {/* Submission Content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Column 1: Demographics */}
                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <User className="w-3 h-3" /> Demographics
                                    </h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">Name</span>
                                            <span className="text-sm font-bold text-gray-900">{prefill.firstName} {prefill.lastName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">DOB</span>
                                            <span className="text-sm font-bold text-gray-900">{prefill.dob}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">Sex</span>
                                            <span className="text-sm font-bold text-gray-900 capitalize">{data.sex || 'Not Specified'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">Phone</span>
                                            <span className="text-sm font-bold text-gray-900">{prefill.phone}</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Building className="w-3 h-3" /> Insurance
                                    </h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">Carrier</span>
                                            <span className="text-sm font-bold text-gray-900">{data.insuranceProvider || 'None'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500">Policy ID</span>
                                            <span className="text-sm font-bold text-gray-900">{data.insuranceId || 'N/A'}</span>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Column 2: History & Medical */}
                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <ClipboardList className="w-3 h-3" /> Medical History
                                    </h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Primary Reason</span>
                                            <p className="text-sm text-gray-700 mt-1">{data.reason || 'Not Specified'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Medications & Allergies</span>
                                            <p className="text-sm text-gray-700 mt-1">{data.medications || 'None reported'}</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <FileCheck className="w-3 h-3" /> Consents
                                    </h4>
                                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                                            <CheckCircle className="w-4 h-4" /> HIPPA Agreement Signed
                                        </div>
                                        <p className="text-[10px] text-emerald-600 mt-1 uppercase font-bold tracking-tighter">
                                            Submission Timestamp: {session.submitted_at ? format(new Date(session.submitted_at), 'MM/dd/yyyy HH:mm') : 'N/A'}
                                        </p>
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Audit Trail */}
                        {session.review_notes && session.review_notes.length > 0 && (
                            <section>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Previous Notes</h4>
                                <div className="space-y-3">
                                    {session.review_notes.map((n, i) => (
                                        <div key={i} className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-gray-700">{n.author}</span>
                                                <span className="text-[10px] text-gray-400">{format(new Date(n.created_at), 'MMM d, h:mm a')}</span>
                                            </div>
                                            <p className="text-gray-600 italic">"{n.note}"</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        {showSendBack ? (
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-gray-700">Correction Required (shown to patient):</label>
                                <textarea
                                    value={sendBackNote}
                                    onChange={e => setSendBackNote(e.target.value)}
                                    placeholder="e.g. Please clarify your insurance policy ID."
                                    className="w-full border border-gray-300 rounded-xl p-3 text-sm min-h-[80px]"
                                />
                                <div className="flex gap-3">
                                    <button onClick={() => setShowSendBack(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                    <button
                                        onClick={handleSendBack}
                                        disabled={!sendBackNote.trim()}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
                                    >
                                        Send to Patient
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowSendBack(true)}
                                    className="flex-1 py-4 bg-white border border-gray-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-5 h-5" /> Need Correction
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={approving || session.status === 'APPROVED'}
                                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {approving ? (
                                        <Clock className="w-5 h-5 animate-spin" />
                                    ) : selectedDuplicateId ? (
                                        <><LinkIcon className="w-5 h-5" /> Link to Selected Patient</>
                                    ) : (
                                        <><UserPlus className="w-5 h-5" /> Approve & Create Patient</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default IntakeReviewModal;
