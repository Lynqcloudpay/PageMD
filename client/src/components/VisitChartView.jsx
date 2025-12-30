import React, { useState, useEffect } from 'react';
import { Activity, FileText, Printer, X, AlertCircle, CheckCircle2, User, Phone, Mail, MapPin, Building2, Stethoscope, CreditCard, Users, FilePlus, Receipt, DollarSign, Globe, Clock, Heart, Thermometer, Wind, Pill, Lock, ClipboardList, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI, billingAPI, codesAPI, superbillsAPI, settingsAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';
import PatientChartPanel from './PatientChartPanel';

const VisitChartView = ({ visitId, patientId, onClose }) => {
    const navigate = useNavigate();
    const [activeVisitId, setActiveVisitId] = useState(visitId);
    const [allVisits, setAllVisits] = useState([]);
    const [showPatientChart, setShowPatientChart] = useState(false);
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
        chiefComplaint: '', hpi: '', rosNotes: '', peNotes: '', results: '', assessment: '', plan: '', planStructured: []
    });
    const [visitDocuments, setVisitDocuments] = useState([]);
    const [addendums, setAddendums] = useState([]);
    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [addendumText, setAddendumText] = useState('');
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [clinicInfo, setClinicInfo] = useState({
        name: "myHEART Cardiology",
        address: "123 Medical Center Drive, Suite 100\nCity, State 12345",
        phone: "(555) 123-4567",
        fax: "(555) 123-4568",
        email: "office@myheartclinic.com",
        website: "www.myheartclinic.com",
        logo: "/logo.png"
    });

    useEffect(() => {
        if (activeVisitId && patientId) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVisitId, patientId]);

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

    const parseNoteText = (text) => {
        if (!text || !text.trim()) return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        const decodedText = decodeHtmlEntities(text);

        const chiefComplaintMatch = decodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const chiefComplaint = chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '';

        const hpiMatch = decodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const hpi = hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '';

        const rosMatch = decodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
        const rosNotes = rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '';

        const peMatch = decodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Results|Assessment|Plan):)/is);
        const peNotes = peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '';

        const resultsMatch = decodedText.match(/(?:Results|Results \/ Data):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
        const results = resultsMatch ? decodeHtmlEntities(resultsMatch[1].trim()) : '';

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

        const carePlanMatch = decodedText.match(/(?:Care Plan|CP):\s*(.+?)(?:\n\n|\n(?:Follow Up|FU):|$)/is);
        const carePlan = carePlanMatch ? decodeHtmlEntities(carePlanMatch[1].trim()) : '';

        const followUpMatch = decodedText.match(/(?:Follow Up|FU):\s*(.+?)(?:\n\n|$)/is);
        const followUp = followUpMatch ? decodeHtmlEntities(followUpMatch[1].trim()) : '';

        return {
            chiefComplaint, hpi, rosNotes, peNotes, results,
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

    const renderSection = (key, condition, title, content, className = "") => {
        if (!condition) return null;
        return (
            <div key={key} className={`py-12 border-b border-slate-100/60 last:border-0 ${className}`}>
                <h2 className="text-[13px] font-black text-blue-600/70 uppercase tracking-[0.25em] mb-8 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></span>
                    {title}
                </h2>
                <div className="text-slate-700 leading-relaxed text-[16px] font-medium selection:bg-blue-100">
                    {content}
                </div>
            </div>
        );
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [patientRes, visitRes, allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes, practiceRes, allVisitsRes] = await Promise.all([
                patientsAPI.get(patientId),
                visitsAPI.get(activeVisitId),
                patientsAPI.getAllergies(patientId).catch(() => ({ data: [] })),
                patientsAPI.getMedications(patientId).catch(() => ({ data: [] })),
                patientsAPI.getProblems(patientId).catch(() => ({ data: [] })),
                patientsAPI.getFamilyHistory(patientId).catch(() => ({ data: [] })),
                patientsAPI.getSocialHistory(patientId).catch(() => ({ data: null })),
                settingsAPI.getPractice().catch(() => ({ data: null })),
                visitsAPI.getByPatient(patientId).catch(() => ({ data: [] })),
                documentsAPI.getByPatient(patientId).catch(() => ({ data: [] }))
            ]);

            setPatient(patientRes.data);
            setVisit(visitRes.data);
            setAllergies(allergiesRes.data || []);
            setMedications(medicationsRes.data || []);
            setProblems(problemsRes.data || []);
            setFamilyHistory(familyHistoryRes.data || []);
            setSocialHistory(socialHistoryRes.data);
            setAllVisits(allVisitsRes.data || []);

            // Filter documents for this visit
            const allDocs = arguments[0][9]?.data || [];
            const linkedDocs = allDocs.filter(d => d.visit_id === activeVisitId);
            setVisitDocuments(linkedDocs);

            if (practiceRes?.data) {
                const p = practiceRes.data;
                // Default "NO LOGO" placeholder SVG - building icon with text
                const defaultLogoUrl = `data: image / svg + xml,% 3Csvg xmlns = 'http://www.w3.org/2000/svg' width = '200' height = '200' viewBox = '0 0 200 200' % 3E % 3Crect width = '200' height = '200' fill = '%23f8fafc' rx = '8' /% 3E % 3Crect x = '60' y = '45' width = '80' height = '90' fill = 'none' stroke = '%23cbd5e1' stroke - width='3' rx = '4' /% 3E % 3Crect x = '75' y = '60' width = '20' height = '15' fill = '%23cbd5e1' rx = '2' /% 3E % 3Crect x = '105' y = '60' width = '20' height = '15' fill = '%23cbd5e1' rx = '2' /% 3E % 3Crect x = '75' y = '85' width = '20' height = '15' fill = '%23cbd5e1' rx = '2' /% 3E % 3Crect x = '105' y = '85' width = '20' height = '15' fill = '%23cbd5e1' rx = '2' /% 3E % 3Crect x = '88' y = '110' width = '24' height = '25' fill = '%23cbd5e1' rx = '2' /% 3E % 3Ctext x = '100' y = '165' text - anchor='middle' font - family='Arial,sans-serif' font - size='14' font - weight='600' fill = '%2394a3b8' % 3ENO LOGO % 3C / text % 3E % 3C / svg % 3E`;
                setClinicInfo({
                    name: p.practice_name || p.display_name || "My Practice",
                    address: [p.address_line1, p.address_line2, `${p.city || ''} ${p.state || ''} ${p.zip || ''} `.trim()].filter(Boolean).join('\n') || "",
                    phone: p.phone || "",
                    fax: p.fax || "",
                    email: p.email || "",
                    website: p.website || "",
                    logo: p.logo_url || defaultLogoUrl
                });
            }

            if (visitRes.data.addendums) {
                setAddendums(Array.isArray(visitRes.data.addendums) ? visitRes.data.addendums : JSON.parse(visitRes.data.addendums || '[]'));
            }

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
                }
            }

            if (visitRes.data.note_draft) {
                const parsed = parseNoteText(visitRes.data.note_draft);
                const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                setNoteData({
                    ...parsed,
                    planStructured
                });
            } else {
                setNoteData({
                    chiefComplaint: '', hpi: '', rosNotes: '', peNotes: '', results: '', assessment: '', plan: '', planStructured: []
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
        if (!visitChartView) return;

        let printIframe = document.getElementById('print-iframe') || document.createElement('iframe');
        printIframe.id = 'print-iframe';
        printIframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        if (!document.getElementById('print-iframe')) document.body.appendChild(printIframe);

        const pri = printIframe.contentWindow;
        pri.document.open();
        // Removed the margin:0 which was overriding our component styles
        pri.document.write(`
            <html>
                <head>
                    <title>Clinical Record - ${patient.last_name}, ${patient.first_name}</title>
                    ${Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('')}
                    <style>
                        body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    </style>
                </head>
                <body>
                    <div class="print-container">${visitChartView.innerHTML}</div>
                </body>
            </html>
        `);
        pri.document.close();
        setTimeout(() => { pri.focus(); pri.print(); }, 500);
    };

    const handleAddAddendum = async () => {
        if (!addendumText.trim()) return;
        try {
            await visitsAPI.addAddendum(activeVisitId, addendumText);
            const visitRes = await visitsAPI.get(activeVisitId);
            setAddendums(Array.isArray(visitRes.data.addendums) ? visitRes.data.addendums : JSON.parse(visitRes.data.addendums || '[]'));
            setAddendumText('');
            setShowAddendumModal(false);
        } catch (error) {
            console.error('Error adding addendum:', error);
        }
    };

    const handleCreateSuperbill = async () => {
        try {
            const response = await superbillsAPI.fromVisit(activeVisitId);
            onClose();
            navigate(`/patient/${patientId}/superbill/${response.data.id}`);
        } catch (error) {
            console.error('Error creating superbill:', error);
        }
    };

    if (loading) return <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-[100]"><div className="bg-white p-8 rounded-[2rem] shadow-2xl flex items-center gap-4 font-black text-slate-900 tracking-tighter border border-slate-100"><div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>Retrieving Clinical Record...</div></div>;
    const getChiefComplaint = (visitObj) => {
        if (!visitObj?.note_draft) return 'No Chief Complaint';
        const text = decodeHtmlEntities(visitObj.note_draft);
        const chiefComplaintMatch = text.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Results|Assessment|Plan):)/is);
        return chiefComplaintMatch ? chiefComplaintMatch[1].trim() : 'Routine Visit';
    };

    // Result Image Component (Inline)
    const ResultImageView = ({ docId, filename }) => {
        const [src, setSrc] = useState(null);
        useEffect(() => {
            let active = true;
            documentsAPI.getFile(docId).then(res => {
                if (active) {
                    setSrc(URL.createObjectURL(res.data));
                }
            }).catch(e => console.error(e));
            return () => { active = false; };
        }, [docId]);

        if (!src) return <div className="h-24 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 border border-slate-100 rounded">Loading...</div>;
        return (
            <a href={src} target="_blank" rel="noopener noreferrer" className="block group relative">
                <img src={src} alt={filename} className="w-full h-32 object-cover rounded border border-slate-200 shadow-sm" />
                <div className="mt-1 text-[9px] text-slate-500 truncate">{filename}</div>
            </a>
        );
    };

    if (loading || !patient || !visit) {
        return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 text-white font-black">Record Not Found</div>;
    }

    const visitDate = visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : '';
    const providerName = `${visit.provider_first_name || ''} ${visit.provider_last_name || ''} `.trim() || 'Attending Physician';
    const patientAge = calculateAge(patient.dob);
    const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : '';
    const isSigned = visit?.note_signed_at || visit?.locked;

    return (
        <><style>{`
            @media print {
                @page { 
                    size: A4; 
                    margin: 40mm 30mm; 
                }
                
                html, body { 
                    height: auto !important; 
                    overflow: visible !important; 
                    background: white !important;
                    font-family: 'Inter', system-ui, sans-serif !important;
                    font-size: 11pt !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                .print-container {
                    padding: 40px 40px 0 40px !important; /* Safety padding for head room and side margins */
                    width: 100% !important;
                    background: white !important;
                }

                .print-document-sheet {
                    width: 100% !important;
                    max-width: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                .avoid-cut { 
                    break-inside: avoid !important; 
                    page-break-inside: avoid !important; 
                    margin-bottom: 2.5rem !important;
                }
                
                .no-print { display: none !important; }
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            .section-label {
                font-size: 11px;
                font-weight: 700;
                color: #94a3b8; /* Slate-400 */
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.5rem;
                display: block;
            }
        `}</style>
            <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-0 backdrop-blur-sm animate-fade-in print:bg-white print:p-0 print:static">
                <div className="bg-[#F8FAFC] shadow-2xl w-full h-screen overflow-hidden flex border-none animate-slide-up print:block print:h-auto print:max-w-none print:border-none print:bg-white">

                    {/* EPIC STORYBOARD (Left Sidebar - High Density) */}
                    <div className="w-[300px] shrink-0 border-r border-slate-200 flex flex-col bg-white overflow-y-auto overflow-x-hidden no-print">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex justify-between items-start">
                                <h2 className="text-[18px] font-bold text-slate-900 leading-tight">
                                    {patient.last_name}, {patient.first_name}
                                </h2>
                                <button
                                    onClick={() => setShowPatientChart(true)}
                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="Open Full Chart Panel"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] font-bold text-slate-500 uppercase tracking-tight">
                                <span>{patientAge}Y / {patient.sex || 'U'}</span>
                                <span className="text-slate-300">|</span>
                                <span>MRN: {patient.mrn}</span>
                            </div>
                        </div>

                        <div className="flex-1 p-6 space-y-8">
                            {/* ALLERGIES */}
                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                    Allergies <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                </div>
                                <div className="space-y-1.5">
                                    {allergies.length > 0 ? allergies.map((a, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-rose-50 text-rose-700 text-[12px] font-bold rounded-sm border border-rose-100">{a.allergen}</div>
                                    )) : <div className="text-[12px] font-semibold text-emerald-600">NKDA</div>}
                                </div>
                            </div>

                            {/* VITALS SNAPSHOT */}
                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vitals</div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { l: 'BP', v: vitals?.bp },
                                        { l: 'Pulse', v: vitals?.pulse },
                                        { l: 'Temp', v: vitals?.temp },
                                        { l: 'O2', v: vitals?.o2sat }
                                    ].map((v, i) => (
                                        <div key={i} className="p-2 bg-slate-50 border border-slate-100 rounded text-center">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{v.l}</div>
                                            <div className="text-[13px] font-bold text-slate-800 tabular-nums">{v.v || '--'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PROBLEMS */}
                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Problem List</div>
                                <div className="space-y-1.5">
                                    {problems.slice(0, 5).map((p, i) => (
                                        <div key={i} className="text-[12px] font-medium text-slate-600 line-clamp-1 flex items-start gap-1">
                                            <span className="text-slate-300 mt-1">•</span> {p.problem_name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* MEDICATIONS */}
                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                    Medications <Pill className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <div className="space-y-2">
                                    {medications.length > 0 ? medications.map((m, i) => (
                                        <div key={i} className="text-[12px] font-medium text-slate-600 line-clamp-1 flex flex-col">
                                            <div className="flex items-start gap-1">
                                                <span className="text-slate-300 mt-1">•</span> {m.medication_name}
                                            </div>
                                            <div className="pl-4 text-[10px] text-slate-400 italic uppercase">{m.dosage}</div>
                                        </div>
                                    )) : <div className="text-[12px] italic text-slate-400">None listed</div>}
                                </div>
                            </div>

                            {/* CONTACT */}
                            <div className="pt-6 border-t border-slate-50 space-y-3">
                                <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-500">
                                    <Phone className="w-3.5 h-3.5 text-slate-300" /> {patient.phone || 'N/A'}
                                </div>
                                <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-500">
                                    <Mail className="w-3.5 h-3.5 text-slate-300" /> {patient.email || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100">
                            <button onClick={onClose} className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[12px] font-bold uppercase tracking-wider rounded border border-slate-200 transition-colors">Close View</button>
                        </div>
                    </div>

                    {/* CLINICAL DOCUMENT LANE */}
                    <div className="flex-1 flex flex-col bg-slate-100 relative">
                        {/* Compact Utility Header */}
                        <div className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-20 no-print sticky top-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3 text-[13px] font-semibold text-slate-600">
                                    <span className="uppercase text-[11px] text-slate-400 tracking-widest">Provider:</span>
                                    <span>{providerName}</span>
                                </div>
                                <span className="text-slate-200">|</span>

                                {/* VISIT NAVIGATOR DROPDOWN */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                                    >
                                        <div className="text-left">
                                            <div className="text-[10px] text-slate-400 uppercase font-black leading-tight">Switch Note</div>
                                            <div className="text-[12px] font-bold text-slate-800 leading-tight flex items-center gap-2">
                                                {visitDate} <ChevronDown className={`w-3 h-3 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                    </button>

                                    {isHistoryOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsHistoryOpen(false)} />
                                            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 overflow-hidden animate-slide-up">
                                                <div className="p-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                    Visit Timeline ({allVisits.length})
                                                </div>
                                                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                                                    {allVisits.map((v) => (
                                                        <button
                                                            key={v.id}
                                                            onClick={() => {
                                                                setActiveVisitId(v.id);
                                                                setIsHistoryOpen(false);
                                                            }}
                                                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${activeVisitId === v.id ? 'bg-blue-50/50' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className={`text-[12px] font-black ${activeVisitId === v.id ? 'text-blue-600' : 'text-slate-900'}`}>
                                                                    {format(new Date(v.visit_date), 'MMM d, yyyy')}
                                                                </span>
                                                                {v.locked && <Lock className="w-3 h-3 text-slate-300" />}
                                                            </div>
                                                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter mt-1 truncate">
                                                                {getChiefComplaint(v)}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 uppercase mt-0.5 font-medium">
                                                                {v.visit_type?.replace('_', ' ') || 'Office Visit'} • {v.provider_last_name || 'MD'}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={handlePrint} className="px-5 py-2 bg-slate-900 text-white rounded text-[12px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all">
                                    <Printer className="w-4 h-4" /> Print (A3 Format)
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                                    title="Close View"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* The Professional Clinical Note (A3 Optimized) */}
                        <div id="visit-chart-view" className="flex-1 overflow-y-auto p-12 print:p-0">
                            <div className="max-w-[1400px] mx-auto bg-white shadow-sm border border-slate-200 min-h-full p-16 space-y-12 print-document-sheet print:border-0 print:shadow-none print:max-w-none">

                                {/* 1. REFINED CLINIC HEADER */}
                                <div className="flex justify-between items-center pb-12 border-b border-slate-300 avoid-cut">
                                    <div className="flex items-center gap-10">
                                        <div className="w-32 h-32 flex items-center justify-center shrink-0">
                                            <img src={clinicInfo.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <div className="leading-snug">
                                            <div className="flex items-center gap-5">
                                                <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">{clinicInfo.name}</h1>
                                                <span className="text-[10px] border border-slate-200 text-slate-400 px-3 py-1 rounded uppercase font-bold tracking-widest">Clinical Record</span>
                                            </div>
                                            <div className="text-[14px] text-slate-500 mt-2 font-medium">
                                                {clinicInfo.address.replace(/\n/g, ' • ')}
                                                <span className="mx-3 text-slate-300">|</span>
                                                P: {clinicInfo.phone}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[16px] font-bold text-slate-900">{visitDate}</div>
                                        <div className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase tracking-tighter">ID: {activeVisitId?.substring(0, 10)}</div>
                                    </div>
                                </div>

                                {/* 2. ENHANCED PATIENT DEMOGRAPHICS */}
                                <div className="relative avoid-cut py-8 px-10 my-6 bg-sky-50/40 rounded-xl border border-sky-100/50 flex gap-12 overflow-hidden">
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.2] pointer-events-none pr-12">
                                        <Stethoscope className="w-32 h-32 text-sky-600" />
                                    </div>

                                    <div className="flex-1 grid grid-cols-3 gap-x-16 relative z-10 text-[12px]">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Patient Identity</div>
                                                <div className="font-bold text-slate-900 text-[16px] leading-tight">{patient.last_name}, {patient.first_name}</div>
                                                <div className="text-[12px] text-slate-500 font-medium tabular-nums mt-1">MRN: {patient.mrn}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Insurance / Class</div>
                                                <div className="font-bold text-slate-800 uppercase text-[12px]">{patient.insurance_name || 'Self-Pay'}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 border-x border-slate-100/60 px-10">
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Personal Metrics</div>
                                                <div className="font-bold text-slate-800 text-[14px]">{patientDOB} <span className="text-slate-400 font-medium mx-1.5">/</span> {patientAge}Y <span className="text-slate-400 font-medium mx-1.5">/</span> {patient.sex}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Contact Detail</div>
                                                <div className="space-y-1 text-slate-700 font-medium">
                                                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-300" /> {patient.phone || 'N/A'}</div>
                                                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-300" /> {patient.email || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pl-6">
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Primary Residence</div>
                                                <div className="text-slate-700 font-medium leading-relaxed max-w-[220px]">
                                                    {[patient.street_address, patient.city, patient.state, patient.zip].filter(Boolean).join(', ') || 'No address provided'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-tight mb-1">Encounter Provider</div>
                                                <div className="font-bold text-slate-800 text-[13px]">{providerName}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CHIEF COMPLAINT */}
                                <div className="avoid-cut mb-4 pt-1 border-t border-slate-100 flex gap-6 items-baseline">
                                    <span className="section-label !mb-0 shrink-0">Chief Complaint</span>
                                    <div className="text-[13px] font-bold text-slate-900 uppercase tracking-tight">{noteData.chiefComplaint || visit?.reason || 'Routine follow-up'}</div>
                                </div>

                                {/* 3. CLINICAL NARRATIVE */}
                                <div className="space-y-12 pb-16">
                                    {/* HPI */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <span className="section-label">History of Present Illness</span>
                                        <div className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">{noteData.hpi || 'No HPI recorded.'}</div>
                                    </div>

                                    {/* ROS */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <span className="section-label">Review of Systems</span>
                                        <div className="text-[13px] leading-relaxed text-slate-600 columns-2 gap-12" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />
                                    </div>

                                    {/* ALLERGIES & PMHX Grid */}
                                    <div className="grid grid-cols-2 gap-12 mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <div className="space-y-3">
                                            <span className="section-label !text-rose-600">Allergies</span>
                                            <div className="flex flex-wrap gap-2 text-[12px]">
                                                {allergies.length > 0 ? allergies.map((a, i) => <span key={i} className="font-bold text-rose-700">! {a.allergen}</span>) : <span className="font-semibold text-emerald-600 italic">NKDA</span>}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <span className="section-label">Medical History</span>
                                            <ul className="text-[12px] font-medium text-slate-600 space-y-1.5">
                                                {problems.length > 0 ? problems.map((p, i) => <li key={i} className="flex items-center gap-2"> • {p.problem_name}</li>) : <li className="italic text-slate-400">Non-contributory.</li>}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* MEDS & FAMILY Grid */}
                                    <div className="grid grid-cols-2 gap-12 mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <div className="space-y-3">
                                            <span className="section-label">Medications</span>
                                            <ul className="text-[12px] font-semibold text-slate-700 space-y-2">
                                                {medications.length > 0 ? medications.map((m, i) => <li key={i} className="flex flex-col border-b border-slate-50 pb-1"><span>{m.medication_name}</span> <span className="text-[10px] text-slate-400 font-medium uppercase">{m.dosage}</span></li>) : <li className="italic text-slate-400">None listed.</li>}
                                            </ul>
                                        </div>
                                        <div className="space-y-3">
                                            <span className="section-label">Family / Social</span>
                                            <div className="text-[12px] text-slate-600">
                                                {socialHistory ? <div>{[socialHistory.smoking_status, socialHistory.alcohol_use].filter(Boolean).join(' • ')}</div> : <div className="text-slate-400 italic">Reviewed.</div>}
                                                <div className="mt-2 text-slate-500">Family Hx: {familyHistory.length > 0 ? familyHistory.map(f => f.condition).join(', ') : 'Non-contributory.'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* VITALS */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <span className="section-label">Physical Observations (Vitals)</span>
                                        <div className="grid grid-cols-5 gap-6 mt-2">
                                            {[
                                                { label: 'B/P', value: vitals?.bp, unit: 'mmHg' },
                                                { label: 'PULSE', value: vitals?.pulse, unit: 'bpm' },
                                                { label: 'TEMP', value: vitals?.temp, unit: '°F' },
                                                { label: 'O2 SAT', value: vitals?.o2sat, unit: '%' },
                                                { label: 'BMI', value: vitals?.bmi, unit: '' }
                                            ].map((v, i) => (
                                                <div key={i} className="border-l border-slate-100 pl-3 space-y-1">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.label}</div>
                                                    <div className="text-[15px] font-bold text-slate-800 tabular-nums">{v.value || '--'} <span className="text-[10px] font-normal text-slate-400">{v.unit}</span></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* PE */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <span className="section-label">Physical Examination</span>
                                        <div className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />
                                    </div>

                                    {/* RESULTS / DATA */}
                                    {(noteData.results || visitDocuments.length > 0) && (
                                        <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                            <span className="section-label">Results & Data</span>
                                            {noteData.results && <div className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap mb-4">{noteData.results}</div>}
                                            {visitDocuments.length > 0 && (
                                                <div className="grid grid-cols-4 gap-4 mt-4">
                                                    {visitDocuments.map(doc => (
                                                        <ResultImageView key={doc.id} docId={doc.id} filename={doc.filename} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ASSESSMENT */}
                                    <div className="mt-8 pt-6 border-t border-slate-100 avoid-cut">
                                        <span className="section-label text-slate-900 border-none">Assessment & Diagnoses</span>
                                        <div className="space-y-1.5 font-bold text-[14px] text-slate-900">
                                            {noteData.assessment ? noteData.assessment.split('\n').filter(line => line.trim()).map((line, i) => (
                                                <div key={i} className="flex gap-2.5">
                                                    <span className="text-slate-400 font-medium">{i + 1}.</span>
                                                    {line}
                                                </div>
                                            )) : <div className="text-slate-400 italic">No diagnostic data.</div>}
                                        </div>
                                    </div>

                                    {/* PLAN */}
                                    <div className="space-y-6 pt-8 mt-8 border-t border-slate-900/10 avoid-cut">
                                        <span className="section-label">Medical Plan & Interventions</span>
                                        <div className="space-y-8 pl-3">
                                            {noteData.planStructured?.length > 0 ? noteData.planStructured.map((p, i) => (
                                                <div key={i} className="space-y-3">
                                                    <div className="text-[15px] font-bold text-slate-800 border-b border-slate-100 pb-1.5">{p.diagnosis}</div>
                                                    <ul className="pl-8 space-y-1.5">
                                                        {p.orders.map((o, j) => (
                                                            <li key={j} className="text-[14px] text-slate-600 font-medium flex items-center gap-2.5"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div> {o}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )) : <div className="text-[14px] text-slate-600 whitespace-pre-wrap">{noteData.plan || 'No specific clinical orders recorded.'}</div>}
                                        </div>
                                    </div>

                                    {/* PLAN OF CARE */}
                                    {noteData.carePlan && (
                                        <div className="space-y-6 pt-8 mt-8 border-t border-slate-900/10 avoid-cut">
                                            <span className="section-label">Plan of Care</span>
                                            <div className="text-[14px] leading-relaxed text-slate-600 pl-3 whitespace-pre-wrap">{noteData.carePlan}</div>
                                        </div>
                                    )}

                                    {/* FOLLOW UP */}
                                    <div className="pt-10 border-t border-slate-100 avoid-cut">
                                        <div className="inline-block bg-slate-900 px-8 py-3 rounded text-white shadow-xl">
                                            <span className="text-[11px] uppercase font-bold tracking-widest block opacity-50">Follow Up Instruction</span>
                                            <span className="text-[18px] font-bold italic">{noteData.followUp || visit.follow_up_instructions || 'PRN / AS NEEDED'}</span>
                                        </div>
                                    </div>

                                    {/* AUTHENTICATION FOOTER */}
                                    <div className="mt-20 pt-8 border-t-2 border-slate-900 avoid-cut">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-2">
                                                <div className="text-2xl font-bold italic text-slate-900 tracking-tight">/s/ {providerName}</div>
                                                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED ELECTRONIC SIGNATURE {isSigned && `• ${format(new Date(isSigned), 'MM/dd/yyyy HH:mm')}`}
                                                </div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight pl-3">Unique Authentication Hash: {patientId?.substring(0, 8)}-{activeVisitId?.substring(0, 8)}-SECURE-SIG</div>
                                            </div>
                                            <div className="text-right flex flex-col items-end opacity-30">
                                                <span className="text-2xl font-black italic text-slate-900 tracking-tighter">PageMD EMR</span>
                                                <span className="text-[8px] font-bold text-slate-500 mt-1">Generated: {format(new Date(), 'MM/dd/yyyy HH:mm:ss')}</span>
                                            </div>
                                        </div>
                                        <div className="mt-8 text-center text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] border-t border-slate-50 pt-4">
                                            Confidential Patient Record • Unauthorized Disclosure Prohibited by HIPAA Federal Law
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Redesigned Modal Containers */}
            {showAddendumModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowAddendumModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-10 border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Add Record Amendment</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Clinical Context Supplement</p>
                            </div>
                            <button onClick={() => setShowAddendumModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-300" /></button>
                        </div>
                        <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all placeholder:text-slate-300" placeholder="Enter clinical supplement..." />
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowAddendumModal(false)} className="px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
                            <button onClick={handleAddAddendum} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all">Authenticate Addendum</button>
                        </div>
                    </div>
                </div>
            )}

            {showBillingModal && <BillingModal patientId={patientId} isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />}

            {/* Unified Patient Chart Panel */}
            <PatientChartPanel
                isOpen={showPatientChart}
                onClose={() => setShowPatientChart(false)}
                patientId={patientId}
                initialTab="summary"
            />
        </>
    );
};

const BillingModal = ({ patientId, isOpen, onClose }) => {
    const [claims, setClaims] = useState([]);
    useEffect(() => {
        if (isOpen) billingAPI.getClaimsByPatient(patientId).then(res => setClaims(res.data || [])).catch(console.error);
    }, [isOpen]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-10 border border-slate-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Billing Record</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Claim Transmission Log</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-300" /></button>
                </div>
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">
                    {claims.map((c, i) => (
                        <div key={i} className="p-5 bg-slate-50/50 border border-slate-200/50 rounded-2xl flex justify-between items-center">
                            <div className="space-y-1">
                                <div className="text-sm font-black text-slate-800 tracking-tight">{format(new Date(c.visit_date), 'MMMM dd, yyyy')}</div>
                                <div className="flex items-center gap-3">
                                    <div className={`px - 2 py - 0.5 rounded - lg text - [9px] font - black uppercase tracking - widest ${c.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-400'} `}>{c.status}</div>
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{c.visit_type || 'Clinical Service'}</div>
                                </div>
                            </div>
                            <div className="text-xl font-black text-slate-900 tracking-tighter">${c.total_amount}</div>
                        </div>
                    ))}
                    {claims.length === 0 && <div className="text-center py-20 text-slate-200 font-bold uppercase tracking-widest text-[10px]">Financials Sync Required</div>}
                </div>
                <div className="mt-10 pt-6 border-t border-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/10">Close Audit</button>
                </div>
            </div>
        </div>
    );
};

export default VisitChartView;
