/**
 * Inline Patient Status Component
 * 
 * Compact version for displaying and editing patient status within appointment cards
 */

import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { appointmentsAPI, patientFlagsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNotification } from './NotificationProvider';

const InlinePatientStatus = ({ appointment, onStatusUpdate, showNoShowCancelled = true, showCancelledBadge = false }) => {
    const { user } = useAuth();
    const { can } = usePermissions();
    const { showNotification } = useNotification();
    const canUpdateStatus = can('schedule:status_update');
    const [status, setStatus] = useState(appointment?.patient_status || 'scheduled');
    const [roomSubStatus, setRoomSubStatus] = useState(appointment?.room_sub_status || null);
    const [room, setRoom] = useState(appointment?.current_room || '');
    const [saving, setSaving] = useState(false);
    const [arrivalTime, setArrivalTime] = useState(appointment?.arrival_time ? new Date(appointment.arrival_time) : null);
    const [checkoutTime, setCheckoutTime] = useState(appointment?.checkout_time ? new Date(appointment.checkout_time) : null);
    const [currentStatusTime, setCurrentStatusTime] = useState(0);
    const [statusTimes, setStatusTimes] = useState({});

    // Room input state
    const [showRoomInput, setShowRoomInput] = useState(false);
    const [roomInput, setRoomInput] = useState(room || '');
    const inputRef = useRef(null);

    // Auto-focus room input when it appears
    useEffect(() => {
        if (showRoomInput && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [showRoomInput]);

    // No Show / Cancelled modal state
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [reasonInput, setReasonInput] = useState('');

    useEffect(() => {
        if (appointment) {
            setStatus(appointment.patient_status || 'scheduled');
            setRoomSubStatus(appointment.room_sub_status || null);
            setRoom(appointment.current_room || '');
            setRoomInput(appointment.current_room || '');
            setArrivalTime(appointment.arrival_time ? new Date(appointment.arrival_time) : null);
            setCheckoutTime(appointment.checkout_time ? new Date(appointment.checkout_time) : null);
        }
    }, [appointment]);

    // Calculate status times
    useEffect(() => {
        if (appointment?.status_history) {
            const history = [...appointment.status_history].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            const times = {};
            const now = new Date();
            const isCheckedOut = status === 'checked_out' && checkoutTime;

            for (let i = 0; i < history.length; i++) {
                const entry = history[i];
                const nextEntry = history[i + 1];
                const startTime = new Date(entry.timestamp);

                // Skip current active status that's not checked_out (it's still running)
                if (entry.status === status && !isCheckedOut && !nextEntry) continue;

                let endTime;
                if (nextEntry) {
                    // There's a next status, so this status ended when the next one started
                    endTime = new Date(nextEntry.timestamp);
                } else if (entry.status === 'checked_out') {
                    // For checked_out status, always use checkout_time (should be set when status is checked_out)
                    // If checkout_time exists, use it; otherwise the time should be 0
                    endTime = checkoutTime ? new Date(checkoutTime) : startTime;
                } else if (entry.status === status && !isCheckedOut) {
                    // Current active status (not checked_out), use now
                    endTime = now;
                } else {
                    // Past status with no next entry and not current status
                    // Use checkout_time if available (visit is complete), otherwise now
                    endTime = checkoutTime ? new Date(checkoutTime) : now;
                }

                const statusKey = entry.room_sub_status ? `${entry.status}_${entry.room_sub_status}` : entry.status;
                if (!times[statusKey]) times[statusKey] = 0;
                const duration = Math.floor((endTime - startTime) / 1000);
                times[statusKey] += Math.max(0, duration); // Ensure non-negative
            }

            // Special handling for checked_out status - show TOTAL visit time (from arrival to checkout)
            // This gives a complete view of how long the patient was in the office
            if (arrivalTime && checkoutTime) {
                const arrivalDate = new Date(arrivalTime);
                const checkoutDate = new Date(checkoutTime);
                const totalVisitTime = Math.floor((checkoutDate - arrivalDate) / 1000);
                times['checked_out'] = Math.max(0, totalVisitTime);
            } else if (arrivalTime && status === 'checked_out') {
                // Checked out but no checkout_time yet - show time since arrival
                const arrivalDate = new Date(arrivalTime);
                const totalVisitTime = Math.floor((now - arrivalDate) / 1000);
                times['checked_out'] = Math.max(0, totalVisitTime);
            } else {
                times['checked_out'] = 0;
            }

            setStatusTimes(times);

            const currentEntry = history.slice().reverse().find(entry => entry.status === status);
            if (currentEntry && status !== 'checked_out') {
                const statusStartTime = new Date(currentEntry.timestamp);
                const updateTimer = () => {
                    setCurrentStatusTime(Math.floor((new Date() - statusStartTime) / 1000));
                };
                updateTimer();
                const interval = setInterval(updateTimer, 1000);
                return () => clearInterval(interval);
            } else {
                setCurrentStatusTime(0);
            }
        }
    }, [status, appointment?.status_history, checkoutTime, arrivalTime]);

    const formatCompactTime = (seconds) => {
        if (!seconds || seconds <= 0) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        // If over 1 hour, show hours and minutes
        if (hours > 0) {
            if (minutes > 0) {
                return `${hours}h ${minutes}m`;
            }
            return `${hours}h`;
        }

        // If over 1 minute, show minutes:seconds
        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        // Otherwise show just seconds
        return `:${secs.toString().padStart(2, '0')}`;
    };

    const handleStatusChange = async (newStatus, subStatus = null, newRoom = null, cancellationReason = null) => {
        if (saving) return;

        setSaving(true);
        try {
            const now = new Date();
            const statusHistory = appointment?.status_history || [];
            const userName = user ? `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim() : 'System';
            const newHistory = [...statusHistory, {
                status: newStatus,
                room_sub_status: subStatus,
                timestamp: now.toISOString(),
                changed_by: userName || 'System',
                ...(newRoom && { current_room: newRoom }),
                ...(cancellationReason && { cancellation_reason: cancellationReason })
            }];

            let updateData = {
                patient_status: newStatus,
                status_history: newHistory
            };

            // Handle room_sub_status - set to null for no_show/cancelled, otherwise use subStatus
            if (newStatus === 'no_show' || newStatus === 'cancelled') {
                updateData.room_sub_status = null;
            } else if (subStatus !== null) {
                updateData.room_sub_status = subStatus;
            }

            if (newRoom !== null) {
                updateData.current_room = newRoom || null;
            }

            if (cancellationReason) {
                updateData.cancellation_reason = cancellationReason;
            }

            // When clicking "Arrived", always set a fresh arrival_time to start the timer
            // This resets the timer for the current visit session
            if (newStatus === 'arrived') {
                updateData.arrival_time = now.toISOString();
                updateData.checkout_time = null; // Clear any previous checkout_time when starting a new visit
                setArrivalTime(now);
                setCheckoutTime(null);

                // Nursing Notification for Patient Flags
                if (appointment.active_flags_count > 0) {
                    try {
                        const flagsRes = await patientFlagsAPI.getByPatient(appointment.patientId);
                        const activeFlags = (flagsRes.data || []).filter(f => f.status === 'active');

                        activeFlags.forEach(flag => {
                            showNotification({
                                title: `Patient Alert: ${flag.label}`,
                                message: flag.note || `This patient has a ${flag.severity} ${flag.category} flag.`,
                                severity: flag.severity,
                                duration: flag.severity === 'critical' ? 10000 : 6000
                            });
                        });
                    } catch (err) {
                        console.error('Failed to fetch flags for check-in notification:', err);
                    }
                }
            }

            if (newStatus === 'checked_out') {
                updateData.checkout_time = now.toISOString();
                updateData.status = 'completed';
                updateData.current_room = null;
                updateData.room_sub_status = null;
                setRoom('');
                setCheckoutTime(now);
            }

            // For no_show and cancelled, set checkout_time if not already set
            if (newStatus === 'no_show' || newStatus === 'cancelled') {
                if (!checkoutTime) {
                    updateData.checkout_time = now.toISOString();
                    setCheckoutTime(now);
                }
                // Clear room data for no_show/cancelled (already set above)
                updateData.current_room = null;
                setRoom('');
            }

            const response = await appointmentsAPI.update(appointment.id, updateData);
            const updated = response.data || response;

            setStatus(newStatus);
            setRoomSubStatus(subStatus);
            if (newRoom !== null) setRoom(newRoom);
            if (updated.arrival_time) setArrivalTime(new Date(updated.arrival_time));
            if (updated.checkout_time) setCheckoutTime(new Date(updated.checkout_time));

            if (onStatusUpdate) onStatusUpdate(updated);
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
            const errorDetails = error.response?.data?.details || error.response?.data?.hint || '';
            alert(`Failed to update status: ${errorMessage}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}`);
        } finally {
            setSaving(false);
            setShowRoomInput(false);
            setShowReasonModal(false);
            setReasonInput('');
            setPendingStatus(null);
        }
    };

    const handleNoShowOrCancelled = (newStatus) => {
        if (newStatus === 'no_show') {
            // No Show doesn't require a reason - mark directly
            handleStatusChange(newStatus, null, null, null);
        } else {
            // Cancelled requires a reason
            setPendingStatus(newStatus);
            setShowReasonModal(true);
        }
    };

    const handleReasonSubmit = () => {
        if (reasonInput.trim()) {
            handleStatusChange(pendingStatus, null, null, reasonInput.trim());
        }
    };

    const getStatusOrder = (s) => ['scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'].indexOf(s);
    const currentOrder = getStatusOrder(status);

    // Check if appointment is in a terminal state
    const isTerminalState = status === 'checked_out' || status === 'no_show' || status === 'cancelled';

    // Status button component
    const StatusBtn = ({ statusKey, label }) => {
        const order = getStatusOrder(statusKey);
        const isActive = status === statusKey;
        const isPast = currentOrder > order;
        const isCheckedOut = status === 'checked_out';

        let time = statusTimes[statusKey] || 0;
        if (isActive && currentStatusTime > 0 && !isCheckedOut) {
            time += currentStatusTime;
        }
        // For checked_out, always show the total visit time (arrival to checkout)
        const showTime = (isPast || isActive) && time > 0;

        const colors = {
            arrived: isActive ? 'text-indigo-700 font-bold bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100 shadow-sm' : isPast ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600',
            checked_in: isActive ? 'text-teal-700 font-bold bg-teal-50/50 px-2 py-0.5 rounded-lg border border-teal-100 shadow-sm' : isPast ? 'text-teal-500' : 'text-slate-400 hover:text-slate-600',
            checked_out: isActive ? 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 shadow-sm' : isPast ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
        };

        const isDisabled = saving || isTerminalState || !canUpdateStatus;

        return (
            <button
                type="button"
                onClick={() => {
                    if (!isDisabled && statusKey !== status) {
                        handleStatusChange(statusKey);
                    }
                }}
                disabled={isDisabled}
                title={!canUpdateStatus ? 'You do not have permission to update appointment status' : ''}
                className={`text-[9px] transition-all whitespace-nowrap px-1.5 py-0.5 rounded-lg ${colors[statusKey]} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {isPast && <span className="text-[8px] mr-1">✓</span>}
                <span className={isActive ? 'underline underline-offset-2' : ''}>
                    {label}
                </span>
                {showTime && (
                    <span className={`text-[8px] font-bold ml-1.5 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                        {formatCompactTime(time)}
                    </span>
                )}
            </button>
        );
    };

    // Room button with toggleable circles
    const RoomBtn = () => {
        const isActive = status === 'in_room';
        const isPast = currentOrder > getStatusOrder('in_room');
        const isCheckedOut = status === 'checked_out';

        // Calculate times for each sub-status separately
        // Also include 'in_room' entries without sub_status (from older data)
        let nurseTime = statusTimes['in_room_with_nurse'] || 0;
        let readyTime = statusTimes['in_room_ready_for_provider'] || 0;
        // Add time from generic 'in_room' entries (no sub_status) to nurse time
        const genericRoomTime = statusTimes['in_room'] || 0;
        if (genericRoomTime > 0) {
            nurseTime += genericRoomTime;
        }

        // Add current active time to the appropriate sub-status (only if still in room)
        if (isActive && currentStatusTime > 0 && !isCheckedOut) {
            if (roomSubStatus === 'with_nurse') {
                nurseTime += currentStatusTime;
            } else if (roomSubStatus === 'ready_for_provider') {
                readyTime += currentStatusTime;
            }
        }

        // Get the room number - use current room, or derive from status_history if checked out
        let displayRoom = room;
        if (!displayRoom && isPast && appointment?.status_history) {
            // Find the room from status_history (look for in_room entries)
            const roomEntry = appointment.status_history
                .filter(entry => entry.status === 'in_room')
                .pop(); // Get the last in_room entry
            if (roomEntry?.current_room) {
                displayRoom = roomEntry.current_room;
            }
        }

        // Check if there's any room time recorded (indicates patient was in a room)
        const hasRoomTime = nurseTime > 0 || readyTime > 0;

        const color = isActive
            ? (roomSubStatus === 'ready_for_provider' ? 'text-amber-700 font-bold' : 'text-violet-700 font-bold')
            : isPast ? 'text-violet-500' : 'text-gray-300 hover:text-gray-500';

        const handleRoomClick = async (e) => {
            e.stopPropagation();
            if (isTerminalState || !canUpdateStatus) return;

            // If not in room, set status to in_room first
            if (status !== 'in_room') {
                try {
                    setSaving(true);
                    await handleStatusChange('in_room', 'with_nurse', room || '');
                } catch (err) {
                    console.error('Failed to set room status:', err);
                } finally {
                    setSaving(false);
                }
            }

            // Show input and prepopulate
            setShowRoomInput(true);
            setRoomInput(room || '');
        };

        const handleRoomSubmit = async () => {
            const trimmed = roomInput.trim();
            if (trimmed !== (room || '')) {
                setSaving(true);
                try {
                    await handleStatusChange('in_room', roomSubStatus || 'with_nurse', trimmed);
                } catch (err) {
                    console.error('Failed to update room:', err);
                } finally {
                    setSaving(false);
                    setShowRoomInput(false);
                }
            } else {
                setShowRoomInput(false);
            }
        };

        const handleCircleToggle = async (e) => {
            e.stopPropagation();
            if (saving || !isActive || !room) return;
            const newSub = roomSubStatus === 'with_nurse' ? 'ready_for_provider' : 'with_nurse';
            setSaving(true);
            try {
                await handleStatusChange('in_room', newSub, room);
            } catch (err) {
                console.error('Failed to toggle sub-status:', err);
            } finally {
                setSaving(false);
            }
        };

        return (
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Status Indicator Circle (Toggle between Nurse and Provider) */}
                {isActive && room && (
                    <button
                        type="button"
                        onClick={handleCircleToggle}
                        disabled={saving}
                        className={`w-3 h-3 rounded-full transition-all border shrink-0 ${roomSubStatus === 'ready_for_provider'
                            ? 'bg-amber-400 border-amber-500 shadow-sm'
                            : 'bg-violet-400 border-violet-500 shadow-sm'
                            } ${saving ? 'opacity-50' : 'hover:scale-110 active:scale-95 cursor-pointer'}`}
                        title={roomSubStatus === 'ready_for_provider' ? 'Ready for Provider (Yellow) - Click to revert to Nurse' : 'With Nurse (Purple) - Click to signal Ready for Provider'}
                    />
                )}

                {showRoomInput ? (
                    <div className="flex items-center bg-violet-50 border-2 border-violet-400 rounded-lg shadow-sm px-1.5 py-0.5 shrink-0">
                        <span className="text-[10px] font-bold text-violet-900 mr-1 uppercase tracking-tighter">ROOM</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value)}
                            onBlur={handleRoomSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRoomSubmit();
                                if (e.key === 'Escape') {
                                    setRoomInput(room || '');
                                    setShowRoomInput(false);
                                }
                            }}
                            className="w-[24px] text-[10px] bg-transparent text-violet-900 focus:ring-0 outline-none font-bold placeholder-violet-300"
                            placeholder="#"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleRoomClick}
                        disabled={saving || isTerminalState || !canUpdateStatus}
                        className={`text-[9px] transition-all flex items-center gap-1 px-2 py-0.5 rounded-lg border shadow-sm shrink-0 ${isActive
                            ? (roomSubStatus === 'ready_for_provider'
                                ? 'bg-amber-100 border-amber-300 text-amber-800 font-black'
                                : 'bg-violet-100 border-violet-300 text-violet-800 font-black')
                            : isPast ? 'bg-violet-50 border-violet-100 text-violet-500' : 'bg-white border-slate-100 text-slate-300 hover:text-slate-500'
                            } ${saving || isTerminalState || !canUpdateStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-400'} min-w-fit`}
                    >
                        {isPast && <span className="text-[9px] font-bold mr-0.5">✓</span>}
                        <span className="uppercase tracking-tight whitespace-nowrap">
                            ROOM {displayRoom || ''}
                        </span>
                    </button>
                )}

                {/* Timings Display */}
                <span className="text-[8px] opacity-80 flex items-center gap-1.5 shrink-0 ml-1">
                    {hasRoomTime ? (
                        <>
                            {nurseTime > 0 && (
                                <span className="text-violet-700 font-bold flex items-center gap-0.5" title="Time with Nurse">
                                    <span className="text-[6px]">○</span>{formatCompactTime(nurseTime)}
                                </span>
                            )}
                            {readyTime > 0 && (
                                <span className="text-amber-700 font-bold flex items-center gap-0.5" title="Ready for Provider">
                                    <span className="text-[6px]">●</span>{formatCompactTime(readyTime)}
                                </span>
                            )}
                        </>
                    ) : null}
                </span>
            </div>
        );
    };

    // No Show / Cancelled button component
    const NoShowCancelledBtn = ({ statusKey, label }) => {
        const isActive = status === statusKey;
        const color = isActive
            ? (statusKey === 'no_show' ? 'text-orange-700 font-bold' : 'text-red-700 font-bold')
            : (statusKey === 'no_show' ? 'text-orange-500 hover:text-orange-600' : 'text-red-500 hover:text-red-600');

        const isDisabled = saving || isTerminalState || !canUpdateStatus;

        return (
            <button
                type="button"
                onClick={() => {
                    if (!isDisabled && statusKey !== status) {
                        handleNoShowOrCancelled(statusKey);
                    }
                }}
                disabled={isDisabled}
                title={!canUpdateStatus ? 'You do not have permission to update appointment status' : ''}
                className={`text-[9px] transition-all cursor-pointer ${color} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isActive && <span className="text-[8px] mr-0.5">✓</span>}
                <span className={isActive ? 'underline underline-offset-2' : ''}>
                    {label}
                </span>
            </button>
        );
    };

    // ... (visit time logic) ...

    return (
        <>
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                {/* Status flow - consistent sizing */}
                <div className="flex items-center gap-2">
                    <StatusBtn statusKey="arrived" label="Arrived" />
                    <span className="text-slate-300 text-[8px] font-bold">→</span>
                    <StatusBtn statusKey="checked_in" label="Checked In" />
                    <span className="text-slate-300 text-[8px] font-bold">→</span>
                    <RoomBtn />
                    <span className="text-slate-300 text-[8px] font-bold">→</span>
                    <StatusBtn statusKey="checked_out" label="Out" />
                </div>

                {showCancelledBadge && (status === 'no_show' || status === 'cancelled') && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ml-3 flex-shrink-0 ${status === 'no_show'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {status === 'no_show' ? 'NO SHOW' : 'CANCELLED'}
                    </span>
                )}
                {showNoShowCancelled && !isTerminalState && (
                    <div className="ml-4 flex items-center gap-3 border-l border-gray-200 pl-4">
                        <NoShowCancelledBtn statusKey="no_show" label="No Show" />
                        <NoShowCancelledBtn statusKey="cancelled" label="Cancelled" />
                    </div>
                )}
            </div>

            {/* Cancellation Reason Modal - only for cancelled status */}
            {showReasonModal && pendingStatus === 'cancelled' && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center"
                    onClick={() => {
                        setShowReasonModal(false);
                        setReasonInput('');
                        setPendingStatus(null);
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-xl">
                            <h2 className="text-xl font-bold text-white">
                                Cancel Appointment
                            </h2>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cancellation Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    placeholder="Enter reason for cancellation..."
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                                    rows={3}
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReasonModal(false);
                                        setReasonInput('');
                                        setPendingStatus(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReasonSubmit}
                                    disabled={!reasonInput.trim() || saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default InlinePatientStatus;
