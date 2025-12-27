import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, Phone, Mail, MapPin, Stethoscope, CheckCircle2, CreditCard, Building2, Users, FilePlus, Receipt, DollarSign, Globe, Clock } from 'lucide-react';
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
            <div key={key} className="border-b-2 border-slate-100 pb-4 mb-4">
                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2 shadow-sm inline-block px-2 py-0.5 bg-slate-50 rounded">{title}</h2>
                <div className="text-[13px] text-slate-800 leading-relaxed font-medium">
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
                console.log('VisitChartView: Practice Data Loaded:', p);
                setClinicInfo({
                    name: p.practice_name || p.display_name || "myHEART Cardiology",
                    address: [p.address_line1, p.address_line2, `${p.city || ''} ${p.state || ''} ${p.zip || ''}`.trim()].filter(Boolean).join('\n') || "123 Medical Center Drive, Suite 100\nCity, State 12345",
                    phone: p.phone || "(555) 123-4567",
                    fax: p.fax || "(555) 123-4568",
                    email: p.email || "office@myheartclinic.com",
                    website: p.website || "www.myheartclinic.com",
                    logo: p.logo_url || "/clinic-logo.png"
                });
            } else {
                console.warn('VisitChartView: No practice data returned from API');
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

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-white py-8 px-12 max-w-5xl mx-auto print:!max-w-none print:!mx-0 print:!p-0 print:!rounded-none print:!w-full">
                        {/* Modern Clinic Header */}
                        <div className="mb-8 flex items-start justify-between gap-10 border-b border-slate-100 pb-8">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden p-2 flex-shrink-0">
                                    {clinicInfo.logo ? (
                                        <img
                                            src={clinicInfo.logo}
                                            alt="Logo"
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.innerHTML = '<div class="text-slate-300"><svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>';
                                            }}
                                        />
                                    ) : (
                                        <Building2 className="w-10 h-10 text-slate-300" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-bold text-slate-950 tracking-tight">{clinicInfo.name}</h1>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md whitespace-pre-line">{clinicInfo.address}</p>
                                    <div className="flex items-center gap-4 pt-1">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                            <Phone className="w-3.5 h-3.5 text-primary-500" />
                                            <span>{clinicInfo.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                            <Mail className="w-3.5 h-3.5 text-primary-500" />
                                            <span>{clinicInfo.email}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right space-y-2">
                                <div className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary-100">
                                    {visit.visit_type || 'Office Visit'}
                                </div>
                                <div className="text-sm text-slate-900 font-bold">{visitDate}</div>
                                <div className="text-xs text-slate-500 font-medium">{providerName}</div>
                                {signedDate && (
                                    <div className="flex items-center justify-end gap-1.5 text-emerald-600 text-[10px] font-bold uppercase tracking-tight">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Signed {signedDate}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Patient Snapshot Card */}
                        <div className="mb-10 bg-slate-50/50 rounded-3xl border border-slate-100 p-8">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Patient Information</span>
                                    <h2 className="text-3xl font-bold text-slate-950 tracking-tight">
                                        {patient.last_name}, {patient.first_name}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-8 text-sm">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">MRN</span>
                                        <span className="font-semibold text-slate-900">{patient.mrn}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Date of Birth</span>
                                        <span className="font-semibold text-slate-900">{patientDOB} ({patientAge}y)</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sex</span>
                                        <span className="font-semibold text-slate-900">{patient.sex || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 pt-8 border-t border-slate-200/60">
                                {[
                                    { label: 'Insurance', value: patient.insurance_provider, icon: CreditCard },
                                    { label: 'Pharmacy', value: patient.pharmacy_name, icon: Building2 },
                                    { label: 'Emergency Contact', value: patient.emergency_contact_name, icon: Users },
                                    { label: 'Primary Contact', value: formatPhone(patient.phone), icon: Phone },
                                    { label: 'Email Address', value: patient.email, icon: Mail },
                                    { label: 'Address', value: formatAddress(patient), icon: MapPin },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex gap-4">
                                        <div className="w-9 h-9 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center flex-shrink-0">
                                            <item.icon className="w-4 h-4 text-primary-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{item.label}</span>
                                            <p className="text-xs font-semibold text-slate-900 truncate" title={item.value}>{item.value || '—'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Clinical Content */}
                        <div className="space-y-8 px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                {renderSection('chiefComplaint', true, 'Chief Complaint',
                                    <p className="text-slate-900 leading-relaxed">{noteData.chiefComplaint || <span className="text-slate-400 italic font-normal">None recorded</span>}</p>
                                )}
                                {renderSection('vitals', true, 'Vital Signs',
                                    vitals && Object.keys(vitals).length > 0 ? (
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            {vitals.bp && <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">BP</span>
                                                <span className="font-bold text-slate-900">{vitals.bp}</span>
                                            </div>}
                                            {vitals.pulse && <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">HR</span>
                                                <span className="font-bold text-slate-900">{vitals.pulse}</span>
                                            </div>}
                                            {vitals.temp && <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Temp</span>
                                                <span className="font-bold text-slate-900">{vitals.temp}°F</span>
                                            </div>}
                                            {vitals.o2sat && <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">O2 Sat</span>
                                                <span className="font-bold text-slate-900">{vitals.o2sat}%</span>
                                            </div>}
                                        </div>
                                    ) : <span className="text-slate-400 italic font-normal">No vitals recorded</span>
                                )}
                            </div>

                            {renderSection('hpi', true, 'History of Present Illness',
                                <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">{noteData.hpi || <span className="text-slate-400 italic font-normal">No history recorded</span>}</div>
                            )}

                            {renderSection('ros', true, 'Review of Systems',
                                <div className="text-slate-900 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) || '<span class="text-slate-400 italic font-normal">No ROS recorded</span>' }} />
                            )}

                            {renderSection('physicalExam', true, 'Physical Examination',
                                <div className="text-slate-900 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) || '<span class="text-slate-400 italic font-normal">No PE recorded</span>' }} />
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-8 bg-slate-50/30 rounded-3xl border border-slate-100 px-8">
                                {renderSection('pastMedicalHistory', true, 'Active Problems',
                                    problems.length > 0 ? (
                                        <div className="space-y-2 mt-2">
                                            {problems.map((p, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0 h-4 mt-0.5">{p.icd10_code || '—'}</span>
                                                    <span className="text-xs font-semibold text-slate-800">{p.problem_name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <span className="text-slate-400 italic font-normal">None recorded</span>
                                )}
                                {renderSection('medications', true, 'Active Medications',
                                    medications.filter(m => m.active !== false).length > 0 ? (
                                        <div className="space-y-3 mt-2">
                                            {medications.filter(m => m.active !== false).map((m, i) => (
                                                <div key={i} className="space-y-0.5">
                                                    <div className="text-xs font-bold text-slate-900">{m.medication_name}</div>
                                                    <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">
                                                        {[m.dosage, m.frequency, m.route].filter(Boolean).join(' • ')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <span className="text-slate-400 italic font-normal">No active medications</span>
                                )}
                            </div>

                            {renderSection('assessment', true, 'Assessment',
                                <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">{noteData.assessment || <span className="text-slate-400 italic font-normal">No assessment recorded</span>}</div>
                            )}

                            {renderSection('plan', true, 'Plan & Recommendations',
                                noteData.planStructured?.length > 0 ? (
                                    <div className="space-y-6 mt-4">
                                        {noteData.planStructured.map((item, index) => (
                                            <div key={index} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex-shrink-0 w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                                                    <h4 className="text-sm font-bold text-slate-900">{item.diagnosis}</h4>
                                                </div>
                                                <ul className="ml-9 space-y-1.5 list-disc text-slate-700">
                                                    {item.orders.map((o, i) => <li key={i} className="text-xs font-medium pl-1 marker:text-primary-400">{o}</li>)}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : noteData.plan ? (
                                    <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">{noteData.plan}</div>
                                ) : <span className="text-slate-400 italic font-normal">No plan recorded</span>
                            )}

                            {(noteData.carePlan || noteData.followUp) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-slate-200/60">
                                    {renderSection('carePlan', noteData.carePlan, 'Patient Care Plan',
                                        <div className="text-slate-800 font-medium leading-relaxed">{noteData.carePlan}</div>
                                    )}
                                    {renderSection('followUp', noteData.followUp, 'Follow-Up',
                                        <div className="flex items-center gap-2 p-4 bg-primary-50 text-primary-800 rounded-2xl border border-primary-100 text-sm font-bold">
                                            <Calendar className="w-4 h-4" />
                                            {noteData.followUp}
                                        </div>
                                    )}
                                </div>
                            )}

                            {addendums.length > 0 && (
                                <div className="mt-12 pt-10 border-t-2 border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-950 mb-6">Note Addendums</h3>
                                    <div className="space-y-4">
                                        {addendums.map((a, i) => (
                                            <div key={i} className="bg-amber-50/50 border border-amber-100/80 p-6 rounded-3xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-1 bg-amber-200/30 rounded-bl-xl text-[8px] font-black text-amber-700 uppercase tracking-widest px-3">Addendum</div>
                                                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                                    <User className="w-3 h-3" />
                                                    <span>Added by {a.addedByName}</span>
                                                    <span className="mx-1">•</span>
                                                    <Clock className="w-3 h-3" />
                                                    <span>{format(new Date(a.addedAt), 'MM/dd/yyyy h:mm a')}</span>
                                                </div>
                                                <div className="text-sm font-medium text-slate-800 leading-relaxed">{a.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-16 pt-10 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <span>Note Validated & Signed By</span>
                                <span className="text-slate-900">{providerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <span>Clinical Documentation Platform</span>
                                <span className="text-slate-900">PageMD</span>
                            </div>
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
