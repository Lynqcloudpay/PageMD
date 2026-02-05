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
    Loader2
} from 'lucide-react';

const LeadCaptureModal = ({ isOpen, onClose, onLaunch }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        practice: '',
        specialty: '',
        email: '',
        phone: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const referralCode = localStorage.getItem('pagemd_referral');

            // 1. Submit Lead to Sales Admin
            await fetch(`${baseUrl}/sales/inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    practice: formData.practice,
                    providers: '', // Default for now
                    interest: 'sandbox',
                    source: 'Sandbox_Demo',
                    message: `Automated lead from Sandbox Demo Gate${formData.specialty ? ` | Specialty: ${formData.specialty}` : ''}`,
                    referral_code: referralCode
                })
            });

            // 2. Set Cookie (recognized for 30 days)
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);
            document.cookie = `pagemd_demo_captured=true; expires=${expiry.toUTCString()}; path=/`;

            // 3. Launch the Demo
            onLaunch();
        } catch (error) {
            console.error('Lead capture error:', error);
            // Even if lead capture fails locally, we want the user to see the demo 
            // but we'll try to launch it anyway to avoid friction.
            onLaunch();
        } finally {
            setIsSubmitting(false);
        }
    };

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
                            Instant Access
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">
                            Experience PageMD <span className="text-blue-600">Instantly</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            Enter your details to launch your private, pre-populated sandbox environment.
                            Zero wait time.
                        </p>
                    </div>

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
                            <Phone className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
                                    Launch Sandbox Demo
                                    <Zap className="w-5 h-5 fill-current" />
                                </>
                            )}
                        </button>

                        <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold mt-6 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Instant HIPAA Compliant Session
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LeadCaptureModal;
