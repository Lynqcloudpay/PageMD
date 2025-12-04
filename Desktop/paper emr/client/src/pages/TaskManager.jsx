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
  
  // Update context whenever tasks change
  useEffect(() => {
    if (updateTasks) {
      updateTasks(tasks);
    }
  }, [tasks, updateTasks]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
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
  const handleTaskAction = (taskId, action, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        if (action === 'read') return { ...task, status: 'read' };
        if (action === 'complete') return { ...task, status: 'completed' };
        if (action === 'unread') return { ...task, status: 'unread' };
      }
      return task;
    });
    setTasks(updatedTasks);
    
    // Update selected task if it's the one being modified
    if (selectedTask && selectedTask.id === taskId) {
      const updatedTask = updatedTasks.find(t => t.id === taskId);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
  };

  // Handle reply action
  const handleReply = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedTask) {
      // Navigate to messages or open compose modal
      navigate('/messages', { state: { replyTo: selectedTask } });
    }
  };

  // Handle forward action
  const handleForward = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedTask) {
      // Navigate to messages or open forward modal
      navigate('/messages', { state: { forward: selectedTask } });
    }
  };

  // Handle open patient chart
  const handleOpenPatientChart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedTask && selectedTask.patient !== 'N/A' && selectedTask.mrn) {
      // Find patient by MRN and navigate to their chart
      navigate(`/patient/${selectedTask.mrn}/snapshot`);
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
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
              selectedCategory === 'all' 
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === category.id 
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
                  className={`w-full flex items-center px-3 py-1.5 rounded text-sm ${
                    filterStatus === filter.id 
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
              <button className="p-2 hover:bg-paper-100 rounded-md text-ink-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

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
                  className={`p-4 hover:bg-paper-50 cursor-pointer transition-colors ${
                    task.status === 'unread' ? 'bg-blue-50/30' : ''
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
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedTask.status === 'unread' ? 'bg-blue-100 text-blue-700' :
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

            {/* Task Details */}
            <div className="space-y-4">
              {selectedTask.details && Object.entries(selectedTask.details).map(([key, value]) => (
                <div key={key}>
                  <h4 className="text-xs font-semibold text-ink-500 uppercase mb-1">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h4>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{value}</p>
                </div>
              ))}
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
          <div className="p-4 border-t border-paper-200 space-y-2">
            {/* Status Actions */}
            <div className="grid grid-cols-2 gap-2">
              {selectedTask.status !== 'read' && (
                <button
                  type="button"
                  onClick={(e) => handleTaskAction(selectedTask.id, 'read', e)}
                  className="px-3 py-2 text-white rounded-md flex items-center justify-center space-x-1 text-sm transition-all duration-200 hover:shadow-md cursor-pointer"
                  style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark Read</span>
                </button>
              )}
              {selectedTask.status !== 'completed' && (
                <button
                  type="button"
                  onClick={(e) => handleTaskAction(selectedTask.id, 'complete', e)}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 active:bg-green-800 flex items-center justify-center space-x-1 text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete</span>
                </button>
              )}
              {(selectedTask.status === 'read' || selectedTask.status === 'completed') && (
                <button
                  type="button"
                  onClick={(e) => handleTaskAction(selectedTask.id, 'unread', e)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 flex items-center justify-center space-x-1 text-sm transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Mark Unread</span>
                </button>
              )}
            </div>
            
            {/* Other Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReply}
                className="px-3 py-2 border border-paper-300 rounded-md hover:bg-paper-50 active:bg-paper-100 text-sm transition-colors cursor-pointer"
              >
                Reply
              </button>
              <button
                type="button"
                onClick={handleForward}
                className="px-3 py-2 border border-paper-300 rounded-md hover:bg-paper-50 active:bg-paper-100 text-sm transition-colors cursor-pointer"
              >
                Forward
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

