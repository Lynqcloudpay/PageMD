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
    Activity,
    Users,
    Clock,
    BarChart3,
    HeartPulse,
    Check,
    X,
    Star
} from 'lucide-react';

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="PageMD" className="h-10 w-auto" />
                        </Link>

                        {/* Menu Items */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
                        </div>

                        {/* Login Button */}
                        <Link
                            to="/login"
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-28 pb-20 px-6 bg-gradient-to-b from-gray-50 to-white">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-8">
                        <HeartPulse className="w-4 h-4" />
                        Trusted by Independent Practices
                    </div>

                    <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6 max-w-4xl mx-auto">
                        An EMR Built by a Physician<br />
                        <span className="text-blue-600">For Physicians</span>
                    </h1>

                    <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto mb-10">
                        Stop fighting your EMR. PageMD is designed for how physicians actually work.
                        Chart faster, bill smarter, and spend more time with patients.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-wrap justify-center gap-4 mb-16">
                        <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                            Start Free Trial
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <Link
                            to="/login"
                            className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-200 transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-gray-900 mb-2">2x</div>
                            <div className="text-gray-600">Faster Documentation</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-gray-900 mb-2">99.9%</div>
                            <div className="text-gray-600">Uptime Guarantee</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-gray-900 mb-2">HIPAA</div>
                            <div className="text-gray-600">Fully Compliant</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem/Solution Section */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-6">
                                Your Current EMR is Costing You Time and Money
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <X className="w-3 h-3 text-red-600" />
                                    </div>
                                    <p className="text-gray-600">Hours spent on documentation after clinic hours</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <X className="w-3 h-3 text-red-600" />
                                    </div>
                                    <p className="text-gray-600">Complex workflows that slow down patient care</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <X className="w-3 h-3 text-red-600" />
                                    </div>
                                    <p className="text-gray-600">Expensive per-provider licensing fees</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <X className="w-3 h-3 text-red-600" />
                                    </div>
                                    <p className="text-gray-600">Billing errors leading to denied claims</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-blue-50 rounded-2xl p-8">
                            <h3 className="text-2xl font-bold text-gray-900 mb-6">PageMD is Different</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <p className="text-gray-700">Intuitive charting designed by a practicing physician</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <p className="text-gray-700">Streamlined workflows that match clinical thinking</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <p className="text-gray-700">Transparent, predictable pricing</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <p className="text-gray-700">Built-in billing validation to maximize reimbursement</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Overview */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Run Your Practice</h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            A complete EHR solution with the features independent practices actually use.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clinical Charting</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Structured notes with smart templates and ICD-10 search. Finish notes before leaving the exam room.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                                <DollarSign className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing & Superbills</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Automatic superbill generation with diagnosis validation and compliance checks.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                                <Clock className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Scheduling</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Color-coded calendar with appointment types and real-time status updates.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Patient Management</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Complete records with demographics, insurance, medical history, and medications.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center mb-4">
                                <HeartPulse className="w-6 h-6 text-rose-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Orders & Results</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Order labs, imaging, and referrals directly from the chart with result tracking.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                                <BarChart3 className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Real-time insights into patient volume, revenue, and quality measures.
                            </p>
                        </div>
                    </div>

                    <div className="text-center mt-12">
                        <Link to="/features" className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors">
                            Explore All Features
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Security Highlight */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-6">
                                <Shield className="w-4 h-4" />
                                Enterprise Security
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-6">
                                HIPAA Compliance Built Into Every Layer
                            </h2>
                            <p className="text-gray-600 mb-8 leading-relaxed">
                                Security isn't an afterthought. PageMD was architected with healthcare compliance
                                at every layer, so you can focus on patient care.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-blue-600" />
                                    <span className="text-gray-700">AES-256 encryption at rest and TLS 1.3 in transit</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ClipboardCheck className="w-5 h-5 text-purple-600" />
                                    <span className="text-gray-700">Role-based access control with granular permissions</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Activity className="w-5 h-5 text-emerald-600" />
                                    <span className="text-gray-700">Immutable audit logs with cryptographic integrity</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-amber-600" />
                                    <span className="text-gray-700">Multi-tenant isolation at the database level</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <Link to="/security" className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors">
                                    Learn More About Security
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-2xl p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                                <Shield className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">SOC 2 Type II</h3>
                            <p className="text-gray-400 mb-6">Enterprise-grade security controls validated by independent auditors.</p>
                            <div className="flex justify-center gap-4 flex-wrap">
                                <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300">HIPAA</div>
                                <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300">SOC 2</div>
                                <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300">HITECH</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Preview */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            No hidden fees. No per-claim charges. Plans that grow with your practice.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Starter</h3>
                            <p className="text-gray-600 text-sm mb-4">Solo practitioners</p>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-gray-900">$199</span>
                                <span className="text-gray-600">/mo</span>
                            </div>
                            <p className="text-sm text-gray-600">1 Provider, Core Features</p>
                        </div>

                        <div className="bg-white rounded-2xl p-8 border-2 border-blue-600 text-center relative">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                                Most Popular
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Professional</h3>
                            <p className="text-gray-600 text-sm mb-4">Growing practices</p>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-gray-900">$399</span>
                                <span className="text-gray-600">/mo</span>
                            </div>
                            <p className="text-sm text-gray-600">Up to 5 Providers, All Features</p>
                        </div>

                        <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise</h3>
                            <p className="text-gray-600 text-sm mb-4">Multi-location</p>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-gray-900">Custom</span>
                            </div>
                            <p className="text-sm text-gray-600">Unlimited, Custom Integrations</p>
                        </div>
                    </div>

                    <div className="text-center mt-12">
                        <Link to="/pricing" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                            View Full Pricing
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Testimonial */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="flex justify-center gap-1 mb-6">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-6 h-6 text-amber-400 fill-current" />
                        ))}
                    </div>
                    <blockquote className="text-2xl text-gray-900 font-medium leading-relaxed mb-8">
                        "I finally have an EMR that works the way I think. I'm finishing my notes
                        before I even leave the office. This is what an EMR should be."
                    </blockquote>
                    <div className="text-gray-600">
                        <span className="font-semibold text-gray-900">Family Medicine Physician</span>
                        <span className="mx-2">•</span>
                        Austin, TX
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6 bg-blue-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Ready to Take Back Your Time?
                    </h2>
                    <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                        Join physicians who are spending less time charting and more time with patients.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                            Start Free Trial
                        </button>
                        <Link
                            to="/login"
                            className="px-8 py-4 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400 transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-gray-900">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <img src="/logo.png" alt="PageMD" className="h-8 w-auto brightness-0 invert" />
                            </div>
                            <p className="text-gray-400 text-sm">
                                An EMR built by physicians, for physicians.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-medium mb-4">Product</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                                <li><Link to="/security" className="hover:text-white transition-colors">Security</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-medium mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-medium mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">HIPAA Compliance</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-gray-800 text-center">
                        <div className="text-sm text-gray-500">
                            © {currentYear} PageMD. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
