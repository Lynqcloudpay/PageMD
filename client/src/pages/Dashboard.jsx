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
        {
            title: 'In Basket',
            value: stats?.pendingOrders || 0,
            icon: ClipboardList,
            color: 'warning',
            trend: '3 new',
            link: '/tasks',
        },
        {
            title: 'Messages',
            value: stats?.unreadMessages || 0,
            icon: MessageSquare,
            color: 'primary',
            trend: '2 urgent',
            link: '/messages',
        },
    ];

    const quickActions = [
        { icon: Plus, label: 'New Patient', action: () => navigate('/patients'), color: 'primary' },
        { icon: Calendar, label: 'Schedule', action: () => navigate('/schedule'), color: 'success' },
        { icon: FileText, label: 'New Note', action: () => navigate('/pending-notes'), color: 'primary' },
        { icon: Video, label: 'Telehealth', action: () => navigate('/telehealth'), color: 'primary' },
    ];

    return (
        <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-deep-gray mb-2">
                        Welcome back, {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.lastName || 'Doctor'}!
                    </h1>
                    <p className="text-deep-gray/70">
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" icon={BarChart3} onClick={() => navigate('/analytics')}>
                        View Analytics
                    </Button>
                    <Button variant="primary" icon={Plus} onClick={() => navigate('/patients')}>
                        New Patient
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, idx) => {
                    const Icon = stat.icon;
                    const colorClasses = {
                        primary: 'bg-strong-azure/10 text-strong-azure',
                        success: 'bg-fresh-green/10 text-fresh-green',
                        warning: 'bg-yellow-100 text-yellow-700',
                        error: 'bg-red-100 text-red-700',
                    };
                    
                    return (
                        <Card 
                            key={idx} 
                            hover 
                            onClick={() => stat.link && navigate(stat.link)}
                            className="cursor-pointer group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-deep-gray/70 mb-1">
                                        {stat.title}
                                    </p>
                                    <p className="text-3xl font-bold text-deep-gray mb-2">
                                        {stat.value}
                                    </p>
                                    {stat.trend && (
                                        <div className="flex items-center space-x-1 text-xs text-deep-gray/70">
                                            <TrendingUp className="w-3 h-3" />
                                            <span>{stat.trend}</span>
                                        </div>
                                    )}
                                </div>
                                <div className={`p-3 rounded-xl ${colorClasses[stat.color]}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-deep-gray/10 flex items-center text-xs text-strong-azure group-hover:text-strong-azure/80">
                                <span>View details</span>
                                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today's Schedule */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Today's Schedule</CardTitle>
                                    <CardDescription>
                                        {format(new Date(), 'MMMM d, yyyy')} • {todayAppointments.length} appointments
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/schedule')}>
                                    View All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingAppointments ? (
                                <div className="text-center py-12">
                                    <div className="inline-block spinner text-strong-azure"></div>
                                    <p className="mt-4 text-sm text-deep-gray/70">Loading appointments...</p>
                                </div>
                            ) : todayAppointments.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {todayAppointments
                                        .sort((a, b) => a.time.localeCompare(b.time))
                                        .map((appt) => (
                                            <div
                                                key={appt.id}
                                                onClick={() => navigate(`/patient/${appt.patientId}/snapshot`)}
                                                className="flex items-center justify-between p-4 bg-soft-gray hover:bg-white rounded-lg cursor-pointer transition-all border border-deep-gray/10 hover:border-strong-azure/30 hover-lift group"
                                            >
                                                <div className="flex items-center space-x-4 flex-1 min-w-0">
                                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-strong-azure/10 flex items-center justify-center">
                                                        <Clock className="w-5 h-5 text-strong-azure" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-deep-gray truncate group-hover:text-strong-azure transition-colors">
                                                            {appt.patientName}
                                                        </div>
                                                        <div className="flex items-center space-x-3 text-xs text-deep-gray/70 mt-1">
                                                            <span className="flex items-center">
                                                                <Clock className="w-3 h-3 mr-1" />
                                                                {appt.time}
                                                            </span>
                                                            <span className="flex items-center">
                                                                <User className="w-3 h-3 mr-1" />
                                                                {appt.type}
                                                            </span>
                                                            {appt.duration && (
                                                                <span>{appt.duration}m</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-5 h-5 text-deep-gray/40 group-hover:text-strong-azure transition-colors" />
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 mx-auto mb-4 text-deep-gray/30" />
                                    <p className="text-deep-gray/70 mb-2">No appointments scheduled for today</p>
                                    <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
                                        View Schedule
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions & Alerts */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                            <CardDescription>Common tasks and shortcuts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {quickActions.map((action, idx) => {
                                    const Icon = action.icon;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={action.action}
                                            className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover-lift group"
                                        >
                                            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 mb-2 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/40 transition-colors">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 text-center">
                                                {action.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alerts & Notifications */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Alerts</CardTitle>
                                {stats?.criticalAlerts > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-full">
                                        {stats.criticalAlerts} critical
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats?.pendingNotes > 0 && (
                                    <div className="flex items-start space-x-3 p-3 bg-warning-50 dark:bg-warning-900/10 rounded-lg border border-warning-200 dark:border-warning-800">
                                        <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-warning-900 dark:text-warning-100">
                                                {stats.pendingNotes} unsigned notes
                                            </p>
                                            <button 
                                                onClick={() => navigate('/pending-notes')}
                                                className="text-xs text-warning-700 dark:text-warning-300 hover:underline mt-1"
                                            >
                                                Review now →
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {stats?.unreadMessages > 0 && (
                                    <div className="flex items-start space-x-3 p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800">
                                        <MessageSquare className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
                                                {stats.unreadMessages} unread messages
                                            </p>
                                            <button 
                                                onClick={() => navigate('/messages')}
                                                className="text-xs text-primary-700 dark:text-primary-300 hover:underline mt-1"
                                            >
                                                View messages →
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {(!stats?.pendingNotes && !stats?.unreadMessages) && (
                                    <div className="text-center py-4">
                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success-500" />
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">All caught up!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
