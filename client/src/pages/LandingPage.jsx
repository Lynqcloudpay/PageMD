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

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            <LandingNav />

            {/* Hero Section - Professional Light Mode */}
            <section className="relative pt-24 pb-16 lg:pt-36 lg:pb-28 bg-white overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#EEF2FF,transparent)] pointer-events-none"></div>

                <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold tracking-widest uppercase mb-8 border border-blue-100">
                        <Stethoscope className="w-3.5 h-3.5" />
                        Designed by a Cardiologist for Independent Practices
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-[0.95] mb-6 tracking-tight">
                        Practice Medicine, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Not Documentation.</span>
                    </h1>

                    <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-10 max-w-2xl mx-auto">
                        The physician-centric clinical operating system. Built for speed, precision, and reclaimed time.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:scale-95 text-sm flex items-center justify-center gap-2">
                            Start Your Free Demo
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link to="/features" className="px-8 py-4 bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold rounded-2xl border border-slate-200 transition-all text-sm text-center">
                            Explore Features
                        </Link>
                    </div>

                    <div className="mt-14 flex flex-col items-center">
                        <div className="flex items-center gap-1 text-amber-400 mb-3">
                            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                        </div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">Trusted by Physicians Nationwide</p>
                    </div>
                </div>
            </section>

            {/* Problem/Solution Section */}
            <section className="py-16 lg:py-24 bg-slate-50 border-y border-slate-200/60 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">The Modern EMR Is Broken. <br /><span className="text-blue-600">We Fixed It.</span></h2>
                            <p className="text-base text-slate-600 mb-8 leading-relaxed">
                                Most systems were built for billing compliance, not clinical excellence. At PageMD, we prioritize the physician's cognitive flow over administrative checklists.
                            </p>

                            <div className="space-y-5">
                                {[
                                    { text: "Chart as fast as you think with clinical-logic shortcuts.", icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
                                    { text: "Finish charting before the patient leaves the exam room.", icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
                                    { text: "Reclaim up to 10 hours a week of administrative time.", icon: Heart, color: "text-rose-500", bg: "bg-rose-50" }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 items-start group">
                                        <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0 border border-current/10 transition-transform group-hover:scale-105`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed pt-2">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute -inset-4 bg-blue-600/5 blur-3xl rounded-full"></div>
                            <div className="relative space-y-5">
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-lg">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100">
                                            <X className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legacy Systems</span>
                                    </div>
                                    <h4 className="text-base font-medium text-slate-900 mb-2 italic">"Too many menus, slow loading, and constant friction."</h4>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-3/4 h-full bg-rose-300"></div>
                                    </div>
                                    <div className="mt-1.5 text-[9px] font-bold text-rose-400 uppercase tracking-wider text-right">Burnout Risk: High</div>
                                </div>

                                <div className="p-6 bg-blue-600 rounded-2xl border border-blue-500 shadow-xl transform lg:translate-x-8">
                                    <div className="flex items-center gap-3 mb-4 text-white/70">
                                        <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider">PageMD Advantage</span>
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-3 leading-snug">"It feels like the software knows exactly what I need to do next."</h4>
                                    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-emerald-400"></div>
                                    </div>
                                    <div className="mt-1.5 text-[9px] font-bold text-emerald-300 uppercase tracking-wider text-right">Clinical Flow: Optimal</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Showcase */}
            <section className="py-20 bg-white px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Everything You Need.</h2>
                        <p className="text-base text-slate-500 max-w-xl mx-auto">A complete practice management solution that actually feels like modern software.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { title: "Smart Charting", desc: "Templates that mirror your clinical thought patterns.", icon: FileText, color: "blue" },
                            { title: "Secure E-RX", desc: "Integrated prescribing with one-click renewals.", icon: Activity, color: "emerald" },
                            { title: "Flow Scheduling", desc: "Patient management designed for modern front offices.", icon: Clock, color: "indigo" },
                            { title: "Revenue Cycle", desc: "Automated superbills and rapid-claim scrubbing.", icon: DollarSign, color: "orange" }
                        ].map((item, i) => (
                            <div key={i} className="group flex flex-col items-center text-center p-6 rounded-2xl transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100">
                                <div className={`w-14 h-14 rounded-xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center mb-5 border border-${item.color}-100 transition-transform group-hover:scale-105`}>
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed mb-4">{item.desc}</p>
                                <Link to="/features" className="mt-auto text-blue-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all">
                                    Explore <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-40 bg-slate-50 px-6 border-t border-slate-200/50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-5xl md:text-[6rem] font-black text-slate-900 mb-12 leading-[1] tracking-tighter">Ready to reclaim your day?</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-8">
                        <Link to="/contact" className="px-16 py-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[3rem] shadow-2xl shadow-blue-500/20 transition-all hover:-translate-y-1 text-2xl">
                            Schedule Private Demo
                        </Link>
                        <Link to="/pricing" className="px-16 py-8 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-[3rem] border-2 border-slate-200 transition-all text-2xl text-center">
                            View Pricing
                        </Link>
                    </div>

                    <div className="mt-24 flex justify-center items-center gap-12 opacity-40">
                        <div className="flex items-center gap-3 text-slate-900 text-xs font-black uppercase tracking-widest">
                            <Shield className="w-5 h-5" /> HIPAA COMPLIANT
                        </div>
                        <div className="w-px h-8 bg-slate-300"></div>
                        <div className="flex items-center gap-3 text-slate-900 text-xs font-black uppercase tracking-widest">
                            <Zap className="w-5 h-5" /> ISO CERTIFIED
                        </div>
                    </div>
                </div>
            </section>

            <footer className="py-16 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-slate-400">
                    <img src="/logo.png" alt="PageMD" className="h-10 grayscale opacity-50 contrast-125" />
                    <div className="flex gap-12 font-bold text-sm uppercase tracking-widest">
                        <Link to="/privacy" className="hover:text-blue-600">Privacy</Link>
                        <Link to="/terms" className="hover:text-blue-600">Terms</Link>
                        <Link to="/security" className="hover:text-blue-600">Security</Link>
                    </div>
                    <div className="font-bold text-xs uppercase tracking-widest">© {currentYear} PageMD Inc.</div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
