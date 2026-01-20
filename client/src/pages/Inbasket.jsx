import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    CheckCircle as CheckCircleIcon, Clock, AlertTriangle, MessageSquare, FileText, Inbox,
    Pill, FlaskConical, Image, Send, RefreshCw, Filter, Search,
    ChevronRight, X, Plus, Bell, User, Calendar, Phone, Paperclip,
    ArrowRight, Check, ArrowLeft, ChevronLeft, Eye, UserPlus, Mail
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
    { id: 'portal_appointments', label: 'Appt Requests', icon: Calendar, color: 'amber', types: ['portal_appointment'] },
    { id: 'documents', label: 'Documents', icon: FileText, color: 'orange', types: ['document', 'new_patient_registration'] },
    { id: 'referrals', label: 'Referrals', icon: Send, color: 'indigo', types: ['referral'] },
    { id: 'tasks', label: 'Tasks', icon: CheckCircleIcon, color: 'green', types: ['task', 'note'] },
    { id: 'refills', label: 'Rx Requests', icon: Pill, color: 'red', types: ['refill'] },
];

import IntakeReviewModal from '../components/IntakeReviewModal';

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

    const [showCompose, setShowCompose] = useState(false);
    const [showInlineCompose, setShowInlineCompose] = useState(false);
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [showIntakeReview, setShowIntakeReview] = useState(false);
    const [composeData, setComposeData] = useState({
        type: 'task',
        subject: '',
        body: '',
        patientId: '',
        priority: 'normal',
        assignedUserId: user?.id
    });

    // Advanced Patient Search State
    const [searchFields, setSearchFields] = useState({ name: '', dob: '', phone: '', mrn: '' });
    const [patientResults, setPatientResults] = useState([]);
    const [isSearchingPatients, setIsSearchingPatients] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState(null);

    // Global Filter State
    const [showBackground, setShowBackground] = useState(false);

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
    const [suggestedSlots, setSuggestedSlots] = useState([]); // Array of {date, time}

    // Autofill approval data when modal opens
    useEffect(() => {
        if (showApproveModal && selectedItem) {
            setSuggestedSlots([]); // Clear suggestions

            // Default provider to assigned user (which now includes ar.provider_id from sync)
            let providerId = selectedItem.assigned_user_id || '';

            // Attempt to parse Date and Time from body
            // Format: "Preferred Date: 2026-01-03 (At 10:00)"
            let date = '';
            let time = '';

            const body = selectedItem.body || '';
            const dateMatch = body.match(/Preferred Date: (\d{4}-\d{2}-\d{2})/);
            if (dateMatch) date = dateMatch[1];

            const timeMatch = body.match(/\(At (\d{2}:\d{2})\)/);
            if (timeMatch) time = timeMatch[1];

            // NEW: Detect [ACCEPTED_SLOT:YYYY-MM-DDTHH:mm]
            const acceptedMatch = body.match(/\[ACCEPTED_SLOT:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\]/);
            if (acceptedMatch) {
                date = acceptedMatch[1];
                time = acceptedMatch[2];
            }

            setApprovalData(prev => ({
                ...prev,
                providerId: providerId || prev.providerId,
                appointmentDate: date || prev.appointmentDate,
                appointmentTime: time || prev.appointmentTime,
                duration: 30
            }));
        }
    }, [showApproveModal, selectedItem, users]); // Added users as dependency

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
            const validTypes = TASK_CATEGORIES.flatMap(c => c.types);
            const filteredData = (response.data || []).filter(item => validTypes.includes(item.type));
            setItems(filteredData);

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

    // Handle initial selection from URL query param (?id=... or ?filter=...)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const itemId = searchParams.get('id');
        const filterType = searchParams.get('filter');

        // Pre-select category based on filter param
        if (filterType === 'portal_appointment') {
            // Select the portal_appointments category directly
            setSelectedCategory('portal_appointments');
            setSearchQuery(''); // Clear any existing search
        }

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

        // 2. Background Task Filter (Hide unless showBackground is true)
        const isBackground = (item.type === 'document' && (!item.body || ['other', 'profile_photo', 'background_upload', 'administrative'].includes(item.body))) ||
            item.type === 'new_patient_registration';
        if (isBackground && !showBackground) return false;

        // 3. Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const patientName = getPatientDisplayName(item).toLowerCase();
            const mrn = (item.patient_mrn || '').toLowerCase();
            const dob = (item.patient_dob || '');
            return (
                patientName.includes(q) ||
                mrn.includes(q) ||
                dob.includes(q) ||
                item.subject?.toLowerCase().includes(q) ||
                item.body?.toLowerCase().includes(q)
            );
        }

        return true;
    });

    // --- Actions ---

    const chatEndRef = useRef(null);
    const historyRef = useRef(null);

    const scrollToChatBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const scrollToHistory = () => {
        historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    useEffect(() => {
        if (details?.notes) {
            scrollToChatBottom();
        }
    }, [details]);

    const handleAction = async (action, note = null) => {
        if (!selectedItem) return;

        try {
            if (action === 'complete') {
                await inboxAPI.update(selectedItem.id, { status: 'completed' });
                showSuccess('Item marked as completed');
                setSelectedItem(null);
                setDetails(null);
                fetchData(true); // Refresh list
            } else if (action === 'reply' && note) {
                await inboxAPI.addNote(selectedItem.id, note, false);
                showSuccess('Internal note added');
                setReplyText('');
                // Refresh details
                const res = await inboxAPI.getDetails(selectedItem.id);
                setDetails(res.data);
            } else if (action === 'replyExternal' && note) {
                await inboxAPI.addNote(selectedItem.id, note, true);
                showSuccess('Reply sent to patient');
                setReplyText('');
                // Refresh details
                const res = await inboxAPI.getDetails(selectedItem.id);
                setDetails(res.data);
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

    const triggerPatientSearch = async () => {
        const hasFilters = Object.values(searchFields).some(v => v.trim() !== '');
        if (!hasFilters) {
            setPatientResults([]);
            return;
        }

        setIsSearchingPatients(true);
        try {
            // Clean fields to avoid sending empty strings that might confuse backend
            const cleanFields = {};
            if (searchFields.name?.trim()) cleanFields.name = searchFields.name.trim();
            if (searchFields.dob?.trim()) cleanFields.dob = searchFields.dob.trim();
            if (searchFields.phone?.trim()) cleanFields.phone = searchFields.phone.trim();
            if (searchFields.mrn?.trim()) cleanFields.mrn = searchFields.mrn.trim();

            const res = await patientsAPI.search(cleanFields);
            setPatientResults(res.data || []);
        } catch (e) {
            console.error('Patient search error:', e);
        } finally {
            setIsSearchingPatients(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            triggerPatientSearch();
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [searchFields]);

    const handleComposeSubmit = async () => {
        if (!composeData.subject || (!composeData.assignedUserId && composeData.type === 'task')) {
            showError('Subject and recipient are required');
            return;
        }

        if (composeData.type === 'portal_message' && !selectedPatient) {
            showError('A patient must be selected to send a portal message');
            return;
        }

        try {
            if (composeData.type === 'portal_message') {
                await inboxAPI.sendPatientMessage({
                    patientId: selectedPatient.id,
                    subject: composeData.subject,
                    body: composeData.body
                });
                showSuccess('Portal message sent to patient');
            } else {
                await inboxAPI.create(composeData);
                showSuccess('Item created');
            }
            setShowCompose(false);
            setShowInlineCompose(false);
            setComposeData({ type: 'task', subject: '', body: '', patientId: '', priority: 'normal', assignedUserId: user?.id });
            setSearchFields({ name: '', dob: '', phone: '', mrn: '' });
            setSelectedPatient(null);
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
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{filteredItems.length}</span>
                    </button>

                    {TASK_CATEGORIES.map(cat => {
                        const canCompose = ['portal_messages', 'tasks', 'messages'].includes(cat.id);
                        const isSelected = selectedCategory === cat.id;

                        return (
                            <div key={cat.id} className="group relative">
                                <button
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all ${isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <cat.icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                                        {cat.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                                            {items.filter(i => cat.types.includes(i.type)).length}
                                        </span>
                                    </div>
                                </button>
                                {canCompose && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCategory(cat.id);
                                            // Pre-select type based on category
                                            const typeMap = { 'portal_messages': 'portal_message', 'tasks': 'task', 'messages': 'message' };
                                            setComposeData(prev => ({ ...prev, type: typeMap[cat.id] || 'task' }));
                                            setShowCompose(true);
                                        }}
                                        className={`absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 text-gray-400`}
                                        title={`New ${cat.label}`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">View Filters</h3>
                    <div className="space-y-1">
                        <button onClick={() => setFilterStatus('new')} className={`w-full text-left px-2 py-1 text-sm rounded ${filterStatus === 'new' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 transition-colors'}`}>Current Items</button>
                        <button onClick={() => setFilterStatus('completed')} className={`w-full text-left px-2 py-1 text-sm rounded ${filterStatus === 'completed' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 transition-colors'}`}>Completed</button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={showBackground}
                                onChange={e => setShowBackground(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Show Background Activities</span>
                        </label>
                        <p className="text-[10px] text-gray-400 mt-1 pl-6 italic">Hidden uploads/system logs</p>
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                <div className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative max-w-xs w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search list..."
                                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>

                        {['portal_messages', 'tasks', 'messages', 'refills'].includes(selectedCategory) && (
                            <button
                                onClick={() => {
                                    if (selectedCategory === 'portal_messages' || selectedCategory === 'messages') {
                                        setShowInlineCompose(!showInlineCompose);
                                        const type = selectedCategory === 'portal_messages' ? 'portal_message' : 'message';
                                        setComposeData(prev => ({ ...prev, type }));
                                        if (selectedCategory === 'messages') {
                                            setSelectedStaff(null);
                                        } else {
                                            setSelectedPatient(null);
                                        }
                                    } else {
                                        const typeMap = { 'tasks': 'task', 'refills': 'refill' };
                                        setComposeData(prev => ({ ...prev, type: typeMap[selectedCategory] || 'task' }));
                                        setShowCompose(true);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all animate-in fade-in slide-in-from-left-2 shadow-sm active:scale-95 ${showInlineCompose && (selectedCategory === 'portal_messages' || selectedCategory === 'messages') ? 'bg-gray-100 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                                {showInlineCompose && (selectedCategory === 'portal_messages' || selectedCategory === 'messages') ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {showInlineCompose && (selectedCategory === 'portal_messages' || selectedCategory === 'messages') ? 'Cancel' : `New ${selectedCategory === 'messages' ? 'Staff Message' : TASK_CATEGORIES.find(c => c.id === selectedCategory)?.label.replace('s', '') || 'Item'}`}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchData(true)} className={`p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors ${refreshing ? 'animate-spin text-blue-500' : ''}`}>
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
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
                            {showInlineCompose && (selectedCategory === 'portal_messages' || selectedCategory === 'messages') && (
                                <div className="p-6 bg-blue-50/50 border-b border-blue-100 animate-in slide-in-from-top-4 duration-300">
                                    <div className="max-w-xl mx-auto space-y-4">
                                        {selectedCategory === 'portal_messages' ? (
                                            /* Portal Message Inline Composer */
                                            !selectedPatient ? (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                                                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">1. Find Patient</label>
                                                        <button
                                                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                                            className="text-[10px] bg-white px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-bold shadow-sm"
                                                        >
                                                            {showAdvancedSearch ? 'Switch to Name Search' : 'Search by DOB / Phone'}
                                                        </button>
                                                    </div>

                                                    {showAdvancedSearch ? (
                                                        <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <input
                                                                type="text"
                                                                placeholder="Name"
                                                                autoFocus
                                                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                                value={searchFields.name}
                                                                onChange={e => setSearchFields({ ...searchFields, name: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="DOB (MM/DD/YYYY)"
                                                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                                value={searchFields.dob}
                                                                onChange={e => setSearchFields({ ...searchFields, dob: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Phone"
                                                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                                value={searchFields.phone}
                                                                onChange={e => setSearchFields({ ...searchFields, phone: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="MRN"
                                                                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                                value={searchFields.mrn}
                                                                onChange={e => setSearchFields({ ...searchFields, mrn: e.target.value })}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="relative group animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 group-focus-within:text-blue-600" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search Name, DOB, Phone or MRN..."
                                                                autoFocus
                                                                className="w-full pl-10 pr-4 py-3 border-2 border-blue-100 rounded-2xl bg-white text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-sm font-medium"
                                                                value={searchFields.name}
                                                                onChange={e => setSearchFields({ ...searchFields, name: e.target.value })}
                                                            />
                                                        </div>
                                                    )}

                                                    {isSearchingPatients && (
                                                        <div className="flex items-center justify-center gap-2 py-4 text-xs text-blue-500 font-bold uppercase tracking-widest animate-pulse">
                                                            <RefreshCw className="w-4 h-4 animate-spin" /> Searching Database...
                                                        </div>
                                                    )}

                                                    {patientResults.length > 0 && (
                                                        <div className="border border-blue-100 rounded-2xl overflow-hidden shadow-xl max-h-56 overflow-y-auto bg-white/80 backdrop-blur-sm ring-1 ring-blue-500/5 mt-1">
                                                            {patientResults.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => setSelectedPatient(p)}
                                                                    className="w-full text-left px-4 py-3 hover:bg-blue-600 hover:text-white border-b border-blue-50 last:border-0 flex justify-between items-center group transition-all"
                                                                >
                                                                    <div>
                                                                        <p className="text-sm font-black group-hover:text-white text-gray-900">{getPatientDisplayName(p)}</p>
                                                                        <p className="text-[10px] group-hover:text-blue-100 text-gray-500 uppercase font-black tracking-tighter">
                                                                            MRN: {p.mrn || 'N/A'} • DOB: {p.dob ? format(new Date(p.dob), 'MM/dd/yyyy') : 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full opacity-0 group-hover:opacity-100 group-hover:bg-white group-hover:text-blue-600 transition-all scale-75 group-hover:scale-100">
                                                                        <Plus className="w-4 h-4" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-200 shadow-sm animate-in zoom-in-95">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black shadow-md">
                                                            {getPatientDisplayName(selectedPatient)[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-900">{getPatientDisplayName(selectedPatient)}</p>
                                                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Secure Chat Terminal</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors rounded-full">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            /* Internal Staff Message Inline Composer */
                                            !selectedStaff ? (
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">1. Select Staff Recipient</label>
                                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                                                        {users.filter(u => u.id !== user.id).map(u => (
                                                            <button
                                                                key={u.id}
                                                                onClick={() => {
                                                                    setSelectedStaff(u);
                                                                    setComposeData(prev => ({ ...prev, assignedUserId: u.id }));
                                                                }}
                                                                className="flex items-center gap-3 p-3 bg-white border border-gray-100 shadow-sm rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                                    {u.first_name[0]}{u.last_name[0]}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-gray-900 truncate">{u.first_name} {u.last_name}</p>
                                                                    <p className="text-[9px] text-gray-400 uppercase font-black">{u.role || 'Staff'}</p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-200 shadow-sm animate-in zoom-in-95">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black shadow-md">
                                                            {selectedStaff.first_name[0]}{selectedStaff.last_name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-900">{selectedStaff.first_name} {selectedStaff.last_name}</p>
                                                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Internal Staff Chat</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => {
                                                        setSelectedStaff(null);
                                                        setComposeData(prev => ({ ...prev, assignedUserId: user?.id }));
                                                    }} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors rounded-full">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )
                                        )}

                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <div className="relative">
                                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Conversation Topic / Subject..."
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                    value={composeData.subject}
                                                    onChange={e => setComposeData({ ...composeData, subject: e.target.value })}
                                                />
                                            </div>
                                            <textarea
                                                placeholder="Type your message here..."
                                                className="w-full p-4 border border-gray-200 rounded-2xl text-sm min-h-[120px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all"
                                                value={composeData.body}
                                                onChange={e => setComposeData({ ...composeData, body: e.target.value })}
                                            />

                                            <div className="flex justify-end gap-3 pt-2">
                                                <button
                                                    onClick={handleComposeSubmit}
                                                    disabled={!composeData.body || !composeData.subject || (selectedCategory === 'portal_messages' ? !selectedPatient : !selectedStaff)}
                                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale transition-all flex items-center gap-2 active:scale-95"
                                                >
                                                    <Send className="w-4 h-4" /> Send Secure Message
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                        <button onClick={scrollToHistory} className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3" /> View Conversation
                                        </button>
                                    </div>
                                )}
                                {details?.type === 'new_patient_registration' && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <UserPlus className="w-8 h-8 text-emerald-500" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-emerald-900 font-bold">New Registration</p>
                                                <p className="text-xs text-emerald-600">Patient intake form submitted.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowIntakeReview(true)}
                                            className="w-full px-3 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Eye className="w-4 h-4" /> Review Submission
                                        </button>
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
                                                <CheckCircleIcon className="w-4 h-4" /> Approve & Schedule
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await inboxAPI.denyAppointment(selectedItem.id);
                                                        showSuccess('Appointment request denied');
                                                        fetchData(true);
                                                        setSelectedItem(null);
                                                    } catch (e) {
                                                        console.error('Failed to deny:', e);
                                                        showError('Failed to deny request');
                                                    }
                                                }}
                                                className="px-3 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Thread / Notes */}
                                {details?.notes && details.notes.length > 0 && (
                                    <div className="border-t border-gray-100 pt-6 mt-6 scroll-mt-20" ref={historyRef}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conversation History</h3>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">Secure Encryption Active</span>
                                        </div>
                                        <div className="space-y-6">
                                            {details.notes.map(note => {
                                                const isPatient = note.sender_type === 'patient';
                                                return (
                                                    <div key={note.id} className={`flex gap-3 ${!isPatient ? 'flex-row-reverse' : ''}`}>
                                                        {/* Avatar */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 shadow-sm border ${isPatient
                                                            ? 'bg-white border-gray-200 text-gray-500'
                                                            : 'bg-blue-600 border-blue-700 text-white'
                                                            }`}>
                                                            {note.first_name ? note.first_name[0] : 'U'}
                                                        </div>

                                                        {/* Bubble Container */}
                                                        <div className={`flex flex-col ${!isPatient ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                                            <div className={`flex items-baseline gap-2 mb-1.5 ${!isPatient ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                                                <span className={`text-[11px] font-black tracking-tight ${!isPatient ? 'text-blue-700' : 'text-gray-900'}`}>
                                                                    {note.first_name} {note.last_name}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{format(new Date(note.created_at), 'h:mm a')}</span>
                                                            </div>

                                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${!isPatient
                                                                ? 'bg-blue-600 text-white rounded-tr-none ring-1 ring-blue-700'
                                                                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                                                }`}>
                                                                {note.note}
                                                            </div>
                                                            {!isPatient && (
                                                                <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                                                    <CheckCircleIcon className="w-2.5 h-2.5 text-blue-500" /> Delivered to Portal
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={chatEndRef} className="h-2" />
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
                                    <CheckCircleIcon className="w-4 h-4" /> Done
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
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest">1. Choose Communication Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setComposeData({ ...composeData, type: 'task' })}
                                        className={`p-3 rounded-lg border text-left transition-all ${composeData.type !== 'portal_message' ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <MessageSquare className={`w-4 h-4 ${composeData.type !== 'portal_message' ? 'text-blue-600' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-bold ${composeData.type !== 'portal_message' ? 'text-blue-900' : 'text-gray-500'}`}>Internal</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 leading-tight">Staff tasks, notes, or internal messages.</p>
                                    </button>

                                    <button
                                        onClick={() => setComposeData({ ...composeData, type: 'portal_message' })}
                                        className={`p-3 rounded-lg border text-left transition-all ${composeData.type === 'portal_message' ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Send className={`w-4 h-4 ${composeData.type === 'portal_message' ? 'text-blue-600' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-bold ${composeData.type === 'portal_message' ? 'text-blue-900' : 'text-gray-500'}`}>Patient Portal</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 leading-tight">Send a secure message to the patient's portal.</p>
                                    </button>
                                </div>

                                {composeData.type !== 'portal_message' && (
                                    <div className="flex gap-4 mt-1">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Sub-Type</label>
                                            <select
                                                value={composeData.type}
                                                onChange={e => setComposeData({ ...composeData, type: e.target.value })}
                                                className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="task">Clinical Task</option>
                                                <option value="message">Staff Message</option>
                                                <option value="refill">Rx Refill Request</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Priority</label>
                                            <select
                                                value={composeData.priority}
                                                onChange={e => setComposeData({ ...composeData, priority: e.target.value })}
                                                className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="urgent">Urgent</option>
                                                <option value="stat">STAT</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {composeData.type !== 'portal_message' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign To</label>
                                    <select
                                        value={composeData.assignedUserId}
                                        onChange={e => setComposeData({ ...composeData, assignedUserId: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                                <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">Select Patient</label>

                                {selectedPatient ? (
                                    <div className="flex items-center justify-between p-3 bg-blue-100 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                                                {selectedPatient.name?.[0] || 'P'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-blue-900">{selectedPatient.name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}</p>
                                                <p className="text-[10px] text-blue-700">MRN: {selectedPatient.mrn} • DOB: {selectedPatient.dob || selectedPatient.date_of_birth}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedPatient(null)} className="p-1 hover:bg-blue-200 rounded-full text-blue-600 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="Name"
                                                className="border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                                                value={searchFields.name}
                                                onChange={e => setSearchFields({ ...searchFields, name: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="DOB (MM/DD/YYYY)"
                                                className="border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                                                value={searchFields.dob}
                                                onChange={e => setSearchFields({ ...searchFields, dob: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                placeholder="Phone"
                                                className="border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                                                value={searchFields.phone}
                                                onChange={e => setSearchFields({ ...searchFields, phone: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="MRN"
                                                className="border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                                                value={searchFields.mrn}
                                                onChange={e => setSearchFields({ ...searchFields, mrn: e.target.value })}
                                            />
                                        </div>

                                        {patientResults.length > 0 && (
                                            <div className="border border-gray-100 rounded-lg overflow-hidden shadow-inner max-h-40 overflow-y-auto bg-white">
                                                {patientResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedPatient(p);
                                                            setComposeData({ ...composeData, patientId: p.id });
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center justify-between group transition-colors"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{p.name || `${p.first_name} ${p.last_name}`}</p>
                                                            <p className="text-[10px] text-gray-500">MRN: {p.mrn} • DOB: {p.dob || p.date_of_birth}</p>
                                                        </div>
                                                        <Plus className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {isSearchingPatients && (
                                            <p className="text-[10px] text-gray-400 italic">Searching...</p>
                                        )}
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
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instructions / Body</label>
                                <textarea
                                    placeholder="Provide detailed instructions or the message content..."
                                    value={composeData.body}
                                    onChange={e => setComposeData({ ...composeData, body: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCompose(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComposeSubmit}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                Send / Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Approval Modal */}
            {
                showApproveModal && selectedItem && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-gray-200 bg-emerald-50 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                                        <Calendar className="w-5 h-5" /> Approve & Schedule Appointment
                                    </h3>
                                    <p className="text-sm text-emerald-600 mt-1">Schedule this patient's appointment request</p>
                                </div>
                                <button onClick={() => setShowApproveModal(false)} className="text-emerald-800 hover:bg-emerald-100 p-1 rounded-full"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="flex flex-col md:flex-row h-full overflow-hidden">
                                {/* Left Column: Form */}
                                <div className="p-6 space-y-5 flex-1 overflow-y-auto">
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

                                {/* Right Column: Schedule Browser */}
                                <div className="w-full md:w-[380px] bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-4 flex flex-col overflow-y-auto">
                                    {approvalData.providerId ? (
                                        <DaySchedulePreview
                                            date={approvalData.appointmentDate}
                                            providerId={approvalData.providerId}
                                            selectedTime={approvalData.appointmentTime}
                                            duration={approvalData.duration}
                                            onDateChange={(newDate) => setApprovalData(prev => ({ ...prev, appointmentDate: newDate }))}
                                            suggestedSlots={suggestedSlots}
                                            onSlotClick={(slot) => {
                                                // Toggle slot selection
                                                setSuggestedSlots(prev => {
                                                    const exists = prev.find(s => s.date === slot.date && s.time === slot.time);
                                                    if (exists) return prev.filter(s => s !== exists);
                                                    return [...prev, slot];
                                                });
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                                            Select a provider to view schedule
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between gap-3 shrink-0">
                                {suggestedSlots.length > 0 ? (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await inboxAPI.suggestSlots(selectedItem.id, {
                                                    slots: suggestedSlots.map(s => ({ date: s.date, time: s.time }))
                                                });
                                                setShowApproveModal(false);
                                                setSuggestedSlots([]);
                                                showSuccess('Alternative times sent to patient');
                                                fetchData(true);
                                            } catch (e) {
                                                console.error('Failed to suggest slots:', e);
                                                showError('Failed to send suggestions');
                                            }
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:from-amber-600 hover:to-orange-600 shadow-sm flex items-center gap-2"
                                    >
                                        <Clock className="w-4 h-4" />
                                        Send {suggestedSlots.length} Alternative{suggestedSlots.length > 1 ? 's' : ''}
                                    </button>
                                ) : (
                                    <div className="text-xs text-gray-400 flex items-center">
                                        Click available slots to suggest alternatives
                                    </div>
                                )}
                                <div className="flex gap-3">
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
                                        <CheckCircleIcon className="w-4 h-4" /> Schedule
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Intake Review Modal */}
            <IntakeReviewModal
                show={showIntakeReview}
                onClose={() => setShowIntakeReview(false)}
                submissionId={selectedItem?.reference_id}
                onApproved={(patientId) => {
                    setShowIntakeReview(false);
                    setSelectedItem(null);
                    fetchData(true);
                    if (patientId) {
                        navigate(`/patient/${patientId}/snapshot`);
                    }
                }}
            />
        </div >
    );
};

// Helper component for schedule preview
const DaySchedulePreview = ({ date, providerId, selectedTime, duration, onDateChange, suggestedSlots = [], onSlotClick }) => {
    const [schedule, setSchedule] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const currentDate = date ? new Date(date) : new Date();
    const currentDateStr = date || format(new Date(), 'yyyy-MM-dd');

    const changeDay = (days) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        const dateStr = newDate.toISOString().split('T')[0];
        if (onDateChange) onDateChange(dateStr);
    };

    React.useEffect(() => {
        const fetchSchedule = async () => {
            if (!date || !providerId) return;
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

        fetchSchedule();
    }, [date, providerId]);

    // Simple visualization
    // Sort appointments by time
    const sorted = [...schedule].sort((a, b) => {
        const timeA = a.appointment_time || a.time || '';
        const timeB = b.appointment_time || b.time || '';
        return timeA.localeCompare(timeB);
    });

    // Generate timeslots from 8am to 6pm
    const slots = [];
    for (let i = 8; i <= 17; i++) {
        slots.push(`${i.toString().padStart(2, '0')}:00`);
        slots.push(`${i.toString().padStart(2, '0')}:30`);
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3 bg-white p-2 rounded border border-slate-200 shadow-sm">
                <button onClick={() => changeDay(-1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft className="w-4 h-4" /></button>
                <span className="font-bold text-sm">{format(currentDate, 'EEEE, MMM d, yyyy')}</span>
                <button onClick={() => changeDay(1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-slate-200">
                {loading ? (
                    <div className="text-xs text-slate-400 p-8 text-center flex items-center justify-center h-full">Loading schedule...</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {slots.map(slot => {
                            // Find appointment in this slot
                            // robust check for appointment_time
                            const appt = sorted.find(a => (a.appointment_time || a.time || '').startsWith(slot));
                            const isSelected = selectedTime && selectedTime.startsWith(slot);
                            const isSuggested = suggestedSlots.some(s => s.date === currentDateStr && s.time === slot);

                            // Determine row style
                            let rowClass = "hover:bg-slate-50";
                            if (isSelected) rowClass = "bg-emerald-50";
                            else if (isSuggested) rowClass = "bg-amber-50 ring-1 ring-inset ring-amber-200";

                            return (
                                <div
                                    key={slot}
                                    className={`flex items-start text-xs p-2 min-h-[40px] cursor-pointer ${rowClass}`}
                                    onClick={() => {
                                        if (!appt && onSlotClick) {
                                            onSlotClick({ date: currentDateStr, time: slot });
                                        }
                                    }}
                                >
                                    <span className={`font-medium w-14 shrink-0 ${isSuggested ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>{slot}</span>
                                    <div className="flex-1">
                                        {appt ? (
                                            <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded w-full truncate border border-blue-200 cursor-default">
                                                {appt.patient_name || 'Booked'} ({appt.duration}m)
                                            </div>
                                        ) : (
                                            <span className={`${isSuggested ? 'text-amber-600 font-bold' : 'text-slate-300 italic'}`}>
                                                {isSuggested ? 'Suggested' : 'Available'}
                                            </span>
                                        )}
                                    </div>
                                    {isSuggested && <Check className="w-4 h-4 text-amber-600" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="mt-2 text-xs text-slate-400 text-center">
                Click available slots to suggest them
            </div>
        </div>
    );
};

export default Inbasket;
