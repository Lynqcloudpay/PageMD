import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitsApi } from '../api/client';
import { cn, formatDate, getStatusColor, getInitials } from '../utils/helpers';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import {
    Calendar,
    Clock,
    ChevronRight,
    RefreshCw,
    User,
    Stethoscope,
    ClipboardList,
    FileText,
    CheckCircle
} from 'lucide-react';

const statusActions = {
    scheduled: { label: 'Check In', next: 'arrived' },
    arrived: { label: 'Room Patient', next: 'roomed' },
    roomed: { label: 'Start Intake', next: 'in-progress' },
    'in-progress': { label: 'Ready for Provider', next: 'ready' },
    ready: { label: 'Complete Visit', next: 'completed' },
};

export function TodayQueuePage() {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const navigate = useNavigate();

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const response = await visitsApi.getAll();
            setVisits(response.data || []);
        } catch (err) {
            console.error('Failed to fetch visits:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisits();
    }, []);

    const handleStatusChange = async (visitId, newStatus) => {
        try {
            await visitsApi.updateStatus(visitId, newStatus);
            fetchVisits();
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    const openPatientChart = (visit) => {
        navigate(`/patient/${visit.patient_id}?visitId=${visit.id}`);
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Visit List - Left Panel */}
            <div className="w-[420px] bg-white border-r border-slate-200 flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Today's Queue</h1>
                        <p className="text-sm text-slate-500">{formatDate(new Date(), 'full')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchVisits}>
                        <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
                    </Button>
                </div>

                {/* Stats */}
                <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-4 gap-3">
                    {[
                        { label: 'Scheduled', count: visits.filter(v => v.status === 'scheduled').length, color: 'text-slate-600' },
                        { label: 'Arrived', count: visits.filter(v => v.status === 'arrived').length, color: 'text-blue-600' },
                        { label: 'In Progress', count: visits.filter(v => ['roomed', 'in-progress'].includes(v.status)).length, color: 'text-amber-600' },
                        { label: 'Completed', count: visits.filter(v => v.status === 'completed').length, color: 'text-green-600' },
                    ].map(stat => (
                        <div key={stat.label} className="text-center">
                            <div className={cn('text-2xl font-bold', stat.color)}>{stat.count}</div>
                            <div className="text-xs text-slate-500">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Visit List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                        </div>
                    ) : visits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Calendar className="w-10 h-10 mb-2" />
                            <p>No visits scheduled</p>
                        </div>
                    ) : (
                        <ul>
                            {visits.map(visit => (
                                <li
                                    key={visit.id}
                                    onClick={() => setSelectedVisit(visit)}
                                    className={cn(
                                        'px-5 py-4 border-b border-slate-100 cursor-pointer transition-colors',
                                        selectedVisit?.id === visit.id ? 'bg-primary-50' : 'hover:bg-slate-50'
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold shrink-0">
                                            {getInitials(visit.patient_first_name || 'J', visit.patient_last_name || 'D')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-slate-900 truncate">
                                                    {visit.patient_last_name || 'Doe'}, {visit.patient_first_name || 'John'}
                                                </span>
                                                <span className={cn(
                                                    'px-2 py-0.5 rounded-full text-xs font-bold uppercase shrink-0',
                                                    getStatusColor(visit.status)
                                                )}>
                                                    {visit.status || 'Scheduled'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDate(visit.visit_date, 'time')}
                                                </span>
                                                <span>{visit.visit_type || 'Office Visit'}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-300" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Detail Panel - Right Side */}
            <div className="flex-1 overflow-y-auto p-6">
                {selectedVisit ? (
                    <div className="max-w-3xl mx-auto">
                        {/* Patient Card */}
                        <Card className="mb-6">
                            <div className="p-6">
                                <div className="flex items-center gap-5 mb-6">
                                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xl">
                                        {getInitials(selectedVisit.patient_first_name || 'J', selectedVisit.patient_last_name || 'D')}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-slate-900">
                                            {selectedVisit.patient_last_name || 'Doe'}, {selectedVisit.patient_first_name || 'John'}
                                        </h2>
                                        <div className="flex items-center gap-4 text-slate-500 mt-1">
                                            <span>{selectedVisit.visit_type || 'Office Visit'}</span>
                                            <span>•</span>
                                            <span>{formatDate(selectedVisit.visit_date, 'time')}</span>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        'px-4 py-2 rounded-lg text-sm font-bold uppercase',
                                        getStatusColor(selectedVisit.status)
                                    )}>
                                        {selectedVisit.status || 'Scheduled'}
                                    </span>
                                </div>

                                {/* Quick Actions */}
                                <div className="grid grid-cols-4 gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-col h-auto py-4 gap-2"
                                        onClick={() => navigate(`/patient/${selectedVisit.patient_id}/intake?visitId=${selectedVisit.id}`)}
                                    >
                                        <Stethoscope className="w-6 h-6" />
                                        <span>Vitals</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-col h-auto py-4 gap-2"
                                        onClick={() => navigate(`/patient/${selectedVisit.patient_id}/orders?visitId=${selectedVisit.id}`)}
                                    >
                                        <ClipboardList className="w-6 h-6" />
                                        <span>Orders</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-col h-auto py-4 gap-2"
                                        onClick={() => navigate(`/patient/${selectedVisit.patient_id}/note?visitId=${selectedVisit.id}`)}
                                    >
                                        <FileText className="w-6 h-6" />
                                        <span>Note</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-col h-auto py-4 gap-2"
                                        onClick={() => openPatientChart(selectedVisit)}
                                    >
                                        <User className="w-6 h-6" />
                                        <span>Chart</span>
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Status Action */}
                        {statusActions[selectedVisit.status] && (
                            <Button
                                className="w-full py-5 text-lg"
                                size="lg"
                                onClick={() => handleStatusChange(selectedVisit.id, statusActions[selectedVisit.status].next)}
                            >
                                <CheckCircle className="w-6 h-6" />
                                {statusActions[selectedVisit.status].label}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Calendar className="w-16 h-16 mb-4" />
                        <p className="text-lg">Select a visit to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
}
