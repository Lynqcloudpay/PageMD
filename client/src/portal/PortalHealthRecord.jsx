import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
    Pill,
    AlertCircle,
    ClipboardList,
    FlaskConical,
    Activity,
    FileText,
    ArrowUpRight,
    RefreshCw
} from 'lucide-react';

const PortalHealthRecord = () => {
    const [data, setData] = useState({
        medications: [],
        allergies: [],
        problems: [],
        labs: [],
        vitals: [],
        documents: []
    });
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('medications');

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('portalToken');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [medsRes, allergiesRes, problemsRes, labsRes, vitalsRes, docsRes] = await Promise.all([
                axios.get(`${apiBase}/portal/chart/medications`, { headers }),
                axios.get(`${apiBase}/portal/chart/allergies`, { headers }),
                axios.get(`${apiBase}/portal/chart/problems`, { headers }),
                axios.get(`${apiBase}/portal/chart/labs`, { headers }).catch(() => ({ data: [] })),
                axios.get(`${apiBase}/portal/chart/vitals`, { headers }),
                axios.get(`${apiBase}/portal/chart/documents`, { headers }).catch(() => ({ data: [] }))
            ]);

            setData({
                medications: medsRes.data || [],
                allergies: allergiesRes.data || [],
                problems: problemsRes.data || [],
                labs: labsRes.data || [],
                vitals: vitalsRes.data || [],
                documents: docsRes.data || []
            });
        } catch (err) {
            console.error('Failed to fetch health records:', err);
        } finally {
            setLoading(false);
        }
    };

    const sections = [
        { id: 'medications', label: 'Medications', icon: Pill, color: 'blue', count: data.medications.length },
        { id: 'allergies', label: 'Allergies', icon: AlertCircle, color: 'red', count: data.allergies.length },
        { id: 'problems', label: 'Conditions', icon: ClipboardList, color: 'purple', count: data.problems.length },
        { id: 'labs', label: 'Lab Results', icon: FlaskConical, color: 'emerald', count: data.labs.length },
        { id: 'vitals', label: 'Vitals', icon: Activity, color: 'amber', count: data.vitals.length },
        { id: 'documents', label: 'Documents', icon: FileText, color: 'slate', count: data.documents.length }
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Loading Health Records...</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">Health Record</h1>
                <button
                    onClick={fetchAllData}
                    className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Refresh"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Section Tabs - Horizontal scrollable on mobile */}
            <div
                className="flex gap-3 overflow-x-auto pb-4 pt-1 mb-2 -mx-5 px-5 scrollbar-hide touch-pan-x"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {sections.map(section => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${isActive
                                ? 'text-white shadow-lg'
                                : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-200 active:scale-95'
                                }`}
                            style={isActive ? { backgroundColor: getColorHex(section.color), boxShadow: `0 4px 14px ${getColorHex(section.color)}40` } : {}}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{section.label}</span>
                            {section.count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25' : 'bg-gray-50'}`}>
                                    {section.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {activeSection === 'medications' && <MedicationsSection data={data.medications} />}
                {activeSection === 'allergies' && <AllergiesSection data={data.allergies} />}
                {activeSection === 'problems' && <ProblemsSection data={data.problems} />}
                {activeSection === 'labs' && <LabsSection data={data.labs} />}
                {activeSection === 'vitals' && <VitalsSection data={data.vitals} />}
                {activeSection === 'documents' && <DocumentsSection data={data.documents} />}
            </div>
        </div>
    );
};

const getColorHex = (color) => {
    const colors = {
        blue: '#2563eb',
        red: '#dc2626',
        purple: '#9333ea',
        emerald: '#059669',
        amber: '#d97706',
        slate: '#475569'
    };
    return colors[color] || colors.blue;
};

const EmptyState = ({ message }) => (
    <div className="p-12 text-center">
        <p className="text-gray-400 text-sm">{message}</p>
    </div>
);

const MedicationsSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No active medications on file" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.map(med => (
                <div key={med.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">{med.medication_name}</h4>
                            <p className="text-sm text-gray-500">{med.dosage} • {med.frequency}</p>
                            {med.instructions && <p className="text-xs text-gray-400 mt-1">{med.instructions}</p>}
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold uppercase">Active</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const AllergiesSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No known allergies on file" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.map(allergy => (
                <div key={allergy.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{allergy.allergen}</h4>
                            <p className="text-sm text-gray-500">
                                {allergy.reaction}
                                {allergy.severity && <span className="ml-2 text-red-500">• {allergy.severity}</span>}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ProblemsSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No active conditions on file" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.map(problem => (
                <div key={problem.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">{problem.problem_name}</h4>
                            {problem.icd10_code && <p className="text-xs text-gray-400">ICD-10: {problem.icd10_code}</p>}
                        </div>
                        {problem.onset_date && (
                            <span className="text-xs text-gray-400">Since {format(new Date(problem.onset_date), 'MMM yyyy')}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const LabsSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No lab results available" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.map(lab => (
                <div key={lab.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">{lab.test_name}</h4>
                            <p className="text-sm">
                                <span className={`font-bold ${lab.abnormal_flags ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {lab.result_value} {lab.result_units}
                                </span>
                                {lab.reference_range && <span className="text-gray-400 ml-2">Ref: {lab.reference_range}</span>}
                            </p>
                        </div>
                        {lab.completed_at && (
                            <span className="text-xs text-gray-400">{format(new Date(lab.completed_at), 'MMM d, yyyy')}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const VitalsSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No vital signs recorded" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.slice(0, 10).map((visit, idx) => {
                const vitals = typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals;
                return (
                    <div key={idx} className="p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-400">{format(new Date(visit.visit_date), 'MMMM d, yyyy')}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {vitals?.bp && <VitalItem label="Blood Pressure" value={vitals.bp} unit="mmHg" />}
                            {vitals?.heart_rate && <VitalItem label="Heart Rate" value={vitals.heart_rate} unit="bpm" />}
                            {vitals?.temp && <VitalItem label="Temperature" value={vitals.temp} unit="°F" />}
                            {vitals?.weight && <VitalItem label="Weight" value={vitals.weight} unit="lbs" />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const VitalItem = ({ label, value, unit }) => (
    <div className="bg-gray-50 rounded-lg p-2">
        <div className="text-[9px] font-bold text-gray-400 uppercase">{label}</div>
        <div className="text-sm font-bold text-gray-800">{value} <span className="text-gray-400 text-xs">{unit}</span></div>
    </div>
);

const DocumentsSection = ({ data }) => {
    if (data.length === 0) return <EmptyState message="No documents available" />;
    return (
        <div className="divide-y divide-gray-50">
            {data.map(doc => (
                <div key={doc.id} className="p-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{doc.filename || doc.doc_type}</h4>
                            <p className="text-xs text-gray-400">{format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
                        </div>
                    </div>
                    <button className="p-2 text-gray-400 group-hover:text-blue-600 transition-colors">
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default PortalHealthRecord;
