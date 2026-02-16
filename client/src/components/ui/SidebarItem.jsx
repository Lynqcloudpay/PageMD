import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center transition-all duration-200 cursor-pointer",
                collapsed ? "justify-center w-12 h-12 mx-auto rounded-xl" : "mx-3 px-3 py-2.5 rounded-lg",
                active
                    ? "bg-white/10 text-white shadow-sm shadow-black/20"
                    : "text-white/50 hover:text-white/90 hover:bg-white/5"
            )}
            title={collapsed ? label : undefined}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon className={cn(
                    "w-[20px] h-[20px] transition-all duration-200",
                    active ? "text-white" : "text-white/40 group-hover:text-white/80"
                )} strokeWidth={active ? 2 : 1.5} />
            </div>

            {!collapsed && (
                <>
                    <span className={cn(
                        "text-[13px] transition-colors duration-200 flex-1 ml-3 tracking-[-0.01em]",
                        active ? "text-white font-semibold" : "text-white/60 font-medium"
                    )}>
                        {label}
                    </span>

                    {badge && (
                        <span className={cn(
                            "min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center transition-all",
                            active
                                ? "bg-cyan-500 text-white"
                                : badgeColor === 'amber'
                                    ? "bg-amber-500 text-white"
                                    : "bg-white/20 text-white"
                        )}>
                            {badge}
                        </span>
                    )}
                </>
            )}

            {/* Active Indicator Bar - Matches Reference Image */}
            {active && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-cyan-400 rounded-r-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            )}
        </Link>
    );
};

export default SidebarItem;
