import React, { useState, useEffect, useRef } from 'react';
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
    AlertCircle,
    ArrowRight,
    KeyRound
} from 'lucide-react';
import tokenManager from '../services/tokenManager';

// reCAPTCHA site key from environment
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const LeadCaptureModal = ({ isOpen, onClose, onLaunch, initialData }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitState, setSubmitState] = useState('form'); // 'form' | 'verify' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const [duplicateNotice, setDuplicateNotice] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        practice: '',
        specialty: '',
        email: '',
        phone: '',
        referral_token: ''
    });

    // Verification Code State
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    // Load reCAPTCHA v3 script (run once)
    useEffect(() => {
        if (!RECAPTCHA_SITE_KEY) return;
        if (document.querySelector(`script[src*="recaptcha"]`)) return;

        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        document.head.appendChild(script);
    }, []);

    // Load initial data or saved form data
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                name: initialData.name || prev.name,
                email: initialData.email || prev.email,
                referral_token: initialData.token || prev.referral_token
            }));
        } else {
            const saved = localStorage.getItem('pagemd_lead_info');
            const storedRefCode = localStorage.getItem('pagemd_referral');
            const storedRefToken = localStorage.getItem('pagemd_referral_token');

            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setFormData(prev => ({
                        ...prev,
                        ...parsed,
                        referral_token: storedRefToken || parsed.referral_token || prev.referral_token
                    }));
                } catch (e) { }
            } else if (storedRefToken) {
                setFormData(prev => ({ ...prev, referral_token: storedRefToken }));
            }
        }
    }, [initialData]);

    // Focus first code input when entering verification state
    useEffect(() => {
        if (submitState === 'verify') {
            setTimeout(() => inputRefs[0].current?.focus(), 100);
        }
    }, [submitState]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const referralCode = localStorage.getItem('pagemd_referral');

            // Execute reCAPTCHA v3
            let recaptchaToken = null;
            if (RECAPTCHA_SITE_KEY && window.grecaptcha) {
                try {
                    recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'demo_signup' });
                } catch (recaptchaError) {
                    console.warn('reCAPTCHA execution failed:', recaptchaError);
                }
            }

            const leadRes = await fetch(`${baseUrl}/sales/inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    interest: 'sandbox',
                    source: 'Sandbox_Demo',
                    message: `Automated lead from Sandbox Demo Code Gate${formData.specialty ? ` | Specialty: ${formData.specialty}` : ''}`,
                    referral_code: referralCode,
                    recaptchaToken
                })
            });

            const data = await leadRes.json();

            if (!leadRes.ok) {
                if (data.code === 'DISPOSABLE_EMAIL') {
                    setErrorMessage('Please use a valid work email address.');
                } else if (data.code === 'BOT_DETECTED') {
                    setErrorMessage('Security verification failed. Please try again.');
                } else {
                    setErrorMessage(data.error || 'Something went wrong.');
                }
                setIsSubmitting(false);
                return;
            }

            if (data.requiresVerification) {
                if (data.isDuplicate) {
                    setDuplicateNotice(true);
                }
                setSubmitState('verify');
            } else {
                onLaunch();
            }
        } catch (error) {
            console.error('Lead capture error:', error);
            setErrorMessage('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // Only allow numbers

        const newCode = [...verificationCode];
        newCode[index] = value.slice(-1);
        setVerificationCode(newCode);

        // Move to next input
        if (value && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    };

    const handlePaste = (index, e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const pastedNumbers = pastedData.replace(/\D/g, '').split('').slice(0, 6);

        if (pastedNumbers.length === 0) return;

        const newCode = [...verificationCode];
        pastedNumbers.forEach((num, i) => {
            if (index + i < 6) {
                newCode[index + i] = num;
            }
        });

        setVerificationCode(newCode);

        // Focus the input after the last filled digit
        const nextIndex = Math.min(index + pastedNumbers.length, 5);
        inputRefs[nextIndex].current?.focus();
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        const code = verificationCode.join('');
        if (code.length < 6 || isVerifying) return;

        setIsVerifying(true);
        setErrorMessage('');

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const res = await fetch(`${baseUrl}/sales/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    code: code
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.error || 'Invalid verification code.');
                setIsVerifying(false);
                return;
            }

            // Success! 
            if (res.ok) {
                if (data.token) {
                    tokenManager.setToken(data.token);
                }

                // Save lead info for future convenience, but still force verification
                localStorage.setItem('pagemd_lead_info', JSON.stringify(formData));

                if (!formData.email.includes('test')) {
                    const expiry = new Date();
                    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year persistence

                    document.cookie = `pagemd_demo_captured=true; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;

                    if (data.leadUuid) {
                        document.cookie = `pagemd_lead_id=${data.leadUuid}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
                    }
                    if (data.leadName) {
                        document.cookie = `pagemd_lead_name=${encodeURIComponent(data.leadName)}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
                    }
                }
            }

            setSubmitState('success');
            setTimeout(() => onLaunch(), 2000);

        } catch (error) {
            console.error('Verification error:', error);
            setErrorMessage('Network error. Please try again.');
            setIsVerifying(false);
        }
    };

    // --- RENDER STATES ---

    // Success state
    if (submitState === 'success') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto">
                <div className="fixed inset-0 bg-gray-50/40 backdrop-blur-md" />
                <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-12 text-center overflow-hidden">
                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6 text-emerald-600">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Verified!</h2>
                        <p className="text-gray-500 font-medium">Launching your healthcare sandbox...</p>
                        <div className="mt-8 flex justify-center">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Verification Code Input State
    if (submitState === 'verify') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto pt-10 pb-10">
                <div className="fixed inset-0 bg-gray-50/40 backdrop-blur-md" onClick={onClose} />
                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden transform transition-all p-8 md:p-12">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-50 text-gray-400">
                        <X className="w-5 h-5" />
                    </button>

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6 text-blue-600 rotate-3">
                            <KeyRound className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Verify Email</h2>
                        {duplicateNotice ? (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-4 animate-in fade-in slide-in-from-top-2 duration-700">
                                <p className="text-blue-700 text-xs font-bold leading-relaxed">
                                    <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded mr-2 uppercase tracking-tight">Welcome Back</span>
                                    An account with this info already exists. We've sent a fresh access code to your inbox.
                                </p>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm font-medium">
                                We've sent a 6-digit code to <br />
                                <span className="text-blue-600 font-bold">{formData.email}</span>
                            </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-4 font-bold uppercase tracking-widest bg-gray-50 py-2 px-4 rounded-lg border border-gray-100 italic">
                            Tip: Check your <span className="text-blue-600">Spam or Junk</span> email folder
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-medium animate-shake">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleVerifyCode}>
                        <div className="flex justify-between gap-2 md:gap-4 mb-8">
                            {verificationCode.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={inputRefs[idx]}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                    onPaste={(e) => handlePaste(idx, e)}
                                    className="w-12 h-16 md:w-14 md:h-20 text-center text-2xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                />
                            ))}
                        </div>

                        <button
                            type="submit"
                            disabled={isVerifying || verificationCode.some(d => !d)}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                        >
                            {isVerifying ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Verify & Launch Demo <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>


                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setSubmitState('form')}
                            className="text-gray-400 hover:text-gray-600 text-sm font-semibold transition-colors"
                        >
                            Not your email? Change it
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Initial Form State
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto pt-10 pb-10">
            <div className="fixed inset-0 bg-gray-50/40 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden transform transition-all p-8 md:p-12">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors z-10">
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 border border-emerald-100">
                        <Zap className="w-3 h-3 fill-current" />
                        Secure Access
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                        Experience PageMD <span className="text-blue-600">Now</span>
                    </h2>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed">
                        Enter your professional details to access your private sandbox.
                    </p>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-medium">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="relative group">
                            <User className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                required type="text" placeholder="Full Name" value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>
                        <div className="relative group">
                            <Building2 className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                required type="text" placeholder="Practice Name" value={formData.practice}
                                onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                                className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <Stethoscope className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text" placeholder="Specialty (Optional)" value={formData.specialty}
                            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                        />
                    </div>

                    <div className="relative group">
                        <Mail className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            required type="email" placeholder="Work Email" value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                        />
                    </div>

                    <div className="relative group">
                        <Phone className="absolute left-4 top-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            required type="tel" placeholder="Phone Number" value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                        />
                    </div>

                    <button
                        type="submit" disabled={isSubmitting}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 text-lg mt-4"
                    >
                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Get Started <ArrowRight className="w-5 h-5" /></>}
                    </button>

                    <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold mt-6 flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Secure • HIPAA Compliant
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LeadCaptureModal;
