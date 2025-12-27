import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, Phone, Mail, MapPin, Stethoscope, CheckCircle2, CreditCard, Building2, Users, FilePlus, Receipt, DollarSign, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI, billingAPI, codesAPI, superbillsAPI, settingsAPI } from '../services/api';
import { format } from 'date-fns';

const VisitChartView = ({ visitId, patientId, onClose }) => {
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [visit, setVisit] = useState(null);
    const [allergies, setAllergies] = useState([]);
    const [medications, setMedications] = useState([]);
    const [problems, setProblems] = useState([]);
    const [familyHistory, setFamilyHistory] = useState([]);
    const [socialHistory, setSocialHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [vitals, setVitals] = useState(null);
    const [noteData, setNoteData] = useState({
        chiefComplaint: '', hpi: '', rosNotes: '', peNotes: '', assessment: '', plan: '', planStructured: []
    });
    const [addendums, setAddendums] = useState([]);
    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [addendumText, setAddendumText] = useState('');
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [feeSchedule, setFeeSchedule] = useState([]);
    const [clinicInfo, setClinicInfo] = useState({
        name: "myHEART Cardiology",
        address: "123 Medical Center Drive, Suite 100\nCity, State 12345",
        phone: "(555) 123-4567",
        fax: "(555) 123-4568",
        email: "office@myheartclinic.com",
        website: "www.myheartclinic.com",
        logo: "/clinic-logo.png"
    });

    useEffect(() => {
        if (visitId && patientId) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId, patientId]);

    const decodeHtmlEntities = (text) => {
        if (!text) return '';
        return text
            .replace(/&amp;#x2F;/g, '/')
            .replace(/&#x2F;/g, '/')
            .replace(/&#47;/g, '/')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    };

    const formatMarkdownBold = (text) => {
        if (!text) return '';
        return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    };

    // Format phone number to (xxx) xxx-xxxx
    const formatPhone = (phone) => {
        if (!phone) return null;
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    // Format full address for display
    const formatAddress = (patient) => {
        if (!patient) return 'Not provided';
        const parts = [];
        if (patient.address_line1) parts.push(patient.address_line1);
        if (patient.city) parts.push(patient.city);
        if (patient.state) parts.push(patient.state);
        if (patient.zip) parts.push(patient.zip);
        return parts.length > 0 ? parts.join(', ') : 'Not provided';
    };

    const parseNoteText = (text) => {
        if (!text || !text.trim()) return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        const decodedText = decodeHtmlEntities(text);

        // Parse Chief Complaint
        const chiefComplaintMatch = decodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const chiefComplaint = chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '';

        // Parse HPI
        const hpiMatch = decodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const hpi = hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '';

        // Parse ROS
        const rosMatch = decodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
        const rosNotes = rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '';

        // Parse Physical Exam
        const peMatch = decodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
        const peNotes = peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '';

        // Parse Assessment - capture ALL content from Assessment: until Plan: or end
        let assessment = '';
        const assessmentIndex = decodedText.search(/(?:Assessment|A):\s*/i);
        if (assessmentIndex !== -1) {
            const afterAssessment = decodedText.substring(assessmentIndex);
            const planStart = afterAssessment.search(/\n\n(?:Plan|P):|\n(?:Plan|P):/i);
            if (planStart !== -1) {
                const assessmentWithHeader = afterAssessment.substring(0, planStart);
                assessment = assessmentWithHeader.replace(/(?:Assessment|A):\s*/i, '').trim();
            } else {
                assessment = afterAssessment.replace(/(?:Assessment|A):\s*/i, '').trim();
            }
        }

        // Parse Plan
        let plan = '';
        const planIndex = decodedText.search(/(?:Plan|P):\s*/i);
        if (planIndex !== -1) {
            const afterPlan = decodedText.substring(planIndex);
            let planContent = afterPlan.replace(/(?:Plan|P):\s*/i, '');
            const carePlanIndex = planContent.search(/\n\n(?:Care Plan|CP):|\n(?:Care Plan|CP):/i);
            if (carePlanIndex !== -1) {
                planContent = planContent.substring(0, carePlanIndex);
            } else {
                const followUpIndex = planContent.search(/\n\n(?:Follow Up|FU):|\n(?:Follow Up|FU):/i);
                if (followUpIndex !== -1) {
                    planContent = planContent.substring(0, followUpIndex);
                }
            }
            plan = planContent.trim();
        }

        // Parse Care Plan
        const carePlanMatch = decodedText.match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|\n(?:Follow Up|FU):|$)/is);
        const carePlan = carePlanMatch ? decodeHtmlEntities(carePlanMatch[1].trim()) : '';

        // Parse Follow Up
        const followUpMatch = decodedText.match(/(?:Follow Up|FU):\s*(.+?)(?:\n\n|$)/is);
        const followUp = followUpMatch ? decodeHtmlEntities(followUpMatch[1].trim()) : '';

        return {
            chiefComplaint, hpi, rosNotes, peNotes,
            assessment: decodeHtmlEntities(assessment),
            plan: decodeHtmlEntities(plan),
            carePlan, followUp
        };
    };

    const parsePlanText = (planText) => {
        if (!planText || !planText.trim()) return [];
        const structured = [];
        const lines = planText.split('\n');
        let currentDiagnosis = null;
        let currentOrders = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const diagnosisMatch = line.match(/^(\d+)\.\s*(.+)$/);
            if (diagnosisMatch) {
                if (currentDiagnosis) {
                    structured.push({ diagnosis: currentDiagnosis, orders: [...currentOrders] });
                }
                currentDiagnosis = diagnosisMatch[2].trim();
                currentOrders = [];
            } else if (line.startsWith('•') || line.startsWith('-')) {
                const orderText = line.replace(/^[•\-]\s*/, '').trim();
                if (orderText && currentDiagnosis) {
                    currentOrders.push(orderText);
                }
            } else if (line && currentDiagnosis) {
                currentOrders.push(line);
            }
        }
        if (currentDiagnosis) {
            structured.push({ diagnosis: currentDiagnosis, orders: currentOrders });
        }
        return structured;
    };

    const calculateAge = (dob) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const renderSection = (key, condition, title, content) => {
        if (!condition) return null;
        return (
            <div key={key} className="border-b border-gray-200 pb-3 rounded-lg">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide mb-3">{title}</h2>
                <div className="text-xs">
                    {content}
                </div>
            </div>
        );
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [patientRes, visitRes, allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes, practiceRes] = await Promise.all([
                patientsAPI.get(patientId),
                visitsAPI.get(visitId),
                patientsAPI.getAllergies(patientId).catch(() => ({ data: [] })),
                patientsAPI.getMedications(patientId).catch(() => ({ data: [] })),
                patientsAPI.getProblems(patientId).catch(() => ({ data: [] })),
                patientsAPI.getFamilyHistory(patientId).catch(() => ({ data: [] })),
                patientsAPI.getSocialHistory(patientId).catch(() => ({ data: null })),
                settingsAPI.getPractice().catch(() => ({ data: null }))
            ]);

            setPatient(patientRes.data);
            setVisit(visitRes.data);
            setAllergies(allergiesRes.data || []);
            setMedications(medicationsRes.data || []);
            setProblems(problemsRes.data || []);
            setFamilyHistory(familyHistoryRes.data || []);
            setSocialHistory(socialHistoryRes.data);

            if (practiceRes?.data) {
                const p = practiceRes.data;
                setClinicInfo({
                    name: p.practice_name || "myHEART Cardiology",
                    address: [p.address_line1, p.address_line2, `${p.city || ''} ${p.state || ''} ${p.zip || ''}`.trim()].filter(Boolean).join('\n') || "123 Medical Center Drive, Suite 100\nCity, State 12345",
                    phone: p.phone || "(555) 123-4567",
                    fax: p.fax || "(555) 123-4568",
                    email: p.email || "office@myheartclinic.com",
                    website: p.website || "www.myheartclinic.com",
                    logo: p.logo_url || "/clinic-logo.png"
                });
            }

            if (visitRes.data.addendums) {
                setAddendums(Array.isArray(visitRes.data.addendums) ? visitRes.data.addendums : JSON.parse(visitRes.data.addendums || '[]'));
            } else {
                setAddendums([]);
            }

            try {
                const feeScheduleRes = await billingAPI.getFeeSchedule();
                setFeeSchedule(feeScheduleRes.data || []);
            } catch (error) {
                console.error('Error fetching fee schedule:', error);
            }

            // Parse vitals
            if (visitRes.data.vitals) {
                let v = visitRes.data.vitals;
                if (typeof v === 'string') {
                    try { v = JSON.parse(v); } catch (e) { v = null; }
                }
                if (v && typeof v === 'object') {
                    const decodedVitals = {};
                    Object.keys(v).forEach(key => {
                        let value = v[key];
                        if (typeof value === 'string') {
                            value = value.replace(/&#x2F;/g, '/').replace(/&#47;/g, '/').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                        }
                        decodedVitals[key] = value;
                    });
                    setVitals(decodedVitals);
                } else {
                    setVitals(null);
                }
            } else {
                setVitals(null);
            }

            if (visitRes.data.note_draft) {
                const parsed = parseNoteText(visitRes.data.note_draft);
                const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                setNoteData({
                    ...parsed,
                    planStructured: planStructured.length > 0 ? planStructured : []
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const visitChartView = document.getElementById('visit-chart-view');
        if (!visitChartView) {
            alert('Error: Could not find content to print');
            return;
        }

        // Create a hidden iframe for printing if it doesn't exist
        let printIframe = document.getElementById('print-iframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'print-iframe';
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
        pri.document.write(`
            <html>
                <head>
                    <title>Visit Note - ${patient?.first_name} ${patient?.last_name}</title>
                    ${Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('')}
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                        
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            padding: 0;
                            margin: 0;
                            background-color: white;
                            color: black;
                            width: 100%;
                        }

                        #visit-chart-view {
                            display: block !important;
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                            padding: 20px !important;
                            box-shadow: none !important;
                            overflow: visible !important;
                            height: auto !important;
                            position: static !important;
                        }
                        
                        /* Fix for blank canvas - ensure content is visible */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                        }

                        button, .no-print, [role="button"], .print-hidden, .modal-close {
                            display: none !important;
                        }

                        @page {
                            size: letter portrait;
                            margin: 0.5in;
                        }
                    </style>
                </head>
                <body>
                    ${visitChartView.outerHTML}
                </body>
            </html>
        `);
        pri.document.close();

        // Increased timeout to ensure styles and images (like logo) are loaded
        setTimeout(() => {
            pri.focus();
            try {
                pri.print();
            } catch (e) {
                console.error('Print failed', e);
            }
        }, 1000);
    };

    const handleAddAddendum = async () => {
        if (!addendumText.trim()) {
            alert('Please enter addendum text');
            return;
        }
        try {
            await visitsAPI.addAddendum(visitId, addendumText);
            const visitRes = await visitsAPI.get(visitId);
            if (visitRes.data.addendums) {
                setAddendums(Array.isArray(visitRes.data.addendums) ? visitRes.data.addendums : JSON.parse(visitRes.data.addendums || '[]'));
            }
            setAddendumText('');
            setShowAddendumModal(false);
            alert('Addendum added successfully');
        } catch (error) {
            console.error('Error adding addendum:', error);
            alert('Failed to add addendum');
        }
    };

    const handleCreateSuperbill = async () => {
        console.log('handleCreateSuperbill called in VisitChartView');
        console.log('Type of navigate:', typeof navigate);
        try {
            const response = await superbillsAPI.fromVisit(visitId);
            const sbId = response.data.id;
            onClose(); // Close the modal
            navigate(`/patient/${patientId}/superbill/${sbId}`);
        } catch (error) {
            console.error('Error creating superbill:', error);
            alert('Failed to create superbill: ' + (error.response?.data?.error || error.message));
        }
    };

    const isSigned = visit?.note_signed_at || visit?.locked;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6">Loading visit...</div>
            </div>
        );
    }

    if (!visit || !patient) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6">
                    <p>Visit not found</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 text-white rounded">Close</button>
                </div>
            </div>
        );
    }

    const visitDate = visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
    const providerName = visit.provider_first_name && visit.provider_last_name ? `${visit.provider_first_name} ${visit.provider_last_name}` : 'Provider';
    const patientAge = calculateAge(patient.dob);
    const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : '';
    const signedDate = visit.note_signed_at ? format(new Date(visit.note_signed_at), 'MM/dd/yyyy h:mm a') : '';

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden" id="modal-overlay">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:w-full print:overflow-visible">
                    <div className="p-4 border-b border-deep-gray/10 flex items-center justify-between print-hidden bg-gradient-to-r from-white to-soft-gray/30">
                        <h2 className="text-xl font-bold text-deep-gray">Visit Chart View</h2>
                        <div className="flex items-center gap-2">
                            {isSigned && (
                                <button onClick={() => setShowAddendumModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 rounded-lg">
                                    <FilePlus className="w-3.5 h-3.5" />
                                    <span>Addendum</span>
                                </button>
                            )}
                            <button onClick={handleCreateSuperbill} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 rounded-lg">
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Superbill</span>
                            </button>
                            <button onClick={() => setShowBillingModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 rounded-lg">
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Billing</span>
                            </button>
                            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 rounded-lg">
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                            </button>
                            <button onClick={onClose} className="flex items-center justify-center w-8 h-8 text-deep-gray/70 hover:text-deep-gray hover:bg-deep-gray/5 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-white py-6 px-10 max-w-5xl mx-auto rounded-2xl print:!max-w-none print:!mx-0 print:!p-0 print:!rounded-none print:!w-full">
                        {/* Dynamic Clinical Header */}
                        <div className="mb-8 border-b-2 border-slate-200 pb-6">
                            <div className="flex items-start justify-between gap-6">
                                {/* Left: Clinic Identity & Demographics */}
                                <div className="flex items-start gap-6 flex-1">
                                    <div className="flex-shrink-0 w-28 h-28 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden border border-slate-100 p-2">
                                        {clinicInfo.logo ? (
                                            <img
                                                src={clinicInfo.logo}
                                                alt="Clinic Logo"
                                                className="max-w-full max-h-full object-contain"
                                                onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <Building2 className="w-10 h-10 text-slate-300" />
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <h1 className="text-xl font-bold text-slate-900 mb-2 leading-tight">
                                            {clinicInfo.name}
                                        </h1>
                                        <div className="grid grid-cols-1 gap-y-1 text-[11px] text-slate-500 font-medium">
                                            <div className="text-slate-600 whitespace-pre-line">
                                                {clinicInfo.address}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                                {clinicInfo.phone && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        <span className="text-slate-700">{clinicInfo.phone}</span>
                                                    </div>
                                                )}
                                                {clinicInfo.fax && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-slate-400 font-bold">FAX</span>
                                                        <span className="text-slate-700">{clinicInfo.fax}</span>
                                                    </div>
                                                )}
                                                {clinicInfo.email && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="w-3 h-3 text-slate-400" />
                                                        <span className="text-slate-700">{clinicInfo.email}</span>
                                                    </div>
                                                )}
                                                {clinicInfo.website && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="w-3 h-3 text-slate-400" />
                                                        <span className="text-primary-600 hover:underline cursor-pointer">{clinicInfo.website}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Visit Information */}
                                <div className="flex-shrink-0 text-right border-l-2 border-slate-100 pl-8 min-w-[200px]">
                                    <div className="text-base font-bold text-primary-600 mb-2 uppercase tracking-wide">
                                        {visit.visit_type || 'Office Visit'}
                                    </div>
                                    <div className="space-y-1.5 mb-4">
                                        <div className="text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">Date:</span> {visitDate}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">Provider:</span> {providerName}
                                        </div>
                                    </div>

                                    {signedDate && (
                                        <div className="inline-flex flex-col items-end">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px]">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="font-bold text-emerald-700">SIGNED</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400 mt-1 font-medium">{signedDate}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Patient Information Section */}
                        <div className="mb-10 px-8 py-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                <div className="flex-1">
                                    <h2 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight mb-2">
                                        {patient.last_name}, {patient.first_name}
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 min-w-[32px]">MRN</span>
                                            <span className="text-slate-900">{patient.mrn}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 min-w-[32px]">DOB</span>
                                            <span className="text-slate-900">{patientDOB} <span className="text-slate-400 font-normal ml-1">({patientAge}y)</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 min-w-[32px]">SEX</span>
                                            <span className="text-slate-900">{patient.sex || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 pt-6 border-t border-slate-200/80">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Phone className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800">{formatPhone(patient.phone) || '—'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Mail className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800 truncate" title={patient.email}>{patient.email || '—'}</div>
                                </div>
                                <div className="col-span-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <MapPin className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800 leading-snug">{formatAddress(patient)}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <CreditCard className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Insurance</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800">{patient.insurance_provider || '—'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Building2 className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pharmacy</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800">{patient.pharmacy_name || '—'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Users className="w-3.5 h-3.5 text-primary-600" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emergency</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800">{patient.emergency_contact_name || '—'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 bg-white">
                            {renderSection('chiefComplaint', true, 'Chief Complaint', noteData.chiefComplaint ? <p className="text-xs text-gray-800 leading-relaxed">{noteData.chiefComplaint}</p> : <p className="text-xs text-gray-500 italic">No chief complaint recorded</p>)}
                            {renderSection('hpi', true, 'History of Present Illness', noteData.hpi ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.hpi}</p> : <p className="text-xs text-gray-500 italic">No history of present illness recorded</p>)}
                            {renderSection('ros', true, 'Review of Systems', noteData.rosNotes ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} /> : <p className="text-xs text-gray-500 italic">No review of systems recorded</p>)}

                            <div className="border-t-2 border-gray-300 pt-4 mt-4">
                                <div className="space-y-3">
                                    {renderSection('pastMedicalHistory', true, 'Past Medical History', problems.length > 0 ? <div className="text-xs text-gray-700 space-y-1">{problems.map((p, i) => <div key={i} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0">{p.icd10_code && <span className="font-semibold">{p.icd10_code} - </span>}{p.problem_name}</div>)}</div> : <p className="text-xs text-gray-500 italic">No past medical history recorded</p>)}
                                    {renderSection('medications', true, 'Current Medications', medications.filter(m => m.active !== false).length > 0 ? <div className="text-xs text-gray-700 space-y-2">{medications.filter(m => m.active !== false).map((m, i) => <div key={i} className="pb-2 border-b border-gray-200 last:border-0 last:pb-0"><div className="font-semibold text-gray-900">{m.medication_name}</div><div className="text-gray-600 text-[10px] space-y-0">{m.dosage && <div>Dose: {m.dosage}</div>}{m.frequency && <div>Frequency: {m.frequency}</div>}{m.route && <div>Route: {m.route}</div>}</div></div>)}</div> : <p className="text-xs text-gray-500 italic">No current medications</p>)}
                                    {renderSection('allergies', true, 'Allergies', allergies.length > 0 ? <div className="text-xs text-gray-700 space-y-1">{allergies.map((a, i) => <div key={i} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0"><span className="font-semibold">{a.allergen}</span>{a.reaction && <div className="text-gray-600 text-[10px]">{a.reaction}</div>}</div>)}</div> : <p className="text-xs text-gray-500 italic">No known allergies</p>)}
                                    {renderSection('familyHistory', true, 'Family History', familyHistory.length > 0 ? <div className="text-xs text-gray-700 space-y-1">{familyHistory.map((h, i) => <div key={i} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0"><span className="font-semibold">{h.condition}</span>{h.relationship && <div className="text-gray-600 text-[10px]">{h.relationship}</div>}</div>)}</div> : <p className="text-xs text-gray-500 italic">No family history recorded</p>)}
                                    {renderSection('socialHistory', true, 'Social History', socialHistory ? <div className="text-xs text-gray-700 space-y-1">{socialHistory.smoking_status && <div>Smoking: {socialHistory.smoking_status}</div>}{socialHistory.alcohol_use && <div>Alcohol: {socialHistory.alcohol_use}</div>}{socialHistory.occupation && <div>Occupation: {socialHistory.occupation}</div>}</div> : <p className="text-xs text-gray-500 italic">No social history recorded</p>)}
                                </div>
                            </div>

                            {renderSection('vitals', true, 'Vital Signs', vitals && Object.keys(vitals).length > 0 ? <div className="grid grid-cols-4 gap-2 text-xs text-gray-700">{vitals.bp && <div>BP: {vitals.bp}</div>}{vitals.pulse && <div>HR: {vitals.pulse}</div>}{vitals.temp && <div>Temp: {vitals.temp}</div>}{vitals.resp && <div>RR: {vitals.resp}</div>}{vitals.o2sat && <div>O2: {vitals.o2sat}%</div>}{vitals.weight && <div>Wt: {vitals.weight}</div>}{vitals.height && <div>Ht: {vitals.height}</div>}{vitals.bmi && <div>BMI: {vitals.bmi}</div>}</div> : <p className="text-xs text-gray-500 italic">No vital signs recorded</p>)}
                            {renderSection('physicalExam', true, 'Physical Examination', noteData.peNotes ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} /> : <p className="text-xs text-gray-500 italic">No physical examination recorded</p>)}
                            {renderSection('assessment', true, 'Assessment', noteData.assessment ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.assessment}</p> : <p className="text-xs text-gray-500 italic">No assessment recorded</p>)}

                            {renderSection('plan', true, 'Plan', noteData.planStructured?.length > 0 ? <div className="text-xs text-gray-700 space-y-2">{noteData.planStructured.map((item, index) => <div key={index} className="pb-2 border-b border-gray-200 last:border-0 last:pb-0"><div className="font-bold underline mb-1">{index + 1}. {item.diagnosis}</div><ul className="ml-4 space-y-0 text-gray-600">{item.orders.map((o, i) => <li key={i}>{o}</li>)}</ul></div>)}</div> : noteData.plan ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.plan}</p> : <p className="text-xs text-gray-500 italic">No plan recorded</p>)}

                            {renderSection('carePlan', true, 'Care Plan', noteData.carePlan ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.carePlan}</p> : null)}
                            {renderSection('followUp', true, 'Follow Up', noteData.followUp ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.followUp}</p> : null)}
                        </div>

                        {addendums.length > 0 && <div className="mt-6 pt-4 border-t-2 border-gray-300">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Addendums</h3>
                            <div className="space-y-3">{addendums.map((a, i) => <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                <div className="text-xs text-gray-600 mb-1">Added by {a.addedByName} on {format(new Date(a.addedAt), 'MM/dd/yyyy h:mm a')}</div>
                                <div className="text-xs text-gray-900 whitespace-pre-wrap">{a.text}</div>
                            </div>)}</div>
                        </div>}

                        <div className="mt-6 pt-4 border-t-2 border-gray-300">
                            {signedDate && <div className="mb-3 text-xs text-gray-700 font-semibold">Signed by: {providerName} | Date/Time: {signedDate}</div>}
                            <div className="flex items-center justify-end gap-2 text-[10px] text-gray-400 opacity-60"><span>Generated by</span><span className="font-semibold text-gray-500">PageMD</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {showAddendumModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddendumModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Add Addendum</h3><button onClick={() => setShowAddendumModal(false)}><X className="w-5 h-5" /></button></div>
                        <textarea value={addendumText} onChange={(e) => setAddendumText(e.target.value)} className="w-full h-32 border rounded p-2" placeholder="Enter addendum text..." />
                        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowAddendumModal(false)} className="px-4 py-2 border rounded">Cancel</button><button onClick={handleAddAddendum} className="px-4 py-2 bg-blue-600 text-white rounded">Add</button></div>
                    </div>
                </div>
            )}

            {showBillingModal && (
                <BillingModal patientId={patientId} visitId={visitId} isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />
            )}
        </>
    );
};

const BillingModal = ({ patientId, visitId, isOpen, onClose }) => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && patientId) {
            billingAPI.getClaimsByPatient(patientId).then(res => setClaims(res.data || [])).catch(console.error).finally(() => setLoading(false));
        }
    }, [isOpen, patientId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Billing & Claims</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div>
                {loading ? <div>Loading...</div> : claims.length === 0 ? <div>No claims found</div> : <div className="space-y-4">{claims.map((c, i) => <div key={i} className="border p-4 rounded flex justify-between"><div>{c.visit_type} - {format(new Date(c.visit_date), 'MM/dd/yyyy')} ({c.status})</div><div className="font-bold">${c.total_amount}</div></div>)}</div>}
            </div>
        </div>
    );
};

export default VisitChartView;
