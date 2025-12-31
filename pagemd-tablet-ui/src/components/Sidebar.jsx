import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import {
    Calendar,
    Users,
    MessageSquare,
    Settings,
    LogOut,
    Activity,
    ClipboardList
} from 'lucide-react';

const navItems = [
    { to: '/', icon: Calendar, label: 'Today' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/messages', icon: MessageSquare, label: 'Messages' },
];

export function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 py-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">PageMD</h1>
                        <p className="text-xs text-slate-400">Tablet EMR</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <ul className="space-y-1">
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <li key={to}>
                            <NavLink
                                to={to}
                                className={({ isActive }) => cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                                    'min-h-[48px]',
                                    isActive
                                        ? 'bg-primary-500 text-white'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                )}
                            >
                                <Icon className="w-5 h-5 shrink-0" />
                                {label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User & Settings */}
            <div className="border-t border-slate-800 p-3">
                <NavLink
                    to="/settings"
                    className={({ isActive }) => cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-2',
                        isActive
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                >
                    <Settings className="w-5 h-5" />
                    Settings
                </NavLink>

                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg">
                    <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {user?.firstName} {user?.lastName}
                        </div>
                        <div className="text-xs text-slate-400">{user?.role}</div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg text-slate-400 hover:text-error-400 hover:bg-slate-700 transition-colors"
                        title="Sign Out"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
