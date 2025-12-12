import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, FileText, Settings, LogOut, Search, X, Activity, 
  Clock, History, User, ClipboardList, BarChart3, 
  MessageSquare, Video, Moon, Sun, Menu, ChevronRight, Bell,
  Zap, Command, DollarSign, Shield, AlertCircle, KeyRound, Eye, EyeOff
} from 'lucide-react';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { useTasks } from '../context/TaskContext';
import { patientsAPI, messagesAPI, visitsAPI, followupsAPI, usersAPI } from '../services/api';
import PatientTabs from './PatientTabs';
import MobileMenu from './MobileMenu';
import Modal from './ui/Modal';

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
    const [pendingCancellationsCount, setPendingCancellationsCount] = useState(0);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

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
        fetchMessagesCount();
        fetchPendingNotesCount();
        fetchPendingCancellationsCount();
        
        // Refresh counts periodically (every 30 seconds)
        const interval = setInterval(() => {
            fetchMessagesCount();
            fetchPendingNotesCount();
            fetchPendingCancellationsCount();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    // Check if user is a physician/NP/PA for "My Schedule" routing
    const roleName = user?.role_name || user?.role || '';
    const roleNameLower = roleName.toLowerCase();
    const isPhysicianRole = (
        roleNameLower === 'physician' ||
        roleNameLower === 'nurse practitioner' ||
        roleNameLower === 'np' ||
        roleNameLower === 'physician assistant' ||
        roleNameLower === 'pa' ||
        roleNameLower === 'clinician' ||
        user?.role === 'clinician'
    );

    // Navigation items with icons and badges
    const navItems = [
        // Schedule is always visible
        { path: '/schedule', icon: Calendar, label: 'Schedule', badge: null },
        // For physicians, also show "My Schedule"
        ...(isPhysicianRole ? [
            { path: '/my-schedule', icon: User, label: 'My Schedule', badge: null }
        ] : []),
        { path: '/cancellations', icon: AlertCircle, label: 'Cancellations', badge: pendingCancellationsCount > 0 ? pendingCancellationsCount : null },
        { path: '/patients', icon: Users, label: 'Patients', badge: null },
        { path: '/tasks', icon: ClipboardList, label: 'In Basket', badge: tasksCount > 0 ? tasksCount : null },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: messagesCount > 0 ? messagesCount : null },
        { path: '/pending-notes', icon: Clock, label: 'Pending Notes', badge: pendingNotesCount > 0 ? pendingNotesCount : null },
        { path: '/billing', icon: DollarSign, label: 'Billing', badge: null },
        { path: '/telehealth', icon: Video, label: 'Telehealth', badge: null },
        // Admin-only items
        ...(user?.role === 'Admin' || user?.role_name === 'Admin' || user?.is_admin ? [
            { path: '/analytics', icon: BarChart3, label: 'Analytics', badge: null },
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

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showUserMenu && !event.target.closest('.user-menu-container')) {
                setShowUserMenu(false);
            }
        };
        if (showUserMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showUserMenu]);

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
                            {navItems.slice(0, 4).map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${
                                            active
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
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all z-10 relative ${
                                                        active 
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
                            {navItems.slice(4).map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${
                                            active
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
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all z-10 relative ${
                                                        active 
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
                        <div className="flex items-center gap-2 relative user-menu-container">
                            {/* User Button */}
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all flex-1 ${sidebarCollapsed ? 'justify-center' : ''} ${
                                    sidebarCollapsed 
                                        ? 'hover:bg-soft-gray/80' 
                                        : 'bg-white/60 backdrop-blur-sm hover:bg-white border border-deep-gray/5 hover:border-deep-gray/20 hover:shadow-sm'
                                }`}
                                title={`${user.firstName} ${user.lastName} - ${user.role === 'clinician' ? 'Doctor' : user.role === 'front_desk' ? 'Front Desk' : user.role || user.role_name || 'User'}`}
                            >
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-strong-azure to-strong-azure/80 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm">
                                    {(user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="text-[12px] font-semibold text-deep-gray leading-tight truncate">{user.firstName} {user.lastName}</div>
                                        <div className="text-[10px] text-deep-gray/50 capitalize leading-tight truncate font-medium">
                                            {user.role === 'clinician' ? 'Doctor' : user.role === 'front_desk' ? 'Front Desk' : user.role || user.role_name || 'User'}
                                        </div>
                                    </div>
                                )}
                            </button>
                            
                            {/* User Menu Dropdown */}
                            {showUserMenu && !sidebarCollapsed && (
                                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg shadow-xl border border-deep-gray/10 z-50">
                                    <div className="py-1">
                                        <button
                                            onClick={() => {
                                                setShowPasswordModal(true);
                                                setShowUserMenu(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-deep-gray hover:bg-soft-gray flex items-center gap-2"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                            <span>Change Password</span>
                                        </button>
                                    </div>
                                </div>
                            )}
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

            {/* Mobile Menu */}
            <MobileMenu />

            {/* Change Password Modal */}
            {showPasswordModal && user && (
                <ChangePasswordModal
                    isOpen={showPasswordModal}
                    onClose={() => setShowPasswordModal(false)}
                    userId={user.id}
                    userName={`${user.firstName} ${user.lastName}`}
                />
            )}
        </div>
    );
};

// Change Password Modal Component
const ChangePasswordModal = ({ isOpen, onClose, userId, userName }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        // Validation
        if (!password) {
            setErrors({ password: 'Password is required' });
            return;
        }

        if (password.length < 12) {
            setErrors({ password: 'Password must be at least 12 characters' });
            return;
        }

        if (password !== confirmPassword) {
            setErrors({ confirmPassword: 'Passwords do not match' });
            return;
        }

        // Check password strength
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
            setErrors({ 
                password: 'Password must contain uppercase, lowercase, number, and special character' 
            });
            return;
        }

        setLoading(true);

        try {
            await usersAPI.updatePassword(userId, password);
            alert('Password changed successfully');
            setPassword('');
            setConfirmPassword('');
            onClose();
        } catch (error) {
            console.error('Error changing password:', error);
            const errorData = error.response?.data;
            if (errorData?.error === 'Password validation failed' && errorData?.details) {
                setErrors({ password: errorData.details.join('. ') });
            } else {
                setErrors({ general: errorData?.error || 'Failed to change password' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (password || confirmPassword) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleClose} 
            preventOutsideClick={!!(password || confirmPassword)}
            title={`Change Password - ${userName}`}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                        <strong>Error:</strong> {errors.general}
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                        <strong>Password Requirements:</strong> Minimum 12 characters, must include uppercase, lowercase, number, and special character.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={12}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                                errors.password ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="Enter new password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={12}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                                errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="Confirm new password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                    >
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default Layout;
