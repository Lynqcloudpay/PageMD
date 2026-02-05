import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, TrendingDown, AlertTriangle, ChevronRight, Check, Info, Lock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AlertBell = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const dropdownRef = useRef(null);

    // Only show for admins
    const isAdmin = user?.isAdmin || user?.role === 'admin';

    const fetchAlerts = async () => {
        if (!isAdmin) return;
        try {
            setLoading(true);
            setError(null);
            const response = await notificationsAPI.getAll();
            console.log('[AlertBell] API response:', response.data);
            setAlerts(response.data?.alerts || []);
        } catch (err) {
            console.error('[AlertBell] Failed to fetch alerts:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        // Refresh every 60 seconds
        const interval = setInterval(fetchAlerts, 60000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isAdmin) return null;

    const alertCount = alerts.length;
    const hasWarnings = alerts.some(a => a.severity === 'warning');

    const handleAlertClick = (alert) => {
        if (alert.actionUrl) {
            navigate(alert.actionUrl);
        }
        setShowDropdown(false);
    };

    const handleDismiss = async (e, alertId) => {
        e.stopPropagation(); // Prevent navigation
        try {
            await notificationsAPI.dismiss(alertId);
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (err) {
            console.error('Failed to dismiss alert:', err);
        }
    };

    const handleDismissAll = async () => {
        try {
            await notificationsAPI.dismissAll(alerts.map(a => a.id));
            setAlerts([]);
        } catch (err) {
            console.error('Failed to dismiss all alerts:', err);
        }
    };

    const getAlertIcon = (type) => {
        switch (type) {
            case 'success':
            case 'growth':
                return <TrendingDown className="w-4 h-4 rotate-180" />; // Up trend
            case 'churn':
            case 'expiring':
                return <TrendingDown className="w-4 h-4" />;
            case 'system':
            case 'info':
                return <Info className="w-4 h-4" />;
            case 'security':
                return <Lock className="w-4 h-4" />;
            case 'billing':
                return <CreditCard className="w-4 h-4" />;
            default:
                return <AlertTriangle className="w-4 h-4" />;
        }
    };

    const getAlertColor = (severity) => {
        switch (severity) {
            case 'success':
                return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'warning':
                return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'error':
                return 'text-red-600 bg-red-50 border-red-200';
            case 'info':
            default:
                return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`relative p-2 rounded-lg transition-all ${alertCount > 0
                    ? 'text-amber-600 hover:bg-amber-50'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
            >
                <Bell className="w-5 h-5" />
                {alertCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full border-2 border-white ${hasWarnings ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                        {alertCount > 9 ? '9+' : alertCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                            {alertCount > 0 && (
                                <button
                                    onClick={handleDismissAll}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider px-2 py-0.5 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                                >
                                    Dismiss All
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowDropdown(false)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading && alerts.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">
                                Loading...
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="p-6 text-center">
                                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">No notifications</p>
                                <p className="text-slate-400 text-xs mt-1">You're all caught up!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors group relative"
                                        onClick={() => handleAlertClick(alert)}
                                    >
                                        <div className="absolute top-2 right-2 flex items-center gap-1">
                                            {alert.dismissible !== false && (
                                                <button
                                                    onClick={(e) => handleDismiss(e, alert.id)}
                                                    className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    title="Dismiss"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${getAlertColor(alert.severity)}`}>
                                                {getAlertIcon(alert.type)}
                                            </div>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="font-semibold text-slate-800 text-sm mb-0.5">
                                                    {alert.title}
                                                </p>
                                                <p className="text-slate-500 text-xs leading-relaxed">
                                                    {alert.message}
                                                </p>
                                                {alert.actionLabel && (
                                                    <span className={`inline-flex items-center gap-1 mt-2 text-xs font-medium group-hover:underline ${alert.severity === 'success' ? 'text-emerald-600' : 'text-primary-600'
                                                        }`}>
                                                        {alert.actionLabel}
                                                        <ChevronRight className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertBell;
