import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { patientFlagsAPI } from '../services/api';

const FlagAcknowledgmentModal = ({ flags, onAcknowledged }) => {
    const [loading, setLoading] = useState(false);

    if (!flags || flags.length === 0) return null;

    const handleAcknowledgeTotal = async () => {
        setLoading(true);
        try {
            await Promise.all(flags.map(f => patientFlagsAPI.acknowledge(f.id)));
            onAcknowledged();
        } catch (err) {
            console.error('Failed to acknowledge flags:', err);
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-red-600 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-inner">
                        <AlertTriangle size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Security & Clinical Alerts</h2>
                    <p className="text-red-100 text-sm font-medium mt-1">This patient record has critical flags that require your attention.</p>
                </div>

                <div className="p-6 space-y-4 max-h-[40vh] overflow-y-auto">
                    {flags.map(flag => (
                        <div key={flag.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3">
                            <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                            <div>
                                <h4 className="font-black text-red-900 text-sm uppercase tracking-tight">{flag.label}</h4>
                                <p className="text-red-700 text-xs font-semibold leading-relaxed mt-1">{flag.note || 'No specific instructions provided.'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t bg-slate-50 flex flex-col gap-3">
                    <button
                        onClick={handleAcknowledgeTotal}
                        disabled={loading}
                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <CheckCircle size={18} />
                                I Acknowledge & Understand
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-tighter">
                        Your acknowledgment is being logged for HIPAA compliance purposes.
                    </p>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default FlagAcknowledgmentModal;
