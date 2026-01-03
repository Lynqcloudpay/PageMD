import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Inbox, CheckCircle, Clock, AlertTriangle, MessageSquare, FileText,
    Pill, FlaskConical, Image, Send, RefreshCw, Filter, Search,
    ChevronRight, X, Plus as PlusIcon, Bell, User, Calendar, Phone, Paperclip
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { inboxAPI, usersAPI, patientsAPI, appointmentsAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { getPatientDisplayName } from '../utils/patientNameUtils';

// Task categories like Epic's InBasket
const TASK_CATEGORIES = [
    { id: 'results', label: 'Results', icon: FlaskConical, color: 'blue', types: ['lab', 'imaging'] },
    { id: 'messages', label: 'Messages', icon: MessageSquare, color: 'purple', types: ['message'] },
    { id: 'portal_messages', label: 'Portal Messages', icon: User, color: 'blue', types: ['portal_message'] },
    { id: 'appointment_requests', label: 'Appt Requests', icon: Calendar, color: 'emerald', types: ['portal_appointment'] },
    { id: 'notes', label: 'Clinical Notes', icon: FileText, color: 'emerald', types: ['note'] },
    { id: 'documents', label: 'Documents', icon: FileText, color: 'orange', types: ['document'] },
    { id: 'referrals', label: 'Referrals', icon: Send, color: 'indigo', types: ['referral'] },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle, color: 'green', types: ['task'] },
    { id: 'refills', label: 'Rx Requests', icon: Pill, color: 'red', types: ['refill'] },
];

const Inbasket = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Data State
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);

    // Filter State
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('new'); // 'new', 'completed', 'all'
    const [assignedFilter, setAssignedFilter] = useState('all'); // 'all', 'me'
    const [searchQuery, setSearchQuery] = useState('');

    // Selected Item State
    const [selectedItem, setSelectedItem] = useState(null);
    const [details, setDetails] = useState(null); // Full details including thread
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [replyText, setReplyText] = useState('');

    // Compose State
    const [showCompose, setShowCompose] = useState(false);
    const [composeData, setComposeData] = useState({
        type: 'task',
        subject: '',
        body: '',
        patientId: '',
        priority: 'normal',
        assignedUserId: user?.id
    });
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState([]);
    const [isSearchingPatients, setIsSearchingPatients] = useState(false);

    // Assignment Modal
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Appointment Approval Modal
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approvalData, setApprovalData] = useState({
        providerId: '',
        appointmentDate: '',
        appointmentTime: '',
        duration: 30
    });

    // --- Data Fetching ---

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            // 1. Fetch Items
            const params = {
                status: filterStatus,
                assignedTo: assignedFilter,
            };

            const response = await inboxAPI.getAll(params);
            setItems(response.data || []);

            // 2. Fetch Stats
            const statsRes = await inboxAPI.getStats();
            setStats(statsRes.data || {});

            // 3. Fetch Users (for assignment) if not already loaded
            if (users.length === 0) {
                const usersRes = await usersAPI.getDirectory();
                setUsers(usersRes.data || []);
            }

        } catch (error) {
            console.error('Error fetching inbasket:', error);
            showError('Failed to load In Basket');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus, assignedFilter]);

    useEffect(() => {
        fetchData();
        // Poll every 30s
        const poll = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(poll);
    }, [fetchData]);

    // Handle initial selection from URL query param (?id=...)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const itemId = searchParams.get('id');

        if (itemId && items.length > 0) {
            const item = items.find(i => String(i.id) === String(itemId));
            if (item) {
                setSelectedItem(item);
                // Also set filter status to 'all' or the item's status to ensure it shows up in list
                if (item.status === 'completed') setFilterStatus('completed');
                else setFilterStatus('new');
            }
        }
    }, [location.search, items]);

    // Fetch details when item selected
    useEffect(() => {
        if (!selectedItem) {
            setDetails(null);
            return;
        }

        const loadDetails = async () => {
            setLoadingDetails(true);
            try {
                const res = await inboxAPI.getDetails(selectedItem.id);
                setDetails(res.data);
            } catch (e) {
                console.error('Error loading details:', e);
                showError('Could not load item details');
            } finally {
                setLoadingDetails(false);
            }
        };

        loadDetails();
    }, [selectedItem]);

    // --- Filtering ---

    const filteredItems = items.filter(item => {
        // 1. Category Filter
        if (selectedCategory !== 'all') {
            const cat = TASK_CATEGORIES.find(c => c.id === selectedCategory);
            if (!cat?.types.includes(item.type)) return false;
        }

        // 2. Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const patientName = getPatientDisplayName(item).toLowerCase();
            return (
                patientName.includes(q) ||
                item.subject?.toLowerCase().includes(q) ||
                item.body?.toLowerCase().includes(q)
            );
        }

        return true;
    });

    // --- Actions ---

    const handleAction = async (action, note = null) => {
        if (!selectedItem) return;

        try {
            if (action === 'complete') {
                await inboxAPI.update(selectedItem.id, { status: 'completed' });
                showSuccess('Item marked as completed');
                setSelectedItem(null);
                fetchData(true); // Refresh list
            } else if (action === 'reply' && note) {
                await inboxAPI.addNote(selectedItem.id, note, false);
                showSuccess('Internal note added');
                setReplyText('');
                // Refresh details only
                const res = await inboxAPI.getDetails(selectedItem.id);
                setDetails(res.data);
            } else if (action === 'replyExternal' && note) {
                await inboxAPI.addNote(selectedItem.id, note, true);
                showSuccess('Reply sent to patient');
                setReplyText('');
                // Refresh details only & list (it might mark as read/complete)
                const res = await inboxAPI.getDetails(selectedItem.id);
                setDetails(res.data);
                fetchData(true);
            } else if (action === 'assign') {
                // handled by modal
            }
        } catch (e) {
            console.error('Action failed:', e);
            showError('Action failed');
        }
    };

    const assignItem = async (userId) => {
        if (!selectedItem) return;
        try {
            await inboxAPI.update(selectedItem.id, { assignedUserId: userId });
            showSuccess(`Assigned to ${users.find(u => u.id === userId)?.last_name || 'user'}`);
            setShowAssignModal(false);
            fetchData(true);
        } catch (e) {
            showError('Failed to assign');
        }
    };

    const openPatientChart = (item) => {
        const pid = item.patient_id || item.patientId;
        if (pid) {
            navigate(`/patient/${pid}/snapshot`);
        } else {
            showError('No patient attached to this item');
        }
    };

    const handlePatientSearch = async (query) => {
        setPatientQuery(query);
        if (query.length < 2) {
            setPatientResults([]);
            return;
        }
        setIsSearchingPatients(true);
        try {
            const res = await patientsAPI.search(query);
            setPatientResults(res.data || []);
        } catch (e) {
            console.error('Patient search error:', e);
        } finally {
            setIsSearchingPatients(false);
        }
    };

    const handleComposeSubmit = async () => {
        if (!composeData.subject || (!composeData.assignedUserId && composeData.type === 'task')) {
            showError('Subject and recipient are required');
            return;
        }
        try {
            await inboxAPI.create(composeData);
            showSuccess('Item created');
            setShowCompose(false);
            setComposeData({ type: 'task', subject: '', body: '', patientId: '', priority: 'normal', assignedUserId: user?.id });
            setPatientQuery('');
            setPatientResults([]);
            fetchData(true);
        } catch (e) {
            showError('Failed to create item');
        }
    };

    const handleApproveAppointment = async () => {
        if (!approvalData.providerId || !approvalData.appointmentDate || !approvalData.appointmentTime) {
            showError('Provider, date, and time are required');
            return;
        }
        try {
            await inboxAPI.approveAppointment(selectedItem.id, approvalData);
            showSuccess('Appointment scheduled successfully!');
            setShowApproveModal(false);
            setApprovalData({ providerId: '', appointmentDate: '', appointmentTime: '', duration: 30 });
            setSelectedItem(null);
            fetchData(true);
        } catch (e) {
            showError('Failed to approve appointment');
        }
    };

    // --- Helpers ---

    const getPriorityColor = (p) => {
        if (p === 'stat' || p === 'urgent') return 'text-red-600 bg-red-50 border-red-200';
        return 'text-blue-600 bg-blue-50 border-blue-200';
    };

    const getCategoryIcon = (type) => {
        const cat = TASK_CATEGORIES.find(c => c.types.includes(type));
        const Icon = cat?.icon || Inbox;
        return <Icon className={`w-4 h-4 text-${cat?.color || 'gray'}-500`} />;
    };

    return (
        <div className="h-[calc(100vh-64px)] flex bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <Inbox className="w-5 h-5" /> In Basket
                    </h2>

                    <button
                        onClick={() => setShowCompose(true)}
                        className="w-full mb-4 py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <PlusIcon className="w-5 h-5" /> Compose New
                    </button>

                    <div className="flex gap-2 text-xs">
                        <button
                            onClick={() => setAssignedFilter('all')}
                            className={`flex-1 py-1 px-2 rounded-md ${assignedFilter === 'all' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            All Items
                        </button>
                        <button
                            onClick={() => setAssignedFilter('me')}
                            className={`flex-1 py-1 px-2 rounded-md ${assignedFilter === 'me' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            My Items ({stats.my_count || 0})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === 'all' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center gap-2"><Inbox className="w-4 h-4" /> All Categories</span>
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{items.length}</span>
                    </button>

                    {TASK_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === cat.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                <cat.icon className={`w-4 h-4 text-${cat.color}-500`} />
                                {cat.label}
                            </span>
                            {/* Note: counting locally based on types, or use stats if available per type */}
                            <span className="bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full text-xs">
                                {items.filter(i => cat.types.includes(i.type)).length}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">View</h3>
                    <div className="space-y-1">
                        <button onClick={() => setFilterStatus('new')} className={`w-full text-left px-2 py-1 text-sm rounded ${filterStatus === 'new' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Current</button>
                        <button onClick={() => setFilterStatus('completed')} className={`w-full text-left px-2 py-1 text-sm rounded ${filterStatus === 'completed' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Completed</button>
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                <div className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button onClick={() => fetchData(true)} className={`p-2 text-gray-500 hover:bg-gray-100 rounded-full ${refreshing ? 'animate-spin' : ''}`}>
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && !refreshing && items.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-gray-400">Loading...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-full text-gray-400">
                            <Inbox className="w-12 h-12 mb-2 opacity-20" />
                            <p>No items found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-100' : ''} ${item.status === 'new' ? 'border-l-4 border-l-blue-500 pl-3' : 'border-l-4 border-l-transparent pl-3'}`}
                                >
                                    <div className="mt-1">{getCategoryIcon(item.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className={`text-sm truncate pr-2 ${item.status === 'new' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                {item.subject || 'No Subject'}
                                            </h3>
                                            <span className="text-xs text-gray-500 whitespace-nowrap">{format(new Date(item.created_at || item.createdAt), 'MMM d, h:mm a')}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate mt-0.5">
                                            {getPatientDisplayName(item)}
                                            <span className="text-gray-400 mx-1">•</span>
                                            {item.body || item.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getPriorityColor(item.priority)} uppercase font-bold tracking-wider`}>
                                                {item.priority || 'Normal'}
                                            </span>
                                            {item.assigned_first_name && (
                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {item.assigned_first_name}
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

            {/* Detail Pane (Right) */}
            {selectedItem && (
                <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
                    {/* Detail Header */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(selectedItem.priority)} uppercase font-bold`}>
                                    {selectedItem.priority}
                                </span>
                                <span className="text-xs text-gray-500 capitalize">{selectedItem.type.replace('_', ' ')}</span>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight mb-1">{selectedItem.subject}</h2>
                        <button onClick={() => openPatientChart(selectedItem)} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                            {getPatientDisplayName(selectedItem)}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Detail Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loadingDetails ? (
                            <div className="flex justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin text-gray-300" /></div>
                        ) : (
                            <div className="space-y-6">
                                {/* Main Body */}
                                <div className="prose prose-sm max-w-none text-gray-800">
                                    <p className="whitespace-pre-wrap">{details?.body || selectedItem.body}</p>
                                </div>

                                {/* Attachments / Reference */}
                                {(details?.reference_table === 'documents' || details?.type === 'document' || details?.type === 'imaging') && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                                        <FileText className="w-8 h-8 text-orange-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{details?.subject || 'Document'}</p>
                                            <p className="text-xs text-gray-500">Document/Result Attachment</p>
                                        </div>
                                        <button onClick={() => openPatientChart(selectedItem)} className="text-blue-600 text-xs font-medium whitespace-nowrap">View</button>
                                    </div>
                                )}
                                {details?.type === 'referral' && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center gap-3">
                                        <Send className="w-8 h-8 text-indigo-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-indigo-900 truncate">Outgoing Referral</p>
                                            <p className="text-xs text-indigo-600">Patient needs specialist consultation</p>
                                        </div>
                                        <button onClick={() => openPatientChart(selectedItem)} className="text-indigo-600 text-xs font-bold whitespace-nowrap">View Case</button>
                                    </div>
                                )}
                                {details?.type === 'note' && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center gap-3">
                                        <FileText className="w-8 h-8 text-emerald-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-emerald-900 truncate">Clinical Note to Sign</p>
                                            <p className="text-xs text-emerald-600">Unsigned draft from {details.created_at ? format(new Date(details.created_at), 'MM/dd/yyyy') : 'recent visit'}</p>
                                        </div>
                                        <button onClick={() => openPatientChart(selectedItem)} className="text-emerald-600 text-xs font-bold whitespace-nowrap">Sign Now</button>
                                    </div>
                                )}
                                {details?.type === 'portal_message' && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3">
                                        <MessageSquare className="w-8 h-8 text-blue-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-blue-900">Incoming Portal Message</p>
                                            <p className="text-xs text-blue-600">Reply to patient via the Message center</p>
                                        </div>
                                        <button onClick={() => openPatientChart(selectedItem)} className="text-blue-600 text-xs font-bold whitespace-nowrap">Open Thread</button>
                                    </div>
                                )}
                                {details?.type === 'portal_appointment' && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Calendar className="w-8 h-8 text-amber-500" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-amber-900">Appointment Request</p>
                                                <p className="text-xs text-amber-600">Patient prefers {details.body?.split('\n')[0] || 'date/time in notes'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => setShowApproveModal(true)}
                                                className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Approve & Schedule
                                            </button>
                                            <button
                                                onClick={() => handleAction('complete')}
                                                className="px-3 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Thread / Notes */}
                                {details?.notes && details.notes.length > 0 && (
                                    <div className="border-t border-gray-100 pt-4 mt-6">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Activity</h3>
                                        <div className="space-y-4">
                                            {details.notes.map(note => {
                                                const isPatient = note.sender_type === 'patient';
                                                return (
                                                    <div key={note.id} className={`flex gap-3 ${isPatient ? 'flex-row-reverse' : ''}`}>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isPatient ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {note.first_name ? note.first_name[0] : 'U'}
                                                        </div>
                                                        <div className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                                            <div className={`flex items-baseline gap-2 mb-1 ${isPatient ? 'flex-row-reverse' : ''}`}>
                                                                <span className="text-sm font-bold text-gray-900">{note.first_name} {note.last_name}</span>
                                                                <span className="text-xs text-gray-400">{format(new Date(note.created_at), 'MMM d, h:mm a')}</span>
                                                            </div>
                                                            <div className={`px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${isPatient
                                                                    ? 'bg-emerald-600 text-white rounded-tr-none'
                                                                    : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'
                                                                }`}>
                                                                {note.note}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reply / Actions Box */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!replyText.trim()) return;

                                    if (selectedItem.type === 'portal_message') {
                                        handleAction('replyExternal', replyText);
                                    } else {
                                        handleAction('reply', replyText);
                                    }
                                }
                            }}
                            placeholder="Write a note or reply... (Enter to send)"
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2 h-20 resize-none"
                        />
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-md"
                                    title="Assign to someone else"
                                >
                                    <User className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                {selectedItem.type === 'portal_message' && (
                                    <button
                                        disabled={!replyText.trim()}
                                        onClick={() => handleAction('replyExternal', replyText)}
                                        className="px-3 py-1.5 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                                    >
                                        <Send className="w-4 h-4" /> Reply to Patient
                                    </button>
                                )}
                                <button
                                    disabled={!replyText.trim()}
                                    onClick={() => handleAction('reply', replyText)}
                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-medium text-sm rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Add Note
                                </button>
                                <button
                                    onClick={() => handleAction('complete')}
                                    className="px-3 py-1.5 bg-green-600 text-white font-medium text-sm rounded-md hover:bg-green-700 shadow-sm flex items-center gap-1"
                                >
                                    <CheckCircle className="w-4 h-4" /> Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
                        <h3 className="text-lg font-bold mb-4">Assign Task</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                            <button
                                onClick={() => assignItem(user.id)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">Me</div>
                                Myself
                            </button>
                            {users.filter(u => u.id !== user.id).map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => assignItem(u.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                                >
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-xs font-bold">
                                        {u.first_name ? u.first_name[0] : 'U'}
                                    </div>
                                    {u.first_name} {u.last_name}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAssignModal(false)} className="w-full py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    </div>
                </div>
            )}
            {/* Compose Modal */}
            {showCompose && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <h3 className="text-lg font-bold">New Task / Message</h3>
                            <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                    <select
                                        value={composeData.type}
                                        onChange={e => setComposeData({ ...composeData, type: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    >
                                        <option value="task">Clinical Task</option>
                                        <option value="message">Staff Message</option>
                                        <option value="refill">Rx Request</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                                    <select
                                        value={composeData.priority}
                                        onChange={e => setComposeData({ ...composeData, priority: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="stat">STAT</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign To</label>
                                <select
                                    value={composeData.assignedUserId}
                                    onChange={e => setComposeData({ ...composeData, assignedUserId: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Attached Patient (Optional)</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search patient name..."
                                        value={patientQuery}
                                        onChange={e => handlePatientSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>

                                {patientResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-lg z-10 max-h-40 overflow-y-auto">
                                        {patientResults.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setComposeData({ ...composeData, patientId: p.id });
                                                    setPatientQuery(`${p.first_name} ${p.last_name}`);
                                                    setPatientResults([]);
                                                }}
                                                className="w-full text-left p-2 hover:bg-gray-50 text-sm border-b border-gray-100"
                                            >
                                                <span className="font-bold">{p.first_name} {p.last_name}</span>
                                                <span className="text-gray-400 ml-2">DOB: {p.dob ? format(new Date(p.dob), 'MM/dd/yyyy') : 'N/A'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                                <input
                                    type="text"
                                    placeholder="Brief title of the task/message"
                                    value={composeData.subject}
                                    onChange={e => setComposeData({ ...composeData, subject: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instructions / Body</label>
                                <textarea
                                    placeholder="Provide detailed instructions or the message content..."
                                    value={composeData.body}
                                    onChange={e => setComposeData({ ...composeData, body: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm h-32 resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCompose(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComposeSubmit}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700"
                            >
                                Send / Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Approval Modal */}
            {showApproveModal && selectedItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-emerald-50">
                            <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5" /> Approve & Schedule Appointment
                            </h3>
                            <p className="text-sm text-emerald-600 mt-1">Schedule this patient's appointment request</p>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                <select
                                    value={approvalData.providerId}
                                    onChange={e => setApprovalData({ ...approvalData, providerId: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                >
                                    <option value="">Select provider...</option>
                                    {users.filter(u => u.role === 'clinician' || u.role === 'physician').map(u => (
                                        <option key={u.id} value={u.id}>Dr. {u.last_name}, {u.first_name}</option>
                                    ))}
                                    {users.filter(u => u.role !== 'clinician' && u.role !== 'physician').map(u => (
                                        <option key={u.id} value={u.id}>{u.last_name}, {u.first_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={approvalData.appointmentDate}
                                        onChange={e => setApprovalData({ ...approvalData, appointmentDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={approvalData.appointmentTime}
                                        onChange={e => setApprovalData({ ...approvalData, appointmentTime: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Provider Schedule Visualization */}
                            {approvalData.providerId && approvalData.appointmentDate && (
                                <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Schedule for {new Date(approvalData.appointmentDate).toLocaleDateString()}
                                    </h4>
                                    <DaySchedulePreview
                                        date={approvalData.appointmentDate}
                                        providerId={approvalData.providerId}
                                        selectedTime={approvalData.appointmentTime}
                                        duration={approvalData.duration}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                                <select
                                    value={approvalData.duration}
                                    onChange={e => setApprovalData({ ...approvalData, duration: parseInt(e.target.value) })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>60 minutes</option>
                                </select>
                            </div>
                            {details?.body && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">Patient's Request</p>
                                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{details.body}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApproveAppointment}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 flex items-center gap-1"
                            >
                                <CheckCircle className="w-4 h-4" /> Schedule Appointment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper component for schedule preview
const DaySchedulePreview = ({ date, providerId, selectedTime, duration }) => {
    const [schedule, setSchedule] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchSchedule = async () => {
            try {
                setLoading(true);
                // Fetch appointments for the day
                const res = await appointmentsAPI.get({
                    view: 'day',
                    date: date,
                    providerId: providerId
                });
                setSchedule(res.data || []);
            } catch (err) {
                console.error('Failed to fetch schedule', err);
            } finally {
                setLoading(false);
            }
        };

        if (date && providerId) {
            fetchSchedule();
        }
    }, [date, providerId]);

    if (loading) return <div className="text-xs text-slate-400 p-2 text-center">Loading schedule...</div>;

    // Simple visualization
    // Sort appointments by time
    const sorted = [...schedule].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

    return (
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {sorted.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-2">No appointments scheduled yet</div>
            ) : (
                sorted.map(appt => (
                    <div key={appt.id} className="flex items-center gap-2 text-xs p-1.5 bg-white border border-slate-100 rounded shadow-sm">
                        <span className="font-bold text-slate-700 w-16">{appt.appointment_time.slice(0, 5)}</span>
                        <span className="text-slate-500 truncate flex-1">{appt.patient_name || 'Patient'}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 px-1 rounded">{appt.appointment_type}</span>
                    </div>
                ))
            )}
            {/* Show where the new appointment would fit if time selected */}
            {selectedTime && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs p-1.5 bg-emerald-50 border border-emerald-100 rounded ring-1 ring-emerald-200">
                        <span className="font-bold text-emerald-700 w-16">{selectedTime}</span>
                        <span className="text-emerald-600 font-bold italic">New Appointment ({duration}m)</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inbasket;
