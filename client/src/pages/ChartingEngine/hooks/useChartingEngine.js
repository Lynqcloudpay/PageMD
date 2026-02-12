/**
 * useChartingEngine.js
 * Central state machine for the charting experience.
 * Replaces 60+ useState calls with a single useReducer.
 */
import { useReducer, useCallback, useMemo } from 'react';
import {
    createEmptyNoteData,
    createEmptyVitals,
    parseNoteText,
    parsePlanText,
    formatPlanText,
    parseVitalsFromVisit,
    decodeHtmlEntities,
} from '../utils/noteSerializer';

// ─── Action Types ───────────────────────────────────────────────────────────

export const ACTIONS = {
    // Visit lifecycle
    SET_LOADING: 'SET_LOADING',
    VISIT_LOADED: 'VISIT_LOADED',
    VISIT_CREATED: 'VISIT_CREATED',
    SET_VISIT_TYPE: 'SET_VISIT_TYPE',

    // Note content
    UPDATE_FIELD: 'UPDATE_FIELD',
    UPDATE_NOTE_DATA: 'UPDATE_NOTE_DATA',
    SET_VITALS: 'SET_VITALS',
    UPDATE_VITAL: 'UPDATE_VITAL',
    RESTORE_FROM_BACKUP: 'RESTORE_FROM_BACKUP',

    // Assessment & Plan
    ADD_DIAGNOSIS: 'ADD_DIAGNOSIS',
    REPLACE_DIAGNOSIS: 'REPLACE_DIAGNOSIS',
    REMOVE_DIAGNOSIS: 'REMOVE_DIAGNOSIS',
    ADD_ORDER_TO_PLAN: 'ADD_ORDER_TO_PLAN',
    REMOVE_FROM_PLAN: 'REMOVE_FROM_PLAN',
    UPDATE_PLAN_STRUCTURED: 'UPDATE_PLAN_STRUCTURED',
    SYNC_PLAN_TO_ASSESSMENT: 'SYNC_PLAN_TO_ASSESSMENT',

    // Signing workflow
    SET_SIGNED: 'SET_SIGNED',
    SET_PRELIMINARY: 'SET_PRELIMINARY',
    SET_RETRACTED: 'SET_RETRACTED',
    SET_SAVING: 'SET_SAVING',
    SET_LAST_SAVED: 'SET_LAST_SAVED',

    // UI state
    SET_DIRECT_EDITING: 'SET_DIRECT_EDITING',
    ADD_EDITED_SECTION: 'ADD_EDITED_SECTION',
    TOGGLE_QUICK_ACTIONS: 'TOGGLE_QUICK_ACTIONS',
    SET_RETRACTION_INFO: 'SET_RETRACTION_INFO',

    // Data
    SET_PATIENT_DATA: 'SET_PATIENT_DATA',
    SET_FAMILY_HISTORY: 'SET_FAMILY_HISTORY',
    SET_SURGICAL_HISTORY: 'SET_SURGICAL_HISTORY',
    SET_SOCIAL_HISTORY: 'SET_SOCIAL_HISTORY',
    SET_VISIT_DOCUMENTS: 'SET_VISIT_DOCUMENTS',
    SET_ATTENDINGS: 'SET_ATTENDINGS',
};

// ─── Initial State ──────────────────────────────────────────────────────────

const createInitialState = (urlVisitId) => ({
    // Visit
    visitData: null,
    currentVisitId: urlVisitId,
    visitType: 'Office Visit',
    loading: true,

    // Note
    noteData: createEmptyNoteData(),
    vitals: createEmptyVitals(),

    // Status
    isSigned: false,
    isPreliminary: false,
    isRetracted: false,
    isSaving: false,
    lastSaved: null,
    retractionInfo: null,

    // Editing
    isDirectEditing: false,
    editedSections: new Set(),
    showQuickActions: true,

    // Patient context
    patientData: null,
    familyHistory: [],
    surgicalHistory: [],
    socialHistory: null,
    visitDocuments: [],
    attendings: [],
});

// ─── Reducer ────────────────────────────────────────────────────────────────

function chartingReducer(state, action) {
    switch (action.type) {

        // ── Visit Lifecycle ───────────────────────────────────────────────────
        case ACTIONS.SET_LOADING:
            return { ...state, loading: action.payload };

        case ACTIONS.VISIT_LOADED: {
            const { visit } = action.payload;
            const status = (visit.status || '').toLowerCase().trim();
            const noteData = visit.note_draft
                ? (() => {
                    const text = typeof visit.note_draft === 'string'
                        ? visit.note_draft
                        : typeof visit.note_draft === 'object'
                            ? JSON.stringify(visit.note_draft)
                            : String(visit.note_draft || '');
                    const parsed = parseNoteText(text);
                    const planStructured = parsed.plan ? parsePlanText(parsed.plan) : [];
                    return {
                        ...createEmptyNoteData(),
                        chiefComplaint: parsed.chiefComplaint || '',
                        hpi: parsed.hpi || '',
                        assessment: parsed.assessment || '',
                        plan: parsed.plan || '',
                        rosNotes: parsed.rosNotes || '',
                        peNotes: parsed.peNotes || '',
                        results: parsed.results || '',
                        cts: parsed.cts || '',
                        ascvd: parsed.ascvd || '',
                        safetyPlan: parsed.safetyPlan || '',
                        carePlan: parsed.carePlan || '',
                        followUp: parsed.followUp || '',
                        planStructured: planStructured.length > 0 ? planStructured : [],
                    };
                })()
                : createEmptyNoteData();

            const vitals = parseVitalsFromVisit(visit) || createEmptyVitals();

            return {
                ...state,
                visitData: visit,
                currentVisitId: visit.id,
                visitType: visit.visit_type || 'Office Visit',
                loading: false,
                noteData,
                vitals,
                isSigned: status === 'signed',
                isPreliminary: status === 'preliminary',
                isRetracted: status === 'retracted',
            };
        }

        case ACTIONS.VISIT_CREATED: {
            const { visit } = action.payload;
            const status = (visit.status || '').toLowerCase();
            return {
                ...state,
                visitData: visit,
                currentVisitId: visit.id,
                isSigned: status === 'signed',
                isPreliminary: status === 'preliminary',
            };
        }

        case ACTIONS.SET_VISIT_TYPE:
            return { ...state, visitType: action.payload };

        // ── Note Content ──────────────────────────────────────────────────────
        case ACTIONS.UPDATE_FIELD: {
            const { field, value } = action.payload;
            const decoded = decodeHtmlEntities(value);
            const newNoteData = { ...state.noteData, [field]: decoded };

            // Track edited sections during direct editing
            let editedSections = state.editedSections;
            if (state.isDirectEditing) {
                editedSections = new Set(editedSections);
                editedSections.add(field);
            }

            return { ...state, noteData: newNoteData, editedSections };
        }

        case ACTIONS.UPDATE_NOTE_DATA:
            return { ...state, noteData: { ...state.noteData, ...action.payload } };

        case ACTIONS.SET_VITALS:
            return { ...state, vitals: action.payload };

        case ACTIONS.UPDATE_VITAL: {
            const { field, value } = action.payload;
            return { ...state, vitals: { ...state.vitals, [field]: value } };
        }

        case ACTIONS.RESTORE_FROM_BACKUP: {
            const { noteData, vitals } = action.payload;
            return {
                ...state,
                noteData: noteData || state.noteData,
                vitals: vitals || state.vitals,
            };
        }

        // ── Assessment & Plan ─────────────────────────────────────────────────
        case ACTIONS.ADD_DIAGNOSIS: {
            const { code, description } = action.payload;
            const newDx = code ? `${code} - ${description}` : description;
            const newAssessment = state.noteData.assessment
                ? `${state.noteData.assessment}\n${newDx}`
                : newDx;
            const newPlanStructured = [
                ...(state.noteData.planStructured || []),
                { diagnosis: newDx, orders: [] },
            ];
            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    assessment: newAssessment,
                    planStructured: newPlanStructured,
                    plan: formatPlanText(newPlanStructured),
                },
            };
        }

        case ACTIONS.REPLACE_DIAGNOSIS: {
            const { index, code, description } = action.payload;
            const lines = state.noteData.assessment.split('\n').filter(l => l.trim());
            const oldName = lines[index];
            const newName = code ? `${code} - ${description}` : description;
            lines[index] = newName;

            let updatedPlan = [...(state.noteData.planStructured || [])];
            if (oldName) {
                const matchIdx = updatedPlan.findIndex(item =>
                    item.diagnosis === oldName || item.diagnosis.includes(oldName) || oldName.includes(item.diagnosis)
                );
                if (matchIdx !== -1) {
                    updatedPlan[matchIdx] = { ...updatedPlan[matchIdx], diagnosis: newName };
                }
            }

            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    assessment: lines.join('\n'),
                    planStructured: updatedPlan,
                    plan: formatPlanText(updatedPlan),
                },
            };
        }

        case ACTIONS.REMOVE_DIAGNOSIS: {
            const { index } = action.payload;
            const lines = state.noteData.assessment.split('\n').filter(l => l.trim());
            const deleted = lines[index];
            lines.splice(index, 1);

            let updatedPlan = [...(state.noteData.planStructured || [])];
            if (deleted && updatedPlan.length > 0) {
                const matchIdx = updatedPlan.findIndex(item =>
                    item.diagnosis && deleted.includes(item.diagnosis)
                );
                if (matchIdx !== -1) {
                    const ordersToMove = updatedPlan[matchIdx].orders;
                    updatedPlan = updatedPlan.filter((_, i) => i !== matchIdx);
                    if (ordersToMove && ordersToMove.length > 0) {
                        const otherIdx = updatedPlan.findIndex(item => item.diagnosis === 'Other');
                        if (otherIdx !== -1) {
                            updatedPlan[otherIdx] = {
                                ...updatedPlan[otherIdx],
                                orders: [...updatedPlan[otherIdx].orders, ...ordersToMove],
                            };
                        } else {
                            updatedPlan.push({ diagnosis: 'Other', orders: ordersToMove });
                        }
                    }
                }
            }

            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    assessment: lines.join('\n'),
                    planStructured: updatedPlan,
                    plan: formatPlanText(updatedPlan),
                },
            };
        }

        case ACTIONS.ADD_ORDER_TO_PLAN: {
            const { diagnosis, orderText } = action.payload;
            const currentPlan = [...(state.noteData.planStructured || [])];
            const dxClean = diagnosis.replace(/^\d+\.\s*/, '').trim();
            const dxIndex = currentPlan.findIndex(p =>
                p.diagnosis === diagnosis || p.diagnosis === dxClean
            );

            let updatedPlan;
            if (dxIndex >= 0) {
                updatedPlan = [...currentPlan];
                updatedPlan[dxIndex] = {
                    ...updatedPlan[dxIndex],
                    orders: [...updatedPlan[dxIndex].orders, orderText],
                };
            } else {
                updatedPlan = [...currentPlan, { diagnosis: dxClean, orders: [orderText] }];
            }

            // Also sync assessment if new diagnosis
            let newAssessment = state.noteData.assessment;
            const existingLines = (newAssessment || '').split('\n').map(l => l.trim()).filter(Boolean);
            const existingClean = existingLines.map(l => l.replace(/^\d+\.\s*/, '').trim().toLowerCase());
            if (dxClean !== 'Unassigned' && !existingClean.includes(dxClean.toLowerCase())) {
                const nextNum = existingLines.length + 1;
                newAssessment = newAssessment
                    ? (newAssessment.endsWith('\n') ? newAssessment : newAssessment + '\n') + `${nextNum}. ${dxClean}`
                    : `1. ${dxClean}`;
            }

            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    planStructured: updatedPlan,
                    plan: formatPlanText(updatedPlan),
                    assessment: newAssessment,
                },
            };
        }

        case ACTIONS.REMOVE_FROM_PLAN: {
            const { diagnosisIndex, orderIndex } = action.payload;
            const updatedPlan = [...(state.noteData.planStructured || [])];
            if (orderIndex === null || orderIndex === undefined) {
                updatedPlan.splice(diagnosisIndex, 1);
            } else {
                const diag = updatedPlan[diagnosisIndex];
                const updatedOrders = [...diag.orders];
                updatedOrders.splice(orderIndex, 1);
                if (updatedOrders.length === 0) {
                    updatedPlan.splice(diagnosisIndex, 1);
                } else {
                    updatedPlan[diagnosisIndex] = { ...diag, orders: updatedOrders };
                }
            }

            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    planStructured: updatedPlan,
                    plan: formatPlanText(updatedPlan),
                },
            };
        }

        case ACTIONS.UPDATE_PLAN_STRUCTURED: {
            const updatedPlan = action.payload;
            const plan = formatPlanText(updatedPlan);

            // Sync any new diagnoses from plan to assessment
            const planDiagnoses = updatedPlan.map(item => item.diagnosis).filter(d => d && d !== 'Unassigned');
            let currentAssessment = state.noteData.assessment || '';
            const existingLines = currentAssessment.split('\n').map(l => l.trim()).filter(Boolean);
            const existingClean = existingLines.map(l => l.replace(/^\d+\.\s*/, '').trim().toLowerCase());
            let assessmentUpdated = false;

            planDiagnoses.forEach(dx => {
                const cleanDx = dx.replace(/^\d+\.\s*/, '').trim();
                if (!existingClean.includes(cleanDx.toLowerCase())) {
                    const nextNum = existingLines.length + 1;
                    currentAssessment = currentAssessment
                        ? (currentAssessment.endsWith('\n') ? currentAssessment : currentAssessment + '\n') + `${nextNum}. ${cleanDx}`
                        : `1. ${cleanDx}`;
                    existingLines.push(`${nextNum}. ${cleanDx}`);
                    existingClean.push(cleanDx.toLowerCase());
                    assessmentUpdated = true;
                }
            });

            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    planStructured: updatedPlan,
                    plan,
                    assessment: assessmentUpdated ? currentAssessment : state.noteData.assessment,
                },
            };
        }

        case ACTIONS.SYNC_PLAN_TO_ASSESSMENT: {
            const diagnoses = action.payload;
            if (!diagnoses || diagnoses.length === 0) return state;
            const currentPlan = state.noteData.planStructured || [];
            let planUpdated = false;
            const newPlan = [...currentPlan];

            diagnoses.forEach(diag => {
                const cleanDiag = diag.replace(/^\d+[.)]\s*/, '').trim();
                const exists = newPlan.some(item => {
                    const cleanItem = item.diagnosis.replace(/^\d+[.)]\s*/, '').trim();
                    return cleanItem.toLowerCase() === cleanDiag.toLowerCase();
                });
                if (!exists && cleanDiag) {
                    newPlan.push({ diagnosis: cleanDiag, orders: [] });
                    planUpdated = true;
                }
            });

            if (!planUpdated) return state;
            return {
                ...state,
                noteData: {
                    ...state.noteData,
                    planStructured: newPlan,
                    plan: formatPlanText(newPlan),
                },
            };
        }

        // ── Signing ─────────────────────────────────────────────────────────
        case ACTIONS.SET_SIGNED:
            return { ...state, isSigned: action.payload };
        case ACTIONS.SET_PRELIMINARY:
            return { ...state, isPreliminary: action.payload };
        case ACTIONS.SET_RETRACTED:
            return { ...state, isRetracted: action.payload };
        case ACTIONS.SET_SAVING:
            return { ...state, isSaving: action.payload };
        case ACTIONS.SET_LAST_SAVED:
            return { ...state, lastSaved: action.payload };

        // ── UI ───────────────────────────────────────────────────────────────
        case ACTIONS.SET_DIRECT_EDITING:
            return { ...state, isDirectEditing: action.payload };
        case ACTIONS.ADD_EDITED_SECTION: {
            const next = new Set(state.editedSections);
            next.add(action.payload);
            return { ...state, editedSections: next };
        }
        case ACTIONS.TOGGLE_QUICK_ACTIONS:
            return { ...state, showQuickActions: action.payload ?? !state.showQuickActions };
        case ACTIONS.SET_RETRACTION_INFO:
            return { ...state, retractionInfo: action.payload };

        // ── Data ─────────────────────────────────────────────────────────────
        case ACTIONS.SET_PATIENT_DATA:
            return { ...state, patientData: action.payload };
        case ACTIONS.SET_FAMILY_HISTORY:
            return { ...state, familyHistory: action.payload };
        case ACTIONS.SET_SURGICAL_HISTORY:
            return { ...state, surgicalHistory: action.payload };
        case ACTIONS.SET_SOCIAL_HISTORY:
            return { ...state, socialHistory: action.payload };
        case ACTIONS.SET_VISIT_DOCUMENTS:
            return { ...state, visitDocuments: action.payload };
        case ACTIONS.SET_ATTENDINGS:
            return { ...state, attendings: action.payload };

        default:
            return state;
    }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useChartingEngine(urlVisitId) {
    const [state, dispatch] = useReducer(chartingReducer, urlVisitId, createInitialState);

    // ── Computed Values ─────────────────────────────────────────────────────
    const diagnoses = useMemo(() => {
        if (!state.noteData.assessment) return [];
        return state.noteData.assessment.split('\n').filter(l => l.trim()).map(l => l.trim());
    }, [state.noteData.assessment]);

    const isLocked = useMemo(() => {
        return state.isSigned || state.isRetracted;
    }, [state.isSigned, state.isRetracted]);

    // ── Convenience Dispatchers ─────────────────────────────────────────────
    const updateField = useCallback((field, value) => {
        dispatch({ type: ACTIONS.UPDATE_FIELD, payload: { field, value } });
    }, []);

    const updateVital = useCallback((field, value) => {
        dispatch({ type: ACTIONS.UPDATE_VITAL, payload: { field, value } });
    }, []);

    const addDiagnosis = useCallback((code, description) => {
        dispatch({ type: ACTIONS.ADD_DIAGNOSIS, payload: { code, description } });
    }, []);

    const replaceDiagnosis = useCallback((index, code, description) => {
        dispatch({ type: ACTIONS.REPLACE_DIAGNOSIS, payload: { index, code, description } });
    }, []);

    const removeDiagnosis = useCallback((index) => {
        dispatch({ type: ACTIONS.REMOVE_DIAGNOSIS, payload: { index } });
    }, []);

    const addOrderToPlan = useCallback((diagnosis, orderText) => {
        dispatch({ type: ACTIONS.ADD_ORDER_TO_PLAN, payload: { diagnosis, orderText } });
    }, []);

    const removeFromPlan = useCallback((diagnosisIndex, orderIndex = null) => {
        dispatch({ type: ACTIONS.REMOVE_FROM_PLAN, payload: { diagnosisIndex, orderIndex } });
    }, []);

    return {
        state,
        dispatch,
        // Computed
        diagnoses,
        isLocked,
        // Dispatchers
        updateField,
        updateVital,
        addDiagnosis,
        replaceDiagnosis,
        removeDiagnosis,
        addOrderToPlan,
        removeFromPlan,
    };
}

export default useChartingEngine;
