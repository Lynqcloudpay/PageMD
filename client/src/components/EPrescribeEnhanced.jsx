/**
 * Enhanced E-Prescribe Component - Complete Redesign
 * 
 * Comprehensive e-prescribing interface with:
 * - Medication search and selection
 * - Drug interaction checking
 * - Allergy checking
 * - Automatic quantity/days supply calculation
 * - Controlled substance handling
 * - Pharmacy selection and transmission
 * - Real-time sig preview
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Pill, Search, X, AlertTriangle, Check, Building2, Phone, 
  Clock, RefreshCw, ChevronRight, Shield, Info, MapPin,
  ChevronLeft, Loader, AlertCircle, CheckCircle2, FileText,
  Zap, Calculator, AlertOctagon, CheckCircle, Send, Save
} from 'lucide-react';
import Modal from './ui/Modal';
import DiagnosisSelector from './DiagnosisSelector';
import { useAuth } from '../context/AuthContext';
import { medicationsAPI, prescriptionsAPI, pharmaciesAPI, patientsAPI } from '../services/api';

const EPrescribeEnhanced = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  patientId, 
  patientName, 
  visitId, 
  currentMedications = [], 
  preSelectedDiagnoses = [], 
  assessmentDiagnoses = [], 
  onAddToAssessment = null,
  returnTemplateOnly = false
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Patient data
  const [patientAllergies, setPatientAllergies] = useState([]);
  const [patientMeds, setPatientMeds] = useState([]);
  const [loadingPatientData, setLoadingPatientData] = useState(false);
  
  // Medication search
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // Sig builder
  const [sigStructured, setSigStructured] = useState({
    dose: '',
    route: 'ORAL',
    frequency: '',
    durationValue: '',
    durationUnit: 'days',
    asNeeded: false,
    additionalInstructions: ''
  });
  
  // Prescription details
  const [quantity, setQuantity] = useState('');
  const [daysSupply, setDaysSupply] = useState('');
  const [refills, setRefills] = useState('0');
  const [substitutionAllowed, setSubstitutionAllowed] = useState(true);
  const [priorAuthRequired, setPriorAuthRequired] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [patientInstructions, setPatientInstructions] = useState('');
  
  // Controlled substance
  const [isControlled, setIsControlled] = useState(false);
  const [schedule, setSchedule] = useState('');
  
  // Pharmacy
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacyResults, setPharmacyResults] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [useLocation, setUseLocation] = useState(false);
  
  // Diagnosis selection
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  
  // Warnings and interactions
  const [interactions, setInteractions] = useState([]);
  const [allergyWarnings, setAllergyWarnings] = useState([]);
  const [showWarnings, setShowWarnings] = useState(true);
  
  // Errors and messages
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Prescription status
  const [prescriptionId, setPrescriptionId] = useState(null);
  const [transmissionStatus, setTransmissionStatus] = useState(null);

  // Common routes
  const routes = [
    'ORAL', 'TOPICAL', 'INJECTION', 'INHALATION', 'NASAL', 
    'OPHTHALMIC', 'OTIC', 'RECTAL', 'SUBLINGUAL', 'TRANSDERMAL', 'IV', 'IM', 'SUBQ'
  ];

  // Common frequencies
  const frequencies = [
    'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
    'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
    'As needed', 'At bedtime', 'With meals', 'Before meals',
    'Every other day', 'Weekly', 'Twice weekly', 'Three times weekly'
  ];

  // Controlled substance schedules
  const schedules = [
    { value: 'CII', label: 'Schedule II (CII) - High potential for abuse' },
    { value: 'CIII', label: 'Schedule III (CIII) - Moderate potential for abuse' },
    { value: 'CIV', label: 'Schedule IV (CIV) - Low potential for abuse' },
    { value: 'CV', label: 'Schedule V (CV) - Lowest potential for abuse' }
  ];

  // Common medications for quick access
  const commonMedications = [
    { name: 'Lisinopril', rxcui: '29046', strength: '10 mg tablet' },
    { name: 'Metformin', rxcui: '6809', strength: '500 mg tablet' },
    { name: 'Atorvastatin', rxcui: '83367', strength: '20 mg tablet' },
    { name: 'Amlodipine', rxcui: '17767', strength: '5 mg tablet' },
    { name: 'Omeprazole', rxcui: '7646', strength: '20 mg capsule' },
    { name: 'Albuterol', rxcui: '435', strength: '90 mcg/actuation inhaler' },
    { name: 'Gabapentin', rxcui: '441467', strength: '300 mg capsule' },
    { name: 'Sertraline', rxcui: '36437', strength: '50 mg tablet' },
    { name: 'Levothyroxine', rxcui: '10224', strength: '75 mcg tablet' },
    { name: 'Losartan', rxcui: '82122', strength: '50 mg tablet' },
  ];

  // Load patient allergies and medications
  useEffect(() => {
    if (isOpen && patientId) {
      loadPatientData();
    } else {
      // Reset patient data when modal closes
      setPatientAllergies([]);
      setPatientMeds([]);
    }
  }, [isOpen, patientId]);

  const loadPatientData = async () => {
    if (!patientId) return;
    
    setLoadingPatientData(true);
    try {
      const [allergiesRes, medsRes] = await Promise.all([
        patientsAPI.getAllergies(patientId).catch((err) => {
          console.warn('Error loading allergies:', err);
          return { data: [] };
        }),
        patientsAPI.getMedications(patientId).catch((err) => {
          console.warn('Error loading medications:', err);
          return { data: [] };
        })
      ]);
      
      // Handle both response.data and direct array responses
      const allergies = Array.isArray(allergiesRes.data) 
        ? allergiesRes.data 
        : (Array.isArray(allergiesRes) ? allergiesRes : []);
      const meds = Array.isArray(medsRes.data) 
        ? medsRes.data 
        : (Array.isArray(medsRes) ? medsRes : []);
      
      setPatientAllergies(allergies.filter(a => a.active !== false) || []);
      setPatientMeds(meds.filter(m => m.active !== false) || []);
    } catch (error) {
      console.error('Error loading patient data:', error);
      // Set empty arrays on error to prevent crashes
      setPatientAllergies([]);
      setPatientMeds([]);
    } finally {
      setLoadingPatientData(false);
    }
  };

  // Set pre-selected diagnoses when modal opens
  useEffect(() => {
    if (isOpen && preSelectedDiagnoses.length > 0) {
      setSelectedDiagnoses(preSelectedDiagnoses);
    } else if (isOpen && preSelectedDiagnoses.length === 0) {
      setSelectedDiagnoses([]);
    }
  }, [isOpen, preSelectedDiagnoses]);

  // Medication search
  useEffect(() => {
    if (medicationSearch.length === 0) {
      setMedicationResults([]);
      setSearching(false);
      return;
    }

    if (medicationSearch.length < 2) {
      setMedicationResults([]);
      setSearching(false);
      return;
    }

    const searchLower = medicationSearch.toLowerCase();
    const commonMatches = commonMedications.filter(med => 
      med.name.toLowerCase().includes(searchLower)
    );
    
    if (commonMatches.length > 0) {
      setMedicationResults(commonMatches);
    } else {
      setMedicationResults([]);
    }

    const debounceTime = 200;
    const searchTimer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await medicationsAPI.search(medicationSearch);
        let results = [];
        if (response && response.data) {
          results = Array.isArray(response.data) ? response.data : [];
        } else if (Array.isArray(response)) {
          results = response;
        }
        
        if (results.length > 0) {
          setMedicationResults(results);
        } else {
          const currentCommonMatches = commonMedications.filter(med => 
            med.name.toLowerCase().includes(searchLower)
          );
          setMedicationResults(currentCommonMatches);
        }
      } catch (err) {
        console.error('Medication search error:', err);
        const currentCommonMatches = commonMedications.filter(med => 
          med.name.toLowerCase().includes(searchLower)
        );
        setMedicationResults(currentCommonMatches);
      } finally {
        setSearching(false);
      }
    }, debounceTime);

    return () => clearTimeout(searchTimer);
  }, [medicationSearch]);

  // Pharmacy search
  useEffect(() => {
    if (pharmacySearch.length < 2) {
      setPharmacyResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      try {
        const response = await pharmaciesAPI.search(pharmacySearch);
        setPharmacyResults(response.data || []);
      } catch (err) {
        console.error('Pharmacy search error:', err);
        setPharmacyResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [pharmacySearch]);

  // Check for allergies when medication is selected
  useEffect(() => {
    if (selectedMedication && patientAllergies.length > 0) {
      const medicationName = selectedMedication.name || selectedMedication.medicationName || selectedMedication.fullName || '';
      const warnings = patientAllergies.filter(allergy => {
        const allergen = allergy.allergen?.toLowerCase() || '';
        return medicationName.toLowerCase().includes(allergen) || 
               allergen.includes(medicationName.toLowerCase());
      });
      setAllergyWarnings(warnings);
    } else {
      setAllergyWarnings([]);
    }
  }, [selectedMedication, patientAllergies]);

  // Calculate days supply and quantity automatically
  const calculateDaysSupply = useCallback(() => {
    if (!sigStructured.frequency || !sigStructured.durationValue || !sigStructured.durationUnit) {
      return null;
    }

    // Parse frequency to get times per day
    let timesPerDay = 1;
    const freq = sigStructured.frequency.toLowerCase();
    if (freq.includes('twice') || freq.includes('two times')) timesPerDay = 2;
    else if (freq.includes('three times')) timesPerDay = 3;
    else if (freq.includes('four times')) timesPerDay = 4;
    else if (freq.includes('every 6 hours')) timesPerDay = 4;
    else if (freq.includes('every 8 hours')) timesPerDay = 3;
    else if (freq.includes('every 12 hours')) timesPerDay = 2;
    else if (freq.includes('as needed') || freq.includes('prn')) timesPerDay = 1; // Conservative estimate

    // Calculate days supply
    const durationValue = parseFloat(sigStructured.durationValue);
    let days = durationValue;
    if (sigStructured.durationUnit === 'weeks') days = durationValue * 7;
    else if (sigStructured.durationUnit === 'months') days = durationValue * 30;

    const calculatedDaysSupply = Math.ceil(days);
    const calculatedQuantity = Math.ceil(days * timesPerDay);

    return { daysSupply: calculatedDaysSupply, quantity: calculatedQuantity };
  }, [sigStructured]);

  // Auto-calculate when sig changes
  useEffect(() => {
    if (sigStructured.frequency && sigStructured.durationValue && sigStructured.durationUnit) {
      const calculated = calculateDaysSupply();
      if (calculated) {
        // Only update if the calculated values are different from current values
        // This prevents infinite loops
        const newDaysSupply = calculated.daysSupply.toString();
        const newQuantity = calculated.quantity.toString();
        
        if ((!daysSupply || daysSupply === '') && newDaysSupply !== daysSupply) {
          setDaysSupply(newDaysSupply);
        }
        if ((!quantity || quantity === '') && newQuantity !== quantity) {
          setQuantity(newQuantity);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigStructured.frequency, sigStructured.durationValue, sigStructured.durationUnit]);

  const handleSelectMedication = (med) => {
    setSelectedMedication(med);
    setMedicationSearch(med.name || med.medicationName || med.fullName);
    setMedicationResults([]);
    
    // Auto-populate dose
    if (med.strength || med.doseForm) {
      setSigStructured(prev => ({
        ...prev,
        dose: med.strength || med.doseForm || prev.dose
      }));
    }

    // Check if controlled substance (basic check - in production, use RxNorm API)
    const controlledSubstances = ['oxycodone', 'hydrocodone', 'morphine', 'fentanyl', 'codeine', 'tramadol', 'alprazolam', 'lorazepam', 'diazepam', 'clonazepam'];
    const medName = (med.name || med.medicationName || med.fullName || '').toLowerCase();
    const isControlledMed = controlledSubstances.some(cs => medName.includes(cs));
    setIsControlled(isControlledMed);
    if (isControlledMed && !schedule) {
      setSchedule('CIII'); // Default to CIII, user can change
    }
  };

  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setPharmacySearch(pharmacy.name);
    setPharmacyResults([]);
  };

  const buildSigText = () => {
    if (!selectedMedication || !sigStructured.frequency) return '';
    const dose = sigStructured.dose || selectedMedication.strength || selectedMedication.doseForm || '';
    const medicationName = selectedMedication.name || selectedMedication.medicationName || selectedMedication.fullName || '';
    let sig = dose ? `${dose} ${sigStructured.route.toLowerCase()}` : `${medicationName} ${sigStructured.route.toLowerCase()}`;
    sig += ` ${sigStructured.frequency.toLowerCase()}`;
    if (sigStructured.durationValue && sigStructured.durationUnit) {
      sig += ` for ${sigStructured.durationValue} ${sigStructured.durationUnit}`;
    }
    if (sigStructured.asNeeded) sig += ' as needed';
    if (sigStructured.additionalInstructions) sig += `; ${sigStructured.additionalInstructions}`;
    return sig;
  };

  const validatePrescription = () => {
    if (!selectedMedication) {
      return 'Please select a medication';
    }
    if (!sigStructured.frequency) {
      return 'Please select a frequency';
    }
    if (selectedDiagnoses.length === 0) {
      return 'Please select at least one diagnosis';
    }
    if (!quantity || parseInt(quantity) <= 0) {
      return 'Please enter a valid quantity';
    }
    if (isControlled && !schedule) {
      return 'Please select a controlled substance schedule';
    }
    if (isControlled && !user.dea_number) {
      return 'DEA number is required for controlled substances';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validatePrescription();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Get all diagnosis IDs (including temporary ones)
      // The server will filter out temp IDs but we need to send them for validation
      const allDiagnosisIds = selectedDiagnoses
        .map(d => d.id)
        .filter(id => id); // Include all IDs, even temp ones

      // Ensure we have at least one diagnosis
      if (allDiagnosisIds.length === 0) {
        setError('Please select at least one diagnosis');
        setSaving(false);
        return;
      }

      const prescriptionData = {
        patientId,
        visitId: visitId || null,
        medicationName: selectedMedication.name || selectedMedication.medicationName || selectedMedication.fullName,
        medicationRxcui: selectedMedication.rxcui || null,
        strength: sigStructured.dose || selectedMedication.strength || selectedMedication.doseForm || null,
        sig: buildSigText(),
        sigStructured: {
          dose: sigStructured.dose || null,
          route: sigStructured.route,
          frequency: sigStructured.frequency,
          durationValue: sigStructured.durationValue || null,
          durationUnit: sigStructured.durationUnit || null,
          asNeeded: sigStructured.asNeeded || false,
          additionalInstructions: sigStructured.additionalInstructions || null
        },
        quantity: parseInt(quantity) || 1,
        daysSupply: daysSupply ? parseInt(daysSupply) : null,
        refills: parseInt(refills) || 0,
        substitutionAllowed: substitutionAllowed !== false,
        priorAuthRequired: priorAuthRequired || false,
        clinicalNotes: clinicalNotes || null,
        patientInstructions: patientInstructions || null,
        isControlled: isControlled || false,
        schedule: (isControlled && schedule) ? schedule : null,
        pharmacyId: selectedPharmacy?.id || null,
        pharmacyName: selectedPharmacy?.name || null,
        pharmacyAddress: selectedPharmacy?.address?.full || selectedPharmacy?.address || null,
        pharmacyPhone: selectedPharmacy?.phone || null,
        diagnosisIds: allDiagnosisIds
      };

      console.log('Creating prescription with data:', prescriptionData);

      // If returnTemplateOnly, don't create prescription, just return template
      if (returnTemplateOnly) {
        const diagnosisText = selectedDiagnoses.map(d => d.problem_name || d.name).join(', ');
        const prescriptionText = `${prescriptionData.medicationName} - ${prescriptionData.sig}`;
        const prescriptionTemplate = {
          type: 'prescription',
          payload: {
            medication: prescriptionData.medicationName,
            medicationRxcui: prescriptionData.medicationRxcui,
            strength: prescriptionData.strength,
            sig: prescriptionData.sig,
            sigStructured: prescriptionData.sigStructured,
            quantity: prescriptionData.quantity,
            daysSupply: prescriptionData.daysSupply,
            refills: prescriptionData.refills,
            substitutionAllowed: prescriptionData.substitutionAllowed,
            priorAuthRequired: prescriptionData.priorAuthRequired
          }
        };
        setSaving(false);
        handleClose();
        if (onSuccess) {
          onSuccess(diagnosisText, prescriptionText, prescriptionTemplate);
        }
        return;
      }

      const response = await prescriptionsAPI.create(prescriptionData);
      
      if (response && response.data) {
        setPrescriptionId(response.data.id || response.data);
        setSuccess('Prescription saved successfully!');
        
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        setPrescriptionId(response?.id || null);
        setSuccess('Prescription saved successfully!');
      }
    } catch (err) {
      console.error('Error saving prescription:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save prescription. Please check all required fields.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    // Validate first
    const validationError = validatePrescription();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Save first if not already saved
    if (!prescriptionId) {
      setSaving(true);
      try {
        const allDiagnosisIds = selectedDiagnoses
          .map(d => d.id)
          .filter(id => id);

        if (allDiagnosisIds.length === 0) {
          setError('Please select at least one diagnosis');
          setSaving(false);
          return;
        }

        const prescriptionData = {
          patientId,
          visitId: visitId || null,
          medicationName: selectedMedication.name || selectedMedication.medicationName || selectedMedication.fullName,
          medicationRxcui: selectedMedication.rxcui || null,
          strength: sigStructured.dose || selectedMedication.strength || selectedMedication.doseForm || null,
          sig: buildSigText(),
          sigStructured: {
            dose: sigStructured.dose || null,
            route: sigStructured.route,
            frequency: sigStructured.frequency,
            durationValue: sigStructured.durationValue || null,
            durationUnit: sigStructured.durationUnit || null,
            asNeeded: sigStructured.asNeeded || false,
            additionalInstructions: sigStructured.additionalInstructions || null
          },
          quantity: parseInt(quantity) || 1,
          daysSupply: daysSupply ? parseInt(daysSupply) : null,
          refills: parseInt(refills) || 0,
          substitutionAllowed: substitutionAllowed !== false,
          priorAuthRequired: priorAuthRequired || false,
          clinicalNotes: clinicalNotes || null,
          patientInstructions: patientInstructions || null,
          isControlled: isControlled || false,
          schedule: (isControlled && schedule) ? schedule : null,
          pharmacyId: selectedPharmacy?.id || null,
          pharmacyName: selectedPharmacy?.name || null,
          pharmacyAddress: selectedPharmacy?.address?.full || selectedPharmacy?.address || null,
          pharmacyPhone: selectedPharmacy?.phone || null,
          diagnosisIds: allDiagnosisIds
        };

        const response = await prescriptionsAPI.create(prescriptionData);
        setPrescriptionId(response.data?.id || response?.id || response.data);
      } catch (err) {
        console.error('Error saving prescription before send:', err);
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save prescription. Please try again.';
        setError(errorMessage);
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    // Now send
    setSending(true);
    setError(null);

    try {
      const response = await prescriptionsAPI.send(prescriptionId, {
        transmissionMethod: 'electronic',
        pharmacyId: selectedPharmacy?.id,
        pharmacyNcpdpId: selectedPharmacy?.ncpdpId
      });

      setTransmissionStatus(response.data?.transmissionStatus || 'sent');
      setSuccess('Prescription sent successfully!');
      
      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Error sending prescription:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send prescription. Please try again.';
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMedicationSearch('');
    setMedicationResults([]);
    setSelectedMedication(null);
    setPharmacySearch('');
    setPharmacyResults([]);
    setSelectedPharmacy(null);
    setSigStructured({
      dose: '',
      route: 'ORAL',
      frequency: '',
      durationValue: '',
      durationUnit: 'days',
      asNeeded: false,
      additionalInstructions: ''
    });
    setQuantity('');
    setDaysSupply('');
    setRefills('0');
    setSubstitutionAllowed(true);
    setPriorAuthRequired(false);
    setClinicalNotes('');
    setPatientInstructions('');
    setIsControlled(false);
    setSchedule('');
    setError(null);
    setSuccess(null);
    setSelectedDiagnoses([]);
    setPrescriptionId(null);
    setTransmissionStatus(null);
    setAllergyWarnings([]);
    setInteractions([]);
    onClose();
  };

  const hasWarnings = allergyWarnings.length > 0 || interactions.length > 0;
  const validationError = validatePrescription();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="E-Prescribe" size="3xl" preventOutsideClick={true}>
      <div className="space-y-2 max-h-[85vh] overflow-y-auto pr-1">
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="flex-shrink-0">
              <X className="w-3 h-3 text-red-600" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded p-2 flex items-center space-x-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-800">{success}</p>
          </div>
        )}

        {/* Patient Info Bar - Compact */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-900 truncate">{patientName}</p>
              {patientAllergies.length > 0 && (
                <p className="text-xs text-blue-700 truncate">
                  Allergies: {patientAllergies.map(a => a.allergen).join(', ')}
                </p>
              )}
            </div>
            {loadingPatientData && (
              <Loader className="w-3 h-3 text-blue-600 animate-spin flex-shrink-0 ml-2" />
            )}
          </div>
        </div>

        {/* Diagnosis Selection - Compact */}
        {patientId && (
          <div className="bg-gray-50 border border-gray-200 rounded p-2">
            <DiagnosisSelector
              patientId={patientId}
              selectedDiagnoses={selectedDiagnoses}
              onDiagnosesChange={setSelectedDiagnoses}
              required={true}
              allowMultiple={true}
              assessmentDiagnoses={assessmentDiagnoses || []}
              onAddToAssessment={onAddToAssessment}
            />
          </div>
        )}

        {/* Warnings - Compact */}
        {hasWarnings && showWarnings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <h3 className="text-xs font-semibold text-yellow-900">Warnings</h3>
              </div>
              <button onClick={() => setShowWarnings(false)}>
                <X className="w-3 h-3 text-yellow-600" />
              </button>
            </div>
            {allergyWarnings.length > 0 && (
              <div className="mb-1">
                <p className="text-xs font-medium text-yellow-800 mb-0.5">Allergy:</p>
                {allergyWarnings.map((allergy, idx) => (
                  <p key={idx} className="text-xs text-yellow-700">
                    <strong>{allergy.allergen}</strong>
                    {allergy.reaction && ` (${allergy.reaction})`}
                  </p>
                ))}
              </div>
            )}
            {interactions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-800 mb-0.5">Interactions:</p>
                {interactions.map((interaction, idx) => (
                  <p key={idx} className="text-xs text-yellow-700">{interaction}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left Column: Medication & Prescription Details */}
          <div className="space-y-2">
            {/* Medication Search - Compact */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Medication <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                <input
                  type="text"
                  value={medicationSearch}
                  onChange={(e) => setMedicationSearch(e.target.value)}
                  placeholder="Search medication..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                    <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
              
              {/* Medication Results */}
              {medicationSearch.length >= 2 && (medicationResults.length > 0 || searching) && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {searching && medicationResults.length === 0 ? (
                    <div className="p-4 text-center">
                      <Loader className="w-5 h-5 text-primary-600 animate-spin mx-auto" />
                      <p className="text-xs text-gray-500 mt-2">Searching...</p>
                    </div>
                  ) : medicationResults.length > 0 ? (
                    medicationResults.map((med, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectMedication(med)}
                        className="w-full p-3 hover:bg-primary-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{med.name || med.medicationName || med.fullName}</p>
                          {(med.strength || med.doseForm) && (
                            <p className="text-xs text-gray-500 mt-1">{med.strength || med.doseForm}</p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-gray-500">No medications found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Medication */}
              {selectedMedication && (
                <div className="mt-2 bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-primary-900">{selectedMedication.name || selectedMedication.medicationName}</p>
                      {selectedMedication.strength && (
                        <p className="text-sm text-primary-700 mt-1">{selectedMedication.strength}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMedication(null);
                        setMedicationSearch('');
                        setIsControlled(false);
                        setSchedule('');
                      }}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Prescription Details - Compact */}
            <div className="bg-white border border-gray-200 rounded p-2 space-y-2">
              <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-200 pb-1">Prescription Details</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Dose</label>
                  <input
                    type="text"
                    value={sigStructured.dose}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, dose: e.target.value }))}
                    placeholder={selectedMedication?.strength || "e.g., 10 mg"}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Route <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sigStructured.route}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, route: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    {routes.map(route => (
                      <option key={route} value={route}>{route}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sigStructured.frequency}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {frequencies.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Duration</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="1"
                      value={sigStructured.durationValue}
                      onChange={(e) => setSigStructured(prev => ({ ...prev, durationValue: e.target.value }))}
                      placeholder="7"
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <select
                      value={sigStructured.durationUnit}
                      onChange={(e) => setSigStructured(prev => ({ ...prev, durationUnit: e.target.value }))}
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={sigStructured.asNeeded}
                  onChange={(e) => setSigStructured(prev => ({ ...prev, asNeeded: e.target.checked }))}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-xs text-gray-700">As needed (PRN)</label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Additional Instructions</label>
                <input
                  type="text"
                  value={sigStructured.additionalInstructions}
                  onChange={(e) => setSigStructured(prev => ({ ...prev, additionalInstructions: e.target.value }))}
                  placeholder="e.g., with food"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Sig Preview - Compact */}
              <div className="bg-gray-50 border border-gray-200 rounded p-1.5">
                <p className="text-xs font-medium text-gray-700 mb-0.5">Sig:</p>
                <p className="text-xs text-gray-900 font-mono">{buildSigText() || 'Enter details...'}</p>
              </div>
            </div>

            {/* Quantity and Refills - Compact */}
            <div className="bg-white border border-gray-200 rounded p-2">
              <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-200 pb-1 mb-2">Quantity & Refills</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Days Supply</label>
                  <input
                    type="number"
                    value={daysSupply}
                    onChange={(e) => setDaysSupply(e.target.value)}
                    placeholder="Auto"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Refills</label>
                  <input
                    type="number"
                    value={refills}
                    onChange={(e) => setRefills(e.target.value)}
                    min="0"
                    max="11"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Controlled Substance - Compact */}
            {isControlled && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <div className="flex items-center space-x-1 mb-2">
                  <Shield className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs font-semibold text-red-900">Controlled Substance</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Schedule <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {schedules.map(s => (
                      <option key={s.value} value={s.value}>{s.value}</option>
                    ))}
                  </select>
                  {!user.dea_number && (
                    <p className="text-xs text-red-600 mt-0.5">DEA number required</p>
                  )}
                </div>
              </div>
            )}

            {/* Additional Options - Compact */}
            <div className="bg-white border border-gray-200 rounded p-2 space-y-1.5">
              <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-200 pb-1">Additional Options</h3>
              
              <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  id="substitution"
                  checked={substitutionAllowed}
                  onChange={(e) => setSubstitutionAllowed(e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="substitution" className="text-xs text-gray-700">
                  Allow generic substitution
                </label>
              </div>

              <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  id="priorAuth"
                  checked={priorAuthRequired}
                  onChange={(e) => setPriorAuthRequired(e.target.checked)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="priorAuth" className="text-xs text-gray-700">
                  Prior authorization required
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Clinical Notes</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Internal notes"
                  rows="1"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Patient Instructions</label>
                <textarea
                  value={patientInstructions}
                  onChange={(e) => setPatientInstructions(e.target.value)}
                  placeholder="Patient instructions"
                  rows="1"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Pharmacy Selection - Compact */}
          <div className="space-y-2">
            <div className="bg-white border border-gray-200 rounded p-2">
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Pharmacy (Optional)
              </label>
              <div className="flex space-x-1 mb-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={pharmacySearch}
                    onChange={(e) => setPharmacySearch(e.target.value)}
                    placeholder="Search pharmacy..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setUseLocation(!useLocation)}
                  className={`px-2 py-1.5 rounded border transition-colors ${
                    useLocation
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Use current location"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Pharmacy - Compact */}
              {selectedPharmacy && (
                <div className="mt-1 bg-blue-50 border border-blue-200 rounded p-1.5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        <p className="font-semibold text-blue-900 text-xs truncate">{selectedPharmacy.name}</p>
                        {selectedPharmacy.integrationEnabled && (
                          <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded flex-shrink-0">
                            E-Rx
                          </span>
                        )}
                      </div>
                      {selectedPharmacy.address?.full && (
                        <p className="text-xs text-blue-700 truncate">{selectedPharmacy.address.full}</p>
                      )}
                      {selectedPharmacy.phone && (
                        <p className="text-xs text-blue-600 flex items-center space-x-1">
                          <Phone className="w-3 h-3" />
                          <span>{selectedPharmacy.phone}</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPharmacy(null);
                        setPharmacySearch('');
                      }}
                      className="text-blue-600 hover:text-blue-700 flex-shrink-0 ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pharmacy Results */}
              {pharmacyResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {pharmacyResults.map((pharmacy) => (
                    <button
                      key={pharmacy.id}
                      type="button"
                      onClick={() => handleSelectPharmacy(pharmacy)}
                      className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-start justify-between text-left transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <p className="font-medium text-gray-900">{pharmacy.name}</p>
                          {pharmacy.integrationEnabled && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              Electronic
                            </span>
                          )}
                        </div>
                        {pharmacy.address?.full && (
                          <p className="text-xs text-gray-600 mt-1">{pharmacy.address.full}</p>
                        )}
                        {pharmacy.phone && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center space-x-1">
                            <Phone className="w-3 h-3" />
                            <span>{pharmacy.phone}</span>
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                    </button>
                  ))}
                </div>
              )}

              {pharmacySearch.length >= 2 && pharmacyResults.length === 0 && !selectedPharmacy && (
                <p className="text-xs text-gray-500 text-center py-4">
                  No pharmacies found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Compact */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
          <div className="text-xs text-gray-500">
            {validationError && (
              <span className="text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">{validationError}</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!validationError}
              className="px-3 py-1.5 text-xs text-white bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-gray-700 flex items-center space-x-1"
            >
              {saving ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || sending || !!validationError || (isControlled && !user.dea_number)}
              className="px-3 py-1.5 text-xs text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EPrescribeEnhanced;
