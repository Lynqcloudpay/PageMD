import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, ChevronRight } from 'lucide-react';
import { appointmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const MySchedule = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!user || (user.role !== 'clinician' && user.role !== 'admin')) {
                setLoading(false);
                return;
            }

            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const response = await appointmentsAPI.get({ 
                    date: dateStr,
                    providerId: user.id 
                });
                
                // Sort appointments by time
                const sorted = (response.data || []).sort((a, b) => 
                    a.time.localeCompare(b.time)
                );
                setAppointments(sorted);
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setAppointments([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
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
            <div className="p-6">
                <div className="text-center text-ink-500">Loading schedule...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-serif font-bold text-ink-900 mb-2">My Schedule</h1>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-white rounded-md border border-paper-300 p-2">
                        <Calendar className="w-4 h-4 text-ink-500" />
                        <input
                            type="date"
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="border-none outline-none text-sm font-medium text-ink-900"
                        />
                    </div>
                    <span className="text-sm text-ink-600">
                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    </span>
                </div>
            </div>

            {appointments.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-paper-200 p-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-ink-300" />
                    <h3 className="text-lg font-semibold text-ink-700 mb-2">No Appointments Scheduled</h3>
                    <p className="text-ink-500">
                        You have no appointments scheduled for {format(selectedDate, 'MMMM d, yyyy')}.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-paper-200">
                    <div className="p-4 border-b border-paper-200 bg-paper-50">
                        <h2 className="text-lg font-semibold text-ink-900">
                            {appointments.length} {appointments.length === 1 ? 'Appointment' : 'Appointments'} Scheduled
                        </h2>
                    </div>
                    <div className="divide-y divide-paper-100">
                        {appointments.map((appt, index) => (
                            <div
                                key={appt.id}
                                onClick={() => handlePatientClick(appt)}
                                className="p-4 hover:bg-paper-50 cursor-pointer transition-colors flex items-center justify-between group"
                            >
                                <div className="flex items-center space-x-4 flex-1 min-w-0">
                                    <div className="flex-shrink-0 w-8 h-8 bg-paper-200 rounded-full flex items-center justify-center text-sm font-bold text-ink-700">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <h3 className="text-lg font-semibold text-ink-900 group-hover:text-paper-700">
                                                {appt.patientName}
                                            </h3>
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm text-ink-600">
                                            <span className="flex items-center">
                                                <Clock className="w-4 h-4 mr-1.5" />
                                                {formatTime(appt.time)}
                                            </span>
                                            <span className="flex items-center">
                                                <User className="w-4 h-4 mr-1.5" />
                                                {appt.type}
                                            </span>
                                            {appt.duration && (
                                                <span>{appt.duration} minutes</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-ink-400 group-hover:text-paper-700 flex-shrink-0 ml-4" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MySchedule;










