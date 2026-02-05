import React, { useState, useEffect } from 'react';
import { TrendingDown, Users, Copy, Send, CheckCircle2, Zap, ArrowUpRight, Gift, Percent } from 'lucide-react';
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
        <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
    );

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
        marginalRate,
        tierName,
        totalMonthly,
        nextMilestone,
        totalBillingSeats,
        referralLink,
        ghostSeats,
        activeGracePeriods
    } = safeStats;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Overview Section */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Partner Program Rewards</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Current Rate Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Tier</span>
                            <div className="bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                {tierName || `Level ${totalBillingSeats}`}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-gray-900">${marginalRate || currentRate}</span>
                            <span className="text-sm font-medium text-gray-500">/ MD / month</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-0.5">
                            <p className="text-xs text-gray-500">Total Monthly: <strong>${totalMonthly}</strong></p>
                            <p className="text-[10px] text-gray-400">Average: ${currentRate}/seat</p>
                        </div>
                    </div>

                    {/* Next Milestone Card */}
                    {nextMilestone ? (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Target Rate</span>
                                <div className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                    Next Tier
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">${nextMilestone.newRate}</span>
                                <span className="text-sm font-medium text-gray-500">/ MD / month</span>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Progress</span>
                                    <span className="text-[10px] font-bold text-gray-500">{nextMilestone.referralsNeeded} more needed</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${(1 / (nextMilestone.referralsNeeded + 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col justify-center">
                            <div className="flex items-center gap-2 text-green-700 mb-1">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-bold">Maximum Discount</span>
                            </div>
                            <p className="text-sm text-green-600">You have reached the highest partner tier available.</p>
                        </div>
                    )}

                    {/* Active Perks */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">Active Perks</span>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className={`w-4 h-4 ${ghostSeats > 0 ? 'text-primary-600' : 'text-gray-300'}`} />
                                    <span className={`text-sm ${ghostSeats > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>Ghost Seats</span>
                                </div>
                                <span className={`text-xs font-bold ${ghostSeats > 0 ? 'text-primary-600' : 'text-gray-400'}`}>{ghostSeats} active</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className={`w-4 h-4 ${activeGracePeriods?.length > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
                                    <span className={`text-sm ${activeGracePeriods?.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>Price Protection</span>
                                </div>
                                <span className={`text-xs font-bold ${activeGracePeriods?.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {activeGracePeriods?.length > 0 ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Referral Tools Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                {/* Invite Section */}
                <div>
                    <h3 className="text-md font-semibold text-gray-800 mb-4">Invite Other MDs</h3>
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 mb-6">
                            Invite your colleagues to PageMD. For every clinic that joins through your link, your monthly rate decreases.
                        </p>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 px-1">Colleague Name</label>
                                    <input
                                        type="text"
                                        value={inviteData.name}
                                        onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
                                        placeholder="Dr. Smith"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 px-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={inviteData.email}
                                        onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
                                        placeholder="doctor@example.com"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white font-bold text-sm rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                            >
                                <Send className="w-4 h-4" />
                                Send Invitation
                            </button>
                        </form>
                    </div>
                </div>

                {/* Tracking & Links */}
                <div>
                    <h3 className="text-md font-semibold text-gray-800 mb-4">Referral Link</h3>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-3 font-medium">Your Personal Link</p>
                            <div className="flex gap-2">
                                <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 font-mono truncate">
                                    {referralLink || 'No link generated yet'}
                                </div>
                                <button
                                    onClick={copyLink}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Recent Alerts / Info */}
                        {activeGracePeriods?.length > 0 && (
                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                <div className="flex items-center gap-2 text-amber-800 mb-2">
                                    <TrendingDown className="w-4 h-4" />
                                    <span className="font-bold text-sm">Churn Protection Active</span>
                                </div>
                                <div className="space-y-2">
                                    {activeGracePeriods.map((grace, i) => (
                                        <p key={i} className="text-xs text-amber-700">
                                            <strong>{grace.name}</strong> has deactivated. Your special rate is protected until <strong>{new Date(grace.expiresAt).toLocaleDateString()}</strong>.
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-xs leading-relaxed">
                            <p className="flex items-center gap-2 mb-1">
                                <Percent className="w-3.5 h-3.5" />
                                <strong>How it works:</strong>
                            </p>
                            Every clinic you refer that stays active for 3 months reduces your base rate. If a referral churns, we provide a 30-day grace period to help you maintain your discount level.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GrowthRewardWidget;
