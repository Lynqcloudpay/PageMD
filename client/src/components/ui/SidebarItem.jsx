import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer",
                collapsed ? "justify-center px-0 mx-1" : "mx-2",
                active
                    ? "bg-[#83A2DB]/10 text-[#10141A]"
                    : "text-[#10141A]/60 hover:text-[#10141A] hover:bg-[#10141A]/[0.03]"
            )}
            title={collapsed ? label : undefined}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon className={cn(
                    "w-[18px] h-[18px] transition-colors duration-200",
                    active ? "text-[#83A2DB]" : "text-[#10141A]/40 group-hover:text-[#10141A]/70"
                )} strokeWidth={1.8} />
            </div>

            {!collapsed && (
                <>
                    <span className={cn(
                        "text-[13px] font-normal transition-colors duration-200 flex-1 tracking-[-0.01em]",
                        active ? "text-[#10141A] font-medium" : ""
                    )}>
                        {label}
                    </span>

                    {badge && (
                        <span className={cn(
                            "min-w-[18px] h-[18px] px-1.5 text-[10px] font-medium rounded-full flex items-center justify-center transition-all",
                            active
                                ? "bg-[#83A2DB] text-white"
                                : badgeColor === 'amber'
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-[#83A2DB]/10 text-[#83A2DB]"
                        )}>
                            {badge}
                        </span>
                    )}
                </>
            )}

            {/* Minimal active indicator */}
            {active && (
                <div className="absolute left-0 top-[30%] bottom-[30%] w-[2px] bg-[#83A2DB] rounded-r-full" />
            )}

            {/* Collapsed badge dot */}
            {collapsed && badge && (
                <div className={cn(
                    "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
                    badgeColor === 'amber' ? "bg-amber-400" : "bg-[#83A2DB]"
                )} />
            )}
        </Link>
    );
};

export default SidebarItem;
