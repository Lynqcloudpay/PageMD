/**
 * Patient Status Tracker Component
 * 
 * Tracks patient flow through the clinic:
 * - Arrived → Checked In → In Room X → Checked Out
 * - Shows timers for each status and overall visit time
 * - Allows editing status and room assignment
 */

import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle, User, LogOut, Edit2, Save, X } from 'lucide-react';
import { appointmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PatientStatusTracker = ({ appointment, onStatusUpdate }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState(appointment?.patient_status || 'scheduled');
    const [room, setRoom] = useState(appointment?.current_room || '');
    const [isEditing, setIsEditing] = useState(false);
    const [editingRoom, setEditingRoom] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusHistory, setStatusHistory] = useState(appointment?.status_history || []);
    const [arrivalTime, setArrivalTime] = useState(appointment?.arrival_time ? new Date(appointment.arrival_time) : null);
    const [checkoutTime, setCheckoutTime] = useState(appointment?.checkout_time ? new Date(appointment.checkout_time) : null);

    // Update state when appointment prop changes
    useEffect(() => {
        if (appointment) {
            setStatus(appointment.patient_status || 'scheduled');
            setRoom(appointment.current_room || '');
            setStatusHistory(appointment.status_history || []);
            setArrivalTime(appointment.arrival_time ? new Date(appointment.arrival_time) : null);
            setCheckoutTime(appointment.checkout_time ? new Date(appointment.checkout_time) : null);
        }
    }, [appointment]);

    // Status definitions with icons and colors - Modern Azure Theme
    const statusConfig = {
        scheduled: { label: 'Scheduled', icon: Clock, color: 'bg-soft-gray text-deep-gray', iconColor: 'text-deep-gray/60' },
        arrived: { label: 'Arrived', icon: User, color: 'bg-blue-100 text-blue-800', iconColor: 'text-blue-600', activeColor: 'bg-strong-azure/10 text-strong-azure border-strong-azure/30' },
        checked_in: { label: 'Checked In', icon: CheckCircle, color: 'bg-green-100 text-green-800', iconColor: 'text-green-600', activeColor: 'bg-fresh-green/10 text-fresh-green border-fresh-green/30' },
        in_room: { label: 'In Room', icon: MapPin, color: 'bg-purple-100 text-purple-800', iconColor: 'text-purple-600', activeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
        checked_out: { label: 'Checked Out', icon: LogOut, color: 'bg-gray-100 text-gray-800', iconColor: 'text-gray-600', activeColor: 'bg-deep-gray/10 text-deep-gray border-deep-gray/20' },
    };

    // Timer for current status
    const [currentStatusTime, setCurrentStatusTime] = useState(0);
    const [totalVisitTime, setTotalVisitTime] = useState(0);

    useEffect(() => {
        // Find when current status started
        const currentStatusEntry = statusHistory
            .slice()
            .reverse()
            .find(entry => entry.status === status);

        if (currentStatusEntry && status !== 'checked_out') {
            const statusStartTime = new Date(currentStatusEntry.timestamp);
            const updateTimer = () => {
                const now = new Date();
                setCurrentStatusTime(Math.floor((now - statusStartTime) / 1000));
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        } else {
            setCurrentStatusTime(0);
        }
    }, [status, statusHistory]);

    useEffect(() => {
        // Calculate total visit time from arrival to now (or checkout)
        if (arrivalTime) {
            const endTime = checkoutTime || new Date();
            const updateTotalTimer = () => {
                if (!checkoutTime) {
                    const now = new Date();
                    setTotalVisitTime(Math.floor((now - arrivalTime) / 1000));
                } else {
                    setTotalVisitTime(Math.floor((checkoutTime - arrivalTime) / 1000));
                }
            };
            updateTotalTimer();
            const interval = setInterval(updateTotalTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [arrivalTime, checkoutTime]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        return `${minutes}m ${secs}s`;
    };

    const handleStatusChange = async (newStatus) => {
        if (newStatus === status) return;
        
        setSaving(true);
        try {
            const now = new Date();
            const userName = user ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() : 'System';
            const newHistory = [...statusHistory, {
                status: newStatus,
                timestamp: now.toISOString(),
                changed_by: userName || 'System'
            }];

            let updateData = {
                patient_status: newStatus,
                status_history: newHistory
            };

            // Set arrival time if transitioning to 'arrived'
            if (newStatus === 'arrived' && !arrivalTime) {
                updateData.arrival_time = now.toISOString();
                setArrivalTime(now);
            }

            // Set checkout time if transitioning to 'checked_out'
            if (newStatus === 'checked_out' && !checkoutTime) {
                updateData.checkout_time = now.toISOString();
                setCheckoutTime(now);
            }

            // Clear room if checking out
            if (newStatus === 'checked_out') {
                updateData.current_room = null;
                setRoom('');
            }

            const response = await appointmentsAPI.update(appointment.id, updateData);
            const updated = response.data || response;
            
            setStatus(newStatus);
            setStatusHistory(newHistory);
            if (updated.arrival_time) setArrivalTime(new Date(updated.arrival_time));
            if (updated.checkout_time) setCheckoutTime(new Date(updated.checkout_time));
            if (updated.current_room !== undefined) setRoom(updated.current_room || '');

            if (onStatusUpdate) {
                onStatusUpdate(updated);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update patient status. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleRoomSave = async () => {
        if (editingRoom === room) {
            setIsEditing(false);
            return;
        }

        setSaving(true);
        try {
            // Auto-change status to 'in_room' if not already
            let newStatus = status;
            if (editingRoom && status !== 'in_room') {
                newStatus = 'in_room';
            }

            const now = new Date();
            let newHistory = [...statusHistory];
            
            // Add status change if needed
            if (newStatus !== status) {
                const userName = user ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() : 'System';
                newHistory.push({
                    status: newStatus,
                    timestamp: now.toISOString(),
                    changed_by: userName || 'System'
                });
            }

            const updateData = {
                current_room: editingRoom || null,
                patient_status: newStatus,
                status_history: newHistory
            };

            const response = await appointmentsAPI.update(appointment.id, updateData);
            const updated = response.data || response;
            
            setRoom(editingRoom);
            setStatus(newStatus);
            setStatusHistory(newHistory);
            setIsEditing(false);

            if (onStatusUpdate) {
                onStatusUpdate(updated);
            }
        } catch (error) {
            console.error('Error updating room:', error);
            alert('Failed to update room. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const StatusButton = ({ statusKey, config }) => {
        const Icon = config.icon;
        const isActive = status === statusKey;
        const isPast = getStatusOrder(status) > getStatusOrder(statusKey);

        return (
            <button
                onClick={() => handleStatusChange(statusKey)}
                disabled={saving || (statusKey === 'checked_out' && status === 'checked_out')}
                className={`
                    flex items-center space-x-2 px-5 py-3 rounded-xl transition-all duration-200 border-2
                    ${isActive 
                        ? `${config.activeColor || config.color} border-current shadow-md font-bold` 
                        : isPast
                        ? 'bg-soft-gray text-deep-gray/70 border-deep-gray/10 hover:bg-soft-gray/80'
                        : 'bg-white border-deep-gray/20 text-deep-gray/70 hover:border-strong-azure/40 hover:bg-strong-azure/5 hover:text-deep-gray'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                <Icon className={`w-5 h-5 ${isActive ? config.iconColor : 'text-deep-gray/40'}`} />
                <span className="font-semibold">{config.label}</span>
                {isActive && statusKey !== 'checked_out' && (
                    <span className="ml-2 px-2 py-0.5 bg-white/50 rounded text-xs font-bold text-deep-gray">
                        {formatTime(currentStatusTime)}
                    </span>
                )}
            </button>
        );
    };

    const getStatusOrder = (status) => {
        const order = ['scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out'];
        return order.indexOf(status);
    };

    return (
        <div className="bg-white rounded-xl border border-deep-gray/10 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-deep-gray/10">
                <h3 className="text-xl font-bold text-deep-gray">Patient Status</h3>
                {arrivalTime && (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-strong-azure/10 rounded-lg border border-strong-azure/20">
                        <Clock className="w-5 h-5 text-strong-azure" />
                        <span className="font-bold text-deep-gray text-base">
                            Total Time: {formatTime(totalVisitTime)}
                        </span>
                    </div>
                )}
            </div>

            {/* Status Workflow */}
            <div className="flex items-center space-x-3 mb-5 flex-wrap gap-3">
                <StatusButton statusKey="arrived" config={statusConfig.arrived} />
                <div className="w-px h-8 bg-deep-gray/20"></div>
                <StatusButton statusKey="checked_in" config={statusConfig.checked_in} />
                <div className="w-px h-8 bg-deep-gray/20"></div>
                <StatusButton statusKey="in_room" config={statusConfig.in_room} />
                <div className="w-px h-8 bg-deep-gray/20"></div>
                <StatusButton statusKey="checked_out" config={statusConfig.checked_out} />
            </div>

            {/* Room Assignment */}
            <div className="mt-6 pt-5 border-t border-deep-gray/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-strong-azure/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-strong-azure" />
                        </div>
                        <span className="text-base font-semibold text-deep-gray">Room Assignment</span>
                    </div>
                    {isEditing ? (
                        <div className="flex items-center space-x-2 flex-1 max-w-xs ml-4">
                            <input
                                type="text"
                                value={editingRoom}
                                onChange={(e) => setEditingRoom(e.target.value)}
                                placeholder="Room number"
                                className="flex-1 px-3 py-1.5 border border-deep-gray/20 rounded-lg text-sm focus:ring-2 focus:ring-strong-azure/40 focus:border-strong-azure/40"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRoomSave();
                                    if (e.key === 'Escape') {
                                        setEditingRoom(room);
                                        setIsEditing(false);
                                    }
                                }}
                            />
                            <button
                                onClick={handleRoomSave}
                                disabled={saving}
                                className="p-1.5 bg-strong-azure text-white rounded-lg hover:bg-strong-azure/90 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setEditingRoom(room);
                                    setIsEditing(false);
                                }}
                                className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-deep-gray">
                                {room || 'Not assigned'}
                            </span>
                            {status === 'in_room' && !isEditing && (
                                <button
                                    onClick={() => {
                                        setEditingRoom(room);
                                        setIsEditing(true);
                                    }}
                                    className="p-1 text-strong-azure hover:bg-strong-azure/10 rounded transition-colors"
                                    title="Edit room"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Status History Timeline */}
            {statusHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-deep-gray/10">
                    <h4 className="text-xs font-semibold text-deep-gray/60 uppercase mb-2">Status History</h4>
                    <div className="space-y-1.5">
                        {statusHistory.slice().reverse().map((entry, index) => {
                            const entryConfig = statusConfig[entry.status] || statusConfig.scheduled;
                            const EntryIcon = entryConfig.icon;
                            const entryTime = new Date(entry.timestamp);
                            const timeStr = entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            
                            return (
                                <div key={index} className="flex items-center space-x-2 text-xs text-deep-gray/70">
                                    <EntryIcon className={`w-3 h-3 ${entryConfig.iconColor}`} />
                                    <span className="font-medium">{entryConfig.label}</span>
                                    <span className="text-deep-gray/50">•</span>
                                    <span>{timeStr}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientStatusTracker;

