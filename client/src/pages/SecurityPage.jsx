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
import LandingNav from '../components/LandingNav';

const SecurityPage = () => {
    const currentYear = new Date().getFullYear();

    React.useEffect(() => {
        document.title = "Security & Compliance | HIPAA Elite | PageMD";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "Enterprise-grade security meets clinical intuition. Learn how PageMD protects your PHI with HIPAA-Elite compliance and ironclad encryption.");
    }, []);

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            {/* Premium Hero */}
            <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 px-6 bg-white overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-8 border border-sky-100/40">
                        <Shield className="w-3.5 h-3.5" />
                        Patient Trust
                    </div>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                        Security at the <br />
                        <span className="text-sky-500">clinical layer.</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed">
                        Your patients trust you with their most sensitive data. We built PageMD with ironclad defense and HIPAA-Elite compliance at every layer.
                    </p>
                </div>
            </section>

            {/* Compliance Badges - Softened */}
            <section className="py-12 px-6 bg-slate-50/50 border-y border-slate-100">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: "HIPAA", sub: "Compliant" },
                            { label: "SOC 2", sub: "Type II" },
                            { label: "HITECH", sub: "Compliant" },
                            { label: "99.9%", sub: "Uptime SLA" }
                        ].map((badge, i) => (
                            <div key={i} className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
                                <div className="text-xl font-bold text-slate-800 mb-0.5">{badge.label}</div>
                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{badge.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security Features - Zen Grid */}
            <section className="py-24 lg:py-32 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-800 mb-4 tracking-tight">Enterprise Defense</h2>
                        <p className="text-sm text-slate-500 font-normal">Security built into every clinical interaction.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                        {[
                            { icon: Lock, title: "Encryption at Rest", desc: "All patient data is encrypted using AES-256. Your data is protected even at the physical storage level.", accent: "sky" },
                            { icon: Globe, title: "Encryption in Transit", desc: "TLS 1.3 encryption protects all data between your browser and our servers. No data travels unprotected.", accent: "blue" },
                            { icon: UserCheck, title: "Role-Based Access", desc: "Fine-grained permissions ensure every user only accesses what they need for clinical or billing flow.", accent: "sky" },
                            { icon: Activity, title: "Immutable Audit Logs", desc: "Every action is logged with cryptographic hashing. Audit trails cannot be altered or deleted.", accent: "blue" },
                            { icon: Building2, title: "Multi-Tenant Isolation", desc: "Each practice has completely isolated data at the database level. No risk of data leakage.", accent: "sky" },
                            { icon: Key, title: "2FA Protection", desc: "Optional two-factor authentication adds an extra layer of protection via authenticator apps.", accent: "blue" }
                        ].map((feature, i) => (
                            <div key={i} className="group">
                                <div className={`w-11 h-11 rounded-xl bg-${feature.accent}-50 text-${feature.accent}-500 flex items-center justify-center mb-6 border border-${feature.accent}-100/40 transition-transform group-hover:scale-105 shadow-sm`}>
                                    <feature.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-semibold text-slate-800 mb-3">{feature.title}</h3>
                                <p className="text-[13px] text-slate-500 leading-relaxed font-normal">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Infrastructure - Premium Cards */}
            <section className="py-24 lg:py-32 px-6 bg-slate-50 border-t border-slate-100">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-semibold text-slate-800 text-center mb-16 tracking-tight">Trusted Infrastructure</h2>
                    <div className="space-y-6">
                        {[
                            { title: "Cloud Infrastructure", desc: "PageMD runs on enterprise-grade cloud clusters with geographic redundancy, ensuring 99.9% availability even during regional outages." },
                            { title: "Regular Security Audits", desc: "We conduct regular penetration testing and vulnerability assessments by third-party security firms to ensure absolute defense." },
                            { title: "Incident Response", desc: "Our security team monitors for threats 24/7 with documented procedures for containment and remediation." }
                        ].map((infra, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3">{infra.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed font-normal">{infra.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 lg:py-32 bg-white px-6 border-t border-slate-100">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-semibold text-slate-800 mb-10 leading-tight tracking-tight">Have <span className="text-sky-500">security</span> questions?</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 text-base flex items-center justify-center gap-3">
                            Talk to Security
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link to="/" className="px-10 py-5 bg-white hover:bg-slate-50 text-slate-800 font-medium rounded-xl border border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 text-base flex items-center justify-center">
                            Explore PageMD
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 font-black text-[10px] uppercase tracking-[0.4em] text-slate-400">
                    <Link to="/" className="flex items-center gap-3 grayscale opacity-40 hover:opacity-100 transition-opacity">
                        <img src="/logo.png" alt="PageMD" className="h-10" />
                    </Link>
                    <div className="flex flex-col items-center md:items-end gap-2">
                        <div className="flex gap-12">
                            <Link to="/privacy" className="hover:text-sky-500 transition-colors">Privacy</Link>
                            <Link to="/terms" className="hover:text-sky-500 transition-colors">Terms</Link>
                            <Link to="/security" className="hover:text-sky-500 transition-colors">Security</Link>
                        </div>
                        <div className="text-slate-200 mt-4">© {currentYear} PageMD Inc. All rights reserved.</div>
                        <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-widest mt-1">Made by a Physician, for Physicians</div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SecurityPage;
