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

    const parseNoteText = (text) => {
        if (!text || !text.trim()) return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        const decodedText = decodeHtmlEntities(text);

        const chiefComplaintMatch = decodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const chiefComplaint = chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '';

        const hpiMatch = decodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is);
        const hpi = hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '';

        const rosMatch = decodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
        const rosNotes = rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '';

        const peMatch = decodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
        const peNotes = peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '';

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

    const renderSection = (key, condition, title, content, className = "") => {
        if (!condition) return null;
        return (
            <div key={key} className={`py-10 border-b border-slate-100/60 last:border-0 ${className}`}>
                <h2 className="text-[11px] font-black text-blue-600/70 uppercase tracking-[0.25em] mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></span>
                    {title}
                </h2>
                <div className="text-slate-700 leading-relaxed text-[14px] font-medium selection:bg-blue-100">
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
                // Default "NO LOGO" placeholder SVG - building icon with text
                const defaultLogoUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f8fafc' rx='8'/%3E%3Crect x='60' y='45' width='80' height='90' fill='none' stroke='%23cbd5e1' stroke-width='3' rx='4'/%3E%3Crect x='75' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='75' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='88' y='110' width='24' height='25' fill='%23cbd5e1' rx='2'/%3E%3Ctext x='100' y='165' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' font-weight='600' fill='%2394a3b8'%3ENO LOGO%3C/text%3E%3C/svg%3E`;
                setClinicInfo({
                    name: p.practice_name || p.display_name || "My Practice",
                    address: [p.address_line1, p.address_line2, `${p.city || ''} ${p.state || ''} ${p.zip || ''}`.trim()].filter(Boolean).join('\n') || "",
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
        pri.document.write(`<html><head><title>Visit Note</title>${Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('')}<style>@page{margin:0.5in;}body{padding:20px; font-family: sans-serif;}</style></head><body>${visitChartView.outerHTML}</body></html>`);
        pri.document.close();
        setTimeout(() => { pri.focus(); pri.print(); }, 1000);
    };

    const handleAddAddendum = async () => {
        if (!addendumText.trim()) return;
        try {
            await visitsAPI.addAddendum(visitId, addendumText);
            const visitRes = await visitsAPI.get(visitId);
            setAddendums(Array.isArray(visitRes.data.addendums) ? visitRes.data.addendums : JSON.parse(visitRes.data.addendums || '[]'));
            setAddendumText('');
            setShowAddendumModal(false);
        } catch (error) {
            console.error('Error adding addendum:', error);
        }
    };

    const handleCreateSuperbill = async () => {
        try {
            const response = await superbillsAPI.fromVisit(visitId);
            onClose();
            navigate(`/patient/${patientId}/superbill/${response.data.id}`);
        } catch (error) {
            console.error('Error creating superbill:', error);
        }
    };

    if (loading) return <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-[100]"><div className="bg-white p-8 rounded-[2rem] shadow-2xl flex items-center gap-4 font-black text-slate-900 tracking-tighter border border-slate-100"><div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>Retrieving Clinical Record...</div></div>;
    if (!visit || !patient) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 text-white font-black">Record Not Found</div>;

    const visitDate = visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : '';
    const providerName = `${visit.provider_first_name || ''} ${visit.provider_last_name || ''}`.trim() || 'Attending Physician';
    const patientAge = calculateAge(patient.dob);
    const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : '';
    const isSigned = visit?.note_signed_at || visit?.locked;

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in print:hidden">
                <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_rgba(30,58,138,0.2)] max-w-6xl w-full max-h-[96vh] overflow-hidden flex flex-col border border-white/50 animate-slide-up">
                    {/* Premium Azure Toolbar */}
                    <div className="px-10 py-5 border-b border-blue-50 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                                <Stethoscope className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-1.5">Official Clinical Summary</h2>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-blue-100">{visit.visit_type || 'Diagnostic Encounter'}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authenticated EMR Document</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isSigned && (
                                <button onClick={() => setShowAddendumModal(true)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all border border-slate-200">Amendment</button>
                            )}
                            <button onClick={handleCreateSuperbill} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all border border-slate-200">Financials</button>
                            <button onClick={() => setShowBillingModal(true)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all border border-slate-200">Ledger</button>
                            <button onClick={handlePrint} className="px-7 py-3 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xl shadow-blue-500/30 flex items-center gap-2"><Printer className="w-4 h-4" /> Print Document</button>
                            <div className="w-px h-8 bg-slate-100 mx-3"></div>
                            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X className="w-7 h-7 text-slate-300" /></button>
                        </div>
                    </div>

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto py-16 px-20 bg-white selection:bg-blue-100 selection:text-blue-900">
                        {/* High-Definition Clinic Brand */}
                        <div className="mb-16 flex justify-between items-start">
                            <div className="flex gap-12 items-center">
                                <div className="p-1.5 border-2 border-slate-50 rounded-[2rem] bg-white shadow-sm">
                                    <div className="w-28 h-28 bg-slate-50/50 rounded-[1.5rem] flex items-center justify-center p-5">
                                        {clinicInfo.logo ? <img src={clinicInfo.logo} className="max-h-full object-contain filter contrast-125" /> : <Building2 className="text-blue-100 w-16 h-16" />}
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{clinicInfo.name}</h1>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-[13px] font-bold text-slate-500">
                                        <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-blue-500/60" /> {clinicInfo.address.replace(/\n/g, ' • ')}</div>
                                        <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-blue-500/60" /> {clinicInfo.phone}</div>
                                        <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-blue-500/60" /> {clinicInfo.website}</div>
                                        {clinicInfo.fax && <div className="flex items-center gap-3"><Printer className="w-4 h-4 text-blue-500/60" /> Fax: {clinicInfo.fax}</div>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="text-[11px] font-black text-blue-600 uppercase tracking-[0.4em] mb-3">Encounter Protocol</div>
                                <div className="text-3xl font-black text-slate-900 tabular-nums leading-none mb-3">{visitDate}</div>
                                <div className="px-5 py-2 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20">{providerName}</div>
                            </div>
                        </div>

                        {/* Enhanced Patient Clinical Passport */}
                        <div className="mb-14 group relative">
                            <div className="absolute inset-x-0 -bottom-6 h-12 bg-blue-600/10 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative bg-[#0F172A] rounded-[3rem] p-12 overflow-hidden shadow-2xl shadow-blue-900/20">
                                {/* Abstract Background Accents */}
                                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full -ml-32 -mb-32 blur-[80px]"></div>

                                <div className="relative z-10 flex flex-col gap-12">
                                    <div className="flex flex-wrap items-center justify-between gap-10">
                                        <div className="flex items-center gap-10">
                                            <div className="w-24 h-24 bg-gradient-to-tr from-white/10 to-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                                <User className="w-12 h-12 text-blue-400" />
                                            </div>
                                            <div className="space-y-3">
                                                <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.5em] leading-none">Primary Subject Identity</p>
                                                <h2 className="text-6xl font-black text-white tracking-tighter leading-none">
                                                    {patient.last_name}, <span className="text-blue-500/80">{patient.first_name}</span>
                                                </h2>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-16 border-l border-white/10 pl-16">
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Record ID</p>
                                                <p className="text-2xl font-black text-white tabular-nums tracking-tight">{patient.mrn}</p>
                                            </div>
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Temporal</p>
                                                <p className="text-2xl font-black text-white tracking-tight">{patientDOB} <span className="text-blue-400/50 text-base font-bold italic ml-2">({patientAge}y)</span></p>
                                            </div>
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Bio-Sex</p>
                                                <div className="px-5 py-2 rounded-2xl bg-blue-500/20 border border-blue-400/30 font-black text-xl text-blue-400 uppercase tracking-widest">{(patient.sex || 'U').charAt(0)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Stats Ribbon */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-10 border-t border-white/5">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10"><Phone className="w-5 h-5" /></div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Global Contact</p>
                                                <p className="text-[13px] font-bold text-white/90">{patient.phone || patient.mobile_phone || 'Unlisted'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-indigo-400 border border-white/10"><Mail className="w-5 h-5" /></div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Electronic Mail</p>
                                                <p className="text-[13px] font-bold text-white/90 lowercase">{patient.email || 'Unlisted'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 border border-white/10"><MapPin className="w-5 h-5" /></div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Residential Axis</p>
                                                <p className="text-[13px] font-bold text-white/90 truncate max-w-[200px]">{[patient.street_address, patient.city, patient.state].filter(Boolean).join(', ') || 'Address Unlisted'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Full Clinical Narrative */}
                        <div className="space-y-6">
                            {renderSection('cc', true, 'Objective Chief Complaint', <div className="text-3xl font-black text-slate-900 tracking-tight leading-tight pt-2 border-l-4 border-blue-600 pl-8">{noteData.chiefComplaint || 'No primary symptom established'}</div>)}

                            {renderSection('hpi', true, 'History of Present Illness', <div className="text-slate-700 whitespace-pre-wrap leading-[2] font-semibold text-[15px]">{noteData.hpi || 'Clinical history not obtained'}</div>)}

                            {renderSection('ros', true, 'Review of Systems (ROS)', <div className="text-slate-500 leading-[1.8] columns-1 md:columns-2 gap-12 font-medium" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />)}

                            {/* Triple Section Data Hub */}
                            <div className="py-16 grid grid-cols-1 lg:grid-cols-3 gap-16 border-b border-slate-100/60">
                                <div className="space-y-8">
                                    <h3 className="text-[12px] font-black text-rose-500 uppercase tracking-[0.3em] flex items-center gap-4">
                                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"></span>
                                        Sensitivities
                                    </h3>
                                    {allergies.length > 0 ? (
                                        <div className="flex flex-wrap gap-3">
                                            {allergies.map((a, i) => <span key={i} className="px-5 py-2 bg-rose-50 text-rose-600 text-[12px] font-black rounded-2xl border border-rose-100 shadow-sm">{a.allergen}</span>)}
                                        </div>
                                    ) : <div className="flex items-center gap-4 text-emerald-500 font-extrabold text-[12px] uppercase tracking-widest bg-emerald-50 px-6 py-4 rounded-[1.5rem] border border-emerald-100 w-fit"><CheckCircle2 className="w-5 h-5" /> No Known Drug Allergies</div>}
                                </div>
                                <div className="space-y-8">
                                    <h3 className="text-[12px] font-black text-blue-600 uppercase tracking-[0.3em] flex items-center gap-4">
                                        <span className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></span>
                                        Prescriptions
                                    </h3>
                                    <div className="space-y-3">
                                        {medications.length > 0 ? medications.map((m, i) => (
                                            <div key={i} className="flex flex-col gap-1.5 p-5 bg-slate-50 rounded-[1.50rem] border border-slate-100 group hover:border-blue-400 transition-all cursor-default">
                                                <span className="text-[14px] font-black text-slate-900 tracking-tight">{m.medication_name}</span>
                                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{m.dosage}</span>
                                            </div>
                                        )) : <p className="text-slate-300 italic text-[11px] font-black uppercase tracking-[0.2em] pt-2">Zero Active Medication</p>}
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                        Active Problems
                                    </h3>
                                    <div className="space-y-4">
                                        {problems.length > 0 ? problems.map((p, i) => (
                                            <div key={i} className="flex items-center gap-4 text-[13px] font-black text-slate-700 group cursor-default">
                                                <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-blue-400 transition-colors"></div>
                                                {p.problem_name}
                                            </div>
                                        )) : <p className="text-slate-300 italic text-[11px] font-black uppercase tracking-[0.2em] pt-2">Clinical Clean Slate</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Diagnostic Vitals Acquisition */}
                            {vitals && renderSection('vitals', true, 'Digital Vital Acquisition',
                                <div className="flex flex-wrap gap-5 py-4">
                                    {[
                                        { label: 'BP / Arterial', value: vitals.bp, icon: Heart, color: 'rose', unit: 'mmHg' },
                                        { label: 'Cardiac Rate', value: vitals.pulse, icon: Activity, color: 'blue', unit: 'bpm' },
                                        { label: 'Thermal Core', value: vitals.temp, icon: Thermometer, color: 'amber', unit: '°F' },
                                        { label: 'O2 Saturation', value: vitals.o2sat, icon: Wind, color: 'emerald', unit: '%' },
                                        { label: 'Mass BMI', value: vitals.bmi, icon: User, color: 'slate', unit: 'kg/m²' }
                                    ].filter(v => v.value).map((v, i) => (
                                        <div key={i} className="flex items-center gap-6 px-8 py-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-500 group">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-${v.color}-50 text-${v.color}-500 shadow-inner group-hover:scale-110 transition-transform`}>
                                                <v.icon className="w-7 h-7" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{v.label}</span>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter leading-none">{v.value}</span>
                                                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{v.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {renderSection('pe', true, 'Full Physical Examination Narrative', <div className="text-slate-800 whitespace-pre-wrap leading-[2] bg-slate-50/70 p-10 rounded-[3rem] border border-blue-100/50 font-semibold text-[15px] shadow-inner" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />)}

                            {renderSection('assessment', true, 'Clinical Assessment & Impression',
                                <div className="space-y-6 pt-2">
                                    {noteData.assessment ? noteData.assessment.split('\n').filter(line => line.trim()).map((line, i) => (
                                        <div key={i} className="text-2xl font-black text-slate-900 tracking-tighter leading-snug p-6 bg-blue-50/40 rounded-3xl border-l-[8px] border-blue-600">{line}</div>
                                    )) : <p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-[11px]">Encounter Impression Pending State Sync</p>}
                                </div>
                            )}

                            {renderSection('plan', true, 'Strategic Diagnostic & Therapeutic Plan',
                                noteData.planStructured?.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                                        {noteData.planStructured.map((p, i) => (
                                            <div key={i} className="p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 rounded-full -mr-24 -mt-24 blur-[100px] group-hover:bg-blue-600/15 transition-all"></div>
                                                <div className="flex gap-6 mb-8 items-start">
                                                    <span className="w-12 h-12 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-2xl shrink-0 group-hover:rotate-12 transition-transform">{i + 1}</span>
                                                    <h4 className="text-xl font-black text-slate-900 leading-tight pt-1 tracking-tight">{p.diagnosis}</h4>
                                                </div>
                                                <ul className="space-y-4 pl-16">
                                                    {p.orders.map((o, j) => (
                                                        <li key={j} className="text-[14px] font-extrabold text-slate-500 flex items-start gap-5 group/item">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.6)] group-hover/item:scale-125 transition-all"></div>
                                                            {o}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-slate-700 leading-relaxed font-bold bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 italic text-[15px]">{noteData.plan}</div>
                            )}

                            {/* Secondary Institutional Directives */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-16 border-t border-slate-50">
                                <div className="space-y-8">
                                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Unified Institutional Care Strategy</h3>
                                    <div className="p-8 bg-blue-50/20 text-blue-900 text-[14px] font-black leading-relaxed rounded-[2.5rem] border border-blue-100/30 shadow-inner">
                                        {noteData.carePlan || patient.care_plan_summary || 'No institutional strategy required for this encounter.'}
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Therapeutic Maintenance Directive</h3>
                                    <div className="flex items-center gap-8 p-8 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-sm">
                                        <div className="w-20 h-20 rounded-[1.75rem] bg-white shadow-2xl flex items-center justify-center text-blue-600 border border-slate-50 shrink-0">
                                            <Calendar className="w-10 h-10" />
                                        </div>
                                        <div className="leading-tight space-y-2">
                                            <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] leading-none">Diagnostic Interval</div>
                                            <div className="text-2xl font-black text-blue-600 tracking-tighter leading-none">{noteData.followUp || visit.follow_up_instructions || 'Routine Maintenance PRN'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Encounter Professional Verification */}
                        <div className="mt-24 pt-20 border-t border-slate-100 flex flex-wrap justify-between items-center gap-12 opacity-80 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-1000">
                            <div className="flex gap-8 items-center">
                                <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl italic shadow-[0_20px_50px_rgba(0,0,0,0.3)] skew-x-[-8deg] border-2 border-white/10">
                                    {providerName.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-3">{providerName}</div>
                                    <div className="flex items-center gap-3 text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em]">
                                        <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-pulse"></div>
                                        Electronic Credential Verified
                                    </div>
                                </div>
                            </div>
                            <div className="text-right space-y-4">
                                <div className="flex items-center gap-5 justify-end">
                                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">InterLink Platform</span>
                                    <div className="px-6 py-2 bg-slate-950 text-white rounded-xl text-[11px] font-black tracking-[0.5em] uppercase italic shadow-[0_15px_30px_rgba(0,0,0,0.2)] border border-white/10 shrink-0">PageMD</div>
                                </div>
                                <div className="text-[9px] text-slate-200 font-black uppercase tracking-[0.6em] pl-1">Clinical Immutable Ledger • Build Stable v2025.12.A</div>
                            </div>
                        </div>

                        {/* Amendments Manifest */}
                        {addendums.length > 0 && (
                            <div className="mt-32 pt-16 border-t-[12px] border-slate-50">
                                <div className="flex items-center gap-6 mb-16">
                                    <h3 className="text-[14px] font-black text-blue-600 uppercase tracking-[0.6em] whitespace-nowrap">Clinical Manifest Amendments</h3>
                                    <div className="w-full h-px bg-blue-100"></div>
                                </div>
                                <div className="space-y-8">
                                    {addendums.map((a, i) => (
                                        <div key={i} className="p-10 bg-slate-50/50 border border-slate-100 rounded-[3rem] relative shadow-inner">
                                            <div className="flex items-center justify-between mb-8">
                                                <div className="flex items-center gap-5 text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center italic text-blue-600 font-serif text-lg">{a.addedByName?.charAt(0)}</div>
                                                    {a.addedByName}
                                                </div>
                                                <div className="px-4 py-1.5 bg-white rounded-full border border-slate-100 text-[10px] font-black text-slate-300 uppercase tabular-nums tracking-widest">{format(new Date(a.addedAt), 'MMM dd, yyyy • HH:mm')}</div>
                                            </div>
                                            <div className="text-[16px] font-bold text-slate-600 leading-relaxed italic pl-16 border-l-4 border-blue-200 py-3 ml-6">
                                                {a.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                    <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-400'}`}>{c.status}</div>
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
