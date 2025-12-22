import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, CheckCircle, Clock, AlertTriangle, MessageSquare, FileText,
  Pill, FlaskConical, Image, Send, RefreshCw, Filter, Search,
  ChevronRight, X, Bell, User, Calendar, Phone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { format } from 'date-fns';
import { inboxAPI, messagesAPI, usersAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';

// Task categories like Epic's InBasket
const TASK_CATEGORIES = [
  { id: 'results', label: 'Results', icon: FlaskConical, color: 'blue' },
  { id: 'rx_requests', label: 'Rx Requests', icon: Pill, color: 'green' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, color: 'purple' },
  { id: 'documents', label: 'Documents', icon: FileText, color: 'orange' },
  { id: 'orders', label: 'Orders', icon: Send, color: 'cyan' },
  { id: 'referrals', label: 'Referrals', icon: User, color: 'pink' },
  { id: 'callbacks', label: 'Callbacks', icon: Phone, color: 'yellow' },
  { id: 'appointments', label: 'Scheduling', icon: Calendar, color: 'indigo' },
];

const TaskManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { updateTasks } = useTasks();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [interpretationText, setInterpretationText] = useState('');

  // Custom Task / To Do State
  const [users, setUsers] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ userId: '', instruction: '' });

  // Fetch tasks and messages
  const fetchTasksData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [inboxRes, messagesRes, usersRes] = await Promise.all([
        inboxAPI.getAll({ limit: 50 }),
        messagesAPI.get(),
        usersAPI.getAll()
      ]);

      if (usersRes?.data) {
        // Handle different response structures (array, paginated object, etc.)
        if (Array.isArray(usersRes.data)) {
          setUsers(usersRes.data);
        } else if (usersRes.data.users && Array.isArray(usersRes.data.users)) {
          setUsers(usersRes.data.users);
        } else if (usersRes.data.data && Array.isArray(usersRes.data.data)) {
          setUsers(usersRes.data.data);
        } else {
          console.warn('Users API returned unexpected format:', usersRes.data);
          setUsers([]);
        }
      }

      const inboxTasks = (inboxRes.data || []).map(item => ({
        id: item.id,
        source: 'inbox',
        category: item.type === 'lab' || item.type === 'imaging' ? 'results' : 'documents',
        status: item.reviewed ? 'completed' : 'unread',
        patient: item.patientName,
        patientId: item.patientId,
        title: item.title,
        mrn: item.mrn || 'N/A',
        priority: item.orderData?.critical ? 'high' : 'normal',
        type: item.type.toUpperCase(),
        date: new Date(item.createdAt),
        from: item.orderedBy || item.uploader || 'System',
        critical: item.orderData?.critical === true,
        docData: item.docData || null, // Include full document data for preview
        details: {
          summary: item.description,
          comments: Array.isArray(item.comments) ? item.comments.map(c => c.comment).join('\n') : item.comment,
          ...item.orderData
        }
      }));

      const messageTasks = (messagesRes.data || []).map(msg => ({
        id: msg.id,
        source: 'messages',
        category: msg.message_type === 'task' ? 'orders' : 'messages',
        status: msg.task_status === 'completed' ? 'completed' : (msg.read_at ? 'read' : 'unread'),
        patient: msg.patient_name || 'N/A',
        patientId: msg.patient_id,
        title: msg.subject,
        mrn: msg.patient_mrn || 'N/A',
        priority: msg.priority || 'normal',
        type: msg.message_type.toUpperCase(),
        date: new Date(msg.created_at),
        from: `${msg.from_first_name} ${msg.from_last_name}`,
        critical: msg.priority === 'urgent' || msg.priority === 'high',
        details: {
          body: msg.body,
          subject: msg.subject
        }
      }));

      setTasks([...inboxTasks, ...messageTasks].sort((a, b) => b.date - a.date));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showError('Failed to load In Basket items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, []);

  // Update context whenever tasks change
  useEffect(() => {
    if (updateTasks) {
      updateTasks(tasks);
    }
  }, [tasks, updateTasks]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('unread');
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  // Count tasks by category
  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') {
      return tasks.filter(t => filterStatus === 'all' || t.status === filterStatus).length;
    }
    return tasks.filter(t => t.category === categoryId && (filterStatus === 'all' || t.status === filterStatus)).length;
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesCategory = selectedCategory === 'all' || task.category === selectedCategory;
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesSearch = !searchQuery ||
      task.patient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.mrn.includes(searchQuery);
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Mark task as read/complete/unread
  const handleTaskAction = async (taskId, action, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      if (task.source === 'messages') {
        if (action === 'read') {
          await messagesAPI.markRead(taskId);
        } else if (action === 'complete') {
          await messagesAPI.updateTaskStatus(taskId, 'completed');
        }
      } else if (task.source === 'inbox') {
        if (action === 'save-comment') {
          // Save comment only, do not mark as reviewed, keep in list
          await inboxAPI.saveComment(task.type.toLowerCase(), taskId, { comment: interpretationText || 'Viewed' });
          showSuccess('Note saved to patient chart');
          fetchTasksData(); // Refresh to update view
        } else if (action === 'complete') {
          // Mark as reviewed, removes from list (as it moves to reviewed status)
          await inboxAPI.markReviewed(task.type.toLowerCase(), taskId, { comment: interpretationText || 'Completed' });
          showSuccess('Item signed off');
          setSelectedTask(null);
          setInterpretationText('');
          fetchTasksData();
        }
      } else {
        fetchTasksData();
      }
    } catch (error) {
      console.error(`Error performing action ${action}:`, error);
      showError(`Failed to update item`);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.userId || !taskForm.instruction) {
      showError('Please select a user and enter instructions');
      return;
    }

    if (!selectedTask) return;

    try {
      await messagesAPI.create({
        toUserId: taskForm.userId,
        subject: `Task: ${selectedTask.title || 'Review Item'}`,
        body: `Task assigned regarding ${selectedTask.patient} (MRN: ${selectedTask.mrn}):\n\n${taskForm.instruction}\n\nRelated Item: ${selectedTask.title}`,
        messageType: 'task',
        priority: 'normal',
        patientId: selectedTask.patientId
      });
      showSuccess('Task assigned successfully');
      setShowTaskForm(false);
      setTaskForm({ userId: '', instruction: '' });
    } catch (error) {
      console.error('Error assigning task:', error);
      showError('Failed to assign task');
    }
  };

  // Handle open patient chart
  const handleOpenPatientChart = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (selectedTask && selectedTask.patientId) {
      navigate(`/patient/${selectedTask.patientId}/snapshot`);
    } else if (selectedTask && selectedTask.mrn !== 'N/A') {
      // Fallback to MRN if patientId is somehow missing
      navigate(`/patient/${selectedTask.mrn}/snapshot`);
    } else {
      showError('Patient record not found');
    }
  };

  // Open task detail - don't auto-mark as read
  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
    // Don't automatically mark as read - let user decide
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'normal': return 'text-blue-600 bg-blue-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryColor = (categoryId) => {
    const category = TASK_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 'gray';
    return category.color;
  };

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Categories */}
      <div className="w-64 bg-paper-50 border-r border-paper-200 flex-shrink-0">
        <div className="p-4 border-b border-paper-200">
          <h2 className="text-lg font-bold text-ink-900 flex items-center">
            <Inbox className="w-5 h-5 mr-2 text-paper-600" />
            In Basket
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            {getCategoryCount('all')} items
          </p>
        </div>

        {/* All Items */}
        <div className="p-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === 'all'
              ? 'bg-paper-200 text-ink-900 font-medium'
              : 'text-ink-600 hover:bg-paper-100'
              }`}
          >
            <span className="flex items-center">
              <Inbox className="w-4 h-4 mr-2" />
              All Items
            </span>
            <span className="text-xs bg-paper-300 px-2 py-0.5 rounded-full">
              {getCategoryCount('all')}
            </span>
          </button>
        </div>

        {/* Categories */}
        <div className="p-2 space-y-1">
          {TASK_CATEGORIES.map(category => {
            const Icon = category.icon;
            const count = getCategoryCount(category.id);
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === category.id
                  ? 'bg-paper-200 text-ink-900 font-medium'
                  : 'text-ink-600 hover:bg-paper-100'
                  }`}
              >
                <span className="flex items-center">
                  <Icon className={`w-4 h-4 mr-2 text-${category.color}-500`} />
                  {category.label}
                </span>
                {count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-${category.color}-100 text-${category.color}-700`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Filters */}
        <div className="p-4 border-t border-paper-200 mt-4">
          <h3 className="text-xs font-semibold text-ink-500 uppercase mb-2">Filter by Status</h3>
          <div className="space-y-1">
            {[
              { id: 'unread', label: 'Unread', icon: Bell },
              { id: 'read', label: 'Read', icon: CheckCircle },
              { id: 'completed', label: 'Completed', icon: CheckCircle },
              { id: 'all', label: 'All', icon: Filter },
            ].map(filter => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setFilterStatus(filter.id)}
                  className={`w-full flex items-center px-3 py-1.5 rounded text-sm ${filterStatus === filter.id
                    ? 'bg-paper-200 text-ink-900'
                    : 'text-ink-500 hover:bg-paper-100'
                    }`}
                >
                  <Icon className="w-3 h-3 mr-2" />
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-paper-200 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-ink-900">
              {selectedCategory === 'all' ? 'All Items' : TASK_CATEGORIES.find(c => c.id === selectedCategory)?.label}
            </h1>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search by patient, MRN, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-paper-300 rounded-md text-sm w-64 focus:ring-2 focus:ring-paper-400"
                />
              </div>
              <button
                onClick={() => fetchTasksData(true)}
                className={`p-2 hover:bg-paper-100 rounded-md text-ink-600 ${refreshing ? 'animate-spin' : ''}`}
                title="Refresh In Basket"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="w-8 h-8 border-4 border-paper-200 border-t-paper-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-ink-500 font-medium">Loading In Basket...</p>
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-ink-500">
              <CheckCircle className="w-12 h-12 mb-3 text-green-500" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No items in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-paper-100">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => openTaskDetail(task)}
                  className={`p-4 hover:bg-paper-50 cursor-pointer transition-colors ${task.status === 'unread' ? 'bg-blue-50/30' : ''
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {/* Status indicator */}
                      <div className="mt-1">
                        {task.status === 'unread' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        {task.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {task.status === 'read' && (
                          <div className="w-2 h-2 bg-transparent rounded-full border border-paper-300" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {task.critical && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.type}
                          </span>
                          <span className="text-xs text-ink-500">
                            {format(task.date, 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <h3 className={`mt-1 text-sm ${task.status === 'unread' ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                          {task.title}
                        </h3>
                        <p className="text-sm text-ink-600 mt-0.5">
                          {task.patient !== 'N/A' && (
                            <>
                              <span className="font-medium">{task.patient}</span>
                              <span className="text-ink-400 mx-1">•</span>
                              <span className="text-ink-500">MRN: {task.mrn}</span>
                            </>
                          )}
                          {task.from && (
                            <span className="text-ink-500">From: {task.from}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {showTaskDetail && selectedTask && (
        <div className="w-96 border-l border-paper-200 bg-white flex flex-col z-10">
          <div className="p-4 border-b border-paper-200 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">Task Details</h2>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTaskDetail(false);
              }}
              className="p-1 hover:bg-paper-100 rounded cursor-pointer transition-colors"
            >
              <X className="w-5 h-5 text-ink-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Task Header */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                {selectedTask.critical && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                  {selectedTask.type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedTask.status === 'unread' ? 'bg-blue-100 text-blue-700' :
                  selectedTask.status === 'read' ? 'bg-gray-100 text-gray-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                  {selectedTask.status === 'unread' ? 'Unread' :
                    selectedTask.status === 'read' ? 'Read' :
                      'Completed'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-ink-900">{selectedTask.title}</h3>
              <p className="text-sm text-ink-500 mt-1">
                {format(selectedTask.date, 'MMMM d, yyyy at h:mm a')}
              </p>
            </div>

            {/* Patient Info */}
            {selectedTask.patient !== 'N/A' && (
              <div className="bg-paper-50 rounded-lg p-3 mb-4">
                <h4 className="text-xs font-semibold text-ink-500 uppercase mb-2">Patient</h4>
                <p className="font-medium text-ink-900">{selectedTask.patient}</p>
                <p className="text-sm text-ink-600">MRN: {selectedTask.mrn}</p>
              </div>
            )}

            {/* Task Details / Document Preview */}
            <div className="space-y-4">
              {/* If it's a message, show the body prominently */}
              {selectedTask.details?.body && (
                <div className="bg-white border border-paper-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-ink-400 uppercase mb-2">Message Body</h4>
                  <p className="text-sm text-ink-800 whitespace-pre-wrap leading-relaxed">
                    {selectedTask.details.body}
                  </p>
                </div>
              )}

              {/* Lab Results Table if present */}
              {selectedTask.details?.results && Array.isArray(selectedTask.details.results) && (
                <div className="border border-paper-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-paper-50">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Test</th>
                        <th className="px-3 py-2 font-semibold text-right">Value</th>
                        <th className="px-3 py-2 font-semibold text-center">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-100">
                      {selectedTask.details.results.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium">{r.test || r.name}</td>
                          <td className="px-3 py-2 text-right">{r.value || r.result} {r.unit}</td>
                          <td className="px-3 py-2 text-center text-red-600 font-bold">{r.flag && r.flag !== 'Normal' ? r.flag : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* General Details Mapping */}
              {selectedTask.details && Object.entries(selectedTask.details)
                .filter(([key]) => !['body', 'results', 'subject', 'alert', 'summary', 'comments'].includes(key))
                .map(([key, value]) => {
                  if (typeof value === 'object') return null;
                  return (
                    <div key={key}>
                      <h4 className="text-xs font-semibold text-ink-500 uppercase mb-1">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </h4>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{String(value)}</p>
                    </div>
                  );
                })}

              {/* Comments Section */}
              {selectedTask.details?.comments && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-ink-500 uppercase mb-1">Previous Comments</h4>
                  <p className="text-sm text-ink-700 italic border-l-4 border-paper-200 pl-3 py-1 bg-paper-50 rounded">
                    {selectedTask.details.comments}
                  </p>
                </div>
              )}

              {/* Document Preview */}
              {selectedTask.docData?.file_path && (
                <div className="mt-4 border border-paper-200 rounded-lg overflow-hidden">
                  <div className="bg-paper-100 px-3 py-2 text-xs font-semibold text-ink-500 border-b border-paper-200 flex justify-between items-center">
                    <span className="flex items-center">
                      <FileText className="w-3 h-3 mr-1" />
                      Document Preview
                    </span>
                    <a
                      href={selectedTask.docData.file_path.startsWith('http') ? selectedTask.docData.file_path : `${import.meta.env.VITE_API_URL || ''}${selectedTask.docData.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-paper-600 hover:underline"
                    >
                      Open Full
                    </a>
                  </div>
                  <div className="aspect-[4/5] bg-paper-50 flex items-center justify-center relative min-h-[400px]">
                    {selectedTask.docData.mime_type?.startsWith('image/') ? (
                      <img
                        src={selectedTask.docData.file_path.startsWith('http') ? selectedTask.docData.file_path : `${import.meta.env.VITE_API_URL || ''}${selectedTask.docData.file_path}`}
                        alt="Document"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <iframe
                        src={selectedTask.docData.file_path.startsWith('http') ? selectedTask.docData.file_path : `${import.meta.env.VITE_API_URL || ''}${selectedTask.docData.file_path}#toolbar=0`}
                        className="w-full h-full border-none"
                        title="PDF Preview"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Alert for critical results */}
            {selectedTask.critical && selectedTask.details?.alert && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Alert</p>
                    <p className="text-sm text-red-700">{selectedTask.details.alert}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {/* Actions */}
          <div className="p-4 border-t border-paper-200 mt-auto bg-gray-50/50">
            {/* Clinical Interpretation / Comment - Always visible */}
            <div className="space-y-2 mb-3">
              <label className="block text-xs font-semibold text-ink-500 uppercase flex justify-between">
                <span>Add Interpretation / Comment</span>
                <span className="text-gray-400 font-normal normal-case">Visible in Patient Chart</span>
              </label>
              <textarea
                value={interpretationText}
                onChange={(e) => setInterpretationText(e.target.value)}
                placeholder="Enter clinical interpretation, findings, or notes..."
                className="w-full p-3 border border-paper-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-primary-400 focus:border-transparent shadow-sm"
                rows={3}
              />
            </div>

            {/* Task Assignment Form (Toggle) */}
            {showTaskForm && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md animate-fade-in-up">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-yellow-800 uppercase">Assign Task</span>
                  <button onClick={() => setShowTaskForm(false)} className="text-yellow-600 hover:text-yellow-800"><X className="w-3 h-3" /></button>
                </div>
                <div className="space-y-2">
                  <select
                    className="w-full text-sm border-gray-300 rounded-md p-1.5 bg-white"
                    value={taskForm.userId}
                    onChange={(e) => setTaskForm({ ...taskForm, userId: e.target.value })}
                  >
                    <option value="">Select Staff...</option>
                    <option value={user?.id}>Me (Personal Task)</option>
                    {(Array.isArray(users) ? users : []).filter(u => u.id !== user?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                  <textarea
                    className="w-full text-sm border-gray-300 rounded-md p-2"
                    placeholder="Task instructions..."
                    rows={2}
                    value={taskForm.instruction}
                    onChange={(e) => setTaskForm({ ...taskForm, instruction: e.target.value })}
                  />
                  <button
                    onClick={handleCreateTask}
                    className="w-full py-1.5 bg-yellow-600 text-white text-xs font-bold rounded hover:bg-yellow-700 shadow-sm"
                  >
                    Assign Task
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={(e) => handleTaskAction(selectedTask.id, 'save-comment', e)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center space-x-1 text-sm font-medium transition-colors shadow-sm"
                title="Save comment (keeps item in inbox)"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Save</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowTaskForm(!showTaskForm)}
                className={`px-3 py-2 rounded-md flex items-center justify-center space-x-1 text-sm font-medium transition-colors border ${showTaskForm ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>To Do</span>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => handleTaskAction(selectedTask.id, 'complete', e)}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center justify-center space-x-1 text-sm font-medium transition-colors shadow-sm"
                title="Sign off and remove from feed"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete</span>
                </div>
              </button>
            </div>

            {selectedTask.patient !== 'N/A' && selectedTask.mrn && (
              <button
                type="button"
                onClick={handleOpenPatientChart}
                className="w-full px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50 active:bg-paper-100 text-sm transition-colors cursor-pointer"
              >
                Open Patient Chart
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;

