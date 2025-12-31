import React, { useState } from 'react';
import { billingService } from '../services/billingOpenEMR';
import { format } from 'date-fns';
import { showError } from '../utils/toast';

const PatientStatements = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [filters, setFilters] = useState({
        from: format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
    });
    const [statement, setStatement] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (val.length > 2) {
            try {
                const res = await billingService.searchPatients(val);
                setPatients(res);
            } catch (err) { showError("Search failed"); }
        } else {
            setPatients([]);
        }
    };

    const selectPatient = (p) => {
        setSelectedPatient(p);
        setPatients([]);
        setSearchTerm('');
        setStatement(null);
    };

    const generateStatement = async () => {
        if (!selectedPatient) return;
        setLoading(true);
        try {
            const data = await billingService.getPatientStatement(selectedPatient.id, filters.from, filters.to);
            setStatement(data);
        } catch (e) {
            showError("Failed to generate statement: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const printStatement = () => {
        window.print();
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen print:bg-white print:p-0">
            {/* Controls - Hide on Print */}
            <div className="print:hidden mb-8">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Patient Statements</h1>

                <div className="bg-white p-6 rounded shadow space-y-4">
                    {/* Patient Search */}
                    {!selectedPatient ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                placeholder="Name or MRN..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                            {patients.length > 0 && (
                                <ul className="mt-2 border rounded bg-white shadow max-h-40 overflow-auto">
                                    {patients.map(p => (
                                        <li
                                            key={p.id}
                                            onClick={() => selectPatient(p)}
                                            className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                                        >
                                            <div className="font-bold">{p.last_name}, {p.first_name}</div>
                                            <div className="text-xs text-gray-500">MRN: {p.mrn} | DOB: {p.dob ? format(new Date(p.dob), 'MM/dd/yyyy') : 'N/A'}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-between items-center bg-blue-50 p-4 rounded border border-blue-200">
                            <div>
                                <span className="font-bold text-lg">{selectedPatient.first_name} {selectedPatient.last_name}</span>
                                <span className="text-gray-600 ml-2">({selectedPatient.mrn})</span>
                            </div>
                            <button onClick={() => setSelectedPatient(null)} className="text-sm text-red-600 hover:text-red-800">Change Patient</button>
                        </div>
                    )}

                    {/* Date Range & Action */}
                    <div className="flex gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                            <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                            <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} className="border rounded px-3 py-2" />
                        </div>
                        <button
                            onClick={generateStatement}
                            disabled={!selectedPatient || loading}
                            className={`px-4 py-2 rounded font-medium text-white ${!selectedPatient ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'}`}
                        >
                            {loading ? 'Generating...' : 'Generate Statement'}
                        </button>
                        {statement && (
                            <button onClick={printStatement} className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">
                                Print / PDF
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Statement Preview */}
            {statement && (
                <div className="bg-white p-8 shadow-lg max-w-4xl mx-auto print:shadow-none print:max-w-none">
                    {/* Header */}
                    <div className="border-b pb-4 mb-6 flex justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">PageMD Medical Group</h2>
                            <p className="text-gray-600">1 Health Way</p>
                            <p className="text-gray-600">Metropolis, NY 10001</p>
                            <p className="text-gray-600">Phone: 800-555-CARE</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xl font-bold uppercase text-gray-500">Statement</h3>
                            <p className="font-mono mt-2">Date: {format(new Date(statement.statementDate), 'MM/dd/yyyy')}</p>
                            <p className="font-mono">Account #: {statement.patient.mrn}</p>
                        </div>
                    </div>

                    {/* Patient Info */}
                    <div className="mb-8">
                        <h4 className="font-bold border-b mb-2">To:</h4>
                        <p>{statement.patient.first_name} {statement.patient.last_name}</p>
                        <p>{statement.patient.address_line_1 || 'No Address'}</p>
                        <p>{statement.patient.city}, {statement.patient.state} {statement.patient.postal_code}</p>
                    </div>

                    {/* Encounters */}
                    <div className="space-y-6">
                        {statement.encounters.length === 0 ? (
                            <div className="text-center text-gray-500 py-4">No activity in this period.</div>
                        ) : statement.encounters.map((enc, i) => (
                            <div key={i} className="mb-6">
                                <div className="bg-gray-100 p-2 font-bold flex justify-between">
                                    <span>Date of Service: {format(new Date(enc.visit_date), 'MM/dd/yyyy')}</span>
                                    <span>Visit ID: {enc.id.substring(0, 8)}</span>
                                </div>
                                <table className="w-full text-sm mt-2">
                                    <thead>
                                        <tr className="border-b text-gray-500">
                                            <th className="text-left py-1">Description</th>
                                            <th className="text-right py-1">Charges</th>
                                            <th className="text-right py-1">Payments/Adj</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Charges */}
                                        {enc.ledger.lines.map((line, l) => (
                                            <tr key={'c' + l}>
                                                <td className="py-1 pl-4">{line.code} - {line.code_text || 'Service'}</td>
                                                <td className="py-1 text-right">${parseFloat(line.total).toFixed(2)}</td>
                                                <td className="py-1 text-right"></td>
                                            </tr>
                                        ))}
                                        {/* Payments */}
                                        {enc.ledger.payments.map((pay, p) => (
                                            <tr key={'p' + p} className="text-gray-600 italic">
                                                <td className="py-1 pl-4">Payment - {pay.payment_method} ({format(new Date(pay.post_time), 'MM/dd/yy')})</td>
                                                <td className="py-1 text-right"></td>
                                                <td className="py-1 text-right">-${parseFloat(pay.pay_amount + pay.adj_amount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {/* Subtotal */}
                                        <tr className="border-t font-bold bg-gray-50">
                                            <td className="py-1 pl-4">Patient Balance</td>
                                            <td className="py-1 text-right" colSpan="2">${parseFloat(enc.ledger.summary.balance).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-12 border-t-2 pt-4 flex justify-end">
                        <div className="text-xl font-bold">
                            Total Due: <span className="text-primary">${statement.totalDue.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="mt-12 text-center text-sm text-gray-500 border-t pt-4">
                        Please make checks payable to PageMD Medical Group.
                        Pay online at pagemd.health/pay using your Account #.
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientStatements;
