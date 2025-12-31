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
    // Default "NO LOGO" placeholder SVG - building icon with text
    const defaultLogoUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f8fafc' rx='8'/%3E%3Crect x='60' y='45' width='80' height='90' fill='none' stroke='%23cbd5e1' stroke-width='3' rx='4'/%3E%3Crect x='75' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='75' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='88' y='110' width='24' height='25' fill='%23cbd5e1' rx='2'/%3E%3Ctext x='100' y='165' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' font-weight='600' fill='%2394a3b8'%3ENO LOGO%3C/text%3E%3C/svg%3E`;
    const [clinicInfo, setClinicInfo] = useState({
        name: "My Practice",
        address: "",
        phone: "",
        logo: defaultLogoUrl
    });

    useEffect(() => {
        if (isOpen && patient?.id) {
            fetchAllOrders();
        }
    }, [isOpen, patient?.id]);

    const parseOrdersFromNote = (noteText, visitId) => {
        const safeNoteText = typeof noteText === 'string' ? noteText : (typeof noteText === 'object' ? JSON.stringify(noteText) : String(noteText || ''));
        if (!safeNoteText) return [];

        // Extract the Plan section
        const planMatch = safeNoteText.match(/(?:Plan|P):[\s\n]*([\s\S]+?)(?:\n\n|\n(?:Care Plan|CP|Follow Up|FU):|$)/i);
        if (!planMatch) return [];

        const planText = planMatch[1];
        const lines = planText.split('\n');
        const extracted = [];
        let currentDiagnosis = '';

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Check if it's a diagnosis line (e.g., "1. Hypertension")
            const safeTrimmed = typeof trimmed === 'string' ? trimmed : String(trimmed || '');
            const diagMatch = safeTrimmed.match(/^(\d+)\.\s*(.+)$/);
            if (diagMatch) {
                currentDiagnosis = diagMatch[2].trim();
                return;
            }

            // Check if it's an order line
            if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                const orderText = trimmed.replace(/^[•\-]\s*/, '').trim();
                if (!orderText) return;

                let category = 'order';
                let displayTitle = orderText;

                if (orderText.toLowerCase().startsWith('prescription:')) {
                    category = 'prescription';
                    displayTitle = orderText.replace(/^prescription:\s*/i, '');
                } else if (orderText.toLowerCase().startsWith('lab:')) {
                    category = 'lab';
                    displayTitle = orderText.replace(/^lab:\s*/i, '');
                } else if (orderText.toLowerCase().startsWith('imaging:')) {
                    category = 'imaging';
                    displayTitle = orderText.replace(/^imaging:\s*/i, '');
                } else if (orderText.toLowerCase().startsWith('referral:')) {
                    category = 'referral';
                    displayTitle = orderText.replace(/^referral:\s*/i, '');
                }

                extracted.push({
                    id: `virtual-${visitId}-${extracted.length}`,
                    visit_id: visitId,
                    type: 'virtual',
                    category: category,
                    display_title: displayTitle,
                    diagnosis_name: currentDiagnosis,
                    is_virtual: true
                });
            }
        });

        return extracted;
    };

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
                    name: p.practice_name || "My Practice",
                    address: address || "",
                    phone: p.phone || "",
                    logo: p.logo_url || defaultLogoUrl,
                    npi: p.npi || "",
                    fax: p.fax || "",
                    email: p.email || ""
                });
            }

            const visitsData = Array.isArray(visitsRes.data) ? visitsRes.data.map(v => ({ ...v, id: String(v.id) })) : [];
            const ordersData = Array.isArray(ordersRes.data) ? ordersRes.data.map(o => ({ ...o, id: String(o.id), visit_id: o.visit_id ? String(o.visit_id) : null })) : [];
            const referralsData = Array.isArray(referralsRes.data) ? referralsRes.data.map(r => ({ ...r, id: String(r.id), visit_id: r.visit_id ? String(r.visit_id) : null })) : [];
            const epData = Array.isArray(epRes.data?.prescriptions) ? epRes.data.prescriptions.map(p => ({ ...p, id: String(p.id), visit_id: p.visit_id ? String(p.visit_id) : null })) : [];

            // Extract virtual orders from visit notes
            const virtualOrders = [];
            visitsData.forEach(v => {
                const noteOrders = parseOrdersFromNote(v.note_draft, v.id);
                virtualOrders.push(...noteOrders);
            });

            // Group all orders by visit_id
            const consolidated = [
                ...ordersData.map(o => ({ ...o, type: 'order', category: o.order_type || 'order' })),
                ...referralsData.map(r => ({ ...r, type: 'referral', category: 'referral' })),
                ...epData.map(p => ({ ...p, type: 'prescription', category: 'prescription' })),
                ...virtualOrders
            ];

            // Filter out duplicates if a virtual order matches a real order (rudimentary check)
            const filteredConsolidated = consolidated.filter((item, index, self) => {
                if (item.type !== 'virtual') return true;
                // If it's virtual, check if there's a real order with similar title in the same visit
                const hasRealMatch = self.some(other =>
                    other.type !== 'virtual' &&
                    other.visit_id === item.visit_id &&
                    (String(other.medication_name || '').toLowerCase().includes(item.display_title.toLowerCase()) ||
                        String(other.order_payload?.test_name || '').toLowerCase().includes(item.display_title.toLowerCase()) ||
                        String(other.recipient_specialty || '').toLowerCase().includes(item.display_title.toLowerCase()))
                );
                return !hasRealMatch;
            });

            setAllOrders(filteredConsolidated);
            setVisits(visitsData.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)));

            // Auto-expand visits that have orders
            const initialExpanded = {};
            visitsData.forEach((v, idx) => {
                const hasOrders = filteredConsolidated.some(o => o.visit_id === v.id);
                if (hasOrders && Object.keys(initialExpanded).length < 2) {
                    initialExpanded[v.id] = true;
                }
            });

            // If we have standalone orders, expand that group too
            const hasStandalone = filteredConsolidated.some(o => !o.visit_id);
            if (hasStandalone) {
                initialExpanded['standalone'] = true;
            }

            setExpandedVisits(initialExpanded);
        } catch (error) {
            console.error('Error fetching print data:', error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueDiagnoses = useMemo(() => {
        const dxSet = new Set();
        allOrders.forEach(order => {
            if (order.diagnosis_name) {
                dxSet.add(order.diagnosis_name);
            }
            if (order.diagnoses?.length > 0) {
                order.diagnoses.forEach(d => {
                    const name = d.name || d.problem_name || d.icd10Code || d.icd10_code;
                    if (name) dxSet.add(name);
                });
            }
        });
        return Array.from(dxSet).sort();
    }, [allOrders]);

    const toggleVisitDiagnosisOrders = (dxName, visitOrders) => {
        const matchingOrders = visitOrders.filter(order => {
            if (order.diagnosis_name === dxName) return true;
            if (order.diagnoses?.some(d => (d.name || d.problem_name || d.icd10Code || d.icd10_code) === dxName)) return true;
            return false;
        });

        const next = new Set(selectedOrders);
        const allSelected = matchingOrders.every(o => next.has(o.id));

        matchingOrders.forEach(o => {
            if (allSelected) next.delete(o.id);
            else next.add(o.id);
        });
        setSelectedOrders(next);
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
        return allOrders.filter(o => {
            if (!visitId) return !o.visit_id;
            return o.visit_id === visitId;
        });
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
        const patientName = `${patient.last_name || ''}, ${patient.first_name || ''}`.toUpperCase();
        const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A';
        const patientAge = patient.dob ? `${Math.floor((new Date() - new Date(patient.dob)) / 31557600000)}Y` : '';
        const patientGender = (patient.sex || patient.gender || 'U').charAt(0).toUpperCase();
        const patientMRN = patient.mrn || 'N/A';
        const datePrinted = format(new Date(), 'MM/dd/yyyy HH:mm');
        const patientPhone = patient.phone ? patient.phone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : 'N/A';

        const labs = ordersToPrint.filter(o => o.category === 'lab');
        const imaging = ordersToPrint.filter(o => o.category === 'imaging');
        const prescriptions = ordersToPrint.filter(o => o.category === 'prescription');
        const referrals = ordersToPrint.filter(o => o.category === 'referral');

        const renderDiagnosisList = (order) => {
            if (order.diagnosis_name) return `<span class="dx-code">${order.diagnosis_name}</span>`;
            if (order.diagnoses?.length > 0) {
                return order.diagnoses.map(d => `<span class="dx-code">${d.icd10Code || d.icd10_code || ''}: ${d.name || d.problem_name || ''}</span>`).join('; ');
            }
            return '<span class="text-muted">None specified</span>';
        };

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>ORDER_REQUISITION_${patient.last_name}_${patient.mrn}</title>
                    <style>
                        @page { size: portrait; margin: 0.5in; }
                        body {
                            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            color: #000;
                            line-height: 1.3;
                            font-size: 11pt;
                            margin: 0;
                            padding: 0;
                        }
                        .req-container { max-width: 8.5in; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                        
                        /* Header Section (VisitChartView Style) */
                        .req-banner {
                            background-color: #eff6ff !important;
                            border-bottom: 2px solid #cbd5e1;
                            padding: 20px;
                            margin-bottom: 20px;
                        }
                        .banner-top {
                            display: table;
                            width: 100%;
                            border-bottom: 1px solid #cbd5e1;
                            padding-bottom: 15px;
                            margin-bottom: 15px;
                        }
                        .branding-cell { display: table-cell; vertical-align: middle; }
                        .logo-img { width: 100px; height: 100px; object-fit: contain; margin-right: 20px; vertical-align: middle; }
                        .clinic-info-wrap { display: inline-block; vertical-align: middle; }
                        .clinic-name { font-size: 18pt; font-weight: 800; color: #1e293b; margin: 0 0 5px 0; }
                        .clinic-details { font-size: 9pt; color: #64748b; line-height: 1.4; }
                        
                        .req-type-badge {
                            display: table-cell;
                            vertical-align: middle;
                            text-align: right;
                            width: 40%;
                        }
                        .badge-text {
                            display: inline-block;
                            padding: 8px 15px;
                            background: #000;
                            color: #fff;
                            font-weight: bold;
                            font-size: 12pt;
                            text-transform: uppercase;
                        }

                        /* Info Grid */
                        .info-grid {
                            display: table;
                            width: 100%;
                            margin-bottom: 25px;
                            border: 1px solid #ccc;
                        }
                        .info-row { display: table-row; }
                        .info-cell {
                            display: table-cell;
                            padding: 8px;
                            border: 1px solid #eee;
                            vertical-align: top;
                        }
                        .cell-label {
                            font-size: 8pt;
                            font-weight: bold;
                            text-transform: uppercase;
                            color: #666;
                            display: block;
                            margin-bottom: 2px;
                        }
                        .cell-value { font-size: 11pt; font-weight: 600; }

                        /* Section Styles */
                        .section { margin-bottom: 30px; }
                        .section-header {
                            background: #f4f4f4;
                            padding: 5px 10px;
                            font-weight: bold;
                            border-left: 4px solid #000;
                            margin-bottom: 15px;
                            text-transform: uppercase;
                            font-size: 10pt;
                        }

                        /* Table Styles */
                        .order-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 10px;
                        }
                        .order-table th {
                            text-align: left;
                            font-size: 9pt;
                            text-transform: uppercase;
                            border-bottom: 1px solid #000;
                            padding: 5px;
                        }
                        .order-table td {
                            padding: 8px 5px;
                            border-bottom: 1px solid #eee;
                            vertical-align: top;
                        }
                        .dx-code { font-size: 9pt; font-style: italic; color: #444; }
                        .text-muted { color: #888; }

                        /* Requisition Card for single-item visibility */
                        .req-card {
                            border: 1px solid #ddd;
                            padding: 12px;
                            margin-bottom: 10px;
                            background: #fff;
                        }
                        .card-title { font-weight: bold; font-size: 11pt; margin-bottom: 4px; }
                        .card-meta { font-size: 9pt; color: #555; }

                        /* Signature & Footer */
                        .print-footer {
                            margin-top: 60px;
                            display: table;
                            width: 100%;
                        }
                        .sig-block {
                            display: table-cell;
                            width: 50%;
                            border-top: 1px solid #000;
                            padding-top: 5px;
                        }
                        .date-block {
                            display: table-cell;
                            width: 20%;
                            border-top: 1px solid #000;
                            padding-top: 5px;
                            text-align: center;
                        }
                        .sub-label { font-size: 8pt; color: #666; margin-top: 2px; }
                        
                        .disclaimer {
                            margin: 40px 20px 20px;
                            font-size: 8pt;
                            color: #64748b;
                            text-align: justify;
                            border-top: 1px solid #e2e8f0;
                            padding-top: 15px;
                        }

                        @media print {
                            .no-print { display: none; }
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="req-container">
                        <div class="req-banner">
                            <div class="banner-top">
                                <div class="branding-cell">
                                    ${clinicInfo.logo ? `<img src="${clinicInfo.logo}" class="logo-img" alt="Logo">` : ''}
                                    <div class="clinic-info-wrap">
                                        <h1 class="clinic-name">${clinicInfo.name}</h1>
                                        <div class="clinic-details">
                                            ${clinicInfo.address.replace(/\n/g, '<br>')}
                                            <div style="margin-top: 5px;">
                                                <strong>TEL:</strong> ${clinicInfo.phone} &middot; 
                                                <strong>FAX:</strong> ${clinicInfo.fax}<br>
                                                <strong>NPI:</strong> ${clinicInfo.npi || 'N/A'} &middot; 
                                                <strong>EML:</strong> ${clinicInfo.email || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: table-cell; text-align: right; vertical-align: top; border-left: 1px solid #cbd5e1; padding-left: 20px;">
                                    <div style="font-size: 11pt; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Order Requisition</div>
                                    <div style="font-size: 8pt; color: #64748b; line-height: 1.5;">
                                        <div><strong>Date:</strong> ${datePrinted}</div>
                                        <div><strong>Ref:</strong> ${patientMRN}</div>
                                    </div>
                                </div>
                            </div>

                            <div style="display: table; width: 100%;">
                                <div style="display: table-cell; width: 45%; vertical-align: top;">
                                    <h2 style="font-size: 16pt; font-weight: 700; color: #0f172a; margin: 0 0 5px 0;">${patientName}</h2>
                                    <div style="display: flex; gap: 15px; font-size: 9pt; color: #334155;">
                                        <span><strong>MRN:</strong> ${patientMRN}</span>
                                        <span><strong>DOB:</strong> ${patientDOB} (${patientAge})</span>
                                        <span><strong>SEX:</strong> ${patientGender}</span>
                                    </div>
                                </div>
                                <div style="display: table-cell; width: 55%; vertical-align: top; border-left: 1px solid #cbd5e1; padding-left: 20px;">
                                    <div style="display: table; width: 100%; font-size: 8pt; color: #475569;">
                                        <div style="display: table-row;">
                                            <div style="display: table-cell; padding-right: 20px; padding-bottom: 5px;">
                                                <div style="font-weight: 700; text-transform: uppercase; font-size: 7pt; color: #94a3b8; margin-bottom: 2px;">Phone</div>
                                                <div>${patientPhone}</div>
                                            </div>
                                            <div style="display: table-cell;">
                                                <div style="font-weight: 700; text-transform: uppercase; font-size: 7pt; color: #94a3b8; margin-bottom: 2px;">Patient Address</div>
                                                <div style="line-height: 1.2;">
                                                    ${patient.address_line1 || ''}<br>
                                                    ${patient.city || ''}, ${patient.state || ''} ${patient.zip || ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="padding: 0 20px;">

                        ${labs.length > 0 ? `
                            <div class="section">
                                <div class="section-header">Laboratory Orders</div>
                                <table class="order-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 40%;">Test Name</th>
                                            <th style="width: 40%;">Diagnosis / ICD-10</th>
                                            <th style="width: 20%;">Instructions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${labs.map(l => `
                                            <tr>
                                                <td><strong>${l.type === 'virtual' ? l.display_title : l.order_payload?.test_name || l.order_payload?.name || 'Lab Test'}</strong></td>
                                                <td>${renderDiagnosisList(l)}</td>
                                                <td class="card-meta">${l.order_payload?.instructions || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        ${imaging.length > 0 ? `
                            <div class="section">
                                <div class="section-header">Imaging & Cardiology Requisition</div>
                                <table class="order-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 35%;">Study Description</th>
                                            <th style="width: 35%;">Indication / Diagnosis</th>
                                            <th style="width: 30%;">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${imaging.map(i => `
                                            <tr>
                                                <td><strong>${i.type === 'virtual' ? i.display_title : i.order_payload?.test_name || i.order_payload?.name || 'Imaging'}</strong></td>
                                                <td>${renderDiagnosisList(i)}</td>
                                                <td class="card-meta">${i.order_payload?.instructions || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        ${referrals.length > 0 ? `
                            <div class="section">
                                <div class="section-header">Specialist Consultations</div>
                                <table class="order-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 35%;">Recipient Specialty</th>
                                            <th style="width: 35%;">Reason for Referral</th>
                                            <th style="width: 30%;">Diagnosis</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${referrals.map(r => `
                                            <tr>
                                                <td><strong>${r.recipient_specialty || 'General Specialist'}</strong></td>
                                                <td>${r.reason || 'Routine evaluation'}</td>
                                                <td>${renderDiagnosisList(r)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        ${prescriptions.length > 0 ? `
                            <div class="section">
                                <div class="section-header">Prescription Summary (Electronic)</div>
                                <table class="order-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 40%;">Medication</th>
                                            <th style="width: 40%;">Sig / Instructions</th>
                                            <th style="width: 20%;">Qty / Refills</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${prescriptions.map(p => `
                                            <tr>
                                                <td><strong>${p.type === 'virtual' ? p.display_title : p.medication_name}</strong></td>
                                                <td>${p.sig || 'As directed'}</td>
                                                <td>${p.quantity || '-'}${p.refills ? ` / ${p.refills} refills` : ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        <div class="print-footer">
                            <div class="sig-block">
                                <div style="height: 30px;"></div>
                                <strong>Physician Signature</strong>
                                <div class="sub-label">${clinicInfo.name} &middot; NPI: ${clinicInfo.npi}</div>
                            </div>
                            <div style="display: table-cell; width: 10%;"></div>
                            <div class="date-block">
                                <div style="height: 30px; font-size: 10pt; vertical-align: bottom;">${datePrinted}</div>
                                <strong>Date / Time</strong>
                                <div class="sub-label">Generated per EMR</div>
                            </div>
                        </div>

                        <div class="disclaimer">
                            CONFIDENTIALITY NOTICE: This document contains protected health information intended only for the use of the individual or entity named above. 
                            If you are not the intended recipient, any disclosure, copying, or distribution is strictly prohibited. 
                            Facilitating labs: please fax results to ${clinicInfo.fax} or transmit via secure HL7 interface.
                        </div>
                    </div>
                </body>
            </html>
        `;
    };

    const renderOrderRow = (order) => {
        const isSelected = selectedOrders.has(order.id);
        const Icon = order.category === 'prescription' ? Pill :
            order.category === 'lab' ? FlaskConical :
                order.category === 'imaging' ? Image :
                    order.category === 'referral' ? ExternalLink : CheckCircle2;

        return (
            <div
                key={order.id}
                onClick={() => toggleOrder(order.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                    ? 'bg-primary-50 border-primary-200 shadow-sm'
                    : 'bg-white border-transparent hover:border-gray-200'
                    }`}
            >
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'
                    }`}>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white' : 'bg-gray-50'}`}>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${isSelected ? 'text-primary-900' : 'text-gray-700'}`}>
                        {order.type === 'virtual' ? order.display_title : order.category === 'prescription' ? order.medication_name : order.order_payload?.test_name || order.order_payload?.name || order.recipient_specialty || 'Untitled Order'}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase truncate flex items-center gap-2">
                        <span>{order.category === 'referral' ? 'Specialist Referral' : order.category}</span>
                        {order.sig && ` • ${order.sig}`}
                        {order.diagnosis_name && <span className="text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-100 normal-case ml-2">{order.diagnosis_name}</span>}
                    </div>
                </div>
            </div>
        );
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
                        <div className="flex flex-col items-center justify-center h-64 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            <span className="text-sm text-gray-400 font-medium">Loading orders...</span>
                        </div>
                    ) : allOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Calendar className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-medium">No orders found for this patient.</p>
                        </div>
                    ) : (
                        <div className="p-4">

                            <div className="space-y-4">
                                {/* Standalone Orders Group (if any) */}
                                {allOrders.some(o => !o.visit_id) && (
                                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                                        <div
                                            onClick={() => toggleVisit('standalone')}
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center bg-white cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleVisitAll('standalone', getOrdersForVisit(null));
                                                    }}
                                                >
                                                    {getOrdersForVisit(null).every(o => selectedOrders.has(o.id)) && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                    {!getOrdersForVisit(null).every(o => selectedOrders.has(o.id)) && getOrdersForVisit(null).some(o => selectedOrders.has(o.id)) && <div className="w-2.5 h-0.5 bg-primary-600 rounded-full"></div>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900">Standalone Orders</span>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Not linked to a specific visit</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{getOrdersForVisit(null).length}</span>
                                                {expandedVisits['standalone'] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                            </div>
                                        </div>

                                        {expandedVisits['standalone'] && (
                                            <div className="bg-gray-50/30 border-t border-gray-100 p-2">
                                                {/* Visit-specific Diagnosis Select */}
                                                {(Array.from(new Set(getOrdersForVisit(null).map(o => o.diagnosis_name || o.diagnoses?.map(d => d.name || d.problem_name || d.icd10Code || d.icd10_code)).flat().filter(Boolean))).length > 1) && (
                                                    <div className="px-2 py-3 mb-2 flex flex-wrap gap-1.5 border-b border-gray-100">
                                                        {Array.from(new Set(getOrdersForVisit(null).map(o => o.diagnosis_name || o.diagnoses?.map(d => d.name || d.problem_name || d.icd10Code || d.icd10_code)).flat().filter(Boolean))).sort().map(dx => {
                                                            const visitDxOrders = getOrdersForVisit(null).filter(o => o.diagnosis_name === dx || o.diagnoses?.some(d => (d.name || d.problem_name || d.icd10Code || d.icd10_code) === dx));
                                                            const allDxInVisitSelected = visitDxOrders.every(o => selectedOrders.has(o.id));
                                                            return (
                                                                <button
                                                                    key={dx}
                                                                    onClick={() => toggleVisitDiagnosisOrders(dx, getOrdersForVisit(null))}
                                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${allDxInVisitSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-primary-100 text-primary-700 hover:border-primary-300'}`}
                                                                >
                                                                    {dx} ({visitDxOrders.length})
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    {getOrdersForVisit(null).map(order => renderOrderRow(order))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Orders grouped by visit */}
                                {visits.map(visit => {
                                    const visitOrders = getOrdersForVisit(visit.id);
                                    if (visitOrders.length === 0) return null;

                                    const isExpanded = expandedVisits[visit.id];
                                    const allInVisitSelected = visitOrders.every(o => selectedOrders.has(o.id));
                                    const someInVisitSelected = visitOrders.some(o => selectedOrders.has(o.id));

                                    return (
                                        <div key={visit.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                                            <div
                                                onClick={() => toggleVisit(visit.id)}
                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center bg-white cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleVisitAll(visit.id, visitOrders);
                                                        }}
                                                    >
                                                        {allInVisitSelected && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                        {!allInVisitSelected && someInVisitSelected && <div className="w-2.5 h-0.5 bg-primary-600 rounded-full"></div>}
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
                                                <div className="bg-gray-50/30 border-t border-gray-100 p-2">
                                                    {/* Visit-specific Diagnosis Select */}
                                                    {(Array.from(new Set(visitOrders.map(o => o.diagnosis_name || o.diagnoses?.map(d => d.name || d.problem_name || d.icd10Code || d.icd10_code)).flat().filter(Boolean))).length > 0) && (
                                                        <div className="px-2 py-3 mb-2 flex flex-wrap gap-1.5 border-b border-gray-100">
                                                            {Array.from(new Set(visitOrders.map(o => o.diagnosis_name || o.diagnoses?.map(d => d.name || d.problem_name || d.icd10Code || d.icd10_code)).flat().filter(Boolean))).sort().map(dx => {
                                                                const visitDxOrders = visitOrders.filter(o => o.diagnosis_name === dx || o.diagnoses?.some(d => (d.name || d.problem_name || d.icd10Code || d.icd10_code) === dx));
                                                                const allDxInVisitSelected = visitDxOrders.every(o => selectedOrders.has(o.id));
                                                                return (
                                                                    <button
                                                                        key={dx}
                                                                        onClick={() => toggleVisitDiagnosisOrders(dx, visitOrders)}
                                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${allDxInVisitSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-primary-100 text-primary-700 hover:border-primary-300'}`}
                                                                    >
                                                                        {dx} ({visitDxOrders.length})
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <div className="space-y-1">
                                                        {visitOrders.map(order => renderOrderRow(order))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

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
                        <button
                            onClick={handlePrint}
                            disabled={selectedOrders.size === 0}
                            className={`px-6 py-2.5 text-sm font-bold text-white rounded-full shadow-lg shadow-primary-200 flex items-center gap-2 transition-all ${selectedOrders.size === 0 ? 'bg-gray-300 cursor-not-allowed grayscale' : 'bg-primary-600 hover:bg-primary-700 active:scale-95'}`}
                        >
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
