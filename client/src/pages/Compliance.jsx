import React, { useState, useEffect } from 'react';
import {
    Shield, Shield as ShieldCheck, FileText, AlertTriangle, Search, Filter, Download,
    CheckCircle, Clock, User, Link as LinkIcon, ChevronRight,
    ShieldAlert, Calendar, Activity, Lock, Eye, X
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
    const [reportParams, setReportParams] = useState({
        showPicker: false,
        type: null, // 'patient', 'user', 'break-glass', 'restricted'
        query: '',
        results: [],
        searching: false
    });

    // Integrated Patient Search Engine for Filter Bar
    const [patientSearchQuery, setPatientSearchQuery] = useState('');
    const [patientSearchResults, setPatientSearchResults] = useState([]);
    const [isPatientSearching, setIsPatientSearching] = useState(false);
    const [showPatientResults, setShowPatientResults] = useState(false);

    useEffect(() => {
        if (!patientSearchQuery.trim()) {
            setPatientSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsPatientSearching(true);
            try {
                const res = await patientsAPI.search(patientSearchQuery);
                setPatientSearchResults(res.data || []);
            } catch (err) {
                console.error('Patient search failed:', err);
            } finally {
                setIsPatientSearching(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [patientSearchQuery]);

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

    const downloadCSV = (logs, filename) => {
        if (!logs.length) {
            alert('No data available to export.');
            return;
        }

        const headers = ['Date', 'User', 'Role', 'Patient', 'Action', 'Restricted', 'Break Glass', 'IP'];
        const rows = logs.map(l => [
            format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
            `${l.user_first_name} ${l.user_last_name}`,
            l.user_role || 'N/A',
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
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerateReport = async (type) => {
        if (type === 'restricted') {
            setReportView('restricted');
            return;
        }

        if (type === 'break-glass') {
            setLoading(true);
            try {
                const res = await complianceAPI.getLogs({ breakGlass: 'true', limit: 3000 });
                downloadCSV(res.data || [], `break_glass_summary_${format(new Date(), 'yyyyMMdd')}`);
            } catch (err) {
                alert('Failed to generate break-glass report');
            } finally {
                setLoading(false);
            }
            return;
        }

        // For Patient or User, open the picker
        setReportParams({
            showPicker: true,
            type: type,
            query: '',
            results: [],
            searching: false
        });
    };

    const handlePickerSearch = async (val) => {
        setReportParams(prev => ({ ...prev, query: val, searching: true }));
        try {
            if (reportParams.type === 'patient') {
                const res = await patientsAPI.search(val);
                setReportParams(prev => ({ ...prev, results: res.data || [], searching: false }));
            } else {
                // Search users
                const u = users.filter(u =>
                    `${u.first_name} ${u.last_name}`.toLowerCase().includes(val.toLowerCase()) ||
                    u.email?.toLowerCase().includes(val.toLowerCase())
                );
                setReportParams(prev => ({ ...prev, results: u, searching: false }));
            }
        } catch (err) {
            console.error('Picker search failed:', err);
            setReportParams(prev => ({ ...prev, searching: false }));
        }
    };

    const handlePickerSelect = async (item) => {
        setLoading(true);
        setReportParams(prev => ({ ...prev, showPicker: false }));
        try {
            let res;
            if (reportParams.type === 'patient') {
                res = await complianceAPI.getLogs({ patientId: item.id, limit: 1000 });
                setReportView('patient');
            } else {
                res = await complianceAPI.getLogs({ userId: item.id, limit: 1000 });
                setReportView('user');
            }
            setData(res.data || []);
        } catch (err) {
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        downloadCSV(data, `audit_log_${format(new Date(), 'yyyyMMdd')}`);
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

                    <div className="relative flex-1 max-w-sm">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                            <Search size={14} className={isPatientSearching ? "text-blue-500 animate-pulse" : "text-slate-400"} />
                            <input
                                type="text"
                                placeholder="Search patient name or MRN..."
                                className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none w-full"
                                value={patientSearchQuery}
                                onFocus={() => setShowPatientResults(true)}
                                onChange={(e) => {
                                    setPatientSearchQuery(e.target.value);
                                    if (!e.target.value) {
                                        setFilters({ ...filters, patientId: '', patientSearch: '' });
                                    }
                                }}
                            />
                            {(filters.patientId || filters.patientSearch) && (
                                <button
                                    onClick={() => {
                                        setPatientSearchQuery('');
                                        setFilters({ ...filters, patientId: '', patientSearch: '' });
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded-full"
                                >
                                    <X size={12} className="text-slate-400" />
                                </button>
                            )}
                        </div>

                        {showPatientResults && patientSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-[60] max-h-60 overflow-y-auto">
                                {patientSearchResults.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setFilters({ ...filters, patientId: p.id, patientSearch: '' });
                                            setPatientSearchQuery(`${p.first_name} ${p.last_name}`);
                                            setShowPatientResults(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-none flex justify-between items-center group"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-slate-900 group-hover:text-blue-600 truncate">
                                                {p.first_name} {p.last_name}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                MRN: {p.mrn} • {p.dob || p.date_of_birth}
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-200 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        )}
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const headers = ['First Name', 'Last Name', 'MRN', 'DOB', 'Restricted Since'];
                                            const rows = restrictedPatients.map(p => [p.first_name, p.last_name, p.mrn, p.dob, p.restricted_at]);
                                            const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");
                                            const link = document.createElement("a");
                                            link.setAttribute("href", encodeURI(csv));
                                            link.setAttribute("download", `restricted_patients_${format(new Date(), 'yyyyMMdd')}.csv`);
                                            link.click();
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
                                    >
                                        <Download size={14} /> Export List
                                    </button>
                                    <button
                                        onClick={() => setReportView(null)}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2"
                                    >
                                        <ChevronRight className="rotate-180 w-4 h-4" /> Back to Dashboard
                                    </button>
                                </div>
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
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{p.restricted_at ? format(new Date(p.restricted_at), 'MMM d, yyyy') : 'N/A'}</td>
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
                        <div className="p-12">
                            {
                                reportView ? (
                                    <div className="space-y-6" >
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                                    <FileText className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                                        {reportView === 'patient' ? 'Patient Access Report' :
                                                            reportView === 'user' ? 'User Access Report' :
                                                                reportView === 'break-glass' ? 'Break-Glass Summary' : 'Compliance Report'}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Interactive Audit Visualization</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => downloadCSV(data, `report_${reportView}_${format(new Date(), 'yyyyMMdd')}`)}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
                                                >
                                                    <Download size={14} /> Export CSV
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setReportView(null);
                                                        setData([]);
                                                    }}
                                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"
                                                >
                                                    Back to Reports
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                                            {loading ? (
                                                <div className="p-20 text-center">
                                                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                                    <p className="text-slate-400 font-bold">Generating report data...</p>
                                                </div>
                                            ) : data.length > 0 ? (
                                                <div className="space-y-4">
                                                    {data.slice(0, 50).map(log => (
                                                        <div key={log.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-6">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${log.break_glass_used ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                                                                }`}>
                                                                {log.break_glass_used ? <ShieldAlert size={20} /> : <Eye size={20} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-black text-slate-900">{log.user_first_name} {log.user_last_name}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-slate-100 rounded">{log.user_role}</span>
                                                                    <span className="text-slate-300 mx-1">•</span>
                                                                    <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{log.access_type.replace(/_/g, ' ')}</span>
                                                                </div>
                                                                <div className="flex items-center gap-6 text-[11px] text-slate-500 font-medium">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <User size={12} className="text-slate-300" />
                                                                        Patient: <span className="font-bold text-slate-700">{log.patient_first_name} {log.patient_last_name}</span>
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Clock size={12} className="text-slate-300" />
                                                                        {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Activity size={12} className="text-slate-300" />
                                                                        IP: {log.ip_address}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {log.break_glass_used && (
                                                                <div className="px-3 py-1 bg-red-600 text-white rounded-lg text-[10px] font-black shadow-lg shadow-red-200 uppercase tracking-widest">
                                                                    Break Glass
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {data.length > 50 && (
                                                        <div className="text-center p-4 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                                                            Showing first 50 results. Export CSV for full audit trail.
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-20 text-center text-slate-400 font-bold italic">No data found for this report criteria.</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-center mb-12">
                                            <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-50 border-4 border-white">
                                                <ShieldCheck className="w-10 h-10 text-blue-600" />
                                            </div>
                                            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">HIPAA Compliance Center</h2>
                                            <p className="text-slate-400 text-sm font-medium">Select a module to generate certified access reports.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                                            {[
                                                {
                                                    title: 'Patient Access',
                                                    desc: 'Comprehensive audit of all users who accessed a specific chart.',
                                                    icon: User,
                                                    color: 'blue',
                                                    action: () => handleGenerateReport('patient')
                                                },
                                                {
                                                    title: 'User Activity',
                                                    desc: 'Audit trail for a specific staff member across all patient charts.',
                                                    icon: Activity,
                                                    color: 'emerald',
                                                    action: () => handleGenerateReport('user')
                                                },
                                                {
                                                    title: 'Break-Glass Hits',
                                                    desc: 'Emergency access events requiring immediate administrative review.',
                                                    icon: ShieldAlert,
                                                    color: 'red',
                                                    action: () => {
                                                        setReportView('break-glass');
                                                        setLoading(true);
                                                        complianceAPI.getLogs({ breakGlass: 'true', limit: 100 })
                                                            .then(res => setData(res.data || []))
                                                            .finally(() => setLoading(false));
                                                    }
                                                },
                                                {
                                                    title: 'Privileged List',
                                                    desc: 'Inventory of restricted patients and high-value VIP accounts.',
                                                    icon: Lock,
                                                    color: 'orange',
                                                    action: () => handleGenerateReport('restricted')
                                                }
                                            ].map((rpt, i) => (
                                                <div
                                                    key={i}
                                                    onClick={rpt.action}
                                                    className="group relative bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-slate-200 hover:shadow-2xl hover:shadow-slate-200/50 transition-all cursor-pointer overflow-hidden"
                                                >
                                                    <div className={`w-14 h-14 rounded-2xl bg-${rpt.color}-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                                        <rpt.icon className={`text-${rpt.color}-600`} size={28} />
                                                    </div>
                                                    <h4 className="text-lg font-black text-slate-900 mb-2">{rpt.title}</h4>
                                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">{rpt.desc}</p>

                                                    <div className="mt-8 flex items-center justify-between">
                                                        <span className={`text-xs font-black text-${rpt.color}-600 uppercase tracking-widest`}>Initialize</span>
                                                        <div className={`w-8 h-8 rounded-full bg-${rpt.color}-100 flex items-center justify-center group-hover:bg-${rpt.color}-600 transition-colors`}>
                                                            <ChevronRight size={16} className={`text-${rpt.color}-600 group-hover:text-white transition-colors`} />
                                                        </div>
                                                    </div>

                                                    {/* Decorative background circle */}
                                                    <div className={`absolute -bottom-12 -right-12 w-32 h-32 bg-${rpt.color}-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-2xl`}></div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                        </div>
                    )}
                    )}
                </div>
            </div >

            {/* Picker Modal for Reports */}
            {
                reportParams.showPicker && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <Search className="text-blue-600" />
                                        Select {reportParams.type === 'patient' ? 'Patient' : 'Staff Member'}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Generate full access audit history</p>
                                </div>
                                <button
                                    onClick={() => setReportParams({ ...reportParams, showPicker: false })}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        autoFocus
                                        type="text"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 text-slate-900 font-bold transition-all"
                                        placeholder={reportParams.type === 'patient' ? "Search name or MRN..." : "Search staff name..."}
                                        value={reportParams.query}
                                        onChange={(e) => handlePickerSearch(e.target.value)}
                                    />
                                    {reportParams.searching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {reportParams.results.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handlePickerSelect(item)}
                                            className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-blue-50 hover:border-blue-100 transition-all group"
                                        >
                                            <div className="text-left">
                                                <div className="font-black text-slate-900 group-hover:text-blue-700">
                                                    {item.first_name} {item.last_name}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {reportParams.type === 'patient' ? `MRN: ${item.mrn}` : (item.role_name || item.role)}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                    {reportParams.query && !reportParams.results.length && !reportParams.searching && (
                                        <div className="p-8 text-center text-slate-400 font-bold italic">
                                            No matches found.
                                        </div>
                                    )}
                                    {!reportParams.query && (
                                        <div className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">
                                            Start typing to search...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Compliance;
