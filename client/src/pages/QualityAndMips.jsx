import React, { useState, useEffect } from 'react';
import {
    Target, Info, AlertTriangle, CheckCircle2, ChevronRight,
    Filter, Download, Settings2, BarChart3, Users2,
    ClipboardCheck, Activity, Search, ExternalLink, RefreshCcw, Loader2
} from 'lucide-react';
import { qppAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';

const QualityAndMips = () => {
    const [performanceYear, setPerformanceYear] = useState(2026);
    const [activeTab, setActiveTab] = useState('scoreboard');
    const [selectedPackId, setSelectedPackId] = useState('');
    const [reportingPath, setReportingPath] = useState('TRADITIONAL_MIPS');
    const [loading, setLoading] = useState(false);
    const [packs, setPacks] = useState([]);
    const [scoreboardData, setScoreboardData] = useState(null);
    const [measures, setMeasures] = useState([]);

    // Fetch packs and measures on load/year change
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [packsRes, measuresRes] = await Promise.all([
                    qppAPI.getPacks(performanceYear),
                    qppAPI.getMeasures(performanceYear)
                ]);
                setPacks(packsRes.data);
                setMeasures(measuresRes.data);

                if (packsRes.data.length > 0) {
                    setSelectedPackId(packsRes.data[0].id);
                }
            } catch (error) {
                showError('Failed to load QPP data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [performanceYear]);

    // Fetch scoreboard when pack changes
    useEffect(() => {
        if (selectedPackId && activeTab === 'scoreboard') {
            const fetchScoreboard = async () => {
                try {
                    const res = await qppAPI.getScoreboard(selectedPackId);
                    setScoreboardData(res.data);
                } catch (error) {
                    showError('Failed to load scoreboard data');
                }
            };
            fetchScoreboard();
        }
    }, [selectedPackId, activeTab]);

    const handleCompute = async () => {
        setLoading(true);
        try {
            await qppAPI.compute({
                packId: selectedPackId,
                year: performanceYear
            });
            showSuccess('MIPS Computation complete! Scoreboard refreshed.');
            // Refresh scoreboard
            const res = await qppAPI.getScoreboard(selectedPackId);
            setScoreboardData(res.data);
        } catch (error) {
            showError('Failed to run computation');
        } finally {
            setLoading(false);
        }
    };

    const getStatCards = () => {
        const qualityScores = (scoreboardData?.scores || []).filter(s =>
            scoreboardData?.measures?.find(m => m.id === s.measure_id && m.category === 'QUALITY')
        );
        const avgQuality = qualityScores.length > 0
            ? Math.round(qualityScores.reduce((acc, s) => acc + (s.denominator_count > 0 ? (s.numerator_count / s.denominator_count) * 100 : 0), 0) / qualityScores.length)
            : 0;

        const iaAttestedCount = (scoreboardData?.attestations || []).filter(a => a.is_attested).length;
        const iaTotalCount = (scoreboardData?.pack?.ia_ids || []).length;

        const piAttestedCount = (scoreboardData?.attestations || []).filter(a =>
            a.is_attested && scoreboardData?.measures?.find(m => m.id === a.measure_id && m.category === 'PI')
        ).length;
        const piTotalCount = (scoreboardData?.pack?.pi_ids || []).length;
        const piScore = piTotalCount > 0 ? Math.round((piAttestedCount / piTotalCount) * 100) : 0;

        return [
            { label: 'Quality Performance', value: `${avgQuality}%`, target: '75%', status: avgQuality >= 75 ? 'success' : avgQuality >= 50 ? 'warning' : 'neutral', icon: Activity },
            { label: 'IA Completion', value: `${iaAttestedCount}/${iaTotalCount}`, target: `${iaTotalCount}/${iaTotalCount}`, status: iaAttestedCount >= iaTotalCount ? 'success' : 'neutral', icon: ClipboardCheck },
            { label: 'PI Score', value: `${piScore}/100`, target: '90', status: piScore >= 90 ? 'success' : 'neutral', icon: BarChart3 },
            { label: 'Cost Status', value: 'Active', sub: 'Informational Only', status: 'neutral', icon: Info }
        ];
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 font-bold">
            {/* Header / Global Controls */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Quality & MIPS Workspace</h1>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">CMS/QPP Performance Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            {[2025, 2026].map(year => (
                                <button
                                    key={year}
                                    onClick={() => setPerformanceYear(year)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${performanceYear === year ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleCompute}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Sync CMS Data
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1 max-w-sm relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={selectedPackId}
                            onChange={(e) => setSelectedPackId(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                        >
                            {packs.map(pack => (
                                <option key={pack.id} value={pack.id}>{pack.specialty}</option>
                            ))}
                            {packs.length === 0 && <option disabled>No packs found</option>}
                        </select>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        {['TRADITIONAL_MIPS', 'MVP'].map(path => (
                            <button
                                key={path}
                                onClick={() => setReportingPath(path)}
                                className={`px-4 py-1.5 text-xs font-bold border-none rounded-md transition-all ${reportingPath === path ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {path.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-8">
                    {[
                        { id: 'scoreboard', label: 'Specialty Scoreboard', icon: BarChart3 },
                        { id: 'manager', label: 'Measure Manager', icon: Settings2 },
                        { id: 'gaps', label: 'Patient Gap Lists', icon: Users2 }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeTab === 'scoreboard' && (
                    <div className="space-y-6 animate-fade-in text-slate-900 font-bold">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-slate-800">Performance Overview</h2>
                            <button
                                onClick={() => showSuccess('Preparing CMS QRDA III Export...')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export CMS QRDA III
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-4">
                                    {getStatCards().map((card, i) => (
                                        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-3 text-slate-900 font-bold">
                                                <div className={`p-2 rounded-lg ${card.status === 'success' ? 'bg-emerald-50 text-emerald-600' : card.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
                                                    <card.icon className="w-5 h-5" />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase ${card.status === 'success' ? 'text-emerald-600' : card.status === 'warning' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {card.status}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
                                            <p className="text-xs text-slate-500 font-medium mt-1">{card.label}</p>
                                            {card.target && (
                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full mr-3">
                                                        <div
                                                            className={`h-full rounded-full ${card.status === 'success' ? 'bg-emerald-500' : card.status === 'warning' ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                            style={{ width: card.value.includes('%') ? card.value : (card.value.includes('/') ? `${(parseInt(card.value.split('/')[0]) / parseInt(card.value.split('/')[1])) * 100}%` : '0%') }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400">Target: {card.target}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    {/* Performance Gaps */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                Critical Performance Gaps
                                            </h3>
                                            <button className="text-xs font-bold text-blue-600 hover:text-blue-700">View All</button>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {(scoreboardData?.measures || []).filter(m => m.category === 'QUALITY').slice(0, 3).map((m, i) => {
                                                const score = (scoreboardData?.scores || []).find(s => s.measure_id === m.id);
                                                const den = score?.denominator_count || 0;
                                                const num = score?.numerator_count || 0;
                                                const gap = den - num;
                                                return (
                                                    <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer group">
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{m.title}</div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${gap > 10 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                    {gap > 10 ? 'Critical' : 'High'} Impact
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">{gap} patients missing from numerator</span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                                                    </div>
                                                );
                                            })}
                                            {(!scoreboardData?.measures || scoreboardData.measures.filter(m => m.category === 'QUALITY').length === 0) && (
                                                <div className="p-10 text-center text-slate-400 text-xs font-medium italic">
                                                    No quality measures configured for this pack.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* CMS Cost Category Visibility */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-blue-500" />
                                                MIPS Cost Measures (Informational)
                                            </h3>
                                            <Info className="w-4 h-4 text-slate-300 pointer-events-none" />
                                        </div>
                                        <div className="p-5">
                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                                    Cost measures are calculated by CMS using claims data. Based on your Specialty Pack,
                                                    the following measures are likely applicable to your providers:
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                {Array.isArray(scoreboardData?.pack?.cost_refs) && scoreboardData.pack.cost_refs.map((item, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                                            {i + 1}
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-700">{item}</span>
                                                    </div>
                                                ))}
                                                {(!scoreboardData?.pack?.cost_refs || scoreboardData.pack.cost_refs.length === 0) && (
                                                    <div className="text-slate-400 text-xs italic p-2 text-center">No cost references mapped.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'manager' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Measure Manager</h3>
                                <p className="text-xs text-slate-500 mt-1">Configure your performance objectives and data mappings</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search measures..."
                                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Measure Title</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logic</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {measures.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-all group font-bold">
                                            <td className="px-6 py-4 text-xs font-bold text-blue-600">{row.qpp_id}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap max-w-md">{row.title}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">Performance Year: {performanceYear}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.category === 'QUALITY' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {row.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-600 font-medium">{row.measure_type}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${row.category === 'QUALITY' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    <span className="text-xs font-semibold text-slate-700">{row.category === 'QUALITY' ? 'Computed' : 'Manual'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <a
                                                    href={row.spec_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-400 hover:text-blue-600 transition-all"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {measures.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-slate-400 italic text-sm">
                                                No measures loaded for this year.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'gaps' && (
                    <div className="flex items-center justify-center h-full text-slate-400 italic text-sm animate-pulse">
                        <Users2 className="w-8 h-8 mr-3 opacity-20" />
                        Patient level gap logic coming in Phase 5...
                    </div>
                )}
            </div>
        </div>
    );
};

export default QualityAndMips;
