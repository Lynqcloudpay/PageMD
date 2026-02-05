import React, { useState, useEffect } from 'react';
import {
    X,
    User,
    Building2,
    Stethoscope,
    Mail,
    Phone,
    Zap,
    CheckCircle2,
    Loader2,
    MailCheck,
    AlertCircle
} from 'lucide-react';

// reCAPTCHA site key from environment
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const LeadCaptureModal = ({ isOpen, onClose, onLaunch }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitState, setSubmitState] = useState('form'); // 'form' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        practice: '',
        specialty: '',
        email: '',
        phone: ''
    });

    // Load reCAPTCHA v3 script
    useEffect(() => {
        if (!RECAPTCHA_SITE_KEY) return;

        // Check if already loaded
        if (document.querySelector(`script[src*="recaptcha"]`)) return;

        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        document.head.appendChild(script);

        return () => {
            // Cleanup badge on unmount (optional)
        };
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const referralCode = localStorage.getItem('pagemd_referral');

            // Execute reCAPTCHA v3 if available
            let recaptchaToken = null;
            if (RECAPTCHA_SITE_KEY && window.grecaptcha) {
                try {
                    recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'demo_signup' });
                } catch (recaptchaError) {
                    console.warn('reCAPTCHA execution failed:', recaptchaError);
                }
            }

            // Submit Lead to Sales Admin
            const leadRes = await fetch(`${baseUrl}/sales/inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    practice: formData.practice,
                    providers: '',
                    interest: 'sandbox',
                    source: 'Sandbox_Demo',
                    message: `Automated lead from Sandbox Demo Gate${formData.specialty ? ` | Specialty: ${formData.specialty}` : ''}`,
                    referral_code: referralCode,
                    recaptchaToken
                })
            });

            const data = await leadRes.json();

            if (!leadRes.ok) {
                // Handle specific error codes
                if (data.code === 'DISPOSABLE_EMAIL') {
                    setErrorMessage('Please use a valid work email address (not a temporary email).');
                } else if (data.code === 'BOT_DETECTED') {
                    setErrorMessage('Security verification failed. Please try again.');
                } else {
                    setErrorMessage(data.error || 'Something went wrong. Please try again.');
                }
                setSubmitState('error');
                return;
            }

            // Set Cookie (recognized for 30 days)
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);
            document.cookie = `pagemd_demo_captured=true; expires=${expiry.toUTCString()}; path=/`;

            // Show success state - user needs to check email
            if (data.requiresVerification) {
                setSubmitState('success');
            } else {
                // Legacy flow - direct launch
                onLaunch();
            }
        } catch (error) {
            console.error('Lead capture error:', error);
            setErrorMessage('Network error. Please check your connection and try again.');
            setSubmitState('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Success State - Check Your Email
    if (submitState === 'success') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto pt-10 pb-10">
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" />
                <div className="relative w-full max-w-xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden transform transition-all">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8 md:p-12 text-center">
                        {/* Success Animation */}
                        <div className="mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6 animate-pulse">
                                <MailCheck className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">
                                Check Your Email!
                            </h2>
                            <p className="text-slate-500 text-base font-medium leading-relaxed mb-2">
                                We've sent a magic link to <span className="text-blue-600 font-bold">{formData.email}</span>
                            </p>
                            <p className="text-slate-400 text-sm">
                                Click the link in the email to launch your personalized demo.
                            </p>
                        </div>

                        {/* Timer Notice */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                            <p className="text-amber-700 text-sm font-medium flex items-center justify-center gap-2">
                                <span className="text-lg">⏱️</span>
                                Link expires in 45 minutes
                            </p>
                        </div>

                        {/* Tips */}
                        <div className="text-left bg-slate-50 rounded-2xl p-5">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Didn't get the email?</p>
                            <ul className="text-sm text-slate-600 space-y-2">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    Check your spam or promotions folder
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    Make sure you entered the correct email
                                </li>
                            </ul>
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-6 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                        >
                            Close this window
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Form State
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto pt-10 pb-10">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden transform transition-all">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="mb-10 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 border border-emerald-100">
                            <Zap className="w-3 h-3 fill-current" />
                            Secure Access
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">
                            Experience PageMD <span className="text-blue-600">Now</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            Enter your details to receive a magic link to your private sandbox.
                        </p>
                    </div>

                    {/* Error Message */}
                    {submitState === 'error' && errorMessage && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="relative group">
                                <User className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Full Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                                />
                            </div>
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Practice Name"
                                    value={formData.practice}
                                    onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                                />
                            </div>
                        </div>

                        <div className="relative group">
                            <Stethoscope className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Specialty (Optional)"
                                value={formData.specialty}
                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>

                        <div className="relative group">
                            <Mail className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                required
                                type="email"
                                placeholder="Work Email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>

                        <div className="relative group">
                            <Phone className="absolute left-4 top-4 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                required
                                type="tel"
                                placeholder="Phone Number"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 text-lg mt-4"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    Send Me the Magic Link
                                    <Mail className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold mt-6 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Secure • HIPAA Compliant
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LeadCaptureModal;
