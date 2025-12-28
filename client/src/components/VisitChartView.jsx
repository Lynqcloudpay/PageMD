import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, Phone, Mail, MapPin, Stethoscope, CheckCircle2, CreditCard, Building2, Users, FilePlus, Receipt, DollarSign, Globe, Clock, Heart, Activity, Thermometer, Wind } from 'lucide-react';
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
            <div key={key} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary-100/20 to-secondary-100/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
                        {title}
                    </h2>
                    <div className="text-slate-800 leading-relaxed">
                        {content}
                    </div>
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

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50/30 py-10 px-12 max-w-5xl mx-auto print:!max-w-none print:!mx-0 print:!p-0 print:!rounded-none print:!w-full relative">
                        {/* Soft Liquid Blobs (Hidden in Print) */}
                        <div className="absolute top-20 -left-20 w-72 h-72 bg-primary-100/30 rounded-full blur-[100px] pointer-events-none print:hidden"></div>
                        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-secondary-100/20 rounded-full blur-[120px] pointer-events-none print:hidden"></div>

                        {/* Compact Addendum Alert */}
                        {addendums.length > 0 && (
                            <div className="mb-8 bg-amber-50/60 backdrop-blur-md border border-amber-200/50 p-3 rounded-2xl flex items-center justify-center gap-3 animate-pulse shadow-sm">
                                <FilePlus className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-black text-amber-900 uppercase tracking-widest">Post-Signing Addendum Attached</span>
                            </div>
                        )}

                        {/* Elegant Glass Clinic Header */}
                        <div className="mb-10 flex items-start justify-between gap-8 relative z-10">
                            <div className="flex items-center gap-8">
                                <div className="w-24 h-24 bg-white/60 backdrop-blur-lg rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white flex items-center justify-center overflow-hidden p-3 flex-shrink-0 transition-transform hover:scale-105 duration-500">
                                    {clinicInfo.logo ? (
                                        <img
                                            src={clinicInfo.logo}
                                            alt="Logo"
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.innerHTML = '<div class="text-primary-200"><svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></div>';
                                            }}
                                        />
                                    ) : (
                                        <Building2 className="w-12 h-12 text-primary-200" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-black text-slate-950 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">{clinicInfo.name}</h1>
                                    <div className="space-y-1.5 text-[11px] font-bold text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary-400" />
                                            <span className="truncate max-w-[400px]">{clinicInfo.address.replace(/\n/g, ' • ')}</span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-primary-400" />
                                                <span>{clinicInfo.phone}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-primary-400" />
                                                <span className="lowercase">{clinicInfo.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2 pt-2">
                                <div className="px-4 py-1.5 bg-white/60 backdrop-blur-md border border-white text-slate-900 text-[10px] font-black uppercase tracking-[0.25em] rounded-full shadow-lg shadow-slate-200/50">
                                    {visit.visit_type || 'Office Visit'}
                                </div>
                                <div className="text-lg text-slate-950 font-black tracking-tight">{visitDate}</div>
                                <div className="text-[10px] text-primary-500 font-black uppercase tracking-[0.2em]">{providerName}</div>
                                {isSigned && (
                                    <div className="mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-black uppercase flex items-center gap-1 border border-emerald-100">
                                        <CheckCircle2 className="w-3 h-3" /> Signed
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Liquid Glass Patient Snapshot */}
                        <div className="mb-12 relative z-10">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/40 to-white/10 backdrop-blur-3xl rounded-[3rem] shadow-2xl shadow-primary-900/5 border border-white/80"></div>
                            <div className="relative p-10">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.4em] pl-1">Primary Patient</span>
                                        <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none">
                                            {patient.last_name}, {patient.first_name}
                                        </h2>
                                    </div>
                                    <div className="flex gap-12 border-l border-slate-100 pl-12">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">MRN Identifier</span>
                                            <span className="text-base font-black text-slate-900">{patient.mrn}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Born / Current Age</span>
                                            <span className="text-base font-black text-slate-900">{patientDOB} <span className="text-primary-400">({patientAge}y)</span></span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Sex</span>
                                            <span className="text-base font-black text-slate-900 uppercase">{(patient.sex || 'N/A').charAt(0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-10 pt-8 border-t border-slate-50 grid grid-cols-2 md:grid-cols-4 gap-8">
                                    {[
                                        { icon: CreditCard, label: 'Insurance', value: patient.insurance_provider || 'Self Pay' },
                                        { icon: Building2, label: 'Pharmacy', value: patient.pharmacy_name || 'None' },
                                        { icon: Phone, label: 'Contact', value: formatPhone(patient.phone) || 'N/A' },
                                        { icon: Users, label: 'Emergency', value: patient.emergency_contact_name || 'N/A' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex gap-4 items-start group">
                                            <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-all duration-500">
                                                <item.icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{item.label}</div>
                                                <div className="text-[11px] font-black text-slate-900 truncate tracking-tight">{item.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* All Clinical Sections (PAMFOS Included) */}
                        <div className="space-y-12 px-1 relative z-10">
                            {/* CC, HPI, ROS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {renderSection('chiefComplaint', true, 'Primary Concern',
                                    <p className="text-xl font-black text-slate-900 leading-tight bg-clip-text">
                                        {noteData.chiefComplaint || <span className="text-slate-300 font-normal italic">None recorded</span>}
                                    </p>
                                )}
                                {renderSection('hpi', true, 'Clinical Narrative',
                                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium text-sm">
                                        {noteData.hpi || <span className="text-slate-300 font-normal italic">No history recorded</span>}
                                    </div>
                                )}
                            </div>

                            {renderSection('ros', true, 'Systemic Review',
                                <div className="text-slate-700 leading-relaxed text-xs columns-2 md:columns-3 gap-10" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) || '<span class="text-slate-300 italic">No ROS findings documented</span>' }} />
                            )}

                            {/* PAMFOS Section */}
                            <div className="relative group p-10 bg-white/30 backdrop-blur-2xl rounded-[3.5rem] border border-white/60 shadow-xl">
                                <div className="flex items-center gap-4 mb-12">
                                    <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
                                        <Stethoscope className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-950 tracking-tighter">Clinical Background</h3>
                                        <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest pl-0.5">Comprehensive Health History</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                    <div className="space-y-12">
                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">P: Past Medical / Surgical</div>
                                            {problems.length > 0 ? (
                                                <div className="space-y-3">
                                                    {problems.map((p, i) => (
                                                        <div key={i} className="flex gap-4 items-center p-3 bg-white/40 rounded-2xl border border-white/60 hover:bg-white/60 transition-colors duration-300">
                                                            <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-lg min-w-[55px] text-center tracking-tighter">{p.icd10_code || 'N/A'}</span>
                                                            <span className="text-sm font-bold text-slate-800">{p.problem_name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <span className="text-slate-300 italic text-sm pl-1">No active chronic conditions</span>}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">A: Allergies & Intolerances</div>
                                            {allergies.length > 0 ? (
                                                <div className="flex flex-wrap gap-3">
                                                    {allergies.map((a, i) => (
                                                        <div key={i} className="px-4 py-2 bg-rose-50/50 backdrop-blur-sm border border-rose-100 rounded-2xl text-[11px] font-black text-rose-700 flex items-center gap-2 shadow-sm">
                                                            <span className="w-2 h-2 bg-rose-400 rounded-full shadow-inner" />
                                                            {a.allergen} {a.reaction && <span className="opacity-50 font-bold">• {a.reaction}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-wide bg-emerald-50/50 px-4 py-2 rounded-2xl border border-emerald-100/50 w-fit"><CheckCircle2 className="w-4 h-4" /> NKDA</div>}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">F: Family Pedigree</div>
                                            {familyHistory.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {familyHistory.map((h, i) => (
                                                        <div key={i} className="p-4 bg-white/40 rounded-2xl border border-white/60">
                                                            <div className="text-[8px] font-black text-primary-400 uppercase tracking-widest mb-1">{h.relationship}</div>
                                                            <div className="text-xs font-bold text-slate-900">{h.condition}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <span className="text-slate-300 italic text-sm pl-1">No significant family history</span>}
                                        </div>
                                    </div>

                                    <div className="space-y-12">
                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">M: Current Pharmacotherapy</div>
                                            {medications.filter(m => m.active !== false).length > 0 ? (
                                                <div className="space-y-4">
                                                    {medications.filter(m => m.active !== false).map((m, i) => (
                                                        <div key={i} className="p-5 bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-xl rounded-3xl border border-white/80 shadow-lg shadow-primary-900/5 group hover:scale-[1.02] transition-transform duration-300">
                                                            <div className="text-base font-black text-slate-950 flex justify-between items-center mb-1 bg-clip-text">
                                                                {m.medication_name}
                                                                <span className="text-[8px] font-black px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full uppercase tracking-widest">{m.route}</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter flex items-center gap-2">
                                                                {m.dosage} <span className="w-1 h-1 bg-primary-300 rounded-full" /> {m.frequency}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <span className="text-slate-300 italic text-sm pl-1">No active medications recorded</span>}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">O/S: Social & Environmental</div>
                                            {socialHistory ? (
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div className="bg-white/40 p-5 rounded-3xl border border-white/60 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Smoking Status</span>
                                                        <span className="text-xs font-bold text-slate-950 px-3 py-1 bg-slate-100/50 rounded-full">{socialHistory.smoking_status || "Unknown"}</span>
                                                    </div>
                                                    {socialHistory.occupation && (
                                                        <div className="bg-white/40 p-5 rounded-3xl border border-white/60 flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupation</span>
                                                            <span className="text-xs font-bold text-slate-950">{socialHistory.occupation}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-300 italic text-sm pl-1">No social history documented</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vitals & PE */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
                                <div className="md:col-span-1">
                                    {renderSection('vitals', true, 'Physiological Markers',
                                        vitals && Object.keys(vitals).length > 0 ? (
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'Blood Pressure', val: vitals.bp, icon: Heart, color: 'text-rose-400' },
                                                    { label: 'Heart Rate', val: vitals.pulse, unit: ' bpm', icon: Activity, color: 'text-rose-400' },
                                                    { label: 'Temperature', val: vitals.temp, unit: ' °F', icon: Thermometer, color: 'text-amber-400' },
                                                    { label: 'O2 Saturation', val: vitals.o2sat, unit: '%', icon: Wind, color: 'text-blue-400' },
                                                    { label: 'Resp Rate', val: vitals.resp, icon: Wind, color: 'text-slate-300' },
                                                    { label: 'BMI', val: vitals.bmi, icon: User, color: 'text-slate-300' }
                                                ].filter(v => v.val).map((v, i) => (
                                                    <div key={i} className="group p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 hover:bg-white/60 transition-all duration-300">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            {v.icon && <v.icon className={`w-3.5 h-3.5 ${v.color}`} />}
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{v.label}</span>
                                                        </div>
                                                        <div className="text-lg font-black text-slate-900 leading-none">{v.val}<span className="text-[10px] ml-0.5 text-slate-400">{v.unit}</span></div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <div className="text-sm text-slate-300 italic pl-1">Vitals not recorded</div>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    {renderSection('physicalExam', true, 'Objective Findings',
                                        <div className="text-slate-700 leading-relaxed text-sm bg-white/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white min-h-[400px] shadow-sm" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) || '<div class="flex flex-col items-center justify-center h-full text-slate-300 italic p-12 text-center border-2 border-dashed border-white/60 rounded-[2rem]">Formal physical examination observations not documented in detail.</div>' }} />
                                    )}
                                </div>
                            </div>

                            {/* Assessment & Plan */}
                            <div className="space-y-12 pt-8 relative z-10">
                                {renderSection('assessment', true, 'Synthesized Assessment',
                                    <div className="text-slate-950 font-black text-2xl leading-snug tracking-tight">
                                        {noteData.assessment || <span className="text-slate-300 font-normal italic text-lg">No clinical assessment provided.</span>}
                                    </div>
                                )}

                                {renderSection('plan', true, 'Therapeutic Strategy',
                                    noteData.planStructured?.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {noteData.planStructured.map((item, index) => (
                                                <div key={index} className="space-y-4 bg-white/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white hover:bg-white/60 transition-all duration-300 shadow-sm relative overflow-hidden group">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-110 transition-transform">{index + 1}</span>
                                                        <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{item.diagnosis}</h4>
                                                    </div>
                                                    <ul className="space-y-3 list-none pl-1">
                                                        {item.orders.map((o, i) => (
                                                            <li key={i} className="text-xs font-bold text-slate-600 flex items-start gap-2.5">
                                                                <span className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-1 flex-shrink-0" />
                                                                {o}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-slate-700 leading-relaxed text-sm">
                                            {noteData.plan || <span className="text-slate-300 italic">No specific plan documented.</span>}
                                        </div>
                                    )
                                )}

                                {/* Care Plan & Follow-up */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10">
                                    {renderSection('carePlan', patient.care_plan_summary, 'Collaborative Care Plan',
                                        <div className="text-slate-600 text-xs leading-relaxed italic pr-4">
                                            {patient.care_plan_summary}
                                        </div>
                                    )}
                                    {renderSection('followUp', visit.follow_up_instructions, 'Clinical Continuity',
                                        <div className="flex items-center gap-6 p-6 bg-primary-500/10 backdrop-blur-xl rounded-3xl border border-primary-100">
                                            <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary-200">
                                                <Calendar className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-1">Follow-up Target</div>
                                                <div className="text-lg font-black text-primary-600 leading-none">{visit.follow_up_instructions || 'PRN'}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Addendums Section */}
                            {addendums.length > 0 && (
                                <div className="mt-28 relative">
                                    <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                                    <div className="flex items-center gap-5 mb-12">
                                        <div className="w-16 h-16 bg-amber-50 rounded-[2rem] flex items-center justify-center border border-amber-100/50 shadow-lg shadow-amber-900/5">
                                            <FilePlus className="w-8 h-8 text-amber-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black text-slate-950 tracking-tighter uppercase">Clinical Addendums</h3>
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.4em] pl-1">Authenticated Narrative Updates</p>
                                        </div>
                                    </div>
                                    <div className="space-y-10">
                                        {addendums.map((a, i) => (
                                            <div key={i} className="group relative bg-white/40 backdrop-blur-2xl border border-white p-12 rounded-[3.5rem] shadow-sm hover:bg-white/60 transition-all duration-700">
                                                <div className="flex items-center gap-5 mb-10">
                                                    <div className="w-14 h-14 bg-slate-950 rounded-[1.5rem] flex items-center justify-center text-white font-black text-lg italic shadow-xl group-hover:scale-110 transition-transform">
                                                        {a.addedByName?.charAt(0) || 'A'}
                                                    </div>
                                                    <div>
                                                        <div className="text-lg font-black text-slate-900 tracking-tight">{a.addedByName}</div>
                                                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-100">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {format(new Date(a.addedAt), 'MMMM dd, yyyy • h:mm a')}
                                                            </div>
                                                            <span className="text-amber-500">Official Addendum #{i + 1}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-lg font-medium text-slate-700 leading-relaxed whitespace-pre-wrap pl-8 border-l-4 border-amber-400/30">
                                                    {a.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Professional Signature Footer */}
                        <div className="mt-32 pt-16 border-t border-slate-100 flex items-center justify-between relative">
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-200/30 to-transparent"></div>
                            <div className="space-y-6">
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">Provider Attestation</div>
                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-primary-400/20 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative w-20 h-20 bg-slate-950 rounded-[2.5rem] flex items-center justify-center text-white font-black text-3xl italic border-8 border-white shadow-2xl shadow-primary-900/10">
                                            {providerName.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-2xl font-black text-slate-950 tracking-tighter leading-none">{providerName}</div>
                                        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border border-emerald-100/50 shadow-sm">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            Authenticated Digital Signature
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right space-y-3 opacity-30 group">
                                <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">
                                    <span>Cloud Informatics by</span>
                                    <span className="px-2 py-1 bg-slate-950 text-white rounded-lg text-[9px] tracking-widest shadow-lg">PageMD</span>
                                </div>
                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-tight">Verified Electronic Transition • v2.4.9-Stable</div>
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

            {
                showBillingModal && (
                    <BillingModal patientId={patientId} visitId={visitId} isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />
                )
            }
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
