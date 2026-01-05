import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, Settings, LogOut, Search, X, Activity,
    Clock, History, User, ClipboardList, BarChart3,
    MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
    Zap, Command, DollarSign, Shield, AlertCircle, HelpCircle, Inbox
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { usePermissions } from '../hooks/usePermissions';
import { patientsAPI, messagesAPI, visitsAPI, followupsAPI, inboxAPI, intakeAPI } from '../services/api';
import PatientTabs from './PatientTabs';
import MobileMenu from './MobileMenu';
import SupportModal from './SupportModal';

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

        // Initial fetch

        fetchPendingNotesCount();
        fetchPendingCancellationsCount();
        fetchInboxCount();
        fetchPendingIntakeCount();

        // Refresh counts periodically (every 30 seconds)
        const interval = setInterval(() => {

            fetchPendingNotesCount();
            fetchPendingCancellationsCount();
            fetchInboxCount();
            fetchPendingIntakeCount();
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
        // Patients - requires patients:view_list permission
        ...(canViewPatients ? [
            { path: '/patients', icon: Users, label: 'Patients', badge: null },
            { path: '/digital-intake', icon: FileText, label: 'Digital Intake', badge: pendingIntakeCount > 0 ? pendingIntakeCount : null }
        ] : []),
    ].filter(Boolean);

    const workflowSection = [
        { path: '/tasks', icon: Inbox, label: 'In Basket', badge: inboxCount > 0 ? inboxCount : null },
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
        <div className="flex min-h-screen bg-white transition-colors">

            {/* Patient Tabs */}
            <div className="fixed top-0 left-72 right-0 z-20 bg-white border-b border-deep-gray/10 shadow-sm" style={{ height: '48px' }}>
                <PatientTabs />
            </div>

            {/* Sidebar */}
            <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} fixed left-0 top-0 bottom-0 z-30 bg-white border-r-4 border-strong-azure flex flex-col transition-all duration-300 shadow-xl`}>
                {/* Logo/Brand */}
                <div className="h-20 px-6 flex items-center justify-between border-b-2 border-strong-azure/20 bg-white">
                    {!sidebarCollapsed && (
                        <Link to="/dashboard" className="flex items-center space-x-3 group">
                            <img
                                src="/logo.png"
                                alt="PageMD Logo"
                                className="h-10 w-auto object-contain max-w-[180px]"
                                onError={(e) => {
                                    // Hide broken image, show fallback text
                                    e.target.style.display = 'none';
                                }}
                            />
                        </Link>
                    )}
                    {sidebarCollapsed && (
                        <img
                            src="/logo.png"
                            alt="PageMD"
                            className="h-10 w-auto object-contain mx-auto"
                            onError={(e) => {
                                // Hide broken image
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-2 rounded-lg hover:bg-soft-gray transition-all text-deep-gray hover:text-strong-azure"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Search - Futuristic Design */}
                {!sidebarCollapsed && (
                    <div className="px-4 py-3 border-b-2 border-strong-azure/20 bg-white">
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 bg-white border-2 border-strong-azure/30 rounded-lg hover:border-strong-azure hover:bg-strong-azure/5 hover:shadow-md transition-all duration-200 group"
                        >
                            <Search className="w-4 h-4 text-strong-azure/70 group-hover:text-strong-azure transition-colors" />
                            <span className="text-[13px] text-deep-gray/70 flex-1 text-left group-hover:text-strong-azure font-medium">Search patients...</span>
                            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-strong-azure bg-strong-azure/10 border border-strong-azure/30 rounded">
                                <Command className="w-3 h-3 mr-0.5" />K
                            </kbd>
                        </button>
                    </div>
                )}

                {/* Navigation - Futuristic Compact Design */}
                <nav className="flex-1 overflow-hidden px-3 py-3 flex flex-col">
                    {/* Primary Navigation */}
                    <div className="mb-3 flex-shrink-0">
                        <div className="px-2.5 mb-2">
                            <div className="text-[9px] font-bold text-deep-gray/40 uppercase tracking-widest">
                                Navigation
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            {navigationSection.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${active
                                            ? 'text-white shadow-lg'
                                            : 'text-deep-gray hover:bg-soft-gray hover:text-strong-azure hover:border-l-2 hover:border-strong-azure/30'
                                            }`}
                                        style={active ? {
                                            background: 'linear-gradient(to right, #3B82F6, #2563EB)',
                                            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2)'
                                        } : {}}
                                    >
                                        {/* Futuristic active indicator - Azure accent bar */}

                                        <div className="relative flex-shrink-0 z-10">
                                            <Icon className={`w-4 h-4 transition-all duration-200 ${active ? 'text-white' : 'text-deep-gray/50 group-hover:text-strong-azure'}`} />
                                            {item.badge && sidebarCollapsed && (
                                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold rounded-full bg-fresh-green text-white shadow-sm">
                                                    {item.badge > 99 ? '99+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        {!sidebarCollapsed && (
                                            <>
                                                <span className={`flex-1 text-[13px] font-semibold ${active ? 'text-white' : 'text-deep-gray'} z-10 relative`}>
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all z-10 relative ${active
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-fresh-green/10 text-fresh-green'
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

                    {/* Secondary Navigation */}
                    <div className="flex-1 overflow-y-auto hide-scrollbar">
                        <div className="px-2.5 mb-2 mt-1">
                            <div className="text-[9px] font-bold text-deep-gray/40 uppercase tracking-widest">
                                Workflow
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            {workflowSection.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${active
                                            ? 'text-white shadow-lg'
                                            : 'text-deep-gray hover:bg-soft-gray hover:text-strong-azure hover:border-l-2 hover:border-strong-azure/30'
                                            }`}
                                        style={active ? {
                                            background: 'linear-gradient(to right, #3B82F6, #2563EB)',
                                            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2)'
                                        } : {}}
                                    >
                                        {/* Futuristic active indicator - Azure accent bar */}

                                        <div className="relative flex-shrink-0 z-10">
                                            <Icon className={`w-4 h-4 transition-all duration-200 ${active ? 'text-white' : 'text-deep-gray/50 group-hover:text-strong-azure'}`} />
                                            {item.badge && sidebarCollapsed && (
                                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold rounded-full bg-fresh-green text-white shadow-sm">
                                                    {item.badge > 99 ? '99+' : item.badge}
                                                </span>
                                            )}
                                        </div>

                                        {!sidebarCollapsed && (
                                            <>
                                                <span className={`flex-1 text-[13px] font-semibold ${active ? 'text-white' : 'text-deep-gray'} z-10 relative`}>
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all z-10 relative ${active
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-fresh-green/10 text-fresh-green'
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

                {/* Bottom Section - Futuristic User Panel */}
                <div className="mt-auto px-3 py-2.5 border-t border-deep-gray/10 bg-gradient-to-b from-white to-soft-gray/20">
                    {user && (
                        <div className="flex items-center gap-2">
                            {/* User Button */}
                            <button
                                onClick={() => navigate('/profile')}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all flex-1 ${sidebarCollapsed ? 'justify-center' : ''} ${sidebarCollapsed
                                    ? 'hover:bg-soft-gray/80'
                                    : 'bg-white/60 backdrop-blur-sm hover:bg-white border border-deep-gray/5 hover:border-deep-gray/20 hover:shadow-sm'
                                    }`}
                                title={`${user.firstName} ${user.lastName} - ${user.role_name || user.role || 'User'}${user.isAdmin ? ' (Admin)' : ''} - Click to view profile`}
                            >
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-strong-azure to-strong-azure/80 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm">
                                    {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="text-[12px] font-semibold text-deep-gray leading-tight truncate">{user.firstName} {user.lastName}</div>
                                        <div className="text-[10px] text-deep-gray/50 capitalize leading-tight truncate font-medium">
                                            {user.role_name || user.role || 'User'}
                                        </div>
                                    </div>
                                )}
                            </button>
                            {/* Sign Out Button */}
                            <button
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to sign out?')) {
                                        logout();
                                        navigate('/login');
                                    }
                                }}
                                className={`flex items-center justify-center px-2 py-1.5 rounded-lg transition-all hover:bg-red-50/80 hover:border-red-300 ${sidebarCollapsed ? 'w-7 h-7' : 'px-2.5'} border border-red-200/50 text-red-600 hover:text-red-700 hover:shadow-sm`}
                                title="Sign Out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                {!sidebarCollapsed && (
                                    <span className="ml-1 text-[11px] font-semibold">Out</span>
                                )}
                            </button>
                        </div>
                    )}
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
                                            <div className="font-semibold text-deep-gray group-hover:text-strong-azure">
                                                {patient.name || 'Unknown'}
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

            {/* Main Content */}
            <main className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-72'} transition-all duration-300 relative`} style={{ marginTop: '48px' }}>
                <div className="h-full bg-white">
                    {children}
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

            {/* Mobile Menu */}
            <MobileMenu />
        </div>
    );
};

export default Layout;
