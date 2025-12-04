import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, CheckSquare, Square } from 'lucide-react';
import { visitsAPI, patientsAPI, ordersAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';

const VisitPrint = ({ visitId, patientId, onClose }) => {
    const [patient, setPatient] = useState(null);
    const [currentVisit, setCurrentVisit] = useState(null);
    const [selectedVisits, setSelectedVisits] = useState([visitId]);
    const [allVisits, setAllVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [documents, setDocuments] = useState([]);
    const printRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [visitId, patientId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch patient
            const patientRes = await patientsAPI.get(patientId);
            setPatient(patientRes.data);

            // Fetch current visit
            const visitRes = await visitsAPI.get(visitId);
            setCurrentVisit(visitRes.data);

            // Fetch all visits for this patient
            // We'll need to get visits from the patient snapshot or create a new endpoint
            // For now, let's fetch from the visits endpoint with patient filter
            try {
                const visitsRes = await visitsAPI.getByPatient(patientId);
                setAllVisits(visitsRes.data || []);
            } catch (e) {
                // Fallback: only show current visit
                setAllVisits([visitRes.data]);
            }

            // Fetch orders for selected visits
            const ordersRes = await ordersAPI.getByPatient(patientId);
            const visitOrders = ordersRes.data.filter(o => 
                selectedVisits.includes(o.visit_id)
            );
            setOrders(visitOrders);

            // Fetch documents for selected visits
            const docsRes = await documentsAPI.getByPatient(patientId);
            const visitDocs = docsRes.data.filter(d => 
                selectedVisits.includes(d.visit_id)
            );
            setDocuments(docsRes.data.filter(d => 
                selectedVisits.includes(d.visit_id)
            ));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedVisits.length > 0) {
            fetchOrdersAndDocs();
        }
    }, [selectedVisits]);

    const fetchOrdersAndDocs = async () => {
        try {
            const ordersRes = await ordersAPI.getByPatient(patientId);
            const visitOrders = ordersRes.data.filter(o => 
                selectedVisits.includes(o.visit_id)
            );
            setOrders(visitOrders);

            const docsRes = await documentsAPI.getByPatient(patientId);
            const visitDocs = docsRes.data.filter(d => 
                selectedVisits.includes(d.visit_id)
            );
            setDocuments(visitDocs);
        } catch (error) {
            console.error('Error fetching orders/docs:', error);
        }
    };

    const toggleVisit = (vid) => {
        if (selectedVisits.includes(vid)) {
            if (selectedVisits.length > 1) {
                setSelectedVisits(selectedVisits.filter(v => v !== vid));
            }
        } else {
            setSelectedVisits([...selectedVisits, vid]);
        }
    };

    const handlePrint = () => {
        // Trigger print dialog - the CSS will handle showing the print content
        window.print();
    };

    const parseNoteText = (noteText) => {
        if (!noteText) return { hpi: '', assessment: '', plan: '', ros: '', pe: '', vitals: '' };
        
        const sections = {
            hpi: '',
            assessment: '',
            plan: '',
            ros: '',
            pe: '',
            vitals: ''
        };
        
        // Extract sections
        const hpiMatch = noteText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:Vitals|ROS|Review|PE|Physical|Assessment|Plan):)/is);
        if (hpiMatch) sections.hpi = hpiMatch[1].trim();
        
        const vitalsMatch = noteText.match(/Vitals:\s*(.+?)(?:\n\n|\n(?:HPI|ROS|Review|PE|Physical|Assessment|Plan):)/is);
        if (vitalsMatch) sections.vitals = vitalsMatch[1].trim();
        
        const rosMatch = noteText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
        if (rosMatch) sections.ros = rosMatch[1].trim();
        
        const peMatch = noteText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
        if (peMatch) sections.pe = peMatch[1].trim();
        
        const assessmentMatch = noteText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
        if (assessmentMatch) sections.assessment = assessmentMatch[1].trim();
        
        const planMatch = noteText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|$)/is);
        if (planMatch) sections.plan = planMatch[1].trim();
        
        return sections;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6">Loading...</div>
            </div>
        );
    }

    const visitsToPrint = allVisits.filter(v => selectedVisits.includes(v.id));

    return (
        <>
            {/* Print Content - Must be outside modal for printing */}
            <div ref={printRef} className="hidden print:block p-8 bg-white print:visible" id="print-content" style={{ display: 'none' }}>
                {patient && (
                    <div className="mb-8">
                        <h1 className="text-3xl font-serif font-bold text-ink-900 mb-4">Visit Summary</h1>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <strong>Patient:</strong> {patient.first_name} {patient.last_name}
                            </div>
                            <div>
                                <strong>DOB:</strong> {format(new Date(patient.dob), 'MMM d, yyyy')}
                            </div>
                            <div>
                                <strong>MRN:</strong> {patient.mrn}
                            </div>
                            <div>
                                <strong>Sex:</strong> {patient.sex}
                            </div>
                            {patient.phone && (
                                <div>
                                    <strong>Phone:</strong> {patient.phone}
                                </div>
                            )}
                            {patient.email && (
                                <div>
                                    <strong>Email:</strong> {patient.email}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {visitsToPrint.map((visit, idx) => {
                    const noteSections = visit.note_draft ? parseNoteText(visit.note_draft) : {};
                    const visitVitals = visit.vitals ? (typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals) : null;
                    const providerName = visit.provider_first_name && visit.provider_last_name
                        ? `${visit.provider_first_name} ${visit.provider_last_name}`
                        : 'Provider';

                    return (
                        <div key={visit.id} className={`mb-8 ${idx > 0 ? 'page-break-before' : ''}`}>
                            <div className="border-b-2 border-ink-900 pb-2 mb-4">
                                <h2 className="text-2xl font-serif font-bold text-ink-900">
                                    Visit: {format(new Date(visit.visit_date), 'MMMM d, yyyy')}
                                </h2>
                                <p className="text-ink-600">Provider: {providerName} | Visit Type: {visit.visit_type || 'Office Visit'}</p>
                            </div>

                            {/* Vitals */}
                            {visitVitals && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Vital Signs</h3>
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                        {visitVitals.bp && <div><strong>BP:</strong> {visitVitals.bp} mmHg</div>}
                                        {visitVitals.temp && <div><strong>Temp:</strong> {visitVitals.temp}°F</div>}
                                        {visitVitals.pulse && <div><strong>Pulse:</strong> {visitVitals.pulse} bpm</div>}
                                        {visitVitals.resp && <div><strong>Resp:</strong> {visitVitals.resp} /min</div>}
                                        {visitVitals.o2sat && <div><strong>O2 Sat:</strong> {visitVitals.o2sat}%</div>}
                                        {visitVitals.weight && <div><strong>Weight:</strong> {visitVitals.weight} lbs</div>}
                                        {visitVitals.height && <div><strong>Height:</strong> {visitVitals.height} in</div>}
                                        {visitVitals.bmi && <div><strong>BMI:</strong> {visitVitals.bmi}</div>}
                                    </div>
                                </div>
                            )}

                            {/* HPI */}
                            {noteSections.hpi && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">History of Present Illness</h3>
                                    <p className="text-ink-700 whitespace-pre-wrap">
                                        {noteSections.hpi.replace(/&#x2F;/g, '/').replace(/&#47;/g, '/').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                                    </p>
                                </div>
                            )}

                            {/* ROS */}
                            {noteSections.ros && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Review of Systems</h3>
                                    <p className="text-ink-700 whitespace-pre-wrap">{noteSections.ros}</p>
                                </div>
                            )}

                            {/* Physical Exam */}
                            {noteSections.pe && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Physical Examination</h3>
                                    <p className="text-ink-700 whitespace-pre-wrap">{noteSections.pe}</p>
                                </div>
                            )}

                            {/* Assessment */}
                            {noteSections.assessment && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Assessment</h3>
                                    <p className="text-ink-700 whitespace-pre-wrap">
                                        {noteSections.assessment.replace(/&#x2F;/g, '/').replace(/&#47;/g, '/').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                                    </p>
                                </div>
                            )}

                            {/* Plan */}
                            {noteSections.plan && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Plan</h3>
                                    <p className="text-ink-700 whitespace-pre-wrap">
                                        {noteSections.plan.replace(/&#x2F;/g, '/').replace(/&#47;/g, '/').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                                    </p>
                                </div>
                            )}

                            {/* Orders for this visit */}
                            {orders.filter(o => o.visit_id === visit.id).length > 0 && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Orders</h3>
                                    <ul className="list-disc list-inside space-y-1 text-ink-700">
                                        {orders.filter(o => o.visit_id === visit.id).map((order, oIdx) => (
                                            <li key={oIdx}>
                                                <strong className="capitalize">{order.order_type}:</strong>{' '}
                                                {order.order_payload?.test_name || 
                                                 order.order_payload?.study_name || 
                                                 order.order_payload?.testName ||
                                                 order.order_payload?.procedureName ||
                                                 'Order'}
                                                {order.status && ` (${order.status})`}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Documents for this visit */}
                            {documents.filter(d => d.visit_id === visit.id).length > 0 && (
                                <div className="mb-4">
                                    <h3 className="font-bold text-ink-900 mb-2">Documents</h3>
                                    <ul className="list-disc list-inside space-y-1 text-ink-700">
                                        {documents.filter(d => d.visit_id === visit.id).map((doc, dIdx) => (
                                            <li key={dIdx}>
                                                {doc.filename} ({doc.doc_type || 'document'})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Signature */}
                            {visit.note_signed_by && (
                                <div className="mt-6 pt-4 border-t border-ink-300">
                                    <p className="text-sm text-ink-600">
                                        Signed: {format(new Date(visit.note_signed_at), 'MMM d, yyyy h:mm a')}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="mt-8 pt-4 border-t border-ink-300 text-xs text-ink-500 text-center">
                    Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}
                </div>
            </div>

            {/* Print Controls (hidden when printing) */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-serif font-bold text-ink-900">Print Visit Summary</h2>
                            <button
                                onClick={onClose}
                                className="text-ink-400 hover:text-ink-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-ink-700 mb-3">
                                Select Visits to Include:
                            </label>
                            <div className="space-y-2 max-h-60 overflow-y-auto border border-paper-200 rounded p-3">
                                {allVisits.map(visit => {
                                    const isSelected = selectedVisits.includes(visit.id);
                                    const isCurrent = visit.id === visitId;
                                    return (
                                        <label
                                            key={visit.id}
                                            className={`flex items-center space-x-2 p-2 hover:bg-paper-50 rounded cursor-pointer ${
                                                isCurrent ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            {isSelected ? (
                                                <CheckSquare className="w-5 h-5 text-paper-700" />
                                            ) : (
                                                <Square className="w-5 h-5 text-ink-300" />
                                            )}
                                            <div className="flex-1">
                                                <div className="font-medium text-ink-900">
                                                    {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                                                    {isCurrent && <span className="ml-2 text-xs text-blue-600">(Current)</span>}
                                                </div>
                                                <div className="text-sm text-ink-600">
                                                    {visit.visit_type || 'Office Visit'}
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleVisit(visit.id)}
                                                disabled={isCurrent && selectedVisits.length === 1}
                                                className="hidden"
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 text-white rounded-md flex items-center space-x-2 transition-all duration-200 hover:shadow-md"
                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        margin: 0.5in;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #print-content {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                    }
                    #print-content * {
                        visibility: visible !important;
                    }
                    .page-break-before {
                        page-break-before: always;
                    }
                    .print\\:hidden {
                        display: none !important;
                        visibility: hidden !important;
                    }
                }
                @media screen {
                    #print-content {
                        display: none !important;
                    }
                }
            `}</style>
        </>
    );
};

export default VisitPrint;

