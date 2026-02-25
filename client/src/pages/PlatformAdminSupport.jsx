import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Clock, CheckCircle, ChevronRight, RefreshCw, Ticket, Filter } from 'lucide-react';
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

            // Auto-refresh every 15 seconds for live updates
            const interval = setInterval(() => {
                fetchTickets();
            }, 15000);

            return () => clearInterval(interval);
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
        low: 'bg-gray-50 text-gray-600 border-gray-200',
        medium: 'bg-blue-100 text-blue-700 border-blue-200',
        high: 'bg-orange-100 text-orange-700 border-orange-200',
        critical: 'bg-red-100 text-red-700 border-red-200'
    };

    const statusColors = {
        open: 'bg-amber-100 text-amber-700 border-amber-200',
        in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
        resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        closed: 'bg-gray-50 text-gray-600 border-gray-200'
    };

    // Redirect if not authenticated
    if (!authLoading && !isAuthenticated) {
        navigate('/platform-admin/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/platform-admin/dashboard')}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Support Tickets</h1>
                    <p className="text-gray-500">View and manage user-submitted issues</p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/80 shadow-lg shadow-slate-200/50">
                            <div className="text-3xl font-bold text-gray-800">{stats.total || 0}</div>
                            <div className="text-sm text-gray-500 mt-1">Total Tickets</div>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-100 shadow-lg shadow-amber-100/50">
                            <div className="text-3xl font-bold text-amber-600">{stats.open_count || 0}</div>
                            <div className="text-sm text-amber-600/70 mt-1">Open</div>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-blue-100 shadow-lg shadow-blue-100/50">
                            <div className="text-3xl font-bold text-blue-600">{stats.in_progress_count || 0}</div>
                            <div className="text-sm text-blue-600/70 mt-1">In Progress</div>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-red-100 shadow-lg shadow-red-100/50">
                            <div className="text-3xl font-bold text-red-600">{stats.critical_open || 0}</div>
                            <div className="text-sm text-red-600/70 mt-1">Critical Open</div>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-emerald-100 shadow-lg shadow-emerald-100/50">
                            <div className="text-3xl font-bold text-emerald-600">{stats.resolved_count || 0}</div>
                            <div className="text-sm text-emerald-600/70 mt-1">Resolved</div>
                        </div>
                    </div>
                )}

                {/* Actions Bar */}
                <div className="mb-8 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={filter.status}
                            onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                            className="px-4 py-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                            className="px-4 py-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchTickets}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all font-medium shadow-lg shadow-blue-500/25"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Ticket List */}
                    <div className="lg:col-span-2 space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-16 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg">
                                <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 font-medium">No support tickets found</p>
                                <p className="text-sm text-gray-400 mt-2">Tickets submitted by users will appear here</p>
                            </div>
                        ) : (
                            tickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`w-full text-left p-5 bg-white/80 backdrop-blur-xl rounded-2xl border cursor-pointer transition-all hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200 ${selectedTicket?.id === ticket.id ? 'border-blue-400 shadow-xl shadow-blue-500/10' : 'border-white/80 shadow-lg shadow-slate-200/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-800">{ticket.subject}</h3>
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ticket.description}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${priorityColors[ticket.priority]}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[ticket.status]}`}>
                                                    {ticket.status?.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {ticket.clinic_name || 'Unknown Clinic'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                        <span>{ticket.user_email}</span>
                                        <span>•</span>
                                        <span>{new Date(ticket.created_at).toLocaleString()}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Ticket Detail */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg shadow-slate-200/50 p-6 h-fit sticky top-8">
                        {selectedTicket ? (
                            <>
                                <h2 className="text-xl font-bold text-gray-800 mb-5">{selectedTicket.subject}</h2>

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</label>
                                        <p className="text-gray-700 mt-1">{selectedTicket.description}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</label>
                                            <p className={`inline-block mt-1 px-2.5 py-1 rounded-lg text-sm font-medium border ${priorityColors[selectedTicket.priority]}`}>
                                                {selectedTicket.priority}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                                            <p className={`inline-block mt-1 px-2.5 py-1 rounded-lg text-sm font-medium border ${statusColors[selectedTicket.status]}`}>
                                                {selectedTicket.status?.replace('_', ' ')}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Submitted By</label>
                                        <p className="text-gray-700 mt-1">{selectedTicket.user_email}</p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Clinic</label>
                                        {selectedTicket.clinic_id ? (
                                            <button
                                                onClick={() => navigate(`/platform-admin/clinics/${selectedTicket.clinic_id}`)}
                                                className="text-blue-600 hover:text-blue-800 hover:underline mt-1 block font-medium text-left"
                                            >
                                                {selectedTicket.clinic_name || 'View Clinic'} →
                                            </button>
                                        ) : (
                                            <p className="text-gray-500 mt-1 italic">Unknown / No clinic linked</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Created</label>
                                        <p className="text-gray-700 mt-1">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                                    </div>

                                    {selectedTicket.context_data && (
                                        <div>
                                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">User Context</label>
                                            <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                                                {selectedTicket.context_data.clientState && (
                                                    <>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-gray-400 text-sm w-24 flex-shrink-0">Page:</span>
                                                            <span className="text-gray-700 text-sm font-medium">{selectedTicket.context_data.clientState.route || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-gray-400 text-sm w-24 flex-shrink-0">Screen:</span>
                                                            <span className="text-gray-700 text-sm">{selectedTicket.context_data.clientState.screenSize || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-gray-400 text-sm w-24 flex-shrink-0">Browser:</span>
                                                            <span className="text-gray-700 text-sm">
                                                                {selectedTicket.context_data.userAgent?.includes('Chrome') ? 'Chrome' :
                                                                    selectedTicket.context_data.userAgent?.includes('Safari') ? 'Safari' :
                                                                        selectedTicket.context_data.userAgent?.includes('Firefox') ? 'Firefox' : 'Other'}
                                                                {selectedTicket.context_data.userAgent?.includes('Mac') ? ' on Mac' :
                                                                    selectedTicket.context_data.userAgent?.includes('Windows') ? ' on Windows' : ''}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                                {selectedTicket.context_data.auditTrail?.length > 0 && (
                                                    <div>
                                                        <span className="text-gray-400 text-sm block mb-2">Recent Actions:</span>
                                                        <ul className="text-sm text-gray-600 space-y-1">
                                                            {selectedTicket.context_data.auditTrail.slice(0, 5).map((log, i) => (
                                                                <li key={i} className="flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                                                    {log.action || 'No action recorded'}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {(!selectedTicket.context_data.auditTrail || selectedTicket.context_data.auditTrail.length === 0) && (
                                                    <p className="text-sm text-gray-500 italic">No recent platform actions recorded</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-5 border-t border-gray-100">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">Update Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        console.log('Updating status to:', status);
                                                        updateTicketStatus(selectedTicket.id, status);
                                                    }}
                                                    disabled={selectedTicket.status === status}
                                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${selectedTicket.status === status
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:scale-105'
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
                            <div className="text-center py-12">
                                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Select a ticket to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformAdminSupport;
