import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center gap-2.5 rounded-lg transition-all duration-200 cursor-pointer",
                collapsed ? "justify-center mx-1 p-1.5" : "mx-2 px-2.5 py-[7px]",
                active
                    ? "bg-white/[0.12] text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
            )}
            title={collapsed ? label : undefined}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon className={cn(
                    "w-[17px] h-[17px] transition-colors duration-200",
                    active ? "text-white" : "text-white/45 group-hover:text-white/75"
                )} strokeWidth={1.8} />
            </div>

            {!collapsed && (
                <>
                    <span className={cn(
                        "text-[12px] transition-colors duration-200 flex-1 tracking-[-0.01em]",
                        active ? "text-white font-medium" : "font-normal"
                    )}>
                        {label}
                    </span>

                    {badge && (
                        <span className={cn(
                            "min-w-[16px] h-[16px] px-1 text-[9px] font-medium rounded-full flex items-center justify-center transition-all",
                            active
                                ? "bg-white/25 text-white"
                                : badgeColor === 'amber'
                                    ? "bg-amber-400/20 text-amber-300"
                                    : "bg-white/10 text-white/50"
                        )}>
                            {badge}
                        </span>
                    )}
                </>
            )}

            {/* Active indicator — left bar */}
            {active && (
                <div className="absolute left-0 top-[25%] bottom-[25%] w-[2px] bg-white rounded-r-full" />
            )}

            {/* Collapsed badge dot */}
            {collapsed && badge && (
                <div className={cn(
                    "absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full",
                    badgeColor === 'amber' ? "bg-amber-400" : "bg-[#83A2DB]"
                )} />
            )}
        </Link>
    );
};

export default SidebarItem;
