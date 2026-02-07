import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    DollarSign,
    Clock,
    Users,
    HeartPulse,
    Pill,
    ClipboardList,
    FolderOpen,
    ArrowRight,
    Check,
    Zap,
    Activity,
    ChevronRight,
    Eye,
    Star,
    Shield
} from 'lucide-react';
import LandingNav from '../components/LandingNav';

const FeaturesPage = () => {
    const currentYear = new Date().getFullYear();

    React.useEffect(() => {
        document.title = "Features | Smart Workflow & Predictive Logic | PageMD";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "Explore PageMD's Smart Workflow and Predictive Logic. Designed by physicians to eliminate legacy clutter and anticipate your clinical needs.");
    }, []);

    const featureSections = [
        {
            category: "Clinical Excellence",
            items: [
                {
                    icon: FileText,
                    title: 'Intelligent Charting',
                    description: 'Documentation that mirrors your clinical thought patterns, not just data entry.',
                    details: ['Specialty-agnostic flow', 'ICD-10 Smart Search', 'One-click Note Signing'],
                    accent: "sky"
                },
                {
                    icon: Pill,
                    title: 'Precision Prescribing',
                    description: 'Integrated e-Rx with real-time pharmacy sync and refill intelligence.',
                    details: ['One-click renewals', 'PDMP Integration', 'Pharmacy Database'],
                    accent: "blue"
                }
            ]
        },
        {
            category: "Smart Workflow",
            items: [
                {
                    icon: Zap,
                    title: 'Predictive Logic',
                    description: 'PageMD anticipates your next step based on the visit context.',
                    details: ['Auto-population', 'Dynamic Assessment', 'Smart Plan Sourcing'],
                    accent: "sky"
                },
                {
                    icon: Clock,
                    title: 'Flow Scheduling',
                    description: 'A calendar that understands the pace of a modern clinic.',
                    details: ['Drag-and-Drop', 'Multi-Provider View', 'Waitlist Automation'],
                    accent: "blue"
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            {/* Premium Hero */}
            <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 px-6 bg-white overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-8 border border-sky-100/40">
                        <Activity className="w-3.5 h-3.5" />
                        The Intuitive Angle
                    </div>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                        Everything you need. <br />
                        <span className="text-sky-500">Nothing you don't.</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed">
                        We stripped away the legacy clutter to build an EMR that actually follows your clinical flow.
                    </p>
                </div>
            </section>

            {/* Predictive Logic Highlight - Statement Section */}
            <section className="py-24 lg:py-32 bg-slate-900 px-6 overflow-hidden relative rounded-[3rem] mx-6">
                <div className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-sky-500 rounded-full blur-[140px] opacity-20 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-400/10 text-sky-400 rounded-full text-[9px] font-semibold tracking-widest uppercase mb-6 border border-sky-400/20">
                            <Zap className="w-3 h-3 fill-current" />
                            Industry First
                        </div>
                        <h2 className="text-3xl md:text-5xl font-semibold text-white mb-6 leading-tight tracking-tight">
                            Smart Workflow. <br />
                            <span className="text-sky-400">Predictive Logic.</span>
                        </h2>
                        <p className="text-base text-slate-400 mb-8 leading-relaxed font-normal">
                            PageMD learns how you practice. It suggests ICD-10 codes, pre-fills assessment summaries, and sources plans from your historical clinical excellence.
                        </p>

                        <div className="space-y-4">
                            {[
                                "EMR anticipates your next clinical step.",
                                "Zero-Clutter Interface hides irrelevant data.",
                                "Context-aware templates adapt in real-time."
                            ].map((point, i) => (
                                <div key={i} className="flex gap-3 items-center text-white/70 text-sm font-medium">
                                    <div className="w-5 h-5 rounded-full bg-sky-400/10 flex items-center justify-center border border-sky-400/20">
                                        <Check className="w-3 h-3 text-sky-400" />
                                    </div>
                                    {point}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            {/* Animated Mockup Component */}
                            <div className="space-y-6 text-slate-300">
                                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-sky-500/20"></div>
                                        <div>
                                            <div className="h-2 w-24 bg-white/20 rounded"></div>
                                            <div className="h-1.5 w-16 bg-white/10 rounded mt-2"></div>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-sky-500/20 text-sky-400 text-[10px] font-semibold rounded-lg tracking-widest uppercase">PREDICTIVE MODE</div>
                                </div>

                                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 border-l-4 border-l-sky-500 animate-pulse">
                                    <p className="text-[10px] font-semibold text-sky-400 uppercase tracking-[0.2em] mb-3">Suggested Diagnosis</p>
                                    <p className="text-lg font-semibold text-white mb-1">Essential Hypertension</p>
                                    <p className="text-xs text-slate-500 font-medium">I10 - Based on clinical assessment history</p>
                                </div>

                                <div className="space-y-3 opacity-40">
                                    <div className="h-2 w-full bg-white/10 rounded"></div>
                                    <div className="h-2 w-5/6 bg-white/10 rounded"></div>
                                    <div className="h-2 w-4/6 bg-white/10 rounded"></div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <div className="h-10 flex-1 bg-sky-500 rounded-xl flex items-center justify-center font-semibold text-[10px] text-white uppercase tracking-widest shadow-lg shadow-sky-500/20">Accept Suggestion</div>
                                    <div className="h-10 w-24 bg-white/10 rounded-xl flex items-center justify-center font-semibold text-[10px] text-white/40 uppercase tracking-widest">Ignore</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Features Grid */}
            <section className="py-24 lg:py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    {featureSections.map((section, idx) => (
                        <div key={idx} className="mb-20 last:mb-0">
                            <h3 className="text-[10px] font-semibold text-sky-500 uppercase tracking-widest mb-10 border-l-2 border-sky-500 pl-4">{section.category}</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                {section.items.map((item, i) => (
                                    <div key={i} className="group p-7 bg-white border border-slate-100 rounded-2xl shadow-sm transition-all hover:-translate-y-0.5">
                                        <div className={`w-12 h-12 rounded-xl bg-slate-50 text-sky-500 flex items-center justify-center mb-6 border border-slate-100/40 transition-transform group-hover:scale-105`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <h4 className="text-xl font-semibold text-slate-800 mb-3">{item.title}</h4>
                                        <p className="text-[15px] text-slate-500 font-normal leading-relaxed mb-6">{item.description}</p>
                                        <ul className="space-y-3">
                                            {item.details.map((detail, dIdx) => (
                                                <li key={dIdx} className="flex items-center gap-2.5 text-[13px] text-slate-600 font-medium">
                                                    <Check className="w-3.5 h-3.5 text-sky-500" />
                                                    {detail}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-32 lg:py-48 bg-slate-50 px-6 border-t border-slate-100 overflow-hidden relative">
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-semibold text-slate-800 mb-12 leading-tight tracking-tight">
                        Experience the <br />
                        <span className="text-sky-500">intuitive angle.</span>
                    </h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 active:scale-95 text-base flex items-center justify-center gap-3">
                            Work with Us
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link to="/pricing" className="px-10 py-5 bg-white hover:bg-slate-50 text-slate-800 font-medium rounded-xl border border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 text-base flex items-center justify-center">
                            View Pricing
                        </Link>
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

export default FeaturesPage;
