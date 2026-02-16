import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, AlertCircle, TrendingUp, Activity, Clock, User,
    ArrowRight, Plus, MessageSquare, ClipboardList, Zap, BarChart3,
    Video, Bell, CheckCircle2, XCircle, AlertTriangle, Pill
} from 'lucide-react';
import { reportsAPI, appointmentsAPI, inboxAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { format } from 'date-fns';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';


const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { can, getScope } = usePermissions();
    const scope = getScope();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [activeDesktopTab, setActiveDesktopTab] = useState('inbox');
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
                    totalPatients: 0,
                    visitsToday: 0,
                    pendingOrders: 0,
                    unreadMessages: 0,
                    pendingNotes: 0,
                    criticalAlerts: 0,
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        // Poll stats every 2s
        const interval = setInterval(fetchStats, 2000);
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

        // POLL every 2s
        const interval = setInterval(() => {
            fetchTodayAppointments();
            fetchInbox(true); // Silent refresh
        }, 2000);

        return () => clearInterval(interval);
    }, [user, can, scope]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block spinner text-[#83A2DB] w-8 h-8"></div>
                    <p className="mt-4 text-[#10141A]/60 font-light">Loading clinical desktop...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#F5F5F5] min-h-screen">
            {/* Top Compact Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-[#E4E4E4] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-semibold text-[#10141A] border-r border-[#E4E4E4] pr-4">Dashboard</h1>
                    <p className="text-sm font-light text-[#10141A]/50">
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#83A2DB]/10 text-[#83A2DB] rounded-full border border-[#83A2DB]/20">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{user?.firstName} {user?.lastName}</span>
                    </div>
                    <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate('/patients')}>
                        New Patient
                    </Button>
                </div>
            </div>

            <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">

                {/* Stats Bar - Extreme Density */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer">
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Today's Visits</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.visitsToday || 0}</p>
                        </div>
                        <Calendar className="w-5 h-5 text-blue-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/tasks')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">In Basket</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.pendingOrders || 0}</p>
                        </div>
                        <ClipboardList className="w-5 h-5 text-orange-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/tasks')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Unread Labs</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.unreadLabs || 0}</p>
                        </div>
                        <Activity className="w-5 h-5 text-green-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/messages')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Messages</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.unreadMessages || 0}</p>
                        </div>
                        <MessageSquare className="w-5 h-5 text-purple-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/pending-notes')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Unsigned Notes</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.pendingNotes || 0}</p>
                        </div>
                        <FileText className="w-5 h-5 text-red-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/cancellations')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Cancellations</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.cancellationFollowups || 0}</p>
                        </div>
                        <XCircle className="w-5 h-5 text-amber-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#E4E4E4] flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#83A2DB]/40 transition-colors cursor-pointer" onClick={() => navigate('/patients')}>
                        <div>
                            <p className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-wider">Total Patients</p>
                            <p className="text-xl font-semibold text-[#10141A]">{stats?.totalPatients || 0}</p>
                        </div>
                        <Users className="w-5 h-5 text-gray-500 opacity-80" />
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT Column: Daily Schedule (Elation style) */}
                    <div className="lg:col-span-8 bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border border-[#E4E4E4] overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#E4E4E4] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[#83A2DB]" />
                                <h2 className="font-medium text-[#10141A]">Provider Schedule</h2>
                                <span className="bg-[#83A2DB]/10 text-[#83A2DB] text-xs px-2 py-0.5 rounded-full font-medium">
                                    {todayAppointments.length} Appointments
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/schedule')}>
                                    Full Schedule
                                </Button>
                            </div>
                        </div>

                        <div className="min-h-[600px]">
                            {loadingAppointments ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="spinner text-blue-600 w-8 h-8 mb-4"></div>
                                    <p className="text-sm text-gray-500">Retrieving appointments...</p>
                                </div>
                            ) : todayAppointments.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#F5F5F5] text-[#10141A]/40 text-[10px] uppercase tracking-wider font-medium">
                                        <tr>
                                            <th className="px-5 py-2 border-b border-[#E4E4E4] font-medium">Time</th>
                                            <th className="px-5 py-2 border-b border-[#E4E4E4] font-medium">Patient</th>
                                            <th className="px-5 py-2 border-b border-[#E4E4E4] font-medium">Reason/Type</th>
                                            <th className="px-5 py-2 border-b border-[#E4E4E4] font-medium">Status</th>
                                            <th className="px-5 py-2 border-b border-[#E4E4E4] font-medium">Provider</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {todayAppointments
                                            .sort((a, b) => a.time.localeCompare(b.time))
                                            .map((appt) => (
                                                <tr key={appt.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => navigate(`/patient/${appt.patientId}/snapshot`)}>
                                                    <td className="px-5 py-2 whitespace-nowrap">
                                                        <span className="text-xs font-medium text-[#10141A] bg-[#F5F5F5] px-2 py-0.5 rounded">
                                                            {appt.time}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-[#10141A] group-hover:text-[#83A2DB]">{appt.patientName}</span>
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                #{appt.patientId?.substring(0, 8).toUpperCase()} • {appt.patient_dob ? format(new Date(appt.patient_dob), 'MM/dd/yyyy') : 'DOB: Unknown'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium text-gray-700">{appt.type || 'Office Visit'}</span>
                                                            <span className="text-[10px] text-gray-400">Duration: {appt.duration || 30}m</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-tight
                                                            ${appt.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                                                appt.status === 'checked-in' ? 'bg-green-50 text-green-700' :
                                                                    appt.status === 'in-room' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600'}
                                                        `}>
                                                            {appt.status || 'Scheduled'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-2">
                                                        <span className="text-xs font-semibold text-gray-600 italic">
                                                            {appt.providerName || 'Staff'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                        <Calendar className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-semibold text-gray-500">No appointments for today</p>
                                    <p className="text-sm max-w-[200px] mt-1">Ready to manage your practice? Start by scheduling a patient.</p>
                                    <Button variant="outline" size="sm" className="mt-6" onClick={() => navigate('/schedule')}>View Full Calendar</Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT Column: Clinical Desktop (Tabbed In-Basket) */}
                    <div className="lg:col-span-4 space-y-6 sticky top-20">
                        {/* Tabbed In-Basket */}
                        <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border border-[#E4E4E4] overflow-hidden">
                            <div className="flex border-b border-[#E4E4E4]">
                                {['inbox', 'refills', 'labs'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveDesktopTab(tab)}
                                        className={`flex-1 px-4 py-3 text-[11px] font-medium uppercase tracking-widest transition-all
                                            ${activeDesktopTab === tab
                                                ? 'bg-white text-[#83A2DB] border-b-2 border-[#83A2DB]'
                                                : 'text-[#10141A]/40 hover:text-[#10141A]/60'}
                                        `}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 min-h-[300px]">
                                {activeDesktopTab === 'inbox' && (
                                    <div className="space-y-3">
                                        {loadingInbox ? (
                                            <div className="flex flex-col items-center justify-center py-10">
                                                <div className="spinner text-blue-600 w-6 h-6 mb-2"></div>
                                                <p className="text-xs text-gray-500">Loading inbox...</p>
                                            </div>
                                        ) : inboxItems.length > 0 ? (
                                            inboxItems.slice(0, 5).map((item, i) => {
                                                // Calculate time ago
                                                const createdAt = new Date(item.created_at);
                                                const diffMs = new Date() - createdAt;
                                                const diffMins = Math.floor(diffMs / 60000);
                                                const timeStr = diffMins < 60 ? `${diffMins}m ago` :
                                                    diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago` :
                                                        `${Math.floor(diffMins / 1440)}d ago`;

                                                return (
                                                    <div key={item.id} className="p-3 bg-white border border-gray-100 rounded-lg hover:border-blue-200 cursor-pointer shadow-sm group" onClick={() => navigate(`/tasks?id=${item.id}`)}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-medium text-[#10141A]/40 uppercase tracking-tighter">{timeStr}</span>
                                                            {item.priority === 'stat' && <span className="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Urgent</span>}
                                                        </div>
                                                        <p className="text-sm font-medium text-[#10141A] group-hover:text-[#83A2DB]">
                                                            {item.patient_name || 'System'}
                                                        </p>
                                                        <p className="text-xs text-gray-600 truncate">{item.subject}</p>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                                                <Bell className="w-8 h-8 opacity-20 mb-2" />
                                                <p className="text-xs font-semibold">Inbox is clear</p>
                                            </div>
                                        )}
                                        <button onClick={() => navigate('/tasks')} className="w-full py-2 text-[11px] font-medium text-[#83A2DB] uppercase tracking-widest hover:bg-[#83A2DB]/5 rounded-lg transition-colors">
                                            View Full Inbox →
                                        </button>
                                    </div>
                                )}

                                {activeDesktopTab === 'refills' && (
                                    <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                                        <Pill className="w-8 h-8 opacity-20 mb-2" />
                                        <p className="text-xs font-semibold">No pending refill requests</p>
                                    </div>
                                )}

                                {activeDesktopTab === 'labs' && (
                                    <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                                        <Activity className="w-8 h-8 opacity-20 mb-2" />
                                        <p className="text-xs font-semibold">No unread lab results</p>
                                    </div>
                                )}
                            </div>
                        </div>



                        {/* Quick Start Card - Light Theme */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border border-[#E4E4E4] p-5 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Zap className="w-20 h-20 text-[#83A2DB]" />
                            </div>
                            <h3 className="text-lg font-medium mb-1 relative z-10 text-[#10141A]">Quick Launch</h3>
                            <p className="text-xs text-gray-500 mb-4 relative z-10">Instant access to primary workflows</p>

                            <div className="flex flex-col gap-2 relative z-10">
                                <button onClick={() => navigate('/patients')} className="flex items-center gap-3 w-full bg-white hover:bg-[#83A2DB]/5 p-3 rounded-lg transition-colors border border-[#E4E4E4] hover:border-[#83A2DB]/30 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
                                    <div className="p-2 bg-[#83A2DB] rounded-md text-white">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-[#10141A]">Patient Registry</span>
                                </button>
                                <button onClick={() => navigate('/schedule')} className="flex items-center gap-3 w-full bg-white hover:bg-[#83A2DB]/5 p-3 rounded-lg transition-colors border border-[#E4E4E4] hover:border-[#83A2DB]/30 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
                                    <div className="p-2 bg-[#83A2DB] rounded-md text-white">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-[#10141A]">Scheduling Hub</span>
                                </button>
                                <button onClick={() => navigate('/tasks')} className="flex items-center gap-3 w-full bg-white hover:bg-[#83A2DB]/5 p-3 rounded-lg transition-colors border border-[#E4E4E4] hover:border-[#83A2DB]/30 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
                                    <div className="p-2 bg-[#83A2DB] rounded-md text-white">
                                        <ClipboardList className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-[#10141A]">Clinical Task List</span>
                                </button>
                            </div>
                        </div>

                        {/* Help / Updates */}
                        <div className="bg-white rounded-xl border border-[#E4E4E4] p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Bell className="w-4 h-4 text-[#CE6969]" />
                                <h4 className="text-xs font-medium text-[#10141A] border-b border-[#E4E4E4] flex-1 uppercase tracking-widest">Platform Updates</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="p-2 hover:bg-gray-50 rounded cursor-pointer border-l-2 border-blue-500 pl-3">
                                    <p className="text-xs font-medium text-[#10141A]">E-Prescribing is LIVE</p>
                                    <p className="text-[10px] text-[#10141A]/50">You can now send prescriptions directly to pharmacies.</p>
                                </div>
                                <div className="p-2 hover:bg-gray-50 rounded cursor-pointer border-l-2 border-green-500 pl-3">
                                    <p className="text-xs font-medium text-[#10141A]">Integrated Lab Results</p>
                                    <p className="text-[10px] text-[#10141A]/50">LabCorp and Quest integrations are now available.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
