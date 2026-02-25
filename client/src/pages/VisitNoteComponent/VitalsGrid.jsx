import React from 'react';
import { Activity, Thermometer, Wind, Droplets, Scale, MoveVertical } from 'lucide-react';

const VitalInput = ({ label, value, unit, icon: Icon, onChange, onKeyDown, isAbnormal, disabled, refProp, placeholder = "--" }) => (
    <div className={`p-3 rounded-xl border transition-all ${isAbnormal
        ? 'bg-red-50 border-red-100 ring-1 ring-red-100/50'
        : 'bg-white border-gray-100 hover:border-blue-100/50'
        }`}>
        <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
                <div className={`p-1 rounded-md ${isAbnormal ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                    <Icon className="w-3 h-3" />
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            {unit && <span className="text-[9px] font-bold text-gray-400">{unit}</span>}
        </div>
        <div className="flex items-baseline gap-1">
            <input
                ref={refProp}
                type="number"
                step="0.1"
                value={value || ''}
                onChange={onChange}
                onKeyDown={onKeyDown}
                disabled={disabled}
                className={`w-full bg-transparent border-none p-0 text-base font-bold focus:ring-0 ${isAbnormal ? 'text-red-600' : 'text-gray-700'
                    } disabled:opacity-50`}
                placeholder={placeholder}
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
    systolicRef,
    diastolicRef,
    pulseRef,
    o2satRef,
    tempRef,
    weightRef,
    heightRef
}) => {
    const handleEnter = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef?.current?.focus();
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className={`p-3 rounded-xl border transition-all col-span-1 ${isAbnormalVital('systolic', vitals.systolic) || isAbnormalVital('diastolic', vitals.diastolic)
                ? 'bg-red-50 border-red-100 ring-1 ring-red-100/50'
                : 'bg-white border-gray-100 hover:border-blue-100/50'
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-md ${isAbnormalVital('systolic', vitals.systolic) ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                            <Activity className="w-3 h-3" />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">BP</span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400">mmHg</span>
                </div>
                <div className="flex items-center gap-1">
                    <input
                        ref={systolicRef}
                        type="number"
                        value={vitals.systolic || ''}
                        onChange={(e) => {
                            const sys = e.target.value;
                            setVitals({ ...vitals, systolic: sys, bp: sys && vitals.diastolic ? `${sys}/${vitals.diastolic}` : '' });
                        }}
                        onKeyDown={(e) => handleEnter(e, diastolicRef)}
                        disabled={isLocked}
                        className={`w-14 bg-transparent border-none p-0 text-base font-bold focus:ring-0 text-right ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-600' : 'text-gray-700'
                            }`}
                        placeholder="--"
                    />
                    <span className="text-gray-400 font-light text-base">/</span>
                    <input
                        ref={diastolicRef}
                        type="number"
                        value={vitals.diastolic || ''}
                        onChange={(e) => {
                            const dia = e.target.value;
                            setVitals({ ...vitals, diastolic: dia, bp: vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '' });
                        }}
                        onKeyDown={(e) => handleEnter(e, pulseRef)}
                        disabled={isLocked}
                        className={`w-14 bg-transparent border-none p-0 text-base font-bold focus:ring-0 ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-600' : 'text-gray-700'
                            }`}
                        placeholder="--"
                    />
                </div>
            </div>

            <VitalInput
                label="Heart Rate" value={vitals.pulse} unit="BPM" icon={Activity}
                onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                onKeyDown={(e) => handleEnter(e, o2satRef)}
                isAbnormal={isAbnormalVital('pulse', vitals.pulse)}
                disabled={isLocked} refProp={pulseRef}
            />

            <VitalInput
                label="O2 Sat" value={vitals.o2sat} unit="%" icon={Droplets}
                onChange={(e) => setVitals({ ...vitals, o2sat: e.target.value })}
                onKeyDown={(e) => handleEnter(e, tempRef)}
                isAbnormal={isAbnormalVital('o2sat', vitals.o2sat)}
                disabled={isLocked} refProp={o2satRef}
            />

            <VitalInput
                label="Temp" value={vitals.temp} unit="°F" icon={Thermometer}
                onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                onKeyDown={(e) => handleEnter(e, weightRef)}
                isAbnormal={isAbnormalVital('temp', vitals.temp)}
                disabled={isLocked} refProp={tempRef}
            />

            <div className="p-3 rounded-xl bg-white border border-gray-100 hover:border-blue-100/50 transition-all">
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-gray-50 text-gray-400">
                            <Scale className="w-3 h-3" />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Weight</span>
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <input
                        ref={weightRef}
                        type="number"
                        step="0.1"
                        value={vitals.weight || ''}
                        onChange={(e) => {
                            const w = e.target.value;
                            const bmi = calculateBMI(w, vitals.weightUnit, vitals.height, vitals.heightUnit);
                            setVitals({ ...vitals, weight: w, bmi });
                        }}
                        onKeyDown={(e) => handleEnter(e, heightRef)}
                        disabled={isLocked}
                        className="w-full bg-transparent border-none p-0 text-base font-bold focus:ring-0 text-gray-700"
                        placeholder="--"
                    />
                    <span className="text-[9px] font-bold text-gray-400">{vitals.weightUnit}</span>
                </div>
                {previousWeight && (() => {
                    const change = getWeightChange();
                    if (!change) return null;
                    const isIncrease = parseFloat(change.lbs) > 0;
                    return (
                        <div className={`mt-0.5 text-[8px] font-bold flex items-center gap-0.5 ${isIncrease ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isIncrease ? '↑' : '↓'} {Math.abs(change.lbs)}
                        </div>
                    );
                })()}
            </div>

            <VitalInput
                label="Height" value={vitals.height} unit={vitals.heightUnit} icon={MoveVertical}
                onChange={(e) => {
                    const h = e.target.value;
                    const bmi = calculateBMI(vitals.weight, vitals.weightUnit, h, vitals.heightUnit);
                    setVitals({ ...vitals, height: h, bmi });
                }}
                onKeyDown={(e) => handleEnter(e, null)} // End of vitals grid
                isAbnormal={false}
                disabled={isLocked} refProp={heightRef}
            />

            <VitalInput
                label="BMI" value={vitals.bmi} icon={Wind}
                isAbnormal={isAbnormalVital('bmi', vitals.bmi)}
                disabled={true}
            />
        </div>
    );
};

export default VitalsGrid;
