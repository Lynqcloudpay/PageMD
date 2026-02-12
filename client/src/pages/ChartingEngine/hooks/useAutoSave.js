/**
 * useAutoSave.js
 * Debounced auto-save hook with localStorage backup.
 */
import { useCallback, useEffect, useRef } from 'react';
import { combineNoteSections, buildVitalsPayload, parseNoteText } from '../utils/noteSerializer';
import { visitsAPI } from '../../../services/api';
import { ACTIONS } from './useChartingEngine';

const AUTO_SAVE_DELAY = 15000; // 15 seconds
const LOCAL_BACKUP_DELAY = 1000; // 1 second

/**
 * @param {object} params
 * @param {object} params.state - charting engine state
 * @param {function} params.dispatch - charting engine dispatch
 * @param {string} params.patientId - patient ID
 * @param {function} params.showToast - toast notification function
 */
export function useAutoSave({ state, dispatch, patientId, showToast }) {
    const autoSaveTimeoutRef = useRef(null);
    const isAutoSavingRef = useRef(false);
    const hasInitialSaveRef = useRef(false);

    const { noteData, vitals, visitType, currentVisitId, isSigned, isRetracted, isSaving, loading } = state;

    // ── Core Save Function ────────────────────────────────────────────────

    const performSave = useCallback(async (showToastMessage = false) => {
        if (isSigned || isRetracted || isSaving || isAutoSavingRef.current) return;
        if (!patientId) return;

        isAutoSavingRef.current = true;

        try {
            const noteDraft = combineNoteSections(noteData);
            let visitId = currentVisitId;

            // Create visit if needed
            if (!visitId || visitId === 'new') {
                try {
                    const response = await visitsAPI.openToday(
                        patientId,
                        visitType === 'Office Visit' ? 'office_visit' : visitType.toLowerCase().replace(' ', '_')
                    );
                    const visit = response.data?.note || response.data;
                    if (!visit || !visit.id) throw new Error('Invalid visit response');

                    visitId = visit.id;
                    dispatch({ type: ACTIONS.VISIT_CREATED, payload: { visit } });
                    window.history.replaceState({}, '', `/patient/${patientId}/visit/${visitId}`);
                    hasInitialSaveRef.current = true;
                } catch (error) {
                    console.error('Failed to create visit for auto-save:', error);
                    isAutoSavingRef.current = false;
                    return;
                }
            }

            if (visitId) {
                const vitalsPayload = buildVitalsPayload(vitals);
                await visitsAPI.update(visitId, {
                    noteDraft: noteDraft || '',
                    vitals: vitalsPayload,
                    visit_type: visitType,
                });

                // Reload to sync
                const reloadResponse = await visitsAPI.get(visitId);
                dispatch({ type: ACTIONS.VISIT_LOADED, payload: { visit: reloadResponse.data } });
                // Restore local noteData fields that might differ from parsed reload
                // (e.g., planStructured which is a front-end concern)
                dispatch({ type: ACTIONS.SET_LAST_SAVED, payload: new Date() });
                hasInitialSaveRef.current = true;

                if (showToastMessage) {
                    showToast('Draft saved successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            if (showToastMessage) {
                showToast('Failed to save: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
            }
        } finally {
            isAutoSavingRef.current = false;
        }
    }, [patientId, currentVisitId, isSigned, isRetracted, isSaving, noteData, vitals, visitType, dispatch, showToast]);

    // ── Schedule Auto-Save (debounced) ────────────────────────────────────

    const scheduleAutoSave = useCallback((showToastMessage = false) => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
            performSave(showToastMessage);
        }, AUTO_SAVE_DELAY);
    }, [performSave]);

    // ── Manual Save ───────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = null;
        }
        await performSave(true);
    }, [performSave]);

    // ── Initial Save on Load ──────────────────────────────────────────────

    useEffect(() => {
        if (!loading && !isSigned && state.visitData && state.visitData.id && !hasInitialSaveRef.current) {
            const timer = setTimeout(() => {
                performSave(false);
                hasInitialSaveRef.current = true;
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, isSigned, state.visitData, performSave]);

    // ── Auto-Save on Data Changes ─────────────────────────────────────────

    useEffect(() => {
        if (hasInitialSaveRef.current && !isSigned && !loading) {
            scheduleAutoSave(false);
        }
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [noteData, vitals, visitType, scheduleAutoSave, isSigned, loading]);

    // ── localStorage Backup ───────────────────────────────────────────────

    useEffect(() => {
        if (!patientId || !currentVisitId || currentVisitId === 'new' || loading || isSigned) return;

        const backupKey = `paper_emr_backup_${patientId}_${currentVisitId}`;
        const timeout = setTimeout(() => {
            const backupData = {
                noteData,
                vitals,
                timestamp: Date.now(),
            };
            localStorage.setItem(backupKey, JSON.stringify(backupData));
        }, LOCAL_BACKUP_DELAY);

        return () => clearTimeout(timeout);
    }, [noteData, vitals, patientId, currentVisitId, loading, isSigned]);

    // ── Restore from Backup ───────────────────────────────────────────────

    useEffect(() => {
        if (!loading && state.visitData && currentVisitId && currentVisitId !== 'new' && !isSigned) {
            const backupKey = `paper_emr_backup_${patientId}_${currentVisitId}`;
            const saved = localStorage.getItem(backupKey);
            if (saved) {
                try {
                    const localBackup = JSON.parse(saved);
                    const serverTime = new Date(state.visitData.updated_at || 0).getTime();
                    const localTime = localBackup.timestamp || 0;
                    const isNewer = localTime > serverTime + 2000;
                    const serverNoteLength = (state.visitData.note_draft || '').length;
                    const localNoteLength = (localBackup.noteData?.plan || '').length +
                        (localBackup.noteData?.assessment || '').length;

                    if (isNewer || (serverNoteLength < 10 && localNoteLength > 20)) {
                        dispatch({
                            type: ACTIONS.RESTORE_FROM_BACKUP,
                            payload: {
                                noteData: localBackup.noteData,
                                vitals: localBackup.vitals,
                            },
                        });
                    }
                } catch (e) {
                    console.error('Error parsing local backup', e);
                }
            }
        }
    }, [loading, state.visitData, currentVisitId, patientId, isSigned, dispatch]);

    // ── Clear Backup on Sign ──────────────────────────────────────────────

    const clearBackup = useCallback(() => {
        if (patientId && currentVisitId) {
            localStorage.removeItem(`paper_emr_backup_${patientId}_${currentVisitId}`);
        }
    }, [patientId, currentVisitId]);

    return {
        handleSave,
        performSave,
        scheduleAutoSave,
        clearBackup,
        hasInitialSaveRef,
        cancelPendingAutoSave: useCallback(() => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
                autoSaveTimeoutRef.current = null;
            }
        }, []),
    };
}

export default useAutoSave;
