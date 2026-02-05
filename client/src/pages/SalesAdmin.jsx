import React, { useState, useEffect } from 'react';
import {
    Mail, Phone, Building2, Users, Calendar, Clock,
    CheckCircle2, XCircle, MessageSquare, RefreshCw,
    Search, Filter, ChevronDown, ArrowLeft, Inbox,
    TrendingUp, UserPlus, Eye, MoreVertical, Lock, LogOut,
    Settings, Key, Plus, User, Gift
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

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

    const updateInquiryStatus = async (id, newStatus) => {
        try {
            setUpdating(true);
            const response = await authenticatedFetch(`/sales/inquiries/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Failed to update');

            await fetchInquiries();
            if (selectedInquiry?.id === id) {
                setSelectedInquiry(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error('Error updating inquiry:', err);
        } finally {
            setUpdating(false);
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


    // --- Helpers ---

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700';
            case 'contacted': return 'bg-yellow-100 text-yellow-700';
            case 'qualified': return 'bg-purple-100 text-purple-700';
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
                            <option value="qualified">Qualified</option>
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
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                {filteredInquiries.map((inquiry) => (
                                    <div
                                        key={inquiry.id}
                                        onClick={() => setSelectedInquiry(inquiry)}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedInquiry?.id === inquiry.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h3 className="font-medium text-slate-900">{inquiry.name}</h3>
                                                <p className="text-sm text-slate-500">{inquiry.email}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(inquiry.status)}`}>
                                                {inquiry.status || 'new'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {inquiry.created_at ? format(new Date(inquiry.created_at), 'MMM d, yyyy') : 'N/A'}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                                {getInterestLabel(inquiry.interest_type)}
                                            </span>
                                            {inquiry.referral_code && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-bold uppercase border border-blue-100">
                                                    <Gift className="w-3 h-3" />
                                                    {inquiry.referral_code}
                                                </span>
                                            )}
                                            {inquiry.practice_name && (
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" />
                                                    {inquiry.practice_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {selectedInquiry ? (
                            <>
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <h2 className="font-semibold text-slate-900">Details</h2>
                                    <select
                                        value={selectedInquiry.status || 'new'}
                                        onChange={(e) => updateInquiryStatus(selectedInquiry.id, e.target.value)}
                                        disabled={updating}
                                        className={`text-sm px-3 py-1.5 rounded-lg border ${getStatusColor(selectedInquiry.status)} border-current`}
                                    >
                                        <option value="new">New</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="qualified">Qualified</option>
                                        <option value="converted">Converted</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                <div className="p-5 space-y-5">
                                    {/* Contact Info */}
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-900 mb-3">Contact Information</h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-sm">
                                                <Mail className="w-4 h-4 text-slate-400" />
                                                <a href={`mailto:${selectedInquiry.email}`} className="text-blue-600 hover:underline">
                                                    {selectedInquiry.email}
                                                </a>
                                            </div>
                                            {selectedInquiry.phone && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Phone className="w-4 h-4 text-slate-400" />
                                                    <a href={`tel:${selectedInquiry.phone}`} className="text-slate-700">
                                                        {selectedInquiry.phone}
                                                    </a>
                                                </div>
                                            )}
                                            {selectedInquiry.practice_name && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-700">{selectedInquiry.practice_name}</span>
                                                </div>
                                            )}
                                            {selectedInquiry.provider_count && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-700">{selectedInquiry.provider_count} providers</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Interest */}
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <h3 className="text-sm font-medium text-slate-900 mb-2">Interest</h3>
                                            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                                                {getInterestLabel(selectedInquiry.interest_type)}
                                            </span>
                                        </div>
                                        {selectedInquiry.referral_code && (
                                            <div>
                                                <h3 className="text-sm font-medium text-slate-900 mb-2">Referral Code</h3>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-100 uppercase">
                                                    <Gift className="w-3.5 h-3.5" />
                                                    {selectedInquiry.referral_code}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Message */}
                                    {selectedInquiry.message && (
                                        <div>
                                            <h3 className="text-sm font-medium text-slate-900 mb-2">Message</h3>
                                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
                                                {selectedInquiry.message}
                                            </p>
                                        </div>
                                    )}

                                    {/* Meta */}
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-xs text-slate-400 space-y-1">
                                            <div className="flex justify-between">
                                                <span>Source:</span>
                                                <span className="text-slate-600">{selectedInquiry.source || 'Website'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Submitted:</span>
                                                <span className="text-slate-600">
                                                    {selectedInquiry.created_at
                                                        ? format(new Date(selectedInquiry.created_at), 'MMM d, yyyy h:mm a')
                                                        : 'N/A'
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>ID:</span>
                                                <span className="text-slate-600">#{selectedInquiry.id}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-4 space-y-2">
                                        {selectedInquiry.referral_code && selectedInquiry.status === 'converted' && !selectedInquiry.referral_activated && (
                                            <button
                                                onClick={() => activateReferral(selectedInquiry.id)}
                                                disabled={updating}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 animate-pulse-once"
                                            >
                                                <Gift className="w-4 h-4" />
                                                Activate Referral Credit
                                            </button>
                                        )}
                                        {selectedInquiry.referral_activated && (
                                            <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-medium">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Referral Credit Active
                                            </div>
                                        )}
                                        <a
                                            href={`mailto:${selectedInquiry.email}?subject=PageMD - Demo Request Follow-up&body=Hi ${selectedInquiry.name},%0D%0A%0D%0AThank you for your interest in PageMD!`}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Mail className="w-4 h-4" />
                                            Send Email
                                        </a>
                                        {selectedInquiry.phone && (
                                            <a
                                                href={`tel:${selectedInquiry.phone}`}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                            >
                                                <Phone className="w-4 h-4" />
                                                Call
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-slate-400">
                                <Eye className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                <div className="font-medium">Select an inquiry</div>
                                <p className="text-sm mt-1">Click on an inquiry to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
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
            )}
        </div>
    );
};

export default SalesAdmin;
