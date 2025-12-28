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
            <div key={key} className={`relative group/section ${className}`}>
                <div className="relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
                        {title}
                    </h2>
                    <div className="text-slate-800 leading-relaxed text-sm font-medium">
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
            <div className="fixed inset-0 bg-slate-900/20 z-50 flex items-center justify-center p-2 backdrop-blur-sm print:hidden">
                <div className="bg-[#fcfdfe] rounded-[2.5rem] shadow-2xl max-w-5xl w-full max-h-[96vh] overflow-hidden flex flex-col border border-white">
                    {/* Milky Glass Header Toolbar */}
                    <div className="px-8 py-3 border-b border-slate-100 flex items-center justify-between bg-white/80">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.3)]"></div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none">Clinical System v2.4</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSigned && (
                                <button onClick={() => setShowAddendumModal(true)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl flex items-center gap-2 shadow-sm transition-all"><FilePlus className="w-3.5 h-3.5 text-primary-500" />Addendum</button>
                            )}
                            <button onClick={handleCreateSuperbill} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl flex items-center gap-2 shadow-sm transition-all"><Receipt className="w-3.5 h-3.5 text-secondary-500" />Superbill</button>
                            <button onClick={() => setShowBillingModal(true)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl flex items-center gap-2 shadow-sm transition-all"><DollarSign className="w-3.5 h-3.5 text-emerald-500" />Billing</button>
                            <button onClick={handlePrint} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl flex items-center gap-2 shadow-sm transition-all"><Printer className="w-3.5 h-3.5 text-slate-500" />Print</button>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-2xl transition-all ml-2"><X className="w-6 h-6 text-slate-300" /></button>
                        </div>
                    </div>

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto py-8 px-12 relative bg-[#fcfdfe]">
                        {/* Soft Brand Elements (Opaque) */}
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-50/40 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none opacity-40"></div>

                        {/* Addendum Alert Banner */}
                        {addendums.length > 0 && (
                            <div className="mb-6 bg-amber-50/80 border border-amber-200/50 rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-200/5 to-transparent"></div>
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                                    <FilePlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-0.5">Clinical Appendage Detected</div>
                                    <div className="text-xs font-bold text-amber-900/60">This record has been supplemented with authenticated addendums. Review clinical appendicies at the footer.</div>
                                </div>
                                <div className="ml-auto">
                                    <div className="px-3 py-1 bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-900/10">Action Required</div>
                                </div>
                            </div>
                        )}

                        {/* Clinic Brand Header */}
                        <div className="mb-10 flex justify-between items-start relative z-10">
                            <div className="flex gap-6 items-start">
                                <div className="w-20 h-20 bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex items-center justify-center overflow-hidden p-3 group shrink-0">
                                    {clinicInfo.logo ? <img src={clinicInfo.logo} className="max-h-full object-contain" /> : <Building2 className="text-primary-100 w-12 h-12" />}
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{clinicInfo.name}</h1>
                                    {/* Clinic Address */}
                                    {clinicInfo.address && (
                                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-primary-300 shrink-0" />
                                            <span>{clinicInfo.address.replace(/\n/g, ' • ')}</span>
                                        </div>
                                    )}
                                    {/* Contact Row */}
                                    <div className="flex flex-wrap items-center gap-4 text-[10px]">
                                        {clinicInfo.phone && (
                                            <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                <Phone className="w-3 h-3 text-primary-400" />
                                                {clinicInfo.phone}
                                            </span>
                                        )}
                                        {clinicInfo.fax && (
                                            <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                <Printer className="w-3 h-3 text-indigo-400" />
                                                Fax: {clinicInfo.fax}
                                            </span>
                                        )}
                                        {clinicInfo.email && (
                                            <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                <Mail className="w-3 h-3 text-emerald-400" />
                                                {clinicInfo.email}
                                            </span>
                                        )}
                                        {clinicInfo.website && (
                                            <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                <Globe className="w-3 h-3 text-blue-400" />
                                                {clinicInfo.website}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500/50 mb-1">{visit.visit_type || 'Clinical SOAP Note'}</div>
                                <div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">{visitDate}</div>
                                <div className="inline-block px-3 py-1 bg-primary-50 text-[10px] uppercase font-black tracking-widest text-primary-500 rounded-lg">{providerName}</div>
                            </div>
                        </div>

                        {/* Solid Frothy Patient Snapshot */}
                        <div className="mb-8 relative z-10">
                            <div className="relative bg-white rounded-[2rem] border border-slate-100 p-6 shadow-xl shadow-slate-200/40">
                                <div className="flex flex-wrap items-center justify-between gap-8">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 relative overflow-hidden group shrink-0">
                                            <Stethoscope className="text-primary-200 w-8 h-8 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black tracking-[0.4em] text-primary-300 uppercase leading-none">Primary Subject</div>
                                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                                                {patient.last_name}, <span className="text-primary-500/70">{patient.first_name}</span>
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-8 md:border-l border-slate-100 md:pl-8 h-12">
                                        <div className="space-y-1.5 text-center">
                                            <span className="text-[8px] font-black text-slate-300 uppercase block tracking-[0.2em]">MRN IDENTIFIER</span>
                                            <span className="text-sm font-black text-slate-700 tabular-nums">{patient.mrn}</span>
                                        </div>
                                        <div className="space-y-1.5 text-center px-8 border-x border-slate-50">
                                            <span className="text-[8px] font-black text-slate-300 uppercase block tracking-[0.2em]">AGE</span>
                                            <span className="text-sm font-black text-slate-700 tracking-tight">{patientDOB} <span className="text-primary-400 ml-1.5">({patientAge}y)</span></span>
                                        </div>
                                        <div className="space-y-1.5 text-center">
                                            <span className="text-[8px] font-black text-slate-300 uppercase block tracking-[0.2em]">SEX</span>
                                            <span className="text-sm font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-xl uppercase">{(patient.sex || 'U').charAt(0)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Row */}
                                <div className="mt-6 pt-6 border-t border-slate-50 flex flex-wrap gap-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-primary-400 border border-slate-100 shadow-sm"><Phone className="w-4 h-4" /></div>
                                        <div className="leading-tight">
                                            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Phone</div>
                                            <div className="text-[12px] font-bold text-slate-600">{patient.phone || patient.mobile_phone || patient.home_phone || 'Not provided'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-400 border border-slate-100 shadow-sm"><Mail className="w-4 h-4" /></div>
                                        <div className="leading-tight">
                                            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Email</div>
                                            <div className="text-[12px] font-bold text-slate-600 lowercase">{patient.email || patient.email_address || 'Not provided'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-emerald-400 border border-slate-100 shadow-sm"><MapPin className="w-4 h-4" /></div>
                                        <div className="leading-tight">
                                            <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Address</div>
                                            <div className="text-[12px] font-bold text-slate-600">
                                                {[patient.street_address || patient.address_line1, patient.city, patient.state, patient.zip].filter(Boolean).join(', ') || 'Not provided'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Note Body (Milk Style - Opaque) */}
                        <div className="space-y-4 relative z-10">
                            {/* CC and HPI Stacked (Vertical) */}
                            <div className="space-y-4">
                                {renderSection('cc', true, 'Chief Complaint', <div className="text-base font-black text-slate-900 leading-tight py-1">{noteData.chiefComplaint || 'No active complaint'}</div>)}
                                {renderSection('hpi', true, 'History of Present Illness', <div className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{noteData.hpi || 'History not obtained'}</div>)}
                            </div>

                            {renderSection('ros', true, 'Review of Systems', <div className="text-[11px] font-medium text-slate-500 columns-2 md:columns-3 lg:columns-4 gap-8 leading-normal" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />)}

                            {/* Background Context (Solid Frothy) */}
                            <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:border-r border-slate-50 md:pr-4">
                                        <div className="text-[9px] font-black text-primary-300 uppercase mb-4 tracking-[0.2em] flex items-center gap-2">Patient Problems</div>
                                        {problems.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {problems.map((p, i) => <div key={i} className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-xl flex items-center gap-2 truncate"><span className="w-1 h-1 rounded-full bg-primary-200" />{p.problem_name}</div>)}
                                            </div>
                                        ) : <div className="text-xs italic text-slate-200">Non-contributory</div>}
                                    </div>
                                    <div className="md:border-r border-slate-50 md:pr-4">
                                        <div className="text-[9px] font-black text-rose-300 uppercase mb-4 tracking-[0.2em] flex items-center gap-2">Allergies</div>
                                        {allergies.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {allergies.map((a, i) => <div key={i} className="text-[10px] font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-xl border border-rose-100 shadow-sm">{a.allergen}</div>)}
                                            </div>
                                        ) : <div className="text-xs font-black text-emerald-500 uppercase flex items-center gap-2 tracking-[0.1em]"><CheckCircle2 className="w-4 h-4 opacity-50" /> NKDA</div>}
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-secondary-300 uppercase mb-4 tracking-[0.2em] flex items-center gap-2">Medications</div>
                                        {medications.length > 0 ? (
                                            <div className="space-y-2">
                                                {medications.map((m, i) => (
                                                    <div key={i} className="text-[11px] font-bold text-slate-700 flex justify-between bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                                        <span className="truncate">{m.medication_name}</span>
                                                        <span className="text-[10px] font-medium text-slate-400 uppercase ml-2 tabular-nums">{m.dosage}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <div className="text-xs italic text-slate-200">None Noted</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Vitals Ribbon - Now just above PE */}
                            {renderSection('vitals', vitals, 'Clinical Vitals',
                                <div className="flex flex-wrap items-center gap-4 py-1">
                                    {vitals && [
                                        { icon: Heart, k: 'BP', v: vitals.bp, c: 'rose' },
                                        { icon: Activity, k: 'HR', v: vitals.pulse, c: 'rose' },
                                        { icon: Thermometer, k: 'Temp', v: vitals.temp, c: 'amber' },
                                        { icon: Wind, k: 'SaO2', v: vitals.o2sat, c: 'blue' },
                                        { icon: User, k: 'BMI', v: vitals.bmi, c: 'slate' }
                                    ].filter(item => item.v).map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:bg-white transition-all">
                                            <div className={`p-2 rounded-xl bg-${item.c}-500/10`}>
                                                <item.icon className={`w-4 h-4 text-${item.c}-400`} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{item.k}</span>
                                                <span className="text-sm font-black text-slate-900 leading-none">{item.v}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {renderSection('pe', true, 'Physical Examination', <div className="text-slate-700 text-[13px] font-medium leading-[1.8] whitespace-pre-wrap min-h-[80px] bg-slate-50 p-5 rounded-[2rem] border border-slate-100" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />)}

                            {/* Assessment & Plan */}
                            <div className="space-y-6 pt-4 border-t border-slate-50">
                                {renderSection('assessment', true, 'Clinical Assessment',
                                    <div className="space-y-2 border-l-[6px] border-primary-500/10 pl-6 py-1">
                                        {noteData.assessment ? noteData.assessment.split('\n').filter(line => line.trim()).map((line, i) => (
                                            <div key={i} className="text-base font-bold text-slate-800 tracking-tight leading-snug">{line}</div>
                                        )) : <span className="text-slate-200 italic">Assessment data sync required</span>}
                                    </div>
                                )}

                                {renderSection('plan', true, 'Therapeutic Plan',
                                    noteData.planStructured?.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {noteData.planStructured.map((p, i) => (
                                                <div key={i} className="p-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all duration-300">
                                                    <div className="flex gap-3 mb-3 items-start">
                                                        <span className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-[11px] shadow-lg shrink-0 mt-0.5">{i + 1}</span>
                                                        <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-tight pt-1 leading-tight">{p.diagnosis}</h4>
                                                    </div>
                                                    <ul className="space-y-1.5 pl-10 pr-2">
                                                        {p.orders.map((o, j) => (
                                                            <li key={j} className="text-[11px] font-bold text-slate-500 flex items-start gap-2.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary-200 mt-1.5 shrink-0" />
                                                                {o}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="text-sm font-medium text-slate-600 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 italic">{noteData.plan}</div>
                                )}
                            </div>

                            {/* Care Plan & Follow-up */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4 border-t border-slate-50">
                                {renderSection('carePlan', noteData.carePlan || patient.care_plan_summary, 'Care Plan',
                                    <div className="text-[12px] font-medium text-slate-600 leading-relaxed bg-primary-50/30 p-4 rounded-2xl border border-primary-100/30">
                                        {noteData.carePlan || patient.care_plan_summary}
                                    </div>
                                )}
                                {renderSection('followUp', noteData.followUp || visit.follow_up_instructions, 'Follow-up Instructions',
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary-500 border border-slate-50 shrink-0">
                                            <Calendar className="w-6 h-6" />
                                        </div>
                                        <div className="leading-tight">
                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1.5 font-sans">Maintenance Interval</div>
                                            <div className="text-sm font-black text-primary-600 font-sans">{noteData.followUp || visit.follow_up_instructions || 'Return Visit PRN'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Addendums - Opaque Stack */}
                            {addendums.length > 0 && (
                                <div className="mt-10 pt-6 border-t border-slate-50">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/60 mb-5 flex items-center gap-3"><FilePlus className="w-4 h-4 pr-1" /> Authenticated Addendums</h3>
                                    <div className="space-y-3">
                                        {addendums.map((a, i) => (
                                            <div key={i} className="p-5 bg-amber-50/10 border border-amber-100/30 rounded-[2rem] shadow-sm relative overflow-hidden group">
                                                <div className="flex items-center justify-between mb-4 border-b border-amber-100/20 pb-4">
                                                    <div className="flex items-center gap-3 text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">
                                                        <div className="w-8 h-8 rounded-xl bg-amber-100/50 flex items-center justify-center text-[11px] italic">{a.addedByName?.charAt(0)}</div>
                                                        {a.addedByName}
                                                    </div>
                                                    <div className="text-[9px] font-black text-amber-300 uppercase tracking-tighter flex items-center gap-2"><Clock className="w-3.5 h-3.5" />{format(new Date(a.addedAt), 'MMM dd, yyyy HH:mm')}</div>
                                                </div>
                                                <div className="text-[13px] font-semibold text-amber-900 leading-relaxed italic border-l-4 border-amber-200/50 pl-5">{a.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Signature Block (Solid Brand) */}
                        <div className="mt-16 pt-10 border-t border-slate-100 flex flex-wrap justify-between items-center gap-8 px-2 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex gap-5 items-center">
                                <div className="w-14 h-14 bg-slate-900 rounded-[1.2rem] flex items-center justify-center text-white font-black text-xl italic shadow-2xl border border-white">
                                    {providerName.charAt(0)}
                                </div>
                                <div className="leading-tight pt-1">
                                    <div className="text-base font-black text-slate-900 tracking-tighter leading-none mb-1">{providerName}</div>
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500/70">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        Digitally Authenticated
                                    </div>
                                </div>
                            </div>
                            <div className="text-right leading-none space-y-3">
                                <div className="flex items-center gap-3 justify-end text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                                    <span>Engineered by</span>
                                    <span className="px-3 py-1 bg-slate-950 text-white rounded-xl text-[9px] tracking-[0.3em] shadow-xl border border-white/10 italic">PageMD</span>
                                </div>
                                <div className="text-[8px] text-slate-200 font-black tracking-widest uppercase pl-1">Clinical Link • Local Build 27.60</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Solid Frothy Modals */}
            {showAddendumModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowAddendumModal(false)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-10 border border-slate-50" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Record Patch</h3>
                                <div className="text-[10px] font-black text-amber-500/70 uppercase tracking-[0.2em] pl-0.5">Clinical Supplemental Verification</div>
                            </div>
                            <button onClick={() => setShowAddendumModal(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-300" /></button>
                        </div>
                        <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} className="w-full h-48 bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-bold focus:ring-[12px] focus:ring-primary-500/5 focus:border-primary-400 outline-none transition-all placeholder:text-slate-200 shadow-inner" placeholder="Enter clinical context supplement..." />
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setShowAddendumModal(false)} className="px-8 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors">Discard</button>
                            <button onClick={handleAddAddendum} className="px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/30 hover:scale-105 active:scale-95 transition-all">Patch Record</button>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-10 border border-slate-50" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8 pb-6 border-b">
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Financial Audit</h3>
                        <div className="text-[10px] font-black text-emerald-500/70 uppercase tracking-[0.2em] pl-0.5">Claim Transmission Log</div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-300" /></button>
                </div>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">
                    {claims.map((c, i) => (
                        <div key={i} className="group p-5 bg-slate-50 border border-slate-100 rounded-[2rem] flex justify-between items-center hover:bg-white transition-all shadow-sm">
                            <div className="space-y-1.5">
                                <div className="text-sm font-black text-slate-900 tracking-tight">{format(new Date(c.visit_date), 'MMMM dd, yyyy')}</div>
                                <div className="flex items-center gap-3">
                                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-100 text-slate-300'}`}>{c.status}</div>
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">{c.visit_type || 'Procedure/Evaluation'}</div>
                                </div>
                            </div>
                            <div className="text-2xl font-black text-slate-900 tracking-tighter">${c.total_amount}</div>
                        </div>
                    ))}
                    {claims.length === 0 && <div className="text-center py-20 text-slate-200 font-bold uppercase tracking-widest text-[10px]">Financials Sync Required</div>}
                </div>
                <div className="mt-10 pt-8 border-t border-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-12 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/30">Exit Audit</button>
                </div>
            </div>
        </div>
    );
};

export default VisitChartView;
