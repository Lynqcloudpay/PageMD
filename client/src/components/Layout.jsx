import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Users, FileText, Settings, LogOut, Search, X, Activity,
    Clock, History, User, ClipboardList, BarChart3,
    MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
    Zap, Command, DollarSign, Shield, Shield as ShieldCheck, AlertCircle, HelpCircle, Inbox,
    AlertTriangle, CalendarPlus, ChevronLeft, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { usePermissions } from '../hooks/usePermissions';
import { patientsAPI, messagesAPI, visitsAPI, followupsAPI, inboxAPI, intakeAPI, complianceAPI, telehealthAPI } from '../services/api';
import PatientTabs from './PatientTabs';
import MobileMenu from './MobileMenu';
import SupportModal from './SupportModal';
import BreakTheGlassModal from './BreakTheGlassModal';
import AlertBell from './AlertBell';
import DemoBanner from './DemoBanner';
import EchoPanel from './EchoPanel';
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
    const [pendingTelehealthCount, setPendingTelehealthCount] = useState(0);
    const [inboxCount, setInboxCount] = useState(0);
    const [privacyAlertsCount, setPrivacyAlertsCount] = useState(0);
    const [appointmentRequestsCount, setAppointmentRequestsCount] = useState(0);

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    // Fetch unread counts
    useEffect(() => {

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

        const fetchInboxCount = async () => {
            try {
                const response = await inboxAPI.getStats();
                setInboxCount(response.data?.my_count || 0);
            } catch (error) {
                console.error('Error fetching inbox count', error);
                setInboxCount(0);
            }
        };

        const fetchPendingIntakeCount = async () => {
            try {
                const response = await intakeAPI.getStats();
                setPendingIntakeCount(response.data?.pendingCount || 0);
            } catch (error) {
                console.error('Error fetching pending intake count:', error);
                setPendingIntakeCount(0);
            }
        };

        const fetchPendingTelehealthCount = async () => {
            try {
                const response = await telehealthAPI.getStats();
                setPendingTelehealthCount(response.data?.pendingCount || 0);
            } catch (error) {
                console.error('Error fetching telehealth count:', error);
                setPendingTelehealthCount(0);
            }
        };

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

        fetchPendingNotesCount();
        fetchPendingCancellationsCount();
        fetchInboxCount();
        fetchPendingIntakeCount();
        fetchPendingTelehealthCount();
        fetchPrivacyAlertsCount();
        fetchAppointmentRequestsCount();

        const interval = setInterval(() => {
            fetchPendingNotesCount();
            fetchPendingCancellationsCount();
            fetchInboxCount();
            fetchPendingIntakeCount();
            fetchPendingTelehealthCount();
            fetchPrivacyAlertsCount();
            fetchAppointmentRequestsCount();
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const { can, getScope } = usePermissions();
    const scope = getScope();

    const canViewSchedule = can('schedule:view');
    const canManageUsers = can('users:manage');
    const canViewPatients = can('patients:view_list');
    const canViewBilling = can('billing:view');
    const canViewReports = can('reports:view');
    const showMySchedule = canViewSchedule && scope.scheduleScope === 'SELF';

    const navigationSection = [
        { path: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: null },
        ...(canViewSchedule ? [
            { path: '/schedule', icon: Calendar, label: 'Schedule', badge: null },
            ...(showMySchedule ? [
                { path: '/my-schedule', icon: User, label: 'My Schedule', badge: null }
            ] : [])
        ] : []),
        { path: '/cancellations', icon: AlertCircle, label: 'Cancellations', badge: pendingCancellationsCount > 0 ? pendingCancellationsCount : null },
        { path: '/appointment-requests', icon: CalendarPlus, label: 'Appt Requests', badge: appointmentRequestsCount > 0 ? appointmentRequestsCount : null, badgeColor: 'amber' },
        ...(canViewPatients ? [
            { path: '/patients', icon: Users, label: 'Patients', badge: null }
        ] : []),
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes', badge: pendingNotesCount > 0 ? pendingNotesCount : null }
    ].filter(Boolean);

    const workflowSection = [
        { path: '/tasks', icon: Inbox, label: 'In Basket', badge: inboxCount > 0 ? inboxCount : null },
        { path: '/digital-intake', icon: FileText, label: 'Digital Intake', badge: pendingIntakeCount > 0 ? pendingIntakeCount : null },
        ...(canViewBilling ? [
            { path: '/billing', icon: DollarSign, label: 'Billing', badge: null }
        ] : []),
        ...(user?.enabledFeatures?.telehealth === true ? [
            { path: '/telehealth', icon: Video, label: 'Telehealth', badge: pendingTelehealthCount > 0 ? pendingTelehealthCount : null }
        ] : []),
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
            }, true);
        } catch (error) {
            addTab({
                id: patient.id,
                name: patient.name,
                mrn: patient.mrn,
                first_name: patient.name?.split(' ')[0] || '',
                last_name: patient.name?.split(' ').slice(1).join(' ') || ''
            }, true);
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
        <div className="flex flex-col min-h-screen bg-[#F4F5F7] transition-colors">
            {user?.isSandbox && <DemoBanner />}
            <div className="flex flex-1">

                {/* ═══════════════════════════════════════════════ */}
                {/* Sidebar — Frosted Glass Panel                  */}
                {/* ═══════════════════════════════════════════════ */}
                <aside
                    className={cn(
                        "fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-all duration-300 ease-out",
                        sidebarCollapsed ? 'w-[3.5rem]' : 'w-[13rem]'
                    )}
                >
                    <div className="flex flex-col h-full bg-[#1C2A3A]">

                        {/* Logo Area */}
                        <div className={cn(
                            "flex items-center h-14 border-b border-white/[0.08]",
                            sidebarCollapsed ? "justify-center px-0" : "px-4 justify-between"
                        )}>
                            {!sidebarCollapsed ? (
                                <>
                                    <Link to="/dashboard" className="flex items-center group">
                                        <img
                                            src="/logo.png"
                                            alt="PageMD Logo"
                                            className="h-6 w-auto object-contain max-w-[100px] brightness-0 invert opacity-70 group-hover:opacity-100 transition-opacity"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </Link>
                                    <button
                                        onClick={() => setSidebarCollapsed(true)}
                                        className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                                        title="Collapse sidebar"
                                    >
                                        <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setSidebarCollapsed(false)}
                                    className="p-1 rounded-md hover:bg-white/[0.06] transition-all group"
                                    title="Expand sidebar"
                                >
                                    <img
                                        src="/logo-icon.png"
                                        alt="PMD"
                                        className="w-6 h-6 object-contain brightness-0 invert opacity-50 group-hover:opacity-90 transition-opacity"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            if (e.target.nextSibling) e.target.nextSibling.classList.remove('hidden');
                                        }}
                                    />
                                    <div className="hidden w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/80 text-[10px] font-medium">P</div>
                                </button>
                            )}
                        </div>

                        {/* Search trigger */}
                        {!sidebarCollapsed && (
                            <div className="px-2.5 pt-3 pb-1">
                                <button
                                    onClick={() => setShowSearch(true)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-white/40 text-[11px] hover:bg-white/[0.1] transition-colors"
                                >
                                    <Search className="w-3 h-3" strokeWidth={1.8} />
                                    <span>Search...</span>
                                    <kbd className="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.08] px-1 py-0.5 rounded">⌘K</kbd>
                                </button>
                            </div>
                        )}

                        {sidebarCollapsed && (
                            <div className="flex justify-center pt-3 pb-1">
                                <button
                                    onClick={() => setShowSearch(true)}
                                    className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                                    title="Search (⌘K)"
                                >
                                    <Search className="w-4 h-4" strokeWidth={1.8} />
                                </button>
                            </div>
                        )}

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col gap-0.5">
                            {/* Primary section */}
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="px-4 pt-2 pb-1">
                                        <span className="text-[9px] font-medium text-white/25 uppercase tracking-[0.14em]">
                                            Navigation
                                        </span>
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
                                            badgeColor={item.badgeColor}
                                            active={isActive(item.path)}
                                            collapsed={sidebarCollapsed}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className={cn("my-2", sidebarCollapsed ? "mx-2" : "mx-3")}>
                                <div className="h-px bg-white/[0.08]" />
                            </div>

                            {/* Workflow section */}
                            <div>
                                {!sidebarCollapsed && (
                                    <div className="px-4 pb-1">
                                        <span className="text-[9px] font-medium text-white/25 uppercase tracking-[0.14em]">
                                            Workflows
                                        </span>
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

                        {/* User profile — bottom */}
                        <div className="border-t border-white/[0.08] p-2">
                            {user && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => navigate('/profile')}
                                        className={cn(
                                            "flex items-center gap-2 p-1.5 rounded-lg transition-all flex-1 group",
                                            sidebarCollapsed ? "justify-center" : "hover:bg-white/[0.06]"
                                        )}
                                    >
                                        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white/80 text-[10px] font-medium flex-shrink-0">
                                            {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                                        </div>
                                        {!sidebarCollapsed && (
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="text-[11px] font-medium text-white/80 leading-tight truncate">{user.firstName} {user.lastName}</div>
                                                <div className="text-[9px] text-white/30 font-normal truncate">{user.role_name || user.role || 'User'}</div>
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
                                            className="p-1 rounded-md text-white/25 hover:text-[#CE6969] hover:bg-white/[0.06] transition-all"
                                            title="Sign Out"
                                        >
                                            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* ═══════════════════════════════════════════════ */}
                {/* Patient Search Modal                           */}
                {/* ═══════════════════════════════════════════════ */}
                {showSearch && (
                    <div
                        className="fixed inset-0 bg-[#10141A]/40 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] animate-fade-in"
                        onClick={() => setShowSearch(false)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-large w-full max-w-xl mx-4 animate-scale-in border border-[#E4E4E4]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-[#E4E4E4]/60 flex items-center gap-3">
                                <Search className="w-4 h-4 text-[#83A2DB]" strokeWidth={1.8} />
                                <input
                                    type="text"
                                    placeholder="Search by name or MRN..."
                                    className="flex-1 outline-none bg-transparent text-[#10141A] placeholder:text-[#10141A]/25 text-sm font-normal"
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
                                    className="p-1.5 hover:bg-[#10141A]/[0.04] rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4 text-[#10141A]/30" strokeWidth={1.5} />
                                </button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {loading ? (
                                    <div className="p-12 text-center">
                                        <div className="inline-block spinner text-[#83A2DB]"></div>
                                        <p className="mt-3 text-xs text-[#10141A]/40">Searching...</p>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-[#E4E4E4]/40">
                                        {searchResults.map((patient) => (
                                            <button
                                                key={patient.id}
                                                onClick={() => handleSearchSelect(patient)}
                                                className="w-full p-3.5 text-left hover:bg-[#83A2DB]/[0.04] transition-all focus:outline-none group"
                                            >
                                                <div className="text-sm font-medium text-[#10141A]/80 group-hover:text-[#10141A]">
                                                    {patient.name || 'Unknown'}
                                                </div>
                                                <div className="text-xs text-[#10141A]/35 mt-1 flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 bg-[#10141A]/[0.04] rounded text-[10px] font-medium text-[#10141A]/50">{patient.mrn || 'N/A'}</span>
                                                    <span className="text-[#E4E4E4]">·</span>
                                                    <span>{patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</span>
                                                    <span className="text-[#E4E4E4]">·</span>
                                                    <span>{patient.sex || 'N/A'}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : searchQuery.trim() ? (
                                    <div className="p-12 text-center">
                                        <p className="text-sm text-[#10141A]/50">No patients found for "{searchQuery}"</p>
                                        <p className="text-[11px] text-[#10141A]/25 mt-1.5">Try searching by name or MRN</p>
                                    </div>
                                ) : (
                                    <div className="p-12 text-center">
                                        <Search className="w-8 h-8 text-[#10141A]/10 mx-auto mb-3" strokeWidth={1.5} />
                                        <p className="text-sm text-[#10141A]/40">Start typing to search...</p>
                                        <p className="text-[11px] text-[#10141A]/20 mt-1">⌘K to open this search</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════ */}
                {/* Main Content Area                              */}
                {/* ═══════════════════════════════════════════════ */}
                <main
                    className={cn(
                        "flex-1 transition-all duration-300 ease-out relative flex flex-col h-screen overflow-hidden",
                        sidebarCollapsed ? "ml-[3.5rem]" : "ml-[13rem]"
                    )}
                >
                    {/* Header strip */}
                    <div className="h-12 bg-white border-b border-gray-200/60 px-6 flex items-center justify-between flex-shrink-0 relative z-40">
                        <div className="flex-1 overflow-hidden">
                            <PatientTabs />
                        </div>
                        <div className="flex items-center gap-2 pl-4 flex-shrink-0 overflow-visible">
                            <AlertBell />
                        </div>
                    </div>

                    {/* Page Content */}
                    <div className="flex-1 overflow-y-auto min-h-0 relative h-full bg-[#F4F5F7]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                                className="h-full w-full"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>

                <BreakTheGlassModal />
                <MobileMenu />

                {/* Echo AI */}
                {location.pathname.includes('/patient/') && (
                    <EchoPanel
                        patientId={location.pathname.split('/')[2]}
                        patientName={null}
                    />
                )}

                {/* Help button — frosted, no gradient */}
                <button
                    onClick={() => setShowSupportModal(true)}
                    className="fixed bottom-[4.5rem] right-6 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md border border-[#E4E4E4] text-[#10141A]/40 shadow-soft hover:shadow-medium hover:text-[#83A2DB] transition-all z-[9999] flex items-center justify-center"
                    title="Report an Issue (Shift+?)"
                >
                    <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
                </button>

                <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
            </div>
        </div>
    );
};

export default Layout;
