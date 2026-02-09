import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingDown, Users, Copy, Send, CheckCircle2, Zap,
    ArrowUpRight, Gift, Percent, Calendar, DollarSign,
    ChevronRight, ArrowRight, Info, ShieldCheck, Star
} from 'lucide-react';
import { growthAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const GrowthRewardWidget = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', name: '' });

    const fetchStats = async () => {
        try {
            const response = await growthAPI.getStats();
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch growth stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const copyLink = () => {
        if (!stats?.referralLink) return;
        navigator.clipboard.writeText(stats.referralLink);
        showSuccess('Referral link copied to clipboard!');
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            await growthAPI.invite(inviteData);
            showSuccess(`Invitation sent to ${inviteData.email}!`);
            setInviteData({ email: '', name: '' });
            setIsInviting(false);
            fetchStats();
        } catch (error) {
            showError('Failed to send invitation');
        }
    };

    // Advanced Marketing Math
    const math = useMemo(() => {
        if (!stats) return null;

        const { physicalSeats, ghostSeats, totalMonthly, virtualTotal } = stats;

        // TIERS from backend (source of truth)
        const TIERS = [
            { name: 'Solo', min: 1, max: 1, rate: 399 },
            { name: 'Partner', min: 2, max: 3, rate: 299 },
            { name: 'Professional', min: 4, max: 5, rate: 249 },
            { name: 'Premier', min: 6, max: 8, rate: 199 },
            { name: 'Elite', min: 9, max: 10, rate: 149 },
            { name: 'Enterprise', min: 11, max: 999, rate: 99 },
        ];

        // 1. Calculate Standard Price (if no ghost seats existed)
        let standardTotal = 0;
        for (let i = 1; i <= physicalSeats; i++) {
            const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
            standardTotal += tier.rate;
        }

        // 2. Savings Calculations
        const monthlySavings = Math.max(0, standardTotal - totalMonthly);
        const annualSavings = monthlySavings * 12;
        const savingsPerReferral = ghostSeats > 0 ? monthlySavings / ghostSeats : 0;
        const discountPercentage = standardTotal > 0 ? (monthlySavings / standardTotal) * 100 : 0;

        return {
            standardTotal,
            monthlySavings,
            annualSavings,
            savingsPerReferral,
            discountPercentage,
            tierInfo: TIERS
        };
    }, [stats]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyzing Partner Metrics...</p>
        </div>
    );

    const safeStats = stats || {
        currentRate: 399,
        marginalRate: 399,
        tierName: 'Solo',
        totalMonthly: 399,
        physicalSeats: 1,
        ghostSeats: 0,
        totalBillingSeats: 1,
        effectiveRate: 399,
        referralLink: '',
        nextMilestone: { referralsNeeded: 1, newRate: 299 }
    };

    const {
        currentRate,
        marginalRate,
        tierName,
        totalMonthly,
        nextMilestone,
        totalBillingSeats,
        physicalSeats,
        ghostSeats,
        totalBillingSeats: totalSeats,
        referralLink,
        activeGracePeriods,
        referrals = []
    } = safeStats;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Main Financial Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Current Impact Card */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Reward Program Overview</h3>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">How your referrals lower your bill</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Level:</span>
                            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                                {tierName} Partner
                            </div>
                        </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Monthly Comparison */}
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 block">Current Value</label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 group hover:border-slate-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Market Rate</p>
                                                <p className="text-[9px] text-slate-400 uppercase font-medium">Standard Pricing</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-400/80 line-through">${math?.standardTotal?.toLocaleString()}</span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                                <Star className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-tight">Your Partner Price</p>
                                                <p className="text-[9px] text-indigo-500 font-bold uppercase">{ghostSeats} Referral Weight</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-bold text-indigo-600 tracking-tight">${totalMonthly?.toLocaleString()}</span>
                                            <p className="text-[9px] text-indigo-400 font-bold uppercase">per month</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Percent className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Volume Discount</span>
                                </div>
                                <span className="text-sm font-bold text-emerald-600">{math?.discountPercentage?.toFixed(1)}% SAVED</span>
                            </div>
                        </div>

                        {/* Annual Savings Impact */}
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 block">Yearly Value</label>
                            <div className="flex-1 bg-white border border-indigo-100 rounded-[2.5rem] p-8 text-indigo-950 relative overflow-hidden">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Projected 12-Month Impact</span>
                                    </div>

                                    <div className="py-4">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-bold tracking-tighter text-indigo-600">${math?.annualSavings?.toLocaleString()}</span>
                                        </div>
                                        <p className="text-slate-500 text-[11px] font-medium mt-1">Net profit preserved through rewards</p>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Impact Per Referral</p>
                                            <p className="text-sm font-bold text-indigo-950">~${Math.round(math?.savingsPerReferral || 0)}/mo</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                            <ArrowUpRight className="w-5 h-5 text-indigo-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Milestone Card - High Visibility */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                            <Gift className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                Next Milestone
                            </span>
                        </div>
                    </div>

                    {nextMilestone ? (
                        <div className="flex-1 flex flex-col">
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Monthly Rate</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-800">${nextMilestone.newRate}</span>
                                    <span className="text-xs font-bold text-slate-400">/ MD</span>
                                </div>
                            </div>

                            <div className="mt-auto space-y-4">
                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Volume Goal</span>
                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                            {nextMilestone.referralsNeeded} more referral{nextMilestone.referralsNeeded === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="relative h-2.5 bg-white rounded-full overflow-hidden border border-slate-100/50">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-1000 shadow-sm"
                                            style={{ width: `${(ghostSeats / (ghostSeats + nextMilestone.referralsNeeded)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between mt-3">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ghostSeats} Active</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ghostSeats + nextMilestone.referralsNeeded} Goal</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 text-center font-medium italic">
                                    "Referrals increase your practice weight without increasing your bill."
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900">Highest Tier Reached</h4>
                                <p className="text-xs text-slate-500 max-w-[150px] mx-auto mt-2 italic">You are already maximizing your partner savings.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Simplified Value Logic */}
            <div className="bg-slate-50/30 rounded-[2.5rem] border border-slate-100 p-10">
                <div className="flex items-center gap-3 mb-8">
                    <Info className="w-4 h-4 text-slate-400" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">How the Rewards Math Works</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                    {/* Step 1 */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">1</span>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Network Volume</p>
                        </div>
                        <p className="text-xl font-bold text-slate-800 mb-1">{safeStats.totalBillingSeats} Total Seats</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">We combine your {safeStats.physicalSeats} providers with {safeStats.ghostSeats} referral points to calculate your volume discount.</p>
                    </div>

                    {/* Step 2 */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">2</span>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bulk Discount Rate</p>
                        </div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-xl font-bold text-slate-800">${(safeStats.virtualTotal / safeStats.totalBillingSeats).toFixed(2)}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Average</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Because of the high total volume, every seat in the network drops to this weighted target price.</p>
                    </div>

                    {/* Step 3 */}
                    <div className="relative z-10 bg-white shadow-xl shadow-slate-200/50 rounded-3xl p-6 border border-slate-100 ring-4 ring-slate-50">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black text-white">3</span>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Your Final Bill</p>
                        </div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-2xl font-bold text-indigo-600 tracking-tight">${totalMonthly?.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">/ Month</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">Calculation:</p>
                        <p className="text-[10px] text-slate-500 font-medium"> {safeStats.physicalSeats} Provider{safeStats.physicalSeats === 1 ? '' : 's'} × ${(safeStats.virtualTotal / safeStats.totalBillingSeats).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Referral Tools Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Advanced Invite Panel */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Invite Colleagues</h3>
                            <p className="text-xs text-slate-500 mt-1">Accelerate your time-to-savings by growing the network.</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                            <Send className="w-5 h-5" />
                        </div>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-4 flex-1">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Colleague Profile Name</label>
                                <input
                                    type="text"
                                    value={inviteData.name}
                                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none text-sm placeholder:text-slate-300"
                                    placeholder="e.g. Dr. Jordan Smith"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Practice Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteData.email}
                                    onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none text-sm placeholder:text-slate-300"
                                    placeholder="doctor@medicalgroup.com"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isInviting}
                            className="w-full mt-4 py-4 bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isInviting ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                            ) : (
                                <>
                                    <span>Send VIP Invitation</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Referral Link & Management */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-8">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            Your Personal Link
                        </h3>
                        <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
                            <div className="flex-1 px-4 py-2 text-xs text-slate-500 font-mono truncate align-middle flex items-center">
                                {referralLink || 'Processing...'}
                            </div>
                            <button
                                onClick={copyLink}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                            </button>
                        </div>
                    </div>

                    {/* Active Grace Periods / Churn Protection */}
                    {activeGracePeriods?.length > 0 && (
                        <div className="p-6 rounded-[1.5rem] bg-amber-50/50 border border-amber-100/50">
                            <div className="flex items-center gap-2 text-amber-800 mb-4">
                                <TrendingDown className="w-5 h-5" />
                                <span className="font-extrabold text-xs uppercase tracking-tight">Active Churn Protection</span>
                            </div>
                            <div className="space-y-4">
                                {activeGracePeriods.map((grace, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 animate-pulse"></div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-amber-900 leading-tight">
                                                {grace.name} deactivation status
                                            </p>
                                            <p className="text-[10px] text-amber-700 mt-1">
                                                Your current rate is protected until <span className="font-black underline">{new Date(grace.expiresAt).toLocaleDateString()}</span>.
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* How It Works Micro-Section */}
                    <div className="p-6 bg-slate-50/30 rounded-[1.5rem] border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 mb-3">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Network Rules</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                            Every clinic you refer that remains active contributes to your <span className="font-bold text-slate-700 underline decoration-indigo-200">Practice Weight</span>. If a clinic deactivates, our Smart Reward Engine applies a <span className="font-bold text-slate-700">30-day Price Lock</span> to your account automatically.
                        </p>
                    </div>
                </div>
            </div>

            {/* Referral History Table (New) */}
            {referrals.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50">
                        <h3 className="text-sm font-bold text-slate-900">Referral History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Practice</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {referrals.map((ref, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="text-sm font-bold text-slate-700">{ref.name}</div>
                                            <div className="text-[10px] text-slate-400">Joined {new Date(ref.date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                ref.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                    ref.status === 'churned' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                        "bg-slate-50 text-slate-400 border-slate-100"
                                            )}>
                                                {ref.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <span className={cn(
                                                "text-sm font-black",
                                                ref.status === 'active' ? "text-indigo-600" : "text-slate-400"
                                            )}>
                                                {ref.status === 'active' ? "-1 Seat Weight" : "0 Neutral"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GrowthRewardWidget;
