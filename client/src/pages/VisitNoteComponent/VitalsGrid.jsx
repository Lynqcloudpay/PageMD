import { Activity, Thermometer, Wind, Droplets, Scale, MoveVertical, PlusCircle, History, Clock } from 'lucide-react';
import { format } from 'date-fns';

const VitalInput = ({ label, value, unit, icon: Icon, onChange, onKeyDown, isAbnormal, disabled, refProp, placeholder = "--", className = "" }) => (
    <div className={`p-3 rounded-xl border transition-all ${className} ${isAbnormal
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
    vitalsHistory = [],
    onUpdateVital,
    onAddReading,
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
    heightRef,
    // For backward compatibility while refactoring
    setVitals,
    vitals: passedVitals
}) => {
    // Determine current vitals to edit
    const vitals = passedVitals || (vitalsHistory.length > 0 ? vitalsHistory[vitalsHistory.length - 1] : {});

    const updateCurrent = (updates) => {
        if (onUpdateVital) {
            Object.entries(updates).forEach(([field, value]) => {
                onUpdateVital(vitalsHistory.length - 1, field, value);
            });
        } else if (setVitals) {
            setVitals({ ...vitals, ...updates });
        }
    };
    const handleEnter = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef?.current?.focus();
        }
    };

    return (
        <div className="space-y-6">
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
                                updateCurrent({ systolic: sys, bp: sys && vitals.diastolic ? `${sys}/${vitals.diastolic}` : '' });
                            }}
                            onKeyDown={(e) => handleEnter(e, diastolicRef)}
                            disabled={isLocked}
                            className={`w-full bg-transparent border-none p-0 text-base font-bold focus:ring-0 text-right ${isAbnormalVital('systolic', vitals.systolic) ? 'text-red-600' : 'text-gray-700'
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
                                updateCurrent({ diastolic: dia, bp: vitals.systolic && dia ? `${vitals.systolic}/${dia}` : '' });
                            }}
                            onKeyDown={(e) => handleEnter(e, pulseRef)}
                            disabled={isLocked}
                            className={`w-full bg-transparent border-none p-0 text-base font-bold focus:ring-0 ${isAbnormalVital('diastolic', vitals.diastolic) ? 'text-red-600' : 'text-gray-700'
                                }`}
                            placeholder="--"
                        />
                    </div>
                </div>

                <VitalInput
                    label="Heart Rate" value={vitals.pulse} unit="BPM" icon={Activity}
                    onChange={(e) => updateCurrent({ pulse: e.target.value })}
                    onKeyDown={(e) => handleEnter(e, o2satRef)}
                    isAbnormal={isAbnormalVital('pulse', vitals.pulse)}
                    disabled={isLocked} refProp={pulseRef}
                />

                <VitalInput
                    label="O2 Sat" value={vitals.o2sat} unit="%" icon={Droplets}
                    onChange={(e) => updateCurrent({ o2sat: e.target.value })}
                    onKeyDown={(e) => handleEnter(e, tempRef)}
                    isAbnormal={isAbnormalVital('o2sat', vitals.o2sat)}
                    disabled={isLocked} refProp={o2satRef}
                />

                <VitalInput
                    label="Temp" value={vitals.temp} unit="°F" icon={Thermometer}
                    onChange={(e) => updateCurrent({ temp: e.target.value })}
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
                                const bmi = calculateBMI(w, vitals.weightUnit || 'lbs', vitals.height, vitals.heightUnit || 'in');
                                updateCurrent({ weight: w, bmi });
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
                        const bmi = calculateBMI(vitals.weight, vitals.weightUnit || 'lbs', h, vitals.heightUnit || 'in');
                        updateCurrent({ height: h, bmi });
                    }}
                    onKeyDown={(e) => handleEnter(e, null)} // End of vitals grid
                    isAbnormal={false}
                    disabled={isLocked} refProp={heightRef}
                />

                <div className="flex flex-col gap-2">
                    <VitalInput
                        label="BMI" value={vitals.bmi} icon={Wind}
                        isAbnormal={isAbnormalVital('bmi', vitals.bmi)}
                        disabled={true}
                        className="flex-1"
                    />
                    {!isLocked && onAddReading && (
                        <button
                            onClick={onAddReading}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-100 transition-all group shadow-sm active:scale-95"
                            title="Add a new set of vitals for this encounter"
                        >
                            <PlusCircle className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">New Reading</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Vitals History Table for current visit */}
            {vitalsHistory.length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                        <History className="w-3.5 h-3.5 text-blue-500" />
                        <h4 className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Encounter Vitals History</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/30">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100/50">
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">BP (mmHg)</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">HR (BPM)</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">O2 (%)</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Temp (°F)</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Weight</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">BMI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {vitalsHistory.map((v, idx) => (
                                    <tr key={idx} className={`hover:bg-white/60 transition-colors ${idx === vitalsHistory.length - 1 ? 'bg-blue-50/40' : ''}`}>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-gray-400" />
                                            {v.taken_at ? format(new Date(v.taken_at), 'hh:mm a') : 'Original'}
                                            {idx === vitalsHistory.length - 1 && <span className="ml-1 px-1.5 py-px bg-blue-100 text-blue-600 text-[8px] font-black uppercase rounded">Current</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-[11px] font-bold text-gray-700">
                                            {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : (v.bp || '--')}
                                        </td>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600">{v.pulse || '--'}</td>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600">{v.o2sat || '--'}</td>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600">{v.temp || '--'}</td>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600">
                                            {v.weight ? `${v.weight} ${v.weightUnit || 'lbs'}` : '--'}
                                        </td>
                                        <td className="px-4 py-2.5 text-[11px] font-medium text-gray-600">{v.bmi || '--'}</td>
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

export default VitalsGrid;
