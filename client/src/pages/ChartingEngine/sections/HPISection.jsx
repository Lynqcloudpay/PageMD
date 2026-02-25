/**
 * HPISection.jsx
 * Chief Complaint + HPI textarea with dot-phrase autocomplete, F2 navigation, carry-forward.
 */
import React, { useRef, useState, useCallback } from 'react';
import { Copy, Sparkles, History, ChevronDown } from 'lucide-react';
import { visitsAPI } from '../../../services/api';
import { parseNoteText } from '../utils/noteSerializer';

const HPISection = ({
    chiefComplaint, hpi, editedSections, isLocked,
    onUpdateField, onF2Key, onDotPhraseAutocomplete, patientId, currentVisitId,
}) => {
    const hpiRef = useRef(null);
    const [showCarryForward, setShowCarryForward] = useState(false);
    const [previousVisits, setPreviousVisits] = useState([]);
    const [loadingPrevVisits, setLoadingPrevVisits] = useState(false);

    const openCarryForward = useCallback(async () => {
        setShowCarryForward(true);
        setLoadingPrevVisits(true);
        try {
            const res = await visitsAPI.getByPatient(patientId);
            setPreviousVisits(
                (res.data || [])
                    .filter(v => v.id !== currentVisitId && v.note_draft)
                    .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                    .slice(0, 10)
            );
        } catch (e) { setPreviousVisits([]); }
        finally { setLoadingPrevVisits(false); }
    }, [patientId, currentVisitId]);

    const insertCarryForward = useCallback((visit) => {
        const parsed = parseNoteText(visit.note_draft);
        if (parsed.hpi) {
            const newHpi = hpi ? `${hpi}\n\n--- Carried from ${new Date(visit.visit_date).toLocaleDateString()} ---\n${parsed.hpi}` : parsed.hpi;
            onUpdateField('hpi', newHpi);
        }
        setShowCarryForward(false);
    }, [hpi, onUpdateField]);

    return (
        <>
            {/* Chief Complaint */}
            <div className="mb-5">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <label className="text-sm font-bold text-gray-800 uppercase tracking-widest">Chief Complaint</label>
                    {editedSections.has('chiefComplaint') && (
                        <span className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-bold uppercase rounded-full shadow-sm shadow-blue-200 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Modified
                        </span>
                    )}
                </div>
                <div className={`vn-card p-4 bg-white/50 border ${editedSections.has('chiefComplaint') ? 'border-primary-200 ring-4 ring-primary-50/30' : 'border-gray-100'} transition-all`}>
                    <input
                        type="text"
                        placeholder="Enter chief complaint..."
                        value={chiefComplaint || ''}
                        onChange={(e) => onUpdateField('chiefComplaint', e.target.value)}
                        disabled={isLocked}
                        className="vn-input px-3 text-base font-bold"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hpiRef.current?.focus(); } }}
                    />
                </div>
            </div>

            {/* HPI */}
            <div className="mb-5">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <label className="text-sm font-bold text-gray-800 uppercase tracking-widest">History of Present Illness</label>
                    {editedSections.has('hpi') && (
                        <span className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-bold uppercase rounded-full shadow-sm shadow-blue-200 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Modified
                        </span>
                    )}
                </div>
                <div className={`vn-card p-4 bg-white/50 border ${editedSections.has('hpi') ? 'border-primary-200 ring-4 ring-primary-50/30' : 'border-gray-100'} transition-all`}>
                    <textarea
                        id="hpi-textarea"
                        ref={hpiRef}
                        value={hpi || ''}
                        onChange={(e) => {
                            onUpdateField('hpi', e.target.value);
                            onDotPhraseAutocomplete?.(e.target.value, 'hpi', hpiRef);
                        }}
                        onKeyDown={(e) => onF2Key?.(e, hpiRef)}
                        disabled={isLocked}
                        placeholder="Document the history of present illness... Type .phrase for dot phrases, F2 to jump to [placeholders]"
                        className="vn-textarea min-h-[120px]"
                        rows={5}
                    />
                    {!isLocked && (
                        <div className="flex items-center gap-1 mt-2">
                            <button onClick={openCarryForward} className="text-[10px] text-gray-500 hover:text-primary-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-50 transition-all">
                                <Copy className="w-3 h-3" /> Pull from previous
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Carry Forward Modal */}
            {showCarryForward && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCarryForward(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><History className="w-5 h-5" /> Previous HPI</h3>
                        {loadingPrevVisits ? (
                            <div className="py-8 text-center text-gray-400">Loading...</div>
                        ) : previousVisits.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">No previous visits found</div>
                        ) : (
                            <div className="space-y-2">
                                {previousVisits.map(v => {
                                    const parsed = parseNoteText(v.note_draft);
                                    return (
                                        <button key={v.id} onClick={() => insertCarryForward(v)} className="w-full text-left p-3 border border-gray-100 rounded-xl hover:border-primary-200 hover:bg-primary-50/30 transition-all">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs font-bold text-gray-600">{new Date(v.visit_date).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-gray-400">{v.visit_type}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">{parsed.hpi ? parsed.hpi.substring(0, 150) + '...' : 'No HPI'}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <button onClick={() => setShowCarryForward(false)} className="mt-4 w-full py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Close</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default HPISection;
