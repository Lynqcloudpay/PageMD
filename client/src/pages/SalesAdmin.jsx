import React, { useState, useEffect } from 'react';
import {
    Mail, Phone, Building2, Users, Calendar, Clock,
    CheckCircle2, XCircle, MessageSquare, RefreshCw,
    Search, Filter, ChevronDown, ArrowLeft, Inbox,
    TrendingUp, UserPlus, Eye, MoreVertical, Lock, LogOut,
    Settings, Key, Plus, User, Gift, Database, Shield,
    Send, History, Share2, X, ChevronRight, PhoneIncoming, CalendarCheck, Reply, XOctagon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';

const SalesAdmin = () => {
    // Auth State
    const [token, setToken] = useState(sessionStorage.getItem('salesToken'));
    const [currentUser, setCurrentUser] = useState(JSON.parse(sessionStorage.getItem('salesUser') || 'null'));

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    // Dashboard State
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [updating, setUpdating] = useState(false);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('password'); // password, users
    const [teamUsers, setTeamUsers] = useState([]);

    // Change Password Form
    const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
    const [passMsg, setPassMsg] = useState({ text: '', type: '' });

    // Create User Form
    const [userForm, setUserForm] = useState({ username: '', password: '', email: '' });
    const [userMsg, setUserMsg] = useState({ text: '', type: '' });

    // Onboard Clinic Modal State
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [onboardForm, setOnboardForm] = useState({
        displayName: '',
        slug: '',
        specialty: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: ''
    });
    const [onboardLoading, setOnboardLoading] = useState(false);
    const [onboardError, setOnboardError] = useState('');

    // Status Change Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [statusNote, setStatusNote] = useState('');
    const [statusNoteLoading, setStatusNoteLoading] = useState(false);

    // Logs & Activity State
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [newLogContent, setNewLogContent] = useState('');
    const [sendingLog, setSendingLog] = useState(false);

    // Demo Scheduling State
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [demoForm, setDemoForm] = useState({ date: '', time: '', notes: '' });
    const [demoLoading, setDemoLoading] = useState(false);

    const baseUrl = import.meta.env.VITE_API_URL || '';

    // --- Authentication ---

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        try {
            const response = await fetch(`${baseUrl}/sales/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setToken(data.token);
            setCurrentUser(data.user);
            sessionStorage.setItem('salesToken', data.token);
            sessionStorage.setItem('salesUser', JSON.stringify(data.user));

        } catch (err) {
            setAuthError(err.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setCurrentUser(null);
        sessionStorage.removeItem('salesToken');
        sessionStorage.removeItem('salesUser');
    };

    const authenticatedFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const response = await fetch(baseUrl + url, { ...options, headers });
        if (response.status === 401) {
            handleLogout();
            throw new Error('Session expired');
        }
        return response;
    };

    // --- Data Fetching ---

    const fetchInquiries = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);

            const response = await authenticatedFetch(`/sales/inquiries?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch inquiries');
            }

            const data = await response.json();
            setInquiries(data.inquiries || []);
        } catch (err) {
            console.error('Error fetching inquiries:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamUsers = async () => {
        try {
            const response = await authenticatedFetch('/sales/users');
            if (response.ok) {
                const data = await response.json();
                setTeamUsers(data.users || []);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    // --- Actions ---

    const activateReferral = async (id) => {
        try {
            setUpdating(true);
            const response = await authenticatedFetch(`/sales/inquiries/${id}/activate-referral`, {
                method: 'POST'
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            await fetchInquiries();
            if (selectedInquiry?.id === id) {
                setSelectedInquiry(prev => ({ ...prev, referral_activated: true }));
            }
        } catch (err) {
            console.error('Error activating referral:', err);
            alert(err.message);
        } finally {
            setUpdating(false);
        }
    };

    // Open onboard modal with pre-filled data from inquiry
    const openOnboardModal = (inquiry) => {
        const nameParts = (inquiry.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const slug = (inquiry.practice_name || inquiry.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+$/, '')
            .substring(0, 30);

        setOnboardForm({
            displayName: inquiry.practice_name || '',
            slug: slug,
            specialty: '',
            adminFirstName: firstName,
            adminLastName: lastName,
            adminEmail: inquiry.email || '',
            adminPassword: ''
        });
        setOnboardError('');
        setShowOnboardModal(true);
    };

    // Handle clinic onboarding
    const handleOnboard = async (e) => {
        e.preventDefault();
        setOnboardLoading(true);
        setOnboardError('');

        try {
            const response = await authenticatedFetch('/sales/onboard', {
                method: 'POST',
                body: JSON.stringify({
                    inquiryId: selectedInquiry?.id,
                    clinic: {
                        name: onboardForm.displayName,
                        displayName: onboardForm.displayName,
                        slug: onboardForm.slug,
                        specialty: onboardForm.specialty
                    },
                    adminUser: {
                        firstName: onboardForm.adminFirstName,
                        lastName: onboardForm.adminLastName,
                        email: onboardForm.adminEmail,
                        password: onboardForm.adminPassword
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            setShowOnboardModal(false);
            await fetchInquiries();
            if (selectedInquiry) {
                setSelectedInquiry(prev => ({
                    ...prev,
                    status: 'converted',
                    referral_activated: data.referralActivated
                }));
            }
        } catch (err) {
            console.error('Onboarding error:', err);
            setOnboardError(err.message);
        } finally {
            setOnboardLoading(false);
        }
    };

    const updateInquiryStatus = async (id, newStatus, notes = null) => {
        try {
            setUpdating(true);
            const response = await authenticatedFetch(`/sales/inquiries/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus, notes: notes })
            });

            if (!response.ok) throw new Error('Failed to update');

            await fetchInquiries();
            if (selectedInquiry?.id === id) {
                setSelectedInquiry(prev => ({ ...prev, status: newStatus, notes: notes || prev.notes }));
            }
        } catch (err) {
            console.error('Error updating inquiry:', err);
        } finally {
            setUpdating(false);
        }
    };

    // Open status change modal (for statuses requiring notes)
    const openStatusModal = (newStatus) => {
        if (selectedInquiry?.status === 'converted') {
            // Cannot change status once converted
            alert('This inquiry has been converted and cannot be changed.');
            return;
        }
        setPendingStatus(newStatus);
        setStatusNote('');
        setShowStatusModal(true);
    };

    // Submit status change with note
    const submitStatusChange = async () => {
        if (!statusNote.trim()) {
            alert('Please add a note before changing status.');
            return;
        }
        setStatusNoteLoading(true);
        await updateInquiryStatus(selectedInquiry.id, pendingStatus, statusNote);
        setStatusNoteLoading(false);
        setShowStatusModal(false);
        setPendingStatus(null);
        setStatusNote('');
    };

    // Get status note placeholder based on status
    const getStatusNotePlaceholder = (status) => {
        switch (status) {
            case 'contacted':
                return 'What was discussed? Any follow-up actions? Next call date?';
            case 'demo_scheduled':
                return 'When is the demo? Who will attend? Any special requirements?';
            case 'follow_up':
                return 'What needs to be followed up? When? Any blockers?';
            case 'closed':
                return 'Why was the deal not closed? Customer feedback? Reason for rejection?';
            default:
                return 'Add notes about this status change...';
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passForm.new !== passForm.confirm) {
            setPassMsg({ text: 'Passwords do not match', type: 'error' });
            return;
        }

        try {
            const response = await authenticatedFetch('/sales/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: passForm.current,
                    newPassword: passForm.new
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setPassMsg({ text: 'Password updated successfully', type: 'success' });
            setPassForm({ current: '', new: '', confirm: '' });
        } catch (err) {
            setPassMsg({ text: err.message, type: 'error' });
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await authenticatedFetch('/sales/auth/create-user', {
                method: 'POST',
                body: JSON.stringify(userForm)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setUserMsg({ text: 'User created successfully', type: 'success' });
            setUserForm({ username: '', password: '', email: '' });
            fetchTeamUsers();
        } catch (err) {
            setUserMsg({ text: err.message, type: 'error' });
        }
    };

    const fetchLogs = async (inquiryId) => {
        try {
            setLogsLoading(true);
            const response = await authenticatedFetch(`/sales/inquiries/${inquiryId}/logs`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleAddLog = async (e) => {
        e.preventDefault();
        if (!newLogContent.trim()) return;

        try {
            setSendingLog(true);
            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/logs`, {
                method: 'POST',
                body: JSON.stringify({ content: newLogContent, type: 'note' })
            });

            if (response.ok) {
                const data = await response.json();
                setLogs(prev => [...prev, { ...data.log, admin_name: currentUser.username }]);
                setNewLogContent('');
            }
        } catch (err) {
            console.error('Error adding log:', err);
            alert('Failed to add note');
        } finally {
            setSendingLog(false);
        }
    };

    const handleScheduleDemo = async (e) => {
        e.preventDefault();
        if (!demoForm.date || !demoForm.time) {
            alert('Please select date and time');
            return;
        }

        try {
            setDemoLoading(true);
            const dateTime = new Date(`${demoForm.date}T${demoForm.time}`);

            const response = await authenticatedFetch(`/sales/inquiries/${selectedInquiry.id}/schedule-demo`, {
                method: 'POST',
                body: JSON.stringify({
                    date: dateTime.toISOString(),
                    notes: demoForm.notes
                })
            });

            if (!response.ok) throw new Error('Failed to schedule');

            alert('Demo scheduled and invite sent!');
            setShowDemoModal(false);
            setDemoForm({ date: '', time: '', notes: '' });
            await fetchLogs(selectedInquiry.id);
            // Update local inquiry status
            setSelectedInquiry(prev => ({ ...prev, status: 'demo_scheduled', demo_scheduled_at: dateTime.toISOString() }));
            // Update list
            setInquiries(prev => prev.map(i => i.id === selectedInquiry.id ? { ...i, status: 'demo_scheduled' } : i));

        } catch (err) {
            console.error('Error scheduling demo:', err);
            alert(err.message);
        } finally {
            setDemoLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchInquiries();
        }
    }, [token, statusFilter]);

    useEffect(() => {
        if (showSettings && token) {
            fetchTeamUsers();
        }
    }, [showSettings, token]);

    useEffect(() => {
        if (selectedInquiry?.id) {
            fetchLogs(selectedInquiry.id);
        } else {
            setLogs([]);
        }
    }, [selectedInquiry?.id]);


    // --- Helpers ---

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700';
            case 'contacted': return 'bg-yellow-100 text-yellow-700';
            case 'demo_scheduled': return 'bg-indigo-100 text-indigo-700';
            case 'follow_up': return 'bg-orange-100 text-orange-700';
            case 'converted': return 'bg-emerald-100 text-emerald-700';
            case 'closed': return 'bg-slate-100 text-slate-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getInterestLabel = (interest) => {
        const labels = {
            'demo': 'Demo Request',
            'sandbox': 'Sandbox Access',
            'pricing': 'Pricing Info',
            'enterprise': 'Enterprise',
            'starter': 'Starter Plan',
            'professional': 'Professional Plan',
            'other': 'Other'
        };
        return labels[interest] || interest || 'General';
    };

    const filteredInquiries = inquiries.filter(inq => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            inq.name?.toLowerCase().includes(search) ||
            inq.email?.toLowerCase().includes(search) ||
            inq.practice_name?.toLowerCase().includes(search)
        );
    });

    // Stats
    const stats = {
        total: inquiries.length,
        new: inquiries.filter(i => i.status === 'new').length,
        contacted: inquiries.filter(i => i.status === 'contacted').length,
        converted: inquiries.filter(i => i.status === 'converted').length
    };


    // --- UI Render ---

    if (!token) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-2xl p-8">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900">Sales Team Login</h1>
                            <p className="text-slate-500 mt-2">Sign in to manage inquiries</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>

                            {authError && (
                                <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg flex items-center justify-center gap-2">
                                    <XCircle className="w-4 h-4" />
                                    {authError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {authLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                Sign In
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link to="/" className="text-sm text-slate-500 hover:text-blue-600">
                                ← Back to PageMD
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Sales Dashboard</h1>
                                <p className="text-sm text-slate-500">Welcome back, {currentUser?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSettings(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                Settings
                            </button>
                            <button
                                onClick={fetchInquiries}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <Inbox className="w-5 h-5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-400 uppercase">Total</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                        <div className="text-xs text-slate-500 mt-1">All inquiries</div>
                    </div>
                    {/* ... other stats ... */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <UserPlus className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-medium text-blue-500 uppercase">New</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-600">{stats.new}</div>
                        <div className="text-xs text-slate-500 mt-1">Awaiting response</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <MessageSquare className="w-5 h-5 text-yellow-500" />
                            <span className="text-xs font-medium text-yellow-600 uppercase">Contacted</span>
                        </div>
                        <div className="text-3xl font-bold text-yellow-600">{stats.contacted}</div>
                        <div className="text-xs text-slate-500 mt-1">In progress</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600 uppercase">Converted</span>
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">{stats.converted}</div>
                        <div className="text-xs text-slate-500 mt-1">Won deals</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or practice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Statuses</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="demo_scheduled">Demo Scheduled</option>
                            <option value="follow_up">Follow Up</option>
                            <option value="converted">Converted</option>
                            <option value="closed">Closed</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-3 gap-6">
                    {/* Inquiries List */}
                    <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="font-semibold text-slate-900">Inquiries ({filteredInquiries.length})</h2>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                                Loading inquiries...
                            </div>
                        ) : error ? (
                            <div className="p-12 text-center text-red-500">
                                <XCircle className="w-8 h-8 mx-auto mb-3" />
                                <div className="font-medium mb-2">Error loading inquiries</div>
                                <p className="text-sm text-slate-500">{error}</p>
                                <button
                                    onClick={fetchInquiries}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : filteredInquiries.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <div className="font-medium">No inquiries yet</div>
                                <p className="text-sm mt-1">New leads will appear here when someone submits a form</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
                                {filteredInquiries.map((inquiry) => (
                                    <div
                                        key={inquiry.id}
                                        onClick={() => setSelectedInquiry(inquiry)}
                                        className={`p-5 cursor-pointer transition-all border-l-4 ${selectedInquiry?.id === inquiry.id
                                            ? 'bg-blue-50/50 border-l-blue-600 shadow-sm'
                                            : 'border-l-transparent hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-slate-900 truncate">{inquiry.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusColor(inquiry.status)}`}>
                                                        {inquiry.status?.replace('_', ' ') || 'new'}
                                                    </span>
                                                    {inquiry.interest_type && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                                                            {getInterestLabel(inquiry.interest_type)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-slate-400 font-medium">
                                                    {inquiry.created_at ? format(new Date(inquiry.created_at), 'MMM d') : '-'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-3 text-slate-500 truncate">
                                                {inquiry.practice_name && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="w-3 h-3 text-slate-400" />
                                                        {inquiry.practice_name}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-slate-400" />
                                                    {inquiry.email?.split('@')[0]}...
                                                </span>
                                            </div>
                                            {inquiry.referral_code && (
                                                <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    <Gift className="w-3 h-3" />
                                                    {inquiry.referral_code}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[700px] shadow-sm">
                        {selectedInquiry ? (
                            <>
                                {/* Modern Header */}
                                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">{selectedInquiry.name}</h2>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                                {selectedInquiry.practice_name && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="w-4 h-4" />
                                                        {selectedInquiry.practice_name}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    Received {format(new Date(selectedInquiry.created_at), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedInquiry.status !== 'converted' && selectedInquiry.status !== 'closed' && (
                                                <button
                                                    onClick={() => setShowDemoModal(true)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                                                >
                                                    <CalendarCheck className="w-4 h-4" />
                                                    Schedule Demo
                                                </button>
                                            )}
                                            <div className="relative">
                                                <select
                                                    value={selectedInquiry.status || 'new'}
                                                    onChange={(e) => updateInquiryStatus(selectedInquiry.id, e.target.value)}
                                                    disabled={updating || selectedInquiry.status === 'converted'}
                                                    className={`appearance-none pl-9 pr-8 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all ${selectedInquiry.status === 'converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                                                >
                                                    <option value="new">New</option>
                                                    <option value="contacted">Contacted</option>
                                                    <option value="demo_scheduled">Demo Scheduled</option>
                                                    <option value="follow_up">Follow Up</option>
                                                    <option value="converted">Converted</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    {selectedInquiry.status === 'converted' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Inbox className="w-4 h-4" />}
                                                </div>
                                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action/Info Bar */}
                                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                                        <a href={`mailto:${selectedInquiry.email}`} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                                            {selectedInquiry.email}
                                        </a>
                                        {selectedInquiry.phone && (
                                            <a href={`tel:${selectedInquiry.phone}`} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                                                <Phone className="w-3.5 h-3.5 text-blue-500" />
                                                {selectedInquiry.phone}
                                            </a>
                                        )}
                                        {selectedInquiry.provider_count && (
                                            <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                                {selectedInquiry.provider_count} Providers
                                            </span>
                                        )}
                                        {selectedInquiry.status !== 'converted' && (
                                            <button
                                                onClick={() => openOnboardModal(selectedInquiry)}
                                                className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Onboard as Client
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Full Width Activity Stream */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-white">
                                    {/* Inquiry Message */}
                                    {selectedInquiry.message && (
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/50">
                                                <User className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div className="flex-1 max-w-[85%]">
                                                <div className="flex items-baseline justify-between mb-1.5">
                                                    <span className="text-sm font-bold text-slate-900">{selectedInquiry.name} <span className="text-xs font-medium text-slate-400 ml-1">(Customer)</span></span>
                                                    <span className="text-[10px] font-medium text-slate-400">ORIGINAL MESSAGE</span>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 text-slate-700 text-sm leading-relaxed shadow-sm">
                                                    {selectedInquiry.message}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline Divider */}
                                    <div className="relative py-4 flex items-center justify-center">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-slate-100"></div>
                                        </div>
                                        <span className="relative px-4 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest shadow-sm">
                                            Activity History
                                        </span>
                                    </div>

                                    {/* Dynamic Logs */}
                                    {logsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                                            <span className="text-xs font-medium">Fetching history...</span>
                                        </div>
                                    ) : logs.length === 0 ? (
                                        <div className="text-center py-10">
                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <MessageSquare className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p className="text-sm text-slate-400 italic">No notes or status updates yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {logs.map((log) => (
                                                <div key={log.id} className={`flex gap-4 ${log.type === 'status_change' ? 'justify-center' : ''}`}>
                                                    {log.type === 'status_change' ? (
                                                        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-dashed border-slate-200/60 flex items-center gap-3 text-xs text-slate-500 shadow-sm">
                                                            <div className="p-1 bg-white rounded-md shadow-xs">
                                                                <History className="w-3.5 h-3.5 text-slate-400" />
                                                            </div>
                                                            <span><strong>{log.admin_name}</strong> updated status: <span className="font-medium text-slate-700">{log.content}</span></span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-[10px] font-medium text-slate-400 uppercase">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm ${log.type === 'demo_scheduled' ? 'bg-indigo-50 border-indigo-100' : 'bg-blue-50 border-blue-100'}`}>
                                                                {log.type === 'demo_scheduled' ? (
                                                                    <CalendarCheck className="w-5 h-5 text-indigo-600" />
                                                                ) : (
                                                                    <User className="w-5 h-5 text-blue-600" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 max-w-[85%]">
                                                                <div className="flex items-baseline justify-between mb-1.5">
                                                                    <span className="text-sm font-bold text-slate-900">{log.admin_name || 'Admin'}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{format(new Date(log.created_at), 'MMM d, h:mm a')}</span>
                                                                </div>
                                                                <div className={`text-sm p-4 rounded-2xl rounded-tl-none border leading-relaxed shadow-sm ${log.type === 'demo_scheduled'
                                                                    ? 'bg-indigo-50/30 border-indigo-100 text-indigo-900'
                                                                    : 'bg-white border-slate-100 text-slate-700'
                                                                    }`}>
                                                                    {log.content}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Modern Integrated Input Area */}
                                <div className="p-4 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                                    <form onSubmit={handleAddLog} className="relative group">
                                        <textarea
                                            value={newLogContent}
                                            onChange={(e) => setNewLogContent(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddLog(e);
                                                }
                                            }}
                                            placeholder="Add a private note or contact summary..."
                                            className="w-full pl-5 pr-14 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 resize-none shadow-sm text-sm transition-all"
                                            rows="1"
                                            style={{ minHeight: '60px' }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newLogContent.trim() || sendingLog}
                                            className="absolute right-3 top-3 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg shadow-blue-200"
                                        >
                                            {sendingLog ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        </button>
                                    </form>
                                    <div className="mt-2 flex items-center justify-between px-2">
                                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm animate-pulse"></span> Press Enter to Save</span>
                                            <span>•</span>
                                            <span>Shift + Enter for new line</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                                    <Inbox className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="font-bold text-lg text-slate-700 mb-2">Select an Inquiry</h3>
                                <p className="text-sm max-w-[240px] leading-relaxed">Choose someone from the list to view their contact details and full activity history.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >

    {/* Settings Modal */ }
    {
        showSettings && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 h-full min-h-screen">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <h2 className="text-xl font-bold text-slate-900">Settings & Team</h2>
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full">
                            <XCircle className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    <div className="flex border-b border-slate-100 shrink-0">
                        <button
                            onClick={() => setSettingsTab('password')}
                            className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'password' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                        >
                            Change Password
                        </button>
                        <button
                            onClick={() => setSettingsTab('users')}
                            className={`flex-1 py-3 text-sm font-medium ${settingsTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                        >
                            Team Management
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        {settingsTab === 'password' ? (
                            <form onSubmit={handleChangePassword} className="max-w-md mx-auto space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                    <input
                                        type="password"
                                        value={passForm.current}
                                        onChange={(e) => setPassForm({ ...passForm, current: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={passForm.new}
                                        onChange={(e) => setPassForm({ ...passForm, new: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passForm.confirm}
                                        onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                                        required
                                    />
                                </div>

                                {passMsg.text && (
                                    <div className={`text-sm p-3 rounded-lg ${passMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {passMsg.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                                >
                                    Update Password
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-8">
                                {/* Create User */}
                                <div className="bg-slate-50 p-5 rounded-xl">
                                    <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" />
                                        Add New Team Member
                                    </h3>
                                    <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 sm:col-span-1">
                                            <input
                                                type="text"
                                                placeholder="Username"
                                                value={userForm.username}
                                                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                                required
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                value={userForm.email}
                                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                                required
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="password"
                                                placeholder="Initial Password (min 8 chars)"
                                                value={userForm.password}
                                                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                                required
                                                minLength={8}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <button
                                                type="submit"
                                                className="w-full py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 text-sm"
                                            >
                                                Create User
                                            </button>
                                        </div>
                                        {userMsg.text && (
                                            <div className={`col-span-2 text-sm p-2 rounded ${userMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {userMsg.text}
                                            </div>
                                        )}
                                    </form>
                                </div>

                                {/* User List */}
                                <div>
                                    <h3 className="font-medium text-slate-900 mb-4 text-sm uppercase tracking-wider text-slate-500">
                                        Existing Users
                                    </h3>
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="divide-y divide-slate-100">
                                            {teamUsers.map(user => (
                                                <div key={user.id} className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                            {user.username.substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-slate-900">{user.username}</div>
                                                            <div className="text-xs text-slate-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        Last login: {user.last_login ? format(new Date(user.last_login), 'MMM d, h:mm a') : 'Never'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    {/* Onboard Clinic Modal */ }
    {
        showOnboardModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 relative my-8 border border-slate-100">
                    <button
                        onClick={() => setShowOnboardModal(false)}
                        className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Onboard New Clinic</h2>
                            <p className="text-slate-500 text-sm">
                                {selectedInquiry?.referral_code
                                    ? `This will activate referral credit for code: ${selectedInquiry.referral_code}`
                                    : 'Create a new clinic with dedicated database'
                                }
                            </p>
                        </div>
                    </div>

                    {onboardError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                            {onboardError}
                        </div>
                    )}

                    <form onSubmit={handleOnboard} className="space-y-6">
                        {/* Clinic Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="w-4 h-4" /> Clinic Details
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Heart Center of Nevada"
                                        value={onboardForm.displayName}
                                        onChange={e => setOnboardForm({ ...onboardForm, displayName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Slug (Subdomain)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. heart-center-nv"
                                        value={onboardForm.slug}
                                        onChange={e => setOnboardForm({
                                            ...onboardForm,
                                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                        })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Unique URL identifier</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Specialty</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Cardiology"
                                        value={onboardForm.specialty}
                                        onChange={e => setOnboardForm({ ...onboardForm, specialty: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Initial Admin User */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Initial Admin User
                            </h3>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardForm.adminFirstName}
                                            onChange={e => setOnboardForm({ ...onboardForm, adminFirstName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardForm.adminLastName}
                                            onChange={e => setOnboardForm({ ...onboardForm, adminLastName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admin Email</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="admin@clinic.com"
                                        value={onboardForm.adminEmail}
                                        onChange={e => setOnboardForm({ ...onboardForm, adminEmail: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        placeholder="Min 8 characters"
                                        value={onboardForm.adminPassword}
                                        onChange={e => setOnboardForm({ ...onboardForm, adminPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={onboardLoading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {onboardLoading ? (
                                    <><RefreshCw className="w-5 h-5 animate-spin" /> Provisioning...</>
                                ) : (
                                    <>
                                        <Database className="w-5 h-5" />
                                        {selectedInquiry?.referral_code ? 'Create Clinic & Activate Referral' : 'Create Clinic'}
                                    </>
                                )}
                            </button>
                            <p className="text-center text-[10px] text-slate-400 mt-3">
                                This will create a new dedicated database schema and initial admin account.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    {/* Status Change Modal */ }
    {
        showStatusModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 relative border border-slate-100">
                    <button
                        onClick={() => {
                            setShowStatusModal(false);
                            setPendingStatus(null);
                            setStatusNote('');
                        }}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingStatus === 'closed' ? 'bg-red-100' : 'bg-blue-100'
                            }`}>
                            {pendingStatus === 'contacted' && <Phone className="w-5 h-5 text-blue-600" />}
                            {pendingStatus === 'demo_scheduled' && <Calendar className="w-5 h-5 text-blue-600" />}
                            {pendingStatus === 'follow_up' && <RefreshCw className="w-5 h-5 text-blue-600" />}
                            {pendingStatus === 'closed' && <XCircle className="w-5 h-5 text-red-600" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                {pendingStatus === 'contacted' && 'Log Contact'}
                                {pendingStatus === 'demo_scheduled' && 'Schedule Demo'}
                                {pendingStatus === 'follow_up' && 'Set Follow Up'}
                                {pendingStatus === 'closed' && 'Close Inquiry'}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {selectedInquiry?.name} • {selectedInquiry?.email}
                            </p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {pendingStatus === 'contacted' && 'Contact Notes *'}
                            {pendingStatus === 'demo_scheduled' && 'Demo Details *'}
                            {pendingStatus === 'follow_up' && 'Follow Up Notes *'}
                            {pendingStatus === 'closed' && 'Reason for Closing *'}
                        </label>
                        <textarea
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            placeholder={getStatusNotePlaceholder(pendingStatus)}
                            rows={5}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all resize-none"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowStatusModal(false);
                                setPendingStatus(null);
                                setStatusNote('');
                            }}
                            className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitStatusChange}
                            disabled={statusNoteLoading || !statusNote.trim()}
                            className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${pendingStatus === 'closed'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {statusNoteLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save & Update Status
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }
    {/* Demo Schedule Modal */ }
    {
        showDemoModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Schedule Demo</h3>
                        <button onClick={() => setShowDemoModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleScheduleDemo} className="p-6 space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                            <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                <strong>Invite Notification:</strong> Scheduling this demo will automatically send a calendar invitation and email reminder to <strong>{selectedInquiry?.email}</strong>.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                            <input
                                type="date"
                                required
                                value={demoForm.date}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setDemoForm({ ...demoForm, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                            <input
                                type="time"
                                required
                                value={demoForm.time}
                                onChange={(e) => setDemoForm({ ...demoForm, time: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Additional Notes / Agenda</label>
                            <textarea
                                rows="3"
                                value={demoForm.notes}
                                onChange={(e) => setDemoForm({ ...demoForm, notes: e.target.value })}
                                placeholder="e.g. Focus on billing integration..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm resize-none"
                            />
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDemoModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 hover:text-slate-900 transition-all text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={demoLoading}
                                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm flex items-center justify-center gap-2"
                            >
                                {demoLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                                Send Invitation
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }
        </div >
    );
};

export default SalesAdmin;
