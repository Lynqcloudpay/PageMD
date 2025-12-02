import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, FileText, Settings, LogOut, Search, X, Activity, 
  Clock, History, User, ClipboardList, BarChart3, 
  MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
  Zap, Command, DollarSign, Shield
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { patientsAPI, messagesAPI, visitsAPI } from '../services/api';
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
    const [messagesCount, setMessagesCount] = useState(0);
    const [pendingNotesCount, setPendingNotesCount] = useState(0);

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    // Fetch unread counts
    useEffect(() => {
        // Fetch messages count
        const fetchMessagesCount = async () => {
            try {
                const response = await messagesAPI.get({ unread: true });
                if (response && response.data) {
                    const unreadCount = Array.isArray(response.data) 
                        ? response.data.filter(m => !m.read_at).length 
                        : 0;
                    setMessagesCount(unreadCount);
                } else {
                    setMessagesCount(0);
                }
            } catch (error) {
                console.error('Error fetching messages count:', error);
                setMessagesCount(0);
            }
        };

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

        // Initial fetch
        fetchMessagesCount();
        fetchPendingNotesCount();
        
        // Refresh counts periodically (every 30 seconds)
        const interval = setInterval(() => {
            fetchMessagesCount();
            fetchPendingNotesCount();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    // Navigation items with icons and badges
    const navItems = [
        { path: '/schedule', icon: Calendar, label: 'Schedule', badge: null },
        { path: '/my-schedule', icon: User, label: 'My Schedule', badge: null },
        { path: '/patients', icon: Users, label: 'Patients', badge: null },
        { path: '/tasks', icon: ClipboardList, label: 'In Basket', badge: tasksCount > 0 ? tasksCount : null },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: messagesCount > 0 ? messagesCount : null },
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes', badge: pendingNotesCount > 0 ? pendingNotesCount : null },
        { path: '/billing', icon: DollarSign, label: 'Billing', badge: null },
        { path: '/telehealth', icon: Video, label: 'Telehealth', badge: null },
        { path: '/analytics', icon: BarChart3, label: 'Analytics', badge: null },
        // Admin-only items
        ...(user?.role === 'Admin' ? [
            { path: '/admin-settings', icon: Settings, label: 'Administration', badge: null },
            { path: '/users', icon: Shield, label: 'User Management', badge: null }
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
        <div className="flex min-h-screen bg-white transition-colors">
            {/* Patient Tabs - Minimalistic Monochrome Design */}
            <div className="fixed top-0 left-72 right-0 z-20 bg-white border-b border-gray-200 shadow-sm">
                <PatientTabs />
            </div>

            {/* Minimalistic Sidebar */}
            <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} fixed left-0 top-0 bottom-0 z-30 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-sm`}>
                {/* Logo/Brand - Minimalistic */}
                <div className="h-20 px-6 flex items-center justify-between border-b border-gray-200 bg-white">
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
                        className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-gray-600 hover:text-primary-900"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Search - Minimalistic */}
                {!sidebarCollapsed && (
                    <div className="p-4 border-b border-gray-200 bg-neutral-50">
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-full flex items-center space-x-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:border-gray-400 hover:bg-neutral-50 transition-all duration-200 group"
                        >
                            <Search className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                            <span className="text-sm text-gray-600 flex-1 text-left">Search patients...</span>
                            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-500 bg-neutral-100 border border-gray-300 rounded">
                                <Command className="w-3 h-3 mr-1" />K
                            </kbd>
                        </button>
                    </div>
                )}

                {/* Navigation - Premium Dark */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-1 hide-scrollbar">
                    {/* Primary Navigation */}
                    <div className="mb-4">
                        <div className="px-3 py-2 mb-2">
                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Navigation</div>
                        </div>
                        {navItems.slice(0, 4).map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                                        active
                                            ? 'bg-primary-600 text-white shadow-sm'
                                            : 'text-gray-700 hover:bg-neutral-100 hover:text-primary-900'
                                    }`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500 group-hover:text-primary-700'}`} />
                                        {item.badge && sidebarCollapsed && (
                                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-semibold rounded-full bg-accent-500 text-white">
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className={`flex-1 text-sm font-medium ${active ? 'text-white' : ''}`}>
                                                {item.label}
                                            </span>
                                            {item.badge && (
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                    active 
                                                        ? 'bg-white/20 text-white' 
                                                        : 'bg-accent-500/10 text-accent-600'
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

                    {/* Secondary Navigation */}
                    <div className="mb-4">
                        <div className="px-3 py-2 mb-2">
                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Workflow</div>
                        </div>
                        {navItems.slice(4).map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                                        active
                                            ? 'bg-primary-600 text-white shadow-sm'
                                            : 'text-gray-700 hover:bg-neutral-100 hover:text-primary-900'
                                    }`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500 group-hover:text-primary-700'}`} />
                                        {item.badge && sidebarCollapsed && (
                                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-semibold rounded-full bg-accent-500 text-white">
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className={`flex-1 text-sm font-medium ${active ? 'text-white' : ''}`}>
                                                {item.label}
                                            </span>
                                            {item.badge && (
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                    active 
                                                        ? 'bg-white/20 text-white' 
                                                        : 'bg-accent-500/10 text-accent-600'
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

                </nav>

                {/* Bottom Section - Minimalistic */}
                <div className="p-4 border-t border-gray-200 bg-neutral-50">
                    {!sidebarCollapsed && user && (
                        <div className="px-3 py-2 mb-3 bg-white rounded-lg border border-gray-200">
                            <div className="text-sm font-semibold text-primary-900">
                                {user.firstName} {user.lastName}
                            </div>
                            <div className="text-xs text-gray-500 capitalize mt-0.5">
                                {user.role === 'clinician' ? 'Doctor' : user.role === 'front_desk' ? 'Front Desk' : user.role}
                            </div>
                        </div>
                    )}
                    
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-neutral-100 hover:text-red-600 transition-colors border border-gray-200 hover:border-red-300"
                    >
                        <LogOut className="w-4 h-4" />
                        {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Patient Search Modal - Minimalistic Design */}
            {showSearch && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 animate-fade-in"
                    onClick={() => setShowSearch(false)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 animate-scale-in border border-gray-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-200 flex items-center space-x-3 bg-white">
                            <Search className="w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or MRN... (Press Cmd/Ctrl+K to open)"
                                className="flex-1 outline-none bg-transparent text-primary-900 placeholder:text-gray-400 text-base font-medium"
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
                                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-12 text-center">
                                    <div className="inline-block spinner text-accent-500"></div>
                                    <p className="mt-4 text-sm text-gray-600">Searching...</p>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="divide-y divide-gray-200">
                                    {searchResults.map((patient) => (
                                        <button
                                            key={patient.id}
                                            onClick={() => handleSearchSelect(patient)}
                                            className="w-full p-4 text-left hover:bg-neutral-50 transition-colors focus:outline-none group"
                                        >
                                            <div className="font-semibold text-primary-900 group-hover:text-accent-600">
                                                {patient.name || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1 flex items-center space-x-2">
                                                <span className="px-2 py-0.5 bg-neutral-100 rounded text-xs font-medium text-gray-700">{patient.mrn || 'N/A'}</span>
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
                                    <p className="text-gray-700">No patients found for "{searchQuery}"</p>
                                    <p className="text-xs text-gray-500 mt-2">Try searching by name or MRN</p>
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-700">Start typing to search...</p>
                                    <p className="text-xs text-gray-500 mt-2">Press Cmd/Ctrl+K to open this search</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content - Minimalistic */}
            <main className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-72'} transition-all duration-300 relative`} style={{ marginTop: '48px' }}>
                <div className="h-full bg-white">
                    {children}
                </div>
            </main>

            {/* Mobile Menu */}
            <MobileMenu />
        </div>
    );
};

export default Layout;
