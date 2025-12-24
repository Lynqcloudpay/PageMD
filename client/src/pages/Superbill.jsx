import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, CheckCircle, Printer, FileDown, Trash2, Plus,
    Search, Shield, Building, User, Calendar, Info,
    ChevronRight, AlertTriangle, X, FileText, ArrowLeft
} from 'lucide-react';
import { superbillsAPI, codesAPI, authAPI, settingsAPI } from '../services/api';
import { format } from 'date-fns';
import CodeSearchModal from '../components/CodeSearchModal';
import { useAuth } from '../context/AuthContext';

const Superbill = () => {
    const { id: patientId, superbillId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [sb, setSb] = useState(null);
    const [providers, setProviders] = useState([]);
    const [locations, setLocations] = useState([]);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showCPTModal, setShowCPTModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);

    useEffect(() => {
        fetchData();
        fetchSupportData();
    }, [superbillId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await superbillsAPI.get(superbillId);
            setSb(response.data);
        } catch (error) {
            console.error('Error fetching superbill:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSupportData = async () => {
        try {
            const provRes = await authAPI.getProviders();
            setProviders(provRes.data || []);

            const locRes = await settingsAPI.getLocations();
            setLocations(locRes.data || []);
        } catch (error) {
            console.error('Error fetching support data:', error);
        }
    };

    const handleUpdateSb = async (updates) => {
        try {
            setSaving(true);
            await superbillsAPI.update(superbillId, updates);
            setSb(prev => ({ ...prev, ...updates }));
        } catch (error) {
            console.error('Error updating superbill:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddDiagnosis = async (code) => {
        try {
            await superbillsAPI.addDiagnosis(superbillId, {
                icd10_code: code.code,
                description: code.description,
                sequence: sb.diagnoses.length + 1
            });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to add diagnosis');
        }
    };

    const handleAddLine = async (code) => {
        try {
            await superbillsAPI.addLine(superbillId, {
                cpt_code: code.code,
                description: code.description,
                units: 1,
                charge: code.fee_amount || 0,
                service_date: sb.service_date_from
            });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to add line item');
        }
    };

    const handleRemoveDiagnosis = async (diagId) => {
        if (window.confirm('Remove this diagnosis?')) {
            await superbillsAPI.deleteDiagnosis(superbillId, diagId);
            fetchData();
        }
    };

    const handleRemoveLine = async (lineId) => {
        if (window.confirm('Remove this charge?')) {
            await superbillsAPI.deleteLine(superbillId, lineId);
            fetchData();
        }
    };

    const handleUpdateLine = async (lineId, updates) => {
        try {
            await superbillsAPI.updateLine(superbillId, lineId, updates);
            setSb(prev => ({
                ...prev,
                lines: prev.lines.map(l => l.id === lineId ? { ...l, ...updates } : l)
            }));
            // We might need to refresh because totals change on the server
            fetchData();
        } catch (error) {
            console.error('Error updating line:', error);
        }
    };

    const [isFinalizing, setIsFinalizing] = useState(false);

    const handleFinalize = async () => {
        // Warning if note is not signed
        if (!sb.note_signed_at && !window.confirm('⚠️ Warning: Clinical note is NOT SIGNED.\n\nAre you sure you want to finalize this superbill?')) {
            return;
        }

        if (!window.confirm('Finalize this superbill? This will lock editing.')) return;

        setIsFinalizing(true);
        try {
            const response = await superbillsAPI.finalize(superbillId);
            if (response.data) {
                setSb(response.data);
                alert('Superbill finalized successfully.');
            } else {
                fetchData();
            }
        } catch (error) {
            console.error('Finalize error:', error);
            alert(error.response?.data?.error || 'Finalization failed');
        } finally {
            setIsFinalizing(false);
        }
    };

    useEffect(() => {
        console.log('Superbill Component Loaded - Version 2.0');
    }, []);

    const handlePrint = () => {
        window.open(superbillsAPI.printUrl(superbillId), '_blank');
    };

    if (loading) return <div className="p-8 text-center">Loading superbill...</div>;
    if (!sb) return <div className="p-8 text-center text-red-500">Superbill not found</div>;

    const isFinalized = sb.status === 'FINALIZED';
    const isVoid = sb.status === 'VOID';
    const isLocked = isFinalized || isVoid;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold">Superbill #{sb.id.substring(0, 8).toUpperCase()}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sb.status === 'FINALIZED' ? 'bg-green-100 text-green-700' :
                                sb.status === 'VOID' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {sb.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500">Patient: <span className="font-semibold text-slate-700">{sb.patient_last_name}, {sb.patient_first_name}</span> • MRN: {sb.mrn}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isLocked && (
                        <>
                            <button
                                onClick={handleFinalize}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-sm"
                            >
                                <CheckCircle className="w-4 h-4" /> Finalize
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.confirm('Void this superbill?')) {
                                        await superbillsAPI.void(superbillId);
                                        fetchData();
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium transition-all shadow-sm"
                            >
                                <X className="w-4 h-4" /> Void
                            </button>
                        </>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all shadow-sm"
                    >
                        <Printer className="w-4 h-4" /> Print PDF
                    </button>
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all shadow-sm">
                            <FileDown className="w-4 h-4" /> Export
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-1 w-48 z-50">
                            <button onClick={async () => {
                                const res = await superbillsAPI.exportCMS1500(superbillId);
                                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `cms1500_${superbillId}.json`; a.click();
                            }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" /> CMS-1500 JSON
                            </button>
                            <button onClick={async () => {
                                const res = await superbillsAPI.export837P(superbillId);
                                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `837p_${superbillId}.json`; a.click();
                            }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded text-sm flex items-center gap-2">
                                <Shield className="w-4 h-4" /> EDI 837P Ready
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Section 1: Demographics & Service Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card title="Patient Details" icon={<User className="w-4 h-4" />}>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <span className="text-slate-500">Name</span><span className="font-medium">{sb.patient_last_name}, {sb.patient_first_name}</span>
                                <span className="text-slate-500">DOB</span><span className="font-medium">{sb.dob}</span>
                                <span className="text-slate-500">Sex</span><span className="font-medium">{sb.sex}</span>
                                <span className="text-slate-500">Insurance</span><span className="font-medium">{sb.insurance_provider || 'Self-Pay'}</span>
                            </div>
                        </Card>

                        <Card title="Encounter Info" icon={<Calendar className="w-4 h-4" />}>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Service Date</label>
                                    <input
                                        type="date"
                                        value={sb.service_date_from}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateSb({ service_date_from: e.target.value, service_date_to: e.target.value })}
                                        className="w-full bg-transparent border-b border-slate-200 py-1 font-medium focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Place of Service (POS)</label>
                                    <select
                                        value={sb.place_of_service}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateSb({ place_of_service: e.target.value })}
                                        className="w-full bg-transparent border-b border-slate-200 py-1 font-medium focus:border-blue-500 outline-none"
                                    >
                                        <option value="11">11 - Office</option>
                                        <option value="12">12 - Home</option>
                                        <option value="21">21 - Inpatient Hospital</option>
                                        <option value="22">22 - Outpatient Hospital</option>
                                        <option value="02">02 - Telehealth</option>
                                    </select>
                                </div>
                            </div>
                        </Card>

                        <Card title="Providers & Facility" icon={<Building className="w-4 h-4" />}>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Rendering Provider</label>
                                    <select
                                        value={sb.rendering_provider_id}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateSb({ rendering_provider_id: e.target.value })}
                                        className="w-full bg-transparent border-b border-slate-200 py-1 font-medium focus:border-blue-500 outline-none"
                                    >
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Billing Provider</label>
                                    <select
                                        value={sb.billing_provider_id}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateSb({ billing_provider_id: e.target.value })}
                                        className="w-full bg-transparent border-b border-slate-200 py-1 font-medium focus:border-blue-500 outline-none"
                                    >
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Facility Location</label>
                                    <select
                                        value={sb.facility_location_id || ''}
                                        disabled={isLocked}
                                        onChange={(e) => handleUpdateSb({ facility_location_id: e.target.value })}
                                        className="w-full bg-transparent border-b border-slate-200 py-1 font-medium focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Select Location --</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                        {/* Diagnoses Panel */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2 text-sm text-slate-700">
                                        <AlertTriangle className="w-4 h-4 text-orange-500" /> Diagnoses (ICD-10)
                                    </h3>
                                    {!isLocked && (
                                        <button
                                            onClick={() => setShowICD10Modal(true)}
                                            className="p-1 hover:bg-white rounded text-blue-600 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="p-4 space-y-2">
                                    {sb.diagnoses.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-4">No diagnoses added</p>
                                    ) : (
                                        sb.diagnoses.map((diag, idx) => (
                                            <div key={diag.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg group transition-colors">
                                                <span className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-500 text-[10px] font-bold rounded mt-0.5">
                                                    {String.fromCharCode(65 + idx)}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800">{diag.icd10_code}</p>
                                                    <p className="text-xs text-slate-500 truncate">{diag.description}</p>
                                                </div>
                                                {!isLocked && (
                                                    <button
                                                        onClick={() => handleRemoveDiagnosis(diag.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Procedures Table */}
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2 text-sm text-slate-700">
                                        <FileText className="w-4 h-4 text-blue-500" /> Procedures & Services (CPT)
                                    </h3>
                                    {!isLocked && (
                                        <button
                                            onClick={() => setShowCPTModal(true)}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Row
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                                                <th className="px-4 py-3 text-left">CPT</th>
                                                <th className="px-4 py-3 text-left">Description</th>
                                                <th className="px-4 py-3 text-left">Mod</th>
                                                <th className="px-4 py-3 text-right">Units</th>
                                                <th className="px-4 py-3 text-right">Charge</th>
                                                <th className="px-4 py-3 text-center">Pointer</th>
                                                {!isLocked && <th className="px-4 py-3"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {(!sb.lines || sb.lines.length === 0) ? (
                                                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400 italic">No services billed</td></tr>
                                            ) : sb.lines.map(line => (
                                                <tr key={line.id} className="hover:bg-slate-50/50 group transition-colors">
                                                    <td className="px-4 py-3 font-bold text-blue-600">{line.cpt_code}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-600 max-w-[200px] truncate">{line.description}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-1">
                                                            <input
                                                                type="text"
                                                                value={line.modifier1 || ''}
                                                                disabled={isLocked}
                                                                maxLength={2}
                                                                onChange={(e) => handleUpdateLine(line.id, { modifier1: e.target.value })}
                                                                className="w-8 bg-slate-50 border-b border-slate-200 outline-none focus:border-blue-400 text-center uppercase"
                                                                placeholder="--"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={line.modifier2 || ''}
                                                                disabled={isLocked}
                                                                maxLength={2}
                                                                onChange={(e) => handleUpdateLine(line.id, { modifier2: e.target.value })}
                                                                className="w-8 bg-slate-50 border-b border-slate-200 outline-none focus:border-blue-400 text-center uppercase"
                                                                placeholder="--"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={line.modifier3 || ''}
                                                                disabled={isLocked}
                                                                maxLength={2}
                                                                onChange={(e) => handleUpdateLine(line.id, { modifier3: e.target.value })}
                                                                className="w-8 bg-slate-50 border-b border-slate-200 outline-none focus:border-blue-400 text-center uppercase"
                                                                placeholder="--"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={line.modifier4 || ''}
                                                                disabled={isLocked}
                                                                maxLength={2}
                                                                onChange={(e) => handleUpdateLine(line.id, { modifier4: e.target.value })}
                                                                className="w-8 bg-slate-50 border-b border-slate-200 outline-none focus:border-blue-400 text-center uppercase"
                                                                placeholder="--"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input
                                                            type="number"
                                                            value={line.units}
                                                            disabled={isLocked}
                                                            onChange={(e) => handleUpdateLine(line.id, { units: parseInt(e.target.value) || 1 })}
                                                            className="w-12 bg-transparent text-right outline-none focus:border-b focus:border-blue-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold">
                                                        $<input
                                                            type="number"
                                                            value={line.charge}
                                                            disabled={isLocked}
                                                            step="0.01"
                                                            onChange={(e) => handleUpdateLine(line.id, { charge: parseFloat(e.target.value) || 0 })}
                                                            className="w-20 bg-transparent text-right outline-none focus:border-b focus:border-blue-400 font-semibold"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="text"
                                                            value={line.diagnosis_pointers || '1'}
                                                            disabled={isLocked}
                                                            onChange={(e) => handleUpdateLine(line.id, { diagnosis_pointers: e.target.value })}
                                                            className="w-16 bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-center text-xs outline-none focus:ring-1 focus:ring-blue-400"
                                                            placeholder="1,2"
                                                        />
                                                    </td>
                                                    {!isLocked && (
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => handleRemoveLine(line.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Summary Row */}
                                <div className="bg-slate-50/50 p-6 flex flex-col items-end border-t border-slate-100">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-slate-500 font-medium">
                                            <span>Total Units:</span>
                                            <span className="text-slate-900">{sb.total_units}</span>
                                        </div>
                                        <div className="flex justify-between text-lg">
                                            <span className="font-bold text-slate-900">Total Charges:</span>
                                            <span className="font-black text-blue-600">${parseFloat(sb.total_charges).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div >
            </main >

            {/* Code Search Modals */}
            {
                showICD10Modal && (
                    <CodeSearchModal
                        isOpen={showICD10Modal}
                        onClose={() => setShowICD10Modal(false)}
                        onSelect={(code) => { handleAddDiagnosis(code); setShowICD10Modal(false); }}
                        codeType="ICD10"
                    />
                )
            }
            {
                showCPTModal && (
                    <CodeSearchModal
                        isOpen={showCPTModal}
                        onClose={() => setShowCPTModal(false)}
                        onSelect={(code) => { handleAddLine(code); setShowCPTModal(false); }}
                        codeType="CPT"
                    />
                )
            }
        </div >
    );
};

const Card = ({ title, icon, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
            <span className="text-blue-500">{icon}</span>
            <h3 className="font-bold text-xs text-slate-600 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="p-4 flex-1">
            {children}
        </div>
    </div>
);

export default Superbill;
