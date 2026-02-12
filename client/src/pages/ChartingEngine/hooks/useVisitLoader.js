/**
 * useVisitLoader.js
 * Handles all data fetching for visit initialization.
 */
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI, documentsAPI, usersAPI } from '../../../services/api';
import { ACTIONS } from './useChartingEngine';

export function useVisitLoader({ patientId, urlVisitId, dispatch, showToast }) {
    const navigate = useNavigate();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [previousWeight, setPreviousWeight] = useState(null);
    const [previousWeightUnit, setPreviousWeightUnit] = useState('lbs');
    const [chartReviewData, setChartReviewData] = useState({ visits: [], loading: true });

    // Load patient snapshot, family/surgical/social history
    useEffect(() => {
        if (!patientId) return;

        patientsAPI.getSnapshot(patientId)
            .then(async res => {
                const data = res.data;
                if (data && (!data.medications || data.medications.length === 0)) {
                    try {
                        const medsRes = await patientsAPI.getMedications(patientId);
                        data.medications = medsRes.data || [];
                    } catch (e) { /* silent */ }
                }
                dispatch({ type: ACTIONS.SET_PATIENT_DATA, payload: data });
            })
            .catch(e => console.error('Error fetching patient snapshot:', e));

        patientsAPI.getFamilyHistory(patientId)
            .then(res => dispatch({ type: ACTIONS.SET_FAMILY_HISTORY, payload: res.data || [] }))
            .catch(e => console.error('Error fetching family history:', e));

        patientsAPI.getSurgicalHistory(patientId)
            .then(res => dispatch({ type: ACTIONS.SET_SURGICAL_HISTORY, payload: res.data || [] }))
            .catch(e => console.error('Error fetching surgical history:', e));

        const fetchSocialHistory = () => {
            patientsAPI.getSocialHistory(patientId)
                .then(res => dispatch({ type: ACTIONS.SET_SOCIAL_HISTORY, payload: res.data || {} }))
                .catch(e => console.error('Error fetching social history:', e));
        };
        fetchSocialHistory();

        const handlePatientDataUpdate = () => {
            fetchSocialHistory();
            patientsAPI.getFamilyHistory(patientId)
                .then(res => dispatch({ type: ACTIONS.SET_FAMILY_HISTORY, payload: res.data || [] }))
                .catch(() => { });
            patientsAPI.getSurgicalHistory(patientId)
                .then(res => dispatch({ type: ACTIONS.SET_SURGICAL_HISTORY, payload: res.data || [] }))
                .catch(() => { });
            patientsAPI.getSnapshot(patientId)
                .then(async res => {
                    const data = res.data;
                    if (data && (!data.medications || data.medications.length === 0)) {
                        try { data.medications = (await patientsAPI.getMedications(patientId)).data || []; } catch (e) { }
                    }
                    dispatch({ type: ACTIONS.SET_PATIENT_DATA, payload: data });
                })
                .catch(() => { });
        };

        window.addEventListener('patient-data-updated', handlePatientDataUpdate);
        return () => window.removeEventListener('patient-data-updated', handlePatientDataUpdate);
    }, [patientId, dispatch]);

    // Load or create visit
    useEffect(() => {
        if (urlVisitId === 'new' && patientId) {
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });
            visitsAPI.openToday(patientId, 'office_visit')
                .then(response => {
                    const visit = response.data?.note || response.data;
                    if (!visit || !visit.id) throw new Error('Invalid visit response');
                    dispatch({ type: ACTIONS.VISIT_CREATED, payload: { visit } });
                    navigate(`/patient/${patientId}/visit/${visit.id}`, { replace: true });
                })
                .catch(error => {
                    console.error('Error creating visit:', error);
                    showToast('Could not create visit. Please try again.', 'error');
                    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
                    setTimeout(() => navigate(`/patient/${patientId}/snapshot`), 2000);
                });
        } else if (urlVisitId && urlVisitId !== 'new') {
            dispatch({ type: ACTIONS.SET_LOADING, payload: true });
            visitsAPI.get(urlVisitId)
                .then(response => {
                    dispatch({ type: ACTIONS.VISIT_LOADED, payload: { visit: response.data } });
                    const status = (response.data.status || '').toLowerCase().trim();
                    if (status === 'retracted') {
                        visitsAPI.getRetraction(urlVisitId)
                            .then(res => dispatch({ type: ACTIONS.SET_RETRACTION_INFO, payload: res.data }))
                            .catch(() => { });
                    }
                })
                .catch(error => {
                    console.error('Error loading visit:', error);
                    showToast('Could not load visit.', 'error');
                    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
                });
        } else {
            dispatch({ type: ACTIONS.SET_LOADING, payload: false });
        }
    }, [urlVisitId, patientId, navigate, refreshTrigger, dispatch, showToast]);

    // Load visit documents
    useEffect(() => {
        if (patientId && urlVisitId && urlVisitId !== 'new') {
            documentsAPI.getByPatient(patientId).then(res => {
                const docs = res.data || [];
                const linked = docs.filter(d => d.visit_id === urlVisitId);
                dispatch({ type: ACTIONS.SET_VISIT_DOCUMENTS, payload: linked });
            }).catch(() => { });
        }
    }, [patientId, urlVisitId, dispatch]);

    // Load attendings
    useEffect(() => {
        usersAPI.getDirectory().then(res => {
            const filtered = (res.data || []).filter(u => {
                const pt = (u.professional_type || '').toLowerCase();
                const r = (u.role || '').toLowerCase();
                return pt.includes('physician') || pt.includes('md') || pt.includes('do') || r.includes('physician');
            });
            dispatch({ type: ACTIONS.SET_ATTENDINGS, payload: filtered });
        }).catch(() => { });
    }, [dispatch]);

    // Previous weight
    useEffect(() => {
        if (!patientId || !urlVisitId || urlVisitId === 'new') return;
        visitsAPI.getByPatient(patientId).then(res => {
            const visits = (res.data || [])
                .filter(v => v.id !== urlVisitId && v.vitals)
                .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
            if (visits.length > 0) {
                const pv = typeof visits[0].vitals === 'string' ? JSON.parse(visits[0].vitals) : visits[0].vitals;
                if (pv?.weight) { setPreviousWeight(pv.weight); setPreviousWeightUnit(pv.weightUnit || 'lbs'); }
            }
        }).catch(() => { });
    }, [patientId, urlVisitId]);

    // Chart review data
    useEffect(() => {
        if (!patientId) return;
        setChartReviewData(prev => ({ ...prev, loading: true }));
        visitsAPI.getByPatient(patientId)
            .then(res => setChartReviewData({ visits: res.data || [], loading: false }))
            .catch(() => setChartReviewData({ visits: [], loading: false }));
    }, [patientId]);

    // Privacy authorization handler
    useEffect(() => {
        const handler = (event) => {
            if (event.detail?.patientId === patientId) setRefreshTrigger(p => p + 1);
        };
        window.addEventListener('privacy:authorized', handler);
        return () => window.removeEventListener('privacy:authorized', handler);
    }, [patientId]);

    return { previousWeight, previousWeightUnit, chartReviewData, navigate };
}

export default useVisitLoader;
