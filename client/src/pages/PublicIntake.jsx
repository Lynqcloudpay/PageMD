import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Heart, Shield, ChevronRight, CheckCircle,
    ClipboardList, AlertCircle, Phone, Calendar,
    User, ArrowRight, Lock, Key, Smartphone, Building, Pill, X, Globe
} from 'lucide-react';
import { intakeAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';

const PublicIntake = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clinicSlug = searchParams.get('clinic');

    const [view, setView] = useState('landing'); // landing, start, resume, session, candidates
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Clinic Info
    const [clinicInfo, setClinicInfo] = useState(null);

    // Session State
    const [session, setSession] = useState(null);
    const [candidates, setCandidates] = useState([]); // For multiple matches

    // Start Form State
    const [startForm, setStartForm] = useState({
        firstName: '',
        lastName: '',
        dob: '',
        phone: ''
    });

    // Continue Form State (Replacement for Resume)
    const [continueForm, setContinueForm] = useState({
        lastName: '',
        dob: '',
        phone: ''
    });

    // Main Intake Data
    const [formData, setFormData] = useState({});
    const [currentStep, setCurrentStep] = useState(0);
    const [language, setLanguage] = useState('en'); // 'en' or 'es'

    const t = (key) => {
        const translations = {
            en: {
                finish: "Finish",
                searching: "Searching...",
                multiple_matches: "Multiple Matches",
                multiple_matches_msg: "We found more than one session. Please select yours:",
                active: "Active",
                search_again: "Search Again",
                reg_submitted: "Registration Submitted",
                reg_received_msg: "Your registration has been received. Please return this device or alert the front desk.",
                phone_match_msg: "Must match the number used to start registration.",
                select_lang_title: "Select Language"
            },
            es: {
                welcome: "Bienvenido a",
                registration: "Registro de Pacientes",
                secure_msg: "Complete su registro de forma segura en su propio dispositivo.",
                start_new: "Iniciar Registro Nuevo",
                continue: "Continuar Registro",
                find_reg: "Buscar Registro",
                first_name: "Nombre",
                last_name: "Apellido",
                dob: "Fecha de Nacimiento",
                phone: "Número de Teléfono",
                get_started: "Comenzar",
                creating_session: "Creando sesión...",
                continue_btn: "Continuar",
                submit: "Enviar Registro",
                review: "Revisar Envío",
                signing_as: "Firmando como",
                electronically_signed: "Firmado Electrónicamente",
                finish: "Finalizar",
                searching: "Buscando...",
                multiple_matches: "Múltiples Coincidencias",
                multiple_matches_msg: "Encontramos más de una sesión. Por favor seleccione la suya:",
                active: "Activo",
                search_again: "Buscar de Nuevo",
                reg_submitted: "Registro Enviado",
                reg_received_msg: "Su registro ha sido recibido. Por favor devuelva este dispositivo o avise a la recepción.",
                phone_match_msg: "Debe coincidir con el número utilizado para iniciar el registro.",
                select_lang_title: "Seleccionar Idioma"
            }
        };
        return translations[language][key] || key;
    };

    // Fetch clinic info on mount
    useEffect(() => {
        const fetchClinicInfo = async () => {
            try {
                const res = await intakeAPI.getClinicInfo();
                setClinicInfo(res.data);
            } catch (e) {
                console.error('Failed to fetch clinic info:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchClinicInfo();
    }, []);

    const handleStart = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await intakeAPI.start(startForm, clinicSlug);
            setSession({
                id: res.data.sessionId,
                prefill: startForm,
                data: {},
                status: 'IN_PROGRESS'
            });
            setFormData({
                firstName: startForm.firstName,
                lastName: startForm.lastName,
                dob: startForm.dob,
                phone: startForm.phone
            });
            setView('session'); // Immediately proceed
            showSuccess('Registration started!');
        } catch (error) {
            showError('Failed to start registration. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleContinueLookup = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await intakeAPI.continue(continueForm, clinicSlug);
            if (res.data.sessionId) {
                // One match found
                fetchAndOpenSession(res.data.sessionId);
            } else if (res.data.candidates) {
                // Multiple matches
                setCandidates(res.data.candidates);
                setView('candidates');
            }
        } catch (error) {
            showError(error.response?.data?.error || 'Lookup failed');
        } finally {
            setSubmitting(false);
        }
    };

    const fetchAndOpenSession = async (id) => {
        setLoading(true);
        try {
            const res = await intakeAPI.getSessionPublic(id, continueForm, clinicSlug);
            setSession({
                id: res.data.id,
                prefill: res.data.prefill_json,
                data: res.data.data_json || {},
                status: res.data.status,
                reviewNotes: res.data.review_notes || []
            });
            setFormData(res.data.data_json || {});
            setView('session');
        } catch (error) {
            showError(error.response?.data?.error || 'Failed to load your registration session.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data) => {
        if (!session?.id) return;
        try {
            await intakeAPI.save(session.id, data || formData);
        } catch (e) {
            console.error('Autosave failed');
        }
    };

    const handleSubmit = async (signature) => {
        setSubmitting(true);
        try {
            await intakeAPI.submit(session.id, { ...formData, language }, signature);
            setSession(prev => ({ ...prev, status: 'SUBMITTED' }));
            showSuccess(language === 'es' ? 'Formulario enviado con éxito' : 'Form submitted successfully');
        } catch (e) {
            showError(language === 'es' ? 'Error al enviar' : 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-fadeIn relative">
                {/* Responsive Fixed Language Toggle */}
                <div className="fixed top-4 right-4 sm:top-8 sm:right-8 z-50 flex items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md p-1 sm:p-1.5 rounded-2xl border border-blue-100 shadow-xl shadow-blue-900/5 transition-all hover:shadow-2xl">
                    <div className="flex items-center gap-1.5 px-2 sm:px-3 text-blue-500">
                        <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse-slow" />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest hidden md:block">{t('select_lang_title')}</span>
                    </div>
                    <div className="flex gap-0.5 sm:gap-1 bg-slate-50 p-0.5 sm:p-1 rounded-xl border border-slate-100">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-md sm:shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-blue-600 hover:bg-white'}`}
                        >
                            {language === 'es' ? 'EN' : 'English'}
                        </button>
                        <button
                            onClick={() => setLanguage('es')}
                            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${language === 'es' ? 'bg-blue-600 text-white shadow-md sm:shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-blue-600 hover:bg-white'}`}
                        >
                            {language === 'es' ? 'Español' : 'ES'}
                        </button>
                    </div>
                </div>

                {/* Branded Clinic Header (Azure Theme) */}
                <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl shadow-blue-900/10 p-10 border border-blue-50 flex flex-col items-center mb-10 animate-slideUp relative overflow-hidden">
                    <div className="w-48 h-32 flex items-center justify-center mb-8 p-4 bg-white rounded-3xl border border-blue-50/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-transparent"></div>
                        {clinicInfo?.logoUrl ? (
                            <img
                                src={clinicInfo.logoUrl}
                                alt={clinicInfo.name}
                                className="max-w-full max-h-full object-contain relative z-10"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center relative z-10 shadow-lg shadow-blue-200">
                                <Building className="w-8 h-8 text-white" />
                            </div>
                        )}
                    </div>

                    <h1 className="text-3xl font-black text-blue-900 tracking-tight text-center leading-tight mb-4">
                        {clinicInfo?.name || t('registration')}
                    </h1>

                    <div className="flex flex-col items-center gap-2 text-center">
                        {clinicInfo?.address && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                <span className="max-w-[250px] whitespace-pre-wrap">{clinicInfo.address}</span>
                            </div>
                        )}
                        {clinicInfo?.phone && (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold ring-1 ring-blue-100">
                                <Phone className="w-3 h-3" /> {clinicInfo.phone}
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-blue-500 font-bold text-sm mb-12 max-w-sm tracking-tight">
                    {t('secure_msg')}
                </div>

                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => setView('start')}
                        className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5"
                    >
                        <User className="w-5 h-5" /> {t('start_new')}
                    </button>
                    <button
                        onClick={() => setView('resume')}
                        className="w-full py-5 bg-white border-2 border-blue-100 text-blue-600 rounded-[2rem] font-bold flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-blue-50"
                    >
                        <ArrowRight className="w-5 h-5" /> {t('continue')}
                    </button>
                </div>

                <div className="mt-16 flex items-center gap-3 text-blue-400">
                    <div className="flex items-center gap-1.5 bg-blue-50/50 px-4 py-2 rounded-full border border-blue-100">
                        <Shield className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Azure Secure Encryption</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-blue-50/50 px-4 py-2 rounded-full border border-blue-100">
                        <Lock className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">HIPAA Compliant</span>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'start') {
        return (
            <div className="min-h-screen bg-blue-50/30 flex flex-col items-center p-6 animate-slideUp">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-blue-50 p-8 space-y-8 mt-12 border border-blue-50">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setView('landing')} className="p-2 hover:bg-blue-50 rounded-xl text-blue-400 transition-all"><ChevronLeft className="w-6 h-6" /></button>
                        <h2 className="text-xl font-bold text-gray-900">{t('get_started')}</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleStart} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('first_name')}</label>
                                    <input required type="text" placeholder="John" value={startForm.firstName} onChange={e => setStartForm({ ...startForm, firstName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('last_name')}</label>
                                    <input required type="text" placeholder="Doe" value={startForm.lastName} onChange={e => setStartForm({ ...startForm, lastName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('dob')}</label>
                                <input required type="date" value={startForm.dob} onChange={e => setStartForm({ ...startForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('phone')}</label>
                                <input required type="tel" placeholder="(555) 000-0000" value={startForm.phone} onChange={e => setStartForm({ ...startForm, phone: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            {submitting ? t('creating_session') : t('continue_btn')} <ChevronRight className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'resume') {
        return (
            <div className="min-h-screen bg-blue-50/30 flex flex-col items-center p-6 animate-slideUp">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-blue-50 p-8 space-y-8 mt-12 border border-blue-50">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setView('landing')} className="p-2 hover:bg-blue-50 rounded-xl text-blue-400 transition-all"><ChevronLeft className="w-6 h-6" /></button>
                        <h2 className="text-xl font-bold text-gray-900">{t('find_reg')}</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleContinueLookup} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('last_name')}</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Doe"
                                    value={continueForm.lastName}
                                    onChange={e => setContinueForm({ ...continueForm, lastName: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('dob')}</label>
                                <input required type="date" value={continueForm.dob} onChange={e => setContinueForm({ ...continueForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{t('phone')}</label>
                                <input
                                    required
                                    type="tel"
                                    placeholder="(555) 000-0000"
                                    value={continueForm.phone}
                                    onChange={e => setContinueForm({ ...continueForm, phone: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-blue-400 mt-2 ml-1">{t('phone_match_msg')}</p>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            {submitting ? t('searching') : t('continue')} <ChevronRight className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'candidates') {
        return (
            <div className="min-h-screen bg-blue-50/30 flex flex-col items-center p-6 animate-fadeIn">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-6 mt-12 border border-blue-50">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-blue-900 leading-tight">{t('multiple_matches')}</h2>
                        <p className="text-blue-600/70 font-medium">{t('multiple_matches_msg')}</p>
                    </div>

                    <div className="space-y-3">
                        {candidates.map(candidate => (
                            <button
                                key={candidate.id}
                                onClick={() => fetchAndOpenSession(candidate.id)}
                                className="w-full p-5 bg-blue-50/50 hover:bg-blue-600 hover:text-white border border-blue-100 rounded-2xl text-left transition-all active:scale-95 group"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <div className="font-extrabold text-lg flex items-center gap-2">
                                            {candidate.firstNameInitial}. {candidate.lastName}
                                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-widest group-hover:bg-blue-500 group-hover:text-white">
                                                {t('active')}
                                            </span>
                                        </div>
                                        <div className="text-sm opacity-70 flex items-center gap-2">
                                            <Calendar className="w-3 h-3" /> {new Date(candidate.dob).toLocaleDateString()}
                                            <span>•</span>
                                            <Smartphone className="w-3 h-3" /> {candidate.maskedPhone}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 opacity-30 group-hover:opacity-100" />
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-blue-50 text-center">
                        <button onClick={() => setView('resume')} className="text-blue-600 font-bold hover:underline">
                            {t('search_again')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'session') {
        if (session.status === 'SUBMITTED') {
            return (
                <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-8 animate-bounce">
                        <CheckCircle className="w-16 h-16 text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-blue-900 mb-4 tracking-tighter">{t('reg_submitted')}</h1>
                    <p className="text-blue-700 text-lg mb-8 max-w-md">{t('reg_received_msg')}</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100">{t('finish')}</button>
                </div>
            );
        }

        return <IntakeEditor session={session} formData={formData} setFormData={setFormData} onSave={handleSave} onSubmit={handleSubmit} submitting={submitting} templates={clinicInfo?.templates || {}} clinicInfo={clinicInfo} language={language} t={t} />;
    }

    return null;
};

/**
 * Reusable multi-step editor component
 */
const IntakeEditor = ({ session, formData, setFormData, onSave, onSubmit, submitting, templates, clinicInfo, language, t }) => {
    const [step, setStep] = useState(0);
    const [errors, setErrors] = useState({});
    const [viewingPolicy, setViewingPolicy] = useState(null);

    const processTemplate = (text) => {
        if (!text) return '';
        let processed = text;

        // Use Spanish version if requested and available
        if (language === 'es') {
            const esKey = viewingPolicy + '_es'; // viewingPolicy might not be set exactly right here
            // This is handled better in the render level where templates are passed.
        }

        processed = processed
            .replace(/{CLINIC_NAME}/g, clinicInfo?.name || '')
            .replace(/{CLINIC_ADDRESS}/g, clinicInfo?.address || '')
            .replace(/{CLINIC_PHONE}/g, clinicInfo?.phone || '')
            .replace(/{PRIVACY_EMAIL}/g, clinicInfo?.email || 'privacy@pagemd.com')
            .replace(/{EFFECTIVE_DATE}/g, new Date().toLocaleDateString())
            .replace(/{ROI_LIST}/g, (formData.roiPeople || []).map(p => `${p.name} (${p.relationship})`).join(', ') || (language === 'es' ? '___________________________' : '___________________________'));
        return processed;
    };

    const STEPS = [
        { id: 'demographics', title: language === 'es' ? 'Datos Personales' : 'Personal Info', icon: User },
        { id: 'guarantor', title: language === 'es' ? 'Facturación' : 'Billing Info', icon: Smartphone },
        { id: 'insurance', title: language === 'es' ? 'Seguro Médico' : 'Insurance', icon: Building },
        { id: 'allergies', title: language === 'es' ? 'Alergias' : 'Allergies', icon: AlertCircle },
        { id: 'medications', title: language === 'es' ? 'Medicamentos' : 'Medications', icon: Pill },
        { id: 'clinical', title: language === 'es' ? 'Historia Clínica' : 'Clinical History', icon: ClipboardList },
        { id: 'consent', title: language === 'es' ? 'Legal y Consentimiento' : 'Legal & Consent', icon: Shield },
        { id: 'review', title: language === 'es' ? 'Revisión' : 'Review', icon: CheckCircle }
    ];

    const validateStep = () => {
        const newErrors = {};
        const currentStepId = STEPS[step].id;

        if (currentStepId === 'demographics') {
            if (!formData.sex) newErrors.sex = 'Legal sex is required';
            if (!formData.addressLine1) newErrors.addressLine1 = 'Address is required';
            if (!formData.city) newErrors.city = 'City is required';
            if (!formData.state) newErrors.state = 'State is required';
            if (!formData.zip) newErrors.zip = 'Zip code is required';
            if (!formData.ecName) newErrors.ecName = 'Emergency contact name is required';
            if (!formData.ecRelationship) newErrors.ecRelationship = 'Relationship is required';
            if (!formData.ecPhone) newErrors.ecPhone = 'Emergency phone is required';
        }

        if (currentStepId === 'guarantor') {
            if (formData.isGuarantor === 'no') {
                if (!formData.guarantorName) newErrors.guarantorName = 'Guarantor name is required';
                if (!formData.guarantorDob) newErrors.guarantorDob = 'Guarantor DOB is required';
            }
        }

        if (currentStepId === 'insurance') {
            if (!formData.isSelfPay) {
                if (!formData.primaryInsuranceCarrier) newErrors.primaryInsuranceCarrier = 'Carrier is required';
                if (!formData.primaryMemberId) newErrors.primaryMemberId = 'Member ID is required';
            }
        }

        if (currentStepId === 'consent') {
            if (!formData.consentHIPAA) newErrors.consentHIPAA = 'HIPAA acknowledgment required';
            if (!formData.consentTreat) newErrors.consentTreat = 'Treatment consent required';
            if (!formData.consentAOB) newErrors.consentAOB = 'Assignment of benefits required';
            if (!formData.signature) newErrors.signature = 'Signature is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const next = () => {
        if (!validateStep()) {
            showError(language === 'es' ? 'Por favor complete todos los campos obligatorios' : 'Please fill in all required fields');
            return;
        }
        setStep(prev => prev + 1);
        window.scrollTo(0, 0);
        onSave();
    };

    const back = () => { setStep(prev => prev - 1); window.scrollTo(0, 0); };

    // Clinical List Helpers
    const addItem = (listName, item) => {
        const list = formData[listName] || [];
        setFormData({ ...formData, [listName]: [...list, item] });
    };

    const removeItem = (listName, index) => {
        const list = [...(formData[listName] || [])];
        list.splice(index, 1);
        setFormData({ ...formData, [listName]: list });
    };

    const renderStep = () => {
        switch (STEPS[step].id) {
            case 'demographics':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{language === 'es' ? 'Sexo Legal *' : 'Legal Sex *'}</label>
                                <select value={formData.sex || ''} onChange={e => setFormData({ ...formData, sex: e.target.value })} className={`w-full p-4 bg-white border ${errors.sex ? 'border-rose-300' : 'border-blue-50'} rounded-2xl shadow-sm font-bold text-blue-600`}>
                                    <option value="">{language === 'es' ? 'Seleccione...' : 'Select...'}</option>
                                    <option value="male">{language === 'es' ? 'Masculino' : 'Male'}</option>
                                    <option value="female">{language === 'es' ? 'Femenino' : 'Female'}</option>
                                    <option value="other">{language === 'es' ? 'Otro' : 'Other'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{language === 'es' ? 'Idioma' : 'Language'}</label>
                                <input type="text" placeholder={language === 'es' ? 'Ej: Español' : 'e.g. English'} value={formData.preferredLanguage || ''} onChange={e => setFormData({ ...formData, preferredLanguage: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-blue-50">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Dirección de Casa *' : 'Home Address *'}</h3>
                            <input type="text" placeholder={language === 'es' ? 'Calle y Número' : 'Street Address'} value={formData.addressLine1 || ''} onChange={e => setFormData({ ...formData, addressLine1: e.target.value })} className={`w-full p-4 bg-white border ${errors.addressLine1 ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                            <input type="text" placeholder={language === 'es' ? 'Apto / Suite (Opcional)' : 'Apt / Suite (Optional)'} value={formData.addressLine2 || ''} onChange={e => setFormData({ ...formData, addressLine2: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder={language === 'es' ? 'Ciudad' : 'City'} value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} className={`w-full p-4 bg-white border ${errors.city ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder={language === 'es' ? 'EDO' : 'ST'} value={formData.state || ''} onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })} maxLength={2} className={`w-full p-4 bg-white border ${errors.state ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                                    <input type="text" placeholder={language === 'es' ? 'Cod Postal' : 'Zip'} value={formData.zip || ''} onChange={e => setFormData({ ...formData, zip: e.target.value })} className={`w-full p-4 bg-white border ${errors.zip ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-blue-50">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Contacto de Emergencia *' : 'Emergency Contact *'}</h3>
                            <input type="text" placeholder={language === 'es' ? 'Nombre Completo' : 'Full Name'} value={formData.ecName || ''} onChange={e => setFormData({ ...formData, ecName: e.target.value })} className={`w-full p-4 bg-white border ${errors.ecName ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder={language === 'es' ? 'Parentesco' : 'Relationship'} value={formData.ecRelationship || ''} onChange={e => setFormData({ ...formData, ecRelationship: e.target.value })} className={`w-full p-4 bg-white border ${errors.ecRelationship ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                                <input type="tel" placeholder={language === 'es' ? 'Teléfono' : 'Phone Number'} value={formData.ecPhone || ''} onChange={e => setFormData({ ...formData, ecPhone: e.target.value })} className={`w-full p-4 bg-white border ${errors.ecPhone ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold`} />
                            </div>
                        </div>
                    </div>
                );
            case 'guarantor':
                return (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                            <label className="block text-sm font-bold text-blue-900 mb-4">{language === 'es' ? '¿Es el paciente el garante financiero? *' : 'Is the patient the financial guarantor? *'}</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => setFormData({ ...formData, isGuarantor: 'yes' })} className={`py-4 rounded-2xl font-bold transition-all ${formData.isGuarantor === 'yes' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-100'}`}>{language === 'es' ? 'Sí' : 'Yes'}</button>
                                <button type="button" onClick={() => setFormData({ ...formData, isGuarantor: 'no' })} className={`py-4 rounded-2xl font-bold transition-all ${formData.isGuarantor === 'no' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-100'}`}>No</button>
                            </div>
                        </div>

                        {formData.isGuarantor === 'no' && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Detalles del Garante' : 'Guarantor Details'}</h3>
                                <input type="text" placeholder={language === 'es' ? 'Nombre Completo del Garante' : 'Guarantor Full Name'} value={formData.guarantorName || ''} onChange={e => setFormData({ ...formData, guarantorName: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block ml-2">{language === 'es' ? 'FECHA NAC.' : 'DOB'}</label>
                                        <input type="date" value={formData.guarantorDob || ''} onChange={e => setFormData({ ...formData, guarantorDob: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block ml-2">{language === 'es' ? 'Parentesco' : 'Relationship'}</label>
                                        <input type="text" placeholder={language === 'es' ? 'Ej: Padre' : 'e.g. Parent'} value={formData.guarantorRelationship || ''} onChange={e => setFormData({ ...formData, guarantorRelationship: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'insurance':
                return (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isSelfPay || false}
                                    onChange={e => setFormData({
                                        ...formData,
                                        isSelfPay: e.target.checked,
                                        primaryInsuranceCarrier: e.target.checked ? 'Self-Pay' : '',
                                        primaryMemberId: e.target.checked ? 'NONE' : ''
                                    })}
                                    className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-black text-blue-900">{language === 'es' ? 'Paciente sin Seguro (Pago Propio)' : 'Patient is Self-Pay'}</div>
                                    <div className="text-xs text-blue-500 font-bold uppercase">{language === 'es' ? 'No se facturará a ningún seguro por esta visita' : 'No insurance will be billed for this visit'}</div>
                                </div>
                            </label>
                        </div>

                        {!formData.isSelfPay && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Seguro Primario *' : 'Primary Insurance *'}</h3>
                                <input
                                    type="text"
                                    placeholder={language === 'es' ? 'Compañía de Seguro (Ej: Aetna)' : 'Insurance Carrier (e.g. Aetna)'}
                                    value={formData.primaryInsuranceCarrier || ''}
                                    onChange={e => setFormData({ ...formData, primaryInsuranceCarrier: e.target.value })}
                                    className={`w-full p-4 bg-white border ${errors.primaryInsuranceCarrier ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold shadow-sm`}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder={language === 'es' ? 'ID del Miembro' : 'Member ID'}
                                        value={formData.primaryMemberId || ''}
                                        onChange={e => setFormData({ ...formData, primaryMemberId: e.target.value })}
                                        className={`w-full p-4 bg-white border ${errors.primaryMemberId ? 'border-rose-300' : 'border-blue-50'} rounded-2xl font-bold shadow-sm`}
                                    />
                                    <input
                                        type="text"
                                        placeholder={language === 'es' ? 'Grupo # (Opt)' : 'Group # (Opt)'}
                                        value={formData.primaryGroupNumber || ''}
                                        onChange={e => setFormData({ ...formData, primaryGroupNumber: e.target.value })}
                                        className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold shadow-sm"
                                    />
                                </div>
                                <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-blue-400" />
                                    <span className="text-xs font-bold text-blue-600">{language === 'es' ? 'Por favor traiga su tarjeta de seguro física a su cita.' : 'Please bring your physical insurance card to your appointment.'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'allergies':
                return (
                    <div className="space-y-6">
                        <label className="flex items-center gap-3 p-6 bg-white border border-blue-50 rounded-3xl shadow-sm cursor-pointer transition-all active:scale-95">
                            <input type="checkbox" checked={formData.allergiesNone || false} onChange={e => setFormData({ ...formData, allergiesNone: e.target.checked, allergyList: e.target.checked ? [] : formData.allergyList })} className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" />
                            <span className="font-black text-blue-900">{language === 'es' ? 'No tengo alergias conocidas' : 'No Known Allergies'}</span>
                        </label>

                        {!formData.allergiesNone && (
                            <div className="space-y-4">
                                {(formData.allergyList || []).map((a, i) => (
                                    <div key={i} className="p-4 bg-white border border-blue-50 rounded-2xl shadow-sm flex justify-between items-center group">
                                        <div>
                                            <div className="font-black text-blue-900">{a.allergen}</div>
                                            <div className="text-xs text-blue-400 font-bold uppercase">{a.reaction} • {a.severity}</div>
                                        </div>
                                        <button onClick={() => removeItem('allergyList', i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                                    </div>
                                ))}
                                <div className="bg-blue-50 p-4 rounded-3xl space-y-3">
                                    <input id="new-allergen" type="text" placeholder={language === 'es' ? 'Nombre de Alérgeno' : 'Allergen Name'} className="w-full p-4 rounded-2xl border-none font-bold" />
                                    <input id="new-reaction" type="text" placeholder={language === 'es' ? 'Reacción (Ej: Ronchas)' : 'Reaction (e.g. Hives)'} className="w-full p-4 rounded-2xl border-none font-bold" />
                                    <button onClick={() => {
                                        const name = document.getElementById('new-allergen').value;
                                        const react = document.getElementById('new-reaction').value;
                                        if (name) {
                                            addItem('allergyList', { allergen: name, reaction: react, severity: 'Moderate' });
                                            document.getElementById('new-allergen').value = '';
                                            document.getElementById('new-reaction').value = '';
                                        }
                                    }} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100">{language === 'es' ? '+ Agregar Alergia' : '+ Add Allergy'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'medications':
                return (
                    <div className="space-y-6">
                        <label className="flex items-center gap-3 p-6 bg-white border border-blue-50 rounded-3xl shadow-sm cursor-pointer transition-all active:scale-95">
                            <input type="checkbox" checked={formData.medsNone || false} onChange={e => setFormData({ ...formData, medsNone: e.target.checked, medsList: e.target.checked ? [] : formData.medsList })} className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" />
                            <span className="font-black text-blue-900">{language === 'es' ? 'No tomo medicamentos actualmente' : 'No Current Medications'}</span>
                        </label>

                        {!formData.medsNone && (
                            <div className="space-y-4">
                                {(formData.medsList || []).map((m, i) => (
                                    <div key={i} className="p-4 bg-white border border-blue-50 rounded-2xl shadow-sm flex justify-between items-center">
                                        <div>
                                            <div className="font-black text-blue-900">{m.name}</div>
                                            <div className="text-xs text-blue-400 font-bold uppercase">{m.dose} • {m.frequency}</div>
                                        </div>
                                        <button onClick={() => removeItem('medsList', i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                                    </div>
                                ))}
                                <div className="bg-blue-50 p-4 rounded-3xl space-y-3">
                                    <input id="med-name" type="text" placeholder={language === 'es' ? 'Nombre de Medicamento' : 'Medication Name'} className="w-full p-4 rounded-2xl border-none font-bold" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input id="med-dose" type="text" placeholder={language === 'es' ? 'Dosis (Ej: 10mg)' : 'Dose (e.g. 10mg)'} className="w-full p-4 rounded-2xl border-none font-bold" />
                                        <input id="med-freq" type="text" placeholder={language === 'es' ? 'Frecuencia (Ej: Diario)' : 'Freq (e.g. Daily)'} className="w-full p-4 rounded-2xl border-none font-bold" />
                                    </div>
                                    <button onClick={() => {
                                        const name = document.getElementById('med-name').value;
                                        const dose = document.getElementById('med-dose').value;
                                        const freq = document.getElementById('med-freq').value;
                                        if (name) {
                                            addItem('medsList', { name, dose, frequency: freq });
                                            document.getElementById('med-name').value = '';
                                            document.getElementById('med-dose').value = '';
                                            document.getElementById('med-freq').value = '';
                                        }
                                    }} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100">{language === 'es' ? '+ Agregar Medicamento' : '+ Add Medication'}</button>
                                </div>
                            </div>
                        )}
                        <div className="pt-4 border-t border-blue-50">
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">{language === 'es' ? 'Farmacia Preferida' : 'Preferred Pharmacy'}</label>
                            <input type="text" placeholder={language === 'es' ? 'Nombre y Ciudad de la Farmacia' : 'Pharmacy Name & City'} value={formData.preferredPharmacy || ''} onChange={e => setFormData({ ...formData, preferredPharmacy: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl font-bold" />
                        </div>
                    </div>
                );
            case 'clinical':
                return (
                    <div className="space-y-8 pb-12">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Condiciones Médicas Actuales' : 'Ongoing Medical Conditions'}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { en: 'Diabetes', es: 'Diabetes' },
                                    { en: 'Hypertension', es: 'Hipertensión' },
                                    { en: 'Asthma', es: 'Asma' },
                                    { en: 'Heart Disease', es: 'Enf. Cardiaca' },
                                    { en: 'Thyroid', es: 'Tiroides' },
                                    { en: 'Anxiety', es: 'Ansiedad' }
                                ].map(c => {
                                    const label = language === 'es' ? c.es : c.en;
                                    const value = c.en;
                                    return (
                                        <button key={value} type="button" onClick={() => {
                                            const conditions = formData.pmhConditions || [];
                                            if (conditions.includes(value)) removeItem('pmhConditions', conditions.indexOf(value));
                                            else addItem('pmhConditions', value);
                                        }} className={`p-4 rounded-2xl font-bold text-sm transition-all text-left ${formData.pmhConditions?.includes(value) ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-blue-50 text-blue-900 shadow-sm'}`}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <textarea placeholder={language === 'es' ? 'Otras condiciones (una por línea)...' : 'Other conditions (one per line)...'} value={formData.pmhOtherText || ''} onChange={e => setFormData({ ...formData, pmhOtherText: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl min-h-[100px] font-bold" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Antecedentes Quirúrgicos' : 'Surgical History'}</h3>
                            <textarea placeholder={language === 'es' ? 'Lista de cirugías mayores y años estimados...' : 'List major surgeries and estimated years...'} value={formData.surgeriesList || ''} onChange={e => setFormData({ ...formData, surgeriesList: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl min-h-[100px] font-bold" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Antecedentes Familiares' : 'Family History'}</h3>
                            <div className="space-y-2">
                                {[
                                    ['fhxHeartDisease', language === 'es' ? 'Enf. Cardiaca' : 'Heart Disease'],
                                    ['fhxDiabetes', language === 'es' ? 'Diabetes' : 'Diabetes'],
                                    ['fhxCancer', language === 'es' ? 'Cáncer' : 'Cancer'],
                                    ['fhxStroke', language === 'es' ? 'Infarto Cerebral' : 'Stroke']
                                ].map(([key, label]) => (
                                    <label key={key} className="flex items-center gap-3 p-4 bg-white border border-blue-50 rounded-2xl cursor-pointer">
                                        <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData({ ...formData, [key]: e.target.checked })} className="w-5 h-5 rounded text-blue-600" />
                                        <span className="font-bold text-blue-900">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">{language === 'es' ? 'Historia Social' : 'Social History'}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block">{language === 'es' ? 'TABAQUISMO' : 'Tobacco Use'}</label>
                                    <select value={formData.tobaccoUse || ''} onChange={e => setFormData({ ...formData, tobaccoUse: e.target.value })} className="w-full p-3 bg-white border border-blue-50 rounded-xl font-bold text-xs uppercase">
                                        <option value="">{language === 'es' ? 'Seleccione...' : 'Select...'}</option>
                                        <option value="never">{language === 'es' ? 'Nunca' : 'Never'}</option>
                                        <option value="former">{language === 'es' ? 'Anterior' : 'Former'}</option>
                                        <option value="current">{language === 'es' ? 'Actual' : 'Current'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block">{language === 'es' ? 'ALCOHOLISMO' : 'Alcohol Use'}</label>
                                    <select value={formData.alcoholUse || ''} onChange={e => setFormData({ ...formData, alcoholUse: e.target.value })} className="w-full p-3 bg-white border border-blue-50 rounded-xl font-bold text-xs uppercase">
                                        <option value="">{language === 'es' ? 'Seleccione...' : 'Select...'}</option>
                                        <option value="none">{language === 'es' ? 'Ninguno' : 'None'}</option>
                                        <option value="social">{language === 'es' ? 'Social' : 'Social'}</option>
                                        <option value="daily">{language === 'es' ? 'Diario' : 'Daily'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'consent':
                return (
                    <div className="space-y-8">
                        <div className="space-y-6">
                            {[
                                { key: 'consentHIPAA', label: language === 'es' ? 'Aviso de Privacidad (HIPAA)' : 'HIPAA Notice Acknowledgement', policy: language === 'es' ? templates.hipaa_notice_es : templates.hipaa_notice },
                                { key: 'consentTreat', label: language === 'es' ? 'Consentimiento para Tratamiento' : 'Consent to Medical Treatment', policy: language === 'es' ? templates.consent_to_treat_es : templates.consent_to_treat },
                                { key: 'consentAOB', label: language === 'es' ? 'Asignación de Beneficios' : 'Assignment of Benefits & Financial Policy', policy: language === 'es' ? templates.assignment_of_benefits_es : templates.assignment_of_benefits },
                                { key: 'consentROI', label: language === 'es' ? 'Divulgación de Información' : 'Authorized Release & Communications', policy: language === 'es' ? templates.release_of_information_es : templates.release_of_information }
                            ].map(c => (
                                <div key={c.key} className="bg-white border border-blue-50 rounded-3xl p-6 shadow-sm group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-extrabold text-blue-900">{c.label}</h3>
                                        <button
                                            type="button"
                                            onClick={() => setViewingPolicy(c)}
                                            className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1 rounded-full"
                                        >
                                            {language === 'es' ? 'LEER COMPLETO' : 'Click to Read Full'}
                                        </button>
                                    </div>
                                    <div
                                        onClick={() => setViewingPolicy(c)}
                                        className="text-xs text-blue-700 leading-relaxed max-h-24 overflow-hidden mb-4 bg-blue-50/30 p-4 rounded-xl border border-blue-50 font-medium cursor-pointer hover:bg-blue-50 transition-colors relative"
                                    >
                                        <div className="line-clamp-4 whitespace-pre-wrap">{processTemplate(c.policy) || (language === 'es' ? `Cargando ${c.label}...` : `Standard ${c.label} text...`)}</div>
                                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-blue-50/50 to-transparent"></div>
                                    </div>

                                    {c.key === 'consentROI' && (
                                        <div className="mb-6 space-y-4 border-t border-blue-50 pt-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 block tracking-widest">{language === 'es' ? 'Personas Autorizadas (Nombre, Relación)' : 'Authorized Individuals (Name, Relation)'}</label>
                                                <div className="space-y-2">
                                                    {(formData.roiPeople || []).map((p, i) => (
                                                        <div key={i} className="flex gap-2 items-center">
                                                            <div className="flex-1 text-xs font-bold text-blue-900 bg-blue-50/50 p-2 rounded-lg">{p.name} · {p.relationship}</div>
                                                            <button onClick={() => removeItem('roiPeople', i)} className="p-1 text-rose-400"><X className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2">
                                                        <input id="roi-name" type="text" placeholder={language === 'es' ? 'Nombre' : 'Name'} className="flex-1 p-2 text-xs border border-blue-50 rounded-lg" />
                                                        <input id="roi-rel" type="text" placeholder={language === 'es' ? 'Rel' : 'Rel'} className="w-20 p-2 text-xs border border-blue-50 rounded-lg" />
                                                        <button onClick={() => {
                                                            const name = document.getElementById('roi-name').value;
                                                            const rel = document.getElementById('roi-rel').value;
                                                            if (name) {
                                                                addItem('roiPeople', { name, relationship: rel });
                                                                document.getElementById('roi-name').value = '';
                                                                document.getElementById('roi-rel').value = '';
                                                            }
                                                        }} className="px-3 bg-blue-600 text-white rounded-lg text-xs font-bold">+</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" checked={formData[c.key] || false} onChange={e => setFormData({ ...formData, [c.key]: e.target.checked })} className="w-6 h-6 rounded-lg text-emerald-600 focus:ring-emerald-500 shadow-sm" />
                                        <span className="text-sm font-black text-blue-900">{language === 'es' ? 'Acepto y reconozco' : 'I acknowledge and agree'}</span>
                                    </label>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white border-2 border-dashed border-blue-100 rounded-3xl p-8 space-y-4">
                            <h3 className="text-center font-black text-blue-900 uppercase tracking-widest text-xs">{language === 'es' ? 'Firma Electrónica *' : 'E-Signature *'}</h3>
                            <input
                                type="text"
                                placeholder={language === 'es' ? 'Escriba su Nombre Completo para Firmar' : 'Type Full Legal Name to Sign'}
                                value={formData.signature || ''}
                                onChange={e => setFormData({ ...formData, signature: e.target.value })}
                                className="w-full p-6 text-center text-2xl font-script bg-amber-50/30 border-none rounded-2xl focus:ring-0 placeholder:text-blue-200"
                            />
                            <p className="text-[10px] text-center font-bold text-blue-400 uppercase tracking-tighter">{language === 'es' ? 'Entiendo que escribir mi nombre constituye una firma electrónica legal.' : 'I understand that typing my name above constitutes a legal electronic signature.'}</p>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-6">
                        <div className="bg-emerald-600 text-white rounded-3xl p-8 shadow-xl shadow-emerald-100">
                            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                            <h2 className="text-2xl font-bold mb-2">{language === 'es' ? 'Revisión Final' : 'Final Review'}</h2>
                            <p className="text-emerald-50 opacity-90">{language === 'es' ? 'Confirme que toda la información es correcta.' : 'Please confirm all information is accurate. This will be automatically attached to your clinical chart.'}</p>
                        </div>
                        <div className="bg-white border border-blue-50 rounded-3xl p-6 space-y-3">
                            <div className="flex justify-between border-b border-blue-50 pb-3">
                                <span className="text-blue-400 font-bold text-[10px] uppercase">{language === 'es' ? 'Paciente' : 'Patient'}</span>
                                <span className="font-extrabold text-gray-900">{formData.firstName} {formData.lastName}</span>
                            </div>
                            <div className="flex justify-between border-b border-blue-50 pb-3">
                                <span className="text-blue-400 font-bold text-[10px] uppercase">{language === 'es' ? 'Seguro' : 'Insurance'}</span>
                                <span className="font-extrabold text-gray-900 truncate max-w-[150px] text-right">{formData.primaryInsuranceCarrier}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-blue-400 font-bold text-[10px] uppercase">{language === 'es' ? 'Alergias' : 'Allergies'}</span>
                                <span className="font-extrabold text-rose-600">{formData.allergiesNone ? (language === 'es' ? 'NINGUNA' : 'NONE') : `${formData.allergyList?.length || 0} ${language === 'es' ? 'Listadas' : 'Listed'}`}</span>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-blue-50/20 pb-32">
            <div className="bg-white px-6 py-5 border-b border-blue-50 sticky top-0 z-20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Heart className="w-4 h-4 text-white fill-current" />
                    </div>
                    <span className="font-black text-blue-600 tracking-tight">Public Intake</span>
                </div>
                <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest outline outline-1 outline-blue-100">
                    Step {step + 1} of {STEPS.length}
                </div>
            </div>

            <div className="h-1.5 w-full bg-blue-50 overflow-hidden">
                <div
                    className="h-full bg-blue-600 transition-all duration-700 ease-out"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
            </div>

            <div className="max-w-md mx-auto p-6 space-y-8 mt-4">
                {session?.status === 'NEEDS_EDITS' && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-4">
                        <AlertCircle className="w-6 h-6 text-rose-500 flex-shrink-0" />
                        <div className="text-sm">
                            <span className="font-bold text-rose-900 block mb-1">Clinic Correction Note</span>
                            <span className="text-rose-700 italic">"{session.reviewNotes?.[session.reviewNotes.length - 1]?.note}"</span>
                        </div>
                    </div>
                )}

                {(() => {
                    const StepIcon = STEPS[step].icon;
                    return (
                        <h2 className="text-3xl font-black text-blue-900 flex items-center gap-3">
                            <StepIcon className="w-8 h-8 text-blue-600" />
                            {STEPS[step].title}
                        </h2>
                    );
                })()}

                {renderStep()}
                {/* Navigation & Progress */}
                {/* Policy Viewing Modal */}
                {viewingPolicy && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
                        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slideUp">
                            <div className="p-8 border-b border-blue-50 flex justify-between items-center shrink-0 bg-blue-50/30">
                                <div>
                                    <h2 className="text-xl font-black text-blue-900 leading-tight">{viewingPolicy.label}</h2>
                                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mt-1">{language === 'es' ? 'Documento Legal' : 'Legal Document'}</p>
                                </div>
                                <button onClick={() => setViewingPolicy(null)} className="p-3 bg-white text-blue-900 rounded-2xl shadow-sm hover:bg-blue-50 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <div className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap font-medium">
                                    {processTemplate(viewingPolicy.policy) || (language === 'es' ? `Cargando el documento...` : `Standard ${viewingPolicy.label} text...`)}
                                </div>
                            </div>
                            <div className="p-8 border-t border-blue-50 bg-slate-50/50">
                                <button
                                    onClick={() => {
                                        setFormData({ ...formData, [viewingPolicy.key]: true });
                                        setViewingPolicy(null);
                                    }}
                                    className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl shadow-blue-100 active:scale-95 transition-all"
                                >
                                    {language === 'es' ? 'Acepto y Continuo' : 'I Agree & Accept'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-blue-50 to-transparent pointer-events-none">
                    <div className="max-w-xl mx-auto flex gap-4 pointer-events-auto">
                        {step > 0 ? (
                            <button onClick={back} className="flex-1 py-5 bg-white border-2 border-blue-100 text-blue-600 rounded-3xl font-black active:scale-95 transition-all shadow-lg pointer-events-auto">
                                {language === 'es' ? 'Atrás' : 'Back'}
                            </button>
                        ) : (
                            <div className="flex-1"></div>
                        )}

                        {step < STEPS.length - 1 ? (
                            <button onClick={next} className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-blue-100 pointer-events-auto">
                                {language === 'es' ? 'Siguiente' : 'Next Step'}
                            </button>
                        ) : (
                            <button
                                onClick={() => onSubmit({ signed: true, timestamp: new Date() })}
                                disabled={submitting}
                                className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 pointer-events-auto"
                            >
                                {submitting ? (language === 'es' ? 'Enviando...' : 'Submitting...') : (language === 'es' ? 'Confirmar y Enviar' : 'Confirm & Submit')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChevronLeft = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

const Check = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

export default PublicIntake;
