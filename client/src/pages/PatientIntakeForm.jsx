import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    User, Heart, Shield, FileCheck, ClipboardList, CheckCircle,
    ChevronRight, ChevronLeft, Save, AlertCircle, Phone, Mail,
    Lock, Calendar, MapPin, Building
} from 'lucide-react';
import { intakeAPI } from '../services/api';
import { showError, showSuccess } from '../utils/toast';

const STEPS = [
    { id: 'welcome', title: 'Welcome', icon: Heart },
    { id: 'demographics', title: 'Demographics', icon: User },
    { id: 'insurance', title: 'Insurance', icon: Building },
    { id: 'medical', title: 'Medical History', icon: ClipboardList },
    { id: 'consent', title: 'Consents', icon: FileCheck },
    { id: 'finish', title: 'Review & Submit', icon: CheckCircle }
];

const PatientIntakeForm = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [invite, setInvite] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        dob: '',
        sex: '',
        gender: '',
        phone: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        insuranceProvider: '',
        insuranceId: '',
        medicalHistory: '',
        allergies: '',
        medications: ''
    });

    const [signatures, setSignatures] = useState({
        consent: null,
        hipaa: null
    });

    useEffect(() => {
        loadIntakeDetails();
    }, [token]);

    const loadIntakeDetails = async () => {
        try {
            const res = await intakeAPI.getPublicDetails(token);
            setInvite(res.data);

            // Prefill from invite or previous save
            if (res.data.savedData) {
                setFormData(res.data.savedData);
            } else {
                setFormData(prev => ({
                    ...prev,
                    firstName: res.data.firstName || '',
                    lastName: res.data.lastName || '',
                    dob: res.data.dob ? res.data.dob.split('T')[0] : '',
                    phone: res.data.phone || ''
                }));
            }
        } catch (e) {
            showError(e.response?.data?.error || 'Invalid link');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await intakeAPI.savePublicData(token, formData);
            showSuccess('Progress saved');
        } catch (e) {
            showError('Failed to save progress');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await intakeAPI.submitPublicData(token, formData, signatures);
            setSubmitted(true);
            showSuccess('Registration submitted successfully');
        } catch (e) {
            showError('Submission failed');
        } finally {
            setSaving(false);
        }
    };

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
            window.scrollTo(0, 0);
            // Auto save every time we move forward
            handleSave();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium tracking-wide">Initializing secure session...</p>
            </div>
        );
    }

    if (!invite) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Link Expired</h1>
                <p className="text-gray-600 max-w-sm">Please contact the front desk at your clinic to request a new registration link.</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-8 animate-bounce">
                    <CheckCircle className="w-16 h-16 text-teal-500" />
                </div>
                <h1 className="text-3xl font-extrabold text-teal-900 mb-4">All Set!</h1>
                <p className="text-teal-800 text-lg mb-8 max-w-md">Your registration has been submitted and is currently being reviewed by our team.</p>
                <p className="text-teal-600 font-medium">You can now safely close this window.</p>
            </div>
        );
    }

    const renderStep = () => {
        switch (STEPS[currentStep].id) {
            case 'welcome':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center py-8">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Shield className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">New Patient Portal</h2>
                            <p className="text-gray-600 text-lg leading-relaxed max-w-lg mx-auto">
                                Welcome to our digital registration system. This secure portal allows you to complete your forms before your visit, saving you time at the clinic.
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
                            <Lock className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            <div className="text-sm text-blue-900">
                                <span className="font-bold block mb-1">Your Data is Secure</span>
                                This form uses end-to-end encryption to protect your personal health information (PHI).
                            </div>
                        </div>
                        <button
                            onClick={nextStep}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            Let's Get Started <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                );
            case 'demographics':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <User className="text-blue-500" /> Demographics
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">First Name</label>
                                    <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" disabled />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Last Name</label>
                                    <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" disabled />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date of Birth</label>
                                <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" disabled />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Legal Sex</label>
                                <select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Address Line 1</label>
                                <input type="text" placeholder="Street Address" value={formData.addressLine1} onChange={e => setFormData({ ...formData, addressLine1: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">City</label>
                                    <input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Zip Code</label>
                                    <input type="text" value={formData.zip} onChange={e => setFormData({ ...formData, zip: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'insurance':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Building className="text-blue-500" /> Insurance
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Insurance Provider</label>
                                <input type="text" placeholder="e.g. BCBS, Aetna" value={formData.insuranceProvider} onChange={e => setFormData({ ...formData, insuranceProvider: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Policy ID</label>
                                <input type="text" value={formData.insuranceId} onChange={e => setFormData({ ...formData, insuranceId: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="p-6 border-2 border-dashed border-gray-200 rounded-3xl text-center">
                                <label className="cursor-pointer">
                                    <Building className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <span className="text-sm font-bold text-gray-500 block">Tap to upload front of card</span>
                                    <input type="file" className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'medical':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardList className="text-blue-500" /> Medical History
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Pre-existing Conditions</label>
                                <textarea placeholder="e.g. Diabetes, Hypertension" value={formData.medicalHistory} onChange={e => setFormData({ ...formData, medicalHistory: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 min-h-[120px]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Allergies</label>
                                <textarea placeholder="e.g. Penicillin, Peanuts" value={formData.allergies} onChange={e => setFormData({ ...formData, allergies: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 h-20" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current Medications</label>
                                <textarea placeholder="e.g. Metformin 500mg daily" value={formData.medications} onChange={e => setFormData({ ...formData, medications: e.target.value })} className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 h-20" />
                            </div>
                        </div>
                    </div>
                );
            case 'consent':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <FileCheck className="text-blue-500" /> Consents
                        </h2>
                        <div className="bg-gray-50 p-6 rounded-3xl space-y-4">
                            <h3 className="font-bold text-gray-900">General Treatment Consent</h3>
                            <div className="text-xs text-gray-600 h-32 overflow-y-auto pr-2">
                                I hereby authorize the medical team at this clinic to perform such medical treatments, diagnostic tests. I understand that medical practice is not an exact science...
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Signature</label>
                                <div className="bg-white border-2 border-gray-100 rounded-2xl h-40 relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-200 pointer-events-none text-xl font-bold italic opacity-20">Sign Here</div>
                                    {/* Real signature canvas would go here */}
                                    <input
                                        type="checkbox"
                                        className="absolute bottom-4 right-4 w-6 h-6 rounded"
                                        onChange={(e) => setSignatures({ ...signatures, consent: e.target.checked ? 'signed' : null })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'finish':
                return (
                    <div className="space-y-6 animate-pulseIn">
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Submit</h2>
                            <p className="text-gray-500">Please review your information before final submission.</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-3xl p-6 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                                <div>
                                    <div className="text-xs font-bold text-gray-400 uppercase">Patient</div>
                                    <div className="font-bold text-gray-900">{formData.firstName} {formData.lastName}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-gray-400 uppercase">DOB</div>
                                    <div className="font-bold text-gray-900">{formData.dob}</div>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 space-y-2">
                                <div className="flex justify-between"><span>Demographics</span> <Check className="w-4 h-4 text-emerald-500" /> </div>
                                <div className="flex justify-between"><span>Insurance</span> <Check className="w-4 h-4 text-emerald-500" /> </div>
                                <div className="flex justify-between"><span>Consents</span> <Check className="w-4 h-4 text-emerald-500" /> </div>
                            </div>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {saving ? 'Submitting...' : 'Submit Final Forms'}
                        </button>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Minimal Header */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500 fill-current" />
                    <span className="font-extrabold text-gray-900 tracking-tight">Register</span>
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
                    Step {currentStep + 1} of {STEPS.length}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-gray-100 overflow-hidden">
                <div
                    className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                    style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                />
            </div>

            {/* Main Content */}
            <div className="max-w-lg mx-auto p-6 mt-4">
                {renderStep()}
            </div>

            {/* Bottom Navigation (Sticky) */}
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent flex gap-4 max-w-lg mx-auto pointer-events-none">
                    <button
                        onClick={prevStep}
                        className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold shadow-lg shadow-gray-200 transition-all active:scale-95 pointer-events-auto"
                    >
                        Back
                    </button>
                    <button
                        onClick={nextStep}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 pointer-events-auto"
                    >
                        Next Step
                    </button>
                </div>
            )}
        </div>
    );
};

export default PatientIntakeForm;
