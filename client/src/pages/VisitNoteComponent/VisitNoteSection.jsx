import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

const VisitNoteSection = ({ title, children, defaultOpen = true, isEdited = false, id, badge, className = "" }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div
            id={id}
            className={`vn-card scroll-mt-24 mb-6 relative overflow-visible focus-within:z-[50] ${isEdited ? 'vn-autonomous-active' : ''} ${className}`}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/50 transition-colors group border-b border-inherit"
            >
                <div className="flex items-center gap-3">
                    <h3 className="vn-title">{title}</h3>
                    {badge !== undefined && (
                        <span className="px-2 py-0.5 bg-slate-100/50 text-slate-500 text-[10px] font-semibold rounded-full border border-slate-200/50">
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
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
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
