import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    MessageSquare,
    Calendar,
    FileText,
    LogOut,
    User,
    Phone,
    Activity,
    Shield as ShieldCheck,
    ChevronRight,
    Pill,
    AlertCircle,
    ClipboardList,
    FlaskConical,
    Menu,
    X,
    Bell,
    Video
} from 'lucide-react';
import PortalMessages from './PortalMessages';
import PortalAppointments from './PortalAppointments';
import PortalHealthRecord from './PortalHealthRecord';
import PortalTelehealth from './PortalTelehealth';

const PortalDashboard = () => {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, messages, appointments, record
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeNotifications, setActiveNotifications] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem('portalToken');
                if (!token) {
                    navigate('/portal/login');
                    return;
                }

                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const response = await axios.get(`${apiBase}/portal/chart/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setPatient(response.data);
            } catch (err) {
                console.error('Failed to fetch dashboard:', err);
                if (err.response?.status === 401) {
                    navigate('/portal/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [navigate]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const token = localStorage.getItem('portalToken');
                if (!token) return;

                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch data
                const [msgsRes, reqsRes] = await Promise.all([
                    axios.get(`${apiBase}/portal/messages/threads`, { headers }).catch(() => ({ data: [] })),
                    axios.get(`${apiBase}/portal/appointments/requests`, { headers }).catch(() => ({ data: [] }))
                ]);

                const newNotifs = [];

                // Check messages
                const unreadCount = msgsRes.data.reduce((acc, t) => acc + (parseInt(t.unread_count) || 0), 0);
                if (unreadCount > 0) {
                    newNotifs.push(`You have ${unreadCount} new message${unreadCount > 1 ? 's' : ''}`);
                }

                // NEW: Specifically check for appointment suggestions
                const hasSuggestions = msgsRes.data.some(t => t.last_message_body?.includes('[SUGGEST_SLOT:'));
                if (hasSuggestions) {
                    newNotifs.push(`Action Required: Review suggested appointment slots`);
                }

                // Check appointment updates (recent updates in last 72h)
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                const recentUpdates = reqsRes.data.filter(r =>
                    (r.status === 'confirmed' || r.status === 'denied') &&
                    new Date(r.updated_at || r.created_at) > threeDaysAgo
                );

                if (recentUpdates.length > 0) {
                    newNotifs.push(`${recentUpdates.length} appointment request${recentUpdates.length > 1 ? 's were' : ' was'} updated recently`);
                }

                setActiveNotifications(newNotifs);

            } catch (err) {
                console.error('Notification check failed', err);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Accessing Secure Records...</div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'messages':
                return <PortalMessages />;
            case 'appointments':
                return <PortalAppointments onMessageShortcut={(tab) => setActiveTab(tab)} />;
            case 'telehealth':
                return <PortalTelehealth />;
            case 'record':
                return <PortalHealthRecord />;
            case 'overview':
            default:
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Notifications */}
                        <Notifications notifications={activeNotifications} onClick={() => setActiveTab('messages')} />
                        <PremiumCSS />

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            {/* Patient Info Card */}
                            <div className="xl:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-10 border border-slate-50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50 transition-colors" />

                                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8 mb-10">
                                    <div className="w-20 h-20 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-500/20 ring-4 ring-slate-50">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{patient?.first_name} {patient?.last_name}</h2>
                                            <div className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase tracking-widest">Active</div>
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal MRN: <span className="text-slate-600">{patient?.id?.slice(0, 8).toUpperCase()}</span></p>
                                    </div>
                                </div>

                                <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                                            <Calendar className="w-3 h-3" /> DOB
                                        </div>
                                        <div className="text-lg font-bold text-slate-700">{patient?.dob}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                                            <ShieldCheck className="w-3 h-3" /> Sex
                                        </div>
                                        <div className="text-lg font-bold text-slate-700 capitalize">{patient?.sex || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                                            <Phone className="w-3 h-3" /> Contact
                                        </div>
                                        <div className="text-lg font-bold text-slate-700">{patient?.phone || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Cards */}
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => setActiveTab('appointments')}
                                    className="group relative h-1/2 w-full text-left bg-blue-600 hover:bg-blue-700 rounded-[2.5rem] p-8 shadow-xl shadow-blue-200/40 transition-all hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                                                <Calendar className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white tracking-tight leading-tight">Request an<br />Appointment</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/90 font-bold text-xs uppercase tracking-widest">
                                            Schedule now <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab('telehealth')}
                                    className="group relative h-1/2 w-full text-left bg-emerald-600 hover:bg-emerald-700 rounded-[2.5rem] p-8 shadow-xl shadow-emerald-200/40 transition-all hover:-translate-y-1 border border-slate-50"
                                >
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                                                <Video className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white tracking-tight leading-tight">Join Telehealth<br />Visit</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/60 font-bold text-xs uppercase tracking-widest transition-colors">
                                            Start session <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className="group relative h-1/2 w-full text-left bg-white hover:bg-blue-600 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 transition-all hover:shadow-blue-200/40 hover:-translate-y-1 border border-slate-50"
                                >
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <div className="w-10 h-10 bg-blue-50 group-hover:bg-white/10 rounded-xl flex items-center justify-center mb-4 transition-colors">
                                                <MessageSquare className="w-5 h-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 group-hover:text-white tracking-tight leading-tight">Secure<br />Messaging</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-white/60 font-bold text-xs uppercase tracking-widest transition-colors">
                                            Send message <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <QuickCard
                                title="Medications"
                                icon={<Pill className="w-5 h-5" />}
                                status="Active"
                                count="Current"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Allergies"
                                icon={<AlertCircle className="w-5 h-5" />}
                                status="Verified"
                                count="On file"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Visit Notes"
                                icon={<ClipboardList className="w-5 h-5" />}
                                status="Clinical"
                                count="View full chart"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Lab Results"
                                icon={<FlaskConical className="w-5 h-5" />}
                                status="Syncing"
                                count="New"
                                onClick={() => setActiveTab('record')}
                            />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-blue-100">
            {/* Desktop Sidebar */}
            <aside className="w-[260px] hidden lg:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-100 z-50">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <img src="/logo.png" alt="PageMD Logo" className="h-8 object-contain" />
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="font-bold text-slate-800 text-base tracking-tighter">PORTAL</span>
                    </div>

                    <nav className="space-y-1.5">
                        <NavItem
                            icon={<LayoutDashboard className="w-4.5 h-4.5" />}
                            label="Overview"
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                        />
                        <NavItem
                            icon={<FileText className="w-4.5 h-4.5" />}
                            label="Health Record"
                            active={activeTab === 'record'}
                            onClick={() => setActiveTab('record')}
                        />
                        <NavItem
                            icon={<MessageSquare className="w-4.5 h-4.5" />}
                            label="Messages"
                            active={activeTab === 'messages'}
                            onClick={() => setActiveTab('messages')}
                        />
                        <NavItem
                            icon={<Calendar className="w-4.5 h-4.5" />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => setActiveTab('appointments')}
                        />
                        <NavItem
                            icon={<Video className="w-4.5 h-4.5" />}
                            label="Telehealth"
                            active={activeTab === 'telehealth'}
                            onClick={() => setActiveTab('telehealth')}
                        />
                    </nav>
                </div>

                <div className="mt-auto p-6 pt-0">
                    <div className="bg-slate-50 rounded-2xl p-5 mb-4 border border-slate-100/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Support</span>
                        </div>
                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest">Questions about your care? Contact your clinic representative.</p>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.removeItem('portalToken');
                            navigate('/portal/login');
                        }}
                        className="w-full flex items-center gap-2.5 p-3.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Nav */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 z-[60] flex justify-between items-center">
                <img src="/logo.png" alt="PageMD Logo" className="h-7 object-contain" />
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-800">
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 bg-white z-[55] pt-20 animate-in slide-in-from-top duration-300">
                    <nav className="px-6 space-y-2 pt-4">
                        <NavItem
                            icon={<LayoutDashboard size={18} />}
                            label="Overview"
                            active={activeTab === 'overview'}
                            onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<FileText size={18} />}
                            label="Health Record"
                            active={activeTab === 'record'}
                            onClick={() => { setActiveTab('record'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<MessageSquare size={18} />}
                            label="Messages"
                            active={activeTab === 'messages'}
                            onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<Calendar size={18} />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => { setActiveTab('appointments'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<Video size={18} />}
                            label="Telehealth"
                            active={activeTab === 'telehealth'}
                            onClick={() => { setActiveTab('telehealth'); setIsMobileMenuOpen(false); }}
                        />
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[260px] overflow-x-hidden min-h-screen">
                <main className="max-w-7xl mx-auto p-6 md:p-10 pt-24 lg:pt-12">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-all duration-300 ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
            : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'
            }`}
    >
        <span className="transition-transform duration-500">{icon}</span>
        <span className="font-bold text-[11px] uppercase tracking-widest">{label}</span>
    </button>
);

const QuickCard = ({ title, icon, status, count, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-200/40 border border-slate-50 hover:shadow-xl hover:shadow-blue-200/20 transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="w-12 h-12 mb-4 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all duration-500">
            {icon}
        </div>
        <h3 className="font-bold text-slate-800 text-sm mb-1 tracking-tight">{title}</h3>
        <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">{status}</span>
            <span className="text-[10px] text-slate-400 font-bold">{count}</span>
        </div>
    </div>
);

const Notifications = ({ notifications, onClick }) => {
    if (notifications.length === 0) return null;
    return (
        <div
            onClick={onClick}
            className="bg-blue-600 text-white p-6 rounded-[2rem] flex items-start sm:items-center gap-5 shadow-xl shadow-blue-200/50 cursor-pointer hover:bg-blue-700 transition-all group"
        >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-lg mb-1 tracking-tight">New Activity</h4>
                <div className="space-y-1">
                    {notifications.map((n, i) => (
                        <p key={i} className="text-sm font-medium text-blue-100 leading-snug flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-300 rounded-full" /> {n}
                        </p>
                    ))}
                </div>
            </div>
            <div className="hidden sm:block">
                <ChevronRight className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
            </div>
        </div>
    );
};

// CSS Injection for premium animations & refined input styles
const PremiumCSS = () => (
    <style>{`
        @keyframes pulse-subtle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.95; transform: scale(1.005); }
        }
        .animate-pulse-subtle {
            animation: pulse-subtle 3s ease-in-out infinite;
        }
        .portal-input {
            width: 100%;
            padding: 0.875rem 1.25rem;
            background-color: #F8FAFC;
            border: 1px solid #F1F5F9;
            border-radius: 1rem;
            font-weight: 700;
            font-size: 0.875rem;
            color: #1E293B;
            outline: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .portal-input:focus {
            background-color: white;
            border-color: #2563EB;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #E2E8F0;
            border-radius: 10px;
        }
        
        /* Modern Select Arrow Fix */
        select.portal-input {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            background-size: 1rem;
            appearance: none;
        }
    `}</style>
);

export default PortalDashboard;
