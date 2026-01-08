import React, { useState, useEffect } from 'react';
import {
    Shield, FileText, AlertTriangle, Search, Filter, Download,
    CheckCircle, Clock, User, Link as LinkIcon, ChevronRight,
    ShieldAlert, ShieldCheck, Calendar, Activity, Lock, Eye
} from 'lucide-react';
import { complianceAPI, usersAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';

const Compliance = () => {
    const [activeTab, setActiveTab] = useState('logs');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        userId: '',
        patientId: '',
        accessType: '',
        unresolvedOnly: true
    });
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        totalOpens: 0,
        restrictedOpens: 0,
        activeAlerts: 0,
        breakGlasses: 0
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'alerts') fetchAlerts();
    }, [activeTab, filters]);

    const fetchInitialData = async () => {
        try {
            const uRes = await usersAPI.getAll();
            setUsers(uRes.data || []);
            // Pre-fetch alerts count for badge
            const aRes = await complianceAPI.getAlerts({ unresolvedOnly: true });
            setAlerts(aRes.data || []);
            setStats(prev => ({ ...prev, activeAlerts: aRes.data?.length || 0 }));
        } catch (err) {
            console.error('Failed to fetch reference data:', err);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await complianceAPI.getLogs(filters);
            setData(res.data || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await complianceAPI.getAlerts({ unresolvedOnly: filters.unresolvedOnly });
            setAlerts(res.data || []);
            if (filters.unresolvedOnly) {
                setStats(prev => ({ ...prev, activeAlerts: res.data?.length || 0 }));
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveAlert = async (id) => {
        const note = window.prompt('Provide a resolution note:');
        if (note === null) return;

        try {
            await complianceAPI.resolveAlert(id, note);
            fetchAlerts();
        } catch (err) {
            alert('Failed to resolve alert');
        }
    };

    const exportCSV = () => {
        if (!data.length) return;

        const headers = ['Date', 'User', 'Role', 'Patient', 'Action', 'Restricted', 'Break Glass', 'IP'];
        const rows = data.map(l => [
            format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
            `${l.user_first_name} ${l.user_last_name}`,
            l.user_role,
            `${l.patient_first_name} ${l.patient_last_name}`,
            l.access_type,
            l.is_restricted ? 'YES' : 'NO',
            l.break_glass_used ? 'YES' : 'NO',
            l.ip_address
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_log_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const tabs = [
        { id: 'logs', label: 'Access Audit Logs', icon: FileText },
        { id: 'alerts', label: 'Privacy Alerts', icon: AlertTriangle, badge: stats.activeAlerts > 0 ? stats.activeAlerts : null },
        { id: 'reports', label: 'Compliance Reports', icon: ShieldCheck }
    ];

    return (
        <div className="min-h-screen bg-slate-50/50 p-8 pt-20">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <Shield className="text-white w-6 h-6" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Compliance & Audit</h1>
                        </div>
                        <p className="text-slate-500 font-medium ml-1">Monitor chart access and manage privacy alerts for HIPAA compliance.</p>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                    >
                        <Download size={18} />
                        Export Audit Data
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                {[
                    { label: 'Total Chart Access', value: data.length, icon: Eye, color: 'blue' },
                    { label: 'Restricted Access', value: data.filter(l => l.is_restricted).length, icon: Lock, color: 'orange' },
                    { label: 'Break Glass Events', value: data.filter(l => l.break_glass_used).length, icon: ShieldAlert, color: 'red' },
                    { label: 'Pending Alerts', value: stats.activeAlerts, icon: AlertTriangle, color: 'amber' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-5">
                        <div className={`w-14 h-14 bg-${stat.color}-500/10 rounded-2xl flex items-center justify-center`}>
                            <stat.icon className={`text-${stat.color}-600 w-7 h-7`} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</div>
                            <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Card */}
            <div className="max-w-7xl mx-auto bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-100 px-8 bg-slate-50/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-8 py-6 text-sm font-black transition-all border-b-4 relative ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                            {tab.badge && (
                                <span className="ml-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-red-200">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Filters Bar */}
                <div className="p-6 border-b border-slate-50 bg-white flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                        <span className="text-slate-300 mx-1">-</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                        <User size={14} className="text-slate-400" />
                        <select
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none min-w-[120px]"
                            value={filters.userId}
                            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                        >
                            <option value="">All Users</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                        <Eye size={14} className="text-slate-400" />
                        <select
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none min-w-[120px]"
                            value={filters.accessType}
                            onChange={(e) => setFilters({ ...filters, accessType: e.target.value })}
                        >
                            <option value="">All Actions</option>
                            <option value="CHART_OPEN">Chart Open</option>
                            <option value="DOCUMENT_VIEW">Document View</option>
                            <option value="RESULT_VIEW">Result View</option>
                            <option value="CHART_EDIT">Chart Edit</option>
                        </select>
                    </div>

                    {activeTab === 'alerts' && (
                        <label className="flex items-center gap-2 cursor-pointer ml-auto">
                            <input
                                type="checkbox"
                                checked={filters.unresolvedOnly}
                                onChange={(e) => setFilters({ ...filters, unresolvedOnly: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-xs font-bold text-slate-600">Unresolved Only</span>
                        </label>
                    )}
                </div>

                {/* Data List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="font-bold">Loading compliance data...</p>
                        </div>
                    ) : activeTab === 'logs' ? (
                        <div className="space-y-3">
                            {data.map((log) => (
                                <div key={log.id} className="group hover:bg-slate-50 border border-slate-100 rounded-xl p-4 transition-all flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                        {log.is_restricted ? <Lock className="w-5 h-5 text-red-500" /> : <Eye className="w-5 h-5 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-slate-900 truncate">
                                                {log.user_first_name} {log.user_last_name}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black text-slate-400 uppercase rounded tracking-wider">
                                                {log.user_role}
                                            </span>
                                            <span className="text-slate-300 font-light mx-1">•</span>
                                            <span className="text-xs font-bold text-blue-600/80">
                                                {log.access_type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5 min-w-[200px]">
                                                <User size={12} className="text-slate-300" />
                                                Patient: <span className="text-slate-700 font-bold">{log.patient_first_name} {log.patient_last_name}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={12} className="text-slate-300" />
                                                {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                            </span>
                                            <span className="flex items-center gap-1.5 ml-auto">
                                                <Activity size={12} className="text-slate-300" />
                                                {log.ip_address}
                                            </span>
                                        </div>
                                    </div>
                                    {log.break_glass_used && (
                                        <div className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black flex items-center gap-1.5 border border-red-100">
                                            <ShieldAlert size={12} />
                                            BREAK GLASS
                                        </div>
                                    )}
                                </div>
                            ))}
                            {!data.length && (
                                <div className="p-12 text-center text-slate-400 font-bold">No access logs found matching filters.</div>
                            )}
                        </div>
                    ) : activeTab === 'alerts' ? (
                        <div className="space-y-4">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={`bg-white border-2 rounded-2xl p-6 transition-all shadow-sm ${alert.severity === 'high' ? 'border-red-100 bg-red-50/10' : 'border-slate-100'
                                    }`}>
                                    <div className="flex gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${alert.severity === 'high' ? 'bg-red-600 shadow-lg shadow-red-200' : 'bg-amber-500 shadow-lg shadow-amber-100'
                                            }`}>
                                            <AlertTriangle className="text-white w-7 h-7" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${alert.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                                            }`}>
                                                            {alert.severity} Priority
                                                        </span>
                                                        <span className="text-xs font-black text-slate-400">•</span>
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                            {alert.alert_type.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                                                        {alert.user_first_name} {alert.user_last_name} triggered a security alert
                                                    </h3>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-slate-400 mb-1">{format(new Date(alert.created_at), 'MMMM do, yyyy')}</div>
                                                    <div className="text-sm font-black text-slate-900">{format(new Date(alert.created_at), 'h:mm a')}</div>
                                                </div>
                                            </div>

                                            <div className="bg-white/60 p-4 rounded-xl border border-slate-100/50 mb-5">
                                                <pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap font-mono">
                                                    {JSON.stringify(alert.details_json, null, 2)}
                                                </pre>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {alert.patient_id && (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                            <User size={14} />
                                                            Patient: {alert.patient_first_name} {alert.patient_last_name}
                                                        </div>
                                                    )}
                                                </div>

                                                {alert.resolved_at ? (
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-100 rounded-xl">
                                                        <CheckCircle size={16} />
                                                        <span className="text-xs font-black">RESOLVED BY {alert.resolver_first_name}</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleResolveAlert(alert.id)}
                                                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                                                    >
                                                        Resolve Alert
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <ShieldCheck className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-900 mb-4">HIPAA Compliance Reports</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                {[
                                    { title: 'Patient Access History', desc: 'Full audit of every user who viewed or edited a specific patient record.', icon: User },
                                    { title: 'User Access History', desc: 'Full audit of every record accessed by a specific user or role.', icon: Activity },
                                    { title: 'Break-Glass Summary', desc: 'Detailed report of all emergency unauthorized access events.', icon: Lock },
                                    { title: 'Restricted Patient List', desc: 'Inventory of all patients with high-privacy flags active.', icon: ShieldAlert }
                                ].map((rpt, i) => (
                                    <div key={i} className="p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] hover:bg-white hover:border-blue-200 transition-all text-left cursor-pointer group">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4 border border-slate-100 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                                            <rpt.icon className="text-slate-400 group-hover:text-white" />
                                        </div>
                                        <h4 className="font-black text-slate-900 mb-1">{rpt.title}</h4>
                                        <p className="text-xs font-medium text-slate-500 leading-relaxed">{rpt.desc}</p>
                                        <div className="mt-4 flex items-center text-[11px] font-black text-blue-600 uppercase tracking-widest gap-1 group-hover:gap-2 transition-all">
                                            Generate Report <ChevronRight size={14} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Compliance;
