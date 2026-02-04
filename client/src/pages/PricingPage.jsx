import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Shield, Zap, TrendingDown, DollarSign, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [isAnimating, setIsAnimating] = useState(false);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 300);
        return () => clearTimeout(timer);
    }, [seats]);

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

    const incrementSeats = () => setSeats(prev => Math.min(prev + 1, 11));
    const decrementSeats = () => setSeats(prev => Math.max(prev - 1, 1));

    return (
        <div className="min-h-screen bg-white font-inter text-gray-900 selection:bg-blue-100">
            <LandingNav />

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-50">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl -ml-20 -mb-20"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-sm">
                        <Zap className="w-3 h-3" />
                        The Growth Engine
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black tracking-tight mb-8">
                        $0 Implementation. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 uppercase tracking-wider">Zero Barriers</span>
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
                        Most EMRs penalize your growth with flat-rate fees. <span className="font-bold text-gray-900">PageMD rewards it.</span><br />
                        As your practice expands, your average cost per doctor drops automatically.
                    </p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm transition-transform hover:scale-105">
                            <Check className="w-3.5 h-3.5" />
                            Month-to-month
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm transition-transform hover:scale-105">
                            <Check className="w-3.5 h-3.5" />
                            No Contracts
                        </div>
                    </div>
                </div>
            </section>

            {/* Savings Slider Section */}
            <section className="pb-24 px-6 overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-blue-50 overflow-hidden lg:flex items-stretch transition-all">
                        <div className="lg:w-1/2 p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-gray-100 relative bg-white">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100">
                                        <Calculator className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold">Interactive Cost Explorer</h2>
                                </div>
                            </div>

                            <div className="mb-10">
                                <div className="flex justify-between items-center mb-6">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Practice Size</label>
                                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                        <button
                                            onClick={decrementSeats}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white hover:text-blue-600 transition-all active:scale-95 disabled:opacity-20"
                                            disabled={seats <= 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="px-3 py-1 flex items-baseline gap-1 min-w-[60px] justify-center">
                                            <span className={`text-2xl font-black tabular-nums transition-transform ${isAnimating ? 'scale-110 text-blue-600' : 'text-gray-900'}`}>
                                                {seats === 11 ? '11' : seats}{seats === 11 && '+'}
                                            </span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase">MD</span>
                                        </div>
                                        <button
                                            onClick={incrementSeats}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white hover:text-blue-600 transition-all active:scale-95 disabled:opacity-20"
                                            disabled={seats >= 11}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min="1"
                                    max="11"
                                    value={seats}
                                    onChange={(e) => setSeats(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between mt-4 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">
                                    <span>Solo</span>
                                    <span>Scale</span>
                                    <span>Enterprise</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Tier</p>
                                        <p className="text-base font-bold text-gray-900">{currentTier.name}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-100 transition-transform active:scale-[0.98]">
                                        <p className="text-[9px] font-bold text-blue-100 uppercase tracking-widest mb-1">Avg. Monthly / Doctor</p>
                                        <p className={`text-2xl font-black tabular-nums transition-transform ${isAnimating ? 'scale-105' : ''}`}>${avgCostPerSeat}</p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                                            <TrendingDown className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Staircase Calculation</h3>
                                    </div>
                                    {seats === 1 ? (
                                        <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed italic">Add providers to see the discounted breakdown.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                                                <span className="font-mono text-[10px] text-indigo-600/70">(1 × $399) + ({seats - 1} × ${currentTier.rate})</span>
                                                <span className="text-lg font-black tabular-nums">${totalMonthly.toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-indigo-100/50 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${(avgCostPerSeat / 399) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 bg-gray-50/50 p-8 lg:p-14 flex flex-col justify-center border-l border-gray-100">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-10">The Reward Curve</h3>
                            <div className="space-y-6">
                                {TIERS.slice(0, 6).map((tier, idx) => {
                                    const isCurrent = currentTier.name === tier.name;
                                    const percentage = (tier.rate / TIERS[0].rate) * 100;
                                    return (
                                        <div key={idx} className={`relative transition-all duration-500 ${isCurrent ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                                            <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                <span>{tier.name}</span>
                                                <span className={isCurrent ? 'text-blue-600' : ''}>${tier.rate}/MO</span>
                                            </div>
                                            <div className="h-3 bg-white rounded-full overflow-hidden border border-gray-100 shadow-sm">
                                                <div
                                                    className={`h-full transition-all duration-1000 ease-out rounded-full ${isCurrent ? 'bg-gradient-to-r from-blue-400 to-indigo-500' : 'bg-gray-200'}`}
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
            </section>

            {/* Pricing Table Section */}
            <section className="py-24 px-6 bg-gray-50/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Transparent Growth Model</h2>
                        <p className="text-xs text-gray-500 font-medium">As you grow, your licensing cost per seat automatically drops.</p>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-100/30 border border-gray-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-white">
                                    <th className="px-6 py-4 uppercase tracking-[0.2em] text-[10px] font-black text-gray-400">Tier Name</th>
                                    <th className="px-6 py-4 uppercase tracking-[0.2em] text-[10px] font-black text-gray-400 text-center">Practice Size</th>
                                    <th className="px-6 py-4 uppercase tracking-[0.2em] text-[10px] font-black text-gray-400 text-center">Standard Rate</th>
                                    <th className="px-6 py-4 uppercase tracking-[0.2em] text-[10px] font-black text-blue-500 text-center bg-blue-50/30">Avg. Monthly / Doctor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {TIERS.map((tier, idx) => {
                                    const isCurrent = currentTier.name === tier.name;
                                    return (
                                        <tr
                                            key={idx}
                                            className={`transition-all duration-500 ${isCurrent ? 'bg-blue-50/40 relative z-10' : 'hover:bg-gray-50/50'}`}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isCurrent ? 'bg-blue-600 animate-pulse' : 'bg-transparent'}`} />
                                                    <div>
                                                        <span className={`text-base font-bold text-gray-900 tracking-tight uppercase ${isCurrent ? 'text-blue-700' : ''}`}>{tier.name}</span>
                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Level {idx + 1}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-colors ${isCurrent ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                                                    {tier.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-sm font-bold text-gray-400 line-through mr-1">${TIERS[0].rate}</span>
                                                <span className={`text-sm font-black transition-colors ${isCurrent ? 'text-gray-900 scale-110 inline-block' : 'text-gray-900'}`}>${tier.rate}</span>
                                                <span className="text-[9px] text-gray-400 font-bold ml-1">/mo</span>
                                            </td>
                                            <td className={`px-6 py-5 text-center transition-colors ${isCurrent ? 'bg-blue-600/5' : ''}`}>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg transition-all duration-500 uppercase tracking-wider ${isCurrent ? 'bg-blue-600 text-white scale-110' : 'bg-blue-50 text-blue-600 shadow-transparent'}`}>
                                                    <TrendingDown className={`w-3.5 h-3.5 transition-transform ${isCurrent ? 'rotate-0' : '-rotate-45 opacity-50'}`} />
                                                    {idx === 0 ? '$399' : idx === 1 ? '~$332' : idx === 2 ? '~$299' : idx === 3 ? '~$261' : idx === 4 ? '~$239' : '<$169'}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-12 p-10 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-200 lg:flex items-center justify-between">
                        <div className="mb-8 lg:mb-0">
                            <h3 className="text-xl font-bold mb-4">The Complete Experience</h3>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                {FEATURES.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm font-medium text-blue-50">
                                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/contact')}
                            className="w-full lg:w-auto px-12 py-5 bg-white text-blue-600 font-black rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
                        >
                            Get Started Now
                            <ArrowRight className="w-5 h-5" />
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
            <section className="py-24 px-6 relative overflow-hidden bg-blue-600">
                <div className="absolute inset-0">
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
