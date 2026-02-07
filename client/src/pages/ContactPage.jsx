import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Mail,
    Phone,
    MapPin,
    Send,
    Clock,
    MessageSquare,
    CheckCircle,
    Loader2,
    ArrowRight,
    Zap,
    Shield,
    Activity,
    ChevronRight
} from 'lucide-react';
import LandingNav from '../components/LandingNav';

const ContactPage = () => {
    const currentYear = new Date().getFullYear();
    const [searchParams] = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        practice: '',
        providers: '',
        message: '',
        interest: 'demo',
        referral_code: '',
        referral_token: ''
    });

    // Pre-fill from URL params
    useEffect(() => {
        const plan = searchParams.get('plan');
        const interest = searchParams.get('interest');
        const ref = searchParams.get('ref') || localStorage.getItem('pagemd_referral');
        const token = searchParams.get('token') || localStorage.getItem('pagemd_referral_token');

        const populateForm = async () => {
            let fetchedData = {};
            if (token) {
                try {
                    const baseUrl = import.meta.env.VITE_API_URL || '/api';
                    const res = await fetch(`${baseUrl}/growth/verify-token/${token}`);
                    const data = await res.json();
                    if (data.valid) {
                        fetchedData = {
                            name: data.name || '',
                            email: data.email || '',
                            referral_token: token
                        };
                    }
                } catch (e) {
                    console.error('Failed to fetch referral info', e);
                }
            }

            setFormData(prev => ({
                ...prev,
                interest: interest || prev.interest,
                referral_code: ref || prev.referral_code,
                referral_token: token || prev.referral_token,
                message: plan ? `I'm interested in the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.` : prev.message,
                ...fetchedData
            }));
        };

        populateForm();

        document.title = "Contact Us | Request Access | PageMD";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "Get in touch with the PageMD team. Schedule a demo or request sandbox access to experience intuitive intelligence designed by physicians.");
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const response = await fetch(`${baseUrl}/sales/inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    source: 'contact_page'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit inquiry');
            }

            setSubmitted(true);
        } catch (err) {
            console.error('Submit error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            {/* Premium Hero */}
            <section className="relative pt-32 pb-16 lg:pt-48 lg:pb-24 px-6 bg-white overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-8 border border-sky-100/40">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Direct Access
                    </div>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                        Let's talk <br />
                        <span className="text-sky-500">intelligence.</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed">
                        Ready to see how PageMD fits your clinic? Our team is standing by to assist.
                    </p>
                </div>
            </section>

            {/* Contact Form & Cards */}
            <section className="py-24 lg:py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-12 gap-16 items-start">

                        {/* Information Side */}
                        <div className="lg:col-span-5 space-y-10">
                            <div>
                                <h2 className="text-2xl font-semibold text-slate-800 mb-8 tracking-tight">A direct line.</h2>
                                <div className="space-y-4">
                                    <div className="flex gap-5 items-center p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-lg transition-all">
                                        <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center shrink-0 border border-sky-100/40">
                                            <Mail className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Email Team</p>
                                            <a href="mailto:hello@pagemdemr.com" className="text-base font-semibold text-slate-800 hover:text-sky-500 transition-colors tracking-tight">hello@pagemdemr.com</a>
                                        </div>
                                    </div>

                                    <div className="flex gap-5 items-center p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-lg transition-all">
                                        <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 border border-slate-100/40">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Response Time</p>
                                            <p className="text-base font-semibold text-slate-800 uppercase tracking-tight">Direct inquiry line</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400 rounded-full blur-[70px] opacity-10 pointer-events-none"></div>
                                <h3 className="text-xl font-semibold mb-8 relative z-10 transition-colors text-sky-400 uppercase text-[10px] tracking-widest">Why PageMD?</h3>
                                <ul className="space-y-8 relative z-10">
                                    {[
                                        { title: "Zero Lock-in", desc: "Month-to-month clinic freedom." },
                                        { title: "HIPAA Elite", desc: "Beyond compliance, absolute privacy." },
                                        { title: "Physician-Led", desc: "Designed for the exam room flow." }
                                    ].map((item, i) => (
                                        <li key={i} className="flex gap-4 items-start">
                                            <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle className="w-3 h-3 text-sky-400" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-base text-white mb-0.5 tracking-tight">{item.title}</p>
                                                <p className="text-slate-400 font-normal text-sm leading-relaxed">{item.desc}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Form Side */}
                        <div className="lg:col-span-7 bg-white p-10 lg:p-16 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                            {submitted ? (
                                <div className="text-center py-20">
                                    <div className="w-24 h-24 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mx-auto mb-8">
                                        <CheckCircle className="w-12 h-12" />
                                    </div>
                                    <h2 className="text-3xl font-semibold text-slate-800 mb-4 tracking-tight">Message sent.</h2>
                                    <p className="text-slate-500 font-normal mb-10">Our clinical solutions team will reach out shortly.</p>
                                    <button
                                        onClick={() => setSubmitted(false)}
                                        className="text-sky-500 font-semibold text-sm uppercase tracking-widest hover:text-slate-900 transition-colors"
                                    >
                                        Submit another inquiry
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <input
                                                type="text" required value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-sky-500/30 focus:ring-4 focus:ring-sky-500/5 transition-all outline-none text-slate-800 font-medium placeholder:text-slate-300"
                                                placeholder="Dr. Jane Smith"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                                            <input
                                                type="email" required value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-sky-500/30 focus:ring-4 focus:ring-sky-500/5 transition-all outline-none text-slate-800 font-medium placeholder:text-slate-300"
                                                placeholder="jane@practice.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Clinic Name</label>
                                            <input
                                                type="text" value={formData.practice}
                                                onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-sky-500/30 focus:ring-4 focus:ring-sky-500/5 transition-all outline-none text-slate-800 font-medium placeholder:text-slate-300"
                                                placeholder="Elite Clinical Medicine"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Interest</label>
                                            <select
                                                value={formData.interest}
                                                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-sky-500/30 focus:ring-4 focus:ring-sky-500/5 transition-all outline-none text-slate-800 font-medium appearance-none cursor-pointer"
                                            >
                                                <option value="demo">Scheduling a Demo</option>
                                                <option value="sandbox">Sandbox Access</option>
                                                <option value="pricing">Pricing Information</option>
                                                <option value="other">Other Inquiry</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
                                        <textarea
                                            rows={4} value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-sky-500/30 focus:ring-4 focus:ring-sky-500/5 transition-all outline-none text-slate-800 font-medium resize-none text-[15px] placeholder:text-slate-300"
                                            placeholder="Tell us about your clinic flow..."
                                        />
                                    </div>

                                    {error && (
                                        <div className="px-6 py-4 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold border border-red-100">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit" disabled={isSubmitting}
                                        className="w-full py-5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-white font-semibold uppercase tracking-widest rounded-2xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3 text-xs"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing
                                            </>
                                        ) : (
                                            <>
                                                Send Message
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 font-black text-[10px] uppercase tracking-[0.4em] text-slate-400">
                    <Link to="/" className="flex items-center gap-3 grayscale opacity-40 hover:opacity-100 transition-opacity">
                        <img src="/logo.png" alt="PageMD" className="h-10" />
                    </Link>
                    <div className="flex flex-col items-center md:items-end gap-2">
                        <div className="flex gap-12">
                            <Link to="/privacy" className="hover:text-sky-500 transition-colors">Privacy</Link>
                            <Link to="/terms" className="hover:text-sky-500 transition-colors">Terms</Link>
                            <Link to="/security" className="hover:text-sky-500 transition-colors">Security</Link>
                        </div>
                        <div className="text-slate-200 mt-4">© {currentYear} PageMD Inc. All rights reserved.</div>
                        <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-widest mt-1">Made by a Physician, for Physicians</div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ContactPage;
