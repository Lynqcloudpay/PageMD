import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, ChevronRight, ChevronLeft, Filter, FilterX, XCircle } from 'lucide-react';
import { appointmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { format, addDays, isToday, isSameDay } from 'date-fns';

const MySchedule = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { can, getScope } = usePermissions();
    const scope = getScope();
    const [appointments, setAppointments] = useState({ active: [], scheduled: [], checkedOut: [], cancelledNoShow: [] });
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showCancelledAppointments, setShowCancelledAppointments] = useState(true); // Toggle to show/hide cancelled

    useEffect(() => {
        const fetchAppointments = async () => {
            // Check if user has schedule:view permission
            if (!user || !can('schedule:view')) {
                setLoading(false);
                return;
            }
            
            // My Schedule is only for users with SELF scope (clinicians)
            if (scope.scheduleScope !== 'SELF') {
                setLoading(false);
                return;
            }

            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const response = await appointmentsAPI.get({ 
                    date: dateStr,
                    providerId: user.id 
                });
                
                // Handle both array response and {data: array} response
                const appointmentsData = Array.isArray(response) 
                    ? response 
                    : (response.data || []);
                
                // Separate appointments into categories
                const activeStatuses = ['arrived', 'checked_in', 'in_room'];
                const activeAppointments = appointmentsData.filter(appt => 
                    activeStatuses.includes(appt.patient_status)
                );
                const checkedOutAppointments = appointmentsData.filter(appt => 
                    appt.patient_status === 'checked_out'
                );
                const cancelledNoShowAppointments = appointmentsData.filter(appt => 
                    appt.patient_status === 'cancelled' || appt.patient_status === 'no_show'
                );
                const scheduledAppointments = appointmentsData.filter(appt => 
                    !activeStatuses.includes(appt.patient_status) && 
                    appt.patient_status !== 'checked_out' && 
                    appt.patient_status !== 'cancelled' && 
                    appt.patient_status !== 'no_show'
                );
                
                // Sort active appointments by arrival_time (time in clinic)
                activeAppointments.sort((a, b) => {
                    const aArrival = a.arrival_time ? new Date(a.arrival_time).getTime() : 0;
                    const bArrival = b.arrival_time ? new Date(b.arrival_time).getTime() : 0;
                    // Sort by arrival time descending (longest time first)
                    return bArrival - aArrival;
                });
                
                // Sort checked out appointments by checkout_time (most recent first)
                checkedOutAppointments.sort((a, b) => {
                    const aCheckout = a.checkout_time ? new Date(a.checkout_time).getTime() : 0;
                    const bCheckout = b.checkout_time ? new Date(b.checkout_time).getTime() : 0;
                    // Sort by checkout time descending (most recent first)
                    return bCheckout - aCheckout;
                });
                
                // Sort scheduled appointments by scheduled time
                scheduledAppointments.sort((a, b) => 
                    (a.time || '').localeCompare(b.time || '')
                );
                
                // Sort cancelled/no-show by scheduled time
                cancelledNoShowAppointments.sort((a, b) => 
                    (a.time || '').localeCompare(b.time || '')
                );
                
                // Store categorized appointments
                setAppointments({
                    active: activeAppointments,
                    scheduled: scheduledAppointments,
                    checkedOut: checkedOutAppointments,
                    cancelledNoShow: cancelledNoShowAppointments
                });
            } catch (error) {
                console.error('Error fetching appointments:', error);
                console.error('User ID:', user.id);
                console.error('Selected date:', format(selectedDate, 'yyyy-MM-dd'));
                setAppointments({ active: [], scheduled: [], checkedOut: [], cancelledNoShow: [] });
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
        
        // Auto-refresh every 10 seconds (silent refresh, no loading state)
        const interval = setInterval(() => {
            setLoading(false); // Don't show loading on refresh
            fetchAppointments();
        }, 10000);
        
        return () => clearInterval(interval);
    }, [user, selectedDate]);

    const handlePatientClick = (appointment) => {
        if (appointment.patientId) {
            navigate(`/patient/${appointment.patientId}/snapshot`);
        }
    };

    const formatTime = (timeString) => {
        // Convert 24-hour format to 12-hour format
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'pm' : 'am';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    if (loading) {
        return (
            <div className="h-full bg-white">
                <div className="p-6 max-w-4xl mx-auto">
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-strong-azure mb-4"></div>
                            <p className="text-deep-gray/70 font-medium">Loading schedule...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
            case 'arrived': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400' };
            case 'checked_in': return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400' };
            case 'in_room': return { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-400' };
            case 'checked_out': return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-400' };
            case 'cancelled': return { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-900' };
            case 'no_show': return { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-900' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
        }
    };

    const getStatusLabel = (status, currentRoom) => {
        switch (status) {
            case 'arrived': return 'Arrived';
            case 'checked_in': return 'Checked In';
            case 'in_room': return currentRoom ? `Room ${currentRoom}` : 'In Room';
            case 'checked_out': return 'Checked Out';
            case 'cancelled': return 'Cancelled';
            case 'no_show': return 'No Show';
            default: return status || 'Scheduled';
        }
    };

    return (
        <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="p-4 max-w-5xl mx-auto">
                {/* Compact Header */}
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">My Schedule</h1>
                            <p className="text-xs text-slate-500">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCancelledAppointments(!showCancelledAppointments)}
                            className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded transition-colors ${
                                showCancelledAppointments 
                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title={showCancelledAppointments ? 'Hide cancelled/no-show' : 'Show cancelled/no-show'}
                        >
                            {showCancelledAppointments ? (
                                <>
                                    <FilterX className="w-3 h-3" />
                                    <span>Hide Cancelled</span>
                                </>
                            ) : (
                                <>
                                    <Filter className="w-3 h-3" />
                                    <span>Show Cancelled</span>
                                </>
                            )}
                        </button>
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                            <button
                                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 text-slate-600" />
                            </button>
                            <input
                                type="date"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="border-none outline-none text-xs font-semibold text-slate-700 bg-transparent cursor-pointer w-28"
                            />
                            <button
                                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                            </button>
                        </div>
                        {!isToday(selectedDate) && (
                            <button
                                onClick={() => setSelectedDate(new Date())}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Today
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Card */}
                {(() => {
                    const isArray = Array.isArray(appointments);
                    const apptData = isArray ? { active: [], scheduled: appointments, checkedOut: [], cancelledNoShow: [] } : appointments;
                    const totalCount = (apptData.active?.length || 0) + 
                                     (apptData.scheduled?.length || 0) + 
                                     (apptData.checkedOut?.length || 0) + 
                                     (showCancelledAppointments ? (apptData.cancelledNoShow?.length || 0) : 0);
                    return totalCount > 0 ? (
                        <div className="mb-3 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <span className="text-sm font-bold text-slate-900">
                                    {totalCount} {totalCount === 1 ? 'Appointment' : 'Appointments'}
                                </span>
                            </div>
                        </div>
                    ) : null;
                })()}

                {(() => {
                    // Handle both array (old format) and object (new format) for backward compatibility
                    const isArray = Array.isArray(appointments);
                    const apptData = isArray ? { active: [], scheduled: appointments, checkedOut: [], cancelledNoShow: [] } : appointments;
                    
                    const allAppointments = [
                        ...(apptData.active || []),
                        ...(apptData.scheduled || []),
                        ...(apptData.checkedOut || []),
                        ...(showCancelledAppointments ? (apptData.cancelledNoShow || []) : [])
                    ];
                    
                    const totalCount = (apptData.active?.length || 0) + 
                                     (apptData.scheduled?.length || 0) + 
                                     (apptData.checkedOut?.length || 0) + 
                                     (showCancelledAppointments ? (apptData.cancelledNoShow?.length || 0) : 0);
                    
                    if (totalCount === 0) {
                        return (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <h3 className="text-base font-bold text-slate-700 mb-1">No Appointments</h3>
                                <p className="text-xs text-slate-500">
                                    {totalCount === 0 && (apptData.active?.length || 0) === 0 && (apptData.scheduled?.length || 0) === 0 && (apptData.checkedOut?.length || 0) === 0 && (apptData.cancelledNoShow?.length || 0) === 0
                                        ? `No appointments scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`
                                        : 'No appointments match the current filter'}
                                </p>
                            </div>
                        );
                    }
                    
                    const renderAppointment = (appt, index) => {
                        const isCancelledOrNoShow = appt.patient_status === 'cancelled' || appt.patient_status === 'no_show';
                        const statusColor = getStatusColor(appt.patient_status || 'scheduled');
                        
                        return (
                            <div
                                key={appt.id}
                                onClick={() => handlePatientClick(appt)}
                                className={`p-3 hover:bg-slate-50 cursor-pointer transition-all border-l-4 ${
                                    isCancelledOrNoShow 
                                        ? 'bg-gray-50/50 opacity-70 border-gray-300' 
                                        : `${statusColor.border} hover:${statusColor.bg}/20`
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Compact Number Badge */}
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                                        isCancelledOrNoShow 
                                            ? 'bg-gray-200 text-gray-500' 
                                            : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    
                                    {/* Patient Name */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-sm font-bold truncate ${
                                                isCancelledOrNoShow 
                                                    ? 'text-gray-500 line-through' 
                                                    : 'text-slate-900'
                                            }`}>
                                                {appt.patientName}
                                            </span>
                                        </div>
                                        
                                        {/* Compact Info Row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-blue-600">
                                                {formatTime(appt.time)}
                                            </span>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-xs text-slate-600">
                                                {appt.type}
                                            </span>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-xs text-slate-500">
                                                {appt.duration} min
                                            </span>
                                            {appt.patient_status && appt.patient_status !== 'scheduled' && (
                                                <>
                                                    <span className="text-slate-400">•</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusColor.bg} ${statusColor.text}`}>
                                                        {getStatusLabel(appt.patient_status, appt.current_room)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Arrow */}
                                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                </div>
                            </div>
                        );
                    };
                    
                    let globalIndex = 0;
                    
                    return (
                        <div className="space-y-4">
                            {/* Active Patients Section */}
                            {apptData.active && apptData.active.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200">
                                        <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Active in Clinic ({apptData.active.length})
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {apptData.active.map((appt) => {
                                            globalIndex++;
                                            return renderAppointment(appt, globalIndex - 1);
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Scheduled Section */}
                            {apptData.scheduled && apptData.scheduled.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Scheduled ({apptData.scheduled.length})
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {apptData.scheduled.map((appt) => {
                                            globalIndex++;
                                            return renderAppointment(appt, globalIndex - 1);
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Checked Out Section */}
                            {apptData.checkedOut && apptData.checkedOut.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200">
                                        <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Checked Out ({apptData.checkedOut.length})
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {apptData.checkedOut.map((appt) => {
                                            globalIndex++;
                                            return renderAppointment(appt, globalIndex - 1);
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Cancelled/No Show Section */}
                            {showCancelledAppointments && apptData.cancelledNoShow && apptData.cancelledNoShow.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-300">
                                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <XCircle className="w-4 h-4" />
                                            Cancelled / No Show ({apptData.cancelledNoShow.length})
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {apptData.cancelledNoShow.map((appt) => {
                                            globalIndex++;
                                            return renderAppointment(appt, globalIndex - 1);
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default MySchedule;












