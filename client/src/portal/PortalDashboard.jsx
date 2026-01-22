import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
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
    Video,
    CheckCircle2
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
    const [stats, setStats] = useState({ messages: 0, appointments: 0, telehealth: 0 });
    const [quickGlance, setQuickGlance] = useState({
        nextAppointment: null,
        telehealthReady: null,
        unreadMessages: 0,
        recentUpdate: null
    });
    const navigate = useNavigate();

    const location = useLocation();

    useEffect(() => {
        // Handle tab selection via query param
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab && ['overview', 'messages', 'appointments', 'record', 'telehealth'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [location.search]);

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

                // Fetch data - include appointments for telehealth count
                const [msgsRes, reqsRes, apptsRes] = await Promise.all([
                    axios.get(`${apiBase}/portal/messages/threads`, { headers }).catch(() => ({ data: [] })),
                    axios.get(`${apiBase}/portal/appointments/requests`, { headers }).catch(() => ({ data: [] })),
                    axios.get(`${apiBase}/portal/appointments`, { headers }).catch(() => ({ data: [] }))
                ]);

                const newNotifs = [];

                // Check messages
                const unreadCount = msgsRes.data.reduce((acc, t) => acc + (parseInt(t.unread_count) || 0), 0);
                if (unreadCount > 0) {
                    newNotifs.push({
                        id: 'unread-msgs',
                        type: 'action', // Prominent styling
                        message: `You have ${unreadCount} new message${unreadCount > 1 ? 's' : ''}`,
                        action: 'messages',
                        priority: 'high'
                    });
                }

                // Check for appointment suggestions
                const hasSuggestions = msgsRes.data.some(t => t.last_message_body?.includes('[SUGGEST_SLOT:'));
                if (hasSuggestions) {
                    newNotifs.push({
                        id: 'appt-slots',
                        type: 'action',
                        message: `Action Required: Review suggested appointment slots`,
                        action: 'messages',
                        priority: 'urgent'
                    });
                }

                // Check appointment updates
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                const recentUpdates = reqsRes.data.filter(r =>
                    (r.status === 'confirmed' || r.status === 'denied') &&
                    new Date(r.updated_at || r.created_at) > threeDaysAgo
                );

                if (recentUpdates.length > 0) {
                    newNotifs.push({
                        id: 'appt-updates',
                        type: 'info',
                        message: `${recentUpdates.length} appointment update${recentUpdates.length > 1 ? 's' : ''}`,
                        action: 'appointments'
                    });
                }

                // Count telehealth appointments for today
                const now = new Date();
                const telehealthAppts = apptsRes.data.filter(appt => {
                    const type = (appt.appointment_type || '').toLowerCase();
                    const visitMethod = (appt.visit_method || '').toLowerCase();

                    // Parse appointment date string properly
                    // Handle both "2024-01-21" and "2024-01-21T14:30:00.000Z"
                    const dateStr = appt.appointment_date;
                    let apptYear, apptMonth, apptDate;

                    if (dateStr.includes('T')) {
                        const d = new Date(dateStr);
                        apptYear = d.getFullYear(); // Use local time
                        apptMonth = d.getMonth();
                        apptDate = d.getDate();
                    } else {
                        // If it's just YYYY-MM-DD, parse manually to avoid UTC conversion issues
                        const [y, m, d] = dateStr.split('-').map(Number);
                        apptYear = y;
                        apptMonth = m - 1; // 0-indexed
                        apptDate = d;
                    }

                    const isToday = apptDate === now.getDate() &&
                        apptMonth === now.getMonth() &&
                        apptYear === now.getFullYear();

                    // Debug log
                    // console.log('Checking appointment for telehealth:', { id: appt.id, type, visitMethod, date: appt.appointment_date });

                    const isTelehealth =
                        type.includes('telehealth') ||
                        type.includes('video') ||
                        type.includes('virtual') ||
                        visitMethod === 'telehealth' ||
                        visitMethod === 'video' ||
                        visitMethod === 'virtual';

                    return isTelehealth && isToday;
                });

                // console.log('Found telehealth appts today:', telehealthAppts);

                if (telehealthAppts.length > 0) {
                    newNotifs.push({
                        id: 'telehealth-ready',
                        type: 'action',
                        message: `You have ${telehealthAppts.length} virtual visit${telehealthAppts.length > 1 ? 's' : ''} today`,
                        action: 'telehealth',
                        priority: 'high'
                    });
                }

                // Count upcoming appointments (next 7 days)
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                const upcomingAppts = apptsRes.data.filter(appt => {
                    const apptDate = new Date(appt.appointment_date);
                    return apptDate >= new Date() && apptDate <= nextWeek;
                }).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

                // Find the next upcoming appointment
                const nextAppt = upcomingAppts.length > 0 ? upcomingAppts[0] : null;

                // Find today's telehealth appointment (ready to join)
                const telehealthReady = telehealthAppts.length > 0 ? telehealthAppts[0] : null;

                // Find most recent appointment update
                const recentUpdate = recentUpdates.length > 0 ? recentUpdates[0] : null;

                setActiveNotifications(newNotifs);
                setStats({
                    messages: unreadCount,
                    appointments: upcomingAppts.length,
                    telehealth: telehealthAppts.length
                });

                // Set quick glance data
                setQuickGlance({
                    nextAppointment: nextAppt,
                    telehealthReady: telehealthReady,
                    unreadMessages: unreadCount,
                    recentUpdate: recentUpdate
                });

            } catch (err) {
                console.error('Notification check failed', err);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 2000); // Poll every 2 seconds for live updates
        return () => clearInterval(interval);
    }, []);

    const content = useMemo(() => {
        switch (activeTab) {
            case 'messages':
                return <PortalMessages />;
            case 'appointments':
                return <PortalAppointments onMessageShortcut={(tab) => setActiveTab(tab)} />;
            case 'telehealth':
                return <PortalTelehealth onSchedule={() => setActiveTab('appointments')} />;
            case 'record':
                return <PortalHealthRecord />;
            case 'overview':
            default:
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Notifications - Hidden as we now use Quick Glance
                        <Notifications
                            notifications={activeNotifications}
                            onAction={(action) => setActiveTab(action)}
                        />
                        */}

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

                                {/* Quick Glance Section - Only shows when there's something actionable */}
                                {/* Quick Glance Section */}
                                <div className="relative mt-8 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${quickGlance.telehealthReady || quickGlance.unreadMessages > 0 || quickGlance.nextAppointment ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                        Overview
                                    </h3>

                                    {(quickGlance.telehealthReady || quickGlance.unreadMessages > 0 || quickGlance.nextAppointment) ? (
                                        <div className="flex flex-col gap-3">
                                            {/* Telehealth Ready - Highest Priority */}
                                            {quickGlance.telehealthReady && (
                                                <button
                                                    onClick={() => setActiveTab('telehealth')}
                                                    className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all text-left group shadow-lg shadow-emerald-200"
                                                >
                                                    <div className="flex items-center gap-3.5">
                                                        <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
                                                            <Video className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/80">Telehealth Visit Ready</p>
                                                            <p className="text-base font-bold text-white">Join Your Virtual Visit Now</p>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-white/80" />
                                                    </div>
                                                </button>
                                            )}

                                            {/* Unread Messages */}
                                            {quickGlance.unreadMessages > 0 && (
                                                <button
                                                    onClick={() => setActiveTab('messages')}
                                                    className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 transition-all text-left group shadow-lg shadow-blue-200/50"
                                                >
                                                    <div className="flex items-center gap-3.5">
                                                        <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center relative">
                                                            <MessageSquare className="w-5 h-5" />
                                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-blue-500 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                                                                {quickGlance.unreadMessages}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/80">New Messages</p>
                                                            <p className="text-base font-bold text-white">You have {quickGlance.unreadMessages} unread message{quickGlance.unreadMessages > 1 ? 's' : ''}</p>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-white/80" />
                                                    </div>
                                                </button>
                                            )}

                                            {/* Next Appointment */}
                                            {quickGlance.nextAppointment && (
                                                <button
                                                    onClick={() => setActiveTab('appointments')}
                                                    className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-500 hover:to-cyan-600 transition-all text-left group shadow-lg shadow-sky-200/50"
                                                >
                                                    <div className="flex items-center gap-3.5">
                                                        <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
                                                            <Calendar className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/80">Upcoming Appointment</p>
                                                            <p className="text-lg font-bold text-white">
                                                                {new Date(quickGlance.nextAppointment.appointment_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                                {quickGlance.nextAppointment.appointment_time && ` at ${quickGlance.nextAppointment.appointment_time}`}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-white/80" />
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-700">You're all caught up!</p>
                                            <p className="text-xs text-slate-400 mt-1">No new messages or upcoming visits.</p>
                                        </div>
                                    )}
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
    }, [activeTab, patient, activeNotifications, stats]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Accessing Secure Records...</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-blue-100">
            {/* Desktop Sidebar */}
            <aside className="w-[260px] hidden lg:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-100 z-50">
                <PremiumStyles />
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
                            badge={stats.messages > 0 ? stats.messages : null}
                            badgeColor="babyBlue"
                        />
                        <NavItem
                            icon={<Calendar className="w-4.5 h-4.5" />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => setActiveTab('appointments')}
                            badge={stats.appointments > 0 ? stats.appointments : null}
                            badgeColor="azure"
                        />
                        <NavItem
                            icon={<Video className="w-4.5 h-4.5" />}
                            label="Telehealth"
                            active={activeTab === 'telehealth'}
                            onClick={() => setActiveTab('telehealth')}
                            badge={stats.telehealth > 0 ? stats.telehealth : null}
                            badgeColor="emerald"
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
                            badge={stats.messages > 0 ? stats.messages : null}
                            badgeColor="babyBlue"
                        />
                        <NavItem
                            icon={<Calendar size={18} />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => { setActiveTab('appointments'); setIsMobileMenuOpen(false); }}
                            badge={stats.appointments > 0 ? stats.appointments : null}
                            badgeColor="azure"
                        />
                        <NavItem
                            icon={<Video size={18} />}
                            label="Telehealth"
                            active={activeTab === 'telehealth'}
                            onClick={() => { setActiveTab('telehealth'); setIsMobileMenuOpen(false); }}
                            badge={stats.telehealth > 0 ? stats.telehealth : null}
                            badgeColor="emerald"
                        />
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[260px] overflow-x-hidden min-h-screen">
                <main className="max-w-7xl mx-auto p-6 md:p-10 pt-24 lg:pt-12">
                    {content}
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, active, onClick, badge, badgeColor = 'red' }) => {
    const badgeColorClasses = {
        red: 'bg-red-500 text-white',
        emerald: 'bg-emerald-500 text-white',
        blue: 'bg-blue-500 text-white',
        babyBlue: 'bg-blue-400 text-white',
        azure: 'bg-sky-500 text-white',
        amber: 'bg-amber-500 text-white'
    };

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
        >
            <div className="flex items-center gap-3.5">
                <span className={`transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
                <span className="font-bold text-[11px] uppercase tracking-widest leading-none">{label}</span>
            </div>
            {badge > 0 && (
                <span className={`min-w-[1.5rem] h-6 flex items-center justify-center px-1.5 rounded-full text-[10px] font-black transition-all duration-300 shadow-sm ${active ? 'bg-white text-blue-600' : `${badgeColorClasses[badgeColor]} animate-pulse`
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    );
};

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

const Notifications = ({ notifications, onAction }) => {
    if (notifications.length === 0) return null;
    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">Pending Actions</h3>
            <div className="space-y-3">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        onClick={() => onAction(n.action)}
                        className={`p-6 rounded-[2.5rem] flex items-center justify-between gap-5 shadow-2xl transition-all cursor-pointer group hover:-translate-y-2 border-2 notification-card ${n.type === 'action'
                            ? 'type-action bg-gradient-to-br from-red-50 to-white border-red-200 text-red-900 shadow-red-200/50 animate-glow-red'
                            : 'bg-white border-transparent shadow-slate-200/50'
                            }`}
                    >
                        <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 backdrop-blur-sm group-hover:scale-110 transition-transform ${n.type === 'action' ? 'bg-red-500 text-white shadow-2xl shadow-red-300 animate-pulse' : 'bg-blue-600 text-white'}`}>
                                <Bell className={`w-8 h-8 text-white`} />
                            </div>
                            <div>
                                <h4 className={`font-black text-lg tracking-tight mb-1 ${n.type === 'action' ? 'text-red-950' : 'text-slate-900'}`}>{n.message}</h4>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${n.type === 'action' ? 'bg-red-600 animate-ping' : 'bg-blue-600'}`} />
                                    <p className={`text-[12px] font-black uppercase tracking-[0.2em] ${n.type === 'action' ? 'text-red-600' : 'text-slate-500'}`}>
                                        {n.priority === 'urgent' ? 'Requires Immediate Action' : 'Urgent Notification'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${n.type === 'action' ? 'bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white shadow-inner' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
                            <ChevronRight className="w-7 h-7" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// CSS Injection for premium animations & refined input styles
const PremiumStyles = () => (
    <style>{`
        @keyframes pulse-subtle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.05); }
        }
        .animate-pulse-subtle {
            animation: pulse-subtle 2s ease-in-out infinite;
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

        /* Premium Effects */
        @keyframes glow-red {
            0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.2); }
            50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
        }
        @keyframes glow-blue {
            0%, 100% { box-shadow: 0 0 5px rgba(37, 99, 235, 0.2); }
            50% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.6); }
        }
        @keyframes bounce-subtle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }
        .animate-glow-red {
            animation: glow-red 2s infinite;
        }
        .animate-glow-blue {
            animation: glow-blue 2s infinite;
        }
        .pulse-red {
            animation: pulse-red 1.5s infinite;
        }
        @keyframes pulse-red {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .sidebar-item-active {
            background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
        }
        .notification-card {
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }
        .notification-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: #EF4444;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .notification-card.type-action::before {
            opacity: 1;
        }
    `}</style>
);

export default PortalDashboard;
