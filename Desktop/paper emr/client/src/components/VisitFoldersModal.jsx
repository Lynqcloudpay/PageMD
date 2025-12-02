import React, { useState, useMemo } from 'react';
import { X, FileText, Clock, Edit, Eye } from 'lucide-react';
import { format, parse, compareDesc } from 'date-fns';

const VisitFoldersModal = ({ isOpen, onClose, visits, onViewVisit }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'draft', 'signed'

    // Filter visits - must be called before early return
    const filteredVisits = useMemo(() => {
        let filtered = visits.filter(visit => {
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
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'all'
                                    ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            All ({visits.length})
                        </button>
                        <button
                            onClick={() => setFilter('draft')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'draft'
                                    ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-600'
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            Draft ({visits.filter(v => !v.signed).length})
                        </button>
                        <button
                            onClick={() => setFilter('signed')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                filter === 'signed'
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
                        <div className="divide-y divide-neutral-200">
                            {filteredVisits.map((visit) => (
                                <div
                                    key={visit.id}
                                    onClick={() => onViewVisit(visit.id)}
                                    className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                                                visit.signed 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700">
                                                        {visit.type}
                                                    </h3>
                                                    {visit.signed ? (
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                                                            Signed
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                                                            Draft
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-4 text-sm text-neutral-600">
                                                    <span className="flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {visit.date}
                                                    </span>
                                                    <span>{visit.provider}</span>
                                                </div>
                                                {visit.summary && (
                                                    <p className="text-sm text-neutral-600 mt-2 line-clamp-2">
                                                        {visit.summary}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4 flex-shrink-0">
                                            {visit.signed ? (
                                                <Eye className="w-5 h-5 text-neutral-400 group-hover:text-primary-600 transition-colors" />
                                            ) : (
                                                <Edit className="w-5 h-5 text-neutral-400 group-hover:text-orange-600 transition-colors" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VisitFoldersModal;
