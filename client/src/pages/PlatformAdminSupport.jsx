import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Clock, CheckCircle, XCircle, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';

const PlatformAdminSupport = () => {
    const navigate = useNavigate();
    const { apiCall, isAuthenticated, loading: authLoading } = usePlatformAdmin();
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [filter, setFilter] = useState({ status: 'all', priority: '' });

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.status !== 'all') params.append('status', filter.status);
            if (filter.priority) params.append('priority', filter.priority);

            const [ticketsData, statsData] = await Promise.all([
                apiCall('get', `/support-tickets?${params.toString()}`),
                apiCall('get', '/support-stats')
            ]);

            setTickets(ticketsData?.tickets || []);
            setStats(statsData || {});
        } catch (error) {
            console.error('Failed to fetch support tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            fetchTickets();
        }
    }, [filter, isAuthenticated, authLoading]);

    const updateTicketStatus = async (ticketId, newStatus) => {
        try {
            await apiCall('patch', `/support-tickets/${ticketId}`, { status: newStatus });
            fetchTickets();
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(prev => ({ ...prev, status: newStatus }));
            }
        } catch (error) {
            console.error('Failed to update ticket:', error);
        }
    };

    const priorityColors = {
        low: 'bg-gray-100 text-gray-700',
        medium: 'bg-blue-100 text-blue-700',
        high: 'bg-orange-100 text-orange-700',
        critical: 'bg-red-100 text-red-700'
    };

    const statusColors = {
        open: 'bg-yellow-100 text-yellow-700',
        in_progress: 'bg-blue-100 text-blue-700',
        resolved: 'bg-green-100 text-green-700',
        closed: 'bg-gray-100 text-gray-700'
    };

    // Redirect if not authenticated
    if (!authLoading && !isAuthenticated) {
        navigate('/platform-admin/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 border-b border-slate-700/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/platform-admin')}
                                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-400" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-white">Support Tickets</h1>
                                <p className="text-sm text-slate-400">Manage user-submitted issues</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchTickets}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-2xl font-bold text-white">{stats.total || 0}</div>
                            <div className="text-sm text-slate-400">Total Tickets</div>
                        </div>
                        <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700/30">
                            <div className="text-2xl font-bold text-yellow-400">{stats.open_count || 0}</div>
                            <div className="text-sm text-yellow-400/70">Open</div>
                        </div>
                        <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/30">
                            <div className="text-2xl font-bold text-blue-400">{stats.in_progress_count || 0}</div>
                            <div className="text-sm text-blue-400/70">In Progress</div>
                        </div>
                        <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/30">
                            <div className="text-2xl font-bold text-red-400">{stats.critical_open || 0}</div>
                            <div className="text-sm text-red-400/70">Critical Open</div>
                        </div>
                        <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/30">
                            <div className="text-2xl font-bold text-green-400">{stats.resolved_count || 0}</div>
                            <div className="text-sm text-green-400/70">Resolved</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    <select
                        value={filter.status}
                        onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                    <select
                        value={filter.priority}
                        onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                        <option value="">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Ticket List */}
                    <div className="lg:col-span-2 space-y-3">
                        {loading ? (
                            <div className="text-center py-12 text-slate-400">Loading tickets...</div>
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                <p className="text-slate-400">No support tickets found</p>
                                <p className="text-sm text-slate-500 mt-2">Tickets submitted by users will appear here</p>
                            </div>
                        ) : (
                            tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`p-4 bg-slate-800/50 rounded-xl border cursor-pointer transition-all hover:bg-slate-700/50 ${selectedTicket?.id === ticket.id ? 'border-blue-500' : 'border-slate-700/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-white">{ticket.subject}</h3>
                                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{ticket.description}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority]}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {ticket.clinic_name || 'Unknown Clinic'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                        <span>{ticket.user_email}</span>
                                        <span>•</span>
                                        <span>{new Date(ticket.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Ticket Detail */}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 h-fit sticky top-24">
                        {selectedTicket ? (
                            <>
                                <h2 className="text-lg font-bold text-white mb-4">{selectedTicket.subject}</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-slate-400">Description</label>
                                        <p className="text-white mt-1">{selectedTicket.description}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm text-slate-400">Priority</label>
                                            <p className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-medium ${priorityColors[selectedTicket.priority]}`}>
                                                {selectedTicket.priority}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-400">Status</label>
                                            <p className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-medium ${statusColors[selectedTicket.status]}`}>
                                                {selectedTicket.status}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm text-slate-400">Submitted By</label>
                                        <p className="text-white mt-1">{selectedTicket.user_email}</p>
                                    </div>

                                    <div>
                                        <label className="text-sm text-slate-400">Clinic</label>
                                        <p className="text-white mt-1">{selectedTicket.clinic_name || 'Unknown'}</p>
                                    </div>

                                    <div>
                                        <label className="text-sm text-slate-400">Created</label>
                                        <p className="text-white mt-1">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                                    </div>

                                    {selectedTicket.context_data && (
                                        <div>
                                            <label className="text-sm text-slate-400">Context (Audit Trail)</label>
                                            <pre className="mt-1 p-3 bg-slate-900 rounded-lg text-xs text-slate-300 overflow-auto max-h-48">
                                                {JSON.stringify(selectedTicket.context_data, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-700">
                                        <label className="text-sm text-slate-400 mb-2 block">Update Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => updateTicketStatus(selectedTicket.id, status)}
                                                    disabled={selectedTicket.status === status}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTicket.status === status
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                        }`}
                                                >
                                                    {status.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Select a ticket to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminSupport;
