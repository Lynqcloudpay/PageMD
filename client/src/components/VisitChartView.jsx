import React, { useState, useEffect } from 'react';
import { Activity, FileText, Printer, X, AlertCircle, CheckCircle2, User, Phone, Mail, MapPin, Building2, Stethoscope, CreditCard, Users, FilePlus, Receipt, DollarSign, Globe, Clock, Heart, Thermometer, Wind, Pill, Lock, ClipboardList, ChevronDown, Shield, RotateCcw, FileSignature, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI, billingAPI, codesAPI, settingsAPI, documentsAPI, auditAPI } from '../services/api';
import { format } from 'date-fns';
import PatientChartPanel from './PatientChartPanel';
import { useAuth } from '../context/AuthContext';
import CosignModal from './CosignModal';

const VisitChartView = ({ visitId, patientId, onClose, standalone = true, onOpenNewVisit }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeVisitId, setActiveVisitId] = useState(visitId);
    const [allVisits, setAllVisits] = useState([]);
    const [showPatientChart, setShowPatientChart] = useState(false);
    const [patient, setPatient] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
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
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [retractReason, setRetractReason] = useState('ENTERED_IN_ERROR');
    const [retractExplanation, setRetractExplanation] = useState('');
    const [isRetracting, setIsRetracting] = useState(false);
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
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showCosignModal, setShowCosignModal] = useState(false);
    const [attestationText, setAttestationText] = useState('');
    const [authorshipModel, setAuthorshipModel] = useState('Addendum');
    const [attestationMacros] = useState([
        { id: 'REVIEWED', name: 'Reviewed & Agreed', content: 'I have reviewed the trainee note and agree with the assessment and plan as documented.' },
        { id: 'PRESENT', name: 'Physically Present', content: 'I was physically present with the trainee for the key portions of this encounter and agree with the documentation.' },
        { id: 'EXAMINED', name: 'Personally Examined', content: 'I personally examined the patient and discussed the management plan with the trainee. I agree with their findings.' }
    ]);
    const [noteHistory, setNoteHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (activeVisitId && patientId) {
            fetchData();
        }
    }, [activeVisitId, patientId]);

    const fetchNoteHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await auditAPI.getNoteHistory(activeVisitId);
            setNoteHistory(res.data || []);
        } catch (e) {
            console.warn('Failed to fetch note history', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (showAuditModal && activeVisitId) {
            fetchNoteHistory();
        }
    }, [showAuditModal, activeVisitId]);

    const decodeHtmlEntities = (text) => {
        if (typeof text !== 'string') return String(text || '');
        let str = text;
        if (typeof document !== 'undefined') {
            const txt = document.createElement('textarea');
            for (let i = 0; i < 4; i++) {
                const prev = str;
                txt.innerHTML = str;
                str = txt.value;
                str = str.replace(/&#x2F;/ig, '/').replace(/&#47;/g, '/').replace(/&sol;/g, '/');
                if (str === prev) break;
            }
        } else {
            str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/ig, '/');
        }
        return str;
    };

    const formatMarkdownBold = (text) => {
        if (typeof text !== 'string') return String(text || '');
        return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    };

    const parseNoteText = (textRaw) => {
        const text = typeof textRaw === 'string' ? textRaw : String(textRaw || '');
        if (!text.trim()) return { chiefComplaint: '', hpi: '', assessment: '', plan: '', rosNotes: '', peNotes: '' };
        const decodedText = decodeHtmlEntities(text);

        const chiefComplaintMatch = decodedText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const chiefComplaint = chiefComplaintMatch ? decodeHtmlEntities(chiefComplaintMatch[1].trim()) : '';

        const hpiMatch = decodedText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):|$)/is);
        const hpi = hpiMatch ? decodeHtmlEntities(hpiMatch[1].trim()) : '';

        const rosMatch = decodedText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):|$)/is);
        const rosNotes = rosMatch ? decodeHtmlEntities(rosMatch[1].trim()) : '';

        const peMatch = decodedText.match(/(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Results|Assessment|Plan):|$)/is);
        const peNotes = peMatch ? decodeHtmlEntities(peMatch[1].trim()) : '';

        const resultsMatch = decodedText.match(/(?:Results|Results \/ Data):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):|$)/is);
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
        let currentMDM = null;
        let currentInstructions = null;
        let inMDM = false;

        const finalizePrev = () => {
            if (currentDiagnosis) {
                structured.push({
                    diagnosis: currentDiagnosis,
                    orders: [...currentOrders],
                    mdm: currentMDM,
                    instructions: currentInstructions
                });
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const safeLine = typeof line === 'string' ? line : String(line || '');
            const diagnosisMatch = safeLine.match(/^(\d+)\.\s*(.+)$/);
            if (diagnosisMatch) {
                finalizePrev();
                currentDiagnosis = diagnosisMatch[2].trim();
                currentOrders = [];
                currentMDM = null;
                currentInstructions = null;
                inMDM = false;
            } else if (line.startsWith('MDM:')) {
                currentMDM = line.replace(/^MDM:\s*/, '').trim();
                inMDM = true;
            } else if (line.startsWith('Plan:') || line.startsWith('Instructions:')) {
                currentInstructions = line.replace(/^(Plan|Instructions):\s*/, '').trim();
                inMDM = false;
            } else if (line.startsWith('•') || line.startsWith('-')) {
                const orderText = line.replace(/^[•\-]\s*/, '').trim();
                if (orderText && currentDiagnosis) {
                    currentOrders.push(orderText);
                }
                inMDM = false;
            } else if (line && currentDiagnosis) {
                // If we were reading MDM and this is a continuation line, append to MDM
                if (inMDM && currentMDM !== null) {
                    currentMDM += ' ' + line;
                } else {
                    currentOrders.push(line);
                }
            }
        }
        finalizePrev();
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
            <div key={key} className={`py-6 border-b border-blue-50 last:border-0 ${className}`}>
                <h2 className="text-[12px] font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {title}
                </h2>
                <div className="text-gray-600 leading-relaxed text-[15px] selection:bg-blue-100">
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

            const visitData = visitRes.data;
            setVisit(visitData);
            setAllVisits(allVisitsRes.data || []);

            // ================================================================
            // CLINICAL SNAPSHOT: For signed notes, use frozen data from signing
            // ================================================================
            const isSigned = visitData?.note_signed_at || visitData?.locked;
            let parsedSnapshot = null;

            if (isSigned && visitData?.clinical_snapshot) {
                try {
                    parsedSnapshot = typeof visitData.clinical_snapshot === 'string'
                        ? JSON.parse(visitData.clinical_snapshot)
                        : visitData.clinical_snapshot;

                    // Validate snapshot structure
                    if (!parsedSnapshot || !parsedSnapshot.demographics) {
                        console.warn('Snapshot missing demographics, ignoring');
                        parsedSnapshot = null;
                    }
                } catch (e) {
                    console.warn('Failed to parse clinical_snapshot:', e);
                }
            }

            setSnapshot(parsedSnapshot);

            if (parsedSnapshot && parsedSnapshot.demographics) {
                // Use FROZEN snapshot data for signed notes

                // Demographics from snapshot
                // IMPORTANT: Ensure we preserve IDs from live data but strictly override display fields
                setPatient({
                    ...patientRes.data, // Keep id, mrn
                    ...parsedSnapshot.demographics // Override with frozen data
                });

                // Use snapshot data for clinical history
                setAllergies(parsedSnapshot.allergies || []);
                setMedications(parsedSnapshot.medications || []);
                setProblems(parsedSnapshot.problems || []);
                setFamilyHistory(parsedSnapshot.family_history || []);
                setSocialHistory(parsedSnapshot.social_history || null);
            } else {
                // Use LIVE/CURRENT data
                setPatient(patientRes.data);
                setAllergies(allergiesRes.data || []);
                setMedications(medicationsRes.data || []);
                setProblems(problemsRes.data || []);
                setFamilyHistory(familyHistoryRes.data || []);
                setSocialHistory(socialHistoryRes.data);
            }

            // Filter documents for this visit
            const allDocs = documentsRes?.data || [];
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

            if (visitData.addendums) {
                setAddendums(Array.isArray(visitData.addendums) ? visitData.addendums : JSON.parse(visitData.addendums || '[]'));
            }

            if (visitData.vitals) {
                let v = visitData.vitals;
                if (typeof v === 'string') {
                    try { v = JSON.parse(v); } catch (e) { v = null; }
                }
                if (v && typeof v === 'object') {
                    const decodedVitals = {};
                    Object.keys(v).forEach(key => {
                        decodedVitals[key] = decodeHtmlEntities(v[key]);
                    });
                    setVitals(decodedVitals);
                }
            }

            if (visitData.note_draft) {
                const parsed = parseNoteText(visitData.note_draft);
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

    const handleRetract = async () => {
        if (!retractExplanation.trim()) return;
        setIsRetracting(true);
        try {
            await visitsAPI.retract(activeVisitId, {
                reason_code: retractReason,
                reason_text: retractExplanation
            });
            // Reload data to reflect retracted status
            await fetchData();
            setShowRetractModal(false);
            setRetractExplanation('');
        } catch (e) {
            console.error('Failed to retract note', e);
            const errorMsg = e.response?.data?.error || 'Failed to retract note';
            alert(errorMsg);
        } finally {
            setIsRetracting(false);
        }
    };

    const handleCosign = async (text, model) => {
        try {
            await visitsAPI.cosign(activeVisitId, {
                attestationText: text || attestationText,
                authorshipModel: model || authorshipModel
            });
            setShowCosignModal(false);
            setAttestationText('');
            await fetchData();
        } catch (error) {
            console.error('Error cosigning note:', error);
            alert('Failed to cosign note: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleReject = async () => {
        const reason = window.prompt('Please enter a reason for rejecting/returning this note:');
        if (!reason) return;
        try {
            await visitsAPI.reject(activeVisitId, { reason });
            await fetchData();
        } catch (error) {
            console.error('Error rejecting note:', error);
            alert('Failed to reject note');
        }
    };

    const handleCreateSuperbill = async () => {
        onClose();
        navigate(`/patient/${patientId}/fee-sheet/${activeVisitId}`);
    };

    if (loading) return <div className="fixed inset-0 bg-gray-50/10 backdrop-blur-md flex items-center justify-center z-[100]"><div className="bg-white p-8 rounded-[2rem] shadow-2xl flex items-center gap-4 font-bold text-gray-900 tracking-tighter border border-gray-100"><div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>Retrieving Clinical Record...</div></div>;
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

        if (!src) return <div className="h-32 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 border border-gray-100 rounded-xl">Loading...</div>;
        return (
            <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm avoid-cut mb-2">
                <a href={src} target="_blank" rel="noopener noreferrer" className="block group relative">
                    <img src={src} alt={doc.filename} className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]" />
                    <div className="mt-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">{doc.filename}</div>
                </a>

                {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        {metrics.map((m, i) => (
                            <div key={i} className="bg-gray-50/50 p-1.5 rounded-lg border border-gray-100/30">
                                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1 opacity-60">{m.label}</span>
                                <span className="text-[11px] font-bold text-gray-800 tabular-nums">{m.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {interpretation && (
                    <div className="bg-blue-50/30 border border-blue-100/30 p-3 rounded-lg mt-1">
                        <span className="text-[8px] font-bold text-blue-500/60 uppercase tracking-widest block mb-1">Interpretation</span>
                        <div className="text-[12px] font-bold text-gray-700 leading-snug italic">"{interpretation}"</div>
                    </div>
                )}
            </div>
        );
    };

    if (loading || !patient || !visit) {
        return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 text-white font-bold">Record Not Found</div>;
    }

    const visitDate = visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : '';
    const providerName = `${visit.provider_first_name || ''} ${visit.provider_last_name || ''} `.trim() || 'Attending Physician';
    const patientAge = calculateAge(patient.dob);
    const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : '';
    const isSigned = (visit?.status || '').toLowerCase().trim() === 'signed';
    const isPreliminary = (visit?.status || '').toLowerCase().trim() === 'preliminary';
    const isRetracted = (visit?.status || '').toLowerCase().trim() === 'retracted';

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

                /* Retracted Watermark for Print - Fixed Position on Every Page */
                .print-watermark-fixed {
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) rotate(-45deg) !important;
                    z-index: 9999 !important;
                    pointer-events: none !important;
                    opacity: 0.15 !important;
                    width: 100% !important;
                    text-align: center !important;
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                }
                .print-watermark-text {
                    font-size: 120px !important;
                    font-weight: 900 !important;
                    color: #f43f5e !important; /* Rose-500 */
                    border: 8px solid #f43f5e !important;
                    padding: 40px !important;
                    border-radius: 20px !important;
                    text-transform: uppercase !important;
                }
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
            {standalone ? (
                <div className="fixed inset-0 bg-gray-50/50 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in print:bg-white print:p-0 print:static">
                    <div className="bg-white shadow-2xl w-full max-w-[1100px] h-[90vh] rounded-2xl overflow-hidden flex border border-gray-200 animate-slide-up print:block print:h-auto print:max-w-none print:border-none print:bg-white print:rounded-none">
                        <VisitChartInner />
                    </div>
                </div>
            ) : (
                <div className="bg-white shadow-2xl w-full h-full rounded-2xl overflow-hidden flex border-2 border-gray-200/10 print:block print:h-auto print:max-w-none print:border-none print:bg-white print:rounded-none relative">
                    <VisitChartInner />
                </div>
            )}
        </>
    );

    function VisitChartInner() {
        return (
            <>
                {/* EPIC STORYBOARD (Left Sidebar - High Density) */}
                <div className="w-[300px] shrink-0 border-r border-gray-200 flex flex-col bg-white overflow-y-auto overflow-x-hidden no-print">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex justify-between items-start">
                            <h2 className="text-[18px] font-bold text-gray-900 leading-tight">
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
                        <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] font-bold text-gray-500 uppercase tracking-tight">
                            <span>{patientAge}Y / {patient.sex || 'U'}</span>
                            <span className="text-gray-400">|</span>
                            <span>MRN: {patient.mrn}</span>
                        </div>
                    </div>

                    <div className="flex-1 p-6 space-y-8">
                        {/* ALLERGIES */}
                        <div>
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
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
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Vitals</div>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { l: 'BP', v: decodeHtmlEntities(vitals?.bp) },
                                    { l: 'Pulse', v: decodeHtmlEntities(vitals?.pulse) },
                                    { l: 'Temp', v: decodeHtmlEntities(vitals?.temp) },
                                    { l: 'O2', v: decodeHtmlEntities(vitals?.o2sat) }
                                ].map((v, i) => (
                                    <div key={i} className="p-2 bg-gray-50 border border-gray-100 rounded text-center">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">{v.l}</div>
                                        <div className="text-[13px] font-bold text-gray-800 tabular-nums">{v.v || '--'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PROBLEMS */}
                        <div>
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Problem List</div>
                            <div className="space-y-1.5">
                                {problems.slice(0, 5).map((p, i) => (
                                    <div key={i} className="text-[12px] font-medium text-gray-600 line-clamp-1 flex items-start gap-1">
                                        <span className="text-gray-400 mt-1">•</span> {p.problem_name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* MEDICATIONS */}
                        <div>
                            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                Medications <Pill className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                {medications.length > 0 ? medications.map((m, i) => (
                                    <div key={i} className="text-[12px] font-medium text-gray-600 line-clamp-1 flex flex-col">
                                        <div className="flex items-start gap-1">
                                            <span className="text-gray-400 mt-1">•</span> {decodeHtmlEntities(m.medication_name)}
                                        </div>
                                        <div className="pl-4 text-[10px] text-gray-400 italic uppercase">{m.dosage}</div>
                                    </div>
                                )) : <div className="text-[12px] italic text-gray-400">None listed</div>}
                            </div>
                        </div>

                        {/* CONTACT */}
                        <div className="pt-6 border-t border-slate-50 space-y-3">
                            <div className="flex items-center gap-2.5 text-[12px] font-medium text-gray-500">
                                <Phone className="w-3.5 h-3.5 text-gray-400" /> {patient.phone || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2.5 text-[12px] font-medium text-gray-500">
                                <Mail className="w-3.5 h-3.5 text-gray-400" /> {patient.email || 'N/A'}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100">
                        <button onClick={onClose} className="w-full py-3 bg-gray-50 hover:bg-gray-50 text-gray-500 text-[12px] font-bold uppercase tracking-wider rounded border border-gray-200 transition-colors">Close View</button>
                    </div>
                </div>

                {/* CLINICAL DOCUMENT LANE */}
                <div className="flex-1 flex flex-col bg-gray-50 relative">
                    {/* Compact Utility Header */}
                    <div className="h-14 bg-white border-b border-gray-200 px-8 flex items-center justify-between z-20 no-print sticky top-0">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 text-[13px] font-semibold text-gray-600">
                                <span className="uppercase text-[11px] text-gray-400 tracking-widest">Provider:</span>
                                <span>{providerName}</span>
                            </div>
                            <span className="text-gray-300">|</span>

                            {/* VISIT NAVIGATOR DROPDOWN */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    {visitDate} <ChevronDown className={`w-3 h-3 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isHistoryOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsHistoryOpen(false)} />
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-40 overflow-hidden animate-slide-up">
                                            <div className="p-2 bg-gray-50 border-b border-gray-200 text-[9px] font-bold uppercase text-gray-400 tracking-widest">
                                                Visit Timeline ({allVisits.length})
                                            </div>
                                            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                                {allVisits.map((v) => (
                                                    <button
                                                        key={v.id}
                                                        onClick={() => {
                                                            if (onOpenNewVisit && activeVisitId !== v.id) {
                                                                onOpenNewVisit(v.id);
                                                            } else {
                                                                setActiveVisitId(v.id);
                                                            }
                                                            setIsHistoryOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-slate-50 last:border-0 ${activeVisitId === v.id ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[11px] font-bold ${activeVisitId === v.id ? 'text-blue-600' : 'text-gray-800'}`}>
                                                                {format(new Date(v.visit_date), 'MMM d, yyyy')}
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                {(v.status || '').toLowerCase().trim() === 'retracted' && (
                                                                    <span className="text-[8px] font-bold text-white bg-red-500 px-1 rounded uppercase tracking-tighter">Retracted</span>
                                                                )}
                                                                {(v.locked || v.signed) && <Lock className="w-3 h-3 text-gray-400" />}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 truncate">
                                                            {getChiefComplaint(v)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isSigned && (visit.status || '').toLowerCase() === 'signed' && (
                                <>
                                    <button
                                        onClick={() => setShowAddendumModal(true)}
                                        className="px-3 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full border border-amber-200 transition-all flex items-center gap-1"
                                    >
                                        <FilePlus className="w-3 h-3" /> Addendum
                                    </button>
                                    <button
                                        onClick={() => setShowRetractModal(true)}
                                        className="px-3 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-200 transition-all flex items-center gap-1"
                                        title="Retract / Void Note (Entered in Error)"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Retract
                                    </button>
                                </>
                            )}


                            {(visit.status || '').toLowerCase() === 'preliminary' && user?.id === visit.assigned_attending_id && (
                                <>
                                    <button
                                        onClick={handleReject}
                                        className="px-3 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-200 transition-all flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Return to Draft
                                    </button>
                                    <button
                                        onClick={() => setShowCosignModal(true)}
                                        className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full border border-blue-600 transition-all flex items-center gap-1 shadow-sm"
                                    >
                                        <CheckCircle2 className="w-3 h-3" /> Cosign & Finalize
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => setShowAuditModal(true)}
                                className="px-3 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full border border-indigo-200 transition-all flex items-center gap-1"
                            >
                                <Shield className="w-3 h-3" /> History
                            </button>
                            <button onClick={handlePrint} className="px-3 py-1 text-[10px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition-all flex items-center gap-1">
                                <Printer className="w-3 h-3" /> Print
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* PRELIMINARY BANNER - HIGH VISIBILITY POSITION */}
                    {(visit.status || '').toLowerCase() === 'preliminary' && (
                        <div className="bg-amber-500 text-white px-8 py-2 flex items-center justify-between shadow-md z-10 animate-fade-in no-print">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5" />
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-bold uppercase tracking-widest">Preliminary Report - Cosignature Required</span>
                                    <span className="text-[10px] font-bold opacity-90">Authored by {providerName}. Content is not finalized until attending physician approval.</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 opacity-40" />
                            </div>
                        </div>
                    )}

                    {/* The Professional Clinical Note (Compact) */}
                    <div id="visit-chart-view" className="flex-1 overflow-y-auto p-6 print:p-0">
                        <div className="max-w-4xl mx-auto bg-white shadow-sm border border-gray-200 min-h-full p-10 space-y-6 print-document-sheet print:border-0 print:shadow-none print:max-w-none">

                            {/* 1. REFINED CLINIC HEADER (Azure Theme) */}
                            {(visit.status || '').toLowerCase().trim() === 'retracted' && (
                                <>
                                    {/* Screen Watermark (Absolute to container) */}
                                    <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden no-print">
                                        <div className="opacity-[0.15] transform -rotate-45 text-rose-500 font-bold text-[150px] whitespace-nowrap select-none border-8 border-rose-500 p-10 rounded-3xl">
                                            RETRACTED
                                        </div>
                                    </div>
                                    {/* Print Watermark (Fixed to page) */}
                                    <div className="print-watermark-fixed hidden print:flex">
                                        <div className="print-watermark-text">
                                            RETRACTED
                                        </div>
                                    </div>
                                </>
                            )}


                            {/* Preliminary Banner Removed from here and moved to top for visibility */}

                            {isPreliminary && (
                                <div className="bg-amber-500 text-white p-4 rounded-lg mb-6 flex items-center justify-between shadow-md no-print">
                                    <div className="flex items-center gap-3">
                                        <ClipboardList className="w-6 h-6" />
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-widest">Preliminary Report - Cosignature Required</h3>
                                            <p className="text-[11px] text-amber-50 font-medium">
                                                This clinical note requires review and cosignature by an attending physician.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {isRetracted && (
                                <div className="avoid-cut mb-8 p-4 bg-rose-100 border-l-8 border-rose-600 rounded-r-lg shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-6 h-6 text-rose-700 mt-0.5 shrink-0" />
                                        <div>
                                            <h3 className="text-[16px] font-bold text-rose-900 uppercase tracking-tight">Entered in Error</h3>
                                            <p className="text-[12px] font-bold text-rose-800 mt-1">
                                                This clinical record has been retracted and voided. The content below is retained for legal auditing purposes only and should not be used for clinical decision making.
                                            </p>
                                            {/* If we had retraction details, we would show them here */}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-center pb-6 border-b border-blue-100 avoid-cut">
                                <div className="flex items-center gap-6">
                                    <div className="w-40 h-24 flex items-center justify-center shrink-0 bg-white rounded-lg border border-blue-50 p-1">
                                        <img src={clinicInfo.logo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f8fafc' rx='8'/%3E%3Crect x='60' y='45' width='80' height='90' fill='none' stroke='%23cbd5e1' stroke-width='3' rx='4'/%3E%3Crect x='75' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='60' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='75' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='105' y='85' width='20' height='15' fill='%23cbd5e1' rx='2'/%3E%3Crect x='88' y='110' width='24' height='25' fill='%23cbd5e1' rx='2'/%3E%3Ctext x='100' y='165' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' font-weight='600' fill='%2394a3b8'%3ENO LOGO%3C/text%3E%3C/svg%3E"} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-blue-900 tracking-tight mb-1">{clinicInfo.name}</h1>
                                        <div className="text-[11px] text-gray-500 font-medium flex flex-col gap-0.5">
                                            <span>{clinicInfo.address.replace(/\n/g, ', ')}</span>
                                            <span className="text-blue-600 font-semibold">PH: {clinicInfo.phone}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <div className="bg-blue-50/50 text-blue-700 px-3 py-1 rounded-md border border-blue-100/50 flex flex-col items-end">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {visit?.note_type === 'telehealth' ? 'Telehealth Visit' : 'Clinical Record'}
                                        </span>
                                        {isSigned && (
                                            <span className="text-[9px] font-medium text-blue-500">
                                                {snapshot ? `Snapshot: ${format(new Date(visit.note_signed_at), 'MM/dd/yy')}` : '⚠️ Live Data (Snapshot Missing)'}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[15px] font-bold text-gray-700 tracking-tight">{visitDate}</div>
                                        <div className="text-[9px] text-gray-400 uppercase tracking-wider">Examination Date</div>
                                    </div>
                                    <div className="text-[9px] text-gray-400 font-mono tracking-tight mt-1">REF: {activeVisitId?.substring(0, 14).toUpperCase()}</div>
                                </div>
                            </div>

                            {/* 2. COMPACT PATIENT DEMOGRAPHICS */}
                            <div className="relative avoid-cut py-4 px-6 my-4 bg-blue-50/20 rounded-lg border border-blue-100/50 flex gap-8 overflow-hidden">
                                <div className="flex-1 grid grid-cols-3 gap-x-8 relative z-10 text-[11px]">
                                    <div className="space-y-2">
                                        <div>
                                            <div className="text-blue-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Patient</div>
                                            <div className="font-bold text-blue-950 text-[14px] leading-tight tracking-tight">{patient.last_name}, {patient.first_name}</div>
                                            <div className="text-[11px] text-gray-500 font-medium">MRN: {patient.mrn}</div>
                                        </div>
                                        <div className="font-semibold text-gray-600 text-[12px]">{patientDOB} <span className="text-gray-400 mx-1">/</span> {patientAge}Y <span className="text-gray-400 mx-1">/</span> {patient.sex}</div>
                                    </div>

                                    <div className="space-y-2 border-l border-blue-100/60 pl-6">
                                        <div>
                                            <div className="text-blue-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Billing & Payer</div>
                                            <div className="font-semibold text-gray-700 uppercase text-[11px] mb-0.5">{patient.insurance_name || 'Self-Pay'}</div>
                                            <div className="font-medium text-blue-600 text-[11px]">PR: {providerName}</div>
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-gray-500 font-medium text-[10px]">
                                            <span>{patient.phone}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 pl-6 border-l border-blue-100/60">
                                        <div className="text-blue-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Address</div>
                                        <div className="text-gray-600 font-medium text-[10px] leading-snug">
                                            {patient.address_line1}<br />
                                            {[patient.city, patient.state, patient.zip].filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* META HEADER (CHIEF COMPLAINT) */}
                            <div className="avoid-cut mb-4 pt-2 pb-2 border-b border-blue-50 flex justify-between items-center px-2">
                                <div className="flex gap-2 items-center shrink-0">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Reason for Visit:</span>
                                    <div className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">{noteData.chiefComplaint || visit?.reason || 'Routine follow-up'}</div>
                                </div>
                                {visit?.note_type === 'telehealth' && (
                                    <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded-full border border-blue-100 flex items-center gap-1.5">
                                        <Globe className="w-3 h-3" /> Telehealth Video Visit
                                    </div>
                                )}
                            </div>

                            {/* ADDENDUM NOTICE BANNER */}
                            {addendums.length > 0 && (
                                <div className="avoid-cut mb-4 py-3 px-4 bg-amber-50 rounded-xl border-2 border-amber-300 flex items-center gap-3 shadow-sm">
                                    <div className="p-1.5 bg-amber-400 rounded-full">
                                        <AlertCircle className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                                            ⚠️ This Note Contains {addendums.length} Addendum{addendums.length > 1 ? 's' : ''}
                                        </div>
                                        <div className="text-[10px] text-amber-600 font-medium">
                                            Please scroll to the end of this document to view all clinical addendums.
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* 3. CLINICAL NARRATIVE */}
                            <div className="space-y-12 pb-16">
                                {/* HPI */}
                                <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                    <span className="section-label">History of Present Illness</span>
                                    <div className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap">{noteData.hpi || 'No HPI recorded.'}</div>
                                </div>

                                {/* ROS */}
                                <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                    <span className="section-label">Review of Systems</span>
                                    <div className="text-[13px] leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />
                                </div>

                                {/* ALLERGIES BAR (Post-ROS) */}
                                <div className="avoid-cut mt-6 py-2.5 px-4 bg-rose-50/30 rounded-xl border border-rose-100/50 flex gap-4 items-center">
                                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest shrink-0">Allergies</span>
                                    <div className="flex flex-wrap gap-2 text-[11px]">
                                        {allergies.length > 0 ? (
                                            allergies.map((a, i) => <span key={i} className="font-bold text-rose-700">! {a.allergen}</span>)
                                        ) : (
                                            <span className="font-bold text-emerald-600 uppercase tracking-tighter italic">Negative / NKDA</span>
                                        )}
                                    </div>
                                </div>

                                {/* COMPACT 3-COLUMN CLINICAL HISTORY (PMHx, Meds, Social) */}
                                <div className="grid grid-cols-3 gap-8 mt-4 pt-4 border-t border-blue-50 avoid-cut">
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Observation & History</span>
                                        <ul className="text-[11px] font-medium text-gray-600 space-y-0.5">
                                            {problems.length > 0 ? problems.map((p, i) => <li key={i} className="flex items-center gap-1.5"> • {p.problem_name}</li>) : <li className="italic text-gray-400">Non-contributory.</li>}
                                        </ul>
                                    </div>
                                    <div className="space-y-2 border-l border-r border-blue-50 px-6">
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Home Medications</span>
                                        <ul className="text-[11px] font-semibold text-gray-700 space-y-1">
                                            {medications.length > 0 ? medications.map((m, i) => <li key={i} className="flex flex-col border-b border-blue-50/50 pb-0.5"><span>{decodeHtmlEntities(m.medication_name)}</span> <span className="text-[9px] text-gray-400 font-medium uppercase">{m.dosage}</span></li>) : <li className="italic text-gray-400">No active medications.</li>}
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Social & Family</span>
                                        <div className="text-[11px] font-medium text-gray-600 space-y-2">
                                            <div className="bg-blue-50/30 p-2 rounded border border-blue-50">
                                                <div>Tobacco: <span className="text-gray-800">{socialHistory?.smoking_status || 'Never'}</span> / EtOh: <span className="text-gray-800">{socialHistory?.alcohol_use || 'None'}</span></div>
                                            </div>
                                            <div className="text-[10px] leading-tight">
                                                <span className="text-blue-500 font-bold uppercase text-[8px] mr-1">Family History:</span>
                                                {familyHistory.length > 0 ? familyHistory.map(f => f.condition).join(', ') : 'Non-contributory.'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* VITALS */}
                                <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                    <span className="section-label text-blue-400 text-[10px] mb-2">Physical Observations (Vitals)</span>
                                    <div className="grid grid-cols-5 gap-4 mt-2">
                                        {[
                                            { label: 'B/P', value: decodeHtmlEntities(vitals?.bp), unit: 'mmHg' },
                                            { label: 'Pulse', value: decodeHtmlEntities(vitals?.pulse), unit: 'bpm' },
                                            { label: 'Temp', value: decodeHtmlEntities(vitals?.temp), unit: '°F' },
                                            { label: 'O2 Sat', value: decodeHtmlEntities(vitals?.o2sat), unit: '%' },
                                            { label: 'BMI', value: decodeHtmlEntities(vitals?.bmi), unit: '' }
                                        ].map((v, i) => (
                                            <div key={i} className="bg-blue-50/30 border border-blue-50 rounded px-3 py-2 text-center">
                                                <div className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">{v.label}</div>
                                                <div className="text-[14px] font-bold text-gray-700 tabular-nums">{v.value || '--'} <span className="text-[10px] font-medium text-gray-400">{v.unit}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* PE */}
                                <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                    <span className="section-label">Physical Examination</span>
                                    <div className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />
                                </div>

                                {/* RESULTS / DATA */}
                                {(noteData.results || visitDocuments.length > 0) && (
                                    <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                        <span className="section-label">Results & Data</span>
                                        {noteData.results && !noteData.results.includes('Imported results will appear here') && (
                                            <div className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap mb-8">{noteData.results}</div>
                                        )}
                                        {visitDocuments.length > 0 && (
                                            <div className="grid grid-cols-2 gap-8 mt-4">
                                                {visitDocuments.map(doc => (
                                                    <ResultImageView key={doc.id} doc={doc} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ASSESSMENT */}
                                <div className="mt-8 pt-6 border-t border-blue-50 avoid-cut">
                                    <span className="section-label text-gray-900 border-none">Assessment & Diagnoses</span>
                                    <div className="space-y-1.5 font-bold text-[13px] text-gray-700">
                                        {noteData.assessment ? noteData.assessment.split('\n').filter(line => line.trim()).map((line, i) => (
                                            <div key={i} className="flex gap-2.5">
                                                <span className="text-gray-400 font-medium">{i + 1}.</span>
                                                {line}
                                            </div>
                                        )) : <div className="text-gray-400 italic">No diagnostic data.</div>}
                                    </div>
                                </div>

                                {/* PLAN */}
                                <div className="space-y-6 pt-8 mt-8 border-t border-blue-50 avoid-cut">
                                    <span className="section-label">Medical Plan & Interventions</span>
                                    <div className="space-y-8 pl-3">
                                        {noteData.planStructured?.length > 0 ? noteData.planStructured.map((p, i) => (
                                            <div key={i} className="space-y-3">
                                                <div className="text-[13px] font-bold text-gray-800 border-b border-blue-50 pb-1.5">{p.diagnosis}</div>

                                                {/* Orders first */}
                                                {p.orders.length > 0 && (
                                                    <ul className="pl-8 space-y-1.5">
                                                        {p.orders.map((o, j) => (
                                                            <li key={j} className="text-[13px] text-gray-700 font-medium flex items-center gap-2.5"><div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div> {o}</li>
                                                        ))}
                                                    </ul>
                                                )}

                                                {/* MDM at bottom */}
                                                {p.mdm && (
                                                    <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100/30 ml-3">
                                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest block mb-0.5">Clinical Logic</span>
                                                        <p className="text-[12px] text-gray-700 leading-relaxed italic">"{p.mdm}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        )) : <div className="text-[13px] text-gray-700 whitespace-pre-wrap">{noteData.plan || 'No specific clinical orders recorded.'}</div>}
                                    </div>
                                </div>

                                {/* PLAN OF CARE */}
                                {noteData.carePlan && (
                                    <div className="space-y-6 pt-8 mt-8 border-t border-blue-50 avoid-cut">
                                        <span className="section-label">Plan of Care</span>
                                        <div className="text-[13px] leading-relaxed text-gray-700 pl-3 whitespace-pre-wrap">{noteData.carePlan}</div>
                                    </div>
                                )}

                                {/* FOLLOW UP */}
                                <div className="pt-6 border-t border-gray-100 avoid-cut">
                                    <div className="inline-block bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                                        <span className="text-[9px] font-medium text-gray-400 block mb-0.5">Follow Up Instruction</span>
                                        <span className="text-[12px] font-bold text-gray-700 italic">{noteData.followUp || visit.follow_up_instructions || 'PRN / AS NEEDED'}</span>
                                    </div>
                                </div>

                                {/* ADDENDUMS SECTION */}
                                {addendums.length > 0 && (
                                    <div className="mt-8 pt-6 border-t-2 border-amber-200 avoid-cut space-y-4">
                                        <span className="section-label text-amber-600">Clinical Addendums ({addendums.length})</span>
                                        <div className="space-y-3">
                                            {addendums.map((addendum, idx) => (
                                                <div key={idx} className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Addendum #{idx + 1}</span>
                                                        <span className="text-[9px] text-amber-600 font-medium">
                                                            {addendum.date ? format(new Date(addendum.date), 'MM/dd/yyyy HH:mm') : ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{addendum.text || addendum}</div>
                                                    {addendum.author && (
                                                        <div className="mt-2 text-[10px] font-semibold text-amber-700 italic">/s/ {addendum.author}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AUTHENTICATION FOOTER */}
                                <div className="mt-8 pt-4 border-t border-blue-100 avoid-cut">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <div className="text-[16px] font-bold italic text-blue-900 tracking-tight">/s/ {providerName}</div>
                                            <div className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 px-2 py-0.5 rounded border ${(visit.status || '').toLowerCase() === 'preliminary' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                <CheckCircle2 className="w-3 h-3" />
                                                {(visit.status || '').toLowerCase() === 'preliminary' ? 'Preliminary Electronic Signature' : 'Electronic Signature Verified'}
                                                {visit.note_signed_at && ` • ${format(new Date(visit.note_signed_at), 'MM/dd/yyyy HH:mm')}`}
                                            </div>

                                            {visit.cosigned_at && (
                                                <div className="mt-4 pt-4 border-t border-blue-100/50 space-y-3">
                                                    <div className="text-[14px] font-bold italic text-gray-700 leading-relaxed pl-3 border-l-2 border-blue-200">
                                                        "{visit.attestation_text || 'I have reviewed the documentation and concur with the assessment and plan.'}"
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-[16px] font-bold italic text-blue-950 tracking-tight">/s/ {visit.cosigned_by_first_name} {visit.cosigned_by_last_name}, {visit.cosigner_role || 'Attending'}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-100 w-fit">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Cosignature Verified • {format(new Date(visit.cosigned_at), 'MM/dd/yyyy HH:mm')}
                                                            <span className="text-emerald-300 ml-1">[{visit.authorship_model || 'Addendum'}]</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-[8px] font-medium text-gray-400 uppercase tracking-tight pl-1 mt-2">Hash: {patientId?.substring(0, 8)}-{activeVisitId?.substring(0, 8)}</div>
                                        </div>
                                        <div className="text-right flex flex-col items-end opacity-40">
                                            <span className="text-lg font-bold italic text-blue-900 tracking-tighter">PageMD</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center text-[8px] font-bold text-gray-400 uppercase tracking-widest border-t border-slate-50 pt-2">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Redesigned Modal Containers */}
                {
                    showAddendumModal && (
                        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setShowAddendumModal(false)}>
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-10 border border-gray-100" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">Add Record Amendment</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Clinical Context Supplement</p>
                                    </div>
                                    <button onClick={() => setShowAddendumModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><X className="w-6 h-6 text-gray-400" /></button>
                                </div>
                                <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all placeholder:text-gray-400" placeholder="Enter clinical supplement..." />
                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setShowAddendumModal(false)} className="px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Discard</button>
                                    <button onClick={handleAddAddendum} className="px-8 py-3 bg-gray-50 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all">Authenticate Addendum</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* RETRACT MODAL */}
                {
                    showRetractModal && (
                        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-md flex items-center justify-center z-[110] p-4" onClick={() => setShowRetractModal(false)}>
                            <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-[20px] font-bold text-gray-900 tracking-tight">Retract Clinical Note</h3>
                                        <p className="text-gray-500 text-[13px] font-medium mt-1 uppercase tracking-wider">Legal Void Process (Entered in Error)</p>
                                    </div>
                                    <button onClick={() => setShowRetractModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><X className="w-6 h-6 text-gray-400" /></button>
                                </div>

                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                    <div className="text-[12px] text-rose-700 font-medium leading-relaxed">
                                        <strong>Warning:</strong> Retracting a signed note will mark it as "Entered in Error" across the system. This action is immutable and logged for clinical auditing.
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Retraction Reason</label>
                                        <select
                                            value={retractReason}
                                            onChange={e => setRetractReason(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all"
                                        >
                                            <option value="ENTERED_IN_ERROR">Entered in Error</option>
                                            <option value="WRONG_PATIENT">Wrong Patient</option>
                                            <option value="INCORRECT_DATE">Incorrect Date</option>
                                            <option value="DUPLICATE_NOTE">Duplicate Note</option>
                                            <option value="REVISED_EXTENSIVELY">Extensive Revisions Required</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Explanation (Required for Audit Log)</label>
                                        <textarea
                                            value={retractExplanation}
                                            onChange={e => setRetractExplanation(e.target.value)}
                                            className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all placeholder:text-gray-400"
                                            placeholder="Briefly describe why this note is being voided..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setShowRetractModal(false)} className="px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
                                    <button
                                        onClick={handleRetract}
                                        disabled={!retractExplanation.trim() || isRetracting}
                                        className={`px-8 py-3 bg-rose-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${(!retractExplanation.trim() || isRetracting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isRetracting ? 'Voiding...' : 'Confirm Retraction'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    showAuditModal && (
                        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-md flex items-center justify-center z-[110] p-4" onClick={() => setShowAuditModal(false)}>
                            <div className="bg-[#f8fafc] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                                <div className="bg-white p-8 border-b border-gray-200 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                                <Shield className="text-white w-5 h-5" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Note History Audit</h3>
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 ml-1">Lifecycle Activity & Signatures</p>
                                    </div>
                                    <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><X className="w-6 h-6 text-gray-400" /></button>
                                </div>

                                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4 bg-gray-50/30">
                                    {loadingHistory ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                            <p className="font-bold">Retrieving history...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {noteHistory.map((event, i) => (
                                                <div key={event.id} className="relative flex gap-6">
                                                    {/* Vertical Line */}
                                                    {i < noteHistory.length - 1 && (
                                                        <div className="absolute left-[19px] top-10 bottom-[-16px] w-0.5 bg-gray-100" />
                                                    )}

                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-[#f8fafc] ${event.action.includes('SIGNED') ? 'bg-emerald-500 shadow-lg shadow-emerald-200' :
                                                        event.action.includes('RETRACTED') ? 'bg-rose-500 shadow-lg shadow-rose-200' :
                                                            'bg-white border-gray-200 text-gray-400 shadow-sm'
                                                        }`}>
                                                        {event.action.includes('SIGNED') ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                                                            event.action.includes('RETRACTED') ? <AlertCircle className="w-5 h-5 text-white" /> :
                                                                <Clock className="w-4 h-4" />}
                                                    </div>

                                                    <div className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">{event.action.replace(/_/g, ' ')}</div>
                                                                <div className="text-sm font-bold text-gray-900 mt-0.5">{event.actor_name || 'System'}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(event.occurred_at), 'MM/dd/yy')}</div>
                                                                <div className="text-[11px] font-bold text-gray-800 tabular-nums">{format(new Date(event.occurred_at), 'h:mm a')}</div>
                                                            </div>
                                                        </div>

                                                        {Object.keys(event.details || {}).length > 0 && (
                                                            <div className="mt-3 p-3 bg-gray-50/50 rounded-lg border border-gray-100 italic text-[12px] text-gray-500 leading-relaxed font-medium">
                                                                {event.details.reason && <span>Reason: {event.details.reason} </span>}
                                                                {event.details.reason_code && <span>Reason: {event.details.reason_code} </span>}
                                                                {event.details.reason_text && <span className="block mt-1 text-gray-600">"{event.details.reason_text}"</span>}
                                                                {event.details.method && <span>via {event.details.method} </span>}
                                                                {event.details.status && <span>({event.details.status})</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {noteHistory.length === 0 && (
                                                <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-[10px] italic">Historical migration data pending</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 bg-white border-t border-gray-100 flex justify-between items-center">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Lock className="w-3 h-3" /> Immutable Audit Trail
                                    </div>
                                    <button onClick={() => setShowAuditModal(false)} className="px-8 py-3 bg-gray-50 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all">Close History</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {showBillingModal && <BillingModal patientId={patientId} isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />}

                {
                    showCosignModal && (
                        <CosignModal
                            isOpen={showCosignModal}
                            onClose={() => setShowCosignModal(false)}
                            visitData={visit}
                            authorshipModel={authorshipModel}
                            setAuthorshipModel={setAuthorshipModel}
                            attestationText={attestationText}
                            setAttestationText={setAttestationText}
                            macros={attestationMacros}
                            onConfirm={handleCosign}
                            isSaving={loading}
                        />
                    )
                }

                {/* Unified Patient Chart Panel */}
                <PatientChartPanel
                    isOpen={showPatientChart}
                    onClose={() => setShowPatientChart(false)}
                    patientId={patientId}
                    initialTab="summary"
                />
            </>
        );
    }
};

const BillingModal = ({ patientId, isOpen, onClose }) => {
    const [claims, setClaims] = useState([]);
    useEffect(() => {
        if (isOpen) billingAPI.getClaimsByPatient(patientId).then(res => setClaims(res.data || [])).catch(console.error);
    }, [isOpen]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-50/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-10 border border-gray-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">Billing Record</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Claim Transmission Log</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-all"><X className="w-6 h-6 text-gray-400" /></button>
                </div>
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">
                    {claims.map((c, i) => (
                        <div key={i} className="p-5 bg-gray-50/50 border border-gray-200/50 rounded-2xl flex justify-between items-center">
                            <div className="space-y-1">
                                <div className="text-sm font-bold text-gray-800 tracking-tight">{format(new Date(c.visit_date), 'MMMM dd, yyyy')}</div>
                                <div className="flex items-center gap-3">
                                    <div className={`px - 2 py - 0.5 rounded - lg text - [9px] font - black uppercase tracking - widest ${c.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-gray-200 text-gray-400'} `}>{c.status}</div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{c.visit_type || 'Clinical Service'}</div>
                                </div>
                            </div>
                            <div className="text-xl font-bold text-gray-900 tracking-tighter">${c.total_amount}</div>
                        </div>
                    ))}
                    {claims.length === 0 && <div className="text-center py-20 text-gray-300 font-bold uppercase tracking-widest text-[10px]">Financials Sync Required</div>}
                </div>
                <div className="mt-10 pt-6 border-t border-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-10 py-3 bg-gray-50 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/10">Close Audit</button>
                </div>
            </div>
        </div>
    );
};

export default VisitChartView;
