import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
    Calendar, Clock, User, FileText, Activity, ChevronRight, RefreshCw,
    Stethoscope, ClipboardList, Search, Filter
} from 'lucide-react';
import api from '../api/client';

// Status badge styles matching main PageMD EMR exactly
const statusStyles = {
    'scheduled': 'bg-blue-50 text-blue-700',
    'checked-in': 'bg-green-50 text-green-700',
    'arrived': 'bg-green-50 text-green-700',
    'in-room': 'bg-purple-50 text-purple-700',
    'roomed': 'bg-purple-50 text-purple-700',
    'in-progress': 'bg-amber-50 text-amber-700',
    'ready': 'bg-emerald-50 text-emerald-700',
    'completed': 'bg-gray-100 text-gray-600',
    'no-show': 'bg-red-50 text-red-600',
    'cancelled': 'bg-red-50 text-red-600',
};

export function TodaySchedulePage() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchTodayAppointments = async () => {
        setLoading(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const response = await api.get('/appointments', { params: { date: today } });
            setAppointments(response.data || []);
        } catch (err) {
            console.error('Failed to fetch today appointments:', err);
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayAppointments();
    }, []);

    const handleStatusUpdate = async (appointmentId, newStatus) => {
        try {
            await api.put(`/appointments/${appointmentId}`, { status: newStatus });
            fetchTodayAppointments();
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    // Filter appointments by status
    const filteredAppointments = appointments.filter(appt => {
        if (statusFilter === 'all') return true;
        return appt.status === statusFilter;
    });

    // Status counts
    const statusCounts = {
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        arrived: appointments.filter(a => ['checked-in', 'arrived'].includes(a.status)).length,
        inProgress: appointments.filter(a => ['in-room', 'roomed', 'in-progress'].includes(a.status)).length,
        completed: appointments.filter(a => a.status === 'completed').length,
    };

    return (
        <div className="flex-1 flex overflow-hidden bg-[#F8FAFC]">
            {/* LEFT: Appointment List */}
            <div className="w-[450px] bg-white border-r border-gray-200 flex flex-col shadow-sm">
                {/* Header - matches main EMR style */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <h1 className="font-bold text-gray-900">Provider Schedule</h1>
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                {appointments.length} Appointments
                            </span>
                        </div>
                        <button
                            onClick={fetchTodayAppointments}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <p className="text-sm font-medium text-gray-500">
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                </div>

                {/* Status Filter Pills */}
                <div className="px-4 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
                    {[
                        { key: 'all', label: 'All', count: appointments.length },
                        { key: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled },
                        { key: 'arrived', label: 'Arrived', count: statusCounts.arrived },
                        { key: 'in-progress', label: 'In Progress', count: statusCounts.inProgress },
                        { key: 'completed', label: 'Completed', count: statusCounts.completed },
                    ].map(filter => (
                        <button
                            key={filter.key}
                            onClick={() => setStatusFilter(filter.key === 'arrived' ? 'checked-in' : filter.key === 'in-progress' ? 'in-room' : filter.key)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all min-h-[44px] ${(statusFilter === filter.key || (filter.key === 'all' && statusFilter === 'all'))
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {filter.label} ({filter.count})
                        </button>
                    ))}
                </div>

                {/* Appointment List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-sm text-gray-500">Retrieving appointments...</p>
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 px-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Calendar className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="font-semibold text-gray-500">No appointments for today</p>
                            <p className="text-sm max-w-[200px] mt-1">Check back later or view the full schedule.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {filteredAppointments
                                .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                                .map(appt => (
                                    <button
                                        key={appt.id}
                                        onClick={() => setSelectedAppointment(appt)}
                                        className={`w-full p-4 text-left hover:bg-blue-50/30 transition-colors min-h-[72px] ${selectedAppointment?.id === appt.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded min-w-[60px] text-center">
                                                {appt.time || '--:--'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-900 text-[15px] truncate">
                                                    {appt.patientName || 'Unknown Patient'}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                    <span>{appt.type || 'Office Visit'}</span>
                                                    <span>•</span>
                                                    <span>30m</span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-tight ${statusStyles[appt.status] || statusStyles.scheduled
                                                }`}>
                                                {appt.status || 'Scheduled'}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Selected Appointment Details */}
            <div className="flex-1 overflow-y-auto">
                {selectedAppointment ? (
                    <VisitWorkspace
                        appointment={selectedAppointment}
                        onStatusUpdate={handleStatusUpdate}
                        onNavigate={(path) => navigate(path)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <User className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-lg font-semibold text-gray-500">Select an appointment</p>
                        <p className="text-sm">Tap an appointment to view details and start workflow</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Visit Workspace - for intake, chart review, notes
function VisitWorkspace({ appointment, onStatusUpdate, onNavigate }) {
    const [activeTab, setActiveTab] = useState('intake');

    const workflowActions = [
        { status: 'scheduled', label: 'Check In', next: 'checked-in' },
        { status: 'checked-in', label: 'Room Patient', next: 'in-room' },
        { status: 'in-room', label: 'Start Intake', next: 'in-progress' },
        { status: 'in-progress', label: 'Ready for Provider', next: 'ready' },
        { status: 'ready', label: 'Complete Visit', next: 'completed' },
    ];

    const currentAction = workflowActions.find(a => a.status === appointment.status);

    return (
        <div className="p-6">
            {/* Patient Header - sticky clinical banner */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-lg">
                            {(appointment.patientName || 'U U').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{appointment.patientName}</h2>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                <span>#{appointment.patientId?.substring(0, 8).toUpperCase()}</span>
                                <span>•</span>
                                <span>{appointment.type || 'Office Visit'}</span>
                                <span>•</span>
                                <span className="font-semibold">{appointment.time}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold uppercase ${statusStyles[appointment.status] || statusStyles.scheduled
                            }`}>
                            {appointment.status || 'Scheduled'}
                        </span>
                        {currentAction && (
                            <button
                                onClick={() => onStatusUpdate(appointment.id, currentAction.next)}
                                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors min-h-[48px]"
                            >
                                {currentAction.label}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Workflow Tabs - same style as main EMR */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-100">
                    {[
                        { key: 'intake', label: 'Intake', icon: Stethoscope },
                        { key: 'chart', label: 'Chart Review', icon: Activity },
                        { key: 'orders', label: 'Orders', icon: ClipboardList },
                        { key: 'note', label: 'Note', icon: FileText },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold transition-all min-h-[56px] ${activeTab === tab.key
                                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 min-h-[400px]">
                    {activeTab === 'intake' && <IntakePanel appointment={appointment} />}
                    {activeTab === 'chart' && <ChartReviewPanel patientId={appointment.patientId} />}
                    {activeTab === 'orders' && <OrdersPanel patientId={appointment.patientId} />}
                    {activeTab === 'note' && <NotePanel appointment={appointment} onNavigate={onNavigate} />}
                </div>
            </div>
        </div>
    );
}

// Intake Panel - vitals, chief complaint, allergies, meds
function IntakePanel({ appointment }) {
    const [vitals, setVitals] = useState({
        bp_systolic: '', bp_diastolic: '', pulse: '', temp: '', weight: '', height: '', o2_sat: ''
    });
    const [chiefComplaint, setChiefComplaint] = useState('');

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Chief Complaint</h3>
                <textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Enter chief complaint..."
                    className="w-full p-4 border border-gray-200 rounded-lg text-base min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Vitals</h3>
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { key: 'bp_systolic', label: 'BP Sys', unit: 'mmHg' },
                        { key: 'bp_diastolic', label: 'BP Dia', unit: 'mmHg' },
                        { key: 'pulse', label: 'Pulse', unit: 'bpm' },
                        { key: 'temp', label: 'Temp', unit: '°F' },
                        { key: 'weight', label: 'Weight', unit: 'lbs' },
                        { key: 'height', label: 'Height', unit: 'in' },
                        { key: 'o2_sat', label: 'O2 Sat', unit: '%' },
                    ].map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={vitals[field.key]}
                                    onChange={(e) => setVitals({ ...vitals, [field.key]: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[48px]"
                                    placeholder="--"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{field.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors min-h-[56px]">
                Save Intake
            </button>
        </div>
    );
}

// Chart Review Panel - summary, meds, problems, results
function ChartReviewPanel({ patientId }) {
    const [activeSubTab, setActiveSubTab] = useState('overview');

    return (
        <div>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['overview', 'vitals', 'meds', 'problems', 'results'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveSubTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[44px] ${activeSubTab === tab
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] flex items-center justify-center text-gray-400">
                <p className="text-sm">Chart {activeSubTab} content will load from main EMR APIs</p>
            </div>
        </div>
    );
}

// Orders Panel
function OrdersPanel({ patientId }) {
    return (
        <div className="text-center py-8 text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">Quick Orders</p>
            <p className="text-sm">Order entry will use main EMR order catalog</p>
        </div>
    );
}

// Note Panel
function NotePanel({ appointment, onNavigate }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Clinical Note</h3>
                <button
                    onClick={() => onNavigate(`/patient/${appointment.patientId}/note`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
                >
                    Open Full Note Editor
                </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 min-h-[300px]">
                <p className="text-gray-400 text-sm">Note editor integrates with main EMR note system</p>
            </div>
        </div>
    );
}
