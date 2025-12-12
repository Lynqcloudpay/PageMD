import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, Phone, Mail, MapPin, Stethoscope, CheckCircle2, CreditCard, Building2, Users, FilePlus, Receipt, DollarSign, AlertCircle } from 'lucide-react';
import { visitsAPI, patientsAPI, billingAPI, codesAPI } from '../services/api';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';
import PrintableOrders from './PrintableOrders';

const VisitChartView = ({ visitId, patientId, onClose }) => {
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
    const [showSignAddendumModal, setShowSignAddendumModal] = useState(false);
    const [addendumToSignIndex, setAddendumToSignIndex] = useState(null);
    const [showSuperbillModal, setShowSuperbillModal] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [showPrintableOrders, setShowPrintableOrders] = useState(false);
    const [superbillData, setSuperbillData] = useState({
        diagnosisCodes: [],
        procedureCodes: [],
        totalAmount: 0
    });
    const [feeSchedule, setFeeSchedule] = useState([]);
    const [selectedDiagnosisCodes, setSelectedDiagnosisCodes] = useState([]);
    const [selectedProcedureCodes, setSelectedProcedureCodes] = useState([]);

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
        // Use [\s\S] to match everything including newlines, and make it non-greedy but stop at Plan:
        let assessment = '';
        const assessmentIndex = decodedText.search(/(?:Assessment|A):\s*/i);
        if (assessmentIndex !== -1) {
            const afterAssessment = decodedText.substring(assessmentIndex);
            // Find where Plan: starts (case insensitive)
            const planStart = afterAssessment.search(/\n\n(?:Plan|P):|\n(?:Plan|P):/i);
            if (planStart !== -1) {
                // Extract everything between Assessment: and Plan:
                const assessmentWithHeader = afterAssessment.substring(0, planStart);
                const assessmentContent = assessmentWithHeader.replace(/(?:Assessment|A):\s*/i, '').trim();
                assessment = assessmentContent;
            } else {
                // No Plan: found, take everything until end
                const assessmentWithHeader = afterAssessment;
                const assessmentContent = assessmentWithHeader.replace(/(?:Assessment|A):\s*/i, '').trim();
                assessment = assessmentContent;
            }
        }
        
        // Parse Plan - capture ALL content from Plan: until end
        let plan = '';
        const planIndex = decodedText.search(/(?:Plan|P):\s*/i);
        if (planIndex !== -1) {
            const afterPlan = decodedText.substring(planIndex);
            // Remove the "Plan:" or "P:" header and take everything until end
            const planContent = afterPlan.replace(/(?:Plan|P):\s*/i, '').trim();
            plan = planContent;
        }
        
        return {
            chiefComplaint: chiefComplaint,
            hpi: hpi,
            rosNotes: rosNotes,
            peNotes: peNotes,
            assessment: decodeHtmlEntities(assessment),
            plan: decodeHtmlEntities(plan)
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

    // Modular section renderer - makes it easy to rearrange sections
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
            // First fetch visit to check if it's signed
            const visitRes = await visitsAPI.get(visitId);
            const visit = visitRes.data;
            const isSigned = visit.note_signed_at || visit.locked;
            
            // If signed, try to use snapshot data from visit
            let allergiesData = [];
            let medicationsData = [];
            let problemsData = [];
            let familyHistoryData = [];
            let socialHistoryData = null;
            
            if (isSigned && visit.patient_snapshot) {
                // Use snapshot data for signed notes (immutable)
                try {
                    const snapshot = typeof visit.patient_snapshot === 'string' 
                        ? JSON.parse(visit.patient_snapshot) 
                        : visit.patient_snapshot;
                    allergiesData = snapshot.allergies || [];
                    medicationsData = snapshot.medications || [];
                    problemsData = snapshot.problems || [];
                    familyHistoryData = snapshot.familyHistory || [];
                    socialHistoryData = snapshot.socialHistory || null;
                    console.log('Using snapshot data for signed note');
                } catch (snapshotError) {
                    console.error('Error parsing snapshot, falling back to current data:', snapshotError);
                    // Fall back to current data if snapshot is invalid
                    // Clear snapshot so we fetch current data
                    visit.patient_snapshot = null;
                }
            }
            
            // If not signed or snapshot unavailable, fetch current data
            if (!isSigned || !visit.patient_snapshot) {
                const [patientRes, allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes] = await Promise.all([
                    patientsAPI.get(patientId),
                    patientsAPI.getAllergies(patientId).catch((err) => {
                        console.error('Error fetching allergies:', err);
                        return { data: [] };
                    }),
                    patientsAPI.getMedications(patientId).catch((err) => {
                        console.error('Error fetching medications:', err);
                        return { data: [] };
                    }),
                    patientsAPI.getProblems(patientId).catch((err) => {
                        console.error('Error fetching problems:', err);
                        return { data: [] };
                    }),
                    patientsAPI.getFamilyHistory(patientId).catch((err) => {
                        console.error('Error fetching family history:', err);
                        return { data: [] };
                    }),
                    patientsAPI.getSocialHistory(patientId).catch((err) => {
                        console.error('Error fetching social history:', err);
                        return { data: null };
                    })
                ]);
                
                setPatient(patientRes.data);
                allergiesData = allergiesRes.data || [];
                medicationsData = medicationsRes.data || [];
                problemsData = problemsRes.data || [];
                familyHistoryData = familyHistoryRes.data || [];
                socialHistoryData = socialHistoryRes.data;
            } else {
                // For signed notes, still fetch patient basic info
                const patientRes = await patientsAPI.get(patientId);
                setPatient(patientRes.data);
            }
            
            setVisit(visit);
            setAllergies(allergiesData);
            setMedications(medicationsData);
            setProblems(problemsData);
            setFamilyHistory(familyHistoryData);
            setSocialHistory(socialHistoryData);
            
            // Load addendums
            if (visitRes.data.addendums) {
                const addendumsData = Array.isArray(visitRes.data.addendums) 
                    ? visitRes.data.addendums 
                    : JSON.parse(visitRes.data.addendums || '[]');
                setAddendums(addendumsData);
            } else {
                setAddendums([]);
            }
            
            // Load fee schedule for superbill
            try {
                const feeScheduleRes = await billingAPI.getFeeSchedule();
                setFeeSchedule(feeScheduleRes.data || []);
            } catch (error) {
                console.error('Error fetching fee schedule:', error);
            }
            
            // Parse vitals - handle both JSONB (object) and string formats
            console.log('Raw vitals from visit:', visitRes.data.vitals);
            if (visitRes.data.vitals) {
                let v = visitRes.data.vitals;
                if (typeof v === 'string') {
                    try {
                        v = JSON.parse(v);
                        console.log('Parsed vitals from string:', v);
                    } catch (e) {
                        console.error('Error parsing vitals:', e, 'Raw string:', v);
                        v = null;
                    }
                }
                // Set vitals even if empty - let the render function handle display
                if (v && typeof v === 'object') {
                    // Decode HTML entities in vitals values
                    const decodedVitals = {};
                    Object.keys(v).forEach(key => {
                        let value = v[key];
                        if (typeof value === 'string') {
                            // Decode HTML entities (especially &#x2F; for forward slash)
                            value = value.replace(/&#x2F;/g, '/')
                                         .replace(/&#47;/g, '/')
                                         .replace(/&amp;/g, '&')
                                         .replace(/&lt;/g, '<')
                                         .replace(/&gt;/g, '>')
                                         .replace(/&quot;/g, '"')
                                         .replace(/&#39;/g, "'");
                        }
                        decodedVitals[key] = value;
                    });
                    console.log('Setting vitals:', decodedVitals, 'Keys:', Object.keys(decodedVitals));
                    setVitals(decodedVitals);
                } else {
                    console.log('Vitals not set - invalid format:', v);
                    setVitals(null);
                }
            } else {
                console.log('No vitals found in visit data');
                setVitals(null);
            }

            let parsedNoteData = {
                chiefComplaint: '',
                hpi: '',
                assessment: '',
                plan: '',
                rosNotes: '',
                peNotes: '',
                planStructured: []
            };

            if (visitRes.data.note_draft) {
                const parsed = parseNoteText(visitRes.data.note_draft);
                const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                parsedNoteData = {
                    chiefComplaint: parsed.chiefComplaint || '',
                    hpi: parsed.hpi || '',
                    assessment: parsed.assessment || '',
                    plan: parsed.plan || '',
                    rosNotes: parsed.rosNotes || '',
                    peNotes: parsed.peNotes || '',
                    planStructured: planStructured.length > 0 ? planStructured : []
                };
                setNoteData(parsedNoteData);
            }

            // Debug log - expanded for better visibility
            const hasBackgroundData = problemsData.length > 0 || medicationsData.length > 0 || allergiesData.length > 0 || familyHistoryData.length > 0 || !!socialHistoryData;
            console.log('=== VisitChartView - Loaded data ===');
            console.log('Allergies:', allergiesData.length, allergiesData);
            console.log('Medications:', medicationsData.length, medicationsData);
            console.log('Problems:', problemsData.length, problemsData);
            console.log('Family History:', familyHistoryData.length, familyHistoryData);
            console.log('Social History:', socialHistoryData);
            console.log('Vitals:', visitRes.data.vitals);
            console.log('Note Data:', parsedNoteData);
            console.log('Patient Background will show:', hasBackgroundData);
            console.log('===================================');
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        setShowPrintPreview(false);

        const source = document.getElementById('visit-chart-view');
        if (!source) return console.error('visit-chart-view not found');

        document.getElementById('print-chart-clone')?.remove();

        const clone = source.cloneNode(true);
        clone.id = 'print-chart-clone';

        // ✅ don't push offscreen; let CSS control visibility
        clone.style.display = 'block';
        clone.style.background = 'white';

        document.body.appendChild(clone);
        document.body.classList.add('printing-chart');

        const cleanup = () => {
            document.body.classList.remove('printing-chart');
            document.getElementById('print-chart-clone')?.remove();
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);
        requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    };

    const handlePrintPreview = () => {
        setShowPrintPreview(true);
    };

    const handleAddAddendum = async (signImmediately = false) => {
        if (!addendumText.trim()) {
            alert('Please enter addendum text');
            return;
        }
        
        try {
            await visitsAPI.addAddendum(visitId, addendumText);
            // Refresh visit data
            const visitRes = await visitsAPI.get(visitId);
            const visitData = visitRes.data;
            let addendumsData = [];
            if (visitData.addendums) {
                addendumsData = Array.isArray(visitData.addendums) 
                    ? visitData.addendums 
                    : JSON.parse(visitData.addendums || '[]');
                setAddendums(addendumsData);
            }
            setAddendumText('');
            setShowAddendumModal(false);
            
            // Find the newly added addendum (last one, unsigned)
            const newAddendumIndex = addendumsData.length - 1;
            if (newAddendumIndex >= 0 && !addendumsData[newAddendumIndex].signed) {
                if (signImmediately) {
                    // Sign immediately
                    try {
                        await visitsAPI.signAddendum(visitId, newAddendumIndex);
                        // Refresh again to get signed addendum
                        const refreshRes = await visitsAPI.get(visitId);
                        const refreshData = refreshRes.data;
                        if (refreshData.addendums) {
                            const refreshedAddendums = Array.isArray(refreshData.addendums) 
                                ? refreshData.addendums 
                                : JSON.parse(refreshData.addendums || '[]');
                            setAddendums(refreshedAddendums);
                        }
                        alert('Addendum added and signed successfully.');
                    } catch (signError) {
                        console.error('Error signing addendum:', signError);
                        alert('Addendum added but failed to sign. You can sign it later.');
                    }
                } else {
                    // Prompt to sign the addendum
                    setAddendumToSignIndex(newAddendumIndex);
                    setShowSignAddendumModal(true);
                }
            } else {
                alert('Addendum added successfully.');
            }
        } catch (error) {
            console.error('Error adding addendum:', error);
            alert('Failed to add addendum');
        }
    };

    const handleSignAddendum = async () => {
        if (addendumToSignIndex === null) return;
        
        try {
            await visitsAPI.signAddendum(visitId, addendumToSignIndex);
            // Refresh visit data
            const visitRes = await visitsAPI.get(visitId);
            const visitData = visitRes.data;
            if (visitData.addendums) {
                const addendumsData = Array.isArray(visitData.addendums) 
                    ? visitData.addendums 
                    : JSON.parse(visitData.addendums || '[]');
                setAddendums(addendumsData);
            }
            setShowSignAddendumModal(false);
            setAddendumToSignIndex(null);
            alert('Addendum signed successfully. It is now immutable.');
        } catch (error) {
            console.error('Error signing addendum:', error);
            alert('Failed to sign addendum');
        }
    };

    const handleCreateSuperbill = async () => {
        if (selectedDiagnosisCodes.length === 0) {
            alert('Please select at least one diagnosis code');
            return;
        }
        if (selectedProcedureCodes.length === 0) {
            alert('Please select at least one procedure code');
            return;
        }
        
        try {
            // Calculate total amount
            let total = 0;
            selectedProcedureCodes.forEach(code => {
                const feeItem = feeSchedule.find(f => f.code === code.code && f.code_type === 'CPT');
                if (feeItem && feeItem.fee_amount) {
                    total += parseFloat(feeItem.fee_amount);
                }
            });
            
            // Create claim
            await billingAPI.createClaim({
                visitId: visitId,
                diagnosisCodes: selectedDiagnosisCodes,
                procedureCodes: selectedProcedureCodes,
                totalAmount: total
            });
            
            setShowSuperbillModal(false);
            setSelectedDiagnosisCodes([]);
            setSelectedProcedureCodes([]);
            alert('Superbill created successfully!');
        } catch (error) {
            console.error('Error creating superbill:', error);
            alert('Failed to create superbill');
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
                    <button onClick={onClose} className="mt-4 px-4 py-2 text-white rounded transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>Close</button>
                </div>
            </div>
        );
    }

    const visitDate = visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
    const providerTitle = visit.provider_title || visit.provider_credentials || '';
    const providerName = visit.provider_first_name && visit.provider_last_name
        ? `${visit.provider_first_name} ${visit.provider_last_name}${providerTitle ? ', ' + providerTitle : ''}`
        : 'Provider';
    const patientAge = calculateAge(patient.dob);
    const patientDOB = patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : '';
    const signedDate = visit.note_signed_at ? format(new Date(visit.note_signed_at), 'MM/dd/yyyy h:mm a') : '';

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                
                * {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                
                /* Hide print-only content on screen */
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }

                /* hide clone in normal UI */
                #print-chart-clone {
                    display: none !important;
                }
                
                /* When printing, hide everything except the visit chart view */
                /* ✅ Use clone-based printing to avoid blank first page */
                @media print {
                    @page {
                        size: letter;
                        margin: 0;
                    }

                    /* Hide the whole React app during print */
                    body.printing-chart #root {
                        display: none !important;
                    }

                    /* Show the cloned print content */
                    body.printing-chart #print-chart-clone {
                        display: block !important;
                    }

                    /* ✅ IMPORTANT: bring clone onto the printable page */
                    body.printing-chart #print-chart-clone {
                        position: static !important;
                        left: auto !important;
                        top: auto !important;
                        width: auto !important;
                        min-height: auto !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    body.printing-chart #print-chart-clone,
                    body.printing-chart #print-chart-clone * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /* Header: keep side-by-side layout, don't wrap */
                    body.printing-chart .visit-print-toprow {
                        flex-wrap: nowrap !important;
                        gap: 16px !important;
                        align-items: flex-start !important;
                    }

                    /* Right-side visit info: keep on right, maintain border */
                    body.printing-chart .visit-print-toprow > div:last-child {
                        border-left: 1px solid #d1d5db !important;
                        padding-left: 16px !important;
                        text-align: right !important;
                        flex-shrink: 0 !important;
                        width: auto !important;
                    }

                    /* Logo slightly smaller for print so header fits */
                    body.printing-chart #print-chart-clone img {
                        width: 110px !important;
                        height: 110px !important;
                    }

                    /* Demographics grid: keep it to 3 columns in print (6 columns gets too tight) */
                    body.printing-chart .visit-print-demographics {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }

                    /* Hide buttons and controls */
                    body.printing-chart button {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" id="modal-overlay">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:w-full print:overflow-visible">
                    <div className="p-3 border-b border-gray-200 flex items-center justify-between print-hidden bg-white gap-1.5">
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-gray-800">Visit Chart</h2>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            {isSigned && (
                                <>
                                    <button 
                                        onClick={() => setShowAddendumModal(true)} 
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                    >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        <span>Add Addendum</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            // Pre-populate diagnosis codes from problems
                                            const diagnosisCodes = problems
                                                .filter(p => p.icd10_code)
                                                .map(p => ({ code: p.icd10_code, description: p.problem_name }));
                                            setSelectedDiagnosisCodes(diagnosisCodes);
                                            setShowSuperbillModal(true);
                                        }} 
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                        style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #10B981, #059669)'}
                                    >
                                        <Receipt className="w-3.5 h-3.5" />
                                        <span>Create Superbill</span>
                                    </button>
                                    <button
                                        onClick={() => setShowPrintableOrders(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                        style={{ background: 'linear-gradient(to right, #16A34A, #15803D)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #15803D, #166534)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #16A34A, #15803D)'}
                                        title="Print Orders"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Print Orders</span>
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={() => setShowBillingModal(true)} 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                style={{ background: 'linear-gradient(to right, #8B5CF6, #7C3AED)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #7C3AED, #6D28D9)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #8B5CF6, #7C3AED)'}
                            >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>View Billing</span>
                            </button>
                            <button 
                                onClick={handlePrint} 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                                style={{ background: 'linear-gradient(to right, #6B7280, #4B5563)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #4B5563, #374151)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #6B7280, #4B5563)'}
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                            </button>
                            <button 
                                onClick={onClose} 
                                className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Alert if addendums exist - Full width banner */}
                    {addendums.length > 0 && (
                        <div className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-red-800 print-hidden">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                            <span>⚠️ This note has {addendums.length} addendum{addendums.length > 1 ? 's' : ''}. <a href="#addendums-section" className="underline font-bold hover:text-red-900">Scroll down to view</a>.</span>
                        </div>
                    )}

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-white py-6 px-8 max-w-4xl mx-auto rounded-2xl">
                        {/* Compact Combined Header: Clinic + Patient Info + Visit Info */}
                        <div className="mb-4 bg-blue-50/90 border-b-2 border-gray-300 rounded-t-lg shadow-sm">
                            <div className="px-5 py-3">
                                {/* Top Row: Clinic Logo + Clinic Info + Visit Info */}
                                <div className="visit-print-toprow flex items-center justify-between gap-4 mb-3 pb-3 border-b border-gray-300">
                                    {/* Logo + Clinic Info */}
                                    <div className="flex items-center gap-1 flex-1">
                                        {/* Bigger Logo without container */}
                                        <div className="flex-shrink-0">
                                            <img 
                                                src="/clinic-logo.png" 
                                                alt="myPCP Clinic Logo" 
                                                className="w-36 h-36 object-contain"
                                                onError={(e) => {
                                                    console.error('Failed to load clinic logo:', '/clinic-logo.png');
                                                    // Try alternative logo if main one fails
                                                    if (e.target.src !== '/logo.png') {
                                                        e.target.src = '/logo.png';
                                                    } else {
                                                        e.target.style.display = 'none';
                                                    }
                                                }}
                                                onLoad={() => {
                                                    console.log('Clinic logo loaded successfully');
                                                }}
                                            />
                                        </div>
                                        {/* Compact Clinic Info - 6 Rows */}
                                        <div className="flex-1 ml-4">
                                            <div className="flex flex-col gap-0.5 text-[11px] text-gray-700">
                                                <div>123 Medical Center Drive, Suite 100</div>
                                                <div>City, State 12345</div>
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-primary-600" />
                                                    <span>(555) 123-4567</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-primary-600" />
                                                    <span>Fax: (555) 123-4568</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-primary-600" />
                                                    <span>info@mypcp.com</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-primary-600 font-medium">www.bemypcp.com</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Compact Visit Info */}
                                    <div className="flex-shrink-0 text-right border-l border-gray-300 pl-4">
                                        <div className="text-xs font-semibold text-primary-700 mb-1">{visit.visit_type || 'Office Visit'}</div>
                                        <div className="text-[10px] text-gray-600 space-y-0.5">
                                            <div><span className="font-medium">Date:</span> {visitDate}</div>
                                            <div><span className="font-medium">Provider:</span> {providerName}</div>
                                        </div>
                                        {signedDate && (
                                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-300 rounded text-[9px]">
                                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                                                <span className="font-semibold text-green-700">SIGNED</span>
                                                <span className="text-green-600">{signedDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Row: Patient Info + Demographics */}
                                <div className="flex items-start gap-5">
                                    {/* Patient Name and Basic Info - Bigger */}
                                    <div className="flex-shrink-0">
                                        <h2 className="text-xl font-bold text-gray-900 mb-1.5">{patient.first_name} {patient.last_name}</h2>
                                        <div className="flex items-center gap-4 text-xs text-gray-700">
                                            <span><span className="font-semibold">MRN:</span> {patient.mrn}</span>
                                            <span><span className="font-semibold">DOB:</span> {patientDOB} ({patientAge}y)</span>
                                            <span><span className="font-semibold">Sex:</span> {patient.sex || 'N/A'}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Patient Demographics Grid - Bigger */}
                                    <div className="visit-print-demographics flex-1 grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2">
                                        {/* Phone */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Phone className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Phone</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight">{formatPhone(patient.phone) || 'Not provided'}</div>
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Mail className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Email</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight truncate">{patient.email || 'Not provided'}</div>
                                        </div>

                                        {/* Address */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <MapPin className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Address</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight">{formatAddress(patient)}</div>
                                        </div>

                                        {/* Insurance */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CreditCard className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Insurance</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight">
                                                {patient.insurance_provider || 'Not on file'}
                                                {patient.insurance_id && (
                                                    <div className="text-[10px] text-gray-600">Policy: {patient.insurance_id}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Pharmacy */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Building2 className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Pharmacy</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight">
                                                {patient.pharmacy_name || 'Not on file'}
                                                {patient.pharmacy_phone && (
                                                    <div className="text-[10px] text-gray-600">{formatPhone(patient.pharmacy_phone)}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Emergency Contact */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Users className="w-3 h-3 text-gray-500" />
                                                <span className="text-[10px] font-semibold text-gray-600 uppercase">Emergency</span>
                                            </div>
                                            <div className="text-xs text-gray-900 leading-tight">
                                                {patient.emergency_contact_name || 'Not provided'}
                                                {patient.emergency_contact_phone && (
                                                    <div className="text-[10px] text-gray-600">{formatPhone(patient.emergency_contact_phone)}</div>
                                                )}
                                                {patient.emergency_contact_relationship && (
                                                    <div className="text-[10px] text-gray-600">{patient.emergency_contact_relationship}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modular Note Sections - Clinical Flow Order - All sections always visible */}
                        <div className="space-y-4 bg-white rounded-xl p-6 shadow-sm">
                            {/* Chief Complaint - Always show */}
                            {renderSection('chiefComplaint', true, 'Chief Complaint', 
                                noteData.chiefComplaint ? (
                                    <p className="text-xs text-gray-800 leading-relaxed">{noteData.chiefComplaint}</p>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No chief complaint recorded</p>
                                )
                            )}

                            {/* Current Visit History - Always show */}
                            {renderSection('hpi', true, 'History of Present Illness',
                                noteData.hpi ? (
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.hpi}</p>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No history of present illness recorded</p>
                                )
                            )}

                            {renderSection('ros', true, 'Review of Systems',
                                noteData.rosNotes ? (
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.rosNotes) }} />
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No review of systems recorded</p>
                                )
                            )}

                            {/* Patient Background - Grouped Together - Always show section headers */}
                            <div className="border-t-2 border-gray-300 pt-4 mt-4">
                                <div className="space-y-3">
                                    {problems.length > 0 ? renderSection('pastMedicalHistory', true, 'Past Medical History',
                                        <div className="text-xs text-gray-700 space-y-1">
                                            {problems.map((problem, idx) => (
                                                <div key={idx} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0">
                                                    {problem.icd10_code && <span className="font-semibold">{problem.icd10_code}</span>}
                                                    {problem.icd10_code && ' - '}
                                                    <span>{problem.problem_name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : renderSection('pastMedicalHistory', true, 'Past Medical History',
                                        <p className="text-xs text-gray-500 italic">No past medical history recorded</p>
                                    )}

                                    {medications.length > 0 ? renderSection('medications', true, 'Current Medications',
                                        <div className="text-xs text-gray-700 space-y-2">
                                            {medications.map((med, idx) => (
                                                <div key={idx} className="pb-2 border-b border-gray-200 last:border-0 last:pb-0">
                                                    <div className="font-semibold text-gray-900">{med.medication_name}</div>
                                                    <div className="text-gray-600 text-[10px] space-y-0">
                                                        {med.dosage && <div>Dose: {med.dosage}</div>}
                                                        {med.frequency && <div>Frequency: {med.frequency}</div>}
                                                        {med.route && <div>Route: {med.route}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : renderSection('medications', true, 'Current Medications',
                                        <p className="text-xs text-gray-500 italic">No current medications</p>
                                    )}

                                    {allergies.length > 0 ? renderSection('allergies', true, 'Allergies',
                                        <div className="text-xs text-gray-700 space-y-1">
                                            {allergies.map((allergy, idx) => (
                                                <div key={idx} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0">
                                                    <span className="font-semibold">{allergy.allergen}</span>
                                                    {allergy.reaction && <div className="text-gray-600 text-[10px]">{allergy.reaction}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : renderSection('allergies', true, 'Allergies',
                                        <p className="text-xs text-gray-500 italic">No known allergies</p>
                                    )}

                                    {familyHistory.length > 0 ? renderSection('familyHistory', true, 'Family History',
                                        <div className="text-xs text-gray-700 space-y-1">
                                            {familyHistory.map((fh, idx) => (
                                                <div key={idx} className="pb-1 border-b border-gray-200 last:border-0 last:pb-0">
                                                    <span className="font-semibold">{fh.condition}</span>
                                                    {fh.relationship && <div className="text-gray-600 text-[10px]">{fh.relationship}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : renderSection('familyHistory', true, 'Family History',
                                        <p className="text-xs text-gray-500 italic">No family history recorded</p>
                                    )}

                                    {socialHistory ? renderSection('socialHistory', true, 'Social History',
                                        <div className="text-xs text-gray-700 space-y-1">
                                            {socialHistory?.smoking_status && <div className="pb-1 border-b border-gray-200"><span className="font-semibold">Smoking:</span> {socialHistory.smoking_status}</div>}
                                            {socialHistory?.alcohol_use && <div className="pb-1 border-b border-gray-200"><span className="font-semibold">Alcohol:</span> {socialHistory.alcohol_use}</div>}
                                            {socialHistory?.occupation && <div><span className="font-semibold">Occupation:</span> {socialHistory.occupation}</div>}
                                        </div>
                                    ) : renderSection('socialHistory', true, 'Social History',
                                        <p className="text-xs text-gray-500 italic">No social history recorded</p>
                                    )}
                                </div>
                            </div>

                            {/* Vital Signs - After Patient Background, Before Physical Exam */}
                            {renderSection('vitals', true, 'Vital Signs',
                                vitals && Object.keys(vitals).length > 0 ? (
                                    <div className="grid grid-cols-4 gap-1.5 text-xs text-gray-700">
                                        {vitals?.bp && <div><span className="font-semibold">BP:</span> {decodeHtmlEntities(String(vitals.bp))} mmHg</div>}
                                        {vitals?.pulse && <div><span className="font-semibold">HR:</span> {decodeHtmlEntities(String(vitals.pulse))} bpm</div>}
                                        {vitals?.temp && <div><span className="font-semibold">Temp:</span> {decodeHtmlEntities(String(vitals.temp))}°F</div>}
                                        {vitals?.resp && <div><span className="font-semibold">RR:</span> {decodeHtmlEntities(String(vitals.resp))} /min</div>}
                                        {vitals?.o2sat && <div><span className="font-semibold">O2 Sat:</span> {decodeHtmlEntities(String(vitals.o2sat))}%</div>}
                                        {vitals?.weight && <div><span className="font-semibold">Weight:</span> {decodeHtmlEntities(String(vitals.weight))} {vitals.weightUnit || 'lbs'}</div>}
                                        {vitals?.height && <div><span className="font-semibold">Height:</span> {decodeHtmlEntities(String(vitals.height))} {vitals.heightUnit || 'in'}</div>}
                                        {vitals?.bmi && <div><span className="font-semibold">BMI:</span> {decodeHtmlEntities(String(vitals.bmi))}</div>}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No vital signs recorded</p>
                                )
                            )}

                            {/* Physical Examination - After Vital Signs */}
                            {renderSection('physicalExam', true, 'Physical Examination',
                                noteData.peNotes ? (
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdownBold(noteData.peNotes) }} />
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No physical examination recorded</p>
                                )
                            )}

                            {/* Assessment & Plan - Always show */}
                            {renderSection('assessment', true, 'Assessment',
                                noteData.assessment ? (
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.assessment}</p>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No assessment recorded</p>
                                )
                            )}

                            {renderSection('plan', true, 'Plan',
                                noteData.planStructured && noteData.planStructured.length > 0 ? (
                                    <div className="text-xs text-gray-700 space-y-2">
                                        {noteData.planStructured.map((item, index) => (
                                            <div key={index} className="pb-2 border-b border-gray-200 last:border-0 last:pb-0">
                                                <div className="font-bold underline mb-1">
                                                    {index + 1}. {item.diagnosis}
                                                </div>
                                                <ul className="ml-4 space-y-0">
                                                    {item.orders.flatMap((order, orderIdx) => {
                                                        const orderParts = order.split(';').map(part => part.trim()).filter(part => part);
                                                        return orderParts.map((part, partIdx) => (
                                                            <li key={`${orderIdx}-${partIdx}`} className="list-disc text-gray-600 leading-relaxed">
                                                                {part}
                                                            </li>
                                                        ));
                                                    })}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : noteData.plan ? (
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{noteData.plan}</p>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No plan recorded</p>
                                )
                            )}
                        </div>

                        {/* Addendums */}
                        {addendums.length > 0 && (
                            <div className="mt-6 pt-4 border-t-2 border-gray-300" id="addendums-section">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">Addendums</h3>
                                <div className="space-y-3">
                                    {addendums.map((addendum, idx) => (
                                        <div key={idx} className={`border-l-4 p-3 rounded ${
                                            addendum.signed 
                                                ? 'bg-green-50 border-green-400' 
                                                : 'bg-yellow-50 border-yellow-400'
                                        }`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-xs text-gray-600">
                                                    {addendum.signed ? (
                                                        <>
                                                            <span className="font-semibold text-green-700">✓ Signed</span> by {addendum.signedByName} on {format(new Date(addendum.signedAt), 'MM/dd/yyyy h:mm a')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            Added by {addendum.addedByName} on {format(new Date(addendum.addedAt), 'MM/dd/yyyy h:mm a')}
                                                            <span className="ml-2 text-orange-600 font-semibold">(Unsigned - Must be signed)</span>
                                                        </>
                                                    )}
                                                </div>
                                                {!addendum.signed && isSigned && (
                                                    <button
                                                        onClick={() => {
                                                            setAddendumToSignIndex(idx);
                                                            setShowSignAddendumModal(true);
                                                        }}
                                                        className="px-2 py-0.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                                    >
                                                        Sign Addendum
                                                    </button>
                                                )}
                                            </div>
                                            <div className={`text-xs whitespace-pre-wrap ${
                                                addendum.signed ? 'text-gray-900' : 'text-gray-800'
                                            }`}>
                                                {addendum.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Signature and Footer */}
                        <div className="mt-6 pt-4 border-t-2 border-gray-300">
                            {signedDate && (
                                <div className="mb-3 text-xs text-gray-700">
                                    <div className="font-semibold">Signed by: {providerName} | Date/Time: {signedDate}</div>
                                </div>
                            )}
                            {/* PageMD Stamp */}
                            <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-400 opacity-60">
                                <span>Generated by</span>
                                <span className="font-semibold text-gray-500">PageMD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Addendum Modal */}
            {showAddendumModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddendumModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Add Addendum</h3>
                            <button onClick={() => setShowAddendumModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Addendum Text</label>
                                <textarea
                                    value={addendumText}
                                    onChange={(e) => setAddendumText(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent h-32"
                                    placeholder="Enter addendum text..."
                                />
                            </div>
                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => {
                                        setShowAddendumModal(false);
                                        setAddendumText('');
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAddAddendum(false)}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #6B7280, #4B5563)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #4B5563, #374151)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #6B7280, #4B5563)'}
                                >
                                    Add & Sign Later
                                </button>
                                <button
                                    onClick={() => handleAddAddendum(true)}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #10B981, #059669)'}
                                >
                                    Add & Sign Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sign Addendum Modal */}
            {showSignAddendumModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
                    setShowSignAddendumModal(false);
                    setAddendumToSignIndex(null);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Sign Addendum</h3>
                            <button onClick={() => {
                                setShowSignAddendumModal(false);
                                setAddendumToSignIndex(null);
                            }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p className="text-sm text-yellow-800">
                                    <strong>Warning:</strong> Once signed, this addendum cannot be edited or deleted. 
                                    This action is permanent and legally binding.
                                </p>
                            </div>
                            {addendumToSignIndex !== null && addendums[addendumToSignIndex] && (
                                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                                    <p className="text-xs text-gray-600 mb-1">Addendum Text:</p>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{addendums[addendumToSignIndex].text}</p>
                                </div>
                            )}
                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => {
                                        setShowSignAddendumModal(false);
                                        setAddendumToSignIndex(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSignAddendum}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
                                >
                                    Sign Addendum
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Superbill Modal */}
            {showSuperbillModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4" onClick={() => setShowSuperbillModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Create Superbill</h3>
                            <button onClick={() => setShowSuperbillModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            {/* Diagnosis Codes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis Codes (ICD-10)</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                                    {problems.filter(p => p.icd10_code).map((problem, idx) => {
                                        const isSelected = selectedDiagnosisCodes.some(d => d.code === problem.icd10_code);
                                        return (
                                            <label key={idx} className="flex items-center space-x-1.5 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedDiagnosisCodes([...selectedDiagnosisCodes, {
                                                                code: problem.icd10_code,
                                                                description: problem.problem_name
                                                            }]);
                                                        } else {
                                                            setSelectedDiagnosisCodes(selectedDiagnosisCodes.filter(d => d.code !== problem.icd10_code));
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm">{problem.icd10_code} - {problem.problem_name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Procedure Codes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Procedure Codes (CPT)</label>
                                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded p-2">
                                    {feeSchedule.filter(f => f.code_type === 'CPT').slice(0, 50).map((fee, idx) => {
                                        const isSelected = selectedProcedureCodes.some(p => p.code === fee.code);
                                        return (
                                            <label key={idx} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                <div className="flex items-center space-x-1.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProcedureCodes([...selectedProcedureCodes, {
                                                                    code: fee.code,
                                                                    description: fee.description,
                                                                    amount: fee.fee_amount
                                                                }]);
                                                            } else {
                                                                setSelectedProcedureCodes(selectedProcedureCodes.filter(p => p.code !== fee.code));
                                                            }
                                                        }}
                                                    />
                                                    <span className="text-sm">{fee.code} - {fee.description}</span>
                                                </div>
                                                {fee.fee_amount && (
                                                    <span className="text-sm font-semibold text-gray-700">${parseFloat(fee.fee_amount).toFixed(2)}</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                                    <span className="text-xl font-bold text-primary-600">
                                        ${selectedProcedureCodes.reduce((sum, code) => {
                                            const feeItem = feeSchedule.find(f => f.code === code.code && f.code_type === 'CPT');
                                            return sum + (feeItem?.fee_amount ? parseFloat(feeItem.fee_amount) : 0);
                                        }, 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => {
                                        setShowSuperbillModal(false);
                                        setSelectedDiagnosisCodes([]);
                                        setSelectedProcedureCodes([]);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateSuperbill}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Create Superbill
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Billing Modal */}
            {showBillingModal && (
                <BillingModal
                    patientId={patientId}
                    visitId={visitId}
                    isOpen={showBillingModal}
                    onClose={() => setShowBillingModal(false)}
                />
            )}

            {/* Printable Orders Modal */}
            {showPrintableOrders && visit && patient && (
                <PrintableOrders
                    visitId={visitId}
                    patientId={patientId}
                    patientName={patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'N/A'}
                    visitDate={visit.visit_date || visit.created_at || new Date().toISOString()}
                    planStructured={noteData.planStructured || []}
                    onClose={() => setShowPrintableOrders(false)}
                />
            )}

            {/* Print Preview Modal */}
            {showPrintPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                            <h3 className="text-lg font-semibold text-gray-900">Print Preview</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print</span>
                                </button>
                                <button
                                    onClick={() => setShowPrintPreview(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-gray-100 p-4">
                            <div className="bg-white shadow-lg mx-auto" style={{ width: '8.5in', minHeight: '11in', padding: '0.5in' }}>
                                {/* Show actual visit chart view content for preview */}
                                <div id="print-preview-content" className="print-preview">
                                    {/* Render the same content structure but read-only */}
                                    {visit && patient && (
                                        <div className="space-y-4">
                                            {/* Header */}
                                            <div className="mb-4 bg-blue-50/90 border-b-2 border-gray-300 rounded-t-lg shadow-sm">
                                                <div className="px-5 py-3">
                                                    <div className="text-xs text-gray-600 mb-1">123 Medical Center Drive, Suite 100</div>
                                                    <div className="text-xs text-gray-600 mb-1">City, State 12345</div>
                                                    <div className="text-xs text-gray-600">(555) 123-4567 | Fax: (555) 123-4568</div>
                                                </div>
                                            </div>
                                            
                                            {/* Patient Info */}
                                            <div className="mb-4">
                                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                                    {patient.first_name} {patient.last_name}
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    DOB: {patient.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A'} | 
                                                    MRN: {patient.mrn || 'N/A'}
                                                </div>
                                            </div>
                                            
                                            {/* Visit Info */}
                                            <div className="mb-4 text-xs text-gray-600">
                                                <div>Visit Date: {visit.visit_date ? format(new Date(visit.visit_date), 'MM/dd/yyyy') : 'N/A'}</div>
                                                <div>Provider: {visit.provider_name || 'N/A'}</div>
                                            </div>
                                            
                                            {/* Note Content */}
                                            {noteData.hpi && (
                                                <div className="mb-4">
                                                    <div className="font-semibold text-sm text-gray-900 mb-2">History of Present Illness:</div>
                                                    <div className="text-xs text-gray-800 whitespace-pre-wrap">{noteData.hpi}</div>
                                                </div>
                                            )}
                                            
                                            {noteData.peNotes && (
                                                <div className="mb-4">
                                                    <div className="font-semibold text-sm text-gray-900 mb-2">Physical Examination:</div>
                                                    <div className="text-xs text-gray-800 whitespace-pre-wrap">{noteData.peNotes}</div>
                                                </div>
                                            )}
                                            
                                            {noteData.assessment && (
                                                <div className="mb-4">
                                                    <div className="font-semibold text-sm text-gray-900 mb-2">Assessment:</div>
                                                    <div className="text-xs text-gray-800 whitespace-pre-wrap">{noteData.assessment}</div>
                                                </div>
                                            )}
                                            
                                            {noteData.plan && (
                                                <div className="mb-4">
                                                    <div className="font-semibold text-sm text-gray-900 mb-2">Plan:</div>
                                                    <div className="text-xs text-gray-800 whitespace-pre-wrap">{noteData.plan}</div>
                                                </div>
                                            )}
                                            
                                            {/* Addendums */}
                                            {addendums.length > 0 && (
                                                <div className="mt-6 pt-4 border-t-2 border-gray-300">
                                                    <h3 className="text-sm font-bold text-gray-900 mb-3">Addendums</h3>
                                                    <div className="space-y-3">
                                                        {addendums.map((addendum, idx) => (
                                                            <div key={idx} className={`border-l-4 p-3 rounded ${
                                                                addendum.signed
                                                                    ? 'bg-green-50 border-green-400'
                                                                    : 'bg-yellow-50 border-yellow-400'
                                                            }`}>
                                                                <div className="text-xs text-gray-600 mb-1">
                                                                    {addendum.signed ? (
                                                                        <>
                                                                            <span className="font-semibold text-green-700">✓ Signed</span> by {addendum.signedByName} on {format(new Date(addendum.signedAt), 'MM/dd/yyyy h:mm a')}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            Added by {addendum.addedByName} on {format(new Date(addendum.addedAt), 'MM/dd/yyyy h:mm a')}
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-800 whitespace-pre-wrap">{addendum.text}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

// Billing Modal Component
const BillingModal = ({ patientId, visitId, isOpen, onClose }) => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && patientId) {
            fetchClaims();
        }
    }, [isOpen, patientId]);

    const fetchClaims = async () => {
        try {
            const response = await billingAPI.getClaimsByPatient(patientId);
            setClaims(response.data || []);
        } catch (error) {
            console.error('Error fetching claims:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Billing & Claims</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {loading ? (
                    <div className="text-center py-8">Loading...</div>
                ) : claims.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No claims found</div>
                ) : (
                    <div className="space-y-4">
                        {claims.map((claim) => (
                            <div key={claim.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            {claim.visit_type || 'Visit'} - {claim.visit_date ? format(new Date(claim.visit_date), 'MM/dd/yyyy') : ''}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Status: <span className={`font-medium ${
                                                claim.status === 'paid' ? 'text-green-600' :
                                                claim.status === 'denied' ? 'text-red-600' :
                                                claim.status === 'submitted' ? 'text-blue-600' :
                                                'text-gray-600'
                                            }`}>{claim.status}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-900">${parseFloat(claim.total_amount || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                                {claim.diagnosis_codes && (
                                    <div className="text-xs text-gray-600 mt-2">
                                        <span className="font-medium">Diagnosis:</span> {Array.isArray(claim.diagnosis_codes) 
                                            ? claim.diagnosis_codes.map(d => d.code).join(', ')
                                            : JSON.parse(claim.diagnosis_codes || '[]').map(d => d.code).join(', ')}
                                    </div>
                                )}
                                {claim.procedure_codes && (
                                    <div className="text-xs text-gray-600 mt-1">
                                        <span className="font-medium">Procedures:</span> {Array.isArray(claim.procedure_codes)
                                            ? claim.procedure_codes.map(p => p.code).join(', ')
                                            : JSON.parse(claim.procedure_codes || '[]').map(p => p.code).join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisitChartView;
