import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    CheckCircle, Clock, AlertTriangle, MessageSquare, FileText, Inbox,
    Pill, FlaskConical, Image, Send, RefreshCw, Filter, Search,
    ChevronRight, X, Plus, Bell, User, Calendar, Phone, Paperclip,
    ArrowRight, Check, ArrowLeft, ChevronDown, Eye, UserPlus, Mail,
    Trash2, ClipboardList, Users, Tag, BarChart3, FolderOpen, ListTodo
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { inboxAPI, usersAPI, patientsAPI, tasksAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';
import { getPatientDisplayName } from '../utils/patientNameUtils';
import IntakeReviewModal from '../components/IntakeReviewModal';

// Enhanced category structure for eCW-style inbox
const INBOX_SECTIONS = [
    {
        id: 'results',
        label: 'Results',
        icon: FlaskConical,
        color: 'blue',
        description: 'Lab & imaging results for review',
        types: ['lab', 'imaging']
    },
    {
        id: 'documents',
        label: 'Documents',
        icon: FileText,
        color: 'orange',
        description: 'Consult notes, reports, scans',
        types: ['document', 'new_patient_registration']
    },
    {
        id: 'messages',
        label: 'Messages',
        icon: MessageSquare,
        color: 'purple',
        description: 'Patient & staff messages',
        types: ['message', 'portal_message']
    },
    {
        id: 'tasks',
        label: 'Tasks',
        icon: ListTodo,
        color: 'emerald',
        description: 'Follow-ups & assignments',
        types: ['task']
    },
    {
        id: 'referrals',
        label: 'Referrals',
        icon: Send,
        color: 'indigo',
        description: 'Incoming & outgoing referrals',
        types: ['referral']
    },
    {
        id: 'appointments',
        label: 'Appt Requests',
        icon: Calendar,
        color: 'amber',
        description: 'Portal appointment requests',
        types: ['portal_appointment']
    },
    {
        id: 'refills',
        label: 'Rx Requests',
        icon: Pill,
        color: 'red',
        description: 'Medication refill requests',
        types: ['refill']
    },
];

// Quality metric types for tracking
const METRIC_TYPES = [
    { id: 'colonoscopy', label: 'Colonoscopy', color: 'blue' },
    { id: 'mammogram', label: 'Mammogram', color: 'pink' },
    { id: 'bone_density', label: 'Bone Density', color: 'purple' },
    { id: 'a1c', label: 'A1C', color: 'amber' },
    { id: 'lipid_panel', label: 'Lipid Panel', color: 'red' },
    { id: 'pap_smear', label: 'Pap Smear', color: 'rose' },
    { id: 'flu_vaccine', label: 'Flu Vaccine', color: 'green' },
    { id: 'covid_vaccine', label: 'COVID Vaccine', color: 'cyan' },
];

// Task categories
const TASK_CATEGORIES = [
    { id: 'follow_up', label: 'Follow-up', color: 'blue' },
    { id: 'call_patient', label: 'Call Patient', color: 'green' },
    { id: 'schedule', label: 'Schedule', color: 'purple' },
    { id: 'documentation', label: 'Documentation', color: 'orange' },
    { id: 'lab_review', label: 'Lab Review', color: 'red' },
    { id: 'referral', label: 'Referral', color: 'indigo' },
    { id: 'prior_auth', label: 'Prior Auth', color: 'amber' },
    { id: 'other', label: 'Other', color: 'gray' },
];

const InbasketRedesign = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Data State
    const [items, setItems] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({});
    const [taskStats, setTaskStats] = useState({});
    const [users, setUsers] = useState([]);

    // View State
    const [activeSection, setActiveSection] = useState('results');
    const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'reviewed', 'all'
    const [assignedFilter, setAssignedFilter] = useState('me'); // 'all', 'me'
    const [searchQuery, setSearchQuery] = useState('');

    // Selected Item State
    const [selectedItem, setSelectedItem] = useState(null);
    const [details, setDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal States
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showMetricModal, setShowMetricModal] = useState(false);
    const [showIntakeReview, setShowIntakeReview] = useState(false);

    // Review Form State
    const [reviewData, setReviewData] = useState({
        findings: '',
        plan: '',
        metricTags: []
    });

    // Task Creation State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assigned_to: '',
        category: 'follow_up',
        priority: 'routine',
        due_date: ''
    });

    // Reply State
    const [replyText, setReplyText] = useState('');

    // Refs
    const chatEndRef = useRef(null);

    // Fetch inbox items
    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const params = {
                status: filterStatus === 'pending' ? 'new' : filterStatus,
                assignedTo: assignedFilter,
            };

            const [itemsRes, statsRes, taskStatsRes] = await Promise.all([
                inboxAPI.getAll(params),
                inboxAPI.getStats(),
                tasksAPI.getStats()
            ]);

            setItems(itemsRes.data || []);
            setStats(statsRes.data || {});
            setTaskStats(taskStatsRes.data || {});

            if (users.length === 0) {
                const usersRes = await usersAPI.getDirectory();
                setUsers(usersRes.data || []);
            }

        } catch (error) {
            console.error('Error fetching inbasket:', error);
            showError('Failed to load inbox');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus, assignedFilter, users.length]);

    // Fetch tasks separately
    const fetchTasks = useCallback(async () => {
        try {
            const params = {
                assigned_to: assignedFilter === 'me' ? 'me' : undefined,
                status: filterStatus === 'reviewed' ? 'completed' : 'open'
            };
            const res = await tasksAPI.getAll(params);
            setTasks(res.data || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }, [assignedFilter, filterStatus]);

    useEffect(() => {
        fetchData();
        fetchTasks();
        const poll = setInterval(() => {
            fetchData(true);
            if (activeSection === 'tasks') fetchTasks();
        }, 5000);
        return () => clearInterval(poll);
    }, [fetchData, fetchTasks, activeSection]);

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
            } finally {
                setLoadingDetails(false);
            }
        };

        loadDetails();
    }, [selectedItem?.id]);

    // Filter items by active section
    const filteredItems = items.filter(item => {
        const section = INBOX_SECTIONS.find(s => s.id === activeSection);
        if (!section?.types.includes(item.type)) return false;

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

    // Get section counts
    const getSectionCount = (sectionId) => {
        const section = INBOX_SECTIONS.find(s => s.id === sectionId);
        if (sectionId === 'tasks') return taskStats.my_open || 0;
        return items.filter(i => section?.types.includes(i.type)).length;
    };

    // Actions
    const handleReview = async () => {
        if (!selectedItem) return;
        try {
            await inboxAPI.update(selectedItem.id, {
                status: 'completed',
                findings: reviewData.findings,
                plan: reviewData.plan,
                metricTags: reviewData.metricTags
            });
            showSuccess('Item reviewed and signed off');
            setShowReviewModal(false);
            setSelectedItem(null);
            setReviewData({ findings: '', plan: '', metricTags: [] });
            fetchData(true);
        } catch (e) {
            showError('Failed to review item');
        }
    };

    const handleCreateTask = async () => {
        if (!newTask.title || !newTask.assigned_to) {
            showError('Title and assignee are required');
            return;
        }
        try {
            await tasksAPI.create({
                ...newTask,
                patient_id: selectedItem?.patient_id,
                source_inbox_item_id: selectedItem?.id
            });
            showSuccess('Task created successfully');
            setShowTaskModal(false);
            setNewTask({
                title: '',
                description: '',
                assigned_to: '',
                category: 'follow_up',
                priority: 'routine',
                due_date: ''
            });
            fetchTasks();
        } catch (e) {
            showError('Failed to create task');
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            await tasksAPI.complete(taskId);
            showSuccess('Task completed');
            fetchTasks();
        } catch (e) {
            showError('Failed to complete task');
        }
    };

    const handleReply = async (isExternal = false) => {
        if (!replyText.trim() || !selectedItem) return;
        try {
            await inboxAPI.addNote(selectedItem.id, replyText, isExternal);
            showSuccess(isExternal ? 'Reply sent to patient' : 'Note added');
            setReplyText('');
            const res = await inboxAPI.getDetails(selectedItem.id);
            setDetails(res.data);
        } catch (e) {
            showError('Failed to send reply');
        }
    };

    const openPatientChart = (item) => {
        const pid = item?.patient_id || item?.patientId;
        if (pid) navigate(`/patient/${pid}/snapshot`);
        else showError('No patient attached');
    };

    const getPriorityBadge = (priority) => {
        const colors = {
            stat: 'bg-red-100 text-red-700 border-red-200',
            urgent: 'bg-amber-100 text-amber-700 border-amber-200',
            routine: 'bg-blue-100 text-blue-700 border-blue-200',
            normal: 'bg-gray-100 text-gray-600 border-gray-200'
        };
        return colors[priority] || colors.normal;
    };

    return (
        <div className="h-[calc(100vh-64px)] flex bg-gray-50">
            {/* Sidebar */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Inbox className="w-6 h-6 text-blue-600" />
                        Clinical Inbox
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Review results, documents & tasks</p>
                </div>

                {/* Quick Filters */}
                <div className="p-3 border-b border-gray-100 space-y-2">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setAssignedFilter('me')}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${assignedFilter === 'me'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            My Items
                        </button>
                        <button
                            onClick={() => setAssignedFilter('all')}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${assignedFilter === 'all'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            All Items
                        </button>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setFilterStatus('pending')}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${filterStatus === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setFilterStatus('reviewed')}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${filterStatus === 'reviewed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            Reviewed
                        </button>
                    </div>
                </div>

                {/* Section List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {INBOX_SECTIONS.map(section => {
                        const count = getSectionCount(section.id);
                        const isActive = activeSection === section.id;
                        const Icon = section.icon;

                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${isActive
                                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm'
                                        : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${isActive
                                        ? `bg-${section.color}-100`
                                        : 'bg-gray-100'
                                    }`}>
                                    <Icon className={`w-4 h-4 ${isActive
                                            ? `text-${section.color}-600`
                                            : 'text-gray-500'
                                        }`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-700'
                                        }`}>
                                        {section.label}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{section.description}</p>
                                </div>
                                {count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Stats Footer */}
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                            <p className="text-lg font-bold text-blue-600">{stats.all_count || 0}</p>
                            <p className="text-[10px] text-gray-500 uppercase">Total</p>
                        </div>
                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                            <p className="text-lg font-bold text-amber-600">{taskStats.overdue || 0}</p>
                            <p className="text-[10px] text-gray-500 uppercase">Overdue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by patient, subject..."
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={() => setShowTaskModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        New Task
                    </button>

                    <button
                        onClick={() => fetchData(true)}
                        className={`p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 ${refreshing ? 'animate-spin' : ''
                            }`}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : activeSection === 'tasks' ? (
                        // Tasks List
                        <div className="divide-y divide-gray-100">
                            {tasks.map(task => (
                                <div
                                    key={task.id}
                                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-start gap-4"
                                >
                                    <button
                                        onClick={() => handleCompleteTask(task.id)}
                                        className="mt-1 p-1 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all"
                                    >
                                        <Check className={`w-4 h-4 ${task.status === 'completed'
                                                ? 'text-green-500'
                                                : 'text-transparent'
                                            }`} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1 truncate">{task.description}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityBadge(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                            {task.patient_first_name && (
                                                <span className="text-[10px] text-gray-500">
                                                    {task.patient_first_name} {task.patient_last_name}
                                                </span>
                                            )}
                                            {task.due_date && (
                                                <span className="text-[10px] text-gray-400">
                                                    Due: {format(new Date(task.due_date), 'MMM d')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <ListTodo className="w-12 h-12 mb-2 opacity-30" />
                                    <p>No tasks found</p>
                                </div>
                            )}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Inbox className="w-12 h-12 mb-2 opacity-30" />
                            <p>No items in this category</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-all ${selectedItem?.id === item.id
                                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                            : 'border-l-4 border-l-transparent'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 w-2 h-2 rounded-full ${item.status === 'new'
                                                ? 'bg-blue-500'
                                                : 'bg-gray-300'
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className={`text-sm truncate pr-2 ${item.status === 'new'
                                                        ? 'font-bold text-gray-900'
                                                        : 'font-medium text-gray-700'
                                                    }`}>
                                                    {item.subject || 'No Subject'}
                                                </h3>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                    {format(new Date(item.created_at), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-blue-600 hover:underline mt-0.5">
                                                {getPatientDisplayName(item)}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate mt-1">
                                                {item.body}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPriorityBadge(item.priority)}`}>
                                                    {item.priority || 'normal'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel */}
            {selectedItem && (
                <div className="w-[480px] bg-white border-l border-gray-200 flex flex-col">
                    {/* Detail Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityBadge(selectedItem.priority)}`}>
                                    {selectedItem.priority}
                                </span>
                                <h2 className="text-lg font-bold text-gray-900 mt-2">{selectedItem.subject}</h2>
                                <button
                                    onClick={() => openPatientChart(selectedItem)}
                                    className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                                >
                                    {getPatientDisplayName(selectedItem)}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Detail Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loadingDetails ? (
                            <div className="flex justify-center py-8">
                                <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="prose prose-sm max-w-none">
                                    <p className="whitespace-pre-wrap text-gray-700">
                                        {details?.body || selectedItem.body}
                                    </p>
                                </div>

                                {/* Message Thread */}
                                {details?.notes?.length > 0 && (
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Conversation</h4>
                                        <div className="space-y-3">
                                            {details.notes.map((note, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg ${note.sender_type === 'staff'
                                                            ? 'bg-blue-50 ml-8'
                                                            : 'bg-gray-100 mr-8'
                                                        }`}
                                                >
                                                    <p className="text-sm">{note.note}</p>
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {note.first_name} {note.last_name} • {format(new Date(note.created_at), 'MMM d, h:mm a')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        <div ref={chatEndRef} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                        {/* Reply Input for messages */}
                        {['portal_message', 'message'].includes(selectedItem.type) && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder="Type a reply..."
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                    onKeyDown={e => e.key === 'Enter' && handleReply(true)}
                                />
                                <button
                                    onClick={() => handleReply(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    Send
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setShowReviewModal(true)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                            >
                                <Check className="w-4 h-4" />
                                Review & Sign
                            </button>
                            <button
                                onClick={() => {
                                    setNewTask(prev => ({
                                        ...prev,
                                        title: `Follow-up: ${selectedItem.subject}`,
                                        description: `From inbox item: ${selectedItem.body?.substring(0, 100)}...`
                                    }));
                                    setShowTaskModal(true);
                                }}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50"
                            >
                                <ListTodo className="w-4 h-4" />
                                Create Task
                            </button>
                            <button
                                onClick={() => setShowMetricModal(true)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50"
                            >
                                <Tag className="w-4 h-4" />
                                Track Metric
                            </button>
                            <button
                                onClick={() => openPatientChart(selectedItem)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50"
                            >
                                <FolderOpen className="w-4 h-4" />
                                View Chart
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold">Review & Sign Off</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
                                <textarea
                                    value={reviewData.findings}
                                    onChange={e => setReviewData(prev => ({ ...prev, findings: e.target.value }))}
                                    placeholder="Document your clinical findings..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                                <textarea
                                    value={reviewData.plan}
                                    onChange={e => setReviewData(prev => ({ ...prev, plan: e.target.value }))}
                                    placeholder="What action will be taken?"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Track Metrics</label>
                                <div className="flex flex-wrap gap-2">
                                    {METRIC_TYPES.map(metric => (
                                        <button
                                            key={metric.id}
                                            onClick={() => {
                                                setReviewData(prev => ({
                                                    ...prev,
                                                    metricTags: prev.metricTags.includes(metric.id)
                                                        ? prev.metricTags.filter(m => m !== metric.id)
                                                        : [...prev.metricTags, metric.id]
                                                }));
                                            }}
                                            className={`px-2 py-1 rounded-full text-xs font-medium border transition-all ${reviewData.metricTags.includes(metric.id)
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            {metric.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReview}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                            >
                                Sign & Complete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold">Create Task</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Task title..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                                <select
                                    value={newTask.assigned_to}
                                    onChange={e => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="">Select user...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        value={newTask.category}
                                        onChange={e => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    >
                                        {TASK_CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    >
                                        <option value="routine">Routine</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="stat">STAT</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                <input
                                    type="date"
                                    value={newTask.due_date}
                                    onChange={e => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Additional details..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => setShowTaskModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTask}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Metric Tracking Modal */}
            {showMetricModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold">Track Quality Metric</h3>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Select metrics to track for {getPatientDisplayName(selectedItem)}:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {METRIC_TYPES.map(metric => (
                                    <button
                                        key={metric.id}
                                        onClick={() => {
                                            // Toggle metric
                                            setReviewData(prev => ({
                                                ...prev,
                                                metricTags: prev.metricTags.includes(metric.id)
                                                    ? prev.metricTags.filter(m => m !== metric.id)
                                                    : [...prev.metricTags, metric.id]
                                            }));
                                        }}
                                        className={`p-3 rounded-lg border text-left transition-all ${reviewData.metricTags.includes(metric.id)
                                                ? 'bg-blue-50 border-blue-300'
                                                : 'border-gray-200 hover:border-blue-200'
                                            }`}
                                    >
                                        <p className="font-medium text-sm">{metric.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => setShowMetricModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    showSuccess(`${reviewData.metricTags.length} metric(s) tracked`);
                                    setShowMetricModal(false);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                                Save Metrics
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Intake Review Modal */}
            {showIntakeReview && selectedItem && (
                <IntakeReviewModal
                    patientId={selectedItem.patient_id}
                    onClose={() => setShowIntakeReview(false)}
                    onApprove={() => {
                        setShowIntakeReview(false);
                        fetchData(true);
                    }}
                />
            )}
        </div>
    );
};

export default InbasketRedesign;
