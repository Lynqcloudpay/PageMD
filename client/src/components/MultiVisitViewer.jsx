import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers } from 'lucide-react';
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

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[200] flex flex-col p-4 backdrop-blur-md">
            {/* Top Workspace Toolbar */}
            <div className="flex justify-between items-center mb-6 pl-2 pr-2">
                <div className="flex items-center gap-3 text-white font-black tracking-tight bg-slate-900/70 border border-white/10 px-4 py-2 rounded-full shadow-xl backdrop-blur-xl">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Chart Review Workspace</span>
                    <span className="bg-blue-600/90 border border-blue-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">{openVisits.length} Open Note{openVisits.length !== 1 && 's'}</span>
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
                        const visualOffset = Math.min(offset, 5);

                        return (
                            <motion.div
                                key={vId}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 100 }}
                                animate={{
                                    opacity: 1 - (visualOffset * 0.15),
                                    y: isFront ? 0 : -(visualOffset * 55),
                                    scale: isFront ? 1 : 1 - (visualOffset * 0.04),
                                    zIndex: 100 - offset,
                                }}
                                exit={{ opacity: 0, scale: 0.8, y: 100 }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                className={`absolute w-full max-w-[1100px] h-[85vh] rounded-[2rem] shadow-2xl overflow-hidden bg-[#F8FAFC] origin-bottom
                                    ${isFront ? 'border-2 border-slate-800/10 cursor-default' : 'border border-slate-300 cursor-pointer'}
                                `}
                                onClick={() => {
                                    if (!isFront) handleOpenNewVisit(vId);
                                }}
                            >
                                {/* Invisible overlay to intercept clicks on background cards */}
                                {!isFront && (
                                    <div className="absolute inset-0 z-50 bg-slate-100/10 hover:bg-slate-100/40 transition-colors" />
                                )}

                                <div className={`w-full h-full relative group transition-opacity ${!isFront && 'opacity-70'}`}>
                                    <div className={`absolute top-4 right-4 z-[60] transition-opacity ${isFront ? 'opacity-100' : 'opacity-0'}`}>
                                        <button
                                            onClick={(e) => handleCloseVisit(vId, e)}
                                            className="p-1.5 bg-rose-500/90 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-colors hover:scale-105"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

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
