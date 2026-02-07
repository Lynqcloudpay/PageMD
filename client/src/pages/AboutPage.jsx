import React from 'react';
import { Link } from 'react-router-dom';
import {
    Stethoscope,
    Heart,
    Target,
    Users,
    Zap,
    Shield,
    ArrowRight,
    CheckCircle2,
    Clock,
    Lightbulb,
    History,
    Activity,
    ChevronRight,
    Star
} from 'lucide-react';
import LandingNav from '../components/LandingNav';

const AboutPage = () => {
    const currentYear = new Date().getFullYear();

    React.useEffect(() => {
        document.title = "Our Story | Physician-Led EMR | PageMD";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "The PageMD Story. Built by physicians to solve clinical burnout. Discover how we're redesigning intuitive intelligence in healthcare.");
    }, []);

    const timeline = [
        { year: "2022", event: "The Spark", desc: "Frustrated by legacy EMRs, Dr. Rodriguez begins drafting the first clinical logic engine." },
        { year: "2023", event: "Foundations", desc: "PageMD v1 launches for private pilot, focusing on Zero-Clutter documentation." },
        { year: "2024", event: "Expansion", desc: "Predictive Logic is introduced, cutting charting time by an average of 40%." },
        { year: "2025", event: "The Future", desc: "PageMD becomes the industry standard for intuitive, physician-led intelligence." }
    ];

    const values = [
        { icon: Clock, title: "Time is Sacred", desc: "Every minute not spent documentation is a minute back for patients or family.", accent: "sky" },
        { icon: Zap, title: "Clinical Flow", desc: "We design for the speed of thought, not the speed of data entry.", accent: "blue" },
        { icon: Shield, title: "Absolute Trust", desc: "HIPAA compliance is just the floor. We build for ironclad clinical security.", accent: "sky" }
    ];

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            {/* Premium Hero */}
            <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 px-6 bg-white overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-full text-[11px] font-black tracking-[0.2em] uppercase mb-10 border border-sky-100/50">
                        <History className="w-3.5 h-3.5" />
                        Our Authority
                    </div>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.9] mb-8 tracking-tighter">
                        Built by a <br />
                        <span className="text-sky-500">physician explorer.</span>
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
                        PageMD wasn't built in a boardroom. It was built between patient visits, on late-night shifts, and from the deep frustration of a practicing cardiologist.
                    </p>
                </div>
            </section>

            {/* Founder's Story Section */}
            <section className="py-24 lg:py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="relative">
                            <div className="aspect-[4/5] bg-slate-100 rounded-[3rem] overflow-hidden shadow-2xl relative group">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute bottom-10 left-10 text-white opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                                    <p className="text-sm font-black uppercase tracking-[0.2em] mb-2">Dr. MJ Rodriguez</p>
                                    <p className="text-xs font-medium text-slate-300">Founder & CEO, Cardilogist</p>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-[0.4em]">Portrait Placeholder</div>
                            </div>
                            {/* Accent decoration */}
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl"></div>
                        </div>

                        <div>
                            <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">"The modern EMR is a data trap."</h2>
                            <p className="text-lg text-slate-600 mb-8 leading-relaxed font-medium">
                                As a physician, I spent more time clicking than listening. The tools meant to help us were actually driving us to burnout. I realized that the problem wasn't a lack of features—it was a lack of clinical empathy in software design.
                            </p>
                            <p className="text-lg text-slate-600 mb-10 leading-relaxed font-medium">
                                PageMD is my response to that struggle. It's a platform that anticipates your needs, respects your time, and stays out of the way so you can focus on the human in front of you.
                            </p>

                            <div className="inline-flex items-center gap-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                <Activity className="w-10 h-10 text-sky-500" />
                                <div>
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">MJ Rodriguez, MD</p>
                                    <p className="text-xs text-slate-500 font-medium tracking-tight">Founder of PageMD</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Minimalist Timeline */}
            <section className="py-24 lg:py-32 bg-slate-50/50 border-y border-slate-100 overflow-hidden px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">How we got here.</h2>
                    </div>

                    <div className="relative">
                        {/* Desktop Horizontal Line */}
                        <div className="hidden lg:block absolute top-10 left-0 w-full h-px bg-slate-200"></div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                            {timeline.map((item, i) => (
                                <div key={i} className="group">
                                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-8 text-sky-500 font-black text-xs transition-all group-hover:scale-110 group-hover:border-sky-200 shadow-sky-100 group-hover:shadow-xl">
                                        {item.year}
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900 mb-3">{item.event}</h4>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Values */}
            <section className="py-24 lg:py-32 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">
                        {values.map((v, i) => (
                            <div key={i} className="p-10 rounded-[2.5rem] bg-white border border-slate-50 hover:border-slate-100 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative">
                                <div className={`absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-40 h-40 bg-${v.accent}-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                <div className={`w-14 h-14 rounded-2xl bg-${v.accent}-50 text-${v.accent}-500 flex items-center justify-center mb-8 border border-${v.accent}-100/50 relative z-10`}>
                                    <v.icon className="w-7 h-7" />
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 mb-4 relative z-10">{v.title}</h4>
                                <p className="text-slate-500 font-medium leading-relaxed relative z-10">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-32 lg:py-48 bg-white px-6 border-t border-slate-100">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-5xl font-black text-slate-900 mb-12 leading-[1.1] tracking-tighter">Join the <span className="text-sky-500">mission</span> to fix medicine.</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link to="/contact" className="px-12 py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-2xl shadow-slate-200 transition-all hover:-translate-y-1 text-xl flex items-center justify-center gap-4">
                            Work with Us
                            <ArrowRight className="w-6 h-6" />
                        </Link>
                        <Link to="/" className="px-12 py-6 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-2xl border border-slate-200 shadow-sm transition-all hover:-translate-y-1 text-xl flex items-center justify-center">
                            Explore PageMD
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 font-black text-[10px] uppercase tracking-[0.4em] text-slate-400">
                    <Link to="/" className="flex items-center gap-3 grayscale opacity-40 hover:opacity-100 transition-opacity">
                        <img src="/logo.png" alt="PageMD" className="h-10" />
                    </Link>
                    <div className="flex gap-12">
                        <Link to="/privacy" className="hover:text-sky-500 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-sky-500 transition-colors">Terms</Link>
                        <Link to="/security" className="hover:text-sky-500 transition-colors">Security</Link>
                    </div>
                    <div className="text-slate-200">© {currentYear} PageMD Inc.</div>
                </div>
            </footer>
        </div>
    );
};

export default AboutPage;
