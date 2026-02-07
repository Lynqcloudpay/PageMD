import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-[1.2rem] transition-all duration-300 overflow-hidden mb-0.5",
                active
                    ? "text-blue-700 bg-white shadow-lg scale-[1.02] z-20"
                    : "text-slate-600 hover:text-sky-700 hover:bg-white/40"
            )}
        >
            {/* The "Bubble" animation from login page */}
            <div className={cn(
                "absolute inset-0 z-0 transition-all duration-700 ease-out scale-0 origin-center rounded-full bg-sky-100/40 group-hover:scale-[3]",
                active && "scale-[3] bg-white"
            )} />

            <div className="relative z-10 flex items-center w-full">
                <Icon className={cn(
                    "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                    active ? "text-blue-600" : "text-slate-400 group-hover:text-sky-600"
                )} />

                {!collapsed && (
                    <>
                        <span className={cn(
                            "ml-3 text-[14px] font-bold transition-all duration-300 flex-1 tracking-tight",
                            active ? "text-blue-700" : "text-slate-600 group-hover:text-sky-700"
                        )}>
                            {label}
                        </span>

                        {badge && (
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] font-bold rounded-full transition-all",
                                active
                                    ? "bg-blue-600 text-white"
                                    : badgeColor === 'amber'
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-sky-100 text-sky-600"
                            )}>
                                {badge}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Subtle indicator for active state */}
            {active && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}
        </Link>
    );
};

export default SidebarItem;
