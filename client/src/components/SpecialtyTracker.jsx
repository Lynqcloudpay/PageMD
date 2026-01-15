import React, { useState, useMemo, useEffect } from 'react';
import {
    X, Activity, Heart, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
    AlertCircle, Clock, Pin, PinOff, Stethoscope, FlaskConical, Pill, Calendar,
    Brain, Bone, Eye, FileText, Zap, Droplet, Thermometer, Wind, RefreshCw
} from 'lucide-react';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { labsAPI } from '../services/api';

// ============== SPECIALTY TEMPLATES ==============
// Each specialty defines: trends (cards), due rules (screenings), events (procedures)

const SPECIALTY_TEMPLATES = {
    cardiology: {
        id: 'cardiology',
        label: 'Cardiology',
        icon: Heart,
        color: 'rose',
        trends: [
            { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[0] ? parseInt(parts[0]) : null; }, thresholds: { low: 90, high: 140, critical: 180 }, goal: '<130' },
            { id: 'dbp', label: 'Diastolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[1] ? parseInt(parts[1]) : null; }, thresholds: { low: 60, high: 90, critical: 110 }, goal: '<80' },
            { id: 'hr', label: 'Heart Rate', unit: 'bpm', source: 'vitals', vitalKey: 'hr', thresholds: { low: 50, high: 100, critical: 120 } },
            { id: 'ef', label: 'EF (Echo)', unit: '%', source: 'documents', docType: 'echo', field: 'ef', thresholds: { low: 40, critical: 30 }, goal: '>55%' },
            { id: 'bnp', label: 'BNP', unit: 'pg/mL', source: 'labs', labName: 'bnp', thresholds: { high: 100, critical: 400 } },
            { id: 'ldl', label: 'LDL', unit: 'mg/dL', source: 'labs', labName: 'ldl', thresholds: { high: 100, critical: 160 }, goal: '<70' },
            { id: 'a1c', label: 'HbA1c', unit: '%', source: 'labs', labName: 'a1c', thresholds: { high: 6.5, critical: 9 }, goal: '<7%' },
            { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight' },
            { id: 'cr', label: 'Creatinine', unit: 'mg/dL', source: 'labs', labName: 'creatinine', thresholds: { high: 1.2, critical: 2.0 } },
            { id: 'k', label: 'Potassium', unit: 'mEq/L', source: 'labs', labName: 'potassium', thresholds: { low: 3.5, high: 5.0, critical: 5.5 } },
        ],
        status: [
            { id: 'anticoag', label: 'Anticoagulation', checkMeds: ['warfarin', 'eliquis', 'xarelto', 'pradaxa', 'apixaban', 'rivaroxaban', 'dabigatran', 'coumadin'] },
            { id: 'antiplatelet', label: 'Antiplatelet', checkMeds: ['aspirin', 'plavix', 'clopidogrel', 'brilinta', 'ticagrelor', 'effient', 'prasugrel'] },
        ],
        events: ['cardiac_cath', 'pci', 'cabg', 'echo', 'stress_test', 'icd_implant', 'pacemaker', 'ekg', 'echocardiogram'],
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
        trends: [
            { id: 'a1c', label: 'HbA1c', unit: '%', source: 'labs', labName: 'a1c', thresholds: { high: 7, critical: 9 }, goal: '<7%' },
            { id: 'fasting_glucose', label: 'Fasting Glucose', unit: 'mg/dL', source: 'labs', labName: 'glucose', thresholds: { low: 70, high: 100, critical: 200 } },
            { id: 'tsh', label: 'TSH', unit: 'mIU/L', source: 'labs', labName: 'tsh', thresholds: { low: 0.4, high: 4.0 } },
            { id: 'freet4', label: 'Free T4', unit: 'ng/dL', source: 'labs', labName: 't4', thresholds: { low: 0.8, high: 1.8 } },
            { id: 'calcium', label: 'Calcium', unit: 'mg/dL', source: 'labs', labName: 'calcium', thresholds: { low: 8.5, high: 10.5 } },
            { id: 'vitd', label: 'Vitamin D', unit: 'ng/mL', source: 'labs', labName: 'vitamin d', thresholds: { low: 30 } },
            { id: 'ldl', label: 'LDL', unit: 'mg/dL', source: 'labs', labName: 'ldl', thresholds: { high: 100 }, goal: '<100' },
            { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight' },
            { id: 'bmi', label: 'BMI', unit: 'kg/m²', source: 'vitals', vitalKey: 'bmi', thresholds: { high: 25, critical: 30 } },
            { id: 'uacr', label: 'UACR', unit: 'mg/g', source: 'labs', labName: 'uacr', thresholds: { high: 30, critical: 300 } },
        ],
        status: [
            { id: 'insulin', label: 'Insulin Regimen', checkMeds: ['insulin', 'lantus', 'humalog', 'novolog', 'levemir', 'tresiba', 'basaglar', 'toujeo'] },
        ],
        events: ['dexa', 'thyroid_us'],
        due: [
            { id: 'a1c_due', label: 'HbA1c', intervalDays: 90, labName: 'a1c' },
            { id: 'eye_exam', label: 'Diabetic Eye Exam', intervalDays: 365 },
            { id: 'foot_exam', label: 'Diabetic Foot Exam', intervalDays: 365 },
        ]
    },
    primary_care: {
        id: 'primary_care',
        label: 'Primary Care',
        icon: Stethoscope,
        color: 'blue',
        trends: [
            { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[0] ? parseInt(parts[0]) : null; }, thresholds: { high: 130, critical: 180 }, goal: '<130' },
            { id: 'bmi', label: 'BMI', unit: 'kg/m²', source: 'vitals', vitalKey: 'bmi', thresholds: { high: 25, critical: 30 } },
            { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight' },
            { id: 'a1c', label: 'HbA1c', unit: '%', source: 'labs', labName: 'a1c', thresholds: { high: 5.7, critical: 6.5 } },
            { id: 'ldl', label: 'LDL', unit: 'mg/dL', source: 'labs', labName: 'ldl', thresholds: { high: 100 } },
            { id: 'egfr', label: 'eGFR', unit: 'mL/min', source: 'labs', labName: 'egfr', thresholds: { low: 60, critical: 30 } },
            { id: 'alt', label: 'ALT', unit: 'U/L', source: 'labs', labName: 'alt', thresholds: { high: 40 } },
        ],
        status: [],
        events: ['hospitalization', 'preventive_visit'],
        due: [
            { id: 'colonoscopy', label: 'Colonoscopy', intervalDays: 3650, minAge: 45 },
            { id: 'mammogram', label: 'Mammogram', intervalDays: 365, minAge: 40, sex: 'F' },
            { id: 'flu_vaccine', label: 'Flu Vaccine', intervalDays: 365 },
        ]
    },
    pulmonology: {
        id: 'pulmonology',
        label: 'Pulmonology',
        icon: Wind,
        color: 'cyan',
        trends: [
            { id: 'spo2', label: 'SpO2', unit: '%', source: 'vitals', vitalKey: 'spo2', thresholds: { low: 92, critical: 88 } },
            { id: 'hr', label: 'Heart Rate', unit: 'bpm', source: 'vitals', vitalKey: 'hr', thresholds: { high: 100 } },
            { id: 'rr', label: 'Resp Rate', unit: '/min', source: 'vitals', vitalKey: 'rr', thresholds: { high: 20 } },
            { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight' },
        ],
        status: [
            { id: 'inhaler', label: 'Inhaler Regimen', checkMeds: ['albuterol', 'symbicort', 'advair', 'breo', 'spiriva', 'combivent', 'proair', 'ventolin', 'dulera'] },
        ],
        events: ['pft', 'sleep_study', 'bronchoscopy', 'ct chest'],
        due: [
            { id: 'pft_repeat', label: 'PFT Repeat', intervalDays: 365 },
        ]
    },
    nephrology: {
        id: 'nephrology',
        label: 'Nephrology',
        icon: Droplet,
        color: 'amber',
        trends: [
            { id: 'egfr', label: 'eGFR', unit: 'mL/min', source: 'labs', labName: 'egfr', thresholds: { low: 60, critical: 15 } },
            { id: 'cr', label: 'Creatinine', unit: 'mg/dL', source: 'labs', labName: 'creatinine', thresholds: { high: 1.2, critical: 4 } },
            { id: 'bun', label: 'BUN', unit: 'mg/dL', source: 'labs', labName: 'bun', thresholds: { high: 20 } },
            { id: 'k', label: 'Potassium', unit: 'mEq/L', source: 'labs', labName: 'potassium', thresholds: { low: 3.5, high: 5.0, critical: 5.5 } },
            { id: 'co2', label: 'CO2', unit: 'mEq/L', source: 'labs', labName: 'co2', thresholds: { low: 22 } },
            { id: 'phos', label: 'Phosphorus', unit: 'mg/dL', source: 'labs', labName: 'phosphorus', thresholds: { high: 4.5 } },
            { id: 'calcium', label: 'Calcium', unit: 'mg/dL', source: 'labs', labName: 'calcium', thresholds: { low: 8.5, high: 10.5 } },
            { id: 'hgb', label: 'Hemoglobin', unit: 'g/dL', source: 'labs', labName: 'hemoglobin', thresholds: { low: 10, critical: 7 } },
        ],
        status: [
            { id: 'ace_arb', label: 'ACE/ARB Use', checkMeds: ['lisinopril', 'enalapril', 'losartan', 'valsartan', 'irbesartan', 'olmesartan', 'ramipril', 'benazepril'] },
        ],
        events: ['dialysis_access', 'kidney_biopsy'],
        due: [
            { id: 'ckd_labs', label: 'CKD Labs', intervalDays: 90, labName: 'creatinine' },
        ]
    },
    gastroenterology: {
        id: 'gastroenterology',
        label: 'Gastroenterology',
        icon: Activity,
        color: 'orange',
        trends: [
            { id: 'ast', label: 'AST', unit: 'U/L', source: 'labs', labName: 'ast', thresholds: { high: 40 } },
            { id: 'alt', label: 'ALT', unit: 'U/L', source: 'labs', labName: 'alt', thresholds: { high: 40 } },
            { id: 'inr', label: 'INR', unit: '', source: 'labs', labName: 'inr', thresholds: { high: 1.5 } },
            { id: 'albumin', label: 'Albumin', unit: 'g/dL', source: 'labs', labName: 'albumin', thresholds: { low: 3.5 } },
            { id: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL', source: 'labs', labName: 'bilirubin', thresholds: { high: 1.2 } },
            { id: 'hgb', label: 'Hemoglobin', unit: 'g/dL', source: 'labs', labName: 'hemoglobin', thresholds: { low: 12, critical: 8 } },
        ],
        events: ['colonoscopy', 'egd', 'ercp'],
        due: [
            { id: 'colonoscopy_surveillance', label: 'Surveillance Colonoscopy', intervalDays: 1825 },
        ]
    },
    rheumatology: {
        id: 'rheumatology',
        label: 'Rheumatology',
        icon: Bone,
        color: 'indigo',
        trends: [
            { id: 'esr', label: 'ESR', unit: 'mm/hr', source: 'labs', labName: 'esr', thresholds: { high: 20 } },
            { id: 'crp', label: 'CRP', unit: 'mg/L', source: 'labs', labName: 'crp', thresholds: { high: 3 } },
            { id: 'wbc', label: 'WBC', unit: 'K/uL', source: 'labs', labName: 'wbc', thresholds: { low: 4, high: 11 } },
            { id: 'hgb', label: 'Hemoglobin', unit: 'g/dL', source: 'labs', labName: 'hemoglobin', thresholds: { low: 12 } },
            { id: 'plt', label: 'Platelets', unit: 'K/uL', source: 'labs', labName: 'platelet', thresholds: { low: 150 } },
        ],
        status: [
            { id: 'dmard', label: 'DMARD/Biologic', checkMeds: ['methotrexate', 'humira', 'enbrel', 'remicade', 'adalimumab', 'etanercept', 'infliximab', 'rituximab', 'orencia'] },
            { id: 'steroid', label: 'Steroid Use', checkMeds: ['prednisone', 'methylprednisolone', 'dexamethasone', 'hydrocortisone'] },
        ],
        events: ['joint_injection'],
        due: [
            { id: 'tb_screen', label: 'TB Screening', intervalDays: 365 },
        ]
    },
    neurology: {
        id: 'neurology',
        label: 'Neurology',
        icon: Brain,
        color: 'violet',
        trends: [
            { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[0] ? parseInt(parts[0]) : null; }, thresholds: { high: 140 } },
            { id: 'ldl', label: 'LDL', unit: 'mg/dL', source: 'labs', labName: 'ldl', thresholds: { high: 70 } },
            { id: 'a1c', label: 'HbA1c', unit: '%', source: 'labs', labName: 'a1c', thresholds: { high: 7 } },
        ],
        status: [
            { id: 'aed', label: 'AED Regimen', checkMeds: ['keppra', 'levetiracetam', 'lamictal', 'lamotrigine', 'depakote', 'valproic', 'topamax', 'topiramate', 'dilantin', 'phenytoin'] },
        ],
        events: ['eeg', 'mri_brain', 'stroke', 'tia', 'ct head'],
        due: [
            { id: 'aed_labs', label: 'AED Level Check', intervalDays: 180 },
        ]
    },
    hematology_oncology: {
        id: 'hematology_oncology',
        label: 'Heme/Onc',
        icon: FlaskConical,
        color: 'red',
        trends: [
            { id: 'hgb', label: 'Hemoglobin', unit: 'g/dL', source: 'labs', labName: 'hemoglobin', thresholds: { low: 10, critical: 7 } },
            { id: 'wbc', label: 'WBC', unit: 'K/uL', source: 'labs', labName: 'wbc', thresholds: { low: 4, critical: 1 } },
            { id: 'plt', label: 'Platelets', unit: 'K/uL', source: 'labs', labName: 'platelet', thresholds: { low: 100, critical: 20 } },
            { id: 'anc', label: 'ANC', unit: 'K/uL', source: 'labs', labName: 'anc', thresholds: { low: 1.5, critical: 0.5 } },
            { id: 'ferritin', label: 'Ferritin', unit: 'ng/mL', source: 'labs', labName: 'ferritin', thresholds: { low: 30 } },
        ],
        events: ['infusion', 'transfusion', 'bone_marrow_biopsy', 'chemo'],
        due: [
            { id: 'cbc_monitoring', label: 'CBC Monitoring', intervalDays: 14, labName: 'cbc' },
        ]
    },
    psychiatry: {
        id: 'psychiatry',
        label: 'Psychiatry',
        icon: Brain,
        color: 'teal',
        trends: [
            { id: 'weight', label: 'Weight', unit: 'lbs', source: 'vitals', vitalKey: 'weight' },
            { id: 'bmi', label: 'BMI', unit: 'kg/m²', source: 'vitals', vitalKey: 'bmi', thresholds: { high: 30 } },
            { id: 'hr', label: 'Heart Rate', unit: 'bpm', source: 'vitals', vitalKey: 'hr' },
            { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', source: 'vitals', vitalKey: 'bp', extractor: (v) => { const bp = v?.bp; if (!bp || bp === 'N/A') return null; const parts = String(bp).split('/'); return parts[0] ? parseInt(parts[0]) : null; } },
        ],
        status: [],
        events: [],
        due: [
            { id: 'metabolic_labs', label: 'Metabolic Labs (Antipsychotics)', intervalDays: 180 },
        ]
    }
};

// Helper to parse vital value
const parseVitalValue = (value) => {
    if (value === null || value === undefined || value === 'N/A' || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

// ============== MINI SPARKLINE COMPONENT ==============
const MiniSparkline = ({ data, color = 'blue', width = 60, height = 20 }) => {
    if (!data || data.length < 2) return null;

    const values = data.map(d => parseFloat(d.value) || 0).filter(v => !isNaN(v));
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const strokeColor = color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : color === 'amber' ? '#f59e0b' : '#3b82f6';

    return (
        <svg width={width} height={height} className="opacity-70">
            <polyline
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

// ============== TREND CARD COMPONENT ==============
const TrendCard = ({ trend, data, onClick }) => {
    const latest = data[0];
    const previous = data[1];

    const value = latest?.value;
    const prevValue = previous?.value;
    const date = latest?.date;

    // Calculate delta
    let delta = null;
    let deltaType = 'neutral';
    if (value != null && prevValue != null) {
        const diff = parseFloat(value) - parseFloat(prevValue);
        if (!isNaN(diff)) {
            delta = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
            deltaType = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
        }
    }

    // Determine status color based on thresholds
    let statusColor = 'slate';
    if (trend.thresholds && value != null) {
        const v = parseFloat(value);
        if (!isNaN(v)) {
            if (trend.thresholds.critical && v >= trend.thresholds.critical) {
                statusColor = 'rose';
            } else if (trend.thresholds.high && v >= trend.thresholds.high) {
                statusColor = 'amber';
            } else if (trend.thresholds.low && v <= trend.thresholds.low) {
                statusColor = 'amber';
            } else if (trend.thresholds.high || trend.thresholds.low) {
                statusColor = 'emerald';
            }
        }
    }

    const colorMap = {
        rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', value: 'text-rose-900' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', value: 'text-amber-900' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', value: 'text-emerald-900' },
        slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', value: 'text-slate-900' },
    };

    const colors = colorMap[statusColor];

    // Format the display value
    const displayValue = value != null ? (typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value) : '--';

    return (
        <button
            onClick={onClick}
            className={`${colors.bg} ${colors.border} border rounded-xl p-3 text-left hover:shadow-md transition-all group w-full`}
        >
            <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                    {trend.label}
                </span>
                {trend.goal && (
                    <span className="text-[8px] font-medium text-slate-400 bg-white px-1 rounded">
                        Goal: {trend.goal}
                    </span>
                )}
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className={`text-xl font-bold ${colors.value} tabular-nums`}>
                        {displayValue}
                        <span className="text-xs font-medium text-slate-400 ml-0.5">{trend.unit}</span>
                    </div>

                    {delta && (
                        <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${deltaType === 'up' ? 'text-rose-500' : deltaType === 'down' ? 'text-emerald-500' : 'text-slate-400'
                            }`}>
                            {deltaType === 'up' ? <TrendingUp className="w-3 h-3" /> :
                                deltaType === 'down' ? <TrendingDown className="w-3 h-3" /> :
                                    <Minus className="w-3 h-3" />}
                            {delta}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end">
                    <MiniSparkline data={data} color={statusColor} />
                    {date && (
                        <span className="text-[9px] text-slate-400 mt-1">
                            {format(new Date(date), 'M/d/yy')}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

// ============== DUE ITEM COMPONENT ==============
const DueItem = ({ item, lastDate, overdue }) => {
    return (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${overdue ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'
            }`}>
            <div className="flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 ${overdue ? 'text-rose-500' : 'text-amber-500'}`} />
                <span className={`text-xs font-medium ${overdue ? 'text-rose-700' : 'text-amber-700'}`}>
                    {item.label}
                </span>
            </div>
            <span className={`text-[10px] font-bold ${overdue ? 'text-rose-600' : 'text-amber-600'}`}>
                {overdue ? 'OVERDUE' : lastDate ? `Last: ${format(new Date(lastDate), 'M/d/yy')}` : 'Due'}
            </span>
        </div>
    );
};

// ============== EVENT ITEM COMPONENT ==============
const EventItem = ({ type, date, summary }) => {
    const eventLabels = {
        cardiac_cath: 'Cardiac Cath',
        pci: 'PCI/Stent',
        cabg: 'CABG',
        echo: 'Echocardiogram',
        echocardiogram: 'Echocardiogram',
        stress_test: 'Stress Test',
        stress: 'Stress Test',
        colonoscopy: 'Colonoscopy',
        egd: 'EGD',
        pft: 'PFT',
        dexa: 'DEXA Scan',
        mri_brain: 'MRI Brain',
        mri: 'MRI',
        eeg: 'EEG',
        ekg: 'EKG',
        ct: 'CT Scan',
    };

    // Find matching label
    const lowerType = (type || '').toLowerCase();
    let label = type;
    for (const [key, val] of Object.entries(eventLabels)) {
        if (lowerType.includes(key)) {
            label = val;
            break;
        }
    }

    return (
        <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-100 rounded-lg">
            <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-700">
                    {label}
                </span>
            </div>
            <span className="text-[10px] text-slate-500">
                {date ? format(new Date(date), 'M/d/yy') : 'N/A'}
            </span>
        </div>
    );
};

// ============== DETAIL VIEW MODAL ==============
const TrendDetailView = ({ trend, data, onClose }) => {
    if (!trend) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{trend.label} Trend</h3>
                        <p className="text-xs text-slate-500">{data.length} data points</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {/* Simple chart visualization */}
                    {data.length > 0 && (
                        <div className="h-32 bg-gradient-to-b from-blue-50 to-white rounded-lg border border-slate-200 flex items-end justify-around p-4 mb-4 gap-1">
                            {data.slice(0, 10).reverse().map((d, i) => {
                                const val = parseFloat(d.value) || 0;
                                const max = Math.max(...data.map(x => parseFloat(x.value) || 0));
                                const height = max > 0 ? (val / max) * 80 : 20;
                                return (
                                    <div key={i} className="flex flex-col items-center flex-1">
                                        <div
                                            className="w-full bg-blue-500 rounded-t min-h-[4px] transition-all"
                                            style={{ height: `${height}px` }}
                                        />
                                        <span className="text-[8px] text-slate-400 mt-1 truncate w-full text-center">
                                            {d.date ? format(new Date(d.date), 'M/d') : ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Data table */}
                    <div className="space-y-1">
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-400 uppercase px-2">
                            <span>Date</span>
                            <span>Value</span>
                            <span>Source</span>
                        </div>
                        {data.length > 0 ? data.map((d, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 text-xs text-slate-700 px-2 py-1.5 bg-slate-50 rounded">
                                <span>{d.date ? format(new Date(d.date), 'M/d/yyyy') : '--'}</span>
                                <span className="font-semibold">{d.value} {trend.unit}</span>
                                <span className="text-slate-400">{d.source || 'Chart'}</span>
                            </div>
                        )) : (
                            <div className="text-center text-slate-400 py-4">No data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============== MAIN SPECIALTY TRACKER COMPONENT ==============
const SpecialtyTracker = ({
    isOpen,
    onClose,
    patientId,
    patientData,
    vitals = [],
    labs = [],
    medications = [],
    documents = [],
    problems = []
}) => {
    const [selectedSpecialty, setSelectedSpecialty] = useState('cardiology');
    const [timeRange, setTimeRange] = useState(90);
    const [isPinned, setIsPinned] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [selectedTrend, setSelectedTrend] = useState(null);
    const [selectedTrendData, setSelectedTrendData] = useState([]);
    const [labResults, setLabResults] = useState([]);
    const [loadingLabs, setLoadingLabs] = useState(false);

    const specialty = SPECIALTY_TEMPLATES[selectedSpecialty];

    // Fetch lab results when patient changes
    useEffect(() => {
        const fetchLabs = async () => {
            if (!patientId || !isOpen) return;
            setLoadingLabs(true);
            try {
                const response = await labsAPI.getByPatient(patientId);
                setLabResults(response.data || []);
            } catch (err) {
                console.error('Error fetching labs for tracker:', err);
                setLabResults([]);
            } finally {
                setLoadingLabs(false);
            }
        };
        fetchLabs();
    }, [patientId, isOpen]);

    // Extract trend data from patient data sources
    const extractTrendData = useMemo(() => {
        if (!specialty) return {};

        const trendData = {};

        specialty.trends.forEach(trend => {
            const data = [];

            // Extract from vitals
            if (trend.source === 'vitals' && vitals.length > 0) {
                vitals.forEach(v => {
                    let value = null;

                    if (trend.extractor) {
                        value = trend.extractor(v);
                    } else if (trend.vitalKey) {
                        // Map vitalKey to actual field names from Snapshot vitals structure
                        const fieldMap = {
                            'bp': 'bp',
                            'hr': 'hr',
                            'temp': 'temp',
                            'rr': 'rr',
                            'spo2': 'spo2',
                            'weight': 'weight',
                            'bmi': 'bmi'
                        };
                        const field = fieldMap[trend.vitalKey] || trend.vitalKey;
                        value = parseVitalValue(v[field]);
                    }

                    if (value !== null) {
                        data.push({
                            value: value,
                            date: v.date || v.created_at,
                            source: 'Vitals'
                        });
                    }
                });
            }

            // Extract from lab results
            if (trend.source === 'labs' && labResults.length > 0) {
                const searchTerm = (trend.labName || trend.label).toLowerCase();

                labResults.forEach(lab => {
                    const testName = (lab.test_name || '').toLowerCase();
                    const component = (lab.component || '').toLowerCase();

                    // Check if this lab matches the trend
                    if (testName.includes(searchTerm) || component.includes(searchTerm) ||
                        searchTerm.includes(testName) || searchTerm.includes(component)) {
                        const value = parseFloat(lab.result_value);
                        if (!isNaN(value)) {
                            data.push({
                                value: value,
                                date: lab.result_date || lab.collected_date || lab.created_at,
                                source: lab.test_name || 'Lab'
                            });
                        }
                    }
                });
            }

            // Sort by date descending
            data.sort((a, b) => new Date(b.date) - new Date(a.date));

            trendData[trend.id] = data.slice(0, 10); // Keep last 10 values
        });

        return trendData;
    }, [specialty, vitals, labResults]);

    // Check medication status
    const medicationStatus = useMemo(() => {
        if (!specialty?.status) return {};

        const status = {};
        specialty.status.forEach(s => {
            const activeMeds = medications.filter(m => {
                const medName = (m.medication_name || m.name || '').toLowerCase();
                return m.active !== false && s.checkMeds.some(check => medName.includes(check.toLowerCase()));
            });
            status[s.id] = {
                active: activeMeds.length > 0,
                meds: activeMeds
            };
        });
        return status;
    }, [specialty, medications]);

    // Calculate due items based on actual data
    const dueItems = useMemo(() => {
        if (!specialty?.due) return [];

        const items = [];
        const now = new Date();

        specialty.due.forEach(due => {
            let lastDate = null;
            let overdue = false;

            // Check if we have data for this due item
            if (due.labName && labResults.length > 0) {
                const searchTerm = due.labName.toLowerCase();
                const matchingLabs = labResults.filter(lab => {
                    const testName = (lab.test_name || '').toLowerCase();
                    return testName.includes(searchTerm);
                });
                if (matchingLabs.length > 0) {
                    // Sort and get most recent
                    matchingLabs.sort((a, b) => new Date(b.result_date || b.created_at) - new Date(a.result_date || a.created_at));
                    lastDate = matchingLabs[0].result_date || matchingLabs[0].created_at;
                }
            }

            if (due.docType && documents.length > 0) {
                const matchingDocs = documents.filter(d => {
                    const cat = (d.category || d.doc_type || '').toLowerCase();
                    const name = (d.filename || d.name || '').toLowerCase();
                    return cat.includes(due.docType) || name.includes(due.docType);
                });
                if (matchingDocs.length > 0) {
                    matchingDocs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    lastDate = matchingDocs[0].created_at;
                }
            }

            // Calculate if overdue
            if (lastDate) {
                const daysSince = differenceInDays(now, new Date(lastDate));
                overdue = daysSince > due.intervalDays;
            } else {
                // No data = consider overdue
                overdue = true;
            }

            items.push({
                ...due,
                lastDate,
                overdue
            });
        });

        return items.slice(0, 4);
    }, [specialty, labResults, documents]);

    // Get key events from documents
    const keyEvents = useMemo(() => {
        if (!specialty?.events || !documents.length) return [];

        const events = documents
            .filter(d => {
                const cat = (d.category || d.doc_type || '').toLowerCase();
                const name = (d.filename || d.name || '').toLowerCase();
                return specialty.events.some(e => cat.includes(e) || name.includes(e));
            })
            .slice(0, 4)
            .map(d => ({
                type: d.category || d.doc_type || 'procedure',
                date: d.created_at,
                summary: d.filename || d.name
            }));

        return events;
    }, [specialty, documents]);

    const visibleTrends = showMore ? specialty?.trends : specialty?.trends?.slice(0, 8);

    const handleTrendClick = (trend) => {
        setSelectedTrend(trend);
        setSelectedTrendData(extractTrendData[trend.id] || []);
    };

    if (!isOpen) return null;

    const Icon = specialty?.icon || Activity;

    return (
        <>
            {/* Drawer Overlay */}
            <div
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[80]"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-[90] flex flex-col animate-slide-left">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-xl bg-rose-100`}>
                                <Icon className={`w-5 h-5 text-rose-600`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Specialty Tracker</h2>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">At-a-glance trends</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {loadingLabs && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                            <button
                                onClick={() => setIsPinned(!isPinned)}
                                className={`p-2 rounded-lg transition-colors ${isPinned ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}
                            >
                                {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Specialty Selector */}
                    <div className="flex gap-2">
                        <select
                            value={selectedSpecialty}
                            onChange={(e) => setSelectedSpecialty(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {Object.values(SPECIALTY_TEMPLATES).map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(Number(e.target.value))}
                            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={30}>30 days</option>
                            <option value={90}>90 days</option>
                            <option value={180}>180 days</option>
                            <option value={365}>1 year</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Section A: Top Trends */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Top Trends
                            </h3>
                            {specialty?.trends?.length > 8 && (
                                <button
                                    onClick={() => setShowMore(!showMore)}
                                    className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                    {showMore ? 'Show Less' : `Show All (${specialty.trends.length})`}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {visibleTrends?.map(trend => (
                                <TrendCard
                                    key={trend.id}
                                    trend={trend}
                                    data={extractTrendData[trend.id] || []}
                                    onClick={() => handleTrendClick(trend)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Medication Status */}
                    {specialty?.status?.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <Pill className="w-3.5 h-3.5" />
                                Status
                            </h3>
                            <div className="space-y-2">
                                {specialty.status.map(s => {
                                    const status = medicationStatus[s.id];
                                    return (
                                        <div key={s.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${status?.active ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'
                                            }`}>
                                            <div>
                                                <span className={`text-xs font-medium ${status?.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                    {s.label}
                                                </span>
                                                {status?.active && status.meds.length > 0 && (
                                                    <p className="text-[10px] text-emerald-600 truncate max-w-[200px]">
                                                        {status.meds.map(m => m.medication_name || m.name).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold ${status?.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {status?.active ? 'ACTIVE' : 'NOT ON'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section B: Due Soon / Overdue */}
                    {dueItems.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <Clock className="w-3.5 h-3.5" />
                                Due Soon / Overdue
                            </h3>
                            <div className="space-y-2">
                                {dueItems.map(item => (
                                    <DueItem key={item.id} item={item} lastDate={item.lastDate} overdue={item.overdue} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section C: Key Events */}
                    {keyEvents.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                <Calendar className="w-3.5 h-3.5" />
                                Key Events
                            </h3>
                            <div className="space-y-2">
                                {keyEvents.map((event, i) => (
                                    <EventItem key={i} {...event} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No Data Message */}
                    {Object.values(extractTrendData).every(d => d.length === 0) && !loadingLabs && (
                        <div className="text-center py-8">
                            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No trend data available</p>
                            <p className="text-xs text-slate-400 mt-1">Record vitals and labs to see trends</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-[10px] text-slate-400 text-center">
                        Data synced from patient chart • {vitals.length} vitals, {labResults.length} labs
                    </div>
                </div>
            </div>

            {/* Detail View Modal */}
            {selectedTrend && (
                <TrendDetailView
                    trend={selectedTrend}
                    data={selectedTrendData}
                    onClose={() => setSelectedTrend(null)}
                />
            )}

            <style>{`
                @keyframes slide-left {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-left {
                    animation: slide-left 0.3s ease-out;
                }
            `}</style>
        </>
    );
};

export default SpecialtyTracker;
