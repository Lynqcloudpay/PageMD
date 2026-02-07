import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center h-12 rounded-[1.2rem] transition-all duration-500 overflow-hidden mb-1",
                active
                    ? "text-blue-600 bg-white shadow-lg scale-[1.02] z-20"
                    : "text-slate-600 hover:text-blue-600 hover:bg-white/60"
            )}
        >
            {/* Soft Bubble Animation background */}
            <div className={cn(
                "absolute inset-0 z-0 transition-all duration-700 ease-out scale-0 origin-center rounded-full bg-blue-50/40 group-hover:scale-[3]",
                active && "scale-[3] bg-white"
            )} />

            <div className="relative z-10 flex items-center w-full px-2">
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <Icon className={cn(
                        "w-6 h-6 transition-transform duration-500 group-hover:scale-110",
                        active ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"
                    )} />
                </div>

                <div className={cn(
                    "flex-1 flex items-center justify-between ml-1 transition-all duration-500",
                    collapsed ? "opacity-0 translate-x-4 invisible" : "opacity-100 translate-x-0 visible"
                )}>
                    <span className={cn(
                        "text-[14px] font-bold tracking-tight whitespace-nowrap",
                        active ? "text-blue-700" : "text-slate-600 group-hover:text-blue-600"
                    )}>
                        {label}
                    </span>

                    {badge && (
                        <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-full transition-all ml-2",
                            active
                                ? "bg-blue-600 text-white"
                                : badgeColor === 'amber'
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-blue-100 text-blue-600"
                        )}>
                            {badge}
                        </span>
                    )}
                </div>
            </div>

            {/* Subtle active indicator */}
            {active && (
                <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-l-full z-20" />
            )}
        </Link>
    );
};

export default SidebarItem;
