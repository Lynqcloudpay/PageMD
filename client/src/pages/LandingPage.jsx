import React from 'react';
import { Link } from 'react-router-dom';
import {
    Stethoscope,
    ArrowRight,
    Star,
    Activity,
    FileText,
    ChevronRight,
    DollarSign,
    Clock,
    Users,
    Shield,
    X,
    CheckCircle2,
    Heart,
    Zap
} from 'lucide-react';
import LandingNav from '../components/LandingNav';
import tokenManager from '../services/tokenManager';
import LeadCaptureModal from '../components/LeadCaptureModal';
import ConciergeOverlay from '../components/ConciergeOverlay';

const LandingPage = () => {
    React.useEffect(() => {
        document.title = "PageMD | Medicine, intuitively designed.";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "An EMR that anticipates your next step. Built by physicians, for physicians. Experience Intuitive Intelligence with PageMD.");
    }, []);
    const currentYear = new Date().getFullYear();
    const [loading, setLoading] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isConciergeOpen, setIsConciergeOpen] = React.useState(false);
    const [leadName, setLeadName] = React.useState('');
    const [referralData, setReferralData] = React.useState(null);

    // Check for referral token/code on mount
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const ref = params.get('ref');

        // Store static referral code if present
        if (ref) {
            localStorage.setItem('pagemd_referral', ref);
            console.log('Stored static referral code:', ref);
        }

        if (token) {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            fetch(`${baseUrl}/growth/verify-token/${token}`)
                .then(res => res.json())
                .then(data => {
                    if (data.valid) {
                        console.log('Referral verified:', data);
                        setReferralData({
                            name: data.name || '',
                            email: data.email || '',
                            token: token, // Keep token for submission
                            referrerName: data.referrerName
                        });
                        localStorage.setItem('pagemd_referral_token', token);
                    }
                })
                .catch(err => console.error('Token check failed', err));
        }
    }, []);

    const getLeadCookie = (name) => {
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name + "=") === 0) {
                return c.substring(name.length + 1, c.length);
            }
        }
        return '';
    };

    const hasCapturedLead = () => {
        return !!getLeadCookie('pagemd_lead_id');
    };

    React.useEffect(() => {
        const id = getLeadCookie('pagemd_lead_id');
        const name = getLeadCookie('pagemd_lead_name');
        if (id) {
            setLeadName(decodeURIComponent(name || ''));
            // Ping the backend to log the returning visit
            const pingVisit = async () => {
                try {
                    const baseUrl = import.meta.env.VITE_API_URL || '/api';
                    await fetch(`${baseUrl}/sales/track-visit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uuid: id })
                    });
                } catch (e) { console.error('Ping failed', e); }
            };
            pingVisit();
        }
    }, []);

    const handleInstantDemoTrigger = () => {
        if (hasCapturedLead()) {
            setIsConciergeOpen(true);
        } else {
            setIsModalOpen(true);
        }
    };

    const handleInstantDemo = async (inquiryMessage = '') => {
        if (loading) return; // Prevent multiple clicks
        setLoading(true);
        setIsModalOpen(false);
        setIsConciergeOpen(false);

        // If there's an inquiry message and we have a lead ID, log it as a unified visit
        const leadId = getLeadCookie('pagemd_lead_id');
        if (inquiryMessage && leadId) {
            try {
                const baseUrl = import.meta.env.VITE_API_URL || '/api';
                await fetch(`${baseUrl}/sales/track-visit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: leadId,
                        message: inquiryMessage
                    })
                });
            } catch (e) {
                console.error('Failed to log visit with message', e);
            }
        }

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const res = await fetch(`${baseUrl}/auth/sandbox/provision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: getLeadCookie('pagemd_lead_id') })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server responded with ${res.status}: ${errorText.substring(0, 100)}`);
            }

            const data = await res.json();
            if (data.token) {
                tokenManager.setToken(data.token);
                localStorage.removeItem('clinic_slug');
                window.location.href = data.redirect;
            } else {
                throw new Error('Demo provisioning failed - no token received.');
            }
        } catch (error) {
            console.error('Sandbox error:', error);
            alert(`Demo Launch Failed: ${error.message || 'Please check your connection.'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            <LandingNav onGetDemo={handleInstantDemoTrigger} />

            {/* Hero Section - Premium Light Mode */}
            <section className="relative pt-24 pb-16 lg:pt-40 lg:pb-32 bg-white overflow-hidden">
                {/* Modern subtle background element */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50/50 rounded-full blur-[140px] opacity-60 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-blue-50/30 rounded-full blur-[120px] opacity-40 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-8 border border-sky-100/40">
                        <Stethoscope className="w-3 h-3" />
                        Designed by Physicians
                    </div>

                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                        Medicine, <br />
                        <span className="text-sky-500">intuitively designed.</span>
                    </h1>

                    <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-10 max-w-xl mx-auto font-normal">
                        An EMR that anticipates your next step. Built by physicians, for physicians.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={handleInstantDemoTrigger}
                            disabled={loading}
                            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 active:scale-95 text-sm flex items-center justify-center gap-2.5 group"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Zap className="w-4 h-4 fill-sky-300 text-sky-300 group-hover:scale-110 transition-transform" />
                            )}
                            {loading ? 'Entering Sandbox...' : 'Try PageMD Now'}
                        </button>
                        <Link to="/contact" className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 text-sm flex items-center justify-center gap-2">
                            Request Access
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="mt-20 flex flex-col items-center">
                        <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-[0.4em] mb-4">Made by a Physician, for Physicians</p>
                        <div className="flex items-center gap-1.5 text-sky-200">
                            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-sky-400 text-sky-400" />)}
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem/Solution Section - Refined Light Mode */}
            <section className="py-24 lg:py-32 bg-slate-50/50 border-y border-slate-100 px-6 overflow-hidden relative">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-semibold text-slate-800 mb-6 leading-tight tracking-tight">
                                Legacy EMRs <br />
                                <span className="text-sky-500">slow you down.</span>
                            </h2>
                            <p className="text-base text-slate-600 mb-8 leading-relaxed font-normal">
                                Most systems were built for billing compliance, not clinical excellence. PageMD prioritizes your cognitive flow, showing you only what you need, when you need it.
                            </p>

                            <div className="space-y-5">
                                {[
                                    { text: "Predictive Logic suggests your next clinical action.", icon: Zap, color: "text-sky-500", bg: "bg-sky-50" },
                                    { text: "Zero-Clutter Interface removes administrative noise.", icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
                                    { text: "Clinical Operating System built for physician speed.", icon: Heart, color: "text-indigo-500", bg: "bg-indigo-50" }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 items-start group">
                                        <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0 border border-current/10 transition-all group-hover:scale-105 shadow-sm`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div className="pt-1">
                                            <p className="text-sm text-slate-800 font-semibold leading-tight mb-0.5">{item.text.split(" suggests ")[0]}{item.text.includes(" suggests ") ? " suggests" : ""}</p>
                                            <p className="text-[13px] text-slate-500 font-normal">Built for the actual speed of thought.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            {/* Decorative elements */}
                            <div className="absolute -inset-10 bg-sky-500/5 blur-3xl rounded-full"></div>
                            <div className="relative space-y-6">
                                <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/40">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100">
                                            <X className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Legacy Systems</span>
                                    </div>
                                    <h4 className="text-lg font-medium text-slate-800 mb-3 italic leading-snug">"Too many menus, slow loading, and constant friction."</h4>
                                    <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                        <div className="w-3/4 h-full bg-slate-200"></div>
                                    </div>
                                </div>

                                <div className="p-8 bg-white rounded-3xl border border-sky-100 shadow-xl shadow-sky-200/30 transform lg:translate-x-8">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center border border-sky-100">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-semibold text-sky-500 uppercase tracking-widest">Intuitive Intelligence</span>
                                    </div>
                                    <h4 className="text-xl font-semibold text-slate-800 mb-3 leading-snug">"It anticipates what I need to do next."</h4>
                                    <div className="w-full h-1.5 bg-sky-50 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-sky-400/60"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* Features Showcase - Premium Grid */}
            <section className="py-24 lg:py-32 bg-white px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-semibold text-slate-800 mb-4 tracking-tight">Everything You Need.</h2>
                        <p className="text-base text-slate-500 max-w-xl mx-auto font-normal">A complete practice management solution that actually feels like modern software.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { title: "Smart Charting", desc: "Templates that mirror your clinical thought patterns.", icon: FileText, color: "sky" },
                            { title: "Secure E-RX", desc: "Integrated prescribing with one-click renewals.", icon: Activity, color: "blue" },
                            { title: "Flow Scheduling", desc: "Patient management designed for modern front offices.", icon: Clock, color: "indigo" },
                            { title: "Revenue Cycle", desc: "Automated superbills and rapid-claim scrubbing.", icon: DollarSign, color: "emerald" }
                        ].map((item, i) => (
                            <div key={i} className="group flex flex-col p-7 rounded-2xl transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100">
                                <div className={`w-11 h-11 rounded-xl bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center mb-6 border border-${item.color}-100/40 transition-all group-hover:scale-105 shadow-sm`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.title}</h3>
                                <p className="text-[13px] text-slate-500 leading-relaxed mb-5 font-normal">{item.desc}</p>
                                <Link to="/features" className="mt-auto text-sky-500 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-2 group-hover:text-sky-600 transition-colors">
                                    Learn More <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA - Statement Piece */}
            <section className="py-32 lg:py-48 bg-slate-50 px-6 border-t border-slate-100 overflow-hidden relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-sky-100/20 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <p className="text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed mb-10">
                        An EMR that anticipates your next step. Built by physicians, for physicians.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 active:scale-95 text-base flex items-center justify-center gap-3 group"
                        >
                            <Zap className="w-5 h-5 fill-sky-300 text-sky-300 group-hover:scale-110 transition-transform" />
                            Request Access
                        </button>
                        <Link to="/features" className="px-10 py-5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 text-base flex items-center justify-center">
                            Explore Features
                        </Link>
                    </div>

                    {/* Refined Social Proof */}
                    <div className="pt-16 border-t border-slate-100 max-w-3xl mx-auto">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-8">Trusted by clinical leaders</p>
                        <div className="flex flex-wrap justify-center items-center gap-10 lg:gap-14 opacity-40 grayscale">
                            <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">1,000+ Physicians</div>
                            <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">HIPAA Secure</div>
                            <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">24/7 Support</div>
                        </div>
                    </div>

                    <div className="mt-32 flex flex-col md:flex-row justify-center items-center gap-8 lg:gap-16 opacity-50 grayscale contrast-150">
                        <div className="flex items-center gap-4 text-slate-900 text-[10px] font-semibold uppercase tracking-[0.3em]">
                            <Shield className="w-5 h-5" /> HIPAA COMPLIANT
                        </div>
                        <div className="hidden md:block w-px h-10 bg-slate-300"></div>
                        <div className="flex items-center gap-4 text-slate-900 text-[10px] font-semibold uppercase tracking-[0.3em]">
                            <Zap className="w-5 h-5" /> FAST & SECURE
                        </div>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12 font-semibold text-[10px] uppercase tracking-[0.4em] text-slate-400">
                        <Link to="/" className="flex items-center gap-3 grayscale opacity-40 hover:opacity-100 transition-opacity">
                            <img src="/logo.png" alt="PageMD" className="h-10" />
                        </Link>

                        <div className="flex flex-col items-center md:items-end gap-2">
                            <div className="flex gap-12">
                                <Link to="/privacy" className="hover:text-sky-500 transition-colors">Privacy</Link>
                                <Link to="/terms" className="hover:text-sky-500 transition-colors">Terms</Link>
                                <Link to="/security" className="hover:text-sky-500 transition-colors">Security</Link>
                            </div>
                            <div className="text-slate-200 mt-4 font-black">© {currentYear} PageMD Inc. All rights reserved.</div>
                            <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-widest mt-1">Made by a Physician, for Physicians</div>
                        </div>
                    </div>
                </div>
            </footer>

            <LeadCaptureModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onLaunch={handleInstantDemo}
                initialData={referralData}
            />
            <ConciergeOverlay
                isOpen={isConciergeOpen}
                onClose={() => setIsConciergeOpen(false)}
                leadName={leadName}
                onLaunch={handleInstantDemo}
                isLaunching={loading}
            />
        </div>
    );
};

export default LandingPage;

