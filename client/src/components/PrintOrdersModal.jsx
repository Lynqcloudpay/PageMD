import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, CheckCircle2, FlaskConical, Image, Pill, ExternalLink, Calendar, ChevronDown, ChevronRight, User } from 'lucide-react';
import { ordersAPI, referralsAPI, eprescribeAPI, visitsAPI, settingsAPI } from '../services/api';
import { format } from 'date-fns';

const PrintOrdersModal = ({ patient, isOpen, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState([]);
    const [allOrders, setAllOrders] = useState([]);
    const [selectedOrders, setSelectedOrders] = useState(new Set());
    const [expandedVisits, setExpandedVisits] = useState({});
    const [clinicInfo, setClinicInfo] = useState({
        name: "PageMD Family Practice",
        address: "123 Medical Plaza, Ste 100\nHealthcare City, ST 12345",
        phone: "(555) 123-4567",
        logo: "https://pagemd.com/wp-content/uploads/2023/10/pagemd-logo.png"
    });

    useEffect(() => {
        if (isOpen && patient?.id) {
            fetchAllOrders();
        }
    }, [isOpen, patient?.id]);

    const fetchAllOrders = async () => {
        setLoading(true);
        try {
            const [visitsRes, ordersRes, referralsRes, epRes, practiceRes] = await Promise.all([
                visitsAPI.getByPatient(patient.id),
                ordersAPI.getByPatient(patient.id),
                referralsAPI.getByPatient(patient.id),
                eprescribeAPI.getPrescriptions(patient.id).catch(() => ({ data: { prescriptions: [] } })),
                settingsAPI.getPractice().catch(() => ({ data: null }))
            ]);

            // Update clinic info if available
            if (practiceRes.data) {
                const p = practiceRes.data;
                const address = [p.address_line1, p.address_line2, `${p.city || ''} ${p.state || ''} ${p.zip || ''}`.trim()]
                    .filter(Boolean)
                    .join('\n');

                setClinicInfo({
                    name: p.practice_name || "PageMD Family Practice",
                    address: address || "123 Medical Plaza, Ste 100\nHealthcare City, ST 12345",
                    phone: p.phone || "(555) 123-4567",
                    logo: p.logo_url || "https://pagemd.com/wp-content/uploads/2023/10/pagemd-logo.png"
                });
            }

            const visitsData = Array.isArray(visitsRes.data) ? visitsRes.data : [];
            const ordersData = Array.isArray(ordersRes.data) ? ordersRes.data : [];
            const referralsData = Array.isArray(referralsRes.data) ? referralsRes.data : [];
            const epData = Array.isArray(epRes.data?.prescriptions) ? epRes.data.prescriptions : [];

            // Group all orders by visit_id
            // Note: some orders might not have visit_id, we'll label them "Standalone"
            const consolidated = [
                ...ordersData.map(o => ({ ...o, type: 'order', category: o.order_type })),
                ...referralsData.map(r => ({ ...r, type: 'referral', category: 'referral' })),
                ...epData.map(p => ({ ...p, type: 'prescription', category: 'prescription', visit_id: p.visit_id }))
            ];

            setAllOrders(consolidated);
            setVisits(visitsData.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)));

            // Auto-expand the most recent visit
            if (visitsData.length > 0) {
                setExpandedVisits({ [visitsData[0].id]: true });
            }
        } catch (error) {
            console.error('Error fetching print data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleVisit = (visitId) => {
        setExpandedVisits(prev => ({ ...prev, [visitId]: !prev[visitId] }));
    };

    const toggleOrder = (orderId) => {
        const next = new Set(selectedOrders);
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
        setSelectedOrders(next);
    };

    const toggleVisitAll = (visitId, visitOrders) => {
        const next = new Set(selectedOrders);
        const allInVisitSelected = visitOrders.every(o => next.has(o.id));

        visitOrders.forEach(o => {
            if (allInVisitSelected) next.delete(o.id);
            else next.add(o.id);
        });
        setSelectedOrders(next);
    };

    const getOrdersForVisit = (visitId) => {
        return allOrders.filter(o => o.visit_id === visitId);
    };

    const handlePrint = () => {
        const toPrint = allOrders.filter(o => selectedOrders.has(o.id));
        if (toPrint.length === 0) {
            alert('Please select at least one order to print');
            return;
        }

        const printContent = generatePrintHTML(toPrint);

        let printIframe = document.getElementById('print-orders-iframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'print-orders-iframe';
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
        }

        const pri = printIframe.contentWindow;
        pri.document.open();
        pri.document.write(printContent);
        pri.document.close();

        setTimeout(() => {
            pri.focus();
            try {
                pri.print();
            } catch (e) {
                console.error('Print failed', e);
            }
        }, 500);
    };

    const generatePrintHTML = (ordersToPrint) => {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A';
        const patientMRN = patient.mrn || 'N/A';
        const datePrinted = format(new Date(), 'MMMM d, yyyy h:mm a');

        // Group by type for the printout
        const labs = ordersToPrint.filter(o => o.category === 'lab');
        const imaging = ordersToPrint.filter(o => o.category === 'imaging');
        const prescriptions = ordersToPrint.filter(o => o.category === 'prescription');
        const referrals = ordersToPrint.filter(o => o.category === 'referral');

        return `
            <html>
                <head>
                    <title>Patient Orders - ${patientName}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                            color: #1a202c;
                            line-height: 1.5;
                            padding: 40px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        .clinic-info h1 { margin: 0; font-size: 24px; color: #2d3748; }
                        .clinic-info p { margin: 2px 0; font-size: 12px; color: #718096; }
                        .patient-info { text-align: right; }
                        .patient-info h2 { margin: 0; font-size: 18px; }
                        .patient-info p { margin: 2px 0; font-size: 12px; }
                        
                        .section { margin-bottom: 30px; page-break-inside: avoid; }
                        .section-title {
                            font-size: 14px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            color: #4a5568;
                            border-bottom: 1px solid #edf2f7;
                            padding-bottom: 8px;
                            margin-bottom: 15px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        
                        .order-card {
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 15px;
                            background-color: #f8fafc;
                        }
                        .order-header {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 10px;
                        }
                        .order-name { font-weight: 700; font-size: 14px; }
                        .order-date { font-size: 11px; color: #a0aec0; }
                        .order-details { font-size: 13px; color: #4a5568; }
                        .order-dx { margin-top: 10px; font-size: 11px; color: #718096; }
                        .dx-pill {
                            display: inline-block;
                            background: #edf2f7;
                            padding: 2px 8px;
                            border-radius: 4px;
                            margin-right: 5px;
                        }
                        
                        .footer {
                            margin-top: 50px;
                            padding-top: 20px;
                            border-top: 1px solid #e2e8f0;
                            font-size: 10px;
                            color: #a0aec0;
                            text-align: center;
                        }
                        @media print {
                            body { padding: 0; }
                            .order-card { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="clinic-info">
                            <h1>${clinicInfo.name}</h1>
                            ${clinicInfo.address.split('\n').map(line => `<p>${line}</p>`).join('')}
                            <p>Ph: ${clinicInfo.phone}</p>
                        </div>
                        <div class="patient-info">
                            <h2>${patientName}</h2>
                            <p>DOB: ${patientDOB}</p>
                            <p>MRN: ${patientMRN}</p>
                            <p>Date Printed: ${datePrinted}</p>
                        </div>
                    </div>

                    ${prescriptions.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Medications / Prescriptions</div>
                            ${prescriptions.map(p => `
                                <div class="order-card">
                                    <div class="order-header">
                                        <div class="order-name">${p.medication_name}</div>
                                        <div class="order-date">${format(new Date(p.created_at), 'MMM d, yyyy')}</div>
                                    </div>
                                    <div class="order-details">
                                        <strong>Sig:</strong> ${p.sig}<br/>
                                        <strong>Qty:</strong> ${p.quantity} | <strong>Refills:</strong> ${p.refills}
                                    </div>
                                    ${p.diagnoses?.length > 0 ? `
                                        <div class="order-dx">
                                            <strong>Diagnoses:</strong> 
                                            ${p.diagnoses.map(d => `<span class="dx-pill">${d.icd10Code || d.icd10_code}: ${d.name || d.problem_name}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${labs.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Laboratory Orders</div>
                            ${labs.map(l => `
                                <div class="order-card">
                                    <div class="order-header">
                                        <div class="order-name">${l.order_payload?.test_name || l.order_payload?.name || 'Lab Test'}</div>
                                        <div class="order-date">${format(new Date(l.created_at), 'MMM d, yyyy')}</div>
                                    </div>
                                    <div class="order-details">
                                        ${l.order_payload?.instructions ? `<strong>Instructions:</strong> ${l.order_payload.instructions}` : ''}
                                    </div>
                                    ${l.diagnoses?.length > 0 ? `
                                        <div class="order-dx">
                                            <strong>Diagnoses:</strong> 
                                            ${l.diagnoses.map(d => `<span class="dx-pill">${d.icd10Code || d.icd10_code}: ${d.name || d.problem_name}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${imaging.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Imaging & Cardiology Orders</div>
                            ${imaging.map(i => `
                                <div class="order-card">
                                    <div class="order-header">
                                        <div class="order-name">${i.order_payload?.test_name || i.order_payload?.name || 'Imaging Study'}</div>
                                        <div class="order-date">${format(new Date(i.created_at), 'MMM d, yyyy')}</div>
                                    </div>
                                    <div class="order-details">
                                        ${i.order_payload?.indication ? `<strong>Indication:</strong> ${i.order_payload.indication}` : ''}
                                        ${i.order_payload?.instructions ? `<br/><strong>Instructions:</strong> ${i.order_payload.instructions}` : ''}
                                    </div>
                                    ${i.diagnoses?.length > 0 ? `
                                        <div class="order-dx">
                                            <strong>Diagnoses:</strong> 
                                            ${i.diagnoses.map(d => `<span class="dx-pill">${d.icd10Code || d.icd10_code}: ${d.name || d.problem_name}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${referrals.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Referrals</div>
                            ${referrals.map(r => `
                                <div class="order-card">
                                    <div class="order-header">
                                        <div class="order-name">Referral to ${r.recipient_specialty || 'Specialist'}</div>
                                        <div class="order-date">${format(new Date(r.created_at), 'MMM d, yyyy')}</div>
                                    </div>
                                    <div class="order-details">
                                        <strong>Recipient:</strong> ${r.recipient_name || 'TBD'}<br/>
                                        <strong>Reason:</strong> ${r.reason}
                                    </div>
                                    ${r.diagnoses?.length > 0 ? `
                                        <div class="order-dx">
                                            <strong>Diagnoses:</strong> 
                                            ${r.diagnoses.map(d => `<span class="dx-pill">${d.icd10Code || d.icd10_code}: ${d.name || d.problem_name}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="footer">
                        This is a clinical document generated by PageMD EMR. Please contact the clinic for verification if needed.
                    </div>
                </body>
            </html>
        `;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-100 p-2 rounded-xl">
                            <Printer className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Print Patient Orders</h2>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{patient.first_name} {patient.last_name} • MRN: {patient.mrn}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-medium text-gray-500">Retrieving encounter history...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {visits.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                    <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No visits found for this patient.</p>
                                </div>
                            ) : (
                                visits.map(visit => {
                                    const visitOrders = getOrdersForVisit(visit.id);
                                    const isExpanded = expandedVisits[visit.id];
                                    const allSelected = visitOrders.length > 0 && visitOrders.every(o => selectedOrders.has(o.id));
                                    const someSelected = visitOrders.some(o => selectedOrders.has(o.id)) && !allSelected;

                                    if (visitOrders.length === 0) return null;

                                    return (
                                        <div key={visit.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all">
                                            <div className="px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50 cursor-pointer" onClick={() => toggleVisit(visit.id)}>
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div onClick={(e) => { e.stopPropagation(); toggleVisitAll(visit.id, visitOrders); }} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${allSelected ? 'bg-primary-600 border-primary-600' : someSelected ? 'bg-primary-100 border-primary-300' : 'border-gray-300'}`}>
                                                        {allSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                        {someSelected && <div className="w-2.5 h-0.5 bg-primary-600 rounded-full"></div>}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-bold text-gray-900">{format(new Date(visit.visit_date), 'MMMM d, yyyy')}</span>
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{visit.visit_type || 'Office Visit'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{visitOrders.length} {visitOrders.length === 1 ? 'Order' : 'Orders'}</span>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-2 bg-gray-50/30 border-t border-gray-100 space-y-1">
                                                    {visitOrders.map(order => {
                                                        const isSelected = selectedOrders.has(order.id);
                                                        const OrderIcon = order.category === 'lab' ? FlaskConical : order.category === 'imaging' ? Image : order.category === 'prescription' ? Pill : ExternalLink;

                                                        return (
                                                            <div key={order.id} onClick={() => toggleOrder(order.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-primary-50 border-primary-200 shadow-sm' : 'bg-white border-transparent hover:border-gray-200'}`}>
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                                </div>
                                                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white text-primary-600 shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                                                                    <OrderIcon className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`text-sm font-bold truncate ${isSelected ? 'text-primary-900' : 'text-gray-700'}`}>
                                                                        {order.category === 'prescription' ? order.medication_name : order.order_payload?.test_name || order.order_payload?.name || order.recipient_specialty || 'Untitled Order'}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500 font-medium uppercase truncate">
                                                                        {order.category === 'referral' ? 'Specialist Referral' : order.category}
                                                                        {order.sig && ` • ${order.sig}`}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-500">
                        {selectedOrders.size} {selectedOrders.size === 1 ? 'order' : 'orders'} selected
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                            Cancel
                        </button>
                        <button onClick={handlePrint} disabled={selectedOrders.size === 0} className={`px-6 py-2.5 text-sm font-bold text-white rounded-full shadow-lg shadow-primary-200 flex items-center gap-2 transition-all ${selectedOrders.size === 0 ? 'bg-gray-300 cursor-not-allowed grayscale' : 'bg-primary-600 hover:bg-primary-700 active:scale-95'}`}>
                            <Printer className="w-4 h-4" />
                            Print Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintOrdersModal;
