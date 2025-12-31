import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, X, Plus, Trash2, Search, Info, ChevronRight,
    AlertTriangle, CheckCircle, RefreshCw, FileText
} from 'lucide-react';
import { feeSheetAPI, codesAPI, authAPI, feeSheetCategoriesAPI, patientsAPI, visitsAPI } from '../services/api';
import CodeSearchModal from '../components/CodeSearchModal';
import { useAuth } from '../context/AuthContext';

/**
 * Port of OpenEMR Fee Sheet (Superbill)
 */
const FeeSheet = () => {
    const { id: patientId, visitId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [patient, setPatient] = useState(null);
    const [visit, setVisit] = useState(null);
    const [providers, setProviders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [bill, setBill] = useState([]); // Service lines
    const [prod, setProd] = useState([]); // Product lines
    const [diagnoses, setDiagnoses] = useState([]); // Derived from bill (code_type='ICD10')
    const [renderingProviderId, setRenderingProviderId] = useState('');
    const [priceLevel, setPriceLevel] = useState('Standard');
    const [copay, setCopay] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [checksum, setChecksum] = useState('');

    // UI State
    const [showCPTModal, setShowCPTModal] = useState(false);
    const [showICDModal, setShowICDModal] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
        fetchSupportData();
    }, [visitId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [feeSheetRes, patientRes, visitRes] = await Promise.all([
                feeSheetAPI.get(visitId),
                patientsAPI.get(patientId),
                visitsAPI.get(visitId)
            ]);

            const { bill: billItems, prod: prodItems, checksum: newChecksum } = feeSheetRes.data;
            setBill(billItems.filter(i => i.code_type !== 'ICD10' && i.code_type !== '2'));
            setDiagnoses(billItems.filter(i => i.code_type === 'ICD10' || i.code_type === '2'));
            setProd(prodItems);
            setChecksum(newChecksum);
            setPatient(patientRes.data);
            setVisit(visitRes.data);
            setRenderingProviderId(visitRes.data.provider_id);
            setPriceLevel(patientRes.data.price_level || 'Standard');
        } catch (error) {
            console.error('Error fetching fee sheet data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSupportData = async () => {
        try {
            const [provRes, catRes] = await Promise.all([
                authAPI.getProviders(),
                feeSheetCategoriesAPI.getAll()
            ]);
            setProviders(provRes.data || []);
            setCategories(catRes.data || []);
        } catch (error) {
            console.error('Error fetching support data:', error);
        }
    };

    const handleSave = async (stay = false) => {
        setSaving(true);
        try {
            // Combine diagnoses and service lines back into one "bill" array for the backend
            const fullBill = [
                ...diagnoses.map(d => ({ ...d, code_type: 'ICD10' })),
                ...bill.map(b => ({ ...b }))
            ];

            await feeSheetAPI.save(visitId, {
                patientId,
                bill: fullBill,
                prod,
                providerId: renderingProviderId,
                copay,
                paymentMethod,
                checksum
            });

            if (!stay) {
                navigate(`/patient/${patientId}/snapshot`);
            } else {
                fetchData();
            }
        } catch (error) {
            console.error('Error saving fee sheet:', error);
            const errMsg = error.response?.data?.error || error.message || '';
            if (errMsg.toLowerCase().includes('modified by another user')) {
                alert('Concurrency Error: The fee sheet was modified by another user. The page will refresh.');
                fetchData();
            } else {
                alert('Failed to save Fee Sheet: ' + errMsg);
            }
        } finally {
            setSaving(false);
        }
    };

    const addDiagnosis = (code) => {
        const newDx = {
            code_type: 'ICD10',
            code: code.code,
            code_text: code.description,
            units: 1,
            fee: 0,
            justify: '',
            activity: true
        };
        setDiagnoses([...diagnoses, newDx]);
        setShowICDModal(false);
    };

    const addService = async (code) => {
        const price = await feeSheetAPI.getPrice('CPT', code.code, priceLevel);
        const newService = {
            code_type: 'CPT',
            code: code.code,
            code_text: code.description,
            units: 1,
            modifier: '',
            fee: price.data.price || 0,
            justify: '', // Diagnosis pointers
            activity: true
        };
        setBill([...bill, newService]);
        setShowCPTModal(false);
    };

    const updateBillItem = (index, updates) => {
        const newBill = [...bill];
        newBill[index] = { ...newBill[index], ...updates };
        setBill(newBill);
    };

    const removeBillItem = (index) => {
        const item = bill[index];
        if (item.id) {
            // Mark for deletion if it exists on server
            updateBillItem(index, { del: true });
        } else {
            // Remove from local state if new
            setBill(bill.filter((_, i) => i !== index));
        }
    };

    const removeDiagnosis = (index) => {
        const item = diagnoses[index];
        if (item.id) {
            const newDx = [...diagnoses];
            newDx[index] = { ...newDx[index], del: true };
            setDiagnoses(newDx);
        } else {
            setDiagnoses(diagnoses.filter((_, i) => i !== index));
        }
    };

    const toggleJustify = (billIndex, dxIndex) => {
        const item = bill[billIndex];
        let currentPointers = item.justify ? item.justify.split(':').filter(p => p !== '') : [];
        const dxNum = (dxIndex + 1).toString();

        if (currentPointers.includes(dxNum)) {
            currentPointers = currentPointers.filter(p => p !== dxNum);
        } else {
            currentPointers.push(dxNum);
            currentPointers.sort();
        }

        updateBillItem(billIndex, { justify: currentPointers.join(':') + (currentPointers.length > 0 ? ':' : '') });
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Fee Sheet...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Fee Sheet</h1>
                    <p className="text-slate-500">
                        {patient?.first_name} {patient?.last_name} ({patient?.dob})
                        <span className="mx-2">•</span>
                        Encounter: {visit?.encounter_date || visit?.visit_date}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSave(true)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-all"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md transition-all font-medium"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Save & Exit
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Diagnoses (ICD10) */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-500" />
                                Diagnoses
                            </h2>
                            <button
                                onClick={() => setShowICDModal(true)}
                                className="p-1 px-3 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add
                            </button>
                        </div>

                        <div className="space-y-2">
                            {diagnoses.filter(d => !d.del).map((dx, idx) => (
                                <div key={idx} className="group relative p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 mr-2">#{idx + 1}</span>
                                            <span className="font-mono font-bold text-blue-700">{dx.code}</span>
                                            <span className="block text-sm text-slate-600 mt-1">{dx.code_text}</span>
                                        </div>
                                        <button
                                            onClick={() => removeDiagnosis(idx)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {diagnoses.filter(d => !d.del).length === 0 && (
                                <div className="text-center py-6 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-lg">
                                    No diagnoses selected
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Select Categories */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            Quick Select
                        </h2>
                        <div className="space-y-3">
                            {categories.map(cat => (
                                <div key={cat.id} className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.name}</label>
                                    <select
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        onChange={(e) => {
                                            const codeStr = e.target.value;
                                            if (!codeStr) return;
                                            const parts = codeStr.split('|');
                                            addService({ code: parts[0], description: parts[1] });
                                            e.target.value = '';
                                        }}
                                    >
                                        <option value="">Select Code...</option>
                                        {cat.codes?.map(c => (
                                            <option key={c.code} value={`${c.code}|${c.description}`}>
                                                {c.code} - {c.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Services (CPT/HCPCS) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-amber-500" />
                                Services & Procedures
                            </h2>
                            <button
                                onClick={() => setShowCPTModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Add Service
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Code</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 w-20">Mods</th>
                                        <th className="px-4 py-3 w-16">Qty</th>
                                        <th className="px-4 py-3">Fee</th>
                                        <th className="px-4 py-3">Diagnosis Pointers</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bill.map((item, idx) => !item.del && (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <span className="font-mono font-bold text-slate-700">{item.code}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-slate-600 line-clamp-2 max-w-xs">{item.code_text}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex gap-1 justify-center">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <input
                                                            key={num}
                                                            type="text"
                                                            maxLength="2"
                                                            className="w-7 p-1 text-[10px] border border-slate-200 rounded uppercase text-center"
                                                            placeholder={`M${num}`}
                                                            value={item[`modifier${num}`] || ''}
                                                            onChange={(e) => updateBillItem(idx, { [`modifier${num}`]: e.target.value })}
                                                        />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    className="w-12 p-1 text-xs border border-slate-200 rounded text-center"
                                                    value={item.units}
                                                    onChange={(e) => updateBillItem(idx, { units: e.target.value })}
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                                    $<input
                                                        type="number"
                                                        className="w-20 p-1 border border-slate-200 rounded"
                                                        value={item.fee}
                                                        onChange={(e) => updateBillItem(idx, { fee: e.target.value })}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex gap-1 flex-wrap">
                                                    {diagnoses.filter(d => !d.del).map((dx, dxIdx) => {
                                                        const dxNum = (dxIdx + 1).toString();
                                                        const isSelected = item.justify?.split(':').includes(dxNum);
                                                        return (
                                                            <button
                                                                key={dxIdx}
                                                                onClick={() => toggleJustify(idx, dxIdx)}
                                                                title={dx.code_text}
                                                                className={`w-6 h-6 flex items-center justify-center text-[10px] rounded-full border transition-all ${isSelected
                                                                    ? 'bg-blue-600 border-blue-600 text-white font-bold ring-2 ring-blue-100'
                                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300'
                                                                    }`}
                                                            >
                                                                {dxNum}
                                                            </button>
                                                        );
                                                    })}
                                                    {diagnoses.filter(d => !d.del).length === 0 && (
                                                        <span className="text-xs text-slate-400 italic">No Dx available</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => removeBillItem(idx)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {bill.filter(item => !item.del).length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-12 text-center text-slate-400 italic">
                                                No services added yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Products & Drug Sales */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Pill className="w-5 h-5 text-emerald-500" />
                                Products & Medications
                            </h2>
                            <button
                                onClick={() => {
                                    // Placeholder for product selection modall
                                    const drugId = prompt("Enter Drug UUID (demo):");
                                    if (drugId) {
                                        setProd([...prod, { drug_id: drugId, drug_name: 'Selected Drug', units: 1, fee: 0, notes: '', activity: true }]);
                                    }
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Add Product
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3 w-16">Qty</th>
                                        <th className="px-4 py-3">Fee</th>
                                        <th className="px-4 py-3">Notes</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {prod.map((item, idx) => !item.del && (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-4 text-sm font-medium text-slate-700">{item.drug_name || item.drug_id}</td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    className="w-12 p-1 text-xs border border-slate-200 rounded text-center"
                                                    value={item.units}
                                                    onChange={(e) => {
                                                        const newProd = [...prod];
                                                        newProd[idx].units = e.target.value;
                                                        setProd(newProd);
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                                    $<input
                                                        type="number"
                                                        className="w-20 p-1 border border-slate-200 rounded"
                                                        value={item.fee}
                                                        onChange={(e) => {
                                                            const newProd = [...prod];
                                                            newProd[idx].fee = e.target.value;
                                                            setProd(newProd);
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="text"
                                                    className="w-full p-1 text-xs border border-slate-200 rounded"
                                                    value={item.notes}
                                                    onChange={(e) => {
                                                        const newProd = [...prod];
                                                        newProd[idx].notes = e.target.value;
                                                        setProd(newProd);
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => {
                                                        if (item.id) {
                                                            const newProd = [...prod];
                                                            newProd[idx].del = true;
                                                            setProd(newProd);
                                                        } else {
                                                            setProd(prod.filter((_, i) => i !== idx));
                                                        }
                                                    }}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {prod.filter(i => !i.del).length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic text-sm">No products added</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Rendering Provider, Price Level & Copay */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">Rendering Provider</label>
                            <select
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                value={renderingProviderId}
                                onChange={(e) => setRenderingProviderId(e.target.value)}
                            >
                                {providers.map(p => (
                                    <option key={p.id} value={p.id}>{p.prefix} {p.first_name} {p.last_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">Price Level</label>
                            <select
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                value={priceLevel}
                                onChange={(e) => setPriceLevel(e.target.value)}
                            >
                                <option value="Standard">Standard</option>
                                <option value="Level 1">Level 1</option>
                                <option value="Level 2">Level 2</option>
                                <option value="Level 3">Level 3</option>
                                <option value="Level 4">Level 4 (Wholesale)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">Copay Received</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                        placeholder="0.00"
                                        value={copay}
                                        onChange={(e) => setCopay(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="w-24 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Check">Check</option>
                                    <option value="Card">Card</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <CodeSearchModal
                isOpen={showICDModal}
                onClose={() => setShowICDModal(false)}
                onSelect={addDiagnosis}
                type="ICD10"
            />
            <CodeSearchModal
                isOpen={showCPTModal}
                onClose={() => setShowCPTModal(false)}
                onSelect={addService}
                type="CPT"
            />

            {/* Total Footer */}
            <div className="sticky bottom-6 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex justify-between items-center">
                <div className="flex gap-8">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Total Charges</div>
                        <div className="text-2xl font-bold">
                            ${bill.filter(i => !i.del).reduce((acc, curr) => acc + (parseFloat(curr.fee) * (parseInt(curr.units) || 1)), 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="border-l border-slate-700 h-10 my-auto"></div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Line Items</div>
                        <div className="text-2xl font-bold">{bill.filter(i => !i.del).length}</div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg active:transform active:scale-95 flex items-center gap-2"
                    >
                        {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Finalize Fee Sheet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeeSheet;
