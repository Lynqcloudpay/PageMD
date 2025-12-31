import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { billingService } from '../services/billingOpenEMR';
import { format } from 'date-fns';
import { showError } from '../utils/toast';

const ClaimViewer = () => {
    const { id } = useParams();
    const [claim, setClaim] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClaim();
    }, [id]);

    const loadClaim = async () => {
        setLoading(true);
        try {
            const data = await billingService.getClaim(id);
            setClaim(data);
        } catch (e) {
            showError("Failed to load claim");
        } finally {
            setLoading(false);
        }
    };

    const downloadX12 = () => {
        if (!claim || !claim.submitted_claim) return;
        const blob = new Blob([claim.submitted_claim], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = claim.process_file || `claim_${id}.x12`;
        a.click();
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Claim...</div>;
    if (!claim) return <div className="p-8 text-center text-red-500">Claim not found</div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Claim #{claim.id.substring(0, 8)}</h1>
                        <div className="text-gray-500 text-sm">Created: {format(new Date(claim.created_at), 'MMM dd, yyyy HH:mm')}</div>
                    </div>
                    <div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold 
                            ${claim.status === 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {claim.status === 1 ? 'Billed' : 'Unknown'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Patient</h3>
                        <div className="font-medium text-lg">{claim.first_name} {claim.last_name}</div>
                        <div className="text-gray-600">MRN: {claim.mrn}</div>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Visit</h3>
                        <div className="font-medium text-lg">{format(new Date(claim.visit_date), 'MMMM dd, yyyy')}</div>
                        <div className="text-gray-600">Encounter ID: {claim.encounter_id}</div>
                    </div>
                </div>

                {/* Line Items */}
                <h3 className="text-lg font-bold text-gray-800 mb-4">Services Billed</h3>
                <div className="border rounded overflow-hidden mb-8">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {claim.lines && claim.lines.map((line, idx) => (
                                <tr key={idx}>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{line.code}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{line.units}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">${line.fee}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">${(line.fee * line.units).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* X12 Content */}
                <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">EDI Content (X12)</h3>
                    <button
                        onClick={downloadX12}
                        className="text-primary hover:text-primary-dark font-medium text-sm border border-primary px-3 py-1 rounded"
                    >
                        Download .x12
                    </button>
                </div>
                <div className="bg-gray-800 text-green-400 p-4 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {claim.submitted_claim}
                </div>
            </div>
        </div>
    );
};

export default ClaimViewer;
