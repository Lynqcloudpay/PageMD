import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Heart, Shield, ChevronRight, CheckCircle,
    ClipboardList, AlertCircle, Phone, Calendar,
    User, ArrowRight, Lock, Key, Smartphone, Building
} from 'lucide-react';
import { intakeAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';

const PublicIntake = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clinicSlug = searchParams.get('clinic');

    const [view, setView] = useState('landing'); // landing, start, resume, session
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Clinic Info
    const [clinicInfo, setClinicInfo] = useState(null);

    // Session State
    const [session, setSession] = useState(null);
    const [resumeCode, setResumeCode] = useState(''); // Only shown once at start

    // Start Form State
    const [startForm, setStartForm] = useState({
        firstName: '',
        lastName: '',
        dob: '',
        phone: ''
    });

    // Resume Form State
    const [resumeForm, setResumeForm] = useState({
        code: '',
        dob: ''
    });

    // Main Intake Data
    const [formData, setFormData] = useState({});
    const [currentStep, setCurrentStep] = useState(0);

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
            const res = await intakeAPI.start(startForm);
            setSession({
                id: res.data.sessionId,
                prefill: startForm,
                data: {},
                status: 'IN_PROGRESS'
            });
            setResumeCode(res.data.resumeCode);
            setFormData({
                firstName: startForm.firstName,
                lastName: startForm.lastName,
                dob: startForm.dob,
                phone: startForm.phone
            });
            setView('code_reveal');
        } catch (error) {
            showError('Failed to start registration. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResume = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await intakeAPI.resume(resumeForm.code, resumeForm.dob);
            setSession({
                id: res.data.sessionId,
                prefill: res.data.prefill,
                data: res.data.data || {},
                status: res.data.status,
                reviewNotes: res.data.reviewNotes || []
            });
            setFormData(res.data.data || {});
            setView('session');
        } catch (error) {
            showError(error.response?.data?.error || 'Resume failed');
        } finally {
            setSubmitting(false);
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
            await intakeAPI.submit(session.id, formData, signature);
            setSession(prev => ({ ...prev, status: 'SUBMITTED' }));
            showSuccess('Form submitted successfully');
        } catch (e) {
            showError('Submission failed');
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
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                {/* Clinic Logo or Default Icon */}
                {clinicInfo?.logoUrl ? (
                    <img
                        src={clinicInfo.logoUrl}
                        alt={clinicInfo.name || 'Clinic'}
                        className="h-24 w-auto object-contain mb-6 drop-shadow-lg"
                    />
                ) : (
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 mb-8">
                        <Heart className="w-10 h-10 text-white fill-current" />
                    </div>
                )}

                <h1 className="text-4xl font-black text-blue-900 mb-2 tracking-tight">
                    {clinicInfo?.name || 'Patient Registration'}
                </h1>
                <p className="text-blue-600 text-lg mb-12 max-w-sm font-medium">
                    Complete your registration securely on your own device.
                </p>

                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => setView('start')}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-blue-100"
                    >
                        <User className="w-5 h-5" /> Start New Registration
                    </button>
                    <button
                        onClick={() => setView('resume')}
                        className="w-full py-5 bg-white border-2 border-blue-50 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 hover:bg-blue-50"
                    >
                        <Key className="w-5 h-5" /> Resume Registration
                    </button>
                </div>

                <div className="mt-16 flex items-center gap-2 text-blue-300">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Azure Secure • HIPAA Compliant</span>
                </div>
            </div>
        );
    }

    if (view === 'start') {
        return (
            <div className="min-h-screen bg-blue-50/30 flex flex-col items-center p-6 animate-slideUp">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-blue-50 p-8 space-y-8 mt-12 border border-blue-50">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setView('landing')} className="p-2 hover:bg-blue-50 rounded-xl text-blue-400 Transition-all"><ChevronLeft className="w-6 h-6" /></button>
                        <h2 className="text-xl font-bold text-gray-900">Get Started</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleStart} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-blue-400 uppercase mb-2">First Name</label>
                                    <input required type="text" placeholder="John" value={startForm.firstName} onChange={e => setStartForm({ ...startForm, firstName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Last Name</label>
                                    <input required type="text" placeholder="Doe" value={startForm.lastName} onChange={e => setStartForm({ ...startForm, lastName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Date of Birth</label>
                                <input required type="date" value={startForm.dob} onChange={e => setStartForm({ ...startForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Phone Number</label>
                                <input required type="tel" placeholder="(555) 000-0000" value={startForm.phone} onChange={e => setStartForm({ ...startForm, phone: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            {submitting ? 'Creating Session...' : 'Continue'} <ChevronRight className="w-5 h-5" />
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
                        <h2 className="text-xl font-bold text-gray-900">Resume</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleResume} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Resume Code</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="8-character code"
                                    value={resumeForm.code}
                                    onChange={e => setResumeForm({ ...resumeForm, code: e.target.value.toUpperCase() })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-center font-mono text-xl tracking-widest text-blue-600 font-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Verify Date of Birth</label>
                                <input required type="date" value={resumeForm.dob} onChange={e => setResumeForm({ ...resumeForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                        >
                            {submitting ? 'Verifying...' : 'Unlock Forms'} <Lock className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'code_reveal') {
        return (
            <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 space-y-8">
                    <div className="space-y-2">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Smartphone className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900">Save Your Code</h2>
                        <p className="text-gray-500">Take a photo of this code. You will need it to resume if you are interrupted.</p>
                    </div>

                    <div className="bg-blue-50 border-2 border-dashed border-blue-100 rounded-3xl p-6 py-8">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Resume Code</p>
                        <div className="text-4xl font-mono font-black text-blue-600 tracking-[0.2em]">{resumeCode}</div>
                    </div>

                    <button
                        onClick={() => setView('session')}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all"
                    >
                        I've Saved It, Let's Continue
                    </button>
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
                    <h1 className="text-3xl font-extrabold text-blue-900 mb-4 tracking-tighter">Registration Submitted</h1>
                    <p className="text-blue-700 text-lg mb-8 max-w-md">Your registration has been received. Please return this device or alert the front desk.</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100">Finish</button>
                </div>
            );
        }

        return <IntakeEditor session={session} formData={formData} setFormData={setFormData} onSave={handleSave} onSubmit={handleSubmit} submitting={submitting} />;
    }

    return null;
};

/**
 * Reusable multi-step editor component
 */
const IntakeEditor = ({ session, formData, setFormData, onSave, onSubmit, submitting }) => {
    const [step, setStep] = useState(0);
    const STEPS = [
        { id: 'demographics', title: 'Demographics', icon: User },
        { id: 'insurance', title: 'Insurance', icon: Building },
        { id: 'medical', title: 'Medical History', icon: ClipboardList },
        { id: 'consent', title: 'Consents', icon: Shield },
        { id: 'review', title: 'Review', icon: CheckCircle }
    ];

    const next = () => {
        setStep(prev => prev + 1);
        window.scrollTo(0, 0);
        onSave();
    };
    const back = () => { setStep(prev => prev - 1); window.scrollTo(0, 0); };

    const renderStep = () => {
        switch (STEPS[step].id) {
            case 'demographics':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Legal Sex</label>
                                <select value={formData.sex || ''} onChange={e => setFormData({ ...formData, sex: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-blue-600">
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">SSN (Optional)</label>
                                <input type="password" value={formData.ssn || ''} onChange={e => setFormData({ ...formData, ssn: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Home Address</label>
                            <input type="text" placeholder="Street Address" value={formData.addressLine1 || ''} onChange={e => setFormData({ ...formData, addressLine1: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="City" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                            <input type="text" placeholder="Zip" value={formData.zip || ''} onChange={e => setFormData({ ...formData, zip: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                        </div>
                    </div>
                );
            case 'insurance':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Insurance Carrier</label>
                            <input type="text" placeholder="e.g. BCBS" value={formData.insuranceProvider || ''} onChange={e => setFormData({ ...formData, insuranceProvider: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Member ID / Policy Number</label>
                            <input type="text" value={formData.insuranceId || ''} onChange={e => setFormData({ ...formData, insuranceId: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 font-bold" />
                        </div>
                    </div>
                );
            case 'medical':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Primary Concern / Reason for Visit</label>
                            <textarea value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[100px] font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Medications & Allergies</label>
                            <textarea placeholder="List any medications or allergies..." value={formData.medications || ''} onChange={e => setFormData({ ...formData, medications: e.target.value })} className="w-full p-4 bg-white border border-blue-50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[100px] font-bold" />
                        </div>
                    </div>
                );
            case 'consent':
                return (
                    <div className="space-y-6">
                        <div className="bg-white border border-blue-50 rounded-3xl p-6 shadow-sm">
                            <h3 className="font-bold text-blue-900 mb-2">HIPAA & Privacy Notice</h3>
                            <p className="text-sm text-blue-700 leading-relaxed h-32 overflow-y-auto mb-4 bg-blue-50/50 p-4 rounded-xl border border-blue-50">
                                We are committed to protecting your health information. By signing below, you acknowledge that you have received a copy of our Notice of Privacy Practices...
                            </p>
                            <div className="pt-4 border-t border-blue-50">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={formData.consentHIPAA || false} onChange={e => setFormData({ ...formData, consentHIPAA: e.target.checked })} className="w-6 h-6 rounded-lg border-blue-100 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-blue-700 group-hover:text-blue-900 transition-colors">I Agree to the Privacy Terms</span>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-6">
                        <div className="bg-blue-600 text-white rounded-3xl p-8 shadow-xl shadow-blue-100">
                            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                            <h2 className="text-2xl font-bold mb-2">Ready to Submit?</h2>
                            <p className="text-blue-50 opacity-90">Please review your entries. Once submitted, you cannot make changes without staff assistance.</p>
                        </div>
                        <div className="bg-white border border-blue-50 rounded-3xl p-6 space-y-4">
                            <div className="flex justify-between border-b border-blue-50 pb-3">
                                <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Patient</span>
                                <span className="font-black text-gray-900">{formData.firstName} {formData.lastName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Insurance</span>
                                <span className="font-black text-gray-900">{formData.insuranceProvider || 'Not Provided'}</span>
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
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-blue-50 via-blue-50/95 to-transparent flex gap-4 max-w-md mx-auto pointer-events-none">
                {step > 0 ? (
                    <button onClick={back} className="flex-1 py-5 bg-white border-2 border-blue-100 text-blue-600 rounded-3xl font-black active:scale-95 transition-all shadow-lg pointer-events-auto">
                        Back
                    </button>
                ) : (
                    <div className="flex-1"></div>
                )}

                {step < STEPS.length - 1 ? (
                    <button onClick={next} className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-blue-100 pointer-events-auto">
                        Next Step
                    </button>
                ) : (
                    <button
                        onClick={() => onSubmit({ signed: true, timestamp: new Date() })}
                        disabled={submitting}
                        className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 pointer-events-auto"
                    >
                        {submitting ? 'Submitting...' : 'Confirm & Submit'}
                    </button>
                )}
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
