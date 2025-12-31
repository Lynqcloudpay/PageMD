import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, User, AlertCircle, CheckCircle2,
    Search, Calendar, Filter, ArrowRight, Sparkles
} from 'lucide-react';
import { visitsAPI } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';

const PendingNotes = () => {
    const navigate = useNavigate();
    const [pendingVisits, setPendingVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'draft', 'incomplete'

    useEffect(() => {
        fetchPendingNotes();
        // Refresh every 30 seconds
        const interval = setInterval(fetchPendingNotes, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchPendingNotes = async () => {
        setLoading(true);
        try {
            const response = await visitsAPI.getPending();
            setPendingVisits(response.data || []);
        } catch (error) {
            console.error('Error fetching pending notes:', error);
            setPendingVisits([]);
        } finally {
            setLoading(false);
        }
    };

    const getNoteStatus = (visit) => {
        const rawNote = visit.note_draft || "";
        const noteText = typeof rawNote === 'string' ? rawNote : String(rawNote);

        // Handle null or undefined note_draft
        if (noteText.trim().length === 0) {
            return { label: 'Not Started', color: 'bg-red-100 text-red-700', icon: AlertCircle };
        }
        // Check if note has all required sections
        const hasHPI = /HPI|History of Present Illness/i.test(noteText);
        const hasAssessment = /Assessment|A:/i.test(noteText);
        const hasPlan = /Plan|P:/i.test(noteText);

        if (hasHPI && hasAssessment && hasPlan) {
            return { label: 'Ready to Sign', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
        }
        return { label: 'Incomplete', color: 'bg-orange-100 text-orange-700', icon: FileText };
    };

    const getNotePreview = (rawNote) => {
        if (!rawNote) return null;
        const noteDraft = typeof rawNote === 'string' ? rawNote : String(rawNote);

        const sections = {
            hpi: '',
            ros: '',
            pe: '',
            assessment: '',
            plan: ''
        };

        // Extract sections
        const hpiMatch = noteDraft.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is);
        if (hpiMatch) sections.hpi = hpiMatch[1].trim().substring(0, 100);

        const rosMatch = noteDraft.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
        if (rosMatch) sections.ros = rosMatch[1].trim().substring(0, 100);

        const peMatch = noteDraft.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
        if (peMatch) sections.pe = peMatch[1].trim().substring(0, 100);

        const assessmentMatch = noteDraft.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
        if (assessmentMatch) sections.assessment = assessmentMatch[1].trim().substring(0, 100);

        const planMatch = noteDraft.match(/(?:Plan|P):\s*(.+?)(?:\n\n|$)/is);
        if (planMatch) sections.plan = planMatch[1].trim().substring(0, 100);

        return sections;
    };

    const filteredVisits = pendingVisits.filter(visit => {
        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const patientName = `${visit.patient_first_name} ${visit.patient_last_name}`.toLowerCase();
            const noteText = typeof visit.note_draft === 'string' ? visit.note_draft : String(visit.note_draft || "");
            const matchesSearch =
                patientName.includes(query) ||
                visit.mrn?.toLowerCase().includes(query) ||
                visit.visit_type?.toLowerCase().includes(query) ||
                noteText.toLowerCase().includes(query);
            if (!matchesSearch) return false;
        }

        // Status filter
        if (filterStatus === 'draft') {
            const status = getNoteStatus(visit);
            return status.label === 'Ready to Sign';
        }
        if (filterStatus === 'incomplete') {
            const status = getNoteStatus(visit);
            return status.label === 'Incomplete' || status.label === 'Not Started';
        }

        return true;
    });

    const handleOpenNote = (visit) => {
        const patientId = visit.patient_id || visit.patientId;
        const visitId = visit.id;

        if (!visitId || !patientId) {
            console.error('Missing required fields for visit:', { visitId, patientId });
            return;
        }

        // Navigate directly to the specific visit note
        navigate(`/patient/${patientId}/visit/${visitId}`);
    };

    const getDaysSinceVisit = (visitDate) => {
        const days = Math.floor((new Date() - new Date(visitDate)) / (1000 * 60 * 60 * 24));
        return days;
    };

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                        <p className="text-ink-600">Loading pending notes...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <FileText className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-primary-900">Pending Notes</h1>
                            <p className="text-gray-600 text-sm mt-1">
                                {pendingVisits.length} note{pendingVisits.length !== 1 ? 's' : ''} pending completion or signature
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchPendingNotes}
                        className="px-4 py-2 text-white rounded-lg transition-all duration-200 hover:shadow-md flex items-center space-x-2"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by patient name, MRN, or note content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center space-x-2">
                        <Filter className="w-5 h-5 text-gray-400" />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all'
                                    ? 'text-white shadow-sm'
                                    : 'bg-neutral-100 text-gray-700 hover:bg-neutral-200'
                                    }`}
                            >
                                All ({pendingVisits.length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('draft')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'draft'
                                    ? 'bg-green-600 text-white shadow-sm'
                                    : 'bg-neutral-100 text-gray-700 hover:bg-neutral-200'
                                    }`}
                            >
                                Ready to Sign ({pendingVisits.filter(v => getNoteStatus(v).label === 'Ready to Sign').length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('incomplete')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'incomplete'
                                    ? 'bg-orange-600 text-white shadow-sm'
                                    : 'bg-neutral-100 text-gray-700 hover:bg-neutral-200'
                                    }`}
                            >
                                Incomplete ({pendingVisits.filter(v => {
                                    const status = getNoteStatus(v);
                                    return status.label === 'Incomplete' || status.label === 'Not Started';
                                }).length})
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Notes List */}
            {filteredVisits.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-semibold text-primary-900 mb-2">
                        {searchQuery || filterStatus !== 'all' ? 'No notes match your filters' : 'No pending notes'}
                    </h3>
                    <p className="text-gray-600">
                        {searchQuery || filterStatus !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'All visit notes have been completed and signed'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
                        {filteredVisits.map((visit) => {
                            const status = getNoteStatus(visit);
                            const StatusIcon = status.icon;
                            const daysSince = getDaysSinceVisit(visit.visit_date);
                            const notePreview = getNotePreview(visit.note_draft);
                            const patientName = `${visit.patient_first_name || ''} ${visit.patient_last_name || ''}`.trim() || 'Unknown Patient';
                            const providerName = visit.provider_first_name && visit.provider_last_name
                                ? `${visit.provider_first_name} ${visit.provider_last_name}`
                                : 'Unknown Provider';

                            return (
                                <div
                                    key={visit.id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleOpenNote(visit);
                                    }}
                                    className="px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Left side - Patient & Visit Info */}
                                        <div className="flex-1 min-w-0 flex items-center gap-4">
                                            {/* Status Indicator */}
                                            <div className={`flex-shrink-0 w-1 h-12 rounded-full ${status.label === 'Ready to Sign' ? 'bg-green-500' :
                                                status.label === 'Incomplete' ? 'bg-orange-500' :
                                                    'bg-red-500'
                                                }`} />

                                            {/* Patient Name */}
                                            <div className="flex-shrink-0 w-40">
                                                <div className="font-semibold text-sm text-primary-900 truncate group-hover:text-primary-700">
                                                    {patientName}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                                    {visit.mrn}
                                                </div>
                                            </div>

                                            {/* Visit Date */}
                                            <div className="flex-shrink-0 w-32 text-sm text-gray-600">
                                                <div className="flex items-center space-x-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>{format(new Date(visit.visit_date), 'MMM d, yyyy')}</span>
                                                </div>
                                                {daysSince > 0 && (
                                                    <div className={`text-xs mt-0.5 ${daysSince > 7 ? 'text-red-600' : daysSince > 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                                                        {daysSince} day{daysSince !== 1 ? 's' : ''} ago
                                                    </div>
                                                )}
                                            </div>

                                            {/* Visit Type & Provider */}
                                            <div className="flex-shrink-0 w-48 text-sm text-gray-600">
                                                <div className="truncate">{visit.visit_type || 'Office Visit'}</div>
                                                <div className="text-xs text-gray-500 truncate mt-0.5">{providerName}</div>
                                            </div>

                                            {/* Note Preview */}
                                            <div className="flex-1 min-w-0 text-sm text-gray-600 hidden md:block">
                                                {notePreview?.hpi ? (
                                                    <div className="truncate">
                                                        <span className="font-medium text-gray-700">HPI: </span>
                                                        <span>{notePreview.hpi.substring(0, 80)}...</span>
                                                    </div>
                                                ) : notePreview?.assessment ? (
                                                    <div className="truncate">
                                                        <span className="font-medium text-gray-700">A: </span>
                                                        <span>{notePreview.assessment.substring(0, 80)}...</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">No note content</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right side - Status Badge & Arrow */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 ${status.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                <span>{status.label}</span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Summary Footer */}
            {filteredVisits.length > 0 && (
                <div className="mt-6 text-center text-sm text-gray-600">
                    Showing {filteredVisits.length} of {pendingVisits.length} pending note{pendingVisits.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};

export default PendingNotes;
