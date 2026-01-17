import React, { useState, useMemo, useEffect } from 'react';
import {
    X, Activity, Heart, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
    AlertCircle, Clock, Pin, PinOff, Stethoscope, FlaskConical, Pill, Calendar,
    Brain, Bone, Eye, FileText, Zap, Droplet, Thermometer, Wind, RefreshCw, Edit3, Plus, ExternalLink,
    Settings, Check, Trash2, Save, Sliders
} from 'lucide-react';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { labsAPI } from '../services/api';

// ============== MASTER LIST OF ALL AVAILABLE TRACKERS ==============
const ALL_TRACKERS = [
    // Vitals
    { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[0] ? parseInt(parts[0]) : null; }, thresholds: { low: 90, high: 140, critical: 180 }, goal: '<130', category: 'Vitals' },
    { id: 'dbp', label: 'Diastolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[1] ? parseInt(parts[1]) : null; }, thresholds: { low: 60, high: 90, critical: 110 }, goal: '<80', category: 'Vitals' },
    { id: 'hr', label: 'Heart Rate', unit: 'bpm', source: 'vitals', vitalKey: 'hr', thresholds: { low: 50, high: 100, critical: 120 }, category: 'Vitals' },
    { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight', category: 'Vitals' },
    { id: 'spo2', label: 'SpO2', unit: '%', source: 'vitals', vitalKey: 'spo2', thresholds: { low: 92, critical: 88 }, category: 'Vitals' },
    { id: 'temp', label: 'Temperature', unit: '°F', source: 'vitals', vitalKey: 'temp', thresholds: { high: 100.4 }, category: 'Vitals' },
    { id: 'rr', label: 'Resp Rate', unit: '/min', source: 'vitals', vitalKey: 'rr', thresholds: { high: 20 }, category: 'Vitals' },
    { id: 'bmi', label: 'BMI', unit: 'kg/m²', source: 'vitals', vitalKey: 'bmi', thresholds: { high: 25, critical: 30 }, category: 'Vitals' },

    // Metabolic Labs
    { id: 'a1c', label: 'HbA1c', unit: '%', source: 'labs', labName: 'a1c', thresholds: { high: 6.5, critical: 9 }, goal: '<7%', category: 'Metabolic' },
    { id: 'glucose', label: 'Glucose', unit: 'mg/dL', source: 'labs', labName: 'glucose', thresholds: { low: 70, high: 100, critical: 200 }, category: 'Metabolic' },
    { id: 'ldl', label: 'LDL', unit: 'mg/dL', source: 'labs', labName: 'ldl', thresholds: { high: 100, critical: 160 }, goal: '<70', category: 'Lipids' },
    { id: 'hdl', label: 'HDL', unit: 'mg/dL', source: 'labs', labName: 'hdl', thresholds: { low: 40 }, goal: '>40', category: 'Lipids' },
    { id: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', source: 'labs', labName: 'triglyceride', thresholds: { high: 150 }, category: 'Lipids' },
    { id: 'cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', source: 'labs', labName: 'cholesterol', thresholds: { high: 200 }, category: 'Lipids' },

    // Renal Labs
    { id: 'cr', label: 'Creatinine', unit: 'mg/dL', source: 'labs', labName: 'creatinine', thresholds: { high: 1.2, critical: 2.0 }, category: 'Renal' },
    { id: 'bun', label: 'BUN', unit: 'mg/dL', source: 'labs', labName: 'bun', thresholds: { high: 20 }, category: 'Renal' },
    { id: 'egfr', label: 'eGFR', unit: 'mL/min', source: 'labs', labName: 'egfr', thresholds: { low: 60, critical: 30 }, category: 'Renal' },
    { id: 'k', label: 'Potassium', unit: 'mEq/L', source: 'labs', labName: 'potassium', thresholds: { low: 3.5, high: 5.0, critical: 5.5 }, category: 'Renal' },
    { id: 'na', label: 'Sodium', unit: 'mEq/L', source: 'labs', labName: 'sodium', thresholds: { low: 136, high: 145 }, category: 'Renal' },
    { id: 'co2', label: 'CO2/Bicarb', unit: 'mEq/L', source: 'labs', labName: 'co2', thresholds: { low: 22, high: 28 }, category: 'Renal' },
    { id: 'calcium', label: 'Calcium', unit: 'mg/dL', source: 'labs', labName: 'calcium', thresholds: { low: 8.5, high: 10.5 }, category: 'Renal' },

    // Liver Labs
    { id: 'ast', label: 'AST', unit: 'U/L', source: 'labs', labName: 'ast', thresholds: { high: 40 }, category: 'Liver' },
    { id: 'alt', label: 'ALT', unit: 'U/L', source: 'labs', labName: 'alt', thresholds: { high: 40 }, category: 'Liver' },
    { id: 'alp', label: 'Alk Phos', unit: 'U/L', source: 'labs', labName: 'alkaline', thresholds: { high: 120 }, category: 'Liver' },
    { id: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL', source: 'labs', labName: 'bilirubin', thresholds: { high: 1.2 }, category: 'Liver' },
    { id: 'albumin', label: 'Albumin', unit: 'g/dL', source: 'labs', labName: 'albumin', thresholds: { low: 3.5 }, category: 'Liver' },
    { id: 'inr', label: 'INR', unit: '', source: 'labs', labName: 'inr', thresholds: { high: 1.5 }, category: 'Coag' },

    // Hematology
    { id: 'hgb', label: 'Hemoglobin', unit: 'g/dL', source: 'labs', labName: 'hemoglobin', thresholds: { low: 12, critical: 8 }, category: 'CBC' },
    { id: 'hct', label: 'Hematocrit', unit: '%', source: 'labs', labName: 'hematocrit', thresholds: { low: 36 }, category: 'CBC' },
    { id: 'wbc', label: 'WBC', unit: 'K/uL', source: 'labs', labName: 'wbc', thresholds: { low: 4, high: 11 }, category: 'CBC' },
    { id: 'plt', label: 'Platelets', unit: 'K/uL', source: 'labs', labName: 'platelet', thresholds: { low: 150 }, category: 'CBC' },
    { id: 'anc', label: 'ANC', unit: 'K/uL', source: 'labs', labName: 'anc', thresholds: { low: 1.5, critical: 0.5 }, category: 'CBC' },

    // Thyroid
    { id: 'tsh', label: 'TSH', unit: 'mIU/L', source: 'labs', labName: 'tsh', thresholds: { low: 0.4, high: 4.0 }, category: 'Thyroid' },
    { id: 'freet4', label: 'Free T4', unit: 'ng/dL', source: 'labs', labName: 't4', thresholds: { low: 0.8, high: 1.8 }, category: 'Thyroid' },

    // Inflammatory
    { id: 'esr', label: 'ESR', unit: 'mm/hr', source: 'labs', labName: 'esr', thresholds: { high: 20 }, category: 'Inflammatory' },
    { id: 'crp', label: 'CRP', unit: 'mg/L', source: 'labs', labName: 'crp', thresholds: { high: 3 }, category: 'Inflammatory' },

    // Other
    { id: 'vitd', label: 'Vitamin D', unit: 'ng/mL', source: 'labs', labName: 'vitamin d', thresholds: { low: 30 }, category: 'Other' },
    { id: 'ferritin', label: 'Ferritin', unit: 'ng/mL', source: 'labs', labName: 'ferritin', thresholds: { low: 30 }, category: 'Other' },
    { id: 'b12', label: 'Vitamin B12', unit: 'pg/mL', source: 'labs', labName: 'b12', thresholds: { low: 200 }, category: 'Other' },
    { id: 'uacr', label: 'UACR', unit: 'mg/g', source: 'labs', labName: 'uacr', thresholds: { high: 30, critical: 300 }, category: 'Renal' },

    // Special Studies (Cardiology)
    { id: 'ef', label: 'EF (Echo/Cath)', unit: '%', source: 'documents', tagKey: 'ef', thresholds: { low: 50, critical: 35 }, category: 'Cardiology' },
    { id: 'mets', label: 'METS (Stress)', unit: '', source: 'documents', tagKey: 'mets', thresholds: { low: 7, critical: 5 }, goal: '>10', category: 'Cardiology' },
    { id: 'pasp', label: 'PASP', unit: 'mmHg', source: 'documents', tagKey: 'pasp', thresholds: { high: 35, critical: 50 }, category: 'Cardiology' },
];

// Get tracker by ID from master list
const getTrackerById = (id) => ALL_TRACKERS.find(t => t.id === id);

// ============== SPECIALTY TEMPLATES ==============
const DEFAULT_SPECIALTY_TEMPLATES = {
    cardiology: {
        id: 'cardiology',
        label: 'Cardiology',
        icon: Heart,
        color: 'rose',
        trackerIds: ['ef', 'sbp', 'dbp', 'hr', 'mets', 'pasp', 'weight', 'ldl', 'a1c', 'cr', 'k'],
        status: [
            { id: 'anticoag', label: 'Anticoagulation', checkMeds: ['warfarin', 'eliquis', 'xarelto', 'pradaxa', 'apixaban', 'rivaroxaban', 'dabigatran', 'coumadin'] },
            { id: 'antiplatelet', label: 'Antiplatelet', checkMeds: ['aspirin', 'plavix', 'clopidogrel', 'brilinta', 'ticagrelor', 'effient', 'prasugrel'] },
        ],
        due: [
            { id: 'lipid_recheck', label: 'Lipid Panel', intervalDays: 90, labName: 'ldl' },
            { id: 'echo_followup', label: 'Echo Follow-up', intervalDays: 365, docType: 'echo' },
        ]
    },
    endocrinology: {
        id: 'endocrinology',
        label: 'Endocrinology',
        icon: Droplet,
        color: 'purple',
        trackerIds: ['a1c', 'glucose', 'tsh', 'weight', 'sbp', 'ldl'],
        status: [
            { id: 'insulin', label: 'Insulin Regimen', checkMeds: ['insulin', 'lantus', 'humalog', 'novolog', 'levemir', 'tresiba', 'basaglar', 'toujeo'] },
        ],
        due: [
            { id: 'a1c_due', label: 'HbA1c', intervalDays: 90, labName: 'a1c' },
        ]
    },
    primary_care: {
        id: 'primary_care',
        label: 'Primary Care',
        icon: Stethoscope,
        color: 'blue',
        trackerIds: ['sbp', 'hr', 'weight', 'spo2', 'a1c', 'ldl'],
        status: [],
        due: [
            // Cancer Screenings
            { id: 'mammogram', label: 'Mammogram', intervalDays: 365, gender: 'female', minAge: 40, maxAge: 74, docKeywords: ['mammogram', 'breast tomosynthesis'] },
            { id: 'colonoscopy', label: 'Colonoscopy', intervalDays: 3650, minAge: 45, maxAge: 75, docKeywords: ['colonoscopy', 'cologuard', 'fit test'] },
            { id: 'pap_smear', label: 'Pap Smear', intervalDays: 1095, gender: 'female', minAge: 21, maxAge: 65, docKeywords: ['pap', 'cervical', 'hpv'] },
            { id: 'lung_ca_screen', label: 'Lung CT', intervalDays: 365, minAge: 50, maxAge: 80, docKeywords: ['lung screening', 'low dose ct', 'ldct'] }, // Note: Usually requires smoking history
            { id: 'aaa_screen', label: 'AAA Ultrasound', intervalDays: 99999, gender: 'male', minAge: 65, maxAge: 75, docKeywords: ['aaa', 'abdominal aortic aneurysm', 'aorta ultrasound'] }, // Once
            { id: 'dexa', label: 'Bone Density', intervalDays: 730, gender: 'female', minAge: 65, docKeywords: ['dexa', 'bone density'] },

            // Vaccines
            { id: 'flu_vaccine', label: 'Flu Vaccine', intervalDays: 365, docKeywords: ['flu', 'influenza', 'fluzone'] },
            { id: 'tdap', label: 'Tdap/Td', intervalDays: 3650, docKeywords: ['tdap', 'tetanus', 'adacel', 'boostrix'] },
            { id: 'shingles', label: 'Shingles vax', intervalDays: 99999, minAge: 50, docKeywords: ['shingrix', 'zoster'] }, // Series, check if ever done
            { id: 'pneumonia', label: 'Pneumonia vax', intervalDays: 99999, minAge: 65, docKeywords: ['prevnar', 'pneumovax', 'pneumococcal'] },
            { id: 'covid', label: 'COVID-19 vax', intervalDays: 365, docKeywords: ['covid', 'sars-cov-2', 'moderna', 'pfizer'] },

            // Metabolic
            { id: 'a1c_screen', label: 'HbA1c', intervalDays: 365, minAge: 35, maxAge: 70, labName: 'a1c' },
            { id: 'lipid_screen', label: 'Lipid Panel', intervalDays: 1825, minAge: 40, maxAge: 75, labName: 'ldl' },
        ]
    },
    nephrology: {
        id: 'nephrology',
        label: 'Nephrology',
        icon: Droplet,
        color: 'amber',
        trackerIds: ['cr', 'bun', 'egfr', 'k', 'sbp', 'hgb'],
        status: [
            { id: 'ace_arb', label: 'ACE/ARB Use', checkMeds: ['lisinopril', 'enalapril', 'losartan', 'valsartan', 'irbesartan', 'olmesartan', 'ramipril', 'benazepril'] },
        ],
        due: [
            { id: 'ckd_labs', label: 'CKD Labs', intervalDays: 90, labName: 'creatinine' },
        ]
    },
    gastroenterology: {
        id: 'gastroenterology',
        label: 'Gastroenterology',
        icon: Activity,
        color: 'orange',
        trackerIds: ['ast', 'alt', 'albumin', 'bilirubin', 'hgb', 'inr'],
        status: [],
        due: [
            { id: 'colonoscopy_surveillance', label: 'Colonoscopy', intervalDays: 1825 },
        ]
    },
    rheumatology: {
        id: 'rheumatology',
        label: 'Rheumatology',
        icon: Bone,
        color: 'indigo',
        trackerIds: ['esr', 'crp', 'wbc', 'hgb', 'plt'],
        status: [
            { id: 'dmard', label: 'DMARD/Biologic', checkMeds: ['methotrexate', 'humira', 'enbrel', 'remicade', 'adalimumab', 'etanercept'] },
            { id: 'steroid', label: 'Steroid Use', checkMeds: ['prednisone', 'methylprednisolone', 'dexamethasone'] },
        ],
        due: []
    },
    hematology_oncology: {
        id: 'hematology_oncology',
        label: 'Heme/Onc',
        icon: FlaskConical,
        color: 'red',
        trackerIds: ['hgb', 'wbc', 'plt', 'anc', 'ferritin'],
        status: [],
        due: [
            { id: 'cbc_monitoring', label: 'CBC Monitoring', intervalDays: 14 },
        ]
    },
    custom: {
        id: 'custom',
        label: '⚙️ Custom',
        icon: Sliders,
        color: 'slate',
        trackerIds: [],  // User fills this
        status: [],
        due: []
    }
};

// Helper to parse vital value
const parseVitalValue = (value) => {
    if (value === null || value === undefined || value === 'N/A' || value === '' || value === '-') return null;
    const numStr = String(value).replace(/[^0-9.-]/g, '');
    const num = parseFloat(numStr);
    return isNaN(num) ? null : num;
};

// Parse date safely
const parseDateSafe = (dateStr) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
};

// ============== MINI SPARKLINE COMPONENT ==============
const MiniSparkline = ({ data, color = 'blue', width = 50, height = 16 }) => {
    if (!data || data.length < 2) return <div className="w-[50px] h-[16px] border-b border-slate-100 opacity-30" />;
    const values = data.map(d => parseFloat(d.value) || 0).filter(v => !isNaN(v) && v !== 0);
    if (values.length < 2) return <div className="w-[50px] h-[16px] border-b border-slate-100 opacity-30" />;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * width;
        const y = height - ((v - min) / range) * height;
        return { x, y };
    });

    let linePath = points.reduce((path, point, i) => {
        if (i === 0) return `M ${point.x} ${point.y}`;
        const prev = points[i - 1];
        const cp1x = prev.x + (point.x - prev.x) / 2;
        return `${path} C ${cp1x} ${prev.y}, ${cp1x} ${point.y}, ${point.x} ${point.y}`;
    }, '');

    // If only one point, show a small horizontal dash
    if (values.length === 1) {
        linePath = `M 0 ${height / 2} L ${width} ${height / 2}`;
    }

    const strokeColor = color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : color === 'amber' ? '#f59e0b' : '#3b82f6';

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
            />
        </svg>
    );
};

// ============== TREND CARD COMPONENT ==============
const TrendCard = ({ trend, data, onClick, onRemove, editable, onDragStart, onDragOver, onDrop }) => {
    const latest = data[0];
    const previous = data[1];
    const value = latest?.value;
    const prevValue = previous?.value;
    const date = latest?.date;

    let delta = null;
    let deltaType = 'neutral';
    if (value != null && prevValue != null) {
        const diff = parseFloat(value) - parseFloat(prevValue);
        if (!isNaN(diff) && diff !== 0) {
            delta = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
            deltaType = diff > 0 ? 'up' : 'down';
        }
    }

    let statusColor = 'slate';
    if (trend.thresholds && value != null) {
        const v = parseFloat(value);
        if (!isNaN(v)) {
            if (trend.thresholds.critical && v >= trend.thresholds.critical) statusColor = 'rose';
            else if (trend.thresholds.high && v >= trend.thresholds.high) statusColor = 'amber';
            else if (trend.thresholds.low && v <= trend.thresholds.low) statusColor = 'amber';
            // Specific for EF/METS where high is good
            else if (trend.id === 'ef' || trend.id === 'mets') {
                if (v < (trend.thresholds.critical || 0)) statusColor = 'rose';
                else if (v < (trend.thresholds.low || 0)) statusColor = 'amber';
                else statusColor = 'emerald';
            }
            else statusColor = 'emerald';
        }
    }

    const colorMap = {
        rose: { bg: 'bg-rose-50/20', border: 'border-rose-100', text: 'text-rose-600', value: 'text-slate-900', spark: 'rose', indicator: 'bg-rose-400' },
        amber: { bg: 'bg-amber-50/20', border: 'border-amber-100', text: 'text-amber-600', value: 'text-slate-900', spark: 'amber', indicator: 'bg-amber-400' },
        emerald: { bg: 'bg-emerald-50/20', border: 'border-emerald-100', text: 'text-emerald-600', value: 'text-slate-900', spark: 'emerald', indicator: 'bg-emerald-400' },
        slate: { bg: 'bg-slate-50/20', border: 'border-slate-100', text: 'text-slate-400', value: 'text-slate-900', spark: 'slate', indicator: 'bg-slate-200' },
    };
    const colors = colorMap[statusColor];
    const displayValue = value != null ? (typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value) : '--';
    const parsedDate = parseDateSafe(date);

    return (
        <div
            draggable={editable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`${colors.bg} ${colors.border} border rounded-xl p-3 text-left hover:shadow-md hover:border-slate-200 transition-all group w-full relative ${editable ? 'cursor-move ring-2 ring-blue-500/10 shadow-sm border-blue-200' : ''}`}
        >
            <div className={`absolute top-3 left-0 w-0.5 h-4 rounded-r-full ${colors.indicator}`} />

            {editable && (
                <div className="absolute top-1 left-2 opacity-30 group-hover:opacity-100 transition-opacity">
                    <div className="grid grid-cols-2 gap-0.5">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-slate-300" />)}
                    </div>
                </div>
            )}
            {editable && onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(trend.id); }}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-white border border-slate-100 text-slate-400 rounded-full shadow-sm hover:bg-rose-500 hover:text-white transition-colors z-10"
                >
                    <X className="w-2.5 h-2.5" />
                </button>
            )}
            <button onClick={onClick} className="w-full text-left">
                <div className="flex justify-between items-start mb-0.5 overflow-hidden">
                    <span className={`text-[9.5px] font-black text-slate-500 uppercase tracking-tighter truncate leading-none mr-2 ${editable ? 'ml-4' : 'ml-1'}`}>{trend.label}</span>
                    {trend.goal && <span className="text-[7.5px] font-black text-slate-300 uppercase tracking-widest shrink-0 mt-0.5">Goal {trend.goal}</span>}
                </div>
                <div className="flex items-end justify-between min-w-0">
                    <div className="min-w-0 flex-1">
                        <div className={`text-xl font-black ${colors.value} tabular-nums leading-none tracking-tighter flex items-baseline gap-0.5`}>
                            {displayValue}<span className="text-[9px] font-black text-slate-400 leading-none uppercase tracking-tighter">{trend.unit}</span>
                        </div>
                        {delta && (
                            <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1.5 ${deltaType === 'up' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {deltaType === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {delta}
                            </div>
                        )}
                        {!delta && <div className="h-4" />}
                    </div>
                    <div className="flex flex-col items-end shrink-0 pointer-events-none mb-0.5">
                        <MiniSparkline data={data} color={colors.spark} />
                        {parsedDate && <span className="text-[9px] font-medium text-slate-300 mt-1 uppercase tracking-tighter">{format(parsedDate, 'M/d')}</span>}
                    </div>
                </div>
            </button>
        </div>
    );
};

// ============== DUE ITEM COMPONENT ==============
const DueItem = ({ item, lastDate, overdue }) => {
    const parsedDate = parseDateSafe(lastDate);
    return (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${overdue ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 ${overdue ? 'text-rose-500' : 'text-amber-500'}`} />
                <span className={`text-xs font-medium ${overdue ? 'text-rose-700' : 'text-amber-700'}`}>{item.label}</span>
            </div>
            <span className={`text-[10px] font-bold ${overdue ? 'text-rose-600' : 'text-amber-600'}`}>
                {overdue ? 'OVERDUE' : parsedDate ? `Last: ${format(parsedDate, 'M/d/yy')}` : 'Due'}
            </span>
        </div>
    );
};

// ============== TRACKER PICKER MODAL ==============
const TrackerPickerModal = ({ isOpen, onClose, currentTrackerIds, onSave }) => {
    const [selected, setSelected] = useState(new Set(currentTrackerIds));

    useEffect(() => {
        setSelected(new Set(currentTrackerIds));
    }, [currentTrackerIds, isOpen]);

    const toggleTracker = (id) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelected(newSelected);
    };

    const handleSave = () => {
        onSave(Array.from(selected));
        onClose();
    };

    // Group trackers by category
    const grouped = useMemo(() => {
        const groups = {};
        ALL_TRACKERS.forEach(t => {
            if (!groups[t.category]) groups[t.category] = [];
            groups[t.category].push(t);
        });
        return groups;
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Customize Trackers</h3>
                        <p className="text-xs text-slate-500">Select which metrics to display ({selected.size} selected)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-4 max-h-[50vh] overflow-y-auto">
                    {Object.entries(grouped).map(([category, trackers]) => (
                        <div key={category} className="mb-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{category}</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {trackers.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => toggleTracker(t.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${selected.has(t.id)
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center ${selected.has(t.id) ? 'bg-blue-500' : 'border border-slate-300'}`}>
                                            {selected.has(t.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-medium">{t.label}</div>
                                            <div className="text-[10px] text-slate-400">{t.unit}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1.5">
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============== DETAIL VIEW MODAL ==============
const TrendDetailView = ({ trend, data, onClose }) => {
    if (!trend) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300 border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wider rounded border border-blue-100">
                                {trend.category || 'Specialty'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{trend.label}</h2>
                        <div className="flex items-center gap-2 mt-1.5">
                            <Activity className="w-3.5 h-3.5 text-blue-500" />
                            <p className="text-[11px] font-semibold text-slate-500">{data.length} measurements analyzed</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {data.length > 0 && (() => {
                        const chartData = data.slice(0, 10).reverse();
                        const values = chartData.map(d => parseFloat(d.value) || 0);
                        const max = Math.max(...values) || 1;
                        const min = Math.min(...values) * 0.95;
                        const range = (max - min) || 1;
                        const width = 100;
                        const height = 80;
                        const padding = 10;

                        const points = values.map((val, i) => {
                            const x = padding + (i / Math.max(values.length - 1, 1)) * (width - padding * 2);
                            const y = height - padding - ((val - min) / range) * (height - padding * 2);
                            return { x, y };
                        });

                        // Create smooth curve path
                        let linePath = points.reduce((path, point, i) => {
                            if (i === 0) return `M ${point.x} ${point.y}`;
                            const prev = points[i - 1];
                            const cp1x = prev.x + (point.x - prev.x) / 2;
                            return `${path} C ${cp1x} ${prev.y}, ${cp1x} ${point.y}, ${point.x} ${point.y}`;
                        }, '');

                        if (points.length === 1) {
                            linePath = `M ${points[0].x - 5} ${points[0].y} L ${points[0].x + 5} ${points[0].y}`;
                        }

                        const areaPath = `${linePath} L ${points[points.length - 1]?.x} ${height} L ${points[0]?.x} ${height} Z`;

                        // Decide which labels to show to prevent overlap
                        // For max-w-sm, we can safely show about 4-5 labels
                        const labelIndices = [];
                        if (chartData.length > 0) {
                            labelIndices.push(0);
                            if (chartData.length > 2) labelIndices.push(Math.floor(chartData.length / 2));
                            if (chartData.length > 1) labelIndices.push(chartData.length - 1);
                        }

                        return (
                            <div className="bg-slate-50/50 border-y border-slate-100 p-6 flex flex-col gap-6">
                                <div className="h-32 w-full relative">
                                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="detailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d={areaPath} fill="url(#detailGradient)" />
                                        <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        {points.map((point, i) => (
                                            <circle key={i} cx={point.x} cy={point.y} r="2.5" fill="white" stroke="#2563EB" strokeWidth="2" shadow="0 2px 4px rgba(0,0,0,0.1)" />
                                        ))}
                                    </svg>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    {chartData.map((d, i) => {
                                        const showLabel = labelIndices.includes(i);
                                        const parsedDate = parseDateSafe(d.date);
                                        return (
                                            <div key={i} className={`flex flex-col items-center gap-1 transition-opacity ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {parsedDate ? format(parsedDate, 'M/d') : ''}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                                                    {d.value}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                    <div className="p-4 bg-white">
                        <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                            {data.length > 0 ? data.map((d, i) => {
                                const parsedDate = parseDateSafe(d.date);
                                return (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-black text-slate-900 tabular-nums leading-tight">
                                                {d.value} <span className="text-slate-400 font-bold">{trend.unit}</span>
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{parsedDate ? format(parsedDate, 'MMM d, yyyy') : '--'}</span>
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white px-1.5 py-0.5 rounded border border-slate-100">{d.source || 'Chart'}</span>
                                    </div>
                                );
                            }) : <div className="text-center text-slate-400 py-4">No data available</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============== MAIN SPECIALTY TRACKER COMPONENT ==============
const SpecialtyTracker = ({ isOpen, onClose, patientId, patientData, vitals = [], labs = [], medications = [], documents = [], problems = [], onOpenChart }) => {
    const [selectedSpecialty, setSelectedSpecialty] = useState('cardiology');
    const [timeRange, setTimeRange] = useState(90);
    const [isPinned, setIsPinned] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [selectedTrend, setSelectedTrend] = useState(null);
    const [selectedTrendData, setSelectedTrendData] = useState([]);
    const [labResults, setLabResults] = useState([]);
    const [loadingLabs, setLoadingLabs] = useState(false);
    const [showTrackerPicker, setShowTrackerPicker] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Custom tracker preferences (persisted in localStorage)
    const [customPrefs, setCustomPrefs] = useState(() => {
        try {
            const saved = localStorage.getItem('specialty_tracker_prefs');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    // Save preferences when they change
    useEffect(() => {
        localStorage.setItem('specialty_tracker_prefs', JSON.stringify(customPrefs));
    }, [customPrefs]);

    // Get current specialty config (with custom overrides)
    const specialty = useMemo(() => {
        const base = DEFAULT_SPECIALTY_TEMPLATES[selectedSpecialty];
        if (!base) return null;
        const customTrackerIds = customPrefs[selectedSpecialty];
        return {
            ...base,
            trackerIds: customTrackerIds || base.trackerIds
        };
    }, [selectedSpecialty, customPrefs]);

    // Get tracker objects from IDs
    const activeTrackers = useMemo(() => {
        if (!specialty) return [];
        return specialty.trackerIds.map(id => getTrackerById(id)).filter(Boolean);
    }, [specialty]);

    // Fetch lab results
    useEffect(() => {
        const fetchLabs = async () => {
            if (!patientId || !isOpen) return;
            setLoadingLabs(true);
            try {
                const response = await labsAPI.getByPatient(patientId);
                setLabResults(response.data || []);
            } catch (err) {
                console.error('Error fetching labs:', err);
                setLabResults([]);
            } finally {
                setLoadingLabs(false);
            }
        };
        fetchLabs();
    }, [patientId, isOpen]);

    // Extract trend data
    const extractTrendData = useMemo(() => {
        if (!specialty) return {};
        const trendData = {};

        activeTrackers.forEach(trend => {
            const data = [];
            if (trend.source === 'vitals' && vitals.length > 0) {
                vitals.forEach(v => {
                    let value = null;
                    if (trend.extractor) value = trend.extractor(v);
                    else if (trend.vitalKey) value = parseVitalValue(v[trend.vitalKey]);
                    if (value !== null) data.push({ value, date: v.date || v.created_at || v.visit_date, source: 'Vitals' });
                });
            }
            if (trend.source === 'labs' && labResults.length > 0) {
                const searchTerm = (trend.labName || trend.label).toLowerCase();
                labResults.forEach(lab => {
                    const testName = (lab.test_name || lab.name || '').toLowerCase();
                    const component = (lab.component || '').toLowerCase();
                    if (testName.includes(searchTerm) || component.includes(searchTerm) || searchTerm.includes(testName)) {
                        const value = parseFloat(lab.result_value || lab.value);
                        if (!isNaN(value)) data.push({ value, date: lab.result_date || lab.collected_date || lab.created_at, source: lab.test_name || 'Lab' });
                    }
                });
            }
            if (trend.source === 'documents' && documents.length > 0) {
                documents.forEach(doc => {
                    const tags = doc.tags || [];
                    const tag = tags.find(t => t.startsWith(`${trend.tagKey}:`));
                    if (tag) {
                        const valStr = tag.split(':')[1];
                        const value = parseFloat(valStr);
                        if (!isNaN(value)) {
                            data.push({
                                value,
                                date: doc.created_at || doc.date,
                                source: doc.file_name || doc.doc_type || 'Document'
                            });
                        }
                    }
                });
            }
            data.sort((a, b) => {
                const dateA = parseDateSafe(a.date);
                const dateB = parseDateSafe(b.date);
                return (dateB || 0) - (dateA || 0);
            });
            trendData[trend.id] = data.slice(0, 10);
        });
        return trendData;
    }, [specialty, activeTrackers, vitals, labResults, documents]);

    // Medication status
    const medicationStatus = useMemo(() => {
        if (!specialty?.status) return {};
        const status = {};
        specialty.status.forEach(s => {
            const activeMeds = medications.filter(m => {
                const medName = (m.medication_name || m.name || '').toLowerCase();
                return m.active !== false && s.checkMeds.some(check => medName.includes(check.toLowerCase()));
            });
            status[s.id] = { active: activeMeds.length > 0, meds: activeMeds };
        });
        return status;
    }, [specialty, medications]);

    // Due items
    const dueItems = useMemo(() => {
        if (!specialty?.due) return [];
        const items = [];
        const now = new Date();

        // Calculate patient demographics
        const dob = parseDateSafe(patientData?.dob || patientData?.birth_date);
        const age = dob ? differenceInDays(now, dob) / 365.25 : 0;
        const pGender = (patientData?.sex || patientData?.gender || '').toLowerCase();
        const isFemale = pGender === 'female' || pGender === 'f' || pGender === 'woman';
        const isMale = pGender === 'male' || pGender === 'm' || pGender === 'man';

        specialty.due.forEach(due => {
            // 1. Check Gender Constraints
            if (due.gender === 'female' && !isFemale) return;
            if (due.gender === 'male' && !isMale) return;

            // 2. Check Age Constraints
            if (due.minAge && age < due.minAge) return;
            if (due.maxAge && age > due.maxAge) return;

            let lastDate = null;
            let overdue = false;

            // 3. Check Labs
            if (due.labName && labResults.length > 0) {
                const searchTerm = due.labName.toLowerCase();
                const matchingLabs = labResults.filter(lab => (lab.test_name || '').toLowerCase().includes(searchTerm));
                if (matchingLabs.length > 0) {
                    matchingLabs.sort((a, b) => (parseDateSafe(b.result_date) || 0) - (parseDateSafe(a.result_date) || 0));
                    lastDate = matchingLabs[0].result_date || matchingLabs[0].created_at;
                }
            }

            // 4. Check Documents (e.g. Colonoscopy reports)
            if (due.docKeywords && documents && documents.length > 0) {
                const keywords = due.docKeywords;
                const matchingDocs = documents.filter(d => {
                    const text = ((d.filename || '') + ' ' + (d.doc_type || '') + ' ' + (d.tags || '')).toLowerCase();
                    return keywords.some(k => text.includes(k.toLowerCase()));
                });

                if (matchingDocs.length > 0) {
                    matchingDocs.sort((a, b) => (parseDateSafe(b.created_at || b.date) || 0) - (parseDateSafe(a.created_at || a.date) || 0));
                    const docDate = matchingDocs[0].created_at || matchingDocs[0].date;
                    // Use the most recent date found from either labs or docs
                    if (!lastDate || (docDate && new Date(docDate) > new Date(lastDate))) {
                        lastDate = docDate;
                    }
                }
            }

            // 5. Determine Overdue Status
            if (lastDate) {
                const parsedDate = parseDateSafe(lastDate);
                if (parsedDate) overdue = differenceInDays(now, parsedDate) > due.intervalDays;
            } else {
                overdue = true; // Never done
            }
            items.push({ ...due, lastDate, overdue });
        });
        return items.slice(0, 10);
    }, [specialty, labResults, documents, patientData]);

    const visibleTrends = showMore ? activeTrackers : activeTrackers.slice(0, 8);

    const handleTrendClick = (trend) => {
        setSelectedTrend(trend);
        setSelectedTrendData(extractTrendData[trend.id] || []);
    };

    const handleEditVitals = () => { if (onOpenChart) { onOpenChart('vitals'); onClose(); } };
    const handleEditMedications = () => { if (onOpenChart) { onOpenChart('medications'); onClose(); } };
    const handleEditLabs = () => { if (onOpenChart) { onOpenChart('labs'); onClose(); } };

    const handleSaveTrackers = (newTrackerIds) => {
        setCustomPrefs(prev => ({ ...prev, [selectedSpecialty]: newTrackerIds }));
    };

    const handleReorder = (dragIndex, dropIndex) => {
        const newIds = [...specialty.trackerIds];
        const draggedItem = newIds[dragIndex];
        newIds.splice(dragIndex, 1);
        newIds.splice(dropIndex, 0, draggedItem);
        setCustomPrefs(prev => ({ ...prev, [selectedSpecialty]: newIds }));
    };

    const [draggedIndex, setDraggedIndex] = useState(null);

    const handleRemoveTracker = (trackerId) => {
        const newIds = specialty.trackerIds.filter(id => id !== trackerId);
        setCustomPrefs(prev => ({ ...prev, [selectedSpecialty]: newIds }));
    };

    const handleResetToDefault = () => {
        setCustomPrefs(prev => {
            const newPrefs = { ...prev };
            delete newPrefs[selectedSpecialty];
            return newPrefs;
        });
    };

    if (!isOpen) return null;

    const Icon = specialty?.icon || Activity;
    const dataCount = Object.values(extractTrendData).reduce((sum, arr) => sum + arr.length, 0);
    const isCustomized = !!customPrefs[selectedSpecialty];

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[80]" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-[90] flex flex-col animate-slide-left">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-rose-100"><Icon className="w-5 h-5 text-rose-600" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Specialty Tracker</h2>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">At-a-glance trends</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {loadingLabs && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                            <button onClick={() => setEditMode(!editMode)} className={`p-2 rounded-lg transition-colors ${editMode ? 'bg-amber-100 text-amber-600' : 'hover:bg-slate-100 text-slate-400'}`} title="Edit mode">
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsPinned(!isPinned)} className={`p-2 rounded-lg transition-colors ${isPinned ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}>
                                {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 transition-all outline-none">
                            {Object.values(DEFAULT_SPECIALTY_TEMPLATES).map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                        <button onClick={() => setShowTrackerPicker(true)} className="px-3 py-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors" title="Customize trackers">
                            <Settings className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                    {isCustomized && (
                        <div className="mt-3 flex items-center justify-between px-3 py-2 bg-blue-50/30 rounded-lg border border-blue-100/50">
                            <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" /> Customized layout
                            </span>
                            <button onClick={handleResetToDefault} className="text-[10px] text-blue-500 font-bold hover:underline">Reset</button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <button onClick={handleEditVitals} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Add Vitals
                        </button>
                        <button onClick={handleEditLabs} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors">
                            <FlaskConical className="w-3.5 h-3.5" /> Labs
                        </button>
                        <button onClick={handleEditMedications} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors">
                            <Pill className="w-3.5 h-3.5" /> Meds
                        </button>
                    </div>

                    {/* Trends */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5" /> Top Trends
                            </h3>
                            <div className="flex items-center gap-2">
                                {activeTrackers.length > 8 && (
                                    <button onClick={() => setShowMore(!showMore)} className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5">
                                        {showMore ? 'Less' : `All (${activeTrackers.length})`}
                                        <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                                <button onClick={() => setShowTrackerPicker(true)} className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-0.5">
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {visibleTrends.map((trend, idx) => (
                                <TrendCard
                                    key={trend.id}
                                    trend={trend}
                                    data={extractTrendData[trend.id] || []}
                                    onClick={() => handleTrendClick(trend)}
                                    onRemove={editMode ? handleRemoveTracker : null}
                                    editable={editMode}
                                    onDragStart={() => setDraggedIndex(idx)}
                                    onDragOver={(e) => { e.preventDefault(); }}
                                    onDrop={() => {
                                        if (draggedIndex !== null && draggedIndex !== idx) {
                                            handleReorder(draggedIndex, idx);
                                        }
                                        setDraggedIndex(null);
                                    }}
                                />
                            ))}
                            {activeTrackers.length === 0 && (
                                <div className="col-span-2 text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                    <p className="text-sm text-slate-500 mb-2">No trackers configured</p>
                                    <button onClick={() => setShowTrackerPicker(true)} className="text-xs text-blue-600 font-semibold hover:underline">
                                        + Add Trackers
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    {specialty?.status?.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Pill className="w-3.5 h-3.5" /> Therapy Status</h3>
                                <button onClick={handleEditMedications} className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"><Edit3 className="w-3 h-3" /> Edit</button>
                            </div>
                            <div className="space-y-2">
                                {specialty.status.map(s => {
                                    const status = medicationStatus[s.id];
                                    return (
                                        <div key={s.id} onClick={handleEditMedications} className={`rounded-lg cursor-pointer hover:shadow-sm transition-all ${status?.active ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                                            <div className="flex items-center justify-between px-3 py-2">
                                                <span className={`text-xs font-semibold ${status?.active ? 'text-emerald-700' : 'text-slate-500'}`}>{s.label}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                    {status?.active ? '✓ ACTIVE' : 'NOT ON'}
                                                </span>
                                            </div>
                                            {status?.active && status.meds.length > 0 && (
                                                <div className="px-3 pb-2 space-y-1 border-t border-emerald-100 pt-2 mt-0.5">
                                                    {status.meds.map((med, idx) => {
                                                        const name = med.medication_name || med.name || '';
                                                        const dosage = med.dosage || '';
                                                        const frequency = med.frequency || '';
                                                        return (
                                                            <div key={idx} className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                <span className="text-[11px] text-emerald-800 font-medium">{name}</span>
                                                                {(dosage || frequency) && (
                                                                    <span className="text-[10px] text-emerald-600">{dosage} {frequency}</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Due Items */}
                    {dueItems.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Clock className="w-3.5 h-3.5" /> Due Soon / Overdue</h3>
                            <div className="space-y-2">{dueItems.map(item => <DueItem key={item.id} item={item} lastDate={item.lastDate} overdue={item.overdue} />)}</div>
                        </div>
                    )}

                    {dataCount === 0 && activeTrackers.length > 0 && !loadingLabs && (
                        <div className="text-center py-8">
                            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No trend data available</p>
                            <button onClick={handleEditVitals} className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5 inline mr-1" />Add Vitals</button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-[10px] text-slate-400 text-center">
                        {vitals.length} vitals, {labResults.length} labs • {activeTrackers.length} trackers active
                    </div>
                </div>
            </div>

            {showTrackerPicker && (
                <TrackerPickerModal
                    isOpen={showTrackerPicker}
                    onClose={() => setShowTrackerPicker(false)}
                    currentTrackerIds={specialty?.trackerIds || []}
                    onSave={handleSaveTrackers}
                />
            )}

            {selectedTrend && <TrendDetailView trend={selectedTrend} data={selectedTrendData} onClose={() => setSelectedTrend(null)} />}

            <style>{`
                @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .animate-slide-left { animation: slide-left 0.3s ease-out; }
            `}</style>
        </>
    );
};

export default SpecialtyTracker;
