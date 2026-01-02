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

            {/* Hero Section - Physician-Centric */}
            <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 bg-slate-900 border-b border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(37,99,235,0.2),transparent)] pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold tracking-wide uppercase mb-8 border border-blue-500/20 backdrop-blur-md">
                        <Stethoscope className="w-3.5 h-3.5" />
                        Designed by a Cardiologist for Independent Practices
                    </div>

                    <h1 className="text-5xl md:text-8xl font-black text-white leading-[1.05] mb-8 tracking-tighter">
                        Practice Medicine, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Not Documentation.</span>
                    </h1>

                    <p className="text-xl text-slate-300 leading-relaxed mb-12 max-w-3xl mx-auto">
                        Built for the speed of real-world practice. Stop fighting bloated software and start focusing on what matters most: your patients.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link to="/contact" className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-2xl shadow-blue-500/40 transition-all hover:-translate-y-1 active:scale-95 text-lg flex items-center justify-center gap-2">
                            Schedule Your Demo
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link to="/features" className="px-12 py-6 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/20 backdrop-blur-sm transition-all text-lg text-center">
                            Explore Features
                        </Link>
                    </div>

                    <div className="mt-20 flex flex-col items-center">
                        <div className="flex items-center gap-1 text-blue-400 mb-4 opacity-70">
                            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                        </div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em]">Trusted by Physicians Nationwide</p>
                    </div>
                </div>
            </section>

            {/* The "Why" Section - The Problem */}
            <section className="py-24 lg:py-32 bg-white px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-24 items-center">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 leading-tight tracking-tight">The Modern EMR Is Broken. We Fixed It.</h2>
                            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                                Most EMRs were built for billing departments, not clinical staff. They prioritize data entry over patient care, leading to burnout and administrative overload.
                            </p>

                            <div className="space-y-6">
                                {[
                                    { text: "No more spending 2 hours finishing charts after dinner.", icon: Clock, color: "text-amber-500" },
                                    { text: "Stop clicking through 15 menus just to prescribe an antibiotic.", icon: Zap, color: "text-blue-500" },
                                    { text: "End the frustration of billing systems that don't talk to charts.", icon: DollarSign, color: "text-emerald-500" }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-5 items-start">
                                        <div className={`w-12 h-12 rounded-2xl ${item.color.replace('text-', 'bg-').replace('500', '50')} ${item.color} flex items-center justify-center shrink-0`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <p className="text-lg text-slate-700 font-medium leading-tight pt-2">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-6">
                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex gap-6">
                                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl h-fit">
                                    <X className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 mb-2">The "Old" Way</h4>
                                    <p className="text-slate-500 text-sm">Complex menus, slow loading times, and generic templates that don't fit your specialty.</p>
                                </div>
                            </div>
                            <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex gap-6 transform lg:translate-x-12 shadow-xl shadow-blue-100/20">
                                <div className="p-3 bg-blue-600 text-white rounded-xl h-fit">
                                    <Stethoscope className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 mb-2">The PageMD Way</h4>
                                    <p className="text-slate-500 text-sm italic font-medium">"Everything in clinical logic. Charting is so fast you finish before the patient leaves the room."</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-slate-50/50 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4">Complete Practice Mastery</h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">Everything you need to run your practice efficiently, without the bloat of traditional systems.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* EHR */}
                        <div className="group p-8 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all hover:shadow-2xl hover:shadow-blue-100/50 hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <FileText className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Clinical Charting</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">Designed for speed with specialty-specific templates and smart auto-population.</p>
                            <Link to="/features" className="flex items-center text-blue-600 text-sm font-bold group-hover:gap-2 transition-all">
                                Learn More <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* E-Prescribing */}
                        <div className="group p-8 bg-white rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-all hover:shadow-2xl hover:shadow-emerald-100/50 hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Activity className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Smart RX</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">Secure, integrated e-prescribing with real-time drug interaction checks.</p>
                            <Link to="/features" className="flex items-center text-blue-600 text-sm font-bold group-hover:gap-2 transition-all">
                                Learn More <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* Scheduling */}
                        <div className="group p-8 bg-white rounded-[2rem] border border-slate-100 hover:border-purple-200 transition-all hover:shadow-2xl hover:shadow-purple-100/50 hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Clock className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Scheduling</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">Manage appointments effortlessly with a clean, drag-and-drop interface.</p>
                            <Link to="/features" className="flex items-center text-blue-600 text-sm font-bold group-hover:gap-2 transition-all">
                                Learn More <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* Billing */}
                        <div className="group p-8 bg-white rounded-[2rem] border border-slate-100 hover:border-orange-200 transition-all hover:shadow-2xl hover:shadow-orange-100/50 hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <DollarSign className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Billing & RCM</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">Automated superbills and claim scrubbing to maximize your revenue cycle.</p>
                            <Link to="/features" className="flex items-center text-blue-600 text-sm font-bold group-hover:gap-2 transition-all">
                                Learn More <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose PageMD - Direct Value Props */}
            <section className="py-24 bg-slate-900 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-3 gap-12">
                        {[
                            { title: "Financial Health", desc: "Automated billing checks, claim scrubbing, and real-time revenue dashboards.", icon: DollarSign },
                            { title: "Clinical Speed", desc: "Specialty-specific macros and templates that work at the speed of thought.", icon: Zap },
                            { title: "Patient Connection", desc: "Digital check-ins and intake forms so you spend less time on screens.", icon: Heart }
                        ].map((item, i) => (
                            <div key={i} className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
                                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                                    <item.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-4">{item.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section - Final Hook */}
            <section className="py-32 lg:py-48 px-6 bg-white relative overflow-hidden">
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-8 leading-tight">Ready to recapture 2 hours of your day?</h2>
                    <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">No long-term contracts. No setup fees. Just better software for better patient care.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link to="/contact" className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[2rem] shadow-2xl shadow-blue-500/20 transition-all hover:-translate-y-1 text-lg">
                            Schedule Your Private Demo
                        </Link>
                        <Link to="/pricing" className="px-12 py-6 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-[2rem] border-2 border-slate-100 transition-all text-lg text-center">
                            View Pricing Plans
                        </Link>
                    </div>
                    <div className="mt-20 flex flex-col items-center gap-4">
                        <div className="flex gap-2 text-emerald-500 font-black tracking-widest text-xs uppercase">
                            <CheckCircle2 className="w-4 h-4" /> HIPAA Certified
                            <span className="mx-2 text-slate-200">|</span>
                            <CheckCircle2 className="w-4 h-4" /> 256-bit Encryption
                            <span className="mx-2 text-slate-200">|</span>
                            <CheckCircle2 className="w-4 h-4" /> Physician Led
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <img src="/logo.png" alt="PageMD Logo" className="h-8 w-auto object-contain" />
                    <div className="flex gap-8 text-sm font-medium text-gray-500">
                        <Link to="/features" className="hover:text-blue-600">Features</Link>
                        <Link to="/pricing" className="hover:text-blue-600">Pricing</Link>
                        <Link to="/security" className="hover:text-blue-600">Security</Link>
                        <Link to="/terms" className="hover:text-blue-600">Terms</Link>
                    </div>
                    <div className="text-sm text-gray-400">© {currentYear} PageMD Inc.</div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
