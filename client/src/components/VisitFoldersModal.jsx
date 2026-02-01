import React, { useState, useMemo } from 'react';
import { X, FileText, Clock, Edit, Eye, Trash2, FileSignature } from 'lucide-react';
import { format, parse, compareDesc } from 'date-fns';
import { visitsAPI } from '../services/api';

const VisitFoldersModal = ({ isOpen, onClose, visits, onViewVisit, onDeleteVisit }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'draft', 'signed'

    // Filter visits - must be called before early return
    const filteredVisits = useMemo(() => {
        let filtered = visits.filter(visit => {
            if (filter === 'all') return true;
            if (filter === 'draft') return !visit.signed && !visit.preliminary;
            if (filter === 'preliminary') return visit.preliminary;
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
    }, [visits, filter]);

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
                        <p className="text-sm text-neutral-600 mt-1">{visits.length} total visits</p>
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
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'all'
                                ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
                                : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                        >
                            All ({visits.length})
                        </button>
                        <button
                            onClick={() => setFilter('preliminary')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'preliminary'
                                ? 'bg-amber-100 text-amber-700 border-b-2 border-amber-600'
                                : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                        >
                            Preliminary ({visits.filter(v => v.preliminary).length})
                        </button>
                        <button
                            onClick={() => setFilter('draft')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'draft'
                                ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-600'
                                : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                        >
                            Draft ({visits.filter(v => !v.signed && !v.preliminary).length})
                        </button>
                        <button
                            onClick={() => setFilter('signed')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'signed'
                                ? 'bg-green-100 text-green-700 border-b-2 border-green-600'
                                : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                        >
                            Signed ({visits.filter(v => v.signed).length})
                        </button>
                    </div>
                </div>

                {/* Visits List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredVisits.length === 0 ? (
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
                                    const fullNoteText = typeof visit.fullNote === 'string' ? visit.fullNote : (typeof visit.fullNote === 'object' ? JSON.stringify(visit.fullNote) : String(visit.fullNote));
                                    const ccMatch = fullNoteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
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
                                            // Broadcast that patient data has changed so listeners can refresh
                                            window.dispatchEvent(new CustomEvent('patient-data-updated'));
                                            if (onClose) onClose();
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
                                                    ) : visit.preliminary ? (
                                                        <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                                                            <FileSignature className="w-3 h-3" /> Preliminary
                                                        </span>
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
