import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, FileText } from 'lucide-react';
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

    const handleCloseVisit = (visitId) => {
        setOpenVisits(prev => {
            const next = prev.filter(id => id !== visitId);
            if (next.length === 0) {
                onClose();
            }
            return next;
        });
    };

    // Calculate which visits are shown on screen
    const activeVisits = openVisits.slice(-2); // Display last 2 full size side-by-side
    const stowedVisits = openVisits.slice(0, -2); // The rest in "folder tabs" at bottom left

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

            {/* Main Note Stage - Fluid layout */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center gap-6 max-w-[2400px] mx-auto pb-4">
                <AnimatePresence mode="popLayout">
                    {openVisits.map((vId, idx) => {
                        const isActive = activeVisits.includes(vId);
                        const activeCount = activeVisits.length;
                        const stowedIndex = stowedVisits.indexOf(vId);

                        // Positioning for stacked bottom folders
                        const folderBottom = 0;
                        const folderLeft = 20 + (stowedIndex * 15);
                        const folderZ = stowedIndex;

                        return (
                            <motion.div
                                key={vId}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                                animate={{
                                    opacity: isActive ? 1 : 0.8,
                                    scale: isActive ? 1 : 0.95,
                                    x: isActive ? 0 : folderLeft,
                                    y: isActive ? 0 : folderBottom,
                                    width: isActive ? (activeCount === 1 ? '100%' : '50%') : '300px',
                                    height: isActive ? '100%' : '50px',
                                    zIndex: isActive ? 50 + idx : folderZ,
                                }}
                                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className={`
                                    absolute ${isActive ? 'relative flex items-center justify-center' : 'bottom-0 left-0 cursor-pointer shadow-2xl rounded-t-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:-translate-y-2 transition-all'}
                                `}
                                style={isActive ? { maxWidth: activeCount === 1 ? 1100 : '100%' } : {}}
                                onClick={() => {
                                    if (!isActive) handleOpenNewVisit(vId);
                                }}
                            >
                                {isActive ? (
                                    <div className="w-full h-full relative group shadow-2xl rounded-2xl border-2 border-slate-800/10 overflow-hidden bg-[#F8FAFC]">
                                        <div className="absolute top-4 right-4 z-[60] opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleCloseVisit(vId)}
                                                className="p-1.5 bg-rose-500/90 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-colors hover:scale-105"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {/* MultiVisit mode hides the backdrop in VisitChartView natively */}
                                        <VisitChartView
                                            visitId={vId}
                                            patientId={patientId}
                                            standalone={false}
                                            onOpenNewVisit={handleOpenNewVisit}
                                            onClose={() => handleCloseVisit(vId)}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full px-4 flex items-center justify-between pointer-events-none">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-4 h-4 text-blue-400" />
                                            <div className="text-slate-200 text-xs font-bold uppercase tracking-widest truncate">Review Note</div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MultiVisitViewer;
