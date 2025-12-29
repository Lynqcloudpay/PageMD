import React from 'react';
import { Link } from 'react-router-dom';
import {
    Shield,
    Lock,
    Eye,
    Server,
    Key,
    FileCheck,
    Building2,
    Activity,
    UserCheck,
    Database,
    Globe,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';

const SecurityPage = () => {
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
                            <Link to="/security" className="text-sm font-medium text-blue-600">Security</Link>
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
            <section className="pt-28 pb-16 px-6 bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-8">
                        <Shield className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                        Enterprise-Grade Security
                    </h1>
                    <p className="text-xl text-gray-300 leading-relaxed">
                        Your patients trust you with their most sensitive information.
                        We built PageMD with security and compliance at every layer.
                    </p>
                </div>
            </section>

            {/* Compliance Badges */}
            <section className="py-12 px-6 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                            <div className="text-2xl font-bold text-gray-900 mb-1">HIPAA</div>
                            <div className="text-sm text-gray-500">Compliant</div>
                        </div>
                        <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                            <div className="text-2xl font-bold text-gray-900 mb-1">SOC 2</div>
                            <div className="text-sm text-gray-500">Type II</div>
                        </div>
                        <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                            <div className="text-2xl font-bold text-gray-900 mb-1">HITECH</div>
                            <div className="text-sm text-gray-500">Compliant</div>
                        </div>
                        <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                            <div className="text-2xl font-bold text-gray-900 mb-1">99.9%</div>
                            <div className="text-sm text-gray-500">Uptime SLA</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Features */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">
                        Security Built Into Every Layer
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                                <Lock className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Encryption at Rest</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                All patient data is encrypted using AES-256 encryption. Your data is protected
                                even if physical storage is compromised.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                                <Globe className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Encryption in Transit</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                TLS 1.3 encryption protects all data transmitted between your browser and our servers.
                                No data travels unprotected.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                                <UserCheck className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Role-Based Access Control</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Fine-grained permissions ensure every user only accesses what they need.
                                Physicians, staff, and billing each have appropriate access levels.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                                <Activity className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Immutable Audit Logs</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Every action is logged with cryptographic hashing. Audit trails cannot be altered
                                or deleted, ensuring complete accountability.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center mb-4">
                                <Building2 className="w-6 h-6 text-rose-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Tenant Isolation</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Each practice has completely isolated data at the database level.
                                No risk of data leakage between practices.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                                <Key className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Two-Factor Authentication</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Optional 2FA adds an extra layer of protection. Support for authenticator apps
                                and SMS verification.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center mb-4">
                                <Database className="w-6 h-6 text-cyan-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Automated Backups</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Continuous backups with point-in-time recovery. Your data is replicated
                                across multiple availability zones.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center mb-4">
                                <Eye className="w-6 h-6 text-teal-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Security</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Automatic session timeout, concurrent session limits, and suspicious activity
                                detection protect against unauthorized access.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                                <FileCheck className="w-6 h-6 text-orange-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">BAA Available</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Business Associate Agreement included with all plans. We take responsibility
                                for protecting your patients' PHI.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Infrastructure */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                        Infrastructure You Can Trust
                    </h2>
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cloud Infrastructure</h3>
                            <p className="text-gray-600">
                                PageMD runs on enterprise-grade cloud infrastructure with SOC 2 and ISO 27001
                                certified data centers. Geographic redundancy ensures availability even during
                                regional outages.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Regular Security Audits</h3>
                            <p className="text-gray-600">
                                We conduct regular penetration testing and vulnerability assessments by
                                third-party security firms. Findings are remediated promptly and transparently.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Incident Response</h3>
                            <p className="text-gray-600">
                                Our security team monitors for threats 24/7. In the event of a security incident,
                                we have documented procedures for containment, notification, and remediation.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-6 bg-gray-900">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Have Security Questions?
                    </h2>
                    <p className="text-xl text-gray-400 mb-8">
                        Our team is happy to discuss our security practices and provide documentation for your compliance needs.
                    </p>
                    <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors">
                        Contact Security Team
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-gray-900 border-t border-gray-800">
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

export default SecurityPage;
