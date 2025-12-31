import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { billingService } from '../services/billingOpenEMR';
import { format } from 'date-fns';
import { showError } from '../utils/toast';

const BillingReports = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('aging');
    const [loading, setLoading] = useState(false);

    // Aging Data
    const [agingData, setAgingData] = useState([]);

    // Collections Data
    const [collectionsData, setCollectionsData] = useState([]);
    const [collectionFilters, setCollectionFilters] = useState({
        from: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        if (location.pathname.includes('collections')) {
            setActiveTab('collections');
        } else {
            setActiveTab('aging');
        }
    }, [location]);

    useEffect(() => {
        if (activeTab === 'aging') loadAging();
        else loadCollections();
    }, [activeTab]);

    const loadAging = async () => {
        setLoading(true);
        try {
            const data = await billingService.getARAging();
            setAgingData(data);
        } catch (e) { showError(e.message); }
        finally { setLoading(false); }
    };

    const loadCollections = async () => {
        setLoading(true);
        try {
            const data = await billingService.getCollectionsReport(collectionFilters);
            setCollectionsData(data);
        } catch (e) { showError(e.message); }
        finally { setLoading(false); }
    };

    const exportCSV = (data, filename) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Billing Reports</h1>

            <div className="flex space-x-4 mb-6 border-b">
                <button
                    className={`px-4 py-2 font-medium ${activeTab === 'aging' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('aging')}
                >
                    AR Aging
                </button>
                <button
                    className={`px-4 py-2 font-medium ${activeTab === 'collections' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('collections')}
                >
                    Collections
                </button>
            </div>

            {activeTab === 'aging' && (
                <div className="bg-white p-4 rounded shadow">
                    <div className="flex justify-between mb-4">
                        <h2 className="font-semibold">Accounts Receivable Aging</h2>
                        <button onClick={() => exportCSV(agingData, 'ar_aging.csv')} className="text-blue-600 hover:underline">Export CSV</button>
                    </div>
                    {loading ? <div>Loading...</div> : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Patient</th>
                                    <th className="p-2 text-left">MRN</th>
                                    <th className="p-2 text-left">Visit</th>
                                    <th className="p-2 text-left">Bucket</th>
                                    <th className="p-2 text-right">Balance</th>
                                    <th className="p-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agingData.map((row, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{row.first_name} {row.last_name}</td>
                                        <td className="p-2">{row.mrn}</td>
                                        <td className="p-2">{format(new Date(row.visit_date), 'MM/dd/yyyy')}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-1 rounded text-xs text-white ${row.bucket === '0-30' ? 'bg-green-500' :
                                                    row.bucket === '31-60' ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}>
                                                {row.bucket}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right font-mono">${parseFloat(row.balance).toFixed(2)}</td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm('Send to Collections?')) return;
                                                    try {
                                                        await billingService.sendToCollections(row.encounter_id, 'DefaultAgency');
                                                        showError('Sent to collections'); // Using showError as generic toast/alert wrapper if showSuccess unavailable
                                                        loadAging();
                                                    } catch (e) { showError(e.message); }
                                                }}
                                                className="text-red-600 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 lowercase"
                                            >
                                                collect
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'collections' && (
                <div className="bg-white p-4 rounded shadow">
                    <div className="flex justify-between mb-4 items-end">
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500">From</label>
                                <input type="date" value={collectionFilters.from} onChange={e => setCollectionFilters({ ...collectionFilters, from: e.target.value })} className="border rounded p-1" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500">To</label>
                                <input type="date" value={collectionFilters.to} onChange={e => setCollectionFilters({ ...collectionFilters, to: e.target.value })} className="border rounded p-1" />
                            </div>
                            <button onClick={loadCollections} className="bg-gray-100 px-3 py-1 rounded border">Filter</button>
                        </div>
                        <button onClick={() => exportCSV(collectionsData, 'collections.csv')} className="text-blue-600 hover:underline">Export CSV</button>
                    </div>

                    {loading ? <div>Loading...</div> : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-left">Payer</th>
                                    <th className="p-2 text-left">Method</th>
                                    <th className="p-2 text-left">Ref</th>
                                    <th className="p-2 text-right">Amount</th>
                                    <th className="p-2 text-left">User</th>
                                </tr>
                            </thead>
                            <tbody>
                                {collectionsData.map((row, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{format(new Date(row.check_date), 'MM/dd/yyyy')}</td>
                                        <td className="p-2">{row.payment_type}</td>
                                        <td className="p-2">{row.payment_method}</td>
                                        <td className="p-2">{row.reference}</td>
                                        <td className="p-2 text-right font-mono">${parseFloat(row.pay_total).toFixed(2)}</td>
                                        <td className="p-2">{row.user_first} {row.user_last}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default BillingReports;
