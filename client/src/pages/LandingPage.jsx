import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    DollarSign,
    Shield,
    Users,
    ArrowRight,
    Check,
    Star,
    Clock,
    Activity,
    Lock,
    Stethoscope,
    ChevronRight,
    Phone
} from 'lucide-react';

const LandingPage = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white font-sans overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="PageMD Logo" className="h-10 w-auto object-contain" />
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/features" className="text-sm font-medium text-gray-600 hover:text-blue-600">Software</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600">Pricing</Link>
                            <Link to="/about" className="text-sm font-medium text-gray-600 hover:text-blue-600">About</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600">Contact</Link>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link to="/login" className="px-5 py-2.5 text-gray-700 text-sm font-semibold hover:text-blue-600">Sign In</Link>
                            <Link to="/contact" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-200">Get Demo</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-24 pb-0 bg-gradient-to-b from-slate-50 to-white">
                <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-xs font-bold tracking-wide uppercase mb-6">
                            <Stethoscope className="w-3.5 h-3.5" />
                            Made by a Physician, for Physicians
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                            The EMR That Actually Works for You
                        </h1>

                        <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
                            Built by a practicing physician who was frustrated with existing EMRs. PageMD puts clinical workflow first — so you can focus on patients, not paperwork.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link to="/contact" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-2">
                                Schedule a Demo
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link to="/features" className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-lg border-2 border-gray-200 flex items-center justify-center gap-2">
                                Explore Software
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid - Static */}
            <section className="py-16 bg-white border-t border-gray-100 px-6">
                <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Electronic Health Records</h3>
                        <p className="text-sm text-gray-600 mb-4">Intuitive charting with custom templates and mobile access.</p>
                        <Link to="/features" className="flex items-center text-blue-600 text-sm font-semibold">Learn More <ChevronRight className="w-4 h-4 ml-1" /></Link>
                    </div>

                    <div className="p-6 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition-all">
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">E-Prescribing</h3>
                        <p className="text-sm text-gray-600 mb-4">Secure prescribing with drug interaction checks and pharmacy integration.</p>
                        <Link to="/features" className="flex items-center text-blue-600 text-sm font-semibold">Learn More <ChevronRight className="w-4 h-4 ml-1" /></Link>
                    </div>

                    <div className="p-6 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all">
                        <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                            <Clock className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Practice Management</h3>
                        <p className="text-sm text-gray-600 mb-4">Scheduling and workflow automation for efficient operations.</p>
                        <Link to="/features" className="flex items-center text-blue-600 text-sm font-semibold">Learn More <ChevronRight className="w-4 h-4 ml-1" /></Link>
                    </div>

                    <div className="p-6 bg-white rounded-xl border border-gray-200 hover:border-orange-300 transition-all">
                        <div className="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Billing & RCM</h3>
                        <p className="text-sm text-gray-600 mb-4">Intelligent claim scrubbing and real-time eligibility checks.</p>
                        <Link to="/features" className="flex items-center text-blue-600 text-sm font-semibold">Learn More <ChevronRight className="w-4 h-4 ml-1" /></Link>
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
