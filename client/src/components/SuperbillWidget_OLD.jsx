import React, { useState, useEffect } from 'react';
import { FileText, DollarSign, Plus, X, Printer } from 'lucide-react';
import { codesAPI, ordersAPI, documentsAPI } from '../services/api';

const Superbill = ({ visitId, patientId, visitDate, providerName, diagnoses, onPrint }) => {
    const [cptCodes, setCptCodes] = useState([]);
    const [selectedCpt, setSelectedCpt] = useState('');
    const [cptSearch, setCptSearch] = useState('');
    const [cptResults, setCptResults] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visitId && patientId) {
            fetchOrders();
        }
    }, [visitId, patientId]);

    useEffect(() => {
        if (cptSearch.length >= 2) {
            const timeoutId = setTimeout(() => {
                searchCPTCodes();
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setCptResults([]);
        }
    }, [cptSearch]);

    const fetchOrders = async () => {
        try {
            const response = await ordersAPI.getByPatient(patientId);
            const visitOrders = response.data.filter(o => o.visit_id === visitId);
            setOrders(visitOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const searchCPTCodes = async () => {
        try {
            const response = await codesAPI.searchCPT(cptSearch);
            setCptResults(response.data || []);
        } catch (error) {
            console.error('Error searching CPT codes:', error);
        }
    };

    const addCPTCode = (cpt) => {
        if (!cptCodes.find(c => c.code === cpt.code)) {
            setCptCodes([...cptCodes, { ...cpt, fee: cpt.fee || 0 }]);
            setCptSearch('');
            setCptResults([]);
        }
    };

    const removeCPTCode = (code) => {
        setCptCodes(cptCodes.filter(c => c.code !== code));
    };

    const updateFee = (code, fee) => {
        setCptCodes(cptCodes.map(c => c.code === code ? { ...c, fee: parseFloat(fee) || 0 } : c));
    };

    const totalFee = cptCodes.reduce((sum, c) => sum + (c.fee || 0), 0);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-paper-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-paper-700" />
                    <h3 className="text-lg font-serif font-bold text-ink-900">Superbill</h3>
                </div>
                {onPrint && (
                    <button
                        onClick={() => onPrint({ cptCodes, orders, diagnoses, visitDate, providerName })}
                        className="flex items-center space-x-2 px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print</span>
                    </button>
                )}
            </div>

            {/* Diagnoses Section */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-ink-700 mb-2">Diagnoses (ICD-10)</label>
                <div className="bg-paper-50 p-3 rounded border border-paper-200">
                    {diagnoses && diagnoses.length > 0 ? (
                        <div className="space-y-1">
                            {diagnoses.split('\n').filter(d => d.trim()).map((diag, idx) => (
                                <div key={idx} className="text-sm text-ink-900">{diag.trim()}</div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-ink-500 italic">No diagnoses entered</p>
                    )}
                </div>
            </div>

            {/* CPT Codes Section */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-ink-700 mb-2">CPT Codes & Procedures</label>
                
                {/* Add CPT Code */}
                <div className="mb-3 relative">
                    <input
                        type="text"
                        placeholder="Search CPT codes (e.g., 99213, office visit)..."
                        value={cptSearch}
                        onChange={(e) => setCptSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                    />
                    {cptResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-paper-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {cptResults.map((cpt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => addCPTCode(cpt)}
                                    className="w-full text-left px-3 py-2 hover:bg-paper-50 border-b border-paper-100 last:border-b-0"
                                >
                                    <div className="font-medium text-ink-900">{cpt.code}</div>
                                    <div className="text-xs text-ink-600">{cpt.description}</div>
                                    {cpt.fee && <div className="text-xs text-paper-700">${cpt.fee.toFixed(2)}</div>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* CPT Codes List */}
                {cptCodes.length > 0 ? (
                    <div className="space-y-2">
                        {cptCodes.map((cpt, idx) => (
                            <div key={idx} className="flex items-center space-x-3 p-3 bg-paper-50 rounded border border-paper-200">
                                <div className="flex-1">
                                    <div className="font-medium text-ink-900">{cpt.code}</div>
                                    <div className="text-sm text-ink-600">{cpt.description}</div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-ink-600">$</span>
                                    <input
                                        type="number"
                                        value={cpt.fee || 0}
                                        onChange={(e) => updateFee(cpt.code, e.target.value)}
                                        step="0.01"
                                        min="0"
                                        className="w-20 px-2 py-1 border border-paper-300 rounded text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => removeCPTCode(cpt.code)}
                                    className="p-1 hover:bg-red-100 rounded text-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-ink-500 italic">No CPT codes added</p>
                )}
            </div>

            {/* Orders Summary */}
            {orders.length > 0 && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-ink-700 mb-2">Orders</label>
                    <div className="bg-paper-50 p-3 rounded border border-paper-200">
                        <div className="space-y-2">
                            {orders.map((order, idx) => (
                                <div key={idx} className="text-sm">
                                    <span className="font-medium text-ink-900 capitalize">{order.order_type}:</span>
                                    <span className="text-ink-700 ml-2">
                                        {order.order_payload?.test_name || order.order_payload?.study_name || order.order_payload?.testName || 'Order'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Total */}
            {cptCodes.length > 0 && (
                <div className="pt-4 border-t border-paper-200">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-ink-900">Total Fee:</span>
                        <span className="text-lg font-bold text-paper-700">${totalFee.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Superbill;












