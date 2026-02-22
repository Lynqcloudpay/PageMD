import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, ChevronDown, FileText } from 'lucide-react';
import { visitsAPI } from '../services/api';
import { format } from 'date-fns';
import VisitChartView from './VisitChartView';

const MultiVisitViewer = ({ initialVisitId, patientId, onClose }) => {
    const [openVisits, setOpenVisits] = useState([initialVisitId]);

    // Manage opening a new note or bringing a stowed one forward
    const handleOpenNewVisit = (visitId) => {
        if (!openVisits.includes(visitId)) {
            setOpenVisits(prev => [...prev, visitId]);
        } else {
            // Move to end of array to make it active
            setOpenVisits(prev => [...prev.filter(id => id !== visitId), visitId]);
        }
    };

    const handleCloseVisit = (visitId, e) => {
        if (e) e.stopPropagation();
        setOpenVisits(prev => {
            const next = prev.filter(id => id !== visitId);
            if (next.length === 0) {
                onClose();
            }
            return next;
        });
    };

    const [visitsData, setVisitsData] = useState({});
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        visitsAPI.getByPatient(patientId).then(res => {
            const map = {};
            res.data?.forEach(v => {
                map[v.id] = v;
            });
            setVisitsData(map);
        }).catch(console.error);
    }, [patientId]);

    const decodeHtmlEntities = (text) => {
        if (!text) return '';
        return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/ig, '/');
    };

    const getChiefComplaint = (visitObj) => {
        if (!visitObj?.note_draft) return 'Routine Visit';
        const text = decodeHtmlEntities(visitObj.note_draft);
        const match = text.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Results|Assessment|Plan):)/is);
        return match ? match[1].trim() : 'Routine Visit';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[200] flex flex-col p-4 backdrop-blur-md">
            {/* Top Workspace Toolbar */}
            <div className="flex justify-between items-center mb-6 pl-2 pr-2 relative z-[250]">
                <div className="flex items-center gap-3 text-white font-black tracking-tight bg-slate-900/70 border border-white/10 px-4 py-2 rounded-full shadow-xl backdrop-blur-xl">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Chart Review Workspace</span>

                    <div className="relative">
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="bg-blue-600/90 hover:bg-blue-600 border border-blue-400/30 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                        >
                            <span>{openVisits.length} Open Note{openVisits.length !== 1 && 's'}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 overflow-hidden animate-slide-up">
                                    <div className="px-4 py-2 text-[9px] font-bold uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50">Active Workspace Tabs</div>
                                    <div className="max-h-[40vh] overflow-y-auto">
                                        {openVisits.map(vId => {
                                            const vData = visitsData[vId];
                                            const vDate = vData?.visit_date ? format(new Date(vData.visit_date), 'MMM d, yyyy') : 'Loading...';
                                            const vCC = getChiefComplaint(vData);
                                            const isCurrentFront = vId === openVisits[openVisits.length - 1];

                                            return (
                                                <button
                                                    key={vId}
                                                    onClick={() => {
                                                        handleOpenNewVisit(vId);
                                                        setShowDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group ${isCurrentFront ? 'bg-blue-50/30' : ''}`}
                                                >
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <div className={`text-[11px] font-bold ${isCurrentFront ? 'text-blue-600' : 'text-slate-800'}`}>
                                                            {vDate}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">{vCC}</div>
                                                    </div>
                                                    {isCurrentFront && (
                                                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full">Viewing</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-3 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-all border border-white/10 backdrop-blur-xl shadow-xl group"
                >
                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>
            </div>

            {/* Deck of Cards Stage */}
            <div className="flex-1 w-full relative flex items-center justify-center -mt-6">
                <AnimatePresence>
                    {openVisits.map((vId, idx) => {
                        const total = openVisits.length;
                        const isFront = idx === total - 1;
                        const offset = total - 1 - idx;

                        // Limit visual offset so cards don't disappear off screen
                        const visualOffset = Math.min(offset, 6);

                        return (
                            <motion.div
                                key={vId}
                                layout
                                initial={{ opacity: 0, scale: 0.9, x: 100 }}
                                animate={{
                                    opacity: 1 - (visualOffset * 0.1),
                                    x: isFront ? 0 : -(visualOffset * 85), // Stacks sideways (to the left)
                                    y: 0,
                                    scale: isFront ? 1 : 1 - (visualOffset * 0.04),
                                    zIndex: 100 - offset,
                                }}
                                exit={{ opacity: 0, scale: 0.8, y: 100 }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                className={`absolute w-full max-w-[1250px] h-[calc(100vh-110px)] rounded-[2rem] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden bg-[#F8FAFC] transform-gpu origin-left
                                    ${isFront ? 'border-none cursor-default' : 'border border-slate-300 cursor-pointer'}
                                `}
                                onClick={() => {
                                    if (!isFront) handleOpenNewVisit(vId);
                                }}
                            >
                                {/* Invisible overlay to intercept clicks on background cards */}
                                {!isFront && (
                                    <>
                                        <div className="absolute inset-0 z-50 bg-slate-100/10 hover:bg-slate-100/30 transition-colors" />

                                        {/* Vertical Left Edge Label Badge */}
                                        <div className="absolute left-10 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 -rotate-90 pointer-events-none">
                                            <div className="whitespace-nowrap bg-indigo-600 text-white rounded-full px-6 py-3 flex items-center gap-3 shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-indigo-400/50">
                                                <FileText className="w-4 h-4 text-indigo-200" />
                                                <span className="text-[13px] font-black tracking-tight">{visitsData[vId]?.visit_date ? format(new Date(visitsData[vId].visit_date), 'MMM d, yyyy') : 'Loading'}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                                                <span className="text-[11px] font-bold tracking-widest uppercase text-indigo-100">{getChiefComplaint(visitsData[vId])}</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className={`w-full h-full relative group transition-opacity ${!isFront && 'opacity-60'}`}>
                                    {/* Make sure the iframe components are rendered but visually distinct */}
                                    <div className={`w-full h-full ${!isFront ? 'pointer-events-none' : ''}`}>
                                        <VisitChartView
                                            visitId={vId}
                                            patientId={patientId}
                                            standalone={false}
                                            onOpenNewVisit={handleOpenNewVisit}
                                            onClose={(e) => handleCloseVisit(vId, e)}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MultiVisitViewer;
