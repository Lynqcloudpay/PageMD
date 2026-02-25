/**
 * ROSPESection.jsx
 * Review of Systems + Physical Exam with pill toggles, "All Normal" macro, and NoteWriter presets.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, Save, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { rosFindings, peFindings } from '../utils/noteSerializer';

const PRESET_KEY = 'charting_ros_pe_presets';

const loadPresets = () => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); }
    catch { return {}; }
};
const savePresetsToStorage = (presets) => localStorage.setItem(PRESET_KEY, JSON.stringify(presets));

const PillGrid = ({ title, findings, toggleState, isLocked, onChange, onAllNormal, onClearAll }) => (
    <div>
        <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest">{title}</h4>
            {!isLocked && (
                <div className="flex items-center gap-1">
                    <button onClick={onAllNormal} className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 transition-all flex items-center gap-1" title="Set all to reviewed-normal">
                        <Zap className="w-3 h-3" /> All Normal
                    </button>
                    <button onClick={onClearAll} className="px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-all" title="Clear all">
                        <RotateCcw className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
        <div className="flex flex-wrap gap-1.5">
            {Object.entries(findings).map(([key, text]) => (
                <button
                    key={key}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${toggleState[key]
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                    onClick={() => onChange(key)}
                    disabled={isLocked}
                >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                </button>
            ))}
        </div>
    </div>
);

const ROSPESection = ({
    ros, pe, rosNotes, peNotes, isLocked, dispatch, ACTIONS,
}) => {
    const [presets, setPresets] = useState(loadPresets);
    const [presetName, setPresetName] = useState('');
    const [showPresetSave, setShowPresetSave] = useState(false);
    const [showPresetLoad, setShowPresetLoad] = useState(false);

    const buildText = useCallback((toggleState, findings) => {
        const active = Object.entries(toggleState).filter(([, v]) => v).map(([k]) => findings[k]);
        return active.length > 0 ? active.join(' ') : '';
    }, []);

    const handleRosToggle = useCallback((key) => {
        const newRos = { ...ros, [key]: !ros[key] };
        dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { ros: newRos, rosNotes: buildText(newRos, rosFindings) } });
    }, [ros, dispatch, ACTIONS, buildText]);

    const handlePeToggle = useCallback((key) => {
        const newPe = { ...pe, [key]: !pe[key] };
        dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { pe: newPe, peNotes: buildText(newPe, peFindings) } });
    }, [pe, dispatch, ACTIONS, buildText]);

    const handleAllNormal = useCallback((type) => {
        const findings = type === 'ros' ? rosFindings : peFindings;
        const allOn = {};
        Object.keys(findings).forEach(k => { allOn[k] = true; });
        if (type === 'ros') {
            dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { ros: allOn, rosNotes: buildText(allOn, findings) } });
        } else {
            dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { pe: allOn, peNotes: buildText(allOn, findings) } });
        }
    }, [dispatch, ACTIONS, buildText]);

    const handleClearAll = useCallback((type) => {
        const findings = type === 'ros' ? rosFindings : peFindings;
        const allOff = {};
        Object.keys(findings).forEach(k => { allOff[k] = false; });
        if (type === 'ros') {
            dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { ros: allOff, rosNotes: '' } });
        } else {
            dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { pe: allOff, peNotes: '' } });
        }
    }, [dispatch, ACTIONS]);

    const savePreset = useCallback(() => {
        if (!presetName.trim()) return;
        const updated = { ...presets, [presetName.trim()]: { ros: { ...ros }, pe: { ...pe } } };
        setPresets(updated);
        savePresetsToStorage(updated);
        setPresetName('');
        setShowPresetSave(false);
    }, [presetName, presets, ros, pe]);

    const loadPreset = useCallback((name) => {
        const preset = presets[name];
        if (!preset) return;
        dispatch({
            type: ACTIONS.UPDATE_NOTE_DATA, payload: {
                ros: preset.ros, pe: preset.pe,
                rosNotes: buildText(preset.ros, rosFindings),
                peNotes: buildText(preset.pe, peFindings),
            }
        });
        setShowPresetLoad(false);
    }, [presets, dispatch, ACTIONS, buildText]);

    const deletePreset = useCallback((name) => {
        const updated = { ...presets };
        delete updated[name];
        setPresets(updated);
        savePresetsToStorage(updated);
    }, [presets]);

    const presetNames = useMemo(() => Object.keys(presets), [presets]);

    return (
        <div className="space-y-6">
            {/* NoteWriter Preset Bar */}
            {!isLocked && (
                <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NoteWriter</span>
                    {presetNames.length > 0 && (
                        <button onClick={() => setShowPresetLoad(!showPresetLoad)} className="text-[10px] text-primary-600 hover:bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100 flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" /> Load Preset ({presetNames.length})
                        </button>
                    )}
                    <button onClick={() => setShowPresetSave(!showPresetSave)} className="text-[10px] text-gray-500 hover:bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1">
                        <Save className="w-2.5 h-2.5" /> Save Current
                    </button>
                </div>
            )}

            {/* Preset Save Input */}
            {showPresetSave && (
                <div className="flex items-center gap-2 px-1 pb-2">
                    <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} placeholder="Preset name (e.g., 'Cardiology Annual')" className="flex-1 text-xs border-gray-200 rounded-lg px-3 py-1.5 focus:ring-primary-400 focus:border-primary-400" autoFocus />
                    <button onClick={savePreset} className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-primary-700">Save</button>
                    <button onClick={() => setShowPresetSave(false)} className="text-xs text-gray-500 px-2 py-1.5">Cancel</button>
                </div>
            )}

            {/* Preset Load List */}
            {showPresetLoad && presetNames.length > 0 && (
                <div className="px-1 pb-2">
                    <div className="border border-gray-100 rounded-xl bg-white shadow-sm p-2 space-y-1">
                        {presetNames.map(name => (
                            <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-primary-50 rounded-lg transition-all group">
                                <button onClick={() => loadPreset(name)} className="flex-1 text-left text-xs font-bold text-gray-700">{name}</button>
                                <button onClick={() => deletePreset(name)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 px-1">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ROS */}
                <div>
                    <PillGrid
                        title="Review of Systems"
                        findings={rosFindings}
                        toggleState={ros || {}}
                        isLocked={isLocked}
                        onChange={handleRosToggle}
                        onAllNormal={() => handleAllNormal('ros')}
                        onClearAll={() => handleClearAll('ros')}
                    />
                    <textarea
                        value={rosNotes || ''}
                        onChange={(e) => dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { rosNotes: e.target.value } })}
                        disabled={isLocked}
                        placeholder="Additional ROS notes..."
                        className="vn-textarea min-h-[80px] mt-3"
                        rows={3}
                    />
                </div>
                {/* PE */}
                <div>
                    <PillGrid
                        title="Physical Exam"
                        findings={peFindings}
                        toggleState={pe || {}}
                        isLocked={isLocked}
                        onChange={handlePeToggle}
                        onAllNormal={() => handleAllNormal('pe')}
                        onClearAll={() => handleClearAll('pe')}
                    />
                    <textarea
                        value={peNotes || ''}
                        onChange={(e) => dispatch({ type: ACTIONS.UPDATE_NOTE_DATA, payload: { peNotes: e.target.value } })}
                        disabled={isLocked}
                        placeholder="Additional PE findings..."
                        className="vn-textarea min-h-[80px] mt-3"
                        rows={3}
                    />
                </div>
            </div>
        </div>
    );
};

export default ROSPESection;
