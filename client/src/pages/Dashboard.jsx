import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, AlertCircle, TrendingUp, Activity, Clock, User,
    ArrowRight, Plus, MessageSquare, ClipboardList, Zap, BarChart3,
    Video, Bell, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { reportsAPI, appointmentsAPI } from '../services/api';
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
            // Only fetch if user has schedule:view permission
            if (!user || !can('schedule:view')) {
                setLoadingAppointments(false);
                return;
            }
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const params = { date: today };

                // If SELF scope, only show user's own appointments
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
        fetchTodayAppointments();
    }, [user, can, scope]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block spinner text-strong-azure w-8 h-8"></div>
                    <p className="mt-4 text-deep-gray/70">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            title: 'Total Patients',
            value: stats?.totalPatients || 0,
            icon: Users,
            color: 'primary',
            trend: '+12%',
            link: '/patients',
        },
        {
            title: 'Visits Today',
            value: stats?.visitsToday || 0,
            icon: Calendar,
            color: 'success',
            trend: '+5',
            link: '/schedule',
        },
        // {
        //     title: 'In Basket',
        //     value: stats?.pendingOrders || 0,
        //     icon: ClipboardList,
        //     color: 'warning',
        //     trend: '3 new',
        //     link: '/tasks',
        // },
        // {
        //     title: 'Messages',
        //     value: stats?.unreadMessages || 0,
        //     icon: MessageSquare,
        //     color: 'primary',
        //     trend: '2 urgent',
        //     link: '/messages',
        // },
    ];

    const quickActions = [
        { icon: Plus, label: 'New Patient', action: () => navigate('/patients'), color: 'primary' },
        { icon: Calendar, label: 'Schedule', action: () => navigate('/schedule'), color: 'success' },
        { icon: FileText, label: 'New Note', action: () => navigate('/pending-notes'), color: 'primary' },
        { icon: Video, label: 'Telehealth', action: () => navigate('/telehealth'), color: 'primary' },
    ];

    return (
        <div className="w-full p-8 lg:p-12 space-y-12 animate-fade-in max-w-[1600px] mx-auto">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                        Dashboard <span className="text-slate-200">/</span> Overview
                    </h1>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="p-3 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-50">
                            <Calendar className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Current Session</p>
                            <p className="text-sm font-bold text-slate-600">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/patients')}
                        className="frothy-btn-primary"
                    >
                        <Plus className="w-4 h-4" /> Register Patient
                    </button>
                    <button
                        onClick={() => navigate('/schedule')}
                        className="frothy-btn-secondary"
                    >
                        <Calendar className="w-4 h-4" /> Full Schedule
                    </button>
                </div>
            </div>

            {/* Performance Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            onClick={() => stat.link && navigate(stat.link)}
                            className="frothy-card p-8 cursor-pointer group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <p className="frothy-label mb-6">{stat.title}</p>
                                <div className="flex items-end justify-between">
                                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{stat.value}</h2>
                                    {stat.trend && (
                                        <div className="px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-black rounded-lg border border-primary-100 uppercase tracking-widest">
                                            {stat.trend}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Visual Back-blob */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-50/50 transition-colors"></div>
                        </div>
                    );
                })}
            </div>

            {/* Tactical View Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Deployment Manifest - Today's Appts */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase tracking-widest text-[14px]">Tactical Engagement Schedule</h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{todayAppointments.length} Active Records</span>
                    </div>

                    <div className="space-y-3">
                        {loadingAppointments ? (
                            <div className="frothy-card p-20 text-center">
                                <div className="spinner text-primary-500 w-8 h-8 mx-auto"></div>
                            </div>
                        ) : todayAppointments.length > 0 ? (
                            todayAppointments
                                .sort((a, b) => a.time.localeCompare(b.time))
                                .map((appt) => (
                                    <div
                                        key={appt.id}
                                        onClick={() => navigate(`/patient/${appt.patientId}/snapshot`)}
                                        className="frothy-card p-6 flex items-center justify-between group/item hover:border-primary-200"
                                    >
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex flex-col items-center justify-center border border-slate-100 group-hover/item:bg-white group-hover/item:shadow-lg transition-all shrink-0">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{appt.time.split(' ')[1]}</span>
                                                <span className="text-lg font-black text-slate-900 tracking-tighter leading-tight">{appt.time.split(' ')[0]}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xl font-black text-slate-900 tracking-tight group-hover/item:text-primary-600 transition-colors truncate">
                                                    {appt.patientName}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <Activity className="w-3 h-3 text-primary-400" /> {appt.type}
                                                    </div>
                                                    <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-tight">
                                                        {appt.duration || '20'} MINS
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all">
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-200 group-hover/item:text-primary-400 group-hover/item:translate-x-1 transition-all">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="frothy-card p-20 text-center">
                                <Calendar className="w-12 h-12 mx-auto mb-6 text-slate-100" />
                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Zero Deployments</h4>
                                <p className="text-sm font-bold text-slate-400">Registry clear for the current observation period.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Alerts & Quick Commands */}
                <div className="space-y-8">
                    {/* Security & Action Grid */}
                    <div className="frothy-card p-8">
                        <p className="frothy-label mb-6">Rapid Commands</p>
                        <div className="grid grid-cols-2 gap-4">
                            {quickActions.map((action, idx) => {
                                const Icon = action.icon;
                                return (
                                    <button
                                        key={idx}
                                        onClick={action.action}
                                        className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:border-primary-100 transition-all group active:scale-95"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform mb-4 border border-slate-50">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                            {action.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Threat / Status Center */}
                    <div className="frothy-card p-8 border-l-4 border-l-primary-500">
                        <div className="flex items-center justify-between mb-8">
                            <p className="frothy-label">Task Status Center</p>
                            {stats?.criticalAlerts > 0 && (
                                <span className="animate-pulse px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg border border-rose-100 uppercase tracking-widest">
                                    {stats.criticalAlerts} Critical
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {stats?.pendingNotes > 0 ? (
                                <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-200/50 flex items-start gap-4 group cursor-pointer hover:bg-amber-100 transition-colors"
                                    onClick={() => navigate('/pending-notes')}>
                                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-50 shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-black text-amber-900 tracking-tight leading-tight mb-0.5">Note Finalization Required</p>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{stats.pendingNotes} Pending Signatures</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                    <CheckCircle2 className="w-10 h-10 text-primary-200 mx-auto mb-4" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations Standardized</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
