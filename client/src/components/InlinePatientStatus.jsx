/**
 * Inline Patient Status Component
 * 
 * Compact version for displaying and editing patient status within appointment cards
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import { appointmentsAPI, patientFlagsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNotification } from './NotificationProvider';

// --- SUB-COMPONENTS (Defined outside to prevent remounting) ---

const StatusBtn = memo(({ statusKey, label, currentStatus, currentOrder, statusTimes, currentStatusTime, handleStatusChange, saving, isTerminalState, canUpdateStatus, formatCompactTime }) => {
    const getStatusOrder = (s) => ['scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'].indexOf(s);
    const order = getStatusOrder(statusKey);
    const isActive = currentStatus === statusKey;
    const isPast = currentOrder > order;
    const isCheckedOut = currentStatus === 'checked_out';

    let time = statusTimes[statusKey] || 0;
    if (isActive && currentStatusTime > 0 && !isCheckedOut) {
        time += currentStatusTime;
    }
    const showTime = (isPast || isActive) && (time > 0);

    const colors = {
        arrived: isActive ? 'text-blue-700 font-semibold bg-blue-50/50 px-1.5 py-0 rounded border border-blue-100 shadow-sm' : isPast ? 'text-blue-500 font-medium' : 'text-slate-400 hover:text-slate-500 font-medium',
        checked_in: isActive ? 'text-teal-700 font-semibold bg-teal-50/50 px-1.5 py-0 rounded border border-teal-100 shadow-sm' : isPast ? 'text-teal-500 font-medium' : 'text-slate-400 hover:text-slate-500 font-medium',
        checked_out: isActive ? 'text-slate-700 font-semibold bg-slate-50/50 px-1.5 py-0 rounded border border-slate-200 shadow-sm' : isPast ? 'text-slate-500 font-medium' : 'text-slate-300 hover:text-slate-400 font-medium'
    };

    const isDisabled = saving || isTerminalState || !canUpdateStatus;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled && statusKey !== currentStatus) {
                    handleStatusChange(statusKey);
                }
            }}
            disabled={isDisabled}
            title={!canUpdateStatus ? 'You do not have permission to update appointment status' : ''}
            className={`text-[9px] transition-all whitespace-nowrap px-1.5 py-0 rounded h-[20px] flex items-center justify-center min-w-[50px] ${colors[statusKey]} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {isPast && <span className="text-[8px] mr-1">✓</span>}
            <span className={isActive ? 'underline underline-offset-2' : ''}>
                {label}
            </span>
            {showTime && (
                <span className={`text-[8px] font-semibold ml-1.5 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    {formatCompactTime(time)}
                </span>
            )}
        </button>
    );
});

const RoomBtn = memo(({
    status, roomSubStatus, room, roomInput, setRoomInput,
    showRoomInput, setShowRoomInput, inputRef, isEditingRef,
    statusTimes, currentStatusTime, currentOrder,
    handleStatusChange, handleCircleToggle, saving,
    isTerminalState, canUpdateStatus, formatCompactTime,
    displayRoom, hasRoomTime, nurseTime, readyTime
}) => {
    const isActive = status === 'in_room';

    const handleRoomClick = (e) => {
        e.stopPropagation();
        if (isTerminalState || !canUpdateStatus) return;

        isEditingRef.current = true;
        setShowRoomInput(true);
    };

    const handleRoomSubmit = async () => {
        const trimmed = roomInput.trim();
        isEditingRef.current = false;

        if (showRoomInput) {
            if (trimmed !== (room || '')) {
                await handleStatusChange('in_room', roomSubStatus || 'with_nurse', trimmed);
            }
            setShowRoomInput(false);
        }
    };

    // Show timer if we have recorded time OR if we are currently in room (to show immediate start)
    const showTimers = hasRoomTime || (status === 'in_room' && (nurseTime > 0 || readyTime > 0));

    return (
        <div className="flex items-center gap-1.5 shrink-0 px-1 py-0">
            {/* Status Indicator Circle - SMALLER (w-2) */}
            {isActive && room && (
                <button
                    type="button"
                    onClick={handleCircleToggle}
                    disabled={saving}
                    className={`w-2 h-2 rounded-full transition-all border shadow-sm shrink-0 ${roomSubStatus === 'ready_for_provider'
                            ? 'bg-cyan-400 border-cyan-500'
                            : 'bg-indigo-400 border-indigo-500'
                        } ${saving ? 'opacity-50' : 'hover:scale-125 active:scale-90 cursor-pointer'}`}
                    title={roomSubStatus === 'ready_for_provider' ? 'Ready for Provider (Cyan) - Click to revert to Nurse' : 'With Nurse (Indigo) - Click to signal Ready for Provider'}
                />
            )}

            {showRoomInput ? (
                <div className="flex items-center bg-white border border-indigo-200 rounded shadow-sm px-1.5 py-0 shrink-0 h-[20px]">
                    <span className="text-[7px] font-medium text-indigo-400 mr-1 uppercase leading-none">ROOM</span>
                    <input
                        ref={inputRef}
                        type="text"
                        autoComplete="off"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        onBlur={handleRoomSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRoomSubmit();
                            if (e.key === 'Escape') {
                                isEditingRef.current = false;
                                setRoomInput(room || '');
                                setShowRoomInput(false);
                            }
                        }}
                        className="w-[30px] text-[10px] bg-transparent text-indigo-700 focus:ring-0 outline-none font-semibold leading-none p-0 border-none cursor-text"
                        placeholder="#"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleRoomClick}
                    disabled={saving || isTerminalState || !canUpdateStatus}
                    className={`text-[9px] transition-all flex items-center justify-center px-1.5 py-0 rounded border shadow-sm shrink-0 h-[20px] min-w-[60px] ${isActive
                            ? (roomSubStatus === 'ready_for_provider'
                                ? 'bg-cyan-50 border-cyan-200 text-cyan-700 font-semibold'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold')
                            : (status === 'checked_out' || status === 'completed') ? 'bg-slate-50 border-slate-100 text-slate-300 font-medium'
                                : 'bg-white border-slate-100 text-slate-300 hover:text-slate-400'
                        } ${saving || isTerminalState || !canUpdateStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-300'}`}
                >
                    {isTerminalState && status !== 'in_room' && <span className="text-[9px] font-bold mr-1">✓</span>}
                    <span className="uppercase tracking-tight whitespace-nowrap leading-none flex-1 text-center font-bold">
                        {displayRoom ? `RM ${displayRoom}` : 'ROOM'}
                    </span>
                </button>
            )}

            {/* Timings Display - Start running immediately */}
            <span className="text-[8px] opacity-80 flex items-center gap-1.5 shrink-0 ml-1">
                {showTimers && (
                    <>
                        {nurseTime > 0 && (
                            <span className="text-indigo-700/70 font-semibold flex items-center gap-0.5" title="Time with Nurse">
                                <span className="text-[6px]">○</span>{formatCompactTime(nurseTime)}
                            </span>
                        )}
                        {readyTime > 0 && (
                            <span className="text-cyan-700/70 font-semibold flex items-center gap-0.5" title="Ready for Provider">
                                <span className="text-[6px]">●</span>{formatCompactTime(readyTime)}
                            </span>
                        )}
                    </>
                )}
            </span>
        </div>
    );
});

const NoShowCancelledBtn = memo(({ statusKey, label, currentStatus, handleNoShowOrCancelled, saving, isTerminalState, canUpdateStatus }) => {
    const isActive = currentStatus === statusKey;
    const color = isActive
        ? (statusKey === 'no_show' ? 'text-slate-700 font-bold' : 'text-slate-800 font-bold')
        : (statusKey === 'no_show' ? 'text-slate-400 hover:text-slate-500' : 'text-slate-400 hover:text-slate-500');

    const isDisabled = saving || isTerminalState || !canUpdateStatus;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled && statusKey !== currentStatus) {
                    handleNoShowOrCancelled(statusKey);
                }
            }}
            disabled={isDisabled}
            title={!canUpdateStatus ? 'You do not have permission to update appointment status' : ''}
            className={`text-[9px] transition-all cursor-pointer ${color} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {isActive && <span className="text-[8px] mr-1">✓</span>}
            <span className={isActive ? 'underline underline-offset-2' : ''}>
                {label}
            </span>
        </button>
    );
});

// --- MAIN COMPONENT ---

const InlinePatientStatus = ({ appointment, onStatusUpdate, showNoShowCancelled = true, showCancelledBadge = false }) => {
    const { user } = useAuth();
    const { can } = usePermissions();
    const { showNotification } = useNotification();
    const canUpdateStatus = can('schedule:status_update');

    // State
    const [status, setStatus] = useState(appointment?.patient_status || 'scheduled');
    const [roomSubStatus, setRoomSubStatus] = useState(appointment?.room_sub_status || null);
    const [room, setRoom] = useState(appointment?.current_room || '');
    const [saving, setSaving] = useState(false);
    const [arrivalTime, setArrivalTime] = useState(appointment?.arrival_time ? new Date(appointment.arrival_time) : null);
    const [checkoutTime, setCheckoutTime] = useState(appointment?.checkout_time ? new Date(appointment.checkout_time) : null);
    const [currentStatusTime, setCurrentStatusTime] = useState(0);
    const [statusTimes, setStatusTimes] = useState({});

    // UI State
    const [showRoomInput, setShowRoomInput] = useState(false);
    const [roomInput, setRoomInput] = useState(appointment?.current_room || '');
    const inputRef = useRef(null);
    const isEditingRef = useRef(false);

    // Modal State
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [reasonInput, setReasonInput] = useState('');

    // sync state with appointment
    useEffect(() => {
        if (appointment) {
            setStatus(appointment.patient_status || 'scheduled');
            setRoomSubStatus(appointment.room_sub_status || null);
            setRoom(appointment.current_room || '');

            // Only update roomInput if we're not currently editing it
            if (!isEditingRef.current && !showRoomInput) {
                setRoomInput(appointment.current_room || '');
            }

            setArrivalTime(appointment.arrival_time ? new Date(appointment.arrival_time) : null);
            setCheckoutTime(appointment.checkout_time ? new Date(appointment.checkout_time) : null);
        }
    }, [appointment]);

    // Focus handler
    useEffect(() => {
        if (showRoomInput && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [showRoomInput]);

    // History and Timer Logic (Keep in main component as it feeds all sub-components)
    useEffect(() => {
        if (appointment?.status_history) {
            const history = [...appointment.status_history].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            const times = {};
            const now = new Date();
            const isCheckedOut = (status === 'checked_out' || status === 'completed') && checkoutTime;

            for (let i = 0; i < history.length; i++) {
                const entry = history[i];
                const nextEntry = history[i + 1];
                const startTime = new Date(entry.timestamp);

                if (entry.status === status && !isCheckedOut && !nextEntry) continue;

                let endTime;
                if (nextEntry) {
                    endTime = new Date(nextEntry.timestamp);
                } else if (entry.status === 'checked_out' || entry.status === 'completed') {
                    endTime = checkoutTime ? new Date(checkoutTime) : startTime;
                } else if (entry.status === status && !isCheckedOut) {
                    endTime = now;
                } else {
                    endTime = checkoutTime ? new Date(checkoutTime) : now;
                }

                const statusKey = entry.room_sub_status ? `${entry.status}_${entry.room_sub_status}` : entry.status;
                if (!times[statusKey]) times[statusKey] = 0;
                const duration = Math.floor((endTime - startTime) / 1000);
                times[statusKey] += Math.max(0, duration);
            }

            if (arrivalTime && checkoutTime) {
                const arrivalDate = new Date(arrivalTime);
                const checkoutDate = new Date(checkoutTime);
                const totalVisitTime = Math.floor((checkoutDate - arrivalDate) / 1000);
                times['checked_out'] = Math.max(0, totalVisitTime);
            } else if (arrivalTime && (status === 'checked_out' || status === 'completed')) {
                const arrivalDate = new Date(arrivalTime);
                const totalVisitTime = Math.floor((now - arrivalDate) / 1000);
                times['checked_out'] = Math.max(0, totalVisitTime);
            } else {
                times['checked_out'] = 0;
            }

            setStatusTimes(times);

            // Timer
            const currentEntry = history.slice().reverse().find(entry => entry.status === status);
            if (currentEntry && status !== 'checked_out' && status !== 'completed') {
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
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

            if (newStatus === 'no_show' || newStatus === 'cancelled') {
                updateData.room_sub_status = null;
            } else if (subStatus !== null) {
                updateData.room_sub_status = subStatus;
            }

            if (newRoom !== null) updateData.current_room = newRoom || null;
            if (cancellationReason) updateData.cancellation_reason = cancellationReason;

            if (newStatus === 'arrived') {
                updateData.arrival_time = now.toISOString();
                updateData.checkout_time = null;
                setArrivalTime(now);
                setCheckoutTime(null);

                // Flags notification
                if (appointment.active_flags_count > 0) {
                    try {
                        const flagsRes = await patientFlagsAPI.getByPatient(appointment.patientId);
                        const activeFlags = (flagsRes.data || []).filter(f => f.status === 'active');
                        activeFlags.forEach(flag => {
                            showNotification({
                                title: `Patient Alert: ${flag.label}`,
                                message: flag.note || `This patient has a ${flag.severity} flag.`,
                                severity: flag.severity,
                                duration: flag.severity === 'critical' ? 10000 : 6000
                            });
                        });
                    } catch (err) { console.error(err); }
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

            if (newStatus === 'no_show' || newStatus === 'cancelled') {
                if (!checkoutTime) {
                    updateData.checkout_time = now.toISOString();
                    setCheckoutTime(now);
                }
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
            console.error(error);
            alert('Failed to update status');
        } finally {
            setSaving(false);
            setShowRoomInput(false);
            setShowReasonModal(false);
            setReasonInput('');
            setPendingStatus(null);
        }
    };

    const handleCircleToggle = async (e) => {
        e.stopPropagation();
        if (saving || status !== 'in_room' || !room) return;
        const newSub = roomSubStatus === 'with_nurse' ? 'ready_for_provider' : 'with_nurse';
        await handleStatusChange('in_room', newSub, room);
    };

    const handleNoShowOrCancelled = (newStatus) => {
        if (newStatus === 'no_show') {
            handleStatusChange(newStatus, null, null, null);
        } else {
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
    const isTerminalState = status === 'checked_out' || status === 'completed' || status === 'no_show' || status === 'cancelled';

    // Derived Room Data for RoomBtn
    let displayRoom = room;
    const isPastRoom = currentOrder > getStatusOrder('in_room');
    if (!displayRoom && isPastRoom && appointment?.status_history) {
        const roomEntry = appointment.status_history.filter(entry => entry.status === 'in_room').pop();
        if (roomEntry?.current_room) displayRoom = roomEntry.current_room;
    }
    const hasRoomTime = (statusTimes['in_room_with_nurse'] || 0) + (statusTimes['in_room_ready_for_provider'] || 0) + (statusTimes['in_room'] || 0) > 0;

    let nurseTime = (statusTimes['in_room_with_nurse'] || 0) + (statusTimes['in_room'] || 0);
    let readyTime = statusTimes['in_room_ready_for_provider'] || 0;
    if (status === 'in_room' && currentStatusTime > 0) {
        if (roomSubStatus === 'ready_for_provider') readyTime += currentStatusTime;
        else nurseTime += currentStatusTime;
    }

    return (
        <>
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                    <StatusBtn
                        statusKey="arrived" label="Arrived"
                        currentStatus={status} currentOrder={currentOrder}
                        statusTimes={statusTimes} currentStatusTime={currentStatusTime}
                        handleStatusChange={handleStatusChange}
                        saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        formatCompactTime={formatCompactTime}
                    />
                    <span className="text-slate-200 text-[8px] mx-1">•</span>
                    <StatusBtn
                        statusKey="checked_in" label="Checked In"
                        currentStatus={status} currentOrder={currentOrder}
                        statusTimes={statusTimes} currentStatusTime={currentStatusTime}
                        handleStatusChange={handleStatusChange}
                        saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        formatCompactTime={formatCompactTime}
                    />
                    <span className="text-slate-200 text-[8px] mx-1">•</span>
                    <RoomBtn
                        status={status} roomSubStatus={roomSubStatus} room={room}
                        roomInput={roomInput} setRoomInput={setRoomInput}
                        showRoomInput={showRoomInput} setShowRoomInput={setShowRoomInput}
                        inputRef={inputRef} isEditingRef={isEditingRef}
                        statusTimes={statusTimes} currentStatusTime={currentStatusTime} currentOrder={currentOrder}
                        handleStatusChange={handleStatusChange} handleCircleToggle={handleCircleToggle}
                        saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        formatCompactTime={formatCompactTime}
                        displayRoom={displayRoom} hasRoomTime={hasRoomTime} nurseTime={nurseTime} readyTime={readyTime}
                    />
                    <span className="text-slate-200 text-[8px] mx-1">•</span>
                    <StatusBtn
                        statusKey="checked_out" label="Out"
                        currentStatus={status} currentOrder={currentOrder}
                        statusTimes={statusTimes} currentStatusTime={currentStatusTime}
                        handleStatusChange={handleStatusChange}
                        saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        formatCompactTime={formatCompactTime}
                    />
                </div>

                {showCancelledBadge && (status === 'no_show' || status === 'cancelled') && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ml-3 flex-shrink-0 ${status === 'no_show' ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                        {status === 'no_show' ? 'NO SHOW' : 'CANCELLED'}
                    </span>
                )}

                {showNoShowCancelled && !isTerminalState && (
                    <div className="ml-4 flex items-center gap-3 border-l border-slate-100 pl-4">
                        <NoShowCancelledBtn
                            statusKey="no_show" label="No Show"
                            currentStatus={status} handleNoShowOrCancelled={handleNoShowOrCancelled}
                            saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        />
                        <NoShowCancelledBtn
                            statusKey="cancelled" label="Cancelled"
                            currentStatus={status} handleNoShowOrCancelled={handleNoShowOrCancelled}
                            saving={saving} isTerminalState={isTerminalState} canUpdateStatus={canUpdateStatus}
                        />
                    </div>
                )}
            </div>

            {/* Cancellation Reason Modal */}
            {showReasonModal && pendingStatus === 'cancelled' && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center" onClick={() => setShowReasonModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-slate-500 to-slate-600 px-6 py-4 rounded-t-xl">
                            <h2 className="text-xl font-bold text-white">Cancel Appointment</h2>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason *</label>
                                <textarea
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    placeholder="Enter reason..."
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 text-sm resize-none"
                                    rows={3} autoFocus
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <button type="button" onClick={() => setShowReasonModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                                <button type="button" onClick={handleReasonSubmit} disabled={!reasonInput.trim() || saving} className="px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg disabled:opacity-50">
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
