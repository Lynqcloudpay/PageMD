import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center gap-2.5 px-3.5 py-2 rounded-[1.2rem] transition-all duration-300 overflow-hidden mb-0.5",
                active
                    ? "text-primary-900 bg-white shadow-sm"
                    : "text-slate-600 hover:text-primary-700 hover:bg-white/40"
            )}
        >
            {/* The "Bubble" animation from login page */}
            <div className={cn(
                "absolute inset-0 z-0 transition-all duration-500 ease-out scale-0 origin-center rounded-full bg-primary-50 group-hover:scale-[2.5]",
                active && "scale-[2.5] bg-white"
            )} />

            <div className="relative z-10 flex items-center w-full">
                <Icon className={cn(
                    "w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-110",
                    active ? "text-primary-600" : "text-slate-400 group-hover:text-primary-500"
                )} />

                {!collapsed && (
                    <>
                        <span className={cn(
                            "ml-2.5 text-[12.5px] font-semibold transition-all duration-300 flex-1 tracking-tight",
                            active ? "text-primary-900" : "text-slate-600 group-hover:text-primary-700"
                        )}>
                            {label}
                        </span>

                        {badge && (
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] font-bold rounded-full transition-all",
                                active
                                    ? "bg-primary-600 text-white"
                                    : badgeColor === 'amber'
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-primary-100 text-primary-600"
                            )}>
                                {badge}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Subtle indicator for active state */}
            {active && (
                <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-primary-500 rounded-l-full z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}
        </Link>
    );
};

export default SidebarItem;
