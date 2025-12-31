import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Calendar, Users, Clock, Settings, LogOut, Search, Menu,
    AlertCircle, Video, Shield, DollarSign, ClipboardList, Command
} from 'lucide-react';

/**
 * Sidebar - Matches main PageMD EMR Layout.jsx exactly
 * Same colors, same structure, same navigation items
 */
export function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            logout();
            navigate('/login');
        }
    };

    // Navigation items - same as main EMR
    const navItems = [
        { path: '/', icon: Calendar, label: 'Schedule' },
        { path: '/cancellations', icon: AlertCircle, label: 'Cancellations' },
        { path: '/patients', icon: Users, label: 'Patients' },
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes' },
    ];

    const workflowItems = [
        { path: '/telehealth', icon: Video, label: 'Telehealth' },
    ];

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside className="w-72 fixed left-0 top-0 bottom-0 z-30 bg-white border-r-4 border-[#3B82F6] flex flex-col shadow-xl">
            {/* Logo/Brand - matches main EMR */}
            <div className="h-20 px-6 flex items-center justify-between border-b-2 border-[#3B82F6]/20 bg-white">
                <a href="/" className="flex items-center space-x-3">
                    <img
                        src="/logo.png"
                        alt="PageMD Logo"
                        className="h-10 w-auto object-contain max-w-[180px]"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }}
                    />
                    <span className="text-xl font-bold text-gray-900 hidden">PageMD</span>
                </a>
            </div>

            {/* Quick Search - matches main EMR */}
            <div className="px-4 py-3 border-b-2 border-[#3B82F6]/20 bg-white">
                <button
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-white border-2 border-[#3B82F6]/30 rounded-lg hover:border-[#3B82F6] hover:bg-[#3B82F6]/5 transition-all group min-h-[44px]"
                >
                    <Search className="w-4 h-4 text-[#3B82F6]/70 group-hover:text-[#3B82F6]" />
                    <span className="text-[13px] text-gray-500 flex-1 text-left group-hover:text-[#3B82F6] font-medium">
                        Search patients...
                    </span>
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded">
                        <Command className="w-3 h-3 mr-0.5" />K
                    </kbd>
                </button>
            </div>

            {/* Navigation - matches main EMR exactly */}
            <nav className="flex-1 overflow-hidden px-3 py-3 flex flex-col">
                {/* Primary Navigation */}
                <div className="mb-3 flex-shrink-0">
                    <div className="px-2.5 mb-2">
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            Navigation
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        {navItems.map(item => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className="group relative flex items-center gap-2.5 px-3 py-3 rounded-lg transition-all duration-200 min-h-[48px]"
                                    style={active ? {
                                        background: 'linear-gradient(to right, #3B82F6, #2563EB)',
                                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
                                    } : {}}
                                >
                                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400 group-hover:text-[#3B82F6]'}`} />
                                    <span className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
                                        {item.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>

                {/* Workflow Navigation */}
                <div className="flex-1">
                    <div className="px-2.5 mb-2 mt-1">
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            Workflow
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        {workflowItems.map(item => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className="group relative flex items-center gap-2.5 px-3 py-3 rounded-lg transition-all duration-200 min-h-[48px]"
                                    style={active ? {
                                        background: 'linear-gradient(to right, #3B82F6, #2563EB)',
                                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
                                    } : {}}
                                >
                                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400 group-hover:text-[#3B82F6]'}`} />
                                    <span className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
                                        {item.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Bottom User Panel - matches main EMR */}
            <div className="mt-auto px-3 py-2.5 border-t border-gray-200 bg-gradient-to-b from-white to-gray-50">
                {user && (
                    <div className="flex items-center gap-2">
                        {/* User Button */}
                        <button
                            onClick={() => navigate('/settings')}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all flex-1 bg-white/60 backdrop-blur-sm hover:bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm min-h-[48px]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center text-white text-[11px] font-bold">
                                {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <div className="text-[12px] font-semibold text-gray-900 truncate">
                                    {user.firstName} {user.lastName}
                                </div>
                                <div className="text-[10px] text-gray-500 capitalize truncate font-medium">
                                    {user.role || 'Clinician'}
                                </div>
                            </div>
                        </button>

                        {/* Sign Out Button - red style like main EMR */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center px-2.5 py-2 rounded-lg transition-all hover:bg-red-50 border border-red-200/50 text-red-600 hover:text-red-700 hover:shadow-sm min-h-[48px]"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="ml-1 text-[11px] font-semibold">Out</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
