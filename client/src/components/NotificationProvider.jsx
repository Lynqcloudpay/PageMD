import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Heart, Info } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback((notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        const {
            title,
            message,
            type = 'info',
            severity = 'info',
            duration = 5000,
            icon: CustomIcon
        } = notification;

        const newNotification = {
            id,
            title,
            message,
            type,
            severity,
            duration,
            icon: CustomIcon
        };

        setNotifications(prev => [...prev, newNotification]);

        if (duration !== Infinity) {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const getIcon = (severity, type) => {
        if (severity === 'critical') return <AlertTriangle className="text-red-600" size={24} />;
        if (severity === 'warn') return <AlertTriangle className="text-orange-500" size={24} />;
        if (type === 'success') return <CheckCircle className="text-emerald-500" size={24} />;
        if (type === 'error') return <AlertCircle className="text-red-500" size={24} />;
        return <Info className="text-blue-500" size={24} />;
    };

    const getColors = (severity, type) => {
        if (severity === 'critical') return 'bg-red-50 border-red-200 text-red-900 shadow-red-100';
        if (severity === 'warn') return 'bg-orange-50 border-orange-200 text-orange-900 shadow-orange-100';
        if (type === 'success') return 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100';
        return 'bg-white border-slate-200 text-slate-900 shadow-slate-100';
    };

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}

            {/* Notification Toast Container */}
            <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 min-w-[320px] max-w-[420px]">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`
                            group relative p-4 rounded-2xl border shadow-xl flex gap-3 
                            animate-in slide-in-from-right-full duration-300
                            ${getColors(notification.severity, notification.type)}
                        `}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {notification.icon ? <notification.icon size={24} /> : getIcon(notification.severity, notification.type)}
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                            {notification.title && (
                                <h4 className="font-black text-xs uppercase tracking-widest mb-1 leading-none opacity-80">
                                    {notification.title}
                                </h4>
                            )}
                            <p className="text-sm font-semibold leading-snug">
                                {notification.message}
                            </p>
                        </div>

                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="absolute top-3 right-3 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
