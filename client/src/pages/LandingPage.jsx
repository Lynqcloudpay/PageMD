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
    Users
} from 'lucide-react';
import LandingNav from '../components/LandingNav';

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            <LandingNav />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div className="text-left animate-in fade-in slide-in-from-left duration-1000">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold tracking-wide uppercase mb-8 border border-blue-100/50">
                                <Stethoscope className="w-3.5 h-3.5" />
                                Built by a Physician, for Physicians
                            </div>

                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-8 tracking-tight">
                                Focus on Patients, <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Not Paperwork.</span>
                            </h1>

                            <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-xl">
                                Built by a practicing physician frustrated with bloated EMRs. PageMD puts clinical workflow first — designed for the speed of real-world practice.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link to="/contact" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                                    Start Free Trial
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                                <Link to="/features" className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl border-2 border-slate-100 flex items-center justify-center gap-2 transition-all hover:border-blue-100">
                                    Explore Features
                                </Link>
                            </div>

                            <div className="mt-12 flex items-center gap-6 pt-12 border-t border-slate-100">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                                            <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Physician" />
                                        </div>
                                    ))}
                                </div>
                                <div className="text-sm">
                                    <div className="flex items-center gap-1 text-amber-400 mb-0.5">
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                                    </div>
                                    <p className="text-slate-500 font-medium">Trusted by Practicing Physicians</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative group animate-in fade-in slide-in-from-right duration-1000 delay-200">
                            {/* Decorative Elements */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors"></div>

                            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-200/50 border border-white/20 transform lg:rotate-2 group-hover:rotate-0 transition-transform duration-700">
                                <img
                                    src="/hero-preview.png"
                                    alt="PageMD Dashboard"
                                    className="w-full h-auto"
                                />
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-transparent pointer-events-none"></div>
                            </div>

                            {/* Floating Stats Card */}
                            <div className="absolute -bottom-6 -left-6 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white/60 animate-bounce-slow">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
                                        <Activity className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-slate-800">Swift</div>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note Completion</div>
                                    </div>
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
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Complete Practice Mastery</h2>
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

            {/* CTA Section */}
            <section className="py-24 px-6 bg-slate-900 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.1),transparent)]"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-8">Ready to reclaim your time?</h2>
                    <p className="text-xl text-slate-400 mb-10">Join forward-thinking physicians who chose clinical excellence over clicking boxes.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1">
                            Schedule Your Demo
                        </Link>
                        <Link to="/login" className="px-10 py-5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl backdrop-blur-sm border border-white/10 transition-all">
                            Sign In to Practice
                        </Link>
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
