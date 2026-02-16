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
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/70"
            )}
            title={collapsed ? label : undefined}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon className={cn(
                    "w-[17px] h-[17px] transition-colors duration-200",
                    active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )} strokeWidth={1.8} />
            </div>

            {!collapsed && (
                <>
                    <span className={cn(
                        "text-[12px] transition-colors duration-200 flex-1 tracking-[-0.01em]",
                        active ? "text-blue-700 font-semibold" : "text-gray-600 font-medium"
                    )}>
                        {label}
                    </span>

                    {badge && (
                        <span className={cn(
                            "min-w-[16px] h-[16px] px-1 text-[9px] font-semibold rounded-full flex items-center justify-center transition-all",
                            active
                                ? "bg-blue-600 text-white"
                                : badgeColor === 'amber'
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-200 text-gray-600"
                        )}>
                            {badge}
                        </span>
                    )}
                </>
            )}

            {/* Active indicator — left bar */}
            {active && (
                <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-blue-600 rounded-r-full" />
            )}

            {/* Collapsed badge dot */}
            {collapsed && badge && (
                <div className={cn(
                    "absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full",
                    badgeColor === 'amber' ? "bg-amber-500" : "bg-blue-600"
                )} />
            )}
        </Link>
    );
};

export default SidebarItem;
