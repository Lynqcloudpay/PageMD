/**
 * useSigningWorkflow.js
 * Sign, cosign, retract, and delete workflows.
 */
import { useCallback, useMemo } from 'react';
import { combineNoteSections, buildVitalsPayload } from '../utils/noteSerializer';
import { visitsAPI, patientsAPI } from '../../../services/api';
import { ACTIONS } from './useChartingEngine';
import { useAuth } from '../../../context/AuthContext';

export function useSigningWorkflow({ state, dispatch, patientId, diagnoses, showToast, clearBackup, cancelPendingAutoSave }) {
    const { user } = useAuth();

    const isAttending = useMemo(() => {
        if (!user) return false;
        const role = (user.role || '').toLowerCase();
        const roleName = (user.role_name || '').toLowerCase();
        const profType = (user.professional_type || '').toLowerCase();
        return roleName === 'physician' || role === 'physician' || role === 'clinician' ||
            role === 'admin' || profType.includes('md') || profType.includes('do');
    }, [user]);

    const handleSign = useCallback(async (selectedAttendingId) => {
        const { isSigned, isSaving, noteData, vitals, visitType, currentVisitId } = state;
        if (isSigned || isSaving) return;

        const role = (user?.role_name || user?.role || '').toUpperCase();
        const needsCosign = role.match(/RESIDENT|NP|PA|PRACTITIONER|ASSISTANT/);
        if (needsCosign && !selectedAttendingId) return 'NEEDS_ATTENDING';

        dispatch({ type: ACTIONS.SET_SAVING, payload: true });
        try {
            const noteDraft = combineNoteSections(noteData);
            let visitId = currentVisitId;

            if (!visitId || visitId === 'new') {
                if (!patientId) { showToast('Patient ID is missing', 'error'); dispatch({ type: ACTIONS.SET_SAVING, payload: false }); return; }
                const resp = await visitsAPI.openToday(patientId, visitType === 'Office Visit' ? 'office_visit' : visitType.toLowerCase().replace(' ', '_'));
                visitId = (resp.data?.note || resp.data)?.id;
                if (!visitId) throw new Error('Failed to create visit');
                dispatch({ type: ACTIONS.VISIT_CREATED, payload: { visit: resp.data?.note || resp.data } });
            }

            const vitalsPayload = buildVitalsPayload(vitals);
            await visitsAPI.update(visitId, { noteDraft: noteDraft || '', vitals: vitalsPayload });
            const signRes = await visitsAPI.sign(visitId, noteDraft, vitalsPayload, selectedAttendingId);

            if (signRes.data?.status === 'preliminary') {
                showToast('Note submitted for cosignature (Preliminary)', 'success');
            } else {
                showToast('Note signed successfully', 'success');
            }

            // Sync diagnoses to problem list
            try {
                if (diagnoses?.length > 0) {
                    const currentProblems = state.patientData?.problems || [];
                    let added = 0;
                    for (const diag of diagnoses) {
                        const cleanDiag = (typeof diag === 'string' ? diag : String(diag || '')).replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
                        if (!cleanDiag) continue;
                        const match = cleanDiag.match(/^([A-Z][0-9.]+)\s*-\s*(.+)$/);
                        const icd10Code = match ? match[1] : null;
                        const problemName = match ? match[2] : cleanDiag;
                        const exists = currentProblems.some(p =>
                            (icd10Code && p.icd10_code === icd10Code) || (p.problem_name?.toLowerCase() === problemName.toLowerCase())
                        );
                        if (!exists) {
                            await patientsAPI.addProblem(patientId, { problemName, icd10Code, onsetDate: new Date().toISOString(), status: 'active' });
                            added++;
                        }
                    }
                    if (added > 0) {
                        window.dispatchEvent(new Event('patient-data-updated'));
                        showToast(`Synced ${added} problem(s) to chart`, 'success');
                    }
                }
            } catch (err) { console.error('Error syncing problems:', err); }

            clearBackup();
            const response = await visitsAPI.get(visitId);
            dispatch({ type: ACTIONS.VISIT_LOADED, payload: { visit: response.data } });
        } catch (error) {
            showToast('Failed to sign note: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
        } finally {
            dispatch({ type: ACTIONS.SET_SAVING, payload: false });
        }
    }, [state, dispatch, patientId, diagnoses, showToast, clearBackup, user]);

    const handleCosign = useCallback(async (attestationText, authorshipModel = 'Addendum') => {
        if (authorshipModel === 'Direct Edit' && !state.isDirectEditing) {
            dispatch({ type: ACTIONS.SET_DIRECT_EDITING, payload: true });
            showToast("Direct edit mode enabled. You can now modify the trainee's note.", 'info');
            return;
        }

        if (state.isSaving) return;
        dispatch({ type: ACTIONS.SET_SAVING, payload: true });
        try {
            const visitId = state.currentVisitId;
            const finalModel = state.isDirectEditing ? 'Direct Edit' : authorshipModel;
            const finalText = state.isDirectEditing ? (attestationText || 'Note reviewed and edited directly.') : attestationText;

            if (state.isDirectEditing) {
                cancelPendingAutoSave();
                const noteDraft = combineNoteSections(state.noteData);
                const vitalsPayload = buildVitalsPayload(state.vitals);
                await visitsAPI.update(visitId, { noteDraft, vitals: vitalsPayload });
            }

            await visitsAPI.cosign(visitId, { attestationText: finalText, authorshipModel: finalModel });
            showToast('Note cosigned successfully', 'success');

            const response = await visitsAPI.get(visitId);
            dispatch({ type: ACTIONS.VISIT_LOADED, payload: { visit: response.data } });
            dispatch({ type: ACTIONS.SET_DIRECT_EDITING, payload: false });
        } catch (error) {
            showToast('Failed to cosign note: ' + (error.response?.data?.error || error.message || 'Unknown error'), 'error');
        } finally {
            dispatch({ type: ACTIONS.SET_SAVING, payload: false });
        }
    }, [state, dispatch, showToast, cancelPendingAutoSave]);

    const handleDelete = useCallback(async (navigate) => {
        if (state.isSigned) { showToast('Cannot delete signed notes', 'error'); return; }
        if (!window.confirm('Are you sure you want to delete this draft note?')) return;
        const visitId = state.currentVisitId;
        if (!visitId || visitId === 'new') { navigate(`/patient/${patientId}/snapshot`); return; }
        try {
            await visitsAPI.delete(visitId);
            showToast('Draft note deleted successfully', 'success');
            setTimeout(() => navigate(`/patient/${patientId}/snapshot`), 1000);
        } catch (error) {
            showToast('Failed to delete draft note', 'error');
        }
    }, [state, patientId, showToast]);

    return { handleSign, handleCosign, handleDelete, isAttending };
}

export default useSigningWorkflow;
