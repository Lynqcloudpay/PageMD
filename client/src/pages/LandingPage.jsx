import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    DollarSign,
    Shield,
    Users,
    HeartPulse,
    BarChart3,
    ArrowRight,
    Check,
    Star,

    Clock,
    Activity,
    Lock,
    Building2,
    ClipboardCheck
} from 'lucide-react';

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="PageMD Logo" className="h-10 w-auto object-contain" />
                        </Link>

                        {/* Menu Items */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
                            <Link to="/about" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">About</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
                        </div>

                        {/* Login Button */}
                        <Link
                            to="/login"
                            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-all shadow-lg hover:shadow-gray-200 transform hover:-translate-y-0.5"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-24 px-6 relative overflow-hidden">
                {/* Background Blobs - Light & Subtle */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-50/50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-50/50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div className="text-left space-y-8 animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm border border-blue-100/50">
                            <HeartPulse className="w-4 h-4 text-blue-500 fill-current" />
                            Made for Physicians by Physicians
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                            Built by a Physician, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">For Physicians.</span>
                        </h1>

                        <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                            Frustrated by EMRs built by "tech" people? PageMD is the first clinical platform designed entirely by a practicing physician to eliminate busywork and put the focus back on the patient.
                        </p>

                        <div className="flex flex-wrap gap-4 pt-4">
                            <Link
                                to="/contact"
                                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-200 hover:shadow-2xl hover:shadow-blue-300 transform hover:-translate-y-1 flex items-center gap-2"
                            >
                                Get Started
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link
                                to="/about"
                                className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl border border-gray-200 transition-all hover:shadow-lg transform hover:-translate-y-1"
                            >
                                Our Story
                            </Link>
                        </div>

                        <div className="flex items-center gap-6 pt-4 text-sm font-medium text-gray-500">
                            <div className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-green-500" /> Transparent pricing
                            </div>
                            <div className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-green-500" /> No hidden fees
                            </div>
                        </div>
                    </div>

                    {/* Abstract Hero Visual - CSS Only Construction */}
                    <div className="relative hidden lg:block perspective-[2000px]">
                        <div className="relative w-full aspect-square max-w-lg mx-auto transform rotate-y-[-10deg] rotate-x-[5deg] transition-transform duration-700 hover:rotate-y-[0deg] hover:rotate-x-[0deg]">
                            {/* Main Card */}
                            <div className="absolute inset-0 bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col gap-4 overflow-hidden">
                                {/* Header */}
                                <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100"></div>
                                        <div>
                                            <div className="w-24 h-2.5 bg-gray-900 rounded-full mb-1"></div>
                                            <div className="w-16 h-2 bg-gray-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                </div>
                                {/* Body Content */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-1/3 bg-gray-50 h-32 rounded-xl"></div>
                                        <div className="w-2/3 space-y-3">
                                            <div className="w-full h-3 bg-gray-100 rounded-full"></div>
                                            <div className="w-5/6 h-3 bg-gray-100 rounded-full"></div>
                                            <div className="w-4/6 h-3 bg-gray-100 rounded-full"></div>
                                            <div className="mt-4 flex gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100"></div>
                                                <div className="w-8 h-8 rounded-full bg-green-100"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-600/5 p-4 rounded-xl border border-blue-100 border-dashed">
                                        <div className="w-full h-20"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Elements */}
                            <div className="absolute -right-12 top-20 bg-white p-4 rounded-xl shadow-xl border border-gray-100 animate-float-slow">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Check className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">Note Signed</div>
                                        <div className="text-xs text-gray-500">Just now</div>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -left-8 bottom-32 bg-white p-4 rounded-xl shadow-xl border border-gray-100 animate-float-delayed">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Star className="w-5 h-5 text-blue-600 fill-current" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">Superbill Ready</div>
                                        <div className="text-xs text-gray-500">Auto-generated</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-12 border-y border-gray-100 bg-blue-50/30">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-lg font-medium text-blue-700 italic">"I built PageMD because I was tired of spending 4 hours a day on charting. We need tools that understand the clinical workflow, not just the billing cycle."</p>
                    <p className="mt-4 text-sm font-bold text-gray-500 uppercase tracking-widest">— Dr. Mel Rodriguez, Founder</p>
                </div>
            </section>

            {/* Key Benefits - Animated Cards */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">Designed in the Clinic, Not the Boardroom.</h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            The EMR that actually follows your clinical train of thought. Built to reduce administrative burden so you can focus on what matters.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Clock,
                                title: "Efficient Charting",
                                desc: "Clean, no-nonsense charting interface designed to let you document visits quickly and accurately.",
                                color: "blue"
                            },
                            {
                                icon: DollarSign,
                                title: "Smart Billing",
                                desc: "Intelligent built-in checks prevent common errors before you submit, helping you get paid faster.",
                                color: "emerald"
                            },
                            {
                                icon: Shield,
                                title: "Secure & Compliant",
                                desc: "Reliable encryption and standard HIPAA compliance measures to keep your patient data safe.",
                                color: "purple"
                            }
                        ].map((feature, i) => (
                            <div key={i} className="group p-8 rounded-3xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-2">
                                <div className={`w-14 h-14 rounded-2xl bg-${feature.color}-50 text-${feature.color}-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Feature Grid - Large Visuals */}
            <section className="py-24 px-6 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    {/* Feature 1 */}
                    <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
                        <div className="lg:w-1/2 space-y-8">
                            <div className="inline-block p-2 bg-white rounded-lg shadow-sm">
                                <FileText className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-4xl font-bold text-gray-900">Charting that makes sense.</h2>
                            <p className="text-xl text-gray-600 leading-relaxed">
                                Forget click-fatigue. Our intuitive SOAP interface anticipates your needs with a layout familiar to every physician.
                            </p>
                            <ul className="space-y-4">
                                {['Streamlined Templates', 'Distraction-Free Mode', 'ICD-10 Auto-Suggest'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-lg text-gray-700">
                                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="lg:w-1/2">
                            <div className="relative rounded-2xl bg-white p-2 shadow-2xl border border-gray-100 transform rotate-2 hover:rotate-0 transition-all duration-500">
                                <div className="bg-gray-50 rounded-xl p-6 aspect-[4/3] flex flex-col gap-4">
                                    {/* Mock UI */}
                                    <div className="h-4 w-1/3 bg-gray-200 rounded"></div>
                                    <div className="h-px bg-gray-200 w-full my-2"></div>
                                    <div className="space-y-3">
                                        <div className="h-3 w-full bg-gray-200 rounded"></div>
                                        <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                                        <div className="h-3 w-4/6 bg-gray-200 rounded"></div>
                                    </div>
                                    <div className="mt-auto flex justify-end">
                                        <div className="h-10 w-32 bg-blue-600 rounded-lg"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2 */}
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
                        <div className="lg:w-1/2 space-y-8">
                            <div className="inline-block p-2 bg-white rounded-lg shadow-sm">
                                <DollarSign className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h2 className="text-4xl font-bold text-gray-900">Revenue cycle control.</h2>
                            <p className="text-xl text-gray-600 leading-relaxed">
                                Create accurate Superbills instantly. Our built-in validations help you catch missing diagnoses or charges before they become denials.
                            </p>
                            <Link to="/features" className="inline-flex items-center gap-2 text-emerald-600 font-bold text-lg hover:gap-4 transition-all">
                                Explore Billing Features <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                        <div className="lg:w-1/2">
                            <div className="relative rounded-2xl bg-white p-2 shadow-2xl border border-gray-100 transform -rotate-2 hover:rotate-0 transition-all duration-500">
                                <div className="bg-emerald-50/30 rounded-xl p-6 aspect-[4/3] flex flex-col justify-center items-center gap-6">
                                    <div className="w-24 h-24 rounded-full border-8 border-emerald-500 flex items-center justify-center text-2xl font-bold text-emerald-800">
                                        <Check className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-gray-900">Pre-Claim Validation</div>
                                        <div className="text-sm text-gray-500">Reduce denials securely</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonial - Impactful */}
            <section className="py-24 px-6 bg-gray-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="flex justify-center gap-2 mb-8 animate-pulse-slow">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-8 h-8 text-yellow-400 fill-current" />
                        ))}
                    </div>
                    <blockquote className="text-3xl md:text-5xl font-bold leading-tight mb-12">
                        "Finally, an EMR that feels like it was built by someone who actually sees patients."
                    </blockquote>
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold">DR</div>
                        <div className="text-left">
                            <div className="text-xl font-bold">Dr. Sarah Jenkins</div>
                            <div className="text-gray-400">Internal Medicine • Austin, TX</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA - High Energy */}
            <section className="py-32 px-6 bg-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-8">
                        Ready to upgrade your practice?
                    </h2>
                    <p className="text-xl text-gray-500 mb-12">
                        Join the growing community of independent physicians who have switched to a Better way of charting.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl scale-100 hover:scale-105">
                            Contact Our Team
                        </Link>
                        <Link to="/about" className="px-10 py-5 bg-white text-gray-900 text-lg font-bold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                            About our Mission
                        </Link>
                    </div>
                    <p className="mt-8 text-sm text-gray-400">
                        Designed for Independent Practices • HIPAA Compliant
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="PageMD Logo" className="h-8 w-auto object-contain" />
                    </div>

                    <div className="flex gap-8 text-sm font-medium text-gray-500">
                        <Link to="/features" className="hover:text-blue-600 transition-colors">Features</Link>
                        <Link to="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
                        <Link to="/security" className="hover:text-blue-600 transition-colors">Security</Link>
                        <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
                    </div>

                    <div className="text-sm text-gray-400">
                        © {currentYear} PageMD Inc.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
