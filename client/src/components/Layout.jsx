import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Users, FileText, Settings, LogOut, Search, X, Activity,
    Clock, History, User, ClipboardList, BarChart3,
    MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
    Zap, Command, DollarSign, Shield, Shield as ShieldCheck, AlertCircle, HelpCircle, Inbox,
    AlertTriangle, CalendarPlus
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { usePermissions } from '../hooks/usePermissions';
import { patientsAPI, messagesAPI, visitsAPI, followupsAPI, inboxAPI, intakeAPI, complianceAPI } from '../services/api';
import PatientTabs from './PatientTabs';
import MobileMenu from './MobileMenu';
import SupportModal from './SupportModal';
import BreakTheGlassModal from './BreakTheGlassModal';
import AlertBell from './AlertBell';
import DemoBanner from './DemoBanner';
import { cn } from '../lib/utils';
import SidebarItem from './ui/SidebarItem';

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
    const [showSupportModal, setShowSupportModal] = useState(false);
    const { unreadCount: tasksCount } = useTasks();

    const [pendingNotesCount, setPendingNotesCount] = useState(0);
    const [pendingCancellationsCount, setPendingCancellationsCount] = useState(0);
    const [pendingIntakeCount, setPendingIntakeCount] = useState(0);
    const [inboxCount, setInboxCount] = useState(0);
    const [privacyAlertsCount, setPrivacyAlertsCount] = useState(0);
    const [appointmentRequestsCount, setAppointmentRequestsCount] = useState(0);

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

        // Fetch inbox count
        const fetchInboxCount = async () => {
            try {
                const response = await inboxAPI.getStats();
                setInboxCount(response.data?.my_count || 0);
            } catch (error) {
                console.error('Error fetching inbox count', error);
                setInboxCount(0);
            }
        };

        // Fetch pending intake count
        const fetchPendingIntakeCount = async () => {
            try {
                const response = await intakeAPI.getStats();
                setPendingIntakeCount(response.data?.pendingCount || 0);
            } catch (error) {
                console.error('Error fetching pending intake count:', error);
                setPendingIntakeCount(0);
            }
        };

        // Fetch privacy alerts count
        const fetchPrivacyAlertsCount = async () => {
            try {
                const response = await complianceAPI.getAlerts({ unresolvedOnly: true });
                setPrivacyAlertsCount(response.data?.length || 0);
            } catch (error) {
                console.error('Error fetching privacy alerts:', error);
            }
        };

        const fetchAppointmentRequestsCount = async () => {
            try {
                const response = await inboxAPI.getAll({ status: 'active', type: 'portal_appointment' });
                setAppointmentRequestsCount(response.data?.length || 0);
            } catch (error) {
                console.error('Error fetching appointment requests count:', error);
            }
        };

        // Initial fetch

        fetchPendingNotesCount();
        fetchPendingCancellationsCount();
        fetchInboxCount();
        fetchPendingIntakeCount();
        fetchPrivacyAlertsCount();
        fetchAppointmentRequestsCount();

        // Refresh counts periodically (every 2 seconds)
        const interval = setInterval(() => {

            fetchPendingNotesCount();
            fetchPendingCancellationsCount();
            fetchInboxCount();
            fetchPendingIntakeCount();
            fetchPrivacyAlertsCount();
            fetchAppointmentRequestsCount();
        }, 2000);

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
    // Use defensive checks to prevent crashes if permissions undefined
    const navigationSection = [
        { path: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: null },
        // Schedule - requires schedule:view permission
        ...(canViewSchedule ? [
            { path: '/schedule', icon: Calendar, label: 'Schedule', badge: null },
            ...(showMySchedule ? [
                { path: '/my-schedule', icon: User, label: 'My Schedule', badge: null }
            ] : [])
        ] : []),
        { path: '/cancellations', icon: AlertCircle, label: 'Cancellations', badge: pendingCancellationsCount > 0 ? pendingCancellationsCount : null },
        { path: '/appointment-requests', icon: CalendarPlus, label: 'Appt Requests', badge: appointmentRequestsCount > 0 ? appointmentRequestsCount : null, badgeColor: 'amber' },
        // Patients - requires patients:view_list permission
        ...(canViewPatients ? [
            { path: '/patients', icon: Users, label: 'Patients', badge: null }
        ] : []),
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes', badge: pendingNotesCount > 0 ? pendingNotesCount : null }
    ].filter(Boolean);

    const workflowSection = [
        { path: '/tasks', icon: Inbox, label: 'In Basket', badge: inboxCount > 0 ? inboxCount : null },
        { path: '/digital-intake', icon: FileText, label: 'Digital Intake', badge: pendingIntakeCount > 0 ? pendingIntakeCount : null },
        // Billing - requires billing:view permission
        ...(canViewBilling ? [
            { path: '/billing', icon: DollarSign, label: 'Billing', badge: null }
        ] : []),
        ...(user?.enabledFeatures?.telehealth === true ? [
            { path: '/telehealth', icon: Video, label: 'Telehealth', badge: null }
        ] : []),
        // Admin items - requires users:manage or reports:view
        ...(canManageUsers ? [
            { path: '/admin-settings', icon: Settings, label: 'Settings', badge: null }
        ] : []),
    ].filter(Boolean);

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
                                sex: p.sex,
                                active_flags_count: p.active_flags_count,
                                top_severity: p.top_severity
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
        // Shift+? to open support modal
        if (e.shiftKey && e.key === '?') {
            e.preventDefault();
            setShowSupportModal(true);
        }
        if (e.key === 'Escape') {
            setShowSearch(false);
            setShowSupportModal(false);
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-white transition-colors">
            {user?.isSandbox && <DemoBanner />}
            <div className="flex flex-1">

                {/* Sidebar - Floating Bubble */}
                <aside
                    className={`${sidebarCollapsed ? 'w-24' : 'w-[19rem]'} fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-all duration-500 ease-in-out px-2 py-4`}
                >
                    <div className={cn(
                        "flex flex-col h-full bg-gradient-to-br from-blue-200/50 via-blue-100/40 to-white/10 backdrop-blur-2xl rounded-[2.5rem] shadow-xl border border-white/60 relative overflow-hidden transition-all duration-500",
                        sidebarCollapsed ? "rounded-[2.2rem]" : "rounded-[2.5rem]"
                    )}>
                        {/* Decorative background bubbles */}
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Logo/Brand Area + Relocated Toggle */}
                        <div className="px-5 py-5 flex items-center justify-between relative z-10">
                            {!sidebarCollapsed ? (
                                <>
                                    <Link to="/dashboard" className="flex items-center group">
                                        <div className="p-1 transition-all group-hover:scale-105 duration-300">
                                            <img
                                                src="/logo.png"
                                                alt="PageMD Logo"
                                                className="h-9 w-auto object-contain max-w-[150px]"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                        className="p-2 rounded-xl hover:bg-white/60 text-slate-400 hover:text-blue-600 transition-all group ml-1"
                                        title="Collapse sidebar"
                                    >
                                        <Menu className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                    className="w-full transition-all hover:scale-105 active:scale-95 group flex items-center justify-center p-0"
                                    title="Expand sidebar"
                                >
                                    <img
                                        src="/logo-icon.png"
                                        alt="PMD"
                                        className="w-[85%] h-auto object-contain transition-transform duration-500 group-hover:rotate-3"
                                        onError={(e) => {
                                            // Fallback if image missing
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.classList.remove('hidden');
                                        }}
                                    />
                                    <div className="hidden bg-blue-600 rounded-2xl w-14 h-14 flex items-center justify-center text-white text-2xl font-bold">P</div>
                                </button>
                            )}
                        </div>

                        {/* Navigation Section - COMPACT & NO SCROLL */}
                        <nav className="flex-1 overflow-hidden px-2 py-0 flex flex-col relative z-10 gap-1">
                            {/* Primary Navigation */}
                            <div className="flex-shrink-0">
                                {!sidebarCollapsed && (
                                    <div className="px-4 mb-2">
                                        <div className="text-[10px] font-bold text-blue-900/30 uppercase tracking-[0.2em]">
                                            Navigation
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {navigationSection.map((item) => (
                                        <SidebarItem
                                            key={item.path}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            badge={item.badge}
                                            active={isActive(item.path)}
                                            collapsed={sidebarCollapsed}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Workflow Section */}
                            <div className="flex-shrink-0">
                                {!sidebarCollapsed && (
                                    <div className="px-4 mb-2">
                                        <div className="text-[10px] font-bold text-blue-900/30 uppercase tracking-[0.2em]">
                                            Workflows
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {workflowSection.map((item) => (
                                        <SidebarItem
                                            key={item.path}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            badge={item.badge}
                                            active={isActive(item.path)}
                                            collapsed={sidebarCollapsed}
                                        />
                                    ))}
                                </div>
                            </div>
                        </nav>

                        {/* Bottom User Profile Section - Compact */}
                        <div className="p-4 relative z-10">
                            {user && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate('/profile')}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-2xl transition-all flex-1 group",
                                            sidebarCollapsed ? "justify-center" : "hover:bg-white/60"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 shadow-md transition-transform group-hover:scale-105">
                                            {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                                        </div>
                                        {!sidebarCollapsed && (
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="text-[12px] font-bold text-slate-800 leading-tight truncate">{user.firstName} {user.lastName}</div>
                                                <div className="text-[9px] text-slate-400 font-bold truncate uppercase tracking-tighter">{user.role_name || user.role || 'User'}</div>
                                            </div>
                                        )}
                                    </button>
                                    {!sidebarCollapsed && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to sign out?')) {
                                                    logout();
                                                    navigate('/login');
                                                }
                                            }}
                                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                            title="Sign Out"
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Patient Search Modal */}
                {showSearch && (
                    <div
                        className="fixed inset-0 bg-deep-gray/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20 animate-fade-in"
                        onClick={() => setShowSearch(false)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 animate-scale-in border border-deep-gray/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-deep-gray/10 flex items-center space-x-3 bg-white">
                                <Search className="w-5 h-5 text-strong-azure" />
                                <input
                                    type="text"
                                    placeholder="Search by name or MRN... (Press Cmd/Ctrl+K to open)"
                                    className="flex-1 outline-none bg-transparent text-deep-gray placeholder:text-soft-gray/60 text-base font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setShowSearch(false);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        setShowSearch(false);
                                        setSearchQuery('');
                                        setSearchResults([]);
                                    }}
                                    className="p-2 hover:bg-soft-gray rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-deep-gray/60 hover:text-deep-gray" />
                                </button>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {loading ? (
                                    <div className="p-12 text-center">
                                        <div className="inline-block spinner text-strong-azure"></div>
                                        <p className="mt-4 text-sm text-deep-gray">Searching...</p>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-deep-gray/10">
                                        {searchResults.map((patient) => (
                                            <button
                                                key={patient.id}
                                                onClick={() => handleSearchSelect(patient)}
                                                className="w-full p-4 text-left hover:bg-soft-gray transition-all focus:outline-none group"
                                            >
                                                <div className="font-semibold text-deep-gray group-hover:text-strong-azure flex items-center justify-between">
                                                    <span>{patient.name || 'Unknown'}</span>
                                                </div>
                                                <div className="text-sm text-deep-gray/70 mt-1 flex items-center space-x-2">
                                                    <span className="px-2 py-0.5 bg-soft-gray rounded text-xs font-medium text-deep-gray">{patient.mrn || 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>{patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>{patient.sex || 'N/A'}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : searchQuery.trim() ? (
                                    <div className="p-12 text-center">
                                        <p className="text-deep-gray">No patients found for "{searchQuery}"</p>
                                        <p className="text-xs text-deep-gray/60 mt-2">Try searching by name or MRN</p>
                                    </div>
                                ) : (
                                    <div className="p-12 text-center">
                                        <Search className="w-12 h-12 text-soft-gray/60 mx-auto mb-4" />
                                        <p className="text-deep-gray">Start typing to search...</p>
                                        <p className="text-xs text-deep-gray/60 mt-2">Press Cmd/Ctrl+K to open this search</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content - Floating Bubble */}
                <main
                    className={cn(
                        "flex-1 transition-all duration-500 ease-in-out relative flex flex-col h-screen overflow-hidden",
                        sidebarCollapsed ? "ml-[6.5rem]" : "ml-[19.5rem]"
                    )}
                >
                    <div className="flex-1 my-4 mr-4 bg-white rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden flex flex-col relative">
                        {/* Header inside the bubble */}
                        <div className="h-12 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 flex items-center justify-between flex-shrink-0 relative z-20">
                            <div className="flex-1 overflow-hidden">
                                <PatientTabs />
                            </div>
                            <div className="flex items-center gap-2 px-4 flex-shrink-0">
                                <AlertBell />
                            </div>
                        </div>

                        {/* Page Content */}
                        <div className="flex-1 overflow-y-auto min-h-0 relative z-10 h-full">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                                    className="h-full w-full"
                                >
                                    {children}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </main>

                {/* Floating Help Button */}
                <button
                    onClick={() => setShowSupportModal(true)}
                    className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all z-50 flex items-center justify-center group opacity-70 hover:opacity-100"
                    title="Report an Issue (Shift+?)"
                >
                    <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>

                {/* Support Modal */}
                <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />

                {/* Privacy Enforcement Modal */}
                <BreakTheGlassModal />

                {/* Mobile Menu */}
                <MobileMenu />
            </div>
        </div>
    );
};

export default Layout;
