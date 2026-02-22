import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import api from '../services/api';

/**
 * EkoRiskBadge — Phase 4C
 * 
 * Proactive risk score badge rendered in the patient chart header.
 * Fetches a lightweight risk summary and shows an indicator
 * when elevated risk scores are detected.
 */
export default function EkoRiskBadge({ patientId }) {
    const [riskData, setRiskData] = useState(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!patientId) return;

        let cancelled = false;
        api.get(`/echo/risk-summary/${patientId}`)
            .then(res => {
                if (!cancelled && res.data) {
                    setRiskData(res.data);
                }
            })
            .catch(() => { /* Silently fail — non-critical UI element */ });

        return () => { cancelled = true; };
    }, [patientId]);

    if (!riskData || !riskData.hasElevated) return null;

    const scoreLabels = {
        ascvd: { label: 'ASCVD', unit: '%' },
        chads: { label: 'CHA₂DS₂', unit: 'pts' },
        meld: { label: 'MELD', unit: 'pts' }
    };

    const getLevelColor = (score) => {
        if (score.level === 'high' || (score.type === 'chads' && score.score >= 4)) {
            return 'text-red-600 bg-red-50';
        }
        if (score.level === 'intermediate' || (score.type === 'chads' && score.score >= 2)) {
            return 'text-amber-600 bg-amber-50';
        }
        return 'text-green-600 bg-green-50';
    };

    return (
        <div className="relative">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200/60
                           hover:bg-amber-100 hover:border-amber-300 transition-all group"
                title="Elevated risk scores detected"
            >
                <Activity className="w-3 h-3 text-amber-500 group-hover:animate-pulse" />
                <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider">
                    {riskData.elevatedCount} Risk{riskData.elevatedCount !== 1 ? 's' : ''}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </button>

            {expanded && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200/60
                                p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                            Risk Score Summary
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {riskData.scores.map((s, i) => {
                            const meta = scoreLabels[s.type] || { label: s.type, unit: '' };
                            return (
                                <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${getLevelColor(s)}`}>
                                    <span className="text-[10px] font-bold">{meta.label}</span>
                                    <span className="text-[11px] font-black">
                                        {s.score} <small className="text-[8px] opacity-60">{meta.unit}</small>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 text-center">
                        Powered by Eko AI
                    </p>
                </div>
            )}
        </div>
    );
}
