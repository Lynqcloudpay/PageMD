import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    DollarSign,
    Clock,
    Users,
    HeartPulse,
    BarChart3,
    Pill,
    Stethoscope,
    ClipboardList,
    Send,
    FolderOpen,
    MessageSquare,
    ArrowRight
} from 'lucide-react';

const FeaturesPage = () => {
    const currentYear = new Date().getFullYear();

    const features = [
        {
            icon: FileText,
            color: 'blue',
            title: 'Clinical Charting',
            description: 'Structured notes with smart templates, ICD-10 search, and one-click documentation.',
            details: [
                'SOAP note templates customized by specialty',
                'Real-time ICD-10 and CPT code search',
                'Auto-populated patient history',
                'Voice-to-text documentation (coming soon)',
                'Custom macros and text shortcuts',
                'One-click attestation and signing'
            ]
        },
        {
            icon: DollarSign,
            color: 'emerald',
            title: 'Billing & Superbills',
            description: 'Automatic superbill generation with diagnosis validation and compliance checks.',
            details: [
                'Auto-generated superbills from visit notes',
                'Diagnosis-to-procedure validation',
                'Fee schedule management',
                'Modifier and unit tracking',
                'CMS-1500 and 837P export',
                'Denial prevention alerts'
            ]
        },
        {
            icon: Clock,
            color: 'purple',
            title: 'Smart Scheduling',
            description: 'Color-coded calendar with appointment types and real-time status updates.',
            details: [
                'Drag-and-drop appointment management',
                'Multiple provider calendars',
                'Appointment type color coding',
                'Real-time status tracking (arrived, roomed, etc.)',
                'Recurring appointment support',
                'Wait time analytics'
            ]
        },
        {
            icon: Users,
            color: 'amber',
            title: 'Patient Management',
            description: 'Complete patient records with demographics, insurance, and medical history.',
            details: [
                'Comprehensive demographic capture',
                'Insurance eligibility verification',
                'Problem list and chronic condition tracking',
                'Medication reconciliation',
                'Allergy documentation with alerts',
                'Family and social history'
            ]
        },
        {
            icon: HeartPulse,
            color: 'rose',
            title: 'Orders & Results',
            description: 'Order labs, imaging, and referrals directly from the chart.',
            details: [
                'Lab order entry with diagnosis linking',
                'Imaging and radiology orders',
                'Specialist referral workflows',
                'Result notification system',
                'Abnormal result flagging',
                'HL7 lab integrations'
            ]
        },
        {
            icon: Pill,
            color: 'teal',
            title: 'E-Prescribing',
            description: 'EPCS-certified electronic prescribing with pharmacy integration.',
            details: [
                'EPCS-certified for controlled substances',
                'Drug interaction checking',
                'Formulary and coverage lookup',
                'Pharmacy network search',
                'Prescription renewal workflows',
                'Medication history import'
            ]
        },
        {
            icon: BarChart3,
            color: 'indigo',
            title: 'Analytics Dashboard',
            description: 'Real-time insights into patient volume, revenue, and quality measures.',
            details: [
                'Patient volume trending',
                'Revenue cycle analytics',
                'Quality measure tracking',
                'Provider productivity metrics',
                'Appointment utilization reports',
                'Custom report builder'
            ]
        },
        {
            icon: ClipboardList,
            color: 'orange',
            title: 'Task Management',
            description: 'In-basket workflow for results, messages, and follow-up tasks.',
            details: [
                'Centralized in-basket view',
                'Task assignment and delegation',
                'Priority and due date tracking',
                'Result review workflows',
                'Patient callback lists',
                'Staff messaging'
            ]
        },
        {
            icon: FolderOpen,
            color: 'cyan',
            title: 'Document Management',
            description: 'Upload, organize, and attach documents to patient records.',
            details: [
                'PDF and image upload',
                'Document categorization',
                'OCR text extraction',
                'Fax integration',
                'Outside record import',
                'Document versioning'
            ]
        }
    ];

    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        purple: 'bg-purple-100 text-purple-600',
        amber: 'bg-amber-100 text-amber-600',
        rose: 'bg-rose-100 text-rose-600',
        teal: 'bg-teal-100 text-teal-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        orange: 'bg-orange-100 text-orange-600',
        cyan: 'bg-cyan-100 text-cyan-600'
    };

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
                            <Link to="/features" className="text-sm font-medium text-blue-600">Features</Link>
                            <Link to="/security" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Security</Link>
                            <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
                        </div>
                        <Link to="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-28 pb-16 px-6 bg-gradient-to-b from-gray-50 to-white">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                        Every Feature Your Practice Needs
                    </h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        PageMD combines clinical charting, billing, scheduling, and practice management
                        into one intuitive platform designed for how physicians actually work.
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-16 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="space-y-16">
                        {features.map((feature, index) => (
                            <div key={index} className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                                    <div className={`w-14 h-14 rounded-xl ${colorClasses[feature.color]} flex items-center justify-center mb-6`}>
                                        <feature.icon className="w-7 h-7" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h2>
                                    <p className="text-gray-600 text-lg mb-6">{feature.description}</p>
                                    <ul className="space-y-3">
                                        {feature.details.map((detail, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-600">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                                {detail}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className={`bg-gray-50 rounded-2xl p-8 h-64 flex items-center justify-center ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                                    <feature.icon className={`w-24 h-24 ${colorClasses[feature.color].split(' ')[1]} opacity-20`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-6 bg-blue-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        See PageMD in Action
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Start your free 30-day trial today. No credit card required.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button className="px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                            Start Free Trial
                        </button>
                        <Link to="/pricing" className="px-8 py-4 bg-blue-500 text-white font-medium rounded-lg border border-blue-400 hover:bg-blue-400 transition-colors flex items-center gap-2">
                            View Pricing
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

export default FeaturesPage;
