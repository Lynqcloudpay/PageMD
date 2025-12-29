import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    DollarSign,
    Shield,
    Building2,
    Lock,
    ClipboardCheck,
    CheckCircle2,
    ArrowRight,
    Stethoscope,
    Activity,
    Heart
} from 'lucide-react';

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <Stethoscope className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-slate-900 tracking-tight">PageMD</span>
                        </div>

                        {/* Menu Items */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Features</a>
                            <a href="#security" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Security</a>
                            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Pricing</a>
                            <a href="#contact" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Contact</a>
                        </div>

                        {/* Login Button */}
                        <Link
                            to="/login"
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
                        >
                            Login
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left Content */}
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
                                    An EMR Built by a{' '}
                                    <span className="text-blue-600">Physician</span>
                                    {' '}— for Physicians.
                                </h1>
                                <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                                    Designed and tested in real clinical practice by{' '}
                                    <span className="font-semibold text-slate-700">Dr. Melanio J. Rodriguez, MD</span>,
                                    with a focus on speed, clarity, and ease of use.
                                </p>
                            </div>

                            {/* Trust Badges */}
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Physician-Built
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Real-World Tested
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Independent Clinics
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-wrap gap-4 pt-4">
                                <button className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-xl shadow-slate-900/20 transition-all hover:shadow-2xl hover:shadow-slate-900/30 hover:-translate-y-0.5 flex items-center gap-2">
                                    Request Demo
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <Link
                                    to="/login"
                                    className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border-2 border-slate-200 transition-all hover:border-blue-300 flex items-center gap-2"
                                >
                                    Login to PageMD
                                </Link>
                            </div>
                        </div>

                        {/* Right Visual */}
                        <div className="relative hidden lg:block">
                            <div className="absolute -top-10 -right-10 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
                            <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
                            <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-8">
                                <div className="space-y-6">
                                    {/* Mock EMR Interface */}
                                    <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                            JD
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">John Doe</div>
                                            <div className="text-sm text-slate-500">DOB: 05/15/1975 • MRN: 100234</div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chief Complaint</div>
                                            <div className="text-sm text-slate-700">Follow-up for hypertension management</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-blue-50 rounded-xl">
                                                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">BP</div>
                                                <div className="text-lg font-bold text-blue-900">128/82</div>
                                            </div>
                                            <div className="p-4 bg-emerald-50 rounded-xl">
                                                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Pulse</div>
                                                <div className="text-lg font-bold text-emerald-900">72 bpm</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">I10 - HTN</div>
                                            <div className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">E11.9 - T2DM</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 bg-slate-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">Built for Real Clinical Workflows</h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Every feature is designed with the physician's daily experience in mind — no bloat, no complexity.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-100 border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                                <FileText className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Clinical Charting</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Structured notes, diagnoses, and visit workflows designed for speed and accuracy. Chart in minutes, not hours.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-100 border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
                                <DollarSign className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Billing & Superbills</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Built-in billing logic with diagnosis validation, charge capture, and commercial-grade safety checks.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-100 border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
                                <Building2 className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Multi-Tenant Architecture</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Secure clinic separation with enterprise-grade audit trails. Each practice is fully isolated.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section id="security" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold mb-6">
                                    <Shield className="w-4 h-4" />
                                    Enterprise Security
                                </div>
                                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                                    HIPAA-Grade Security by Design
                                </h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    PageMD is built with HIPAA-grade security practices, encrypted data, and tamper-evident audit logs from day one.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                        <Lock className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-1">Encrypted Data at Rest & In Transit</h4>
                                        <p className="text-slate-600 text-sm">All patient data is encrypted using industry-standard AES-256 encryption.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                        <ClipboardCheck className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-1">Role-Based Access Control</h4>
                                        <p className="text-slate-600 text-sm">Granular permissions ensure staff only access what they need.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                        <Activity className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 mb-1">Tamper-Evident Audit Trails</h4>
                                        <p className="text-slate-600 text-sm">Every action is logged with cryptographic hashing for compliance.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative hidden lg:block">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-blue-100 to-emerald-100 rounded-full blur-3xl opacity-50"></div>
                            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-10 shadow-2xl">
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                                        <Shield className="w-10 h-10 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white mb-2">Protected</div>
                                        <div className="text-slate-400">Your data is secure with enterprise-grade encryption</div>
                                    </div>
                                    <div className="flex justify-center gap-3 pt-4">
                                        <div className="px-4 py-2 bg-slate-800 rounded-lg text-xs text-slate-300 font-mono">AES-256</div>
                                        <div className="px-4 py-2 bg-slate-800 rounded-lg text-xs text-slate-300 font-mono">TLS 1.3</div>
                                        <div className="px-4 py-2 bg-slate-800 rounded-lg text-xs text-slate-300 font-mono">HIPAA</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-blue-700">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to modernize your clinic?
                    </h2>
                    <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                        Join physicians who trust PageMD for their daily clinical workflows.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-white hover:bg-slate-50 text-blue-600 font-semibold rounded-xl shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5">
                            Request Demo
                        </button>
                        <Link
                            to="/login"
                            className="px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl border-2 border-blue-400 transition-all flex items-center gap-2"
                        >
                            Login to PageMD
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-slate-900">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <Stethoscope className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-white">PageMD</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-slate-400">
                            <a href="#" className="hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="hover:text-white transition-colors">Terms</a>
                            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
                        </div>

                        <div className="text-sm text-slate-500">
                            © PageMD {currentYear}. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
