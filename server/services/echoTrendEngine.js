/**
 * Echo Trend Engine
 * 
 * Calculates medical trends from vitals stored as JSONB in the visits table.
 * Provides statistical analysis and guideline-based clinical context.
 * Returns a structured JSON payload for frontend visualization.
 */

// ─── Medical Guidelines ─────────────────────────────────────────────────────

const VITAL_GUIDELINES = {
    systolicBp: {
        label: 'Systolic Blood Pressure',
        unit: 'mmHg',
        target: { value: 140, operator: '<', guideline: 'ACC/AHA 2017' },
        crisis: { value: 180, operator: '>=', label: 'Hypertensive Crisis' },
        thresholds: [
            { value: 120, label: 'Normal', color: '#22c55e' },
            { value: 130, label: 'Elevated', color: '#eab308' },
            { value: 140, label: 'Stage 1 HTN', color: '#f59e0b' },
            { value: 180, label: 'Stage 2 HTN', color: '#ef4444' }
        ]
    },
    diastolicBp: {
        label: 'Diastolic Blood Pressure',
        unit: 'mmHg',
        target: { value: 90, operator: '<', guideline: 'ACC/AHA 2017' },
        crisis: { value: 120, operator: '>=', label: 'Hypertensive Crisis' },
        thresholds: [
            { value: 80, label: 'Normal', color: '#22c55e' },
            { value: 90, label: 'Stage 1 HTN', color: '#f59e0b' },
            { value: 120, label: 'Stage 2 HTN', color: '#ef4444' }
        ]
    },
    heartRate: {
        label: 'Heart Rate',
        unit: 'bpm',
        target: { min: 60, max: 100, guideline: 'AHA' },
        thresholds: [
            { value: 60, label: 'Bradycardia', color: '#3b82f6' },
            { value: 100, label: 'Normal', color: '#22c55e' },
            { value: 100, label: 'Tachycardia', color: '#ef4444' }
        ]
    },
    temperature: {
        label: 'Temperature',
        unit: '°F',
        target: { value: 98.6, tolerance: 1.5 },
        thresholds: [
            { value: 100.4, label: 'Fever', color: '#ef4444' }
        ]
    },
    oxygenSaturation: {
        label: 'Oxygen Saturation',
        unit: '%',
        target: { value: 95, operator: '>=', guideline: 'WHO' },
        thresholds: [
            { value: 90, label: 'Critical', color: '#ef4444' },
            { value: 95, label: 'Low', color: '#f59e0b' }
        ]
    },
    respiratoryRate: {
        label: 'Respiratory Rate',
        unit: 'breaths/min',
        target: { min: 12, max: 20 },
        thresholds: [
            { value: 12, label: 'Bradypnea', color: '#3b82f6' },
            { value: 20, label: 'Normal', color: '#22c55e' },
            { value: 20, label: 'Tachypnea', color: '#ef4444' }
        ]
    },
    weight: {
        label: 'Weight',
        unit: 'lbs',
        trend_only: true,
        thresholds: []
    },
    bmi: {
        label: 'BMI',
        unit: 'kg/m²',
        ranges: [
            { max: 18.5, label: 'Underweight', color: '#3b82f6' },
            { max: 24.9, label: 'Normal', color: '#22c55e' },
            { max: 29.9, label: 'Overweight', color: '#f59e0b' },
            { max: Infinity, label: 'Obese', color: '#ef4444' }
        ],
        thresholds: [
            { value: 18.5, label: 'Underweight', color: '#3b82f6' },
            { value: 25, label: 'Normal', color: '#22c55e' },
            { value: 30, label: 'Overweight', color: '#f59e0b' }
        ]
    }
};

// ─── Core Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a specific vital trend for a patient
 * 
 * @param {Array} vitalHistory - Array of {visit_date, vitals} from echoContextEngine.getVitalHistory
 * @param {string} vitalType - The vital key (e.g., 'systolicBp', 'weight')
 * @returns {Object} Structured trend analysis with visualization payload
 */
function analyzeVitalTrend(vitalHistory, vitalType) {
    const guideline = VITAL_GUIDELINES[vitalType];
    if (!guideline) {
        return { error: `Unknown vital type: ${vitalType}`, available: Object.keys(VITAL_GUIDELINES) };
    }

    // Extract data points
    const dataPoints = vitalHistory
        .map(row => {
            const vitals = typeof row.vitals === 'string' ? JSON.parse(row.vitals) : row.vitals;
            const value = parseFloat(vitals?.[vitalType]);
            return { date: row.visit_date, value };
        })
        .filter(dp => !isNaN(dp.value) && dp.value !== null);

    if (dataPoints.length === 0) {
        return {
            type: 'vital_trend',
            vital: vitalType,
            label: guideline.label,
            unit: guideline.unit,
            stats: null,
            dataPoints: [],
            clinicalContext: { status: 'no_data', recommendation: `No ${guideline.label} readings found.` }
        };
    }

    // Calculate statistics
    const values = dataPoints.map(d => d.value);
    const current = values[values.length - 1];
    const previous = values.length >= 2 ? values[values.length - 2] : null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);

    const stats = {
        current,
        previous,
        min: round2(min),
        max: round2(max),
        mean: round2(mean),
        stdDev: round2(stdDev),
        count: dataPoints.length,
        trend: calculateTrendDirection(dataPoints),
        changePercent: previous ? round2(((current - previous) / previous) * 100) : null,
        changeAbsolute: previous ? round2(current - previous) : null
    };

    // Clinical context
    const clinicalContext = getMedicalContext(vitalType, stats, guideline);

    // Chart configuration
    const chartConfig = {
        type: 'line',
        thresholds: guideline.thresholds.map(t => ({
            value: t.value,
            label: t.label,
            color: t.color
        }))
    };

    if (guideline.target) {
        if (guideline.target.value) {
            chartConfig.targetLine = {
                value: guideline.target.value,
                label: `Target (${guideline.target.guideline || ''})`.trim(),
                color: '#f59e0b'
            };
        }
    }

    return {
        type: 'vital_trend',
        vital: vitalType,
        label: guideline.label,
        unit: guideline.unit,
        stats,
        dataPoints,
        clinicalContext,
        chartConfig
    };
}

/**
 * Analyze ALL vitals for a patient (overview)
 */
function analyzeAllVitals(vitalHistory) {
    const results = {};
    for (const vitalType of Object.keys(VITAL_GUIDELINES)) {
        const analysis = analyzeVitalTrend(vitalHistory, vitalType);
        if (analysis.dataPoints?.length > 0) {
            results[vitalType] = analysis;
        }
    }
    return results;
}

/**
 * Generate a text summary of vital trends for the LLM
 */
function generateTrendSummary(vitalHistory) {
    const analyses = analyzeAllVitals(vitalHistory);
    const parts = [];

    for (const [key, analysis] of Object.entries(analyses)) {
        if (!analysis.stats) continue;
        const s = analysis.stats;
        const ctx = analysis.clinicalContext;
        let line = `${analysis.label}: ${s.current} ${analysis.unit}`;
        if (s.trend !== 'stable') line += ` (${s.trend})`;
        if (ctx.status !== 'normal' && ctx.status !== 'no_data') {
            line += ` — ${ctx.recommendation}`;
        }
        parts.push(line);
    }

    return parts.length > 0 ? parts.join('\n') : 'No vital trend data available.';
}

// ─── Statistical Helpers ────────────────────────────────────────────────────

/**
 * Calculate trend direction using simple linear regression
 */
function calculateTrendDirection(dataPoints) {
    if (dataPoints.length < 2) return 'insufficient_data';
    if (dataPoints.length < 3) {
        const diff = dataPoints[1].value - dataPoints[0].value;
        const pct = Math.abs(diff / dataPoints[0].value) * 100;
        if (pct < 3) return 'stable';
        return diff > 0 ? 'rising' : 'falling';
    }

    // Linear regression slope
    const n = dataPoints.length;
    const xs = dataPoints.map((_, i) => i);
    const ys = dataPoints.map(d => d.value);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalize slope relative to mean
    const meanY = sumY / n;
    const normalizedSlope = (slope / meanY) * 100;

    if (Math.abs(normalizedSlope) < 1.5) return 'stable';
    return normalizedSlope > 0 ? 'rising' : 'falling';
}

/**
 * Get medical context based on current value and guidelines
 */
function getMedicalContext(vitalType, stats, guideline) {
    const current = stats.current;
    const ctx = {
        status: 'normal',
        target: null,
        guideline: null,
        recommendation: '',
        severity: 'none'
    };

    if (!guideline || guideline.trend_only) {
        // Trend-only vitals (weight, etc)
        ctx.status = stats.trend === 'stable' ? 'stable' : stats.trend;
        if (stats.trend === 'rising') {
            ctx.recommendation = `${guideline.label} trending upward over ${stats.count} readings.`;
        } else if (stats.trend === 'falling') {
            ctx.recommendation = `${guideline.label} trending downward over ${stats.count} readings.`;
        } else {
            ctx.recommendation = `${guideline.label} stable over ${stats.count} readings.`;
        }
        return ctx;
    }

    // Range-based targets (e.g., heart rate 60-100)
    if (guideline.target?.min !== undefined && guideline.target?.max !== undefined) {
        ctx.target = `${guideline.target.min}-${guideline.target.max} ${guideline.unit}`;
        ctx.guideline = guideline.target.guideline;

        if (current < guideline.target.min) {
            ctx.status = 'below_target';
            ctx.severity = 'moderate';
            ctx.recommendation = `${guideline.label} ${current} ${guideline.unit} is below normal range (${ctx.target}).`;
        } else if (current > guideline.target.max) {
            ctx.status = 'above_target';
            ctx.severity = 'moderate';
            ctx.recommendation = `${guideline.label} ${current} ${guideline.unit} is above normal range (${ctx.target}).`;
        } else {
            ctx.recommendation = `${guideline.label} within normal range.`;
        }
        return ctx;
    }

    // Threshold-based targets (e.g., BP < 140)
    if (guideline.target?.value !== undefined) {
        const targetVal = guideline.target.value;
        const op = guideline.target.operator || '<';
        ctx.target = `${op} ${targetVal} ${guideline.unit}`;
        ctx.guideline = guideline.target.guideline;

        const isAboveTarget = (op === '<' && current >= targetVal) || (op === '<=' && current > targetVal);
        const isBelowTarget = (op === '>=' && current < targetVal) || (op === '>' && current <= targetVal);

        if (isAboveTarget || isBelowTarget) {
            ctx.status = isAboveTarget ? 'above_target' : 'below_target';
            const diff = Math.abs(current - targetVal);
            ctx.severity = diff > targetVal * 0.2 ? 'high' : 'moderate';

            let trendNote = '';
            if (stats.trend === 'rising' && isAboveTarget) trendNote = ' and trending upward';
            if (stats.trend === 'falling' && isAboveTarget) trendNote = ' but trending downward';

            ctx.recommendation = `${guideline.label} ${current} ${guideline.unit} is ${round2(diff)} above target (${ctx.target})${trendNote}. ${stats.count} readings over period.`;
        } else {
            ctx.recommendation = `${guideline.label} at target.`;
        }

        // Crisis check
        if (guideline.crisis) {
            const crisisVal = guideline.crisis.value;
            const crisisOp = guideline.crisis.operator || '>=';
            const inCrisis = (crisisOp === '>=' && current >= crisisVal) || (crisisOp === '>' && current > crisisVal);
            if (inCrisis) {
                ctx.status = 'critical';
                ctx.severity = 'high';
                ctx.recommendation = `⚠️ ${guideline.crisis.label}: ${guideline.label} ${current} ${guideline.unit} exceeds ${crisisVal}. Immediate attention recommended.`;
            }
        }
    }

    // Range classification (e.g., BMI categories)
    if (guideline.ranges) {
        const range = guideline.ranges.find(r => current <= r.max);
        if (range) {
            ctx.status = range.label.toLowerCase().replace(/\s+/g, '_');
            ctx.recommendation = `${guideline.label}: ${current} ${guideline.unit} — ${range.label}`;
            ctx.severity = range.label === 'Normal' ? 'none' : 'moderate';
        }
    }

    return ctx;
}

function round2(val) {
    return Math.round(val * 100) / 100;
}

module.exports = {
    VITAL_GUIDELINES,
    analyzeVitalTrend,
    analyzeAllVitals,
    generateTrendSummary
};
