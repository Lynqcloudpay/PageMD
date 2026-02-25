import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, ChevronDown, FileText } from 'lucide-react';
import { visitsAPI } from '../services/api';
import { format } from 'date-fns';
import VisitChartView from './VisitChartView';

const MultiVisitViewer = ({ initialVisitId, patientId, onClose }) => {
    const [openVisits, setOpenVisits] = useState([initialVisitId]);
    const [tabSlots, setTabSlots] = useState({ [initialVisitId]: 0 });

    // Manage opening a new note or bringing a stowed one forward
    const handleOpenNewVisit = (visitId) => {
        if (!openVisits.includes(visitId)) {
            setOpenVisits(prev => [...prev, visitId]);
            setTabSlots(prev => ({ ...prev, [visitId]: Object.keys(prev).length % 8 }));
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
        <div className="fixed inset-0 bg-gray-50/40 z-[200] flex flex-col p-4 backdrop-blur-md">
            {/* Top Workspace Toolbar */}
            <div className="flex justify-between items-center mb-6 pl-2 pr-2 relative z-[250]">
                <div className="flex items-center gap-3 text-white font-bold tracking-tight bg-gray-50/70 border border-white/10 px-4 py-2 rounded-full shadow-xl backdrop-blur-xl">
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
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 overflow-hidden animate-slide-up">
                                    <div className="px-4 py-2 text-[9px] font-bold uppercase text-gray-400 tracking-widest border-b border-gray-100 bg-gray-50">Active Workspace Tabs</div>
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
                                                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group ${isCurrentFront ? 'bg-blue-50/30' : ''}`}
                                                >
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <div className={`text-[11px] font-bold ${isCurrentFront ? 'text-blue-600' : 'text-gray-800'}`}>
                                                            {vDate}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 truncate">{vCC}</div>
                                                    </div>
                                                    {isCurrentFront && (
                                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full">Viewing</span>
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
                    className="p-3 bg-gray-50/70 hover:bg-gray-50 text-white rounded-full transition-all border border-white/10 backdrop-blur-xl shadow-xl group"
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

                        // Use a permanent slot memory for consistent visual tracking like physical file folders
                        const slotIndex = tabSlots[vId] ?? (idx % 8);

                        // Vibrant, crisp interface colors (Trust & Authority palette)
                        const tabColors = [
                            'bg-blue-600 border-blue-700 text-white',
                            'bg-emerald-600 border-emerald-700 text-white',
                            'bg-violet-600 border-violet-700 text-white',
                            'bg-amber-500 border-amber-600 text-white',
                            'bg-rose-600 border-rose-700 text-white',
                            'bg-cyan-600 border-cyan-700 text-white',
                            'bg-fuchsia-600 border-fuchsia-700 text-white',
                            'bg-teal-600 border-teal-700 text-white',
                        ];
                        const colorClass = tabColors[slotIndex];

                        return (
                            <motion.div
                                key={vId}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                                animate={{
                                    opacity: 1, // Keep solid like real paper
                                    x: 0, // Perfectly flush right edges like a binder
                                    y: -(offset * 2), // Very subtle vertical depth
                                    rotate: 0,
                                    scale: 1, // Stay full size throughout
                                    zIndex: 100 - offset,
                                }}
                                exit={{ opacity: 0, scale: 0.95, y: -20, x: -20 }}
                                transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
                                className="absolute w-[92%] max-w-[1150px] md:-ml-8 transform-gpu will-change-transform"
                                style={{ height: 'calc(100vh - 110px)', height: 'calc(100dvh - 110px)' }}
                            >
                                {/* Right Edge Manila Folder Tab */}
                                <div
                                    className={`absolute transition-all duration-300 border-y border-r border-black/10 rounded-r-xl cursor-pointer flex items-center justify-center shadow-md
                                        ${colorClass} ${isFront ? 'z-[50] shadow-[8px_0_15px_-3px_rgba(0,0,0,0.3)]' : 'opacity-[0.95] hover:opacity-100 z-[40] hover:-translate-x-1'}
                                    `}
                                    style={{
                                        top: `calc(1% + ${slotIndex * 12}%)`,
                                        height: '11.5%',
                                        minHeight: '130px',
                                        width: isFront ? '46px' : '40px',
                                        right: isFront ? '-46px' : '-40px'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isFront) handleOpenNewVisit(vId);
                                    }}
                                >
                                    <div
                                        className="transform rotate-90 whitespace-nowrap font-bold uppercase tracking-wider flex flex-col items-center justify-center absolute pointer-events-none leading-tight"
                                        style={{ width: '125px' }} // Fixed width matches bounds perfectly
                                    >
                                        <span className="text-[10px] opacity-100">{visitsData[vId]?.visit_date ? format(new Date(visitsData[vId].visit_date), 'MMM d, yyyy') : 'Loading'}</span>
                                        <span className="text-[8.5px] opacity-80 truncate w-full text-center mt-0.5">{getChiefComplaint(visitsData[vId])}</span>
                                    </div>
                                </div>

                                {/* Main Card Body */}
                                <div
                                    className={`w-full h-full relative rounded-l-[1.5rem] rounded-r-[0.9rem] bg-white overflow-hidden shadow-[-8px_8px_30px_rgba(0,0,0,0.15)] ${isFront ? 'border-none' : 'border border-gray-200'}`}
                                >
                                    {/* Invisible overlay to intercept clicks on background cards cleanly */}
                                    {!isFront && (
                                        <div
                                            className="absolute inset-0 z-50 bg-gray-50/5 hover:bg-gray-50/10 transition-colors cursor-pointer"
                                            onClick={() => handleOpenNewVisit(vId)}
                                        />
                                    )}

                                    <div className={`w-full h-full relative group transition-opacity duration-300 ${!isFront ? 'opacity-50 pointer-events-none' : ''}`}>
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
