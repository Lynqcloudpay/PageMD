import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, User, Phone, Mail, MapPin, Stethoscope, CheckCircle2, CreditCard, Building2, Users, FilePlus, Receipt, DollarSign } from 'lucide-react';
import { visitsAPI, patientsAPI, billingAPI, codesAPI } from '../services/api';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';

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
    const [showSuperbillModal, setShowSuperbillModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
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
            const [patientRes, visitRes, allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes] = await Promise.all([
                patientsAPI.get(patientId),
                visitsAPI.get(visitId),
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
            setVisit(visitRes.data);
            const allergiesData = allergiesRes.data || [];
            const medicationsData = medicationsRes.data || [];
            const problemsData = problemsRes.data || [];
            const familyHistoryData = familyHistoryRes.data || [];
            const socialHistoryData = socialHistoryRes.data;
            
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

    const handlePrint = async () => {
        const visitChartView = document.getElementById('visit-chart-view');
        if (!visitChartView) {
            alert('Error: Could not find content to print');
            return;
        }
        
        // Temporarily hide buttons in the original
        const buttons = visitChartView.querySelectorAll('button');
        const originalDisplay = [];
        buttons.forEach((btn, index) => {
            originalDisplay[index] = btn.style.display;
            btn.style.display = 'none';
        });
        
        try {
            // Get visit date for filename
            const visitDateStr = visit?.visit_date 
                ? format(new Date(visit.visit_date), 'MMMM_d_yyyy') 
                : format(new Date(), 'MMMM_d_yyyy');
            
            // Simple, reliable PDF configuration
            const opt = {
                margin: 0.75, // Slightly larger margin for better appearance
                filename: `Visit_Note_${patient?.first_name || 'Patient'}_${patient?.last_name || ''}_${visitDateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 1.5, // Fixed scale that works well
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    letterRendering: false, // Disable letter rendering to avoid weird text breaks
                    allowTaint: false
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'portrait',
                    compress: false // Disable compression for better quality
                },
                pagebreak: { mode: ['avoid-all', 'css'] }
            };
            
            // Generate PDF directly from the visible element
            await html2pdf().set(opt).from(visitChartView).save();
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF: ' + error.message);
        } finally {
            // Restore button visibility
            buttons.forEach((btn, index) => {
                btn.style.display = originalDisplay[index] || '';
            });
        }
    };

    const handleAddAddendum = async () => {
        if (!addendumText.trim()) {
            alert('Please enter addendum text');
            return;
        }
        
        try {
            await visitsAPI.addAddendum(visitId, addendumText);
            // Refresh visit data
            const visitRes = await visitsAPI.get(visitId);
            const visitData = visitRes.data;
            if (visitData.addendums) {
                const addendumsData = Array.isArray(visitData.addendums) 
                    ? visitData.addendums 
                    : JSON.parse(visitData.addendums || '[]');
                setAddendums(addendumsData);
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
    const providerName = visit.provider_first_name && visit.provider_last_name
        ? `${visit.provider_first_name} ${visit.provider_last_name}`
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
                
                /* When printing, hide everything except the visit note */
                @media print {
                    /* Page setup */
                    @page {
                        size: letter portrait;
                        margin: 0.5in;
                    }
                    
                    /* Hide EVERYTHING by default - all common elements */
                    body > *:not(#modal-overlay),
                    header,
                    nav,
                    aside,
                    main:not(#modal-overlay),
                    footer,
                    .sidebar,
                    [class*="sidebar"],
                    [class*="nav"],
                    [class*="header"] {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    /* Hide root children except modal */
                    #root > *:not(#modal-overlay) {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    /* Show only the modal overlay */
                    #modal-overlay {
                        display: block !important;
                        visibility: visible !important;
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        overflow: visible !important;
                        box-shadow: none !important;
                        border: none !important;
                        z-index: 999999 !important;
                    }
                    
                    /* Modal container */
                    #modal-overlay > div {
                        position: static !important;
                        display: block !important;
                        visibility: visible !important;
                        background: white !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                    }
                    
                    /* Hide modal header with buttons */
                    #modal-overlay > div > .p-4 {
                        display: none !important;
                    }
                    
                    /* Visit chart view - make it visible and properly sized */
                    #visit-chart-view {
                        display: block !important;
                        visibility: visible !important;
                        position: relative !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        padding: 24px 32px !important;
                        margin: 0 !important;
                        background: white !important;
                        overflow: visible !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                    }
                    
                    /* Remove max-width constraints */
                    #visit-chart-view.max-w-4xl,
                    #visit-chart-view[class*="max-w"] {
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                    
                    /* Hide all buttons */
                    button {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    /* Preserve colors */
                    #visit-chart-view * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    /* Keep all layouts */
                    #visit-chart-view .flex {
                        display: flex !important;
                    }
                    #visit-chart-view .grid {
                        display: grid !important;
                    }
                    
                    /* Ensure all text is visible */
                    #visit-chart-view * {
                        color: inherit !important;
                        visibility: visible !important;
                    }
                    
                    /* Images */
                    #visit-chart-view img {
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                    }
                }
            `}</style>

            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden" id="modal-overlay">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:w-full print:overflow-visible">
                    <div className="p-4 border-b border-deep-gray/10 flex items-center justify-between print-hidden bg-gradient-to-r from-white to-soft-gray/30">
                        <h2 className="text-xl font-bold text-deep-gray">Visit Chart View</h2>
                        <div className="flex items-center gap-2">
                            {isSigned && (
                                <>
                                    <button 
                                        onClick={() => setShowAddendumModal(true)} 
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 hover:border-strong-azure/30 rounded-lg transition-all duration-200 hover:shadow-sm"
                                        title="Add Addendum"
                                    >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        <span>Addendum</span>
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
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 hover:border-strong-azure/30 rounded-lg transition-all duration-200 hover:shadow-sm"
                                        title="Create Superbill"
                                    >
                                        <Receipt className="w-3.5 h-3.5" />
                                        <span>Superbill</span>
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={() => setShowBillingModal(true)} 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 hover:border-strong-azure/30 rounded-lg transition-all duration-200 hover:shadow-sm"
                                title="View Billing"
                            >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Billing</span>
                            </button>
                            <button 
                                onClick={handlePrint} 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-deep-gray bg-white/80 hover:bg-white border border-deep-gray/10 hover:border-strong-azure/30 rounded-lg transition-all duration-200 hover:shadow-sm" 
                                title="Print"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                            </button>
                            <button 
                                onClick={onClose} 
                                className="flex items-center justify-center w-8 h-8 text-deep-gray/70 hover:text-deep-gray hover:bg-deep-gray/5 rounded-lg transition-all duration-200"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div id="visit-chart-view" className="flex-1 overflow-y-auto bg-white py-6 px-8 max-w-4xl mx-auto rounded-2xl print:!max-w-none print:!mx-0 print:!p-0 print:!rounded-none print:!w-full">
                        {/* Compact Combined Header: Clinic + Patient Info + Visit Info */}
                        <div className="mb-4 bg-blue-50/90 border-b-2 border-gray-300 rounded-t-lg shadow-sm">
                            <div className="px-5 py-3">
                                {/* Top Row: Clinic Logo + Clinic Info + Visit Info */}
                                <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-gray-300">
                                    {/* Logo + Clinic Info */}
                                    <div className="flex items-center gap-1 flex-1">
                                        {/* Bigger Logo without container */}
                                        <div className="flex-shrink-0">
                                            <img 
                                                src="/clinic-logo.png" 
                                                alt="myPCP Clinic Logo" 
                                                className="w-36 h-36 object-contain"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
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
                                    <div className="flex-1 grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2">
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
                                    <div className="grid grid-cols-4 gap-2 text-xs text-gray-700">
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
                            <div className="mt-6 pt-4 border-t-2 border-gray-300">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">Addendums</h3>
                                <div className="space-y-3">
                                    {addendums.map((addendum, idx) => (
                                        <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                            <div className="text-xs text-gray-600 mb-1">
                                                Added by {addendum.addedByName} on {format(new Date(addendum.addedAt), 'MM/dd/yyyy h:mm a')}
                                            </div>
                                            <div className="text-xs text-gray-900 whitespace-pre-wrap">{addendum.text}</div>
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
                            <div className="flex items-center justify-end gap-2 text-[10px] text-gray-400 opacity-60">
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
                            <div className="flex justify-end gap-2">
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
                                    onClick={handleAddAddendum}
                                    className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                >
                                    Add Addendum
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
                                            <label key={idx} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
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
                                                <div className="flex items-center space-x-2">
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

                            <div className="flex justify-end gap-2">
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
