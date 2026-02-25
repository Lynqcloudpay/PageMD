import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, Activity, Clock, User, ChevronRight,
    Plus, MessageSquare, ClipboardList, Zap, CheckCircle2, XCircle,
    ArrowRight, Inbox, Sun, Moon, Sunrise,
    Stethoscope, UserCheck, DoorOpen, Eye
} from 'lucide-react';
import { reportsAPI, appointmentsAPI, inboxAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { format } from 'date-fns';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { can, getScope } = usePermissions();
    const scope = getScope();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [inboxItems, setInboxItems] = useState([]);
    const [loadingInbox, setLoadingInbox] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await reportsAPI.getDashboard();
                setStats(response.data);
            } catch (error) {
                console.warn('Could not fetch dashboard stats:', error);
                setStats({
                    totalPatients: 0, visitsToday: 0, pendingOrders: 0,
                    unreadMessages: 0, pendingNotes: 0, unsignedNotes: 0,
                    cancellationFollowups: 0, unreadLabs: 0, tomorrowCount: 0,
                    patientFlow: { scheduled: 0, arrived: 0, inRoom: 0, checkedOut: 0, noShow: 0, cancelled: 0 }
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchTodayAppointments = async () => {
            if (!user || !can('schedule:view')) {
                setLoadingAppointments(false);
                return;
            }
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const params = { date: today };
                if (scope.scheduleScope === 'SELF') {
                    params.providerId = user.id;
                }
                const response = await appointmentsAPI.get(params);
                setTodayAppointments(response.data || []);
            } catch (error) {
                console.error('Error fetching today\'s appointments:', error);
                setTodayAppointments([]);
            } finally {
                setLoadingAppointments(false);
            }
        };

        const fetchInbox = async (silent = false) => {
            if (!user) return;
            try {
                if (!silent) setLoadingInbox(true);
                const response = await inboxAPI.getAll({ status: 'new', assignedTo: 'me' });
                setInboxItems(response.data || []);
            } catch (error) {
                console.error('Error fetching inbox:', error);
            } finally {
                if (!silent) setLoadingInbox(false);
            }
        };

        fetchTodayAppointments();
        fetchInbox();

        const interval = setInterval(() => {
            fetchTodayAppointments();
            fetchInbox(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [user, can, scope]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return { text: 'Good morning', icon: Sunrise };
        if (hour < 17) return { text: 'Good afternoon', icon: Sun };
        return { text: 'Good evening', icon: Moon };
    }, []);

    const activeAppointments = useMemo(() => {
        return todayAppointments
            .filter(a => !['cancelled', 'no-show', 'no_show'].includes(a.patient_status))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [todayAppointments]);

    const nextPatient = useMemo(() => {
        const now = format(new Date(), 'HH:mm');
        return activeAppointments.find(a =>
            a.time >= now && ['scheduled', 'arrived'].includes(a.patient_status || 'scheduled')
        );
    }, [activeAppointments]);

    const seenCount = useMemo(() => {
        return activeAppointments.filter(a =>
            ['checked_out', 'checked-out', 'completed'].includes(a.patient_status)
        ).length;
    }, [activeAppointments]);

    const remainingCount = activeAppointments.length - seenCount;

    const flow = stats?.patientFlow || { scheduled: 0, arrived: 0, inRoom: 0, checkedOut: 0, noShow: 0, cancelled: 0 };
    const flowTotal = flow.scheduled + flow.arrived + flow.inRoom + flow.checkedOut;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#FAFBFC]">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-3 text-gray-400 text-xs font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#FAFBFC] h-full flex flex-col overflow-hidden">
            {/* Greeting Header — compact */}
            <div className="bg-white border-b border-gray-100 flex-shrink-0">
                <div className="max-w-[1500px] mx-auto px-5 py-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                                <greeting.icon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-gray-900 tracking-tight leading-tight">
                                    {greeting.text}, <span className="text-blue-700">Dr. {user?.lastName || user?.last_name || 'Provider'}</span>
                                </h1>
                                <p className="text-[11px] text-gray-400 font-medium">
                                    {format(new Date(), 'EEEE, MMMM d, yyyy')} · {activeAppointments.length} patients today
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/patients')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Patient
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats + Flow — single compact row */}
            <div className="flex-shrink-0 bg-white border-b border-gray-100">
                <div className="max-w-[1500px] mx-auto px-5 py-2">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {/* My Day chip */}
                        <button onClick={() => navigate('/schedule')} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors flex-shrink-0">
                            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-sm font-bold text-gray-900">{activeAppointments.length}</span>
                            <span className="text-[10px] text-gray-500 font-medium">today</span>
                            <div className="w-px h-4 bg-blue-200" />
                            <span className="text-xs font-bold text-emerald-600">{seenCount}</span>
                            <span className="text-[9px] text-gray-400">seen</span>
                            <span className="text-xs font-bold text-amber-600">{remainingCount}</span>
                            <span className="text-[9px] text-gray-400">left</span>
                        </button>

                        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

                        {/* Stat pills */}
                        <StatPill icon={FileText} label="Unsigned" value={stats?.unsignedNotes || stats?.pendingNotes || 0} color="rose" onClick={() => navigate('/pending-notes')} urgent={stats?.unsignedNotes > 0} />
                        <StatPill icon={ClipboardList} label="Basket" value={stats?.pendingOrders || 0} color="amber" onClick={() => navigate('/tasks')} />
                        <StatPill icon={Activity} label="Labs" value={stats?.unreadLabs || 0} color="blue" onClick={() => navigate('/tasks')} />
                        <StatPill icon={MessageSquare} label="Msgs" value={stats?.unreadMessages || 0} color="indigo" onClick={() => navigate('/messages')} />
                        <StatPill icon={XCircle} label="F/U" value={stats?.cancellationFollowups || 0} color="orange" onClick={() => navigate('/cancellations')} />
                        <StatPill icon={Users} label="Pts" value={stats?.totalPatients || 0} color="slate" onClick={() => navigate('/patients')} />

                        {flowTotal > 0 && (
                            <>
                                <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
                                {/* Flow mini */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <FlowDot label="Sched" count={flow.scheduled} color="bg-slate-300" />
                                    <FlowDot label="Arrived" count={flow.arrived} color="bg-blue-500" />
                                    <FlowDot label="In Room" count={flow.inRoom} color="bg-emerald-500" />
                                    <FlowDot label="Done" count={flow.checkedOut} color="bg-gray-300" />
                                </div>
                            </>
                        )}

                        {stats?.tomorrowCount > 0 && (
                            <>
                                <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
                                <div className="flex items-center gap-1.5 text-gray-400 flex-shrink-0">
                                    <Eye className="w-3 h-3" />
                                    <span className="text-[10px] font-medium">Tmrw: <span className="font-bold text-gray-600">{stats.tomorrowCount}</span></span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="max-w-[1500px] mx-auto px-5 py-3 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

                        {/* LEFT: Schedule */}
                        <div className="lg:col-span-8 flex flex-col min-h-0 h-full">
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col h-full">
                                {/* Schedule header + next patient */}
                                <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                        <h2 className="font-semibold text-gray-800 text-xs">Today's Schedule</h2>
                                        <span className="bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                            {activeAppointments.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {nextPatient && (
                                            <button
                                                onClick={() => navigate(`/patient/${nextPatient.patientId}/snapshot`)}
                                                className="flex items-center gap-2 bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all"
                                            >
                                                <User className="w-3 h-3" />
                                                Next: {nextPatient.patientName?.split(' ')[0]} · {nextPatient.time?.substring(0, 5)}
                                                <ChevronRight className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button onClick={() => navigate('/schedule')} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                            Full Schedule <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {/* Schedule list — scrollable */}
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {loadingAppointments ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : activeAppointments.length > 0 ? (
                                        <div className="divide-y divide-gray-50">
                                            {activeAppointments.map((appt) => (
                                                <AppointmentRow key={appt.id} appt={appt} navigate={navigate} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <Calendar className="w-8 h-8 text-gray-200 mb-2" />
                                            <p className="font-semibold text-gray-400 text-xs">No appointments today</p>
                                            <button onClick={() => navigate('/schedule')} className="mt-2 px-3 py-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                                View Calendar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Inbox + Quick Actions */}
                        <div className="lg:col-span-4 flex flex-col min-h-0 h-full gap-3">
                            {/* In-Basket — scrollable */}
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col flex-1 min-h-0">
                                <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Inbox className="w-3.5 h-3.5 text-blue-600" />
                                        <h3 className="text-xs font-semibold text-gray-800">In Basket</h3>
                                        {inboxItems.length > 0 && (
                                            <span className="bg-rose-50 text-rose-600 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{inboxItems.length}</span>
                                        )}
                                    </div>
                                    <button onClick={() => navigate('/tasks')} className="text-[9px] font-semibold text-blue-600 hover:text-blue-700 uppercase tracking-wider">
                                        View All
                                    </button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                                    {loadingInbox ? (
                                        <div className="flex items-center justify-center py-6">
                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : inboxItems.length > 0 ? (
                                        <div className="space-y-1">
                                            {inboxItems.slice(0, 8).map((item) => {
                                                const diffMins = Math.floor((new Date() - new Date(item.created_at)) / 60000);
                                                const timeStr = diffMins < 60 ? `${diffMins}m` : diffMins < 1440 ? `${Math.floor(diffMins / 60)}h` : `${Math.floor(diffMins / 1440)}d`;
                                                return (
                                                    <button key={item.id} onClick={() => navigate(`/tasks?id=${item.id}`)}
                                                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors group">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700 truncate">{item.patient_name || 'System'}</p>
                                                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                                                {item.priority === 'stat' && <span className="bg-rose-100 text-rose-700 text-[8px] font-bold px-1 py-0.5 rounded">STAT</span>}
                                                                <span className="text-[9px] text-gray-400">{timeStr}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 truncate">{item.subject}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-200 mb-1" />
                                            <p className="text-[10px] font-semibold text-emerald-600">All clear</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions — compact */}
                            <div className="bg-white rounded-xl border border-gray-100 p-2.5 flex-shrink-0">
                                <div className="grid grid-cols-4 gap-1.5">
                                    <QuickAction icon={Users} label="Patients" onClick={() => navigate('/patients')} />
                                    <QuickAction icon={Calendar} label="Schedule" onClick={() => navigate('/schedule')} />
                                    <QuickAction icon={FileText} label="Notes" onClick={() => navigate('/pending-notes')} />
                                    <QuickAction icon={ClipboardList} label="Tasks" onClick={() => navigate('/tasks')} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ──────────── Sub-Components ────────────

const StatPill = ({ icon: Icon, label, value, color, onClick, urgent }) => {
    const colors = {
        rose: 'text-rose-600', amber: 'text-amber-600', blue: 'text-blue-600',
        indigo: 'text-indigo-600', orange: 'text-orange-600', slate: 'text-gray-500',
    };
    return (
        <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors flex-shrink-0 relative group">
            {urgent && value > 0 && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
            <Icon className={`w-3 h-3 ${colors[color] || 'text-gray-400'}`} />
            <span className={`text-xs font-bold ${colors[color] || 'text-gray-600'}`}>{value}</span>
            <span className="text-[9px] text-gray-400 font-medium hidden xl:inline">{label}</span>
        </button>
    );
};

const FlowDot = ({ label, count, color }) => (
    <div className="flex items-center gap-1 flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-[10px] font-bold text-gray-700">{count}</span>
        <span className="text-[9px] text-gray-400 hidden xl:inline">{label}</span>
    </div>
);

const AppointmentRow = ({ appt, navigate }) => {
    const ps = appt.patient_status || 'scheduled';
    const statusStyles = {
        scheduled: { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Scheduled' },
        arrived: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Arrived' },
        'in-room': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'In Room' },
        'in_room': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'In Room' },
        'checked_out': { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Complete' },
        'checked-out': { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Complete' },
        'completed': { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Complete' },
    };
    const s = statusStyles[ps] || statusStyles.scheduled;
    const isComplete = ['checked_out', 'checked-out', 'completed'].includes(ps);

    return (
        <div
            onClick={() => navigate(`/patient/${appt.patientId}/snapshot`)}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/30 transition-colors cursor-pointer group ${isComplete ? 'opacity-40' : ''}`}
        >
            <span className="text-[11px] font-bold text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded font-mono w-[42px] text-center flex-shrink-0">{appt.time?.substring(0, 5)}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold group-hover:text-blue-700 transition-colors ${isComplete ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {appt.patientName}
                    </span>
                    {appt.visit_method === 'telehealth' && (
                        <span className="bg-indigo-50 text-indigo-600 text-[7px] font-bold px-1 py-0.5 rounded uppercase">Tele</span>
                    )}
                </div>
                <span className="text-[9px] text-gray-400 font-medium">{appt.type || 'Follow-up'} · {appt.duration || 30}m</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${s.bg} ${s.text}`}>
                {s.label}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-all group active:scale-95"
    >
        <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        <span className="text-[9px] font-semibold text-gray-500 group-hover:text-blue-700">{label}</span>
    </button>
);

export default Dashboard;
