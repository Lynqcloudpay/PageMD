import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Heart, Shield, ChevronRight, CheckCircle,
    ClipboardList, AlertCircle, Phone, Calendar,
    User, ArrowRight, Lock, Key, Smartphone
} from 'lucide-react';
import { intakeAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';

const PublicIntake = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clinicSlug = searchParams.get('clinic');

    const [view, setView] = useState('landing'); // landing, start, resume, session
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 mb-8">
                    <Heart className="w-10 h-10 text-white fill-current" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Patient Registration</h1>
                <p className="text-gray-500 text-lg mb-12 max-w-sm">Complete your registration securely on your own device.</p>

                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => setView('start')}
                        className="w-full py-5 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-gray-200"
                    >
                        <User className="w-5 h-5" /> Start New Registration
                    </button>
                    <button
                        onClick={() => setView('resume')}
                        className="w-full py-5 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 hover:bg-gray-50"
                    >
                        <Key className="w-5 h-5" /> Resume Registration
                    </button>
                </div>

                <div className="mt-16 flex items-center gap-2 text-gray-400">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">HIPAA Compliant & Secure</span>
                </div>
            </div>
        );
    }

    if (view === 'start') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 animate-slideUp">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8 mt-12">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setView('landing')} className="p-2 hover:bg-gray-50 rounded-xl"><ChevronLeft className="w-6 h-6 text-gray-400" /></button>
                        <h2 className="text-xl font-bold text-gray-900">Get Started</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleStart} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">First Name</label>
                                    <input required type="text" placeholder="John" value={startForm.firstName} onChange={e => setStartForm({ ...startForm, firstName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Last Name</label>
                                    <input required type="text" placeholder="Doe" value={startForm.lastName} onChange={e => setStartForm({ ...startForm, lastName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date of Birth</label>
                                <input required type="date" value={startForm.dob} onChange={e => setStartForm({ ...startForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Phone Number</label>
                                <input required type="tel" placeholder="(555) 000-0000" value={startForm.phone} onChange={e => setStartForm({ ...startForm, phone: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
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
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 animate-slideUp">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8 mt-12">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setView('landing')} className="p-2 hover:bg-gray-50 rounded-xl"><ChevronLeft className="w-6 h-6 text-gray-400" /></button>
                        <h2 className="text-xl font-bold text-gray-900">Resume</h2>
                        <div className="w-10"></div>
                    </div>

                    <form onSubmit={handleResume} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Resume Code</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="8-character code"
                                    value={resumeForm.code}
                                    onChange={e => setResumeForm({ ...resumeForm, code: e.target.value.toUpperCase() })}
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-center font-mono text-xl tracking-widest"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Verify Date of Birth</label>
                                <input required type="date" value={resumeForm.dob} onChange={e => setResumeForm({ ...resumeForm, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Smartphone className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900">Save Your Code</h2>
                        <p className="text-gray-500">Take a photo of this code. You'll need it to resume if you're interrupted.</p>
                    </div>

                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-6 py-8">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Resume Code</p>
                        <div className="text-4xl font-mono font-black text-blue-600 tracking-[0.2em]">{resumeCode}</div>
                    </div>

                    <button
                        onClick={() => setView('session')}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 active:scale-95 transition-all"
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
                <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-8 animate-bounce">
                        <CheckCircle className="w-16 h-16 text-teal-500" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-teal-900 mb-4">Submitted!</h1>
                    <p className="text-teal-800 text-lg mb-8 max-w-md">Your registration has been received. Please return your device or alert the front desk.</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold">Close</button>
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
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Legal Sex</label>
                                <select value={formData.sex || ''} onChange={e => setFormData({ ...formData, sex: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Social Security (Optional)</label>
                                <input type="password" value={formData.ssn || ''} onChange={e => setFormData({ ...formData, ssn: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Home Address</label>
                            <input type="text" placeholder="Street Address" value={formData.addressLine1 || ''} onChange={e => setFormData({ ...formData, addressLine1: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="City" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                            <input type="text" placeholder="Zip" value={formData.zip || ''} onChange={e => setFormData({ ...formData, zip: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                );
            case 'insurance':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Insurance Carrier</label>
                            <input type="text" placeholder="e.g. BCBS" value={formData.insuranceProvider || ''} onChange={e => setFormData({ ...formData, insuranceProvider: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Member ID / Policy Number</label>
                            <input type="text" value={formData.insuranceId || ''} onChange={e => setFormData({ ...formData, insuranceId: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                );
            case 'medical':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Primary Concern / Reason for Visit</label>
                            <textarea value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Medications & Allergies</label>
                            <textarea placeholder="List any current medications or allergies..." value={formData.medications || ''} onChange={e => setFormData({ ...formData, medications: e.target.value })} className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                        </div>
                    </div>
                );
            case 'consent':
                return (
                    <div className="space-y-6">
                        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                            <h3 className="font-bold text-gray-900 mb-2">HIPAA & Privacy Notice</h3>
                            <p className="text-sm text-gray-500 leading-relaxed h-32 overflow-y-auto mb-4 bg-gray-50 p-4 rounded-xl">
                                We are committed to protecting your health information. By signing below, you acknowledge that you have received a copy of our Notice of Privacy Practices...
                            </p>
                            <div className="pt-4 border-t border-gray-50">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={formData.consentHIPAA || false} onChange={e => setFormData({ ...formData, consentHIPAA: e.target.checked })} className="w-6 h-6 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm font-medium text-gray-700">I Agree to the Privacy Terms</span>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-6">
                        <div className="bg-emerald-600 text-white rounded-3xl p-8 shadow-xl shadow-emerald-100">
                            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                            <h2 className="text-2xl font-bold mb-2">Ready to Submit?</h2>
                            <p className="text-emerald-50 opacity-90">Please review your entries. Once submitted, you cannot make changes without staff assistance.</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-3xl p-6 space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold text-xs uppercase">Patient</span>
                                <span className="font-bold">{formData.firstName} {formData.lastName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold text-xs uppercase">Insurance</span>
                                <span className="font-bold">{formData.insuranceProvider || 'Not Provided'}</span>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="bg-white px-6 py-5 border-b border-gray-100 sticky top-0 z-20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Heart className="w-4 h-4 text-white fill-current" />
                    </div>
                    <span className="font-black text-gray-900 tracking-tight">Paperwork</span>
                </div>
                <div className="px-3 py-1 bg-gray-50 text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Step {step + 1} of {STEPS.length}
                </div>
            </div>

            <div className="h-1.5 w-full bg-gray-100 overflow-hidden">
                <div
                    className="h-full bg-blue-600 transition-all duration-700 ease-out"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
            </div>

            <div className="max-w-md mx-auto p-6 space-y-8 mt-4">
                {session?.status === 'NEEDS_EDITS' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4">
                        <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                        <div className="text-sm">
                            <span className="font-bold text-amber-900 block mb-1">Staff Feedback</span>
                            <span className="text-amber-700">{session.reviewNotes?.[session.reviewNotes.length - 1]?.note}</span>
                        </div>
                    </div>
                )}

                {(() => {
                    const StepIcon = STEPS[step].icon;
                    return (
                        <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <StepIcon className="w-8 h-8 text-blue-600" />
                            {STEPS[step].title}
                        </h2>
                    );
                })()}

                {renderStep()}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent flex gap-4 max-w-md mx-auto pointer-events-none">
                {step > 0 ? (
                    <button onClick={back} className="flex-1 py-5 bg-white border-2 border-gray-100 text-gray-700 rounded-3xl font-black active:scale-95 transition-all shadow-lg pointer-events-auto">
                        Back
                    </button>
                ) : (
                    <div className="flex-1"></div>
                )}

                {step < STEPS.length - 1 ? (
                    <button onClick={next} className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-blue-100 pointer-events-auto">
                        Next
                    </button>
                ) : (
                    <button
                        onClick={() => onSubmit({ signed: true, timestamp: new Date() })}
                        disabled={submitting}
                        className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black active:scale-95 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 pointer-events-auto"
                    >
                        {submitting ? 'Submitting...' : 'Submit Now'}
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
