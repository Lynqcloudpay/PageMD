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
            <div key={key} className={`py-6 border-b border-slate-100 last:border-0 ${className}`}>
                <h2 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                    {title}
                </h2>
                <div className="text-slate-700 leading-relaxed text-[13px]">
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
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
                    {/* Professional Toolbar */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <Stethoscope className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 leading-none mb-1">Clinical Note</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visit.visit_type || 'Office Visit'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSigned && (
                                <button onClick={() => setShowAddendumModal(true)} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 transition-all text-slate-600"><FilePlus className="w-3.5 h-3.5" />Addendum</button>
                            )}
                            <button onClick={handleCreateSuperbill} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 transition-all text-slate-600"><Receipt className="w-3.5 h-3.5" />Superbill</button>
                            <button onClick={() => setShowBillingModal(true)} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 transition-all text-slate-600"><DollarSign className="w-3.5 h-3.5" />Billing</button>
                            <button onClick={handlePrint} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"><Printer className="w-3.5 h-3.5" />Print Note</button>
                            <div className="w-px h-6 bg-slate-100 mx-2"></div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
                        </div>
                    </div>

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-white p-12">
                        {/* Clinic Header */}
                        <div className="mb-12 flex justify-between items-start">
                            <div className="flex gap-8 items-center">
                                {clinicInfo.logo && (
                                    <div className="w-24 h-24 flex items-center justify-center p-2 border border-slate-100 rounded-2xl bg-slate-50/50">
                                        <img src={clinicInfo.logo} className="max-h-full max-w-full object-contain filter grayscale opacity-80" alt="Clinic Logo" />
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{clinicInfo.name}</h1>
                                    <div className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
                                        <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {clinicInfo.address.replace(/\n/g, ' • ')}</div>
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {clinicInfo.phone}</span>
                                            {clinicInfo.fax && <span className="flex items-center gap-1.5"><Printer className="w-3 h-3" /> Fax: {clinicInfo.fax}</span>}
                                            <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {clinicInfo.website}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-slate-900 tabular-nums mb-1">{visitDate}</div>
                                <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">{providerName}</div>
                            </div>
                        </div>

                        {/* Patient Information Card */}
                        <div className="mb-10 bg-slate-50/50 border border-slate-100 rounded-3xl p-8 flex justify-between items-center group hover:bg-slate-50 transition-colors duration-500">
                            <div className="flex items-center gap-8">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 text-slate-300">
                                    <User className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">Patient Record</p>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                                        {patient.last_name}, <span className="text-slate-400">{patient.first_name}</span>
                                    </h2>
                                </div>
                            </div>
                            <div className="flex gap-12 border-l border-slate-200 pl-12 h-14 items-center">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">MRN</p>
                                    <p className="text-lg font-black text-slate-800 tabular-nums">{patient.mrn}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">DOB</p>
                                    <p className="text-lg font-black text-slate-800 tabular-nums">{patientDOB} <span className="text-slate-300 ml-1 text-sm font-bold">({patientAge}y)</span></p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Sex</p>
                                    <p className="text-lg font-black text-slate-800 uppercase flex items-center justify-center bg-white w-9 h-9 rounded-xl border border-slate-100 shadow-sm">{(patient.sex || 'U').charAt(0)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Clinical Sections */}
                        <div className="space-y-2">
                            {renderSection('cc', true, 'Chief Complaint', <div className="text-lg font-bold text-slate-900 tracking-tight">{noteData.chiefComplaint || 'No active complaint'}</div>)}

                            {renderSection('hpi', true, 'History of Present Illness', <div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{noteData.hpi || 'History not obtained'}</div>)}

                            {renderSection('ros', true, 'Review of Systems', <div className="text-slate-600 leading-relaxed max-w-4xl" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />)}

                            {/* Triple Grid for Background Context */}
                            <div className="py-8 grid grid-cols-1 md:grid-cols-3 gap-12 border-b border-slate-100">
                                <div>
                                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-red-400 rounded-full"></span>
                                        Allergies
                                    </h3>
                                    {allergies.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {allergies.map((a, i) => <span key={i} className="px-3 py-1 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg border border-red-100">{a.allergen}</span>)}
                                        </div>
                                    ) : <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">No Known Drug Allergies</p>}
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-blue-400 rounded-full"></span>
                                        Active Medications
                                    </h3>
                                    <div className="space-y-2">
                                        {medications.length > 0 ? medications.map((m, i) => (
                                            <div key={i} className="text-[11px] font-bold text-slate-700 flex justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100/50">
                                                <span>{m.medication_name}</span>
                                                <span className="text-slate-400 uppercase">{m.dosage}</span>
                                            </div>
                                        )) : <p className="text-slate-300 italic text-xs">No active prescriptions</p>}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-slate-400 rounded-full"></span>
                                        Problem List
                                    </h3>
                                    <div className="space-y-2">
                                        {problems.length > 0 ? problems.map((p, i) => (
                                            <div key={i} className="text-[11px] font-bold text-slate-700 flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                {p.problem_name}
                                            </div>
                                        )) : <p className="text-slate-300 italic text-xs">Non-contributory</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Vitals Ribbon */}
                            {vitals && renderSection('vitals', true, 'Clinical Vitals',
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        { label: 'BP', value: vitals.bp, icon: Heart, unit: 'mmHg' },
                                        { label: 'Pulse', value: vitals.pulse, icon: Activity, unit: 'bpm' },
                                        { label: 'Temp', value: vitals.temp, icon: Thermometer, unit: '°F' },
                                        { label: 'SpO2', value: vitals.o2sat, icon: Wind, unit: '%' },
                                        { label: 'BMI', value: vitals.bmi, icon: User, unit: '' }
                                    ].filter(v => v.value).map((v, i) => (
                                        <div key={i} className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl mr-3">
                                            <v.icon className="w-4 h-4 text-slate-400" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{v.label}</span>
                                                <span className="text-sm font-black text-slate-900 leading-none">{v.value}<span className="text-[10px] text-slate-300 ml-1 ml-0.5">{v.unit}</span></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {renderSection('pe', true, 'Physical Examination', <div className="text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50/30 p-6 rounded-[2rem] border border-slate-100" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />)}

                            {renderSection('assessment', true, 'Clinical Assessment',
                                <div className="space-y-2 border-l-4 border-blue-500 pl-6">
                                    {noteData.assessment ? noteData.assessment.split('\n').filter(line => line.trim()).map((line, i) => (
                                        <div key={i} className="text-base font-bold text-slate-800 tracking-tight leading-snug underline decoration-slate-100 underline-offset-4">{line}</div>
                                    )) : <p className="text-slate-300 italic">No assessment provided</p>}
                                </div>
                            )}

                            {renderSection('plan', true, 'Therapeutic Plan',
                                noteData.planStructured?.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                        {noteData.planStructured.map((p, i) => (
                                            <div key={i} className="p-6 bg-slate-50/50 border border-slate-200/50 rounded-2xl group hover:border-blue-200 transition-colors">
                                                <div className="flex gap-4 mb-4">
                                                    <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md shrink-0">{i + 1}</span>
                                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{p.diagnosis}</h4>
                                                </div>
                                                <ul className="space-y-2 pl-12">
                                                    {p.orders.map((o, j) => (
                                                        <li key={j} className="text-xs font-bold text-slate-500 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1.5 shrink-0" />
                                                            {o}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{noteData.plan}</div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
                                <div>
                                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Care Plan Summary</h3>
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                        {noteData.carePlan || patient.care_plan_summary || 'No care plan established'}
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Follow-up Instructions</h3>
                                    <div className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                        <p className="text-sm font-black text-blue-700 uppercase tracking-tight">{noteData.followUp || visit.follow_up_instructions || 'Return Visit PRN'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Signature Block */}
                        <div className="mt-16 pt-12 border-t border-slate-100 flex justify-between items-end grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-6">Electronically Certified By</div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-lg italic uppercase shadow-xl">
                                        {providerName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-lg font-black text-slate-900 leading-none mb-1">{providerName}</div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Authorized MD
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.4em] mb-2 leading-none">System Platform Integration</p>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 italic">
                                    <span className="text-[9px] font-black text-slate-400 tracking-widest">PageMD EMR</span>
                                    <div className="w-1 h-1 rounded-full bg-blue-300"></div>
                                    <span className="text-[8px] font-bold text-slate-300 tabular-nums uppercase tracking-widest">v2025.12.29</span>
                                </div>
                            </div>
                        </div>

                        {/* Addendums */}
                        {addendums.length > 0 && (
                            <div className="mt-20 pt-10 border-t-4 border-slate-50">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
                                    <FilePlus className="w-4 h-4" />
                                    Clinical Record Amendments
                                </h3>
                                <div className="space-y-6">
                                    {addendums.map((a, i) => (
                                        <div key={i} className="p-8 bg-slate-50/30 border border-slate-100 rounded-3xl relative">
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-900">{a.addedByName?.charAt(0)}</div>
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{a.addedByName}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter tabular-nums">{format(new Date(a.addedAt), 'MM/dd/yyyy HH:mm')}</span>
                                            </div>
                                            <div className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-6">
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
