import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Clock, Edit, Eye, Trash2 } from 'lucide-react';
import { format, parse, compareDesc } from 'date-fns';
import { visitsAPI } from '../services/api';

const VisitFoldersModal = ({ isOpen, onClose, visits: visitsProp, patientId, onViewVisit, onDeleteVisit }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'draft', 'signed'
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch visits if patientId is provided and visits prop is not
    useEffect(() => {
        if (isOpen && patientId && !visitsProp) {
            const fetchVisits = async () => {
                setLoading(true);
                try {
                    const response = await visitsAPI.getByPatient(patientId);
                    if (response.data && response.data.length > 0) {
                        // Show all visits, not just those with note_draft content
                        const notesToShow = response.data;
                        const formattedNotes = notesToShow.map(visit => {
                            const noteText = visit.note_draft || "";
                            const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                            const chiefComplaint = ccMatch ? ccMatch[1].trim() : null;
                            const visitDateObj = new Date(visit.visit_date);
                            const createdDateObj = visit.created_at ? new Date(visit.created_at) : visitDateObj;
                            const dateStr = visitDateObj.toLocaleDateString();
                            const hasTime = visitDateObj.getHours() !== 0 || visitDateObj.getMinutes() !== 0 || visitDateObj.getSeconds() !== 0;
                            const timeSource = hasTime ? visitDateObj : createdDateObj;
                            const timeStr = timeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const dateTimeStr = `${dateStr} ${timeStr}`;
                            
                            return {
                                id: visit.id,
                                date: dateStr,
                                time: timeStr,
                                dateTime: dateTimeStr,
                                type: visit.visit_type || "Office Visit",
                                provider: (() => {
                                    const signedByName = visit.signed_by_first_name && visit.signed_by_last_name
                                        ? `${visit.signed_by_first_name} ${visit.signed_by_last_name}`
                                        : null;
                                    const providerNameFallback = visit.provider_first_name 
                                        ? `${visit.provider_first_name} ${visit.provider_last_name}` 
                                        : "Provider";
                                    return ((visit.locked || visit.note_signed_by) && signedByName && signedByName !== 'System Administrator')
                                        ? signedByName
                                        : providerNameFallback;
                                })(),
                                chiefComplaint: chiefComplaint,
                                signed: visit.locked || !!visit.note_signed_by,
                                visitDate: visit.visit_date,
                                createdAt: visit.created_at || visit.visit_date,
                                fullNote: noteText
                            };
                        });
                        setVisits(formattedNotes);
                    } else {
                        setVisits([]);
                    }
                } catch (error) {
                    console.error('Error fetching visits:', error);
                    setVisits([]);
                } finally {
                    setLoading(false);
                }
            };
            fetchVisits();
        } else if (visitsProp) {
            setVisits(visitsProp);
        }
    }, [isOpen, patientId, visitsProp]);

    // Use visitsProp if provided, otherwise use state
    const visitsToUse = visitsProp || visits;

    // Filter visits - must be called before early return
    const filteredVisits = useMemo(() => {
        if (!visitsToUse || !Array.isArray(visitsToUse)) {
            return [];
        }
        let filtered = visitsToUse.filter(visit => {
            if (filter === 'all') return true;
            if (filter === 'draft') return !visit.signed;
            if (filter === 'signed') return visit.signed;
            return true;
        });

        // Sort by date (newest first)
        filtered.sort((a, b) => {
            try {
                // Use visitDate if available (original date object), otherwise parse the formatted date
                const dateA = a.visitDate ? new Date(a.visitDate) : 
                    (typeof a.date === 'string' ? 
                        (parse(a.date, 'MM/dd/yyyy', new Date()) || parse(a.date, 'M/d/yyyy', new Date()) || new Date(a.date)) :
                        new Date(a.date));
                const dateB = b.visitDate ? new Date(b.visitDate) : 
                    (typeof b.date === 'string' ? 
                        (parse(b.date, 'MM/dd/yyyy', new Date()) || parse(b.date, 'M/d/yyyy', new Date()) || new Date(b.date)) :
                        new Date(b.date));
                return compareDesc(dateA, dateB);
            } catch {
                // Fallback to string comparison if parsing fails
                return b.date.localeCompare(a.date);
            }
        });

        return filtered;
    }, [visitsToUse, filter]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                    <div>
                        <h2 className="text-2xl font-bold text-neutral-900">Visit History</h2>
                        <p className="text-sm text-neutral-600 mt-1">{visitsToUse?.length || 0} total visits</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-600" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="px-6 pt-4 border-b border-neutral-200">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'all'
                                    ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            All ({visitsToUse?.length || 0})
                        </button>
                        <button
                            onClick={() => setFilter('draft')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'draft'
                                    ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-600'
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            Draft ({visitsToUse?.filter(v => !v.signed).length || 0})
                        </button>
                        <button
                            onClick={() => setFilter('signed')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'signed'
                                    ? 'bg-green-100 text-green-700 border-b-2 border-green-600'
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            Signed ({visitsToUse?.filter(v => v.signed).length || 0})
                        </button>
                    </div>
                </div>

                {/* Visits List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-12 text-neutral-500">
                            <p>Loading visits...</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                            <p>No visits found</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-1">
                            {filteredVisits.map((visit) => {
                                // Format date and time like Snapshot
                                let dateTimeStr = visit.date || '';
                                if (visit.dateTime) {
                                    dateTimeStr = visit.dateTime;
                                } else if (visit.visitDate) {
                                    const visitDateObj = new Date(visit.visitDate);
                                    const createdDateObj = visit.createdAt ? new Date(visit.createdAt) : visitDateObj;
                                    const dateStr = visitDateObj.toLocaleDateString();
                                    
                                    // Check if visit_date has time component
                                    const hasTime = visitDateObj.getHours() !== 0 || visitDateObj.getMinutes() !== 0 || visitDateObj.getSeconds() !== 0;
                                    const timeSource = hasTime ? visitDateObj : createdDateObj;
                                    const timeStr = timeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    dateTimeStr = `${dateStr} ${timeStr}`;
                                } else if (visit.date && visit.time) {
                                    dateTimeStr = `${visit.date} ${visit.time}`;
                                }

                                // Get chief complaint if available
                                let chiefComplaint = visit.chiefComplaint || null;
                                
                                // If not directly available, try to parse from fullNote or summary
                                if (!chiefComplaint && visit.fullNote) {
                                    const ccMatch = visit.fullNote.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
                                    chiefComplaint = ccMatch ? ccMatch[1].trim() : null;
                                }

                                const handleDelete = async (e) => {
                                    e.stopPropagation();
                                    if (!window.confirm('Are you sure you want to delete this draft note? This action cannot be undone.')) {
                                        return;
                                    }
                                    
                                    try {
                                        await visitsAPI.delete(visit.id);
                                        if (onDeleteVisit) {
                                            onDeleteVisit(visit.id);
                                        } else {
                                            // Refresh by calling onClose and reopening - parent should handle refresh
                                            window.location.reload();
                                        }
                                    } catch (error) {
                                        console.error('Error deleting visit:', error);
                                        alert('Failed to delete draft note.');
                                    }
                                };

                                return (
                                    <div
                                        key={visit.id}
                                        onClick={() => onViewVisit(visit.id)}
                                        className="px-2 py-1.5 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors relative group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0 pr-6">
                                                <div className="flex items-center space-x-2 flex-wrap">
                                                    <span className="text-xs font-medium text-gray-900">{visit.type || "Office Visit"}</span>
                                                    {visit.signed ? (
                                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex-shrink-0">Signed</span>
                                                    ) : (
                                                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex-shrink-0">Draft</span>
                                                    )}
                                                    <span className="text-xs text-gray-500 flex-shrink-0">{dateTimeStr} • {visit.provider || "Provider"}</span>
                                                    {chiefComplaint && (
                                                        <span className="text-xs text-gray-700 italic">
                                                            • "{chiefComplaint.substring(0, 60)}{chiefComplaint.length > 60 ? '...' : ''}"
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!visit.signed && (
                                                <button
                                                    onClick={handleDelete}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all absolute right-2"
                                                    title="Delete draft"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VisitFoldersModal;
