import React, { useState, useEffect } from 'react';
import { Activity, FileText, Printer, X, AlertCircle, CheckCircle2, User, UserCircle, Calendar, Database, Phone, Mail, MapPin, Building2, Stethoscope, CreditCard, Users, FilePlus, Receipt, DollarSign, Globe, Clock, Heart, Thermometer, Wind, Pill, Lock, ClipboardList, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI, billingAPI, codesAPI, settingsAPI, documentsAPI } from '../services/api';
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
        name: "My Practice",
        address: "",
        phone: "",
        fax: "",
        email: "",
        website: "",
        logo: null
    });

    useEffect(() => {
        if (activeVisitId && patientId) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeVisitId, patientId]);

    const decodeHtmlEntities = (text) => {
        if (typeof text !== 'string') return String(text || '');
        return text
            .replace(/&amp;#x2F;/g, '/')
            .replace(/&#x2F;/g, '/')
            .replace(/&#47;/g, '/')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    };

    const formatMarkdownBold = (text) => {
        if (typeof text !== 'string') return String(text || '');
        return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    };

    const parseNoteText = (textRaw) => {
        const text = typeof textRaw === 'string' ? textRaw : String(textRaw || '');
        if (!text.trim()) return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
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
            const safeLine = typeof line === 'string' ? line : String(line || '');
            const diagnosisMatch = safeLine.match(/^(\d+)\.\s*(.+)$/);
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
            const [patientRes, visitRes, allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes, practiceRes, allVisitsRes, documentsRes] = await Promise.all([
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
            const allDocs = documentsRes?.data || [];
            const linkedDocs = allDocs.filter(d => d.visit_id === activeVisitId);
            setVisitDocuments(linkedDocs);

            if (practiceRes?.data) {
                const p = practiceRes.data;
                // Default "NO LOGO" placeholder SVG - building icon with text
                const defaultLogoUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f8fafc' rx='8'/%3E%3Crect x='60' y='45' width='80' height='90' fill='none' stroke='%23cbd5e1' stroke-width='3' rx='4'/%3E%3Crect x='75' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='75' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='88' y='110' width='24' height='25' fill='%23cbd5e1' rx='2'/%3E%3Ctext x='100' y='165' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' font-weight='600' fill='%2394a3b8'%3ENO LOGO%3C/text%3E%3C/svg%3E`;
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
        onClose();
        navigate(`/patient/${patientId}/fee-sheet/${activeVisitId}`);
    };

    if (loading) return <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-[100]"><div className="bg-white p-8 rounded-[2rem] shadow-2xl flex items-center gap-4 font-black text-slate-900 tracking-tighter border border-slate-100"><div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>Retrieving Clinical Record...</div></div>;
    const getChiefComplaint = (visitObj) => {
        if (!visitObj?.note_draft) return 'No Chief Complaint';
        const text = decodeHtmlEntities(visitObj.note_draft);
        const chiefComplaintMatch = text.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Results|Assessment|Plan):)/is);
        return chiefComplaintMatch ? chiefComplaintMatch[1].trim() : 'Routine Visit';
    };

    // Result Image Component (Inline)
    const ResultImageView = ({ doc }) => {
        const [src, setSrc] = useState(null);
        useEffect(() => {
            let active = true;
            documentsAPI.getFile(doc.id).then(res => {
                if (active) {
                    setSrc(URL.createObjectURL(res.data));
                }
            }).catch(e => console.error(e));
            return () => { active = false; };
        }, [doc.id]);

        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        const interpretationTag = tags.find(t => t.startsWith('interpretation:'));
        const interpretation = interpretationTag ? interpretationTag.replace('interpretation:', '') : null;

        // Extract other metrics from tags
        const metrics = tags.filter(t => t.includes(':') && !t.startsWith('interpretation:') && !t.startsWith('date:'))
            .map(t => {
                const [key, ...valParts] = t.split(':');
                const value = valParts.join(':');
                const label = key.replace(/_/g, ' ').toUpperCase();
                return { label, value };
            });

        if (!src) return <div className="h-32 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 border border-slate-100 rounded-xl">Loading...</div>;
        return (
            <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm avoid-cut mb-2">
                <a href={src} target="_blank" rel="noopener noreferrer" className="block group relative">
                    <img src={src} alt={doc.filename} className="w-full h-48 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-[1.01]" />
                    <div className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{doc.filename}</div>
                </a>

                {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        {metrics.map((m, i) => (
                            <div key={i} className="bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/30">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1 opacity-60">{m.label}</span>
                                <span className="text-[11px] font-bold text-slate-800 tabular-nums">{m.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {interpretation && (
                    <div className="bg-blue-50/30 border border-blue-100/30 p-3 rounded-lg mt-1">
                        <span className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest block mb-1">Interpretation</span>
                        <div className="text-[12px] font-bold text-slate-700 leading-snug italic">"{interpretation}"</div>
                    </div>
                )}
            </div>
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

        <>
            <style>{`
            @media print {
                @page { 
                    size: A4; 
                    margin: 20mm; 
                }
                
                html, body { 
                    height: auto !important; 
                    overflow: visible !important; 
                    background: white !important;
                    font-size: 10pt !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                .print-container {
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
                    margin-bottom: 1.5rem !important;
                }
                
                .no-print { display: none !important; }
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            .section-label {
                font-size: 10px;
                font-weight: 700;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.4rem;
                display: block;
            }
        `}</style>

            <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in print:bg-white print:p-0 print:static">
                <div className="bg-white shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] w-full max-w-[1000px] h-[85vh] rounded-2xl overflow-hidden flex flex-col border border-white/20 animate-slide-up print:block print:h-auto print:max-w-none print:border-none print:bg-white print:rounded-none">

                    {/* Utility Header */}
                    <div className="h-12 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 no-print shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 text-[12px] font-semibold text-slate-600">
                                <span className="uppercase text-[10px] text-slate-400 tracking-widest">Provider:</span>
                                <span>{providerName}</span>
                            </div>
                            <span className="text-slate-200">|</span>

                            <div className="relative">
                                <button
                                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                    className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                                >
                                    <div className="text-left">
                                        <div className="text-[9px] text-slate-400 uppercase font-black leading-tight">Switch Note</div>
                                        <div className="text-[11px] font-bold text-slate-800 leading-tight flex items-center gap-2">
                                            {visitDate} <ChevronDown className={`w-3 h-3 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </button>

                                {isHistoryOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsHistoryOpen(false)} />
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 overflow-hidden animate-slide-up">
                                            <div className="p-2 bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                Visit History
                                            </div>
                                            <div className="max-h-[50vh] overflow-y-auto">
                                                {allVisits.map((v) => (
                                                    <button
                                                        key={v.id}
                                                        onClick={() => { setActiveVisitId(v.id); setIsHistoryOpen(false); }}
                                                        className={`w-full text-left p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${activeVisitId === v.id ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <span className={`text-[11px] font-black ${activeVisitId === v.id ? 'text-blue-600' : 'text-slate-900'}`}>
                                                                {format(new Date(v.visit_date), 'MMM d, yyyy')}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{getChiefComplaint(v)}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={handlePrint} className="px-4 py-1.5 bg-slate-900 text-white rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all">
                                <Printer className="w-3.5 h-3.5" /> Print
                            </button>
                            <button onClick={onClose} className="p-1.5 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-lg border border-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div id="visit-chart-view" className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30 print:p-0 print:bg-white">
                        <div className="max-w-[800px] mx-auto bg-white shadow-sm border border-slate-200/60 p-6 md:p-10 flex flex-col font-serif print:p-0 print:shadow-none print:border-none">

                            {/* Clinic Header */}
                            <div className="flex flex-col items-center mb-6 pb-6 border-b border-slate-100">
                                <img src={clinicInfo.logo} alt="Logo" className="w-16 h-16 object-contain mb-3" />
                                <div className="text-center">
                                    <h1 className="text-[20px] font-black text-slate-800 tracking-tight">{clinicInfo.name}</h1>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                        Clinical Document Reference • {visitDate}
                                    </div>
                                </div>
                            </div>

                            {/* Patient Info Bar */}
                            <div className="grid grid-cols-3 gap-6 py-4 px-6 bg-slate-50 rounded-lg border border-slate-100 mb-8 text-[11px]">
                                <div className="space-y-1">
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Patient</div>
                                    <div className="font-extrabold text-slate-900 uppercase">{patient.last_name}, {patient.first_name}</div>
                                    <div className="text-slate-500 font-bold">MRN: {patient.mrn}</div>
                                </div>
                                <div className="space-y-1 border-x border-slate-200 px-6">
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Demographics</div>
                                    <div className="font-bold text-slate-700">DOB: {patientDOB}</div>
                                    <div className="text-slate-500 font-bold">AGE: {patientAge}Y / {patient.sex}</div>
                                </div>
                                <div className="space-y-1 pl-6">
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Provider</div>
                                    <div className="font-bold text-slate-800">{providerName}</div>
                                    <div className="text-slate-500 truncate">{clinicInfo.phone}</div>
                                </div>
                            </div>

                            {/* Clinical Sections */}
                            <div className="space-y-10">
                                {/* Chief Complaint */}
                                <div className="avoid-cut border-b border-slate-50 pb-2">
                                    <span className="section-label">Chief Complaint</span>
                                    <div className="text-sm font-bold text-slate-900 uppercase tracking-tight">{noteData.chiefComplaint || visit?.reason || 'Routine Visit'}</div>
                                </div>

                                {/* Narrative */}
                                <div className="avoid-cut">
                                    <span className="section-label">History of Present Illness</span>
                                    <div className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{noteData.hpi || 'No HPI recorded.'}</div>
                                </div>

                                <div className="avoid-cut">
                                    <span className="section-label">Review of Systems</span>
                                    <div className="text-[12px] leading-relaxed text-slate-600 columns-2" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />
                                </div>

                                <div className="avoid-cut">
                                    <span className="section-label">Physical Examination</span>
                                    <div className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />
                                </div>

                                {/* Diagnoses */}
                                <div className="avoid-cut bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                                    <span className="section-label">Assessment & Diagnoses (ICD-10)</span>
                                    <div className="space-y-1 text-[13px] font-bold text-slate-900">
                                        {noteData.assessment ? noteData.assessment.split('\n').filter(l => l.trim()).map((line, i) => (
                                            <div key={i} className="flex gap-2">
                                                <span className="text-slate-400 font-medium">{i + 1}.</span> {line}
                                            </div>
                                        )) : <div className="italic text-slate-400">Stable chronic conditions.</div>}
                                    </div>
                                </div>

                                {/* Plan */}
                                <div className="avoid-cut">
                                    <span className="section-label">Medical Plan & Orders</span>
                                    <div className="space-y-4 pl-2">
                                        {noteData.planStructured?.length > 0 ? noteData.planStructured.map((p, i) => (
                                            <div key={i}>
                                                <div className="text-[13px] font-bold text-slate-800 mb-1">{p.diagnosis}</div>
                                                <ul className="pl-6 space-y-1">
                                                    {p.orders.map((o, j) => (
                                                        <li key={j} className="text-[12px] text-slate-600 flex items-center gap-2">• {o}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )) : <div className="text-[12px] text-slate-600 whitespace-pre-wrap">{noteData.plan || 'No changes.'}</div>}
                                    </div>
                                </div>

                                {/* Follow Up */}
                                <div className="avoid-cut pt-4 border-t border-slate-100">
                                    <div className="inline-block bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">
                                        <span className="section-label !mb-0 text-[8px]">Next Appointment / Follow Up</span>
                                        <div className="text-xs font-bold text-slate-900 italic uppercase">
                                            {noteData.followUp || visit.follow_up_instructions || 'PRN / AS NEEDED'}
                                        </div>
                                    </div>
                                </div>

                                {/* Signature */}
                                <div className="mt-12 pt-4 border-t border-slate-100 avoid-cut flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="text-lg font-bold italic text-slate-900">/s/ {providerName}</div>
                                        <div className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> VERIFIED SIGNATURE {isSigned && `• ${format(new Date(isSigned), 'MM/dd/yyyy')}`}
                                        </div>
                                    </div>
                                    <div className="text-right opacity-30">
                                        <div className="text-sm font-black italic text-slate-900">PageMD EMR</div>
                                        <div className="text-[6px] font-bold text-slate-500 uppercase tracking-widest mt-1">Generated: {format(new Date(), 'MM/dd/yyyy HH:mm')}</div>
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
                                    <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-400'} `}>{c.status}</div>
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
