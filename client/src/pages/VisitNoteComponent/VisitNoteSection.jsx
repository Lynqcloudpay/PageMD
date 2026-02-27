import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

const VisitNoteSection = ({ title, children, defaultOpen = true, isEdited = false, id, badge, className = "", onDraftWithAI, draftLabel, draftIcon }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div
            id={id}
            className={`vn-card scroll-mt-24 mb-6 relative overflow-visible focus-within:z-[50] ${isEdited ? 'vn-autonomous-active' : ''} ${className}`}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-3.5 flex items-center justify-between bg-blue-100/40 hover:bg-blue-100/60 transition-colors group border-b border-inherit"
            >
                <div className="flex items-center gap-3">
                    <h3 className="vn-title">{title}</h3>
                    {badge !== undefined && (
                        <span className="px-2 py-0.5 bg-gray-50/50 text-gray-500 text-[10px] font-semibold rounded-full border border-gray-200/50">
                            {badge}
                        </span>
                    )}
                    {isEdited && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-500 text-[10px] font-semibold rounded-full border border-blue-100 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            Autonomous Update
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onDraftWithAI && !isEdited && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDraftWithAI();
                            }}
                            className="relative overflow-hidden px-3.5 py-1.5 rounded-lg transition-all duration-300 flex items-center gap-1.5 group bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_2px_10px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_16px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 border border-blue-400/40"
                            title={draftLabel || "Draft with AI"}
                        >
                            {/* Glass reflection effect on hover */}
                            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                            <span className="relative z-10 flex items-center gap-1.5 transform group-hover:scale-[1.03] transition-transform duration-300 drop-shadow-sm">
                                {draftIcon || <Sparkles className="w-3 h-3 text-blue-100 group-hover:text-white animate-pulse" />}
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white">{draftLabel || 'Draft'}</span>
                            </span>
                        </button>
                    )}
                    <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            <div
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[8000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                    }`}
            >
                <div className="p-5 bg-white/40">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default VisitNoteSection;

