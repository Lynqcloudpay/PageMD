import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, Settings, LogOut, Search, X, Activity,
    Clock, History, User, ClipboardList, BarChart3,
    MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
    Zap, Command, DollarSign, Shield, AlertCircle
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { usePermissions } from '../hooks/usePermissions';
import { patientsAPI, messagesAPI, visitsAPI, followupsAPI } from '../services/api';
import PatientTabs from './PatientTabs';
import MobileMenu from './MobileMenu';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { searchPatients } = usePatient();
    const { addTab, tabs, switchTab } = usePatientTabs();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { unreadCount: tasksCount } = useTasks();

    const [pendingNotesCount, setPendingNotesCount] = useState(0);
    const [pendingCancellationsCount, setPendingCancellationsCount] = useState(0);

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    // Fetch unread counts
    useEffect(() => {


        // Fetch pending notes count
        const fetchPendingNotesCount = async () => {
            try {
                const response = await visitsAPI.getPending();
                if (response && response.data) {
                    const count = Array.isArray(response.data) ? response.data.length : 0;
                    setPendingNotesCount(count);
                } else {
                    setPendingNotesCount(0);
                }
            } catch (error) {
                console.error('Error fetching pending notes count:', error);
                setPendingNotesCount(0);
            }
        };

        // Fetch pending cancellations count
        const fetchPendingCancellationsCount = async () => {
            try {
                const response = await followupsAPI.getStats();
                const stats = response.data || response;
                const count = stats.pending_count || 0;
                setPendingCancellationsCount(count);
            } catch (error) {
                console.error('Error fetching pending cancellations count:', error);
                setPendingCancellationsCount(0);
            }
        };

        // Initial fetch

        fetchPendingNotesCount();
        fetchPendingCancellationsCount();

        // Refresh counts periodically (every 30 seconds)
        const interval = setInterval(() => {

            fetchPendingNotesCount();
            fetchPendingCancellationsCount();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    // Use permissions instead of role checks
    const { can, getScope } = usePermissions();
    const scope = getScope();

    // Check permissions for navigation items
    const canViewSchedule = can('schedule:view');
    const canManageUsers = can('users:manage');
    const canViewPatients = can('patients:view_list');
    const canViewBilling = can('billing:view');
    const canViewReports = can('reports:view');

    // Show "My Schedule" if user has schedule:view and scope is SELF (clinicians)
    const showMySchedule = canViewSchedule && scope.scheduleScope === 'SELF';

    // Navigation items with icons and badges (gated by permissions)
    const navItems = [
        // Schedule - requires schedule:view permission
        ...(canViewSchedule ? [
            { path: '/schedule', icon: Calendar, label: 'Schedule', badge: null },
            ...(showMySchedule ? [
                { path: '/my-schedule', icon: User, label: 'My Schedule', badge: null }
            ] : [])
        ] : []),
        { path: '/cancellations', icon: AlertCircle, label: 'Cancellations', badge: pendingCancellationsCount > 0 ? pendingCancellationsCount : null },
        // Patients - requires patients:view_list permission
        ...(canViewPatients ? [
            { path: '/patients', icon: Users, label: 'Patients', badge: null }
        ] : []),
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes', badge: pendingNotesCount > 0 ? pendingNotesCount : null },
        // Billing - requires billing:view permission
        ...(canViewBilling ? [
            { path: '/billing', icon: DollarSign, label: 'Billing', badge: null }
        ] : []),
        { path: '/telehealth', icon: Video, label: 'Telehealth', badge: null },
        // Admin items - requires users:manage or reports:view
        ...(canManageUsers ? [
            { path: '/users', icon: Shield, label: 'User Management', badge: null },
            { path: '/admin-settings', icon: Settings, label: 'Settings', badge: null }
        ] : []),
    ];

    useEffect(() => {
        if (searchQuery.trim()) {
            const timeoutId = setTimeout(() => {
                const performSearch = async () => {
                    setLoading(true);
                    try {
                        const response = await patientsAPI.search(searchQuery);
                        if (response && response.data && Array.isArray(response.data)) {
                            const apiResults = response.data.map(p => ({
                                id: p.id,
                                name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim()),
                                mrn: p.mrn,
                                dob: p.dob || p.date_of_birth,
                                sex: p.sex
                            }));
                            setSearchResults(apiResults.slice(0, 10));
                        } else {
                            throw new Error('No response data');
                        }
                    } catch (error) {
                        console.log('API search failed, using local search:', error);
                        try {
                            const results = searchPatients(searchQuery);
                            setSearchResults(results.slice(0, 10));
                        } catch (localError) {
                            console.error('Local search also failed:', localError);
                            setSearchResults([]);
                        }
                    } finally {
                        setLoading(false);
                    }
                };
                performSearch();
            }, 300);

            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
            setLoading(false);
        }
    }, [searchQuery, searchPatients]);

    const handleSearchSelect = async (patient) => {
        try {
            const fullPatient = await patientsAPI.get(patient.id);
            const patientData = fullPatient.data;
            addTab({
                id: patientData.id,
                name: `${patientData.first_name} ${patientData.last_name}`,
                mrn: patientData.mrn,
                first_name: patientData.first_name,
                last_name: patientData.last_name
            }, true); // Navigate to patient
        } catch (error) {
            addTab({
                id: patient.id,
                name: patient.name,
                mrn: patient.mrn,
                first_name: patient.name?.split(' ')[0] || '',
                last_name: patient.name?.split(' ').slice(1).join(' ') || ''
            }, true); // Navigate to patient
        }
        navigate(`/patient/${patient.id}/snapshot`);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
    };

    const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setShowSearch(true);
        }
        if (e.key === 'Escape') {
            setShowSearch(false);
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex min-h-screen bg-[#fcfdfe] transition-colors relative overflow-hidden font-sans">
            {/* Background Aesthetic Blobs */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary-100/20 rounded-full blur-[120px] -ml-64 -mt-64 pointer-events-none opacity-50"></div>
            <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-indigo-100/20 rounded-full blur-[120px] -mr-64 -mb-64 pointer-events-none opacity-50"></div>

            {/* Floating Patient Tabs Header */}
            <div className={`fixed top-4 right-6 left-[calc(${sidebarCollapsed ? '5rem' : '18rem'}+1.5rem)] z-40 transition-all duration-300`}>
                <div className="frothy-blur border border-white/50 rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-1.5 flex items-center gap-4 h-[60px]">
                    <PatientTabs />
                </div>
            </div>

            {/* Sidebar - Opaque Frothy */}
            <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} fixed left-4 top-4 bottom-4 z-50 bg-white border border-slate-100 flex flex-col transition-all duration-300 shadow-2xl shadow-slate-200/60 rounded-[2.5rem] overflow-hidden`}>
                {/* Logo/Brand */}
                <div className="h-24 px-8 flex items-center justify-between border-b border-slate-50 bg-white/50">
                    {!sidebarCollapsed && (
                        <Link to="/dashboard" className="flex items-center space-x-3 group animate-fade-in">
                            <img
                                src="/logo.png"
                                alt="Clinic Logo"
                                className="h-10 w-auto object-contain max-w-[160px] drop-shadow-sm group-hover:scale-105 transition-transform"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        </Link>
                    )}
                    {sidebarCollapsed && (
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="h-9 w-auto object-contain mx-auto drop-shadow-sm"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    )}
                </div>

                {/* Quick Search Trigger */}
                {!sidebarCollapsed && (
                    <div className="px-6 py-4 animate-fade-in">
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-full h-11 flex items-center gap-3 px-4 bg-slate-50 border border-slate-100/50 rounded-2xl hover:bg-white hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 group"
                        >
                            <Search className="w-4 h-4 text-primary-400 group-hover:text-primary-500 transition-colors" />
                            <span className="text-[12px] text-slate-400 font-bold flex-1 text-left tracking-tight">Rapid Terminal...</span>
                            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-black text-slate-300 bg-white border border-slate-100 rounded-lg">
                                <Command className="w-2.5 h-2.5 mr-0.5" />K
                            </kbd>
                        </button>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-8">
                    <div className="space-y-4">
                        <div className="px-4">
                            <span className="frothy-label text-[9px]">Clinical Operations</span>
                        </div>
                        <div className="space-y-1.5">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 ${active
                                            ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        <div className={`relative flex-shrink-0 transition-transform group-active:scale-90 ${active ? 'scale-110' : ''}`}>
                                            <Icon className={`w-4.5 h-4.5 ${active ? 'text-primary-400' : 'text-slate-400 group-hover:text-primary-500'}`} />
                                            {item.badge && sidebarCollapsed && (
                                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[8px] font-black rounded-full bg-primary-500 text-white shadow-lg ring-2 ring-white">
                                                    {item.badge > 9 ? '!' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        {!sidebarCollapsed && (
                                            <>
                                                <span className={`flex-1 text-[13px] font-black tracking-tight ${active ? 'text-white' : 'text-slate-600'}`}>
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg transition-all ${active ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-600'
                                                        }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                {/* Sidebar Footer User Card */}
                <div className="p-4 border-t border-slate-50 bg-slate-50/30">
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full flex items-center justify-center p-3 text-slate-300 hover:text-primary-400 hover:bg-white rounded-2xl transition-all mb-3 group"
                    >
                        <Menu className={`w-5 h-5 transition-transform duration-500 ${sidebarCollapsed ? 'rotate-90' : 'rotate-0'}`} />
                    </button>

                    {user && (
                        <div className="flex items-center gap-3 p-2 bg-white rounded-3xl border border-slate-100 shadow-sm relative group/user">
                            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-[11px] font-black shadow-lg shadow-slate-900/20 shrink-0">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            {!sidebarCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-black text-slate-900 truncate tracking-tight">{user.firstName} {user.lastName}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{user.role_name || 'System User'}</div>
                                </div>
                            )}
                            <button
                                onClick={logout}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Patient Search Modal - Frothy Design */}
            {showSearch && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-start justify-center pt-32 px-4"
                    onClick={() => setShowSearch(false)}
                >
                    <div
                        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-50 flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-500 shadow-inner">
                                <Search className="w-6 h-6" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search identification, names, or protocols..."
                                className="flex-1 outline-none bg-transparent text-lg font-black text-slate-900 placeholder:text-slate-200 tracking-tight"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => setShowSearch(false)} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-300 transition-all"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-20 text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="mt-4 text-[11px] font-black text-slate-300 uppercase tracking-widest">Scanning Registry...</div>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="p-4 space-y-2">
                                    {searchResults.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSearchSelect(p)}
                                            className="w-full p-5 text-left bg-slate-50/50 hover:bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-100 transition-all group flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-[1.2rem] flex items-center justify-center text-slate-400 font-black group-hover:text-primary-500 shadow-sm border border-slate-50 transition-colors">
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 tracking-tight group-hover:text-primary-600 transition-colors">{p.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                                        <span className="px-2 py-0.5 bg-white border border-slate-100 rounded-lg">{p.mrn}</span>
                                                        <span>{p.sex} • {p.dob ? format(new Date(p.dob), 'MMM dd, yyyy') : 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-primary-300 group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery.trim() && (
                                <div className="p-20 text-center">
                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Zero Matches Found</div>
                                    <div className="text-sm font-bold text-slate-300">Adjustment required to search parameters.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 ${sidebarCollapsed ? 'ml-24' : 'ml-80'} transition-all duration-500 min-h-screen pt-24 pb-12 pr-6`} >
                <div className="h-full relative z-10">
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>

            <MobileMenu />
        </div>
    );
};

export default Layout;
