/**
 * Role-Based Access Control Hook
 * 
 * Determines user permissions based on role:
 * - Medical Staff (Physician, NP, PA): Can edit/sign notes, send prescriptions, order labs/imaging/procedures
 * - Support Staff (Nurse, MA): Can add vitals, PMH, allergies, family history, social history, home meds, upload documents
 */

import { useAuth } from '../context/AuthContext';

export const useMedicalAccess = () => {
    const { user } = useAuth();

    // Check if user is a physician/NP/PA (medical staff)
    const isMedicalStaff = () => {
        if (!user) return false;
        
        const roleName = user.role_name || user.role || '';
        const roleNameLower = roleName.toLowerCase();
        
        return (
            roleNameLower === 'physician' ||
            roleNameLower === 'nurse practitioner' ||
            roleNameLower === 'np' ||
            roleNameLower === 'physician assistant' ||
            roleNameLower === 'pa' ||
            // Legacy support
            roleNameLower === 'clinician' ||
            user.role === 'clinician'
        );
    };

    // Check if user is support staff (Nurse, MA)
    const isSupportStaff = () => {
        if (!user) return false;
        
        const roleName = user.role_name || user.role || '';
        const roleNameLower = roleName.toLowerCase();
        
        return (
            roleNameLower === 'nurse' ||
            roleNameLower === 'medical assistant' ||
            roleNameLower === 'ma' ||
            roleNameLower === 'rn' ||
            roleNameLower === 'lpn'
        );
    };

    // Check if user is a physician specifically
    const isPhysician = () => {
        if (!user) return false;
        
        const roleName = user.role_name || user.role || '';
        const roleNameLower = roleName.toLowerCase();
        
        return (
            roleNameLower === 'physician' ||
            roleNameLower === 'doctor' ||
            roleNameLower === 'md' ||
            roleNameLower === 'do'
        );
    };

    // Medical actions (Physician, NP, PA only)
    const canEditSignNotes = () => isMedicalStaff();
    const canSendPrescriptions = () => isMedicalStaff();
    const canOrderLabs = () => isMedicalStaff();
    const canOrderImaging = () => isMedicalStaff();
    const canOrderProcedures = () => isMedicalStaff();
    const canPerformMedicalActions = () => isMedicalStaff();

    // Support actions (Nurse, MA, and Medical Staff)
    const canAddVitals = () => isSupportStaff() || isMedicalStaff();
    const canAddPMH = () => isSupportStaff() || isMedicalStaff();
    const canAddAllergies = () => isSupportStaff() || isMedicalStaff();
    const canAddFamilyHistory = () => isSupportStaff() || isMedicalStaff();
    const canAddSocialHistory = () => isSupportStaff() || isMedicalStaff();
    const canAddHomeMeds = () => isSupportStaff() || isMedicalStaff();
    const canUploadDocuments = () => isSupportStaff() || isMedicalStaff();

    return {
        isMedicalStaff: isMedicalStaff(),
        isSupportStaff: isSupportStaff(),
        isPhysician: isPhysician(),
        // Medical permissions
        canEditSignNotes: canEditSignNotes(),
        canSendPrescriptions: canSendPrescriptions(),
        canOrderLabs: canOrderLabs(),
        canOrderImaging: canOrderImaging(),
        canOrderProcedures: canOrderProcedures(),
        canPerformMedicalActions: canPerformMedicalActions(),
        // Support permissions
        canAddVitals: canAddVitals(),
        canAddPMH: canAddPMH(),
        canAddAllergies: canAddAllergies(),
        canAddFamilyHistory: canAddFamilyHistory(),
        canAddSocialHistory: canAddSocialHistory(),
        canAddHomeMeds: canAddHomeMeds(),
        canUploadDocuments: canUploadDocuments(),
    };
};

export default useMedicalAccess;





















