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
    Check
} from 'lucide-react';

const FeaturesPage = () => {
    const currentYear = new Date().getFullYear();

    const features = [
        {
            icon: FileText,
            color: 'blue',
            title: 'Clinical Charting',
            description: 'Efficient documentation with structured SOAP notes and specific templates.',
            details: [
                'Specialty-specific chart templates',
                'ICD-10 diagnosis search',
                'One-click note signing',
                'Auto-saved drafts'
            ],
            // Visual: Simplified Note UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="flex gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50"></div>
                        <div className="space-y-1">
                            <div className="h-2 w-20 bg-gray-100 rounded"></div>
                            <div className="h-1.5 w-12 bg-gray-50 rounded"></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-2 w-full bg-gray-50 rounded"></div>
                        <div className="h-2 w-5/6 bg-gray-50 rounded"></div>
                        <div className="h-2 w-4/6 bg-gray-50 rounded"></div>
                    </div>
                    <div className="pt-2 flex gap-2">
                        <div className="h-6 w-16 bg-blue-50 rounded"></div>
                        <div className="h-6 w-16 bg-gray-50 rounded"></div>
                    </div>
                </div>
            )
        },
        {
            icon: DollarSign,
            color: 'emerald',
            title: 'Billing & Superbills',
            description: 'Streamlined billing workflow from visit to claim generation.',
            details: [
                'Automatic superbill creation',
                'CPT & diagnosis code management',
                'Fee schedule customization',
                'CMS-1500 form export'
            ],
            // Visual: Simplified Bill UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg">
                        <div className="h-2 w-16 bg-emerald-100 rounded"></div>
                        <div className="h-2 w-12 bg-emerald-200 rounded"></div>
                    </div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between items-center text-xs px-1">
                            <div className="h-1.5 w-24 bg-gray-100 rounded"></div>
                            <div className="h-1.5 w-8 bg-gray-100 rounded"></div>
                        </div>
                    ))}
                    <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                        <div className="h-2 w-10 bg-gray-200 rounded"></div>
                        <div className="h-2 w-12 bg-gray-800 rounded"></div>
                    </div>
                </div>
            )
        },
        {
            icon: Clock,
            color: 'purple',
            title: 'Scheduling',
            description: 'Manage appointments with a clean, color-coded calendar interface.',
            details: [
                'Drag-and-drop appointments',
                'Multi-provider views',
                'Custom appointment types',
                'Waitlist management'
            ],
            // Visual: Simplified Calendar UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-3 grid grid-cols-3 gap-2 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="col-span-1 border-r border-gray-100 pr-2 space-y-2">
                        <div className="h-1.5 w-8 bg-gray-200 rounded"></div>
                        <div className="h-1.5 w-8 bg-gray-100 rounded"></div>
                        <div className="h-1.5 w-8 bg-gray-100 rounded"></div>
                    </div>
                    <div className="col-span-2 space-y-2 pt-1">
                        <div className="bg-purple-50 p-1.5 rounded border-l-2 border-purple-400">
                            <div className="h-1.5 w-12 bg-purple-200 rounded"></div>
                        </div>
                        <div className="bg-blue-50 p-1.5 rounded border-l-2 border-blue-400">
                            <div className="h-1.5 w-16 bg-blue-200 rounded"></div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            icon: Users,
            color: 'amber',
            title: 'Patient Management',
            description: 'Centralized patient records with easy access to history and demographics.',
            details: [
                'Demographics & contact info',
                'Insurance policy tracking',
                'Medical history & problems list',
                'Medication & allergy logs'
            ],
            // Visual: Simplified Profile UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex-shrink-0"></div>
                        <div className="space-y-1.5 w-full">
                            <div className="h-2.5 w-32 bg-gray-100 rounded"></div>
                            <div className="h-1.5 w-20 bg-gray-50 rounded"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="h-8 bg-gray-50 rounded-lg"></div>
                        <div className="h-8 bg-gray-50 rounded-lg"></div>
                    </div>
                </div>
            )
        },
        {
            icon: Pill,
            color: 'teal',
            title: 'Medications & Prescribing',
            description: 'Manage patient medications and generate prescriptions effeciently.',
            details: [
                'Medication history tracking',
                'Prescription generation',
                'Pharmacy database',
                'Refill management'
            ],
            // Visual: Simplified Meds UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                            <div className="w-4 h-4 bg-teal-200 rounded-full"></div>
                        </div>
                        <div className="space-y-1">
                            <div className="h-2 w-24 bg-gray-100 rounded"></div>
                            <div className="h-1.5 w-16 bg-gray-50 rounded"></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="bg-gray-50 p-2 rounded flex justify-between">
                            <div className="h-1.5 w-20 bg-gray-200 rounded"></div>
                            <div className="h-1.5 w-4 bg-gray-300 rounded"></div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded flex justify-between">
                            <div className="h-1.5 w-16 bg-gray-200 rounded"></div>
                            <div className="h-1.5 w-4 bg-gray-300 rounded"></div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            icon: FolderOpen,
            color: 'cyan',
            title: 'Documents & Uploads',
            description: 'Store and organize external patient records and files safely.',
            details: [
                'PDF & image uploads',
                'Document categorization',
                'Secure storage',
                'Patient-assigned files'
            ],
            // Visual: Simplified Files UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="aspect-[4/3] bg-gray-50 rounded-lg flex flex-col justify-center items-center gap-1.5">
                                <div className="w-6 h-4 bg-gray-200 rounded-sm"></div>
                                <div className="w-8 h-1 bg-gray-200 rounded-full"></div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            icon: ClipboardList,
            color: 'orange',
            title: 'Task In-Basket',
            description: 'Keep track of staff messages, results, and follow-up items.',
            details: [
                'Task assignment',
                'Priority tracking',
                'Completed task history',
                'Staff communication'
            ],
            // Visual: Simplified List UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-3 items-center">
                            <div className={`w-4 h-4 rounded border ${i === 1 ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}></div>
                            <div className="space-y-1.5 flex-1">
                                <div className="h-1.5 w-3/4 bg-gray-100 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
        {
            icon: HeartPulse,
            color: 'rose',
            title: 'Orders & Results',
            description: 'Track patient orders and incoming results efficiently.',
            details: [
                'Lab & imaging orders',
                'Result tracking',
                'Manual result entry'
            ],
            // Visual: Simplified Status UI
            renderVisual: () => (
                <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                        <div className="h-1.5 w-20 bg-gray-100 rounded"></div>
                        <div className="h-1.5 w-2 bg-rose-400 rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                        <div className="h-1.5 w-16 bg-gray-100 rounded"></div>
                        <div className="h-1.5 w-2 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="h-1.5 w-24 bg-gray-100 rounded"></div>
                        <div className="h-1.5 w-2 bg-gray-300 rounded-full"></div>
                    </div>
                </div>
            )
        }
    ];

    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        purple: 'bg-purple-100 text-purple-600',
        amber: 'bg-amber-100 text-amber-600',
        rose: 'bg-rose-100 text-rose-600',
        teal: 'bg-teal-100 text-teal-600',
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
                            <Link to="/about" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">About</Link>
                            <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Contact</Link>
                        </div>
                        <Link to="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-16 px-6 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                        Core Features
                    </h1>
                    <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
                        Simple, powerful tools built for the modern independent practice.
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-x-12 gap-y-20">
                        {features.map((feature, index) => (
                            <div key={index} className="flex flex-col md:flex-row gap-6 items-start">
                                {/* Visual Side */}
                                <div className="flex-shrink-0 bg-gray-50 rounded-2xl p-6 flex items-center justify-center w-full md:w-auto self-stretch md:self-start">
                                    {feature.renderVisual()}
                                </div>

                                {/* Content Side */}
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`p-2 rounded-lg ${colorClasses[feature.color]}`}>
                                            <feature.icon className="w-5 h-5" />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900">{feature.title}</h2>
                                    </div>
                                    <p className="text-gray-600 mb-4 leading-relaxed">{feature.description}</p>
                                    <ul className="space-y-2">
                                        {feature.details.map((detail, i) => (
                                            <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                                {detail}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6 bg-gray-50 border-t border-gray-100">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">
                        Ready to get started?
                    </h2>
                    <p className="text-lg text-gray-500 mb-8">
                        Join PageMD today and experience a simplified EMR workflow.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link to="/contact" className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                            Contact Sales
                        </Link>
                        <Link to="/pricing" className="px-8 py-3 bg-white text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            View Pricing
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-white border-t border-gray-100">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="PageMD" className="h-7 w-auto grayscale opacity-50" />
                    </div>
                    <div className="text-sm text-gray-400">© {currentYear} PageMD. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );
};

export default FeaturesPage;
