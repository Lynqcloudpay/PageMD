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

                        // Use a permanent slot memory for consistent visual tracking like physical file folders
                        const slotIndex = tabSlots[vId] ?? (idx % 8);
                        const tabTopPercent = 2 + (slotIndex * 11.8);

                        // Nostalgic, muted physical paper divider colors
                        const tabColors = [
                            'bg-[#5C849C] border-[#4A6D82] text-white', // Muted Blue
                            'bg-[#7D9D7F] border-[#658367] text-white', // Muted Sage Green
                            'bg-[#B65F5F] border-[#9B4E4E] text-white', // Muted Brick Red
                            'bg-[#D4A373] border-[#B9895A] text-white', // Muted Tan
                            'bg-[#8E7CC3] border-[#7464A4] text-white', // Muted Purple
                            'bg-[#6B9E9A] border-[#55827E] text-white', // Muted Teal
                            'bg-[#C27BA0] border-[#A66486] text-white', // Dusty Pink
                            'bg-[#CC8B65] border-[#B07350] text-white', // Clay Orange
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
                                className="absolute w-[92%] max-w-[1150px] md:-ml-8 h-[calc(100vh-110px)] transform-gpu will-change-transform"
                            >
                                {/* Right Edge Manila Folder Tab */}
                                <div
                                    className={`absolute -right-[40px] transition-all duration-200 border-y border-r border-slate-900/20 rounded-r-[12px] cursor-pointer
                                        ${colorClass} ${isFront ? 'opacity-100 shadow-[6px_0_15px_-5px_rgba(0,0,0,0.4)] z-[50]' : 'opacity-90 hover:opacity-100 shadow-[2px_0_5px_rgba(0,0,0,0.1)] hover:-translate-x-1 z-[40]'}
                                    `}
                                    style={{
                                        top: `${tabTopPercent}%`,
                                        height: '11.5%',
                                        width: '40px'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isFront) handleOpenNewVisit(vId);
                                    }}
                                >
                                    <div className="w-full h-full p-2 flex items-center justify-center overflow-hidden">
                                        <div
                                            className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis"
                                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                        >
                                            <span className="opacity-90 shrink-0">{visitsData[vId]?.visit_date ? format(new Date(visitsData[vId].visit_date), 'MM/dd') : 'Load'}</span>
                                            <span className="w-[3px] h-[3px] rounded-full bg-white/50 shrink-0 mx-0.5"></span>
                                            <span className="truncate overflow-hidden text-ellipsis">{getChiefComplaint(visitsData[vId])}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Card Body */}
                                <div
                                    className={`w-full h-full relative rounded-l-[1.5rem] rounded-r-[0.9rem] bg-[#F8FAFC] overflow-hidden shadow-[-8px_8px_30px_rgba(0,0,0,0.15)] ${isFront ? 'border-none' : 'border border-slate-300'}`}
                                >
                                    {/* Invisible overlay to intercept clicks on background cards cleanly */}
                                    {!isFront && (
                                        <div
                                            className="absolute inset-0 z-50 bg-slate-900/5 hover:bg-slate-900/10 transition-colors cursor-pointer"
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
