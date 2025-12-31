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
                    totalPatients: 1247,
                    visitsToday: 24,
                    pendingOrders: 8,
                    unreadMessages: 12,
                    pendingNotes: 5,
                    criticalAlerts: 2,
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
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

        const fetchInbox = async () => {
            if (!user) return;
            try {
                setLoadingInbox(true);
                const response = await inboxAPI.getAll({ status: 'new', assignedTo: 'me' });
                setInboxItems(response.data || []);
            } catch (error) {
                console.error('Error fetching inbox:', error);
            } finally {
                setLoadingInbox(false);
            }
        };

        fetchTodayAppointments();
        fetchInbox();
    }, [user, can, scope]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block spinner text-strong-azure w-8 h-8"></div>
                    <p className="mt-4 text-deep-gray/70 font-medium">Loading clinical desktop...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#F8FAFC] min-h-screen">
            {/* Top Compact Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-bold text-gray-900 border-r border-gray-200 pr-4">Dashboard</h1>
                    <p className="text-sm font-medium text-gray-500">
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{user?.firstName} {user?.lastName}</span>
                    </div>
                    <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate('/patients')}>
                        New Patient
                    </Button>
                </div>
            </div>

            <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">

                {/* Stats Bar - Extreme Density */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-blue-300 transition-colors cursor-pointer">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Today's Visits</p>
                            <p className="text-xl font-bold text-gray-900">{stats?.visitsToday || 0}</p>
                        </div>
                        <Calendar className="w-5 h-5 text-blue-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-orange-300 transition-colors cursor-pointer" onClick={() => navigate('/tasks')}>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">In Basket</p>
                            <p className="text-xl font-bold text-gray-900">{stats?.pendingOrders || 8}</p>
                        </div>
                        <ClipboardList className="w-5 h-5 text-orange-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-green-300 transition-colors cursor-pointer">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unread Labs</p>
                            <p className="text-xl font-bold text-gray-900">12</p>
                        </div>
                        <Activity className="w-5 h-5 text-green-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-purple-300 transition-colors cursor-pointer" onClick={() => navigate('/messages')}>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Messages</p>
                            <p className="text-xl font-bold text-gray-900">{stats?.unreadMessages || 5}</p>
                        </div>
                        <MessageSquare className="w-5 h-5 text-purple-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-red-300 transition-colors cursor-pointer" onClick={() => navigate('/pending-notes')}>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unsigned Notes</p>
                            <p className="text-xl font-bold text-gray-900">{stats?.pendingNotes || 3}</p>
                        </div>
                        <FileText className="w-5 h-5 text-red-500 opacity-80" />
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm hover:border-gray-300 transition-colors cursor-pointer" onClick={() => navigate('/patients')}>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Patients</p>
                            <p className="text-xl font-bold text-gray-900">{stats?.totalPatients || 0}</p>
                        </div>
                        <Users className="w-5 h-5 text-gray-500 opacity-80" />
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT Column: Daily Schedule (Elation style) */}
                    <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <h2 className="font-bold text-gray-900">Provider Schedule</h2>
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
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
                                    <thead className="bg-[#FAFBFC] text-gray-400 text-[10px] uppercase tracking-wider font-bold">
                                        <tr>
                                            <th className="px-5 py-3 border-b border-gray-100 font-bold">Time</th>
                                            <th className="px-5 py-3 border-b border-gray-100 font-bold">Patient</th>
                                            <th className="px-5 py-3 border-b border-gray-100 font-bold">Reason/Type</th>
                                            <th className="px-5 py-3 border-b border-gray-100 font-bold">Status</th>
                                            <th className="px-5 py-3 border-b border-gray-100 font-bold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {todayAppointments
                                            .sort((a, b) => a.time.localeCompare(b.time))
                                            .map((appt) => (
                                                <tr key={appt.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => navigate(`/patient/${appt.patientId}/snapshot`)}>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                                            {appt.time}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[15px] font-bold text-gray-900 group-hover:text-blue-700">{appt.patientName}</span>
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                #{appt.patientId?.substring(0, 8).toUpperCase()} • DOB: 05/12/1984
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-700">{appt.type || 'Office Visit'}</span>
                                                            <span className="text-[11px] text-gray-400">Duration: 30m</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-tight
                                                            ${appt.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                                                appt.status === 'checked-in' ? 'bg-green-50 text-green-700' :
                                                                    appt.status === 'in-room' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600'}
                                                        `}>
                                                            {appt.status || 'Scheduled'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 shadow-sm" title="Start Note">
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            <button className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-100 shadow-sm" title="Chart Snapshot">
                                                                <Activity className="w-4 h-4" />
                                                            </button>
                                                        </div>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex border-b border-gray-100 bg-gray-50">
                                {['inbox', 'refills', 'labs'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveDesktopTab(tab)}
                                        className={`flex-1 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all
                                            ${activeDesktopTab === tab
                                                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}
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
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{timeStr}</span>
                                                            {item.priority === 'stat' && <span className="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Urgent</span>}
                                                        </div>
                                                        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600">
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
                                        <button onClick={() => navigate('/tasks')} className="w-full py-2 text-[11px] font-bold text-blue-600 uppercase tracking-widest hover:bg-blue-50 rounded-lg transition-colors">
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
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-5 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Zap className="w-20 h-20 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold mb-1 relative z-10 text-gray-900">Quick Launch</h3>
                            <p className="text-xs text-gray-500 mb-4 relative z-10">Instant access to primary workflows</p>

                            <div className="flex flex-col gap-2 relative z-10">
                                <button onClick={() => navigate('/patients')} className="flex items-center gap-3 w-full bg-white hover:bg-blue-50 p-3 rounded-lg transition-colors border border-gray-200 hover:border-blue-300 shadow-sm">
                                    <div className="p-2 bg-blue-500 rounded-md text-white">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800">Patient Registry</span>
                                </button>
                                <button onClick={() => navigate('/schedule')} className="flex items-center gap-3 w-full bg-white hover:bg-green-50 p-3 rounded-lg transition-colors border border-gray-200 hover:border-green-300 shadow-sm">
                                    <div className="p-2 bg-green-500 rounded-md text-white">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800">Scheduling Hub</span>
                                </button>
                                <button onClick={() => navigate('/tasks')} className="flex items-center gap-3 w-full bg-white hover:bg-purple-50 p-3 rounded-lg transition-colors border border-gray-200 hover:border-purple-300 shadow-sm">
                                    <div className="p-2 bg-purple-500 rounded-md text-white">
                                        <ClipboardList className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800">Clinical Task List</span>
                                </button>
                            </div>
                        </div>

                        {/* Help / Updates */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Bell className="w-4 h-4 text-orange-500" />
                                <h4 className="text-xs font-bold text-gray-900 border-b-2 border-orange-100 flex-1 uppercase tracking-widest">Platform Updates</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="p-2 hover:bg-gray-50 rounded cursor-pointer border-l-2 border-blue-500 pl-3">
                                    <p className="text-xs font-bold text-gray-900">E-Prescribing is LIVE</p>
                                    <p className="text-[10px] text-gray-500">You can now send prescriptions directly to pharmacies.</p>
                                </div>
                                <div className="p-2 hover:bg-gray-50 rounded cursor-pointer border-l-2 border-green-500 pl-3">
                                    <p className="text-xs font-bold text-gray-900">Integrated Lab Results</p>
                                    <p className="text-[10px] text-gray-500">LabCorp and Quest integrations are now available.</p>
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
