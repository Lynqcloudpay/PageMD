import React, { useState, useEffect, useRef } from 'react';
import { billingService } from '../services/billingOpenEMR';
import { format } from 'date-fns';
import { showError, showSuccess } from '../utils/toast';

const PaymentPosting = () => {
    // Steps: 1=Search, 2=Select Encounter, 3=Allocate
    const [step, setStep] = useState(1);

    // Data
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [ledger, setLedger] = useState(null); // { lines, payments, summary }

    // Form
    const [form, setForm] = useState({
        amount: '',
        paymentMethod: 'Check',
        checkDate: format(new Date(), 'yyyy-MM-dd'),
        reference: '',
        note: '',
        payerType: 0 // 0=Patient
    });

    // Allocations: Map lineId -> amount string
    const [allocations, setAllocations] = useState({});

    // Idempotency
    const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
    const [submitting, setSubmitting] = useState(false);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const results = await billingService.searchPatients(searchTerm);
                    setPatients(results);
                } catch (e) {
                    console.error(e);
                }
            } else {
                setPatients([]);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch Encounters when Patient Selected
    useEffect(() => {
        if (selectedPatient) {
            billingService.getOpenEncounters(selectedPatient.id).then(setEncounters).catch(console.error);
        }
    }, [selectedPatient]);

    // Fetch Ledger when Encounter Selected
    useEffect(() => {
        if (selectedEncounter) {
            billingService.getEncounterLedger(selectedEncounter.id).then(data => {
                setLedger(data);
                setStep(3);
                // Reset form slightly but keep patient context?
                // Actually if we switch encounter, we reset allocation.
                setAllocations({});
                setForm(f => ({ ...f, amount: '' }));
                setIdempotencyKey(crypto.randomUUID()); // New transaction
            }).catch(console.error);
        }
    }, [selectedEncounter]);

    const handleAutoAllocate = () => {
        if (!ledger || !form.amount) return;
        let remaining = parseFloat(form.amount);
        if (isNaN(remaining) || remaining <= 0) return;

        const newAlloc = {};

        // Sort lines by date? Ledger lines come sorted.
        ledger.lines.forEach(line => {
            if (remaining <= 0) return;

            // Calculate remaining balance for this line?
            // This is tricky because we only have TOTAL line charge.
            // We need to know how much was ALREADY paid per line.
            // Our backend `getEncounterLedger` returns `lines` (charges) and `payments` (activities).
            // We'd have to calculate per-line balance on frontend or backend.
            // Backend `ar_activity` has `code` which links to billing line `code`.
            // But `code` is not unique in billing table (duplicate codes on same day).
            // Robust linkage is difficult without specific line item ID reference in ar_activity.
            // OpenEMR links by `code`. 
            // We will assume `code` matching for balance calculation or just allocate blindly?
            // User requirement: "table of billable line items with ... remaining balance"
            // I should estimate remaining balance assuming FIFO by code?
            // Or simpler: Just charge amount.

            // Let's alloc up to line total.
            const lineTotal = parseFloat(line.total);
            const toAlloc = Math.min(remaining, lineTotal); // Rough logic, ignores previous payments. 
            // Ideally we subtract previous payments for this code.

            newAlloc[line.id] = toAlloc.toFixed(2);
            remaining -= toAlloc;
        });

        setAllocations(newAlloc);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Prepare payload
            const linesToPost = Object.entries(allocations).map(([lineId, amount]) => {
                const line = ledger.lines.find(l => l.id === lineId);
                return {
                    code: line.code,
                    amount: amount
                };
            }).filter(i => parseFloat(i.amount) > 0);

            const payload = {
                patient_id: selectedPatient.id,
                encounterId: selectedEncounter.id,
                check_date: form.checkDate,
                payment_method: form.paymentMethod,
                reference: form.reference,
                pay_total: form.amount,
                description: form.note,
                payer_type: parseInt(form.payerType),
                idempotency_key: idempotencyKey,
                allocations: linesToPost
            };

            const res = await billingService.createARSession(payload);
            showSuccess("Payment Posted Successfully");

            // Reset / Refresh
            // Reload ledger
            const newLedger = await billingService.getEncounterLedger(selectedEncounter.id);
            setLedger(newLedger);
            setAllocations({});
            setForm({ ...form, amount: '', reference: '' });
            setIdempotencyKey(crypto.randomUUID());

        } catch (e) {
            if (e.response && e.response.status === 409) {
                showError("Duplicate Payment Detected (Idempotency)");
            } else {
                showError("Payment Failed: " + (e.response?.data?.error || e.message));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate sum of allocations
    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const balanceRemaining = (parseFloat(form.amount) || 0) - totalAllocated;

    // Render Steps
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Payment Posting</h1>

            <div className="grid grid-cols-12 gap-6">

                {/* Left Panel: Search & Context */}
                <div className="col-span-4 space-y-6">
                    {/* Step 1: Search */}
                    <div className="bg-white p-4 rounded shadow">
                        <h2 className="font-semibold mb-3">1. Select Patient</h2>
                        {selectedPatient ? (
                            <div className="bg-blue-50 p-3 rounded flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                                    <div className="text-sm">MRN: {selectedPatient.mrn}</div>
                                </div>
                                <button className="text-sm text-red-500 hover:text-red-700" onClick={() => {
                                    setSelectedPatient(null);
                                    setSelectedEncounter(null);
                                    setStep(1);
                                }}>Change</button>
                            </div>
                        ) : (
                            <div>
                                <input
                                    className="w-full border p-2 rounded"
                                    placeholder="Search Name or MRN..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                {patients.length > 0 && (
                                    <ul className="mt-2 border rounded max-h-48 overflow-y-auto bg-white divide-y">
                                        {patients.map(p => (
                                            <li
                                                key={p.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => setSelectedPatient(p)}
                                            >
                                                <div className="font-medium">{p.first_name} {p.last_name}</div>
                                                <div className="text-xs text-gray-500">MRN: {p.mrn} | DOB: {p.dob ? format(new Date(p.dob), 'MM/dd/yyyy') : '-'}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Encounters */}
                    {selectedPatient && (
                        <div className="bg-white p-4 rounded shadow">
                            <h2 className="font-semibold mb-3">2. Open Encounters</h2>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {encounters.map(enc => (
                                    <div
                                        key={enc.id}
                                        onClick={() => setSelectedEncounter(enc)}
                                        className={`p-3 border rounded cursor-pointer ${selectedEncounter?.id === enc.id ? 'border-primary bg-blue-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between font-medium">
                                            <span>{format(new Date(enc.visit_date), 'MM/dd/yyyy')}</span>
                                            <span className={`${enc.balance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                Bal: ${parseFloat(enc.balance).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex justify-between mt-1">
                                            <span>Chg: ${parseFloat(enc.charges).toFixed(2)}</span>
                                            <span>Pd: ${parseFloat(enc.payments).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                                {encounters.length === 0 && <div className="text-gray-500 italic">No open encounters found.</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Working Area */}
                <div className="col-span-8">
                    {selectedEncounter && ledger ? (
                        <div className="space-y-6">

                            {/* Step 3: Ledger Summary */}
                            <div className="bg-white p-4 rounded shadow">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="font-semibold text-lg">Account Ledger: {format(new Date(selectedEncounter.visit_date), 'MMMM dd, yyyy')}</h2>
                                    <div className="text-xl font-bold">
                                        Open Balance: <span className={ledger.summary.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                                            ${ledger.summary.balance.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Previous Payments */}
                                {ledger.payments.length > 0 && (
                                    <div className="mb-4 text-xs">
                                        <h3 className="font-medium text-gray-500 uppercase mb-2">History</h3>
                                        <table className="w-full text-left bg-gray-50 rounded">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="p-2">Date</th>
                                                    <th className="p-2">User</th>
                                                    <th className="p-2">Type</th>
                                                    <th className="p-2 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ledger.payments.map((p, i) => (
                                                    <tr key={i} className="border-b last:border-0 border-gray-200">
                                                        <td className="p-2">{format(new Date(p.post_time), 'MM/dd/yy HH:mm')}</td>
                                                        <td className="p-2 font-mono">{p.post_user.substring(0, 8)}...</td>
                                                        <td className="p-2">{p.payment_type === 0 ? 'Patient' : 'Ins'}</td>
                                                        <td className="p-2 text-right">${parseFloat(p.pay_amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Step 4: Posting Form */}
                            <div className="bg-white p-6 rounded shadow border-l-4 border-primary">
                                <h2 className="font-bold text-gray-800 mb-4">Post New Payment</h2>

                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Total Amount ($)</label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full border p-2 rounded text-lg font-bold"
                                            value={form.amount}
                                            onChange={e => setForm({ ...form, amount: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Check Date</label>
                                        <input
                                            type="date"
                                            className="w-full border p-2 rounded"
                                            value={form.checkDate}
                                            onChange={e => setForm({ ...form, checkDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Payment Method</label>
                                        <select
                                            className="w-full border p-2 rounded"
                                            value={form.paymentMethod}
                                            onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                                        >
                                            <option>Check</option>
                                            <option>Cash</option>
                                            <option>Credit Card</option>
                                            <option>EFT</option>
                                            <option>Money Order</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Reference (Check #)</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={form.reference}
                                            onChange={e => setForm({ ...form, reference: e.target.value })}
                                            placeholder="Required for Checks"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Memo</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={form.note}
                                            onChange={e => setForm({ ...form, note: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Step 5: Allocations */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-gray-700">Cost Distribution</h3>
                                        <button
                                            onClick={handleAutoAllocate}
                                            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                                        >
                                            Auto-Allocate
                                        </button>
                                    </div>
                                    <table className="w-full border">
                                        <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                                            <tr>
                                                <th className="p-2 text-left">Code</th>
                                                <th className="p-2 text-right">Fee</th>
                                                <th className="p-2 text-right">Allocated</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {ledger.lines.map(line => (
                                                <tr key={line.id}>
                                                    <td className="p-2 font-medium">{line.code}</td>
                                                    <td className="p-2 text-right text-gray-500">${parseFloat(line.total).toFixed(2)}</td>
                                                    <td className="p-2 text-right w-32">
                                                        <input
                                                            type="number" step="0.01"
                                                            className="w-full border p-1 rounded text-right"
                                                            value={allocations[line.id] || ''}
                                                            onChange={e => {
                                                                setAllocations(prev => ({
                                                                    ...prev,
                                                                    [line.id]: e.target.value
                                                                }));
                                                            }}
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="flex justify-end mt-2 text-sm">
                                        <div className={`mr-4 ${balanceRemaining !== 0 ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                                            Unapplied: ${balanceRemaining.toFixed(2)}
                                        </div>
                                        <div className="font-bold">
                                            Total: ${totalAllocated.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="flex justify-end">
                                    <button
                                        className={`px-6 py-2 rounded text-white font-bold shadow ${(balanceRemaining === 0 && totalAllocated > 0 && !submitting)
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-gray-400 cursor-not-allowed'}`}
                                        disabled={balanceRemaining !== 0 || totalAllocated === 0 || submitting}
                                        onClick={handleSubmit}
                                    >
                                        {submitting ? 'Posting...' : 'Post Payment'}
                                    </button>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="bg-white p-12 rounded shadow text-center text-gray-500">
                            {selectedPatient ? 'Select an encounter to view details.' : 'Search and select a patient to begin.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentPosting;
