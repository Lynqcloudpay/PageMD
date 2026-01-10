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
    console.log('[Compliance] Rendered version: 1.0.2 (Ultra-Compact)');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        userId: '',
        patientId: '',
        accessType: '',
        unresolvedOnly: true,
        patientSearch: '',
        breakGlass: '',
        isRestricted: false
    });
    const [reportView, setReportView] = useState(null);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        totalOpens: 0,
        restrictedOpens: 0,
        activeAlerts: 0,
        breakGlasses: 0
    });

    const [restrictedPatients, setRestrictedPatients] = useState([]);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'alerts') fetchAlerts();
        if (activeTab === 'reports' && reportView === 'restricted') fetchRestrictedPatients();
    }, [activeTab, filters, reportView]);

    const fetchInitialData = async () => {
        try {
            // Get all users for filters - request a larger limit for admin reference
            const uRes = await usersAPI.getAll({ limit: 1000 });
            const usersList = uRes.data?.users || uRes.data || [];

            // Ensure usersList is indeed an array
            const validatedUsers = Array.isArray(usersList) ? usersList : [];
            setUsers(validatedUsers);

            // Pre-fetch alerts count for badge
            const aRes = await complianceAPI.getAlerts({ unresolvedOnly: true });
            const alertsList = aRes.data || [];
            setAlerts(alertsList);

            // Fetch real summary stats from backend
            const sRes = await complianceAPI.getStats();
            if (sRes.data) {
                setStats({
                    totalOpens: parseInt(sRes.data.total_access) || 0,
                    restrictedOpens: parseInt(sRes.data.restricted_access) || 0,
                    activeAlerts: parseInt(sRes.data.active_alerts) || 0,
                    breakGlasses: parseInt(sRes.data.break_glass_count) || 0
                });
            }
        } catch (err) {
            console.error('Failed to fetch reference data:', err);
            setUsers([]);
            setAlerts([]);
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
            const res = await complianceAPI.getAlerts({
                unresolvedOnly: filters.unresolvedOnly,
                patientSearch: filters.patientSearch
            });
            setAlerts(res.data || []);
            if (filters.unresolvedOnly && !filters.patientSearch) {
                setStats(prev => ({ ...prev, activeAlerts: res.data?.length || 0 }));
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRestrictedPatients = async () => {
        setLoadingReport(true);
        try {
            const res = await complianceAPI.getReports('restricted-patients');
            setRestrictedPatients(res.data || []);
        } catch (err) {
            console.error('Failed to fetch restricted patients:', err);
        } finally {
            setLoadingReport(false);
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
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                <Shield className="text-white w-5 h-5" />
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Compliance & Audit</h1>
                        </div>
                        <p className="text-slate-400 text-xs font-medium ml-1">Monitor chart access and privacy alerts.</p>
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
                    { label: 'Total Chart Access', value: stats.totalOpens, icon: Eye, color: 'blue' },
                    { label: 'Restricted Access', value: stats.restrictedOpens, icon: Lock, color: 'orange' },
                    { label: 'Break Glass Events', value: stats.breakGlasses, icon: ShieldAlert, color: 'red' },
                    { label: 'Pending Alerts', value: stats.activeAlerts, icon: AlertTriangle, color: 'amber' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className={`w-9 h-9 bg-${stat.color}-500/10 rounded-lg flex items-center justify-center`}>
                            <stat.icon className={`text-${stat.color}-600 w-4 h-4`} />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{stat.label}</div>
                            <div className="text-lg font-black text-slate-900 leading-none">{stat.value}</div>
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
                            className={`flex items-center gap-2 px-6 py-4 text-xs font-black transition-all border-b-2 relative ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.badge && (
                                <span className="ml-1.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center shadow-lg shadow-red-200">
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

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 flex-1 max-w-sm">
                        <Search size={14} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search patient name or MRN..."
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none w-full"
                            value={filters.patientSearch}
                            onChange={(e) => setFilters({ ...filters, patientSearch: e.target.value })}
                        />
                    </div>

                    {activeTab === 'logs' && (
                        <label className="flex items-center gap-2 cursor-pointer ml-auto">
                            <input
                                type="checkbox"
                                checked={filters.isRestricted}
                                onChange={(e) => setFilters({ ...filters, isRestricted: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-orange-600"
                            />
                            <span className="text-xs font-bold text-slate-600">Restricted Only</span>
                        </label>
                    )}

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
                                <div key={log.id} className="group hover:bg-slate-50 border border-slate-100 rounded-xl p-3 transition-all flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                        {log.is_restricted ? <Lock className="w-4 h-4 text-red-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-black text-slate-900 truncate text-sm">
                                                {log.user_first_name} {log.user_last_name}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-400 uppercase rounded tracking-wider">
                                                {log.user_role}
                                            </span>
                                            <span className="text-slate-300 font-light mx-1">•</span>
                                            <span className="text-[11px] font-bold text-blue-600/80">
                                                {log.access_type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5 min-w-[180px]">
                                                <User size={10} className="text-slate-300" />
                                                Patient: <span className="text-slate-700 font-bold">{log.patient_first_name} {log.patient_last_name}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={10} className="text-slate-300" />
                                                {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                            </span>
                                            <span className="flex items-center gap-1.5 ml-auto">
                                                <Activity size={10} className="text-slate-300" />
                                                {log.ip_address}
                                            </span>
                                        </div>
                                    </div>
                                    {log.break_glass_used && (
                                        <div className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black flex items-center gap-1 border border-red-100">
                                            <ShieldAlert size={10} />
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
                                <div key={alert.id} className={`bg-white border rounded-xl p-3 transition-all shadow-sm ${alert.severity === 'high' ? 'border-red-100 bg-red-50/10' : 'border-slate-100'
                                    }`}>
                                    <div className="flex gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${alert.severity === 'high' ? 'bg-red-600 shadow-lg shadow-red-200' : 'bg-amber-500 shadow-lg shadow-amber-100'
                                            }`}>
                                            <AlertTriangle className="text-white w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${alert.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                                            }`}>
                                                            {alert.severity}
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400 capitalize">
                                                            {alert.alert_type.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-black text-slate-900 leading-tight truncate">
                                                        {alert.user_first_name} {alert.user_last_name}
                                                    </h3>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <div className="text-[9px] font-bold text-slate-400">{format(new Date(alert.created_at), 'MMM d, h:mm a')}</div>
                                                    {alert.break_glass_used && (
                                                        <span className="mt-0.5 px-1 py-0.5 bg-red-600 text-white text-[7px] font-black rounded uppercase">Break Glass</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 bg-slate-50/80 px-2 py-1.5 rounded-lg border border-slate-100">
                                                    <div className="text-[10px] font-mono text-slate-600 truncate">
                                                        {JSON.stringify(alert.details_json).substring(0, 100)}...
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {alert.patient_id && (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                            <User size={12} className="text-slate-300" />
                                                            {alert.patient_first_name} {alert.patient_last_name}
                                                        </div>
                                                    )}

                                                    {alert.resolved_at ? (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 border border-green-100 rounded-lg">
                                                            <CheckCircle size={12} />
                                                            <span className="text-[9px] font-black uppercase">RESOLVED</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleResolveAlert(alert.id)}
                                                            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-slate-800 transition-all active:scale-95"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reportView === 'restricted' ? (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="text-orange-500 w-5 h-5" />
                                    <h3 className="text-lg font-black text-slate-900">Restricted Patient Inventory</h3>
                                </div>
                                <button
                                    onClick={() => setReportView(null)}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2"
                                >
                                    <ChevronRight className="rotate-180 w-4 h-4" /> Back to Dashboard
                                </button>
                            </div>

                            {loadingReport ? (
                                <div className="p-20 text-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-slate-400 font-bold">Scanning for restricted charts...</p>
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px]">Patient Name</th>
                                                <th className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px]">MRN</th>
                                                <th className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px]">DOB</th>
                                                <th className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px]">Restricted Since</th>
                                                <th className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {restrictedPatients.map(p => (
                                                <tr key={p.id} className="hover:bg-slate-50/50 group transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-black text-slate-900">{p.first_name} {p.last_name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{p.mrn}</td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{p.dob}</td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : 'N/A'}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setActiveTab('logs');
                                                                setFilters({ ...filters, patientSearch: p.mrn, userId: '', accessType: '', breakGlass: '' });
                                                                setReportView(null);
                                                            }}
                                                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-[10px] uppercase hover:bg-blue-100 transition-all"
                                                        >
                                                            View Logs
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {restrictedPatients.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-300 font-bold italic">
                                                        No restricted patients found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <ShieldCheck className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-900 mb-4">HIPAA Compliance Reports</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                {[
                                    {
                                        title: 'Patient Access History',
                                        desc: 'Full audit of every user who viewed or edited a specific patient record.',
                                        icon: User,
                                        action: () => {
                                            setActiveTab('logs');
                                            setFilters({ ...filters, patientSearch: '', userId: '', accessType: '', breakGlass: '' });
                                            setTimeout(() => document.querySelector('input[placeholder*="Search"]')?.focus(), 100);
                                        }
                                    },
                                    {
                                        title: 'User Access History',
                                        desc: 'Full audit of every record accessed by a specific user or role.',
                                        icon: Activity,
                                        action: () => {
                                            setActiveTab('logs');
                                            setFilters({ ...filters, patientSearch: '', userId: '', accessType: '', breakGlass: '' });
                                        }
                                    },
                                    {
                                        title: 'Break-Glass Summary',
                                        desc: 'Detailed report of all emergency unauthorized access events.',
                                        icon: Lock,
                                        action: () => {
                                            setActiveTab('logs');
                                            setFilters({ ...filters, patientSearch: '', userId: '', accessType: '', breakGlass: 'true' });
                                        }
                                    },
                                    {
                                        title: 'Restricted Patient List',
                                        desc: 'Inventory of all patients with high-privacy flags active.',
                                        icon: ShieldAlert,
                                        action: () => {
                                            setReportView('restricted');
                                        }
                                    }
                                ].map((rpt, i) => (
                                    <div
                                        key={i}
                                        onClick={rpt.action}
                                        className="p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] hover:bg-white hover:border-blue-200 transition-all text-left cursor-pointer group"
                                    >
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
