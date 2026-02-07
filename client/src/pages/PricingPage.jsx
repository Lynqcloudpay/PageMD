import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Shield, Zap, TrendingDown, DollarSign, Calculator, ChevronLeft, ChevronRight, Users } from 'lucide-react';
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
        document.title = "Pricing | Transparent Growth | PageMD";
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", "Transparent, staircase pricing designed by physicians for physicians. $0 implementation and no contracts. Experience PageMD today.");
    }, []);

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 300);
        return () => clearTimeout(timer);
    }, [seats]);

    const currentTier = useMemo(() => {
        return TIERS.find(t => seats >= t.min && seats <= t.max) || TIERS[TIERS.length - 1];
    }, [seats]);

    const calculateTotal = (numSeats) => {
        let virtualTotal = 0;
        for (let i = 1; i <= numSeats; i++) {
            const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
            virtualTotal += tier.rate;
        }
        return virtualTotal;
    };

    const virtualTotal = useMemo(() => calculateTotal(seats), [seats]);
    const avgCostPerSeat = useMemo(() => Math.round(virtualTotal / seats), [virtualTotal, seats]);
    const totalMonthly = useMemo(() => virtualTotal, [virtualTotal]);
    const totalSavings = useMemo(() => (seats * 399) - virtualTotal, [seats, virtualTotal]);

    const incrementSeats = () => setSeats(prev => Math.min(prev + 1, 11));
    const decrementSeats = () => setSeats(prev => Math.max(prev - 1, 1));

    const pricingEquation = useMemo(() => {
        if (seats === 1) return `1 × $399`;
        let parts = [];
        let remaining = seats;
        parts.push(`1 × $399`);
        remaining -= 1;
        for (let i = 1; i < TIERS.length; i++) {
            if (remaining <= 0) break;
            const tier = TIERS[i];
            const tierCapacity = tier.max - tier.min + 1;
            const inThisTier = Math.min(remaining, tierCapacity);
            if (inThisTier > 0) {
                parts.push(`${inThisTier} × $${tier.rate}`);
                remaining -= inThisTier;
            }
        }
        return parts.join(" + ");
    }, [seats]);

    return (
        <div className="min-h-screen bg-white">
            <LandingNav />

            {/* Premium Hero */}
            <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40 px-6 bg-white overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-sky-50 rounded-full blur-[120px] opacity-60 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-8 border border-sky-100/40">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Smart Growth
                    </div>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                        Transparent design. <br />
                        <span className="text-sky-500">Zero barriers.</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed mb-10">
                        Most EMRs penalize your growth with flat-rate fees. PageMD rewards it. As your practice expands, your average cost per doctor drops automatically.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-sky-600 bg-sky-50/50 px-4 py-2 rounded-full uppercase tracking-wider border border-sky-100/50">
                            <Check className="w-3.5 h-3.5" /> Month-to-month
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 bg-slate-50/50 px-4 py-2 rounded-full uppercase tracking-wider border border-slate-100">
                            <Check className="w-3.5 h-3.5" /> $0 Implementation
                        </div>
                    </div>
                </div>
            </section>

            {/* Savings Slider Section - Zen Refinement */}
            <section className="pb-24 lg:pb-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 border border-slate-50 overflow-hidden lg:flex items-stretch">
                        <div className="lg:w-1/2 p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-50 relative bg-white">
                            <div className="flex items-center gap-3 mb-12">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                                    <Calculator className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Interactive Cost Explorer</h2>
                            </div>

                            <div className="mb-14 relative z-10">
                                <div className="flex justify-between items-end mb-8">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Practice Size</label>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-4xl font-semibold tracking-tighter tabular-nums transition-all ${isAnimating ? 'text-sky-500' : 'text-slate-800'}`}>
                                            {seats === 11 ? '11+' : seats}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Providers</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={decrementSeats}
                                        className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all disabled:opacity-30"
                                        disabled={seats <= 1}
                                    >
                                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                                    </button>

                                    <div className="relative flex-1 h-2 bg-slate-50 rounded-full">
                                        <input
                                            type="range"
                                            min="1"
                                            max="11"
                                            value={seats}
                                            onChange={(e) => setSeats(parseInt(e.target.value))}
                                            className="w-full h-full appearance-none bg-transparent cursor-pointer accent-sky-500"
                                        />
                                    </div>

                                    <button
                                        onClick={incrementSeats}
                                        className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all disabled:opacity-30"
                                        disabled={seats >= 11}
                                    >
                                        <ChevronRight className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100/50 text-center">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Avg Monthly / Dr</p>
                                        <p className="text-3xl font-semibold text-slate-800 tracking-tight">${avgCostPerSeat}</p>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-sky-500 text-white text-center shadow-lg shadow-sky-200/50">
                                        <p className="text-[9px] font-semibold text-sky-100 uppercase tracking-widest mb-1.5">Total Monthly</p>
                                        <p className="text-3xl font-semibold tracking-tight">${totalMonthly.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingDown className="w-4 h-4 text-sky-500" />
                                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Staircase Calculation</h3>
                                    </div>
                                    <p className="font-mono text-[11px] text-slate-400 mb-4 break-words">{pricingEquation}</p>
                                    {totalSavings > 0 && (
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/50">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Savings</span>
                                            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                                -${totalSavings.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 bg-slate-50/30 p-10 lg:p-16 flex flex-col justify-center border-l border-slate-50">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-12">The Reward Curve</h3>
                            <div className="space-y-8">
                                {TIERS.map((tier, idx) => {
                                    const isCurrent = currentTier.name === tier.name;
                                    const percentage = (tier.rate / TIERS[0].rate) * 100;
                                    return (
                                        <div key={idx} className={`relative transition-all duration-500 ${isCurrent ? 'opacity-100 translate-x-1' : 'opacity-30'}`}>
                                            <div className="flex justify-between items-center mb-2 font-semibold text-[10px] uppercase tracking-wider text-slate-500">
                                                <span>{tier.name} Tier</span>
                                                <span className={isCurrent ? 'text-sky-500' : ''}>${tier.rate}/MO</span>
                                            </div>
                                            <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                                                <div
                                                    className={`h-full transition-all duration-700 ease-out ${isCurrent ? 'bg-sky-500' : 'bg-slate-200'}`}
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

            {/* Feature Unification - Statement Card */}
            <section className="py-24 lg:py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="p-10 lg:p-16 rounded-[3rem] bg-slate-900 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-semibold uppercase tracking-wider mb-8 border border-sky-400/20">
                                    Inclusive Access
                                </span>
                                <h3 className="text-3xl md:text-5xl font-semibold text-white mb-8 leading-tight tracking-tight">
                                    Every plan includes <br />
                                    <span className="text-sky-400">everything.</span>
                                </h3>
                                <p className="text-slate-400 text-base leading-relaxed mb-10 font-normal">
                                    Other platforms force you to choose between "Basic" and "Pro" versions, often stripping away essential tools like Telehealth or ePrescribe. We believe every physician deserves the best tools, regardless of practice size.
                                </p>
                                <Link to="/contact" className="inline-flex items-center gap-3 px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-sky-500/20 text-sm">
                                    Talk to Sales
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <div className="bg-white/5 backdrop-blur-3xl rounded-3xl p-8 border border-white/10">
                                <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-[0.2em] mb-8 border-b border-white/5 pb-4">Standard Features</h4>
                                <div className="grid sm:grid-cols-2 gap-y-6 gap-x-8">
                                    {FEATURES.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
                                                <Check className="w-3 h-3 text-sky-400" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-300">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Implementation Fee - Minimalist */}
            <section className="py-24 lg:py-32 px-6 bg-slate-50/50 border-y border-slate-100">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-8 border border-slate-100">
                        <Shield className="w-8 h-8 text-sky-500" />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4 tracking-tight">Onboarding & Compliance</h2>
                    <p className="text-base text-slate-500 mb-8 leading-relaxed font-normal">
                        A one-time $25.00 credentialing fee is applied per new provider for Surescripts identity verification and DEA compliance.
                    </p>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-slate-200 text-xs font-semibold text-slate-400 shadow-sm uppercase tracking-widest italic">
                        "Secure, compliant, and ready for practice."
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 lg:py-32 bg-white px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-semibold text-slate-800 mb-10 leading-tight tracking-tight">Join the <span className="text-sky-500">mission</span> to fix medicine.</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/contact" className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-0.5 text-base flex items-center justify-center gap-3">
                            Work with Us
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

export default PricingPage;
