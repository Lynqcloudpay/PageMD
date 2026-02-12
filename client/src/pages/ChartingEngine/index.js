/**
 * ChartingEngine barrel exports.
 */
export { default as ChartingEngine } from './ChartingEngine';
export { useChartingEngine, ACTIONS } from './hooks/useChartingEngine';
export { useAutoSave } from './hooks/useAutoSave';
export { useKeyboardNav } from './hooks/useKeyboardNav';
export { useVisitLoader } from './hooks/useVisitLoader';
export { useSigningWorkflow } from './hooks/useSigningWorkflow';

export {
    parseNoteText,
    parsePlanText,
    formatPlanText,
    combineNoteSections,
    decodeHtmlEntities,
    createEmptyNoteData,
    createEmptyVitals,
    buildVitalsPayload,
    parseVitalsFromVisit,
    convertWeight,
    convertHeight,
    calculateBMI,
    isAbnormalVital,
    rosFindings,
    peFindings,
} from './utils/noteSerializer';
