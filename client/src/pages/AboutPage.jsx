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
    Lightbulb
} from 'lucide-react';

const AboutPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="PageMD" className="h-10 w-auto" />
                        </Link>
                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Home</Link>
                            <Link to="/features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
                            <Link to="/about" className="text-sm font-medium text-blue-600">About</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
                        </div>
                        <Link to="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-28 pb-16 px-6 bg-gradient-to-b from-blue-50 to-white">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-8">
                        <Stethoscope className="w-4 h-4" />
                        Our Story
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                        Built by a Physician Who Understood the Problem
                    </h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        PageMD was born from firsthand frustration with EMR systems that were designed
                        for billing departments, not for the physicians who use them every day.
                    </p>
                </div>
            </section>

            {/* Origin Story */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="prose prose-lg max-w-none">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8">The Problem We Set Out to Solve</h2>

                        <div className="bg-gray-50 rounded-2xl p-8 mb-12">
                            <p className="text-gray-700 text-lg leading-relaxed mb-6">
                                Every physician knows the frustration: You finish seeing a patient, and instead of
                                moving on to the next one, you're stuck clicking through endless menus, searching
                                for the right diagnosis code, and fighting with a system that seems designed to
                                slow you down.
                            </p>
                            <p className="text-gray-700 text-lg leading-relaxed mb-6">
                                The result? Hours of documentation after clinic hours. Burnout. Less time with
                                patients. And ironically, worse documentation because you're rushing through a
                                system that doesn't match how you think.
                            </p>
                            <p className="text-gray-700 text-lg leading-relaxed">
                                PageMD was created to fix this. Not by adding more features, but by stripping
                                away everything that doesn't serve the physician's actual workflow.
                            </p>
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900 mb-8">A Different Approach</h2>

                        <p className="text-gray-600 text-lg leading-relaxed mb-6">
                            Most EMR systems are built by software companies who consult with physicians
                            after the fact. PageMD was designed from the ground up by a practicing physician
                            who lives with these challenges every day.
                        </p>

                        <p className="text-gray-600 text-lg leading-relaxed mb-8">
                            Every feature, every workflow, every click was designed with one question in mind:
                            <strong> "Does this help the physician take better care of patients?"</strong> If the
                            answer wasn't yes, it didn't make it into the product.
                        </p>
                    </div>
                </div>
            </section>

            {/* Mission & Values */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">What We Believe</h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Our principles guide every decision we make about the product.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-6">
                                <Clock className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Time is Sacred</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Every minute you spend fighting your EMR is a minute you're not spending
                                with patients or with your family. We obsess over eliminating wasted clicks.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-6">
                                <Lightbulb className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Simplicity Over Features</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We'd rather do ten things exceptionally well than a hundred things poorly.
                                Every feature earns its place through real clinical utility.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-6">
                                <Heart className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Physicians First</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We build for the people using the software, not the people buying it.
                                If a feature helps administrators but hurts physicians, we don't build it.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-6">
                                <Shield className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Trust is Earned</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We know you're trusting us with your patients' most sensitive data.
                                We take that responsibility seriously with enterprise-grade security.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center mb-6">
                                <Users className="w-6 h-6 text-rose-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Independent Practices Matter</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We believe independent practices are the backbone of healthcare.
                                You deserve enterprise-quality tools without enterprise-level complexity.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-8 border border-gray-100">
                            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-6">
                                <Target className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Transparent Business</h3>
                            <p className="text-gray-600 leading-relaxed">
                                No hidden fees. No long-term contracts. No nickel-and-diming.
                                We succeed when you succeed, not by locking you in.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why PageMD */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Why Physicians Choose PageMD</h2>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Designed for Clinical Thinking</h3>
                                <p className="text-gray-600">
                                    Our workflows mirror how physicians actually think through a patient encounter,
                                    not how administrators think data should be organized.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Built for Speed</h3>
                                <p className="text-gray-600">
                                    Keyboard shortcuts, smart defaults, and intelligent auto-population mean you
                                    can complete a note in the time it takes to walk to the next room.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Billing That Actually Works</h3>
                                <p className="text-gray-600">
                                    Superbills that generate automatically with the right codes, validation that
                                    catches errors before submission, and clear visibility into your revenue cycle.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Support That Understands Healthcare</h3>
                                <p className="text-gray-600">
                                    When you call for help, you talk to people who understand clinical workflows,
                                    not script readers who don't know what "chief complaint" means.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Priced for Independent Practices</h3>
                                <p className="text-gray-600">
                                    You shouldn't need a hospital budget to get a modern EMR. Our pricing is
                                    transparent, predictable, and designed for practices of all sizes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6 bg-blue-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Ready to Experience the Difference?
                    </h2>
                    <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                        Join physicians who are taking back their time with an EMR that works the way they do.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                            Start Free Trial
                        </button>
                        <Link to="/contact" className="px-8 py-4 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400 transition-colors flex items-center gap-2">
                            Talk to Us
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-gray-900">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="PageMD" className="h-8 w-auto brightness-0 invert" />
                    </div>
                    <div className="text-sm text-gray-500">© {currentYear} PageMD. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );
};

export default AboutPage;
