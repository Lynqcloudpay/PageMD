import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Outlet } from 'react-router-dom';
import { patientsApi, visitsApi } from '../api/client';
import { PatientHeader } from '../components/PatientHeader';
import { cn } from '../utils/helpers';
import {
    History,
    FileText,
    Stethoscope,
    ClipboardList,
    Pill,
    FlaskConical,
    ChevronLeft
} from 'lucide-react';

const tabs = [
    { id: 'overview', label: 'Overview', icon: History },
    { id: 'vitals', label: 'Vitals', icon: Stethoscope },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'meds', label: 'Medications', icon: Pill },
    { id: 'results', label: 'Results', icon: FlaskConical },
];

export function PatientChartPage() {
    const { patientId } = useParams();
    const [searchParams] = useSearchParams();
    const visitId = searchParams.get('visitId');
    const navigate = useNavigate();

    const [patient, setPatient] = useState(null);
    const [visit, setVisit] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [patientRes, visitsRes] = await Promise.all([
                    patientsApi.getSnapshot(patientId),
                    visitId ? visitsApi.getById(visitId) : Promise.resolve(null)
                ]);
                setPatient(patientRes.data?.patient || patientRes.data);
                if (visitsRes?.data) setVisit(visitsRes.data);
            } catch (err) {
                console.error('Failed to fetch patient:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [patientId, visitId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <span className="text-sm text-slate-500">Patient Chart</span>
            </div>

            {/* Patient Header */}
            <PatientHeader patient={patient} visit={visit} />

            {/* Tab Bar */}
            <div className="bg-white border-b border-slate-200 px-4">
                <nav className="flex gap-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors border-b-2 min-h-[52px] whitespace-nowrap',
                                activeTab === tab.id
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && (
                    <PatientOverview patient={patient} />
                )}
                {activeTab === 'vitals' && (
                    <VitalsTab visitId={visitId} patientId={patientId} />
                )}
                {activeTab === 'orders' && (
                    <OrdersTab visitId={visitId} patientId={patientId} />
                )}
                {activeTab === 'notes' && (
                    <NotesTab visitId={visitId} patientId={patientId} />
                )}
                {activeTab === 'meds' && (
                    <MedicationsTab patient={patient} />
                )}
                {activeTab === 'results' && (
                    <ResultsTab patientId={patientId} />
                )}
            </div>
        </div>
    );
}

// Tab Components (basic scaffolding)
function PatientOverview({ patient }) {
    return (
        <div className="max-w-4xl mx-auto grid gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Demographics</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">DOB:</span> <span className="font-medium">{patient?.date_of_birth}</span></div>
                    <div><span className="text-slate-500">Sex:</span> <span className="font-medium">{patient?.sex}</span></div>
                    <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{patient?.phone || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Email:</span> <span className="font-medium">{patient?.email || 'N/A'}</span></div>
                </div>
            </div>
        </div>
    );
}

function VitalsTab({ visitId }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Vitals</h3>
                <p className="text-slate-500">Vitals entry form will be rendered here</p>
            </div>
        </div>
    );
}

function OrdersTab({ visitId }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Orders</h3>
                <p className="text-slate-500">Order entry interface will be rendered here</p>
            </div>
        </div>
    );
}

function NotesTab({ visitId }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Clinical Note</h3>
                <p className="text-slate-500">Documentation interface will be rendered here</p>
            </div>
        </div>
    );
}

function MedicationsTab({ patient }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Active Medications</h3>
                <p className="text-slate-500">Medication list will be rendered here</p>
            </div>
        </div>
    );
}

function ResultsTab({ patientId }) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Results</h3>
                <p className="text-slate-500">Lab and imaging results will be rendered here</p>
            </div>
        </div>
    );
}
