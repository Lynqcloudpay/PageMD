import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SidebarItem = ({ to, icon: Icon, label, badge, badgeColor, active, collapsed }) => {
    return (
        <Link
            to={to}
            className={cn(
                "group relative flex items-center transition-all duration-150 cursor-pointer",
                collapsed ? "justify-center w-11 h-11 mx-auto rounded-xl" : "mx-2.5 px-3 py-2 rounded-lg",
                active
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
            title={collapsed ? label : undefined}
        >
            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon className={cn(
                    "w-[18px] h-[18px] transition-colors duration-150",
                    active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )} strokeWidth={active ? 2 : 1.7} />
            </div>

            {!collapsed && (
                <span className={cn(
                    "text-[13px] transition-colors duration-150 flex-1 ml-3 tracking-tight",
                    active ? "text-blue-600 font-semibold" : "text-gray-600 font-medium group-hover:text-gray-900"
                )}>
                    {label}
                </span>
            )}

            {badge && (
                <span className={cn(
                    "min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center transition-all",
                    collapsed ? "absolute -top-0.5 -right-0.5 border-2 border-white shadow-sm scale-90" : "ml-2",
                    active
                        ? "bg-blue-600 text-white"
                        : badgeColor === 'amber'
                            ? "bg-amber-500 text-white"
                            : badgeColor === 'grey'
                                ? "bg-gray-200 text-gray-600"
                                : "bg-blue-600 text-white"
                )}>
                    {badge}
                </span>
            )}

            {/* Active indicator */}
            {active && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-blue-600 rounded-r-full" />
            )}
        </Link>
    );
};

export default SidebarItem;
