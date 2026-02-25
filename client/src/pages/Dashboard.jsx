import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, Activity, Clock, User, ChevronRight,
    Plus, MessageSquare, ClipboardList, Zap, Bell, CheckCircle2, XCircle,
    AlertTriangle, Pill, ArrowRight, TrendingUp, Inbox, Sun, Moon, Sunrise,
    Stethoscope, UserCheck, DoorOpen, LogOut, Eye
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

    // Smart greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return { text: 'Good morning', icon: Sunrise };
        if (hour < 17) return { text: 'Good afternoon', icon: Sun };
        return { text: 'Good evening', icon: Moon };
    }, []);

    // Active (non-cancelled/no-show) appointments
    const activeAppointments = useMemo(() => {
        return todayAppointments
            .filter(a => !['cancelled', 'no-show', 'no_show'].includes(a.patient_status))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [todayAppointments]);

    // Next patient (first scheduled/arrived)
    const nextPatient = useMemo(() => {
        const now = format(new Date(), 'HH:mm');
        return activeAppointments.find(a =>
            a.time >= now && ['scheduled', 'arrived'].includes(a.patient_status || 'scheduled')
        );
    }, [activeAppointments]);

    // Seen vs remaining
    const seenCount = useMemo(() => {
        return activeAppointments.filter(a =>
            ['checked_out', 'checked-out', 'completed'].includes(a.patient_status)
        ).length;
    }, [activeAppointments]);

    const remainingCount = activeAppointments.length - seenCount;

    // Patient flow data
    const flow = stats?.patientFlow || { scheduled: 0, arrived: 0, inRoom: 0, checkedOut: 0, noShow: 0, cancelled: 0 };
    const flowTotal = flow.scheduled + flow.arrived + flow.inRoom + flow.checkedOut;

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen bg-[#FAFBFC]">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-400 text-sm font-medium">Loading your workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#FAFBFC] min-h-screen">
            {/* Greeting Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-[1500px] mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                                <greeting.icon className="w-4.5 h-4.5 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                                    {greeting.text}, <span className="text-blue-700">Dr. {user?.lastName || user?.last_name || 'Provider'}</span>
                                </h1>
                                <p className="text-xs text-gray-400 font-medium">
                                    {format(new Date(), 'EEEE, MMMM d, yyyy')} · {activeAppointments.length} patients today
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/patients')}
                                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Patient
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1500px] mx-auto px-6 py-4 space-y-4">

                {/* Row 1: At-a-Glance Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {/* My Day Summary — Wider Card */}
                    <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3 relative overflow-hidden group hover:border-blue-200 transition-all cursor-pointer" onClick={() => navigate('/schedule')}>
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-125 transition-transform" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Day</span>
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 leading-none">{activeAppointments.length}</div>
                                    <p className="text-[9px] text-gray-400 mt-0.5 font-medium">patients today</p>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-3">
                                        <div className="text-center">
                                            <span className="text-lg font-bold text-emerald-600">{seenCount}</span>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">seen</p>
                                        </div>
                                        <div className="w-px h-6 bg-gray-100" />
                                        <div className="text-center">
                                            <span className="text-lg font-bold text-amber-600">{remainingCount}</span>
                                            <p className="text-[9px] text-gray-400 font-semibold uppercase">left</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <StatCard icon={FileText} label="Unsigned" value={stats?.unsignedNotes || stats?.pendingNotes || 0} color="rose" onClick={() => navigate('/pending-notes')} urgent={stats?.unsignedNotes > 0} />
                    <StatCard icon={ClipboardList} label="In Basket" value={stats?.pendingOrders || 0} color="amber" onClick={() => navigate('/tasks')} />
                    <StatCard icon={Activity} label="Labs" value={stats?.unreadLabs || 0} color="blue" onClick={() => navigate('/tasks')} />
                    <StatCard icon={MessageSquare} label="Messages" value={stats?.unreadMessages || 0} color="indigo" onClick={() => navigate('/messages')} />
                    <StatCard icon={XCircle} label="Follow-ups" value={stats?.cancellationFollowups || 0} color="orange" onClick={() => navigate('/cancellations')} />
                    <StatCard icon={Users} label="Patients" value={stats?.totalPatients || 0} color="slate" onClick={() => navigate('/patients')} />
                </div>

                {/* Row 2: Patient Flow Board */}
                {flowTotal > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-3.5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                                <h2 className="text-xs font-bold text-gray-800">Patient Flow</h2>
                            </div>
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Live</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <FlowStage icon={Clock} label="Scheduled" count={flow.scheduled} color="slate" />
                            <FlowStage icon={UserCheck} label="Arrived" count={flow.arrived} color="blue" />
                            <FlowStage icon={DoorOpen} label="In Room" count={flow.inRoom} color="emerald" />
                            <FlowStage icon={CheckCircle2} label="Checked Out" count={flow.checkedOut} color="gray" />
                        </div>
                        {/* Flow Progress Bar */}
                        {flowTotal > 0 && (
                            <div className="mt-3 h-1.5 bg-gray-50 rounded-full overflow-hidden flex">
                                {flow.checkedOut > 0 && <div className="bg-gray-300 transition-all duration-700" style={{ width: `${(flow.checkedOut / flowTotal) * 100}%` }} />}
                                {flow.inRoom > 0 && <div className="bg-emerald-400 transition-all duration-700" style={{ width: `${(flow.inRoom / flowTotal) * 100}%` }} />}
                                {flow.arrived > 0 && <div className="bg-blue-400 transition-all duration-700" style={{ width: `${(flow.arrived / flowTotal) * 100}%` }} />}
                                {flow.scheduled > 0 && <div className="bg-slate-200 transition-all duration-700" style={{ width: `${(flow.scheduled / flowTotal) * 100}%` }} />}
                            </div>
                        )}
                    </div>
                )}

                {/* Row 3: Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT: Schedule + Next Patient */}
                    <div className="lg:col-span-8 space-y-4">

                        {/* Next Patient Card */}
                        {nextPatient && (
                            <div
                                className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white cursor-pointer hover:shadow-lg hover:shadow-blue-600/20 transition-all active:scale-[0.99]"
                                onClick={() => navigate(`/patient/${nextPatient.patientId}/snapshot`)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Next Patient</p>
                                            <h3 className="text-base font-bold">{nextPatient.patientName}</h3>
                                            <p className="text-xs text-blue-100 font-medium">{nextPatient.type || 'Follow-up'} · {nextPatient.time}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${nextPatient.patient_status === 'arrived'
                                            ? 'bg-emerald-400/20 text-emerald-100'
                                            : 'bg-white/15 text-blue-100'
                                            }`}>
                                            {nextPatient.patient_status === 'arrived' ? 'Arrived' : 'Waiting'}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-blue-200" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Today's Schedule */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <h2 className="font-semibold text-gray-800 text-sm">Today's Schedule</h2>
                                    <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {activeAppointments.length}
                                    </span>
                                </div>
                                <button onClick={() => navigate('/schedule')} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                    Full Schedule <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="min-h-[400px]">
                                {loadingAppointments ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                                        <p className="text-xs text-gray-400 font-medium">Loading schedule...</p>
                                    </div>
                                ) : activeAppointments.length > 0 ? (
                                    <div className="divide-y divide-gray-50">
                                        {activeAppointments.map((appt) => (
                                            <AppointmentRow key={appt.id} appt={appt} navigate={navigate} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                                            <Calendar className="w-7 h-7 text-gray-300" />
                                        </div>
                                        <p className="font-semibold text-gray-500 text-sm">No appointments today</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-[220px]">Your schedule is clear. Use the time to catch up on notes or review charts.</p>
                                        <button onClick={() => navigate('/schedule')} className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors">
                                            View Calendar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Clinical Action Panel */}
                    <div className="lg:col-span-4 space-y-5 sticky top-6">
                        {/* In-Basket Preview */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Inbox className="w-4 h-4 text-blue-600" />
                                    <h3 className="text-sm font-semibold text-gray-800">In Basket</h3>
                                    {inboxItems.length > 0 && (
                                        <span className="bg-rose-50 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{inboxItems.length}</span>
                                    )}
                                </div>
                                <button onClick={() => navigate('/tasks')} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 uppercase tracking-wider">
                                    View All
                                </button>
                            </div>
                            <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
                                {loadingInbox ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : inboxItems.length > 0 ? (
                                    inboxItems.slice(0, 5).map((item) => {
                                        const createdAt = new Date(item.created_at);
                                        const diffMs = new Date() - createdAt;
                                        const diffMins = Math.floor(diffMs / 60000);
                                        const timeStr = diffMins < 60 ? `${diffMins}m` :
                                            diffMins < 1440 ? `${Math.floor(diffMins / 60)}h` :
                                                `${Math.floor(diffMins / 1440)}d`;

                                        return (
                                            <button key={item.id} onClick={() => navigate(`/tasks?id=${item.id}`)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[10px] font-bold text-gray-400">{timeStr} ago</span>
                                                    {item.priority === 'stat' && <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">STAT</span>}
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 truncate">{item.patient_name || 'System'}</p>
                                                <p className="text-[11px] text-gray-500 truncate">{item.subject}</p>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-200 mb-2" />
                                        <p className="text-xs font-semibold text-emerald-600">All clear</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Clinical Actions */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-semibold text-gray-800">Quick Actions</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <QuickAction icon={Users} label="Patients" onClick={() => navigate('/patients')} />
                                <QuickAction icon={Calendar} label="Schedule" onClick={() => navigate('/schedule')} />
                                <QuickAction icon={FileText} label="Notes" onClick={() => navigate('/pending-notes')} />
                                <QuickAction icon={ClipboardList} label="Tasks" onClick={() => navigate('/tasks')} />
                            </div>
                        </div>

                        {/* Tomorrow Preview */}
                        {stats?.tomorrowCount > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-gray-400" />
                                        <span className="text-[11px] font-semibold text-gray-500">Tomorrow</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-gray-800">{stats.tomorrowCount}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">appointments</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ──────────── Sub-Components ────────────

const StatCard = ({ icon: Icon, label, value, color, onClick, urgent }) => {
    const colorMap = {
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500', border: 'border-rose-100', urgentBg: 'bg-rose-500' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500', border: 'border-amber-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500', border: 'border-blue-100' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500', border: 'border-indigo-100' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500', border: 'border-orange-100' },
        slate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'text-slate-400', border: 'border-slate-100' },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <button
            onClick={onClick}
            className={`bg-white p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm 
                        transition-all cursor-pointer text-left relative overflow-hidden group active:scale-95`}
        >
            {urgent && value > 0 && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
            <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-6 h-6 rounded-md ${c.bg} flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 ${c.icon}`} />
                </div>
            </div>
            <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
        </button>
    );
};

const FlowStage = ({ icon: Icon, label, count, color }) => {
    const colorMap = {
        slate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'text-slate-400' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
        gray: { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'text-gray-400' },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <div className={`${c.bg} rounded-lg p-2.5 text-center border border-transparent`}>
            <Icon className={`w-3.5 h-3.5 ${c.icon} mx-auto mb-1`} />
            <p className={`text-lg font-bold ${c.text} leading-none`}>{count}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
        </div>
    );
};

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
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/30 transition-colors cursor-pointer group ${isComplete ? 'opacity-50' : ''}`}
        >
            <div className="w-[52px] flex-shrink-0">
                <span className="text-xs font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded-lg">{appt.time?.substring(0, 5)}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold group-hover:text-blue-700 transition-colors ${isComplete ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {appt.patientName}
                    </span>
                    {appt.visit_method === 'telehealth' && (
                        <span className="bg-indigo-50 text-indigo-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Tele</span>
                    )}
                </div>
                <span className="text-[10px] text-gray-400 font-medium">{appt.type || 'Follow-up'} · {appt.duration || 30}m</span>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${s.bg} ${s.text}`}>
                {s.label}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left group active:scale-95"
    >
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-gray-100 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
            <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </div>
        <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-700">{label}</span>
    </button>
);

export default Dashboard;
