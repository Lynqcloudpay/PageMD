import React, { useState, useEffect } from 'react';
import { TrendingDown, Users, Copy, Send, CheckCircle2, Zap, ArrowUpRight } from 'lucide-react';
import { growthAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';

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

    if (loading) return (
        <div className="animate-pulse bg-white/50 backdrop-blur-md rounded-2xl border border-white/20 p-6 h-48">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
    );

    // Always show the widget, even if stats failed - provide defaults
    const safeStats = stats || {
        currentRate: 399,
        totalBillingSeats: 1,
        referralCode: null,
        ghostSeats: 0,
        activeGracePeriods: [],
        nextMilestone: { referralsNeeded: 1, newRate: 299 }
    };

    const {
        currentRate,
        nextMilestone,
        totalBillingSeats,
        referralCode,
        ghostSeats,
        activeGracePeriods
    } = safeStats;

    return (
        <div className="relative group overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0891B2]/10 via-[#ecfeff]/50 to-white backdrop-blur-3xl border border-white/40 shadow-2xl p-6 transition-all duration-500 hover:shadow-cyan-100/50">
            {/* Background Decorative Element */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-400/10 rounded-full blur-3xl group-hover:bg-cyan-400/20 transition-all duration-1000"></div>

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0891B2] flex items-center justify-center shadow-lg shadow-cyan-200/50">
                        <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#164E63] uppercase tracking-[0.15em] font-figtree">Growth Reward</h3>
                        <p className="text-[10px] font-bold text-[#0891B2]/60 uppercase tracking-widest">PageMD Partner Program</p>
                    </div>
                </div>
                {ghostSeats > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#059669]/10 text-[#059669] rounded-full border border-[#059669]/20 shadow-sm animate-pulse-slow">
                        <Zap className="w-3 h-3 fill-[#059669]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{ghostSeats} Ghost Seats Active</span>
                    </div>
                )}
            </div>

            {/* Grace Period Alerts (Churn Protection) */}
            {activeGracePeriods?.length > 0 && (
                <div className="mb-6 space-y-2">
                    {activeGracePeriods.map((grace, i) => (
                        <div key={i} className="flex flex-col p-3 rounded-xl bg-amber-50 border border-amber-200 shadow-sm animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-amber-500 text-white rounded-full p-0.5"><Users className="w-2.5 h-2.5" /></span>
                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight">Referral Churn Detected</span>
                            </div>
                            <p className="text-[10px] text-amber-800 leading-tight">
                                <strong>{grace.name}</strong> has deactivated.
                                <span className="block mt-1 font-bold text-amber-900 uppercase tracking-widest text-[8px]">
                                    Grace Period active until {new Date(grace.expiresAt).toLocaleDateString()}
                                </span>
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mb-8">
                <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10px] font-black text-[#164E63]/40 uppercase tracking-[0.2em]">Current Monthly Rate</span>
                    <span className="text-[10px] font-black text-white px-2 py-0.5 bg-[#0891B2] rounded-md tracking-widest">LEVEL {totalBillingSeats}</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-[#164E63] tracking-tighter font-figtree">${currentRate}</span>
                    <span className="text-sm font-bold text-[#164E63]/60">/ MD</span>
                </div>
            </div>

            {nextMilestone ? (
                <div className="mb-8 p-4 rounded-2xl bg-white/40 border border-white/60 shadow-inner">
                    <p className="text-[11px] font-bold text-[#164E63] mb-3 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Next Milestone: Refer <span className="text-[#0891B2] font-black text-sm">{nextMilestone.referralsNeeded} more</span> colleague{nextMilestone.referralsNeeded > 1 ? 's' : ''} to unlock:
                    </p>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Impact Tier</span>
                            <span className="text-2xl font-black text-[#164E63] tracking-tight font-figtree">~${nextMilestone.newRate}<span className="text-xs font-bold text-gray-400">/mo</span></span>
                        </div>
                        <div className="w-24 h-2 bg-gray-200/50 rounded-full overflow-hidden border border-white/30">
                            <div
                                className="h-full bg-gradient-to-r from-[#0891B2] to-[#22D3EE] transition-all duration-1000"
                                style={{ width: `${(1 / (nextMilestone.referralsNeeded + 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 rounded-2xl bg-[#059669]/5 border border-[#059669]/20">
                    <p className="text-[11px] font-bold text-[#059669] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        You've reached maximum efficiency!
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={copyLink}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-gray-200 text-[#164E63] font-black text-[10px] uppercase tracking-widest hover:border-[#0891B2] hover:text-[#0891B2] transition-all active:scale-95 shadow-sm"
                >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                </button>
                <button
                    onClick={() => setIsInviting(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0891B2] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#0891B2]/90 transition-all active:scale-95 shadow-lg shadow-cyan-200"
                >
                    <Users className="w-3.5 h-3.5" />
                    Invite MD
                </button>
            </div>

            {isInviting && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xl p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-[#164E63] uppercase tracking-widest">Send Invite</h4>
                        <button onClick={() => setIsInviting(false)} className="text-gray-400 hover:text-gray-600">×</button>
                    </div>
                    <form onSubmit={handleInvite} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Clinic/Doctor Name"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-gray-200 focus:border-[#0891B2] outline-none text-xs"
                            value={inviteData.name}
                            onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                        />
                        <input
                            type="email"
                            placeholder="email@example.com"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-gray-200 focus:border-[#0891B2] outline-none text-xs"
                            required
                            value={inviteData.email}
                            onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                        />
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0891B2] text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Send Email
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default GrowthRewardWidget;
