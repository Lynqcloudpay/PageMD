import React from 'react';
import { Activity, Thermometer, Wind, Droplets, Scale, MoveVertical } from 'lucide-react';

const VitalInput = ({ label, value, unit, icon: Icon, onChange, colorClass, isAbnormal, disabled, refProp }) => (
    <div className={`p-4 rounded-2xl border transition-all ${isAbnormal
            ? 'bg-red-50 border-red-100 ring-1 ring-red-100/50'
            : 'bg-white border-slate-100 hover:border-blue-100'
        }`}>
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isAbnormal ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            {unit && <span className="text-[10px] font-bold text-slate-300">{unit}</span>}
        </div>
        <div className="flex items-baseline gap-1">
            <input
                ref={refProp}
                type="number"
                step="0.1"
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                className={`w-full bg-transparent border-none p-0 text-xl font-bold focus:ring-0 ${isAbnormal ? 'text-red-700' : 'text-slate-800'
                    } disabled:opacity-70`}
                placeholder="--"
            />
        </div>
    </div>
);

const VitalsGrid = ({
    vitals,
    setVitals,
    isLocked,
    isAbnormalVital,
    previousWeight,
    getWeightChange,
    calculateBMI,
    refs
}) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className={`p-4 rounded-2xl border transition-all col-span-1 ${isAbnormalVital('systolic', vitals.systolic) || isAbnormalVital('diastolic', vitals.diastolic)
                    ? 'bg-red-50 border-red-100 ring-1 ring-red-100/50'
                    : 'bg-white border-slate-100 hover:border-blue-100'
                }`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isAbnormalVital('systolic', vitals.systolic) ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Activity className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Pressure</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <input
                        ref={refs.systolicRef}
                        type="number"
                        value={vitals.systolic || ''}
                        onChange={(e) => {
                            const sys = e.target.value;
                            setVitals({ ...vitals, systolic: sys, bp: sys && vitals.diastolic ? `${sys}/${vitals.diastolic}` : '' });
                        }}
                        disabled={isLocked}
                        className={`w-14 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-right ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-700' : 'text-slate-800'
                            }`}
                        placeholder="--"
                    />
                    <span className="text-slate-300 font-light text-xl">/</span>
                    <input
                        ref={refs.diastolicRef}
                        type="number"
                        value={vitals.diastolic || ''}
                        onChange={(e) => {
                            const dia = e.target.value;
                            setVitals({ ...vitals, diastolic: dia, bp: vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '' });
                        }}
                        disabled={isLocked}
                        className={`w-14 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-700' : 'text-slate-800'
                            }`}
                        placeholder="--"
                    />
                </div>
            </div>

            <VitalInput
                label="Heart Rate" value={vitals.pulse} unit="BPM" icon={Activity}
                onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                isAbnormal={isAbnormalVital('pulse', vitals.pulse)}
                disabled={isLocked} refProp={refs.pulseRef}
            />

            <VitalInput
                label="O2 Sat" value={vitals.o2sat} unit="%" icon={Droplets}
                onChange={(e) => setVitals({ ...vitals, o2sat: e.target.value })}
                isAbnormal={isAbnormalVital('o2sat', vitals.o2sat)}
                disabled={isLocked} refProp={refs.o2satRef}
            />

            <VitalInput
                label="Temperature" value={vitals.temp} unit="°F" icon={Thermometer}
                onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                isAbnormal={isAbnormalVital('temp', vitals.temp)}
                disabled={isLocked} refProp={refs.tempRef}
            />

            <div className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-blue-100 transition-all col-span-1 md:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                            <Scale className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weight</span>
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <input
                        ref={refs.weightRef}
                        type="number"
                        step="0.1"
                        value={vitals.weight || ''}
                        onChange={(e) => {
                            const w = e.target.value;
                            const bmi = calculateBMI(w, vitals.weightUnit, vitals.height, vitals.heightUnit);
                            setVitals({ ...vitals, weight: w, bmi });
                        }}
                        disabled={isLocked}
                        className="w-full bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-slate-800"
                        placeholder="--"
                    />
                    <span className="text-[10px] font-bold text-slate-400">{vitals.weightUnit}</span>
                </div>
                {previousWeight && (() => {
                    const change = getWeightChange();
                    if (!change) return null;
                    const isIncrease = parseFloat(change.lbs) > 0;
                    return (
                        <div className={`mt-1 text-[9px] font-bold flex items-center gap-1 ${isIncrease ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isIncrease ? '↑' : '↓'} {Math.abs(change.lbs)} lbs since last visit
                        </div>
                    );
                })()}
            </div>

            <VitalInput
                label="BMI" value={vitals.bmi} icon={Activity}
                isAbnormal={isAbnormalVital('bmi', vitals.bmi)}
                disabled={true} // BMI is calculated
            />
        </div>
    );
};

export default VitalsGrid;
