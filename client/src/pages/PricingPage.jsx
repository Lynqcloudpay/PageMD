import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Shield, Zap, TrendingDown, DollarSign, Calculator } from 'lucide-react';
import LandingNav from '../components/LandingNav';

const TIERS = [
    { name: 'Solo', min: 1, max: 1, rate: 399, label: '1 Provider' },
    { name: 'Partner', min: 2, max: 3, rate: 299, label: '2 – 3 Providers' },
    { name: 'Professional', min: 4, max: 5, rate: 249, label: '4 – 5 Providers' },
    { name: 'Premier', min: 6, max: 8, rate: 199, label: '6 – 8 Providers' },
    { name: 'Elite', min: 9, max: 10, rate: 149, label: '9 – 10 Providers' },
    { name: 'Enterprise', min: 11, max: 50, rate: 99, label: '11+ Providers' },
];

const FEATURES = [
    "Full EMR",
    "Practice Manager",
    "ePrescribe",
    "1 Lab Hub Connection",
    "HIPAA-Compliant Telehealth",
    "Full Billing Suite"
];

const TECHNICAL_HIGHLIGHTS = [
    {
        title: "Smart ePrescribing",
        description: "Full integration for NewRx, refills, and cancellations with automated safety checks.",
        icon: Zap
    },
    {
        title: "Financial Clarity",
        description: "Real-time visibility into patient formulary and out-of-pocket costs.",
        icon: DollarSign
    },
    {
        title: "Clinical Intelligence",
        description: "Built-in weight-based dosing, ICD/CDT coding, and electronic Prior Authorizations.",
        icon: Shield
    },
    {
        title: "Adherence Tools",
        description: "Integrated patient savings opportunities and alternative pharmacy routing.",
        icon: TrendingDown
    }
];

const PricingPage = () => {
    const navigate = useNavigate();
    const [seats, setSeats] = useState(1);
    const currentYear = new Date().getFullYear();

    const currentTier = useMemo(() => {
        return TIERS.find(t => seats >= t.min && seats <= t.max) || TIERS[TIERS.length - 1];
    }, [seats]);

    const calculateTotal = (numSeats) => {
        let total = 0;
        for (let i = 1; i <= numSeats; i++) {
            const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
            total += tier.rate;
        }
        return total;
    };

    const totalMonthly = useMemo(() => calculateTotal(seats), [seats]);
    const avgCostPerSeat = useMemo(() => Math.round(totalMonthly / seats), [totalMonthly, seats]);

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-blue-100">
            <LandingNav />

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-50">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl -ml-20 -mb-20"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in">
                        <Zap className="w-3.5 h-3.5" />
                        Introducing The Growth Engine
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-8">
                        $0 Implementation. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 uppercase">Zero Barriers</span>
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
                        Most EMRs penalize your growth with flat-rate fees. <span className="font-bold text-gray-900">PageMD rewards it.</span>
                        As your practice expands, your average cost per doctor drops automatically.
                    </p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-black text-blue-600 bg-blue-50 border border-blue-100 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                            Month-to-month
                        </div>
                        <div className="flex items-center gap-2 text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                            No Contracts
                        </div>
                    </div>
                </div>
            </section>

            {/* Savings Slider Section */}
            <section className="pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-blue-100 border border-blue-50 overflow-hidden lg:flex items-stretch">
                        <div className="lg:w-1/2 p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-100">
                            <div className="flex items-center gap-3 mb-8">
                                <Calculator className="w-6 h-6 text-blue-600" />
                                <h2 className="text-xl font-bold">Calculate Your Savings</h2>
                            </div>

                            <div className="mb-12">
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Number of Providers</label>
                                    <span className="text-3xl font-black text-blue-600">{seats}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={seats}
                                    onChange={(e) => setSeats(parseInt(e.target.value))}
                                    className="w-full h-3 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between mt-4 text-xs font-bold text-gray-400">
                                    <span>1 PROVIDER</span>
                                    <span>20+ PROVIDERS</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Current Tier</p>
                                    <p className="text-base font-bold text-gray-900">{currentTier.name}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Avg. / Seat</p>
                                    <p className="text-xl font-black text-blue-700">${avgCostPerSeat}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100 flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-blue-100 uppercase mb-1">Total Monthly</p>
                                    <p className="text-xl font-black">${totalMonthly.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 lg:p-12 flex flex-col justify-center">
                            <div className="mb-8">
                                <h3 className="text-lg font-bold mb-4">The Volume Reward</h3>
                                <div className="space-y-4">
                                    {TIERS.slice(0, 6).map((tier, idx) => {
                                        const isCurrent = currentTier.name === tier.name;
                                        const percentage = (tier.rate / TIERS[0].rate) * 100;
                                        return (
                                            <div key={idx} className={`relative transition-all duration-500 ${isCurrent ? 'scale-105 z-10' : 'opacity-60 scale-95'}`}>
                                                <div className="flex justify-between items-center mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                    <span>{tier.name}</span>
                                                    <span>${tier.rate}/mo</span>
                                                </div>
                                                <div className="h-4 bg-white rounded-full overflow-hidden border border-gray-100 shadow-sm">
                                                    <div
                                                        className={`h-full transition-all duration-1000 ease-out rounded-full ${isCurrent ? 'bg-gradient-to-r from-blue-400 to-indigo-500 shadow-md shadow-blue-200' : 'bg-gray-200'}`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Table Section */}
            <section className="py-24 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl font-bold mb-4">Transparent Tiers</h2>
                        <p className="text-sm text-gray-600">PageMD's declining rate structure</p>
                    </div>

                    <div className="overflow-x-auto rounded-[2rem] border border-gray-200 shadow-xl bg-white overflow-hidden">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black">
                                    <th className="px-8 py-5 uppercase tracking-wider text-[11px]">Tier</th>
                                    <th className="px-8 py-5 uppercase tracking-wider text-[11px] text-center border-x border-white/10">Practice Size</th>
                                    <th className="px-8 py-5 uppercase tracking-wider text-[11px] text-center">Per-Seat/mo</th>
                                    <th className="px-8 py-5 uppercase tracking-wider text-[11px] text-center border-l border-white/10">Avg Cost / Doctor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {TIERS.map((tier, idx) => (
                                    <tr key={idx} className="group hover:bg-blue-50/50 transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${idx % 2 === 0 ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {tier.name[0]}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 block text-base">{tier.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Plan Level {idx + 1}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center text-gray-600 font-semibold text-sm">
                                            {tier.label}
                                        </td>
                                        <td className="px-8 py-6 text-center border-x border-gray-50/50">
                                            <span className="text-lg font-black text-gray-900">${tier.rate}</span>
                                            <span className="text-xs text-gray-400 font-bold ml-1">/mo</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-black shadow-sm ring-1 ring-emerald-100/50">
                                                <TrendingDown className="w-4 h-4" />
                                                {idx === 0 ? '$399' : idx === 1 ? '~$332' : idx === 2 ? '~$299' : idx === 3 ? '~$261' : idx === 4 ? '~$239' : '<$169'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-12 p-8 rounded-[2rem] bg-blue-50 border border-blue-100 lg:flex items-center justify-between">
                        <div className="mb-6 lg:mb-0">
                            <h3 className="text-base font-bold text-blue-900 mb-2">Everything you need, included in every tier:</h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {FEATURES.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-blue-800 font-bold">
                                        <Check className="w-4 h-4 text-blue-600" />
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/contact')}
                            className="w-full lg:w-auto px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2"
                        >
                            Get Started
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Fees Section */}
            <section className="py-24 px-6 border-b border-gray-100 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-block p-12 rounded-[4rem] bg-indigo-50 relative border border-indigo-100 shadow-xl shadow-indigo-50/50">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-white shadow-2xl flex items-center justify-center border border-indigo-50">
                            <Shield className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-indigo-900 mb-4 uppercase tracking-widest">Onboarding & Compliance</h2>
                        <p className="text-4xl font-black text-indigo-900 mb-6">$25.00</p>
                        <p className="text-base font-bold text-indigo-800 mb-2">Provider Credentialing Fee (One-time, per new prescriber)</p>
                        <p className="text-sm text-gray-500 bg-white/50 backdrop-blur-sm p-4 rounded-2xl italic border border-indigo-100 mt-6">
                            "Includes secure identity verification required for Surescripts and DEA compliance."
                        </p>
                    </div>
                </div>
            </section>

            {/* Technical Highlights Section */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16 underline decoration-blue-500 decoration-4 underline-offset-8">
                        <h2 className="text-3xl font-black tracking-tight">Modern Clinical Infrastructure</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {TECHNICAL_HIGHLIGHTS.map((h, i) => (
                            <div key={i} className="group p-8 rounded-[2rem] bg-white border border-gray-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-50/50 transition-all duration-300">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                    <h.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold mb-3">{h.title}</h3>
                                <p className="text-xs text-gray-600 leading-relaxed">{h.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]"></div>
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl lg:text-5xl font-black text-white mb-8 tracking-tight">
                        Ready to Transform Your Practice?
                    </h2>
                    <p className="text-lg text-blue-100 mb-12 font-medium">
                        Join the next generation of clinics choosing growth over penalty.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-10 py-5 bg-white text-blue-600 font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            Request Demo
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-10 py-5 bg-blue-800/30 backdrop-blur-md text-white border border-white/20 font-black rounded-2xl hover:bg-blue-800/40 transition-all"
                        >
                            Talk to Sales
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <img src="/logo.png" alt="PageMD" className="h-8 w-auto grayscale opacity-50 transition-all hover:grayscale-0 hover:opacity-100" />
                    <div className="flex gap-8">
                        <Link to="/about" className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest">About</Link>
                        <Link to="/contact" className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest">Contact</Link>
                        <Link to="/security" className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest">Security</Link>
                    </div>
                    <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">© {currentYear} PageMD. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );
};

export default PricingPage;
