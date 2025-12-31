import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { billingService } from '../services/billingOpenEMR';
import { showError, showSuccess } from '../utils/toast';

const BillingManager = () => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        billed: '0', // 0=Unbilled, 1=Billed, all=All
    });
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [selectedEncounters, setSelectedEncounters] = useState(new Set());
    const [generating, setGenerating] = useState(false);

    // Initial Load
    useEffect(() => {
        handleSearch();
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const data = await billingService.getReports(filters);
            setItems(data);
            setSelectedEncounters(new Set()); // Reset selection
        } catch (e) {
            showError("Failed to fetch billing data");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateClaims = async () => {
        if (selectedEncounters.size === 0) return;
        setGenerating(true);
        try {
            const encounterIds = Array.from(selectedEncounters);
            const batchId = crypto.randomUUID(); // Idempotency
            const results = await billingService.generateClaims(encounterIds, 1, batchId); // PartnerID=1 hardcoded for now
            showSuccess(`Generated ${results.length} claims`);
            handleSearch(); // Refresh
        } catch (e) {
            showError("Failed to generate claims: " + e.message);
        } finally {
            setGenerating(false);
        }
    };

    const toggleSelection = (encounterId) => {
        const newSet = new Set(selectedEncounters);
        if (newSet.has(encounterId)) newSet.delete(encounterId);
        else newSet.add(encounterId);
        setSelectedEncounters(newSet);
    };

    const toggleAll = (visibleEncounters) => {
        if (selectedEncounters.size === visibleEncounters.length) {
            setSelectedEncounters(new Set());
        } else {
            setSelectedEncounters(new Set(visibleEncounters.map(e => e.encounter)));
        }
    };

    // Group items by Encounter
    const groupedEncounters = React.useMemo(() => {
        const groups = {};
        items.forEach(item => {
            if (!groups[item.encounter]) {
                groups[item.encounter] = {
                    id: item.encounter,
                    date: item.visit_date,
                    patientName: `${item.first_name} ${item.last_name}`,
                    mrn: item.mrn,
                    codes: [],
                    totalFee: 0,
                    billed: item.billed
                };
            }
            groups[item.encounter].codes.push(item.code);
            groups[item.encounter].totalFee += parseFloat(item.fee || 0);
        });
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [items]);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Billing Manager</h1>
                <div className="space-x-2">
                    <button
                        onClick={handleGenerateClaims}
                        disabled={generating || selectedEncounters.size === 0}
                        className={`px-4 py-2 rounded text-white font-medium ${selectedEncounters.size > 0 ? 'bg-primary hover:bg-primary/90' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                        {generating ? 'Processing...' : 'Generate Claims'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded shadow mb-6 flex gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                        className="border rounded px-3 py-2 w-40"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                        className="border rounded px-3 py-2 w-40"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                        value={filters.billed}
                        onChange={e => setFilters({ ...filters, billed: e.target.value })}
                        className="border rounded px-3 py-2 w-40"
                    >
                        <option value="0">Unbilled</option>
                        <option value="1">Billed</option>
                        <option value="all">All</option>
                    </select>
                </div>
                <button
                    onClick={handleSearch}
                    className="bg-gray-100 hover:bg-gray-200 border px-4 py-2 rounded font-medium text-gray-700"
                >
                    Search
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <input
                                    type="checkbox"
                                    onChange={() => toggleAll(groupedEncounters)}
                                    checked={groupedEncounters.length > 0 && selectedEncounters.size === groupedEncounters.length}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codes</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8">Loading...</td></tr>
                        ) : groupedEncounters.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500">No encounters found.</td></tr>
                        ) : groupedEncounters.map(enc => (
                            <tr key={enc.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={selectedEncounters.has(enc.id)}
                                        onChange={() => toggleSelection(enc.id)}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {enc.date ? format(new Date(enc.date), 'MM/dd/yyyy') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="font-medium">{enc.patientName}</div>
                                    <div className="text-gray-500 text-xs">{enc.mrn}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {enc.codes.join(', ')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${enc.totalFee.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enc.billed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {enc.billed ? 'Billed' : 'Unbilled'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BillingManager;
