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
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase mb-10 border border-sky-100/50">
                        <Stethoscope className="w-3.5 h-3.5" />
                        Designed by Physicians
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.9] mb-8 tracking-[-0.04em]">
                        Medicine, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">intuitively designed.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-500 leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
                        An EMR that anticipates your next step. Built by physicians, for physicians.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-5">
                        <button
                            onClick={handleInstantDemoTrigger}
                            disabled={loading}
                            className="px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 active:scale-95 text-base flex items-center justify-center gap-3 group"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Zap className="w-5 h-5 fill-sky-400 text-sky-400 group-hover:scale-110 transition-transform" />
                            )}
                            {loading ? 'Entering Sandbox...' : 'Try PageMD Now'}
                        </button>
                        <Link to="/contact" className="px-10 py-5 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-2xl border border-slate-200 shadow-sm transition-all hover:-translate-y-1 active:scale-95 text-base flex items-center justify-center gap-2">
                            Request Access
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>

                    <div className="mt-20 flex flex-col items-center">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Trusted Across Specialties</p>
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
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 leading-[1] tracking-tight">
                                Legacy EMRs <br />
                                <span className="text-sky-500">slow you down.</span>
                            </h2>
                            <p className="text-lg text-slate-600 mb-10 leading-relaxed font-medium">
                                Most systems were built for billing compliance, not clinical excellence. PageMD prioritizes your cognitive flow, showing you only what you need, when you need it.
                            </p>

                            <div className="space-y-6">
                                {[
                                    { text: "Predictive Logic suggests your next clinical action.", icon: Zap, color: "text-sky-500", bg: "bg-sky-50" },
                                    { text: "Zero-Clutter Interface removes administrative noise.", icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
                                    { text: "Clinical Operating System built for physician speed.", icon: Heart, color: "text-indigo-500", bg: "bg-indigo-50" }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-5 items-start group">
                                        <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center shrink-0 border border-current/10 transition-all group-hover:scale-110 shadow-sm`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <div className="pt-2">
                                            <p className="text-base text-slate-800 font-bold leading-tight mb-1">{item.text.split(" suggests ")[0]}{item.text.includes(" suggests ") ? " suggests" : ""}</p>
                                            <p className="text-sm text-slate-500 font-medium">Built for the actual speed of thought.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            {/* Decorative elements */}
                            <div className="absolute -inset-10 bg-sky-500/5 blur-3xl rounded-full"></div>
                            <div className="relative space-y-6">
                                <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100">
                                            <X className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Legacy Systems</span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 mb-4 italic leading-tight">"Too many menus, slow loading, and constant friction."</h4>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-3/4 h-full bg-slate-300"></div>
                                    </div>
                                    <div className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Burnout Risk: High</div>
                                </div>

                                <div className="p-10 bg-white rounded-[2.5rem] border border-sky-100 shadow-2xl shadow-sky-200/40 transform lg:translate-x-12">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center border border-sky-100">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-sky-500 uppercase tracking-widest">Intuitive Intelligence</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-slate-900 mb-4 leading-tight">"It anticipates what I need to do next."</h4>
                                    <div className="w-full h-2 bg-sky-50 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-sky-400"></div>
                                    </div>
                                    <div className="mt-2 text-[10px] font-black text-sky-500 uppercase tracking-widest text-right">Clinical Excellence: Achieved</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* Features Showcase - Premium Grid */}
            <section className="py-24 lg:py-32 bg-white px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Everything You Need.</h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">A complete practice management solution that actually feels like modern software.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { title: "Smart Charting", desc: "Templates that mirror your clinical thought patterns.", icon: FileText, color: "sky" },
                            { title: "Secure E-RX", desc: "Integrated prescribing with one-click renewals.", icon: Activity, color: "blue" },
                            { title: "Flow Scheduling", desc: "Patient management designed for modern front offices.", icon: Clock, color: "indigo" },
                            { title: "Revenue Cycle", desc: "Automated superbills and rapid-claim scrubbing.", icon: DollarSign, color: "emerald" }
                        ].map((item, i) => (
                            <div key={i} className="group flex flex-col p-8 rounded-[2rem] transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50">
                                <div className={`w-14 h-14 rounded-2xl bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center mb-8 border border-${item.color}-100/50 transition-all group-hover:scale-110 shadow-sm`}>
                                    <item.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">{item.desc}</p>
                                <Link to="/features" className="mt-auto text-sky-500 font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-3 transition-all group-hover:text-slate-900">
                                    Explore Feature <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA - Statement Piece */}
            <section className="py-32 lg:py-48 bg-slate-50 px-6 border-t border-slate-100 overflow-hidden relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-sky-100/20 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed mb-12">
                        An EMR that anticipates your next step. <br className="hidden md:block" />
                        Built by physicians, for physicians.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-6 mb-20">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-12 py-6 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-slate-200 transition-all hover:-translate-y-1 active:scale-95 text-xl flex items-center justify-center gap-4 group"
                        >
                            <Zap className="w-7 h-7 fill-sky-400 text-sky-400 group-hover:scale-110 transition-transform" />
                            Request Access
                        </button>
                        <Link to="/features" className="px-12 py-6 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-2xl border border-slate-200 shadow-sm transition-all hover:-translate-y-1 active:scale-95 text-xl flex items-center justify-center">
                            Explore Features
                        </Link>
                    </div>

                    {/* Refined Social Proof */}
                    <div className="pt-20 border-t border-slate-50 max-w-4xl mx-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">Trusted by clinical leaders</p>
                        <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-20 opacity-50 grayscale contrast-125">
                            <div className="flex items-center gap-2 font-black text-xl italic text-slate-900">1,000+ Physicians</div>
                            <div className="flex items-center gap-2 font-black text-xl italic text-slate-900">HIPAA Secure</div>
                            <div className="flex items-center gap-2 font-black text-xl italic text-slate-900">24/7 Support</div>
                        </div>
                    </div>

                    <div className="mt-32 flex flex-col md:flex-row justify-center items-center gap-8 lg:gap-16 opacity-50 grayscale contrast-150">
                        <div className="flex items-center gap-4 text-slate-900 text-xs font-black uppercase tracking-[0.3em]">
                            <Shield className="w-6 h-6" /> HIPAA COMPLIANT
                        </div>
                        <div className="hidden md:block w-px h-10 bg-slate-300"></div>
                        <div className="flex items-center gap-4 text-slate-900 text-xs font-black uppercase tracking-[0.3em]">
                            <Zap className="w-6 h-6" /> FAST & SECURE
                        </div>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                        <Link to="/" className="flex items-center gap-3 grayscale opacity-40 hover:opacity-100 transition-opacity">
                            <img src="/logo.png" alt="PageMD" className="h-10" />
                        </Link>

                        <div className="flex flex-col items-center md:items-end gap-4">
                            <div className="flex gap-12 font-black text-[10px] uppercase tracking-[0.4em] text-slate-400">
                                <Link to="/privacy" className="hover:text-sky-500 transition-colors">Privacy</Link>
                                <Link to="/terms" className="hover:text-sky-500 transition-colors">Terms</Link>
                                <Link to="/security" className="hover:text-sky-500 transition-colors">Security</Link>
                            </div>
                            <div className="flex gap-4 items-center mt-2 opacity-50 grayscale text-slate-400">
                                <Shield className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase tracking-[0.4em]">HIPAA COMPLIANT</span>
                                <Star className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase tracking-[0.4em]">PHYSICIAN DESIGNED</span>
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mt-4">© {currentYear} PageMD Inc. All rights reserved.</div>
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

