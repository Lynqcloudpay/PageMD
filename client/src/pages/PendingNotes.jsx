import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Calendar, Filter, ArrowRight, Sparkles, ChevronDown, ChevronUp, FileText, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { visitsAPI } from '../services/api';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

const PendingNotes = () => {
    const navigate = useNavigate();
    const [pendingVisits, setPendingVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'draft', 'incomplete'

    const [collapsedGroups, setCollapsedGroups] = useState({});

    useEffect(() => {
        fetchPendingNotes();
        // Refresh every 30 seconds
        const interval = setInterval(fetchPendingNotes, 30000);
        return () => clearInterval(interval);
    }, []);

    // Toggle collapse state for a date group
    const toggleGroup = (date) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

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

        if (visit.status === 'preliminary') {
            return { label: 'Needs Cosign', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Sparkles };
        }

        // Handle null or undefined note_draft
        if (noteText.trim().length === 0) {
            return { label: 'Not Started', color: 'bg-rose-50 text-rose-700 border-rose-100', icon: AlertCircle };
        }

        // Check if note has all required sections
        const hasHPI = /HPI|History of Present Illness/i.test(noteText);
        const hasAssessment = /Assessment|A:/i.test(noteText);
        const hasPlan = /Plan|P:/i.test(noteText);

        if (hasHPI && hasAssessment && hasPlan) {
            return { label: 'Ready to Sign', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 };
        }
        return { label: 'Incomplete', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: FileText };
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

    // Group visits by date
    const groupedVisits = React.useMemo(() => {
        const groups = {};
        filteredVisits.forEach(v => {
            const date = format(new Date(v.visit_date), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(v);
        });

        return Object.keys(groups)
            .sort((a, b) => b.localeCompare(a)) // Newest dates first
            .map(date => ({
                date,
                displayDate: format(parseISO(date), 'EEEE, MMM d, yyyy'),
                items: groups[date]
            }));
    }, [filteredVisits]);

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
                <h1 className="text-xl font-black text-[#10141A] tracking-tighter uppercase mb-0.5">Pending Notes</h1>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{pendingVisits.length} note{pendingVisits.length !== 1 ? 's' : ''} pending completion or signature</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`p-4 rounded-xl border transition-all relative overflow-hidden group text-left ${filterStatus === 'all'
                        ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-100'
                        : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${filterStatus === 'all' ? 'text-blue-700' : 'text-slate-500'}`}>Total Pending</span>
                        <div className={`p-1.5 rounded-lg ${filterStatus === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                            <FileText size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-semibold ${filterStatus === 'all' ? 'text-[#83A2DB]' : 'text-[#10141A]/60'}`}>
                            {pendingVisits.length}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">notes</span>
                    </div>
                </button>

                <button
                    onClick={() => setFilterStatus('draft')}
                    className={`p-4 rounded-xl border transition-all relative overflow-hidden group text-left ${filterStatus === 'draft'
                        ? 'bg-emerald-50 border-emerald-200 shadow-md ring-1 ring-emerald-100'
                        : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-sm'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${filterStatus === 'draft' ? 'text-emerald-700' : 'text-slate-500'}`}>Ready to Sign</span>
                        <div className={`p-1.5 rounded-lg ${filterStatus === 'draft' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-semibold ${filterStatus === 'draft' ? 'text-emerald-700' : 'text-[#10141A]/60'}`}>
                            {pendingVisits.filter(v => getNoteStatus(v).label === 'Ready to Sign').length}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">review</span>
                    </div>
                </button>

                <button
                    onClick={() => setFilterStatus('incomplete')}
                    className={`p-4 rounded-xl border transition-all relative overflow-hidden group text-left ${filterStatus === 'incomplete'
                        ? 'bg-amber-50 border-amber-200 shadow-md ring-1 ring-amber-100'
                        : 'bg-white border-slate-200 hover:border-amber-200 hover:shadow-sm'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${filterStatus === 'incomplete' ? 'text-amber-700' : 'text-slate-500'}`}>Incomplete</span>
                        <div className={`p-1.5 rounded-lg ${filterStatus === 'incomplete' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500'}`}>
                            <AlertCircle size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-semibold ${filterStatus === 'incomplete' ? 'text-amber-700' : 'text-[#10141A]/60'}`}>
                            {pendingVisits.filter(v => {
                                const status = getNoteStatus(v);
                                return status.label === 'Incomplete' || status.label === 'Not Started';
                            }).length}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">drafts</span>
                    </div>
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by patient name, MRN, or note content..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                    />
                </div>

                {/* Visual filter indicator (optional, mostly handled by cards) but keeping simple filter dropdown if complex filtering needed later */}
                <div className="flex items-center gap-2">
                    <div className="bg-slate-100 rounded-xl p-1 flex">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterStatus('draft')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterStatus === 'draft' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Ready
                        </button>
                        <button
                            onClick={() => setFilterStatus('incomplete')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterStatus === 'incomplete' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Incomplete
                        </button>
                    </div>

                    <button
                        onClick={fetchPendingNotes}
                        className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-xl transition-all"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Pending Notes List Grouped */}
            {filteredVisits.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">
                        {searchQuery || filterStatus !== 'all' ? 'No notes match your filters' : 'No pending notes'}
                    </h3>
                    <p className="text-slate-500">
                        {searchQuery || filterStatus !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'All visit notes have been completed and signed'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedVisits.map((group, index) => (
                        <div key={group.date} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group/card transition-all hover:shadow-md">
                            {/* Date Header */}
                            <div
                                className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleGroup(group.date)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors ${(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0) // Check if collapsed
                                        ? 'bg-white border border-slate-200 text-slate-400'
                                        : 'bg-blue-600 border border-blue-600 text-white'
                                        }`}>
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-semibold tracking-tight transition-colors ${(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0)
                                            ? 'text-slate-600'
                                            : 'text-blue-900'
                                            }`}>
                                            {group.displayDate}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0)
                                                ? 'bg-slate-200 text-slate-600'
                                                : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {group.items.length} Note{group.items.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-lg transition-colors ${(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0)
                                    ? 'text-slate-400 group-hover/card:bg-white'
                                    : 'text-blue-600 bg-blue-50'
                                    }`}>
                                    {(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0) ? (
                                        <ChevronDown className="w-5 h-5" />
                                    ) : (
                                        <ChevronUp className="w-5 h-5" />
                                    )}
                                </div>
                            </div>

                            {/* Items in Group */}
                            {!(collapsedGroups[group.date] !== undefined ? collapsedGroups[group.date] : index !== 0) && (
                                <div className="divide-y divide-slate-100">
                                    {group.items.map((visit) => {
                                        const status = getNoteStatus(visit);
                                        const StatusIcon = status.icon;
                                        const daysSince = getDaysSinceVisit(visit.visit_date);
                                        const notePreview = getNotePreview(visit.note_draft);
                                        const patientName = `${visit.patient_first_name || ''} ${visit.patient_last_name || ''}`.trim() || 'Unknown Patient';

                                        return (
                                            <div
                                                key={visit.id}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleOpenNote(visit);
                                                }}
                                                className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors group relative border-l-[3px] border-l-transparent hover:border-l-blue-500"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    {/* Left side - Patient & Visit Info */}
                                                    <div className="flex-1 min-w-0 flex items-start flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">

                                                        {/* Patient Name */}
                                                        <div className="flex-shrink-0 w-44">
                                                            <div className="font-semibold text-sm text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                                                                {patientName}
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-mono mt-0.5 bg-slate-100 inline-block px-1.5 rounded">
                                                                {visit.mrn}
                                                            </div>
                                                        </div>

                                                        {/* Visit Date & Type */}
                                                        <div className="flex-shrink-0 w-40 text-sm text-slate-600">
                                                            <div className="font-medium text-slate-700">{visit.visit_type || 'Office Visit'}</div>
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                                                <Calendar className="w-3 h-3" />
                                                                <span>{format(new Date(visit.visit_date), 'MMM d')}</span>
                                                                {daysSince > 0 && (
                                                                    <span className={`px-1.5 rounded text-[10px] font-medium ${daysSince > 7 ? 'bg-red-50 text-red-600' : daysSince > 3 ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                        {daysSince}d old
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Note Preview */}
                                                        <div className="flex-1 min-w-0 text-sm text-slate-600 hidden md:block">
                                                            {notePreview?.hpi ? (
                                                                <div className="truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    <span className="font-medium text-slate-700">HPI: </span>
                                                                    <span>{notePreview.hpi.substring(0, 120)}...</span>
                                                                </div>
                                                            ) : notePreview?.assessment ? (
                                                                <div className="truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    <span className="font-medium text-slate-700">A: </span>
                                                                    <span>{notePreview.assessment.substring(0, 120)}...</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-xs">No content draft started...</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right side - Status Badge & Arrow */}
                                                    <div className="flex items-center gap-4 flex-shrink-0">
                                                        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-sm ${status.color}`}>
                                                            <StatusIcon className="w-3.5 h-3.5" />
                                                            <span>{status.label}</span>
                                                        </div>
                                                        <div className="p-1 rounded-full text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                                                            <ArrowRight className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
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
