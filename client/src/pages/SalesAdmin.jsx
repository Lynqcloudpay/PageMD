import React, { useState, useEffect } from 'react';
import {
    Mail, Phone, Building2, Users, Calendar, Clock,
    CheckCircle2, XCircle, MessageSquare, RefreshCw,
    Search, Filter, ChevronDown, ArrowLeft, Inbox,
    TrendingUp, UserPlus, Eye, MoreVertical
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const SalesAdmin = () => {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [updating, setUpdating] = useState(false);

    const fetchInquiries = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/sales/inquiries?${params.toString()}`
            );

            if (!response.ok) throw new Error('Failed to fetch inquiries');

            const data = await response.json();
            setInquiries(data.inquiries || []);
        } catch (err) {
            console.error('Error fetching inquiries:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInquiries();
    }, [statusFilter]);

    const updateInquiryStatus = async (id, newStatus) => {
        try {
            setUpdating(true);
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/sales/inquiries/${id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                }
            );

            if (!response.ok) throw new Error('Failed to update');

            // Refresh the list
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

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Sales Dashboard</h1>
                                <p className="text-sm text-slate-500">Manage incoming inquiries and leads</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchInquiries}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
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
                                {error}
                            </div>
                        ) : filteredInquiries.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <div className="font-medium">No inquiries found</div>
                                <p className="text-sm mt-1">New leads will appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
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
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-900 mb-2">Interest</h3>
                                        <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                                            {getInterestLabel(selectedInquiry.interest_type)}
                                        </span>
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
        </div>
    );
};

export default SalesAdmin;
