/**
 * Enhanced E-Prescribe Component
 * 
 * Production-ready e-prescribing workflow with:
 * - RxNorm medication search
 * - Structured sig builder
 * - Pharmacy directory search
 * - Drug interaction checking
 * - Controlled substance handling
 * - Electronic transmission
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Pill, Search, X, AlertTriangle, Check, Building2, Phone, 
  Clock, RefreshCw, ChevronRight, Shield, Info, MapPin,
  ChevronLeft, Loader, AlertCircle, CheckCircle2, FileText
} from 'lucide-react';
import Modal from './ui/Modal';
import { useAuth } from '../context/AuthContext';
import { medicationsAPI, prescriptionsAPI, pharmaciesAPI } from '../services/api';

const EPrescribeEnhanced = ({ isOpen, onClose, onSuccess, patientId, patientName, visitId, currentMedications = [] }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: medication, 2: sig builder, 3: pharmacy, 4: review
  const [loading, setLoading] = useState(false);
  
  // Medication search
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [medicationDetails, setMedicationDetails] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // Sig builder
  const [sigStructured, setSigStructured] = useState({
    dose: '',
    route: 'ORAL',
    frequency: '',
    duration: '',
    asNeeded: false,
    additionalInstructions: ''
  });
  const [quantity, setQuantity] = useState('30');
  const [daysSupply, setDaysSupply] = useState('');
  const [refills, setRefills] = useState('0');
  const [substitutionAllowed, setSubstitutionAllowed] = useState(true);
  
  // Pharmacy search
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacyResults, setPharmacyResults] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [useLocation, setUseLocation] = useState(false);
  
  // Interactions and warnings
  const [interactions, setInteractions] = useState([]);
  const [showInteractionWarning, setShowInteractionWarning] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState(null);
  
  // Errors and messages
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Common routes
  const routes = [
    'ORAL', 'TOPICAL', 'INJECTION', 'INHALATION', 'NASAL', 
    'OPHTHALMIC', 'OTIC', 'RECTAL', 'SUBLINGUAL', 'TRANSDERMAL'
  ];

  // Common frequencies
  const frequencies = [
    'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
    'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
    'As needed', 'At bedtime', 'With meals', 'Before meals'
  ];

  // Debounced medication search
  useEffect(() => {
    if (medicationSearch.length < 2) {
      setMedicationResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await medicationsAPI.search(medicationSearch);
        setMedicationResults(response.data || []);
      } catch (err) {
        console.error('Medication search error:', err);
        setError('Failed to search medications. Please try again.');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [medicationSearch]);

  // Load medication details when selected
  useEffect(() => {
    if (selectedMedication?.rxcui) {
      setLoading(true);
      medicationsAPI.getDetails(selectedMedication.rxcui)
        .then(response => {
          setMedicationDetails(response.data);
          // Auto-fill strength and form if available
          if (response.data?.structures?.[0]) {
            const structure = response.data.structures[0];
            if (structure.strength) {
              setSigStructured(prev => ({ ...prev, dose: structure.strength }));
            }
            if (structure.form) {
              setSigStructured(prev => ({ ...prev, route: structure.form }));
            }
          }
        })
        .catch(err => {
          console.error('Error loading medication details:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedMedication]);

  // Check drug interactions
  const checkInteractions = useCallback(async (rxcuis) => {
    if (!rxcuis || rxcuis.length < 2) return [];

    try {
      const response = await medicationsAPI.checkInteractions(rxcuis);
      return response.data?.interactions || [];
    } catch (err) {
      console.error('Interaction check error:', err);
      return [];
    }
  }, []);

  // Check interactions when medication selected
  useEffect(() => {
    if (selectedMedication?.rxcui && currentMedications.length > 0) {
      const currentRxcuis = currentMedications
        .filter(m => m.rxcui)
        .map(m => m.rxcui);
      
      if (currentRxcuis.length > 0) {
        checkInteractions([...currentRxcuis, selectedMedication.rxcui])
          .then(interactions => {
            setInteractions(interactions);
            if (interactions.length > 0) {
              setShowInteractionWarning(true);
            }
          });
      }
    }
  }, [selectedMedication, currentMedications, checkInteractions]);

  // Pharmacy search
  useEffect(() => {
    if (pharmacySearch.length < 2 && !useLocation) {
      setPharmacyResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      try {
        let response;
        if (useLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              response = await pharmaciesAPI.getNearby({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                radius: 25
              });
              setPharmacyResults(response.data || []);
            },
            () => {
              // Fallback to text search if location fails
              if (pharmacySearch.length >= 2) {
                pharmaciesAPI.search({ query: pharmacySearch })
                  .then(res => setPharmacyResults(res.data || []));
              }
            }
          );
        } else if (pharmacySearch.length >= 2) {
          response = await pharmaciesAPI.search({ query: pharmacySearch });
          setPharmacyResults(response.data || []);
        }
      } catch (err) {
        console.error('Pharmacy search error:', err);
        setError('Failed to search pharmacies. Please try again.');
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [pharmacySearch, useLocation]);

  // Calculate days supply automatically
  useEffect(() => {
    if (quantity && sigStructured.frequency) {
      const qty = parseInt(quantity) || 0;
      let timesPerDay = 1;

      if (sigStructured.frequency.includes('daily')) {
        timesPerDay = parseInt(sigStructured.frequency.match(/\d+/)?.[0]) || 1;
      } else if (sigStructured.frequency.includes('6 hours')) {
        timesPerDay = 4;
      } else if (sigStructured.frequency.includes('8 hours')) {
        timesPerDay = 3;
      } else if (sigStructured.frequency.includes('12 hours')) {
        timesPerDay = 2;
      } else if (sigStructured.frequency.includes('as needed')) {
        timesPerDay = 0; // Can't calculate
      }

      if (timesPerDay > 0 && qty > 0) {
        const calculatedDays = Math.round(qty / timesPerDay);
        setDaysSupply(calculatedDays.toString());
      }
    }
  }, [quantity, sigStructured.frequency]);

  // Build sig text from structured sig
  const buildSigText = () => {
    const parts = [];
    if (sigStructured.dose) parts.push(sigStructured.dose);
    if (sigStructured.route) parts.push(sigStructured.route.toLowerCase());
    if (sigStructured.frequency) parts.push(sigStructured.frequency.toLowerCase());
    if (sigStructured.duration) parts.push(`for ${sigStructured.duration}`);
    if (sigStructured.asNeeded) parts.push('as needed');
    if (sigStructured.additionalInstructions) parts.push(sigStructured.additionalInstructions);
    return parts.join(' ');
  };

  // Handle medication selection
  const handleSelectMedication = (med) => {
    setSelectedMedication(med);
    setMedicationSearch('');
    setMedicationResults([]);
    setStep(2);
  };

  // Handle pharmacy selection
  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setPharmacySearch('');
    setPharmacyResults([]);
    setStep(4);
  };

  // Validate prescription before submission
  const validatePrescription = () => {
    if (!selectedMedication) {
      return 'Please select a medication';
    }
    if (!sigStructured.dose || !sigStructured.frequency || !sigStructured.route) {
      return 'Please complete all required sig fields (dose, route, frequency)';
    }
    if (!quantity || parseInt(quantity) <= 0) {
      return 'Please enter a valid quantity';
    }
    return null;
  };

  // Submit prescription
  const handleSubmit = async () => {
    const validationError = validatePrescription();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create prescription
      const prescriptionData = {
        patientId,
        visitId: visitId || null,
        medicationRxcui: selectedMedication.rxcui,
        medicationName: selectedMedication.name,
        strength: sigStructured.dose,
        quantity: parseInt(quantity),
        quantityUnit: 'EA',
        daysSupply: daysSupply ? parseInt(daysSupply) : null,
        sigStructured: {
          ...sigStructured,
          sigText: buildSigText()
        },
        refills: parseInt(refills) || 0,
        substitutionAllowed,
        pharmacyId: selectedPharmacy?.id || null,
        pharmacyNcpdpId: selectedPharmacy?.ncpdpId || null,
        isControlled: medicationDetails?.controlled || false,
        schedule: medicationDetails?.schedule || null
      };

      const createResponse = await prescriptionsAPI.create(prescriptionData);
      const prescriptionId = createResponse.data.id;

      // If pharmacy selected, send prescription
      if (selectedPharmacy) {
        await prescriptionsAPI.send(prescriptionId, {
          transmissionMethod: selectedPharmacy.integrationEnabled ? 'electronic' : 'fax',
          pharmacyId: selectedPharmacy.id,
          pharmacyNcpdpId: selectedPharmacy.ncpdpId
        });
      }

      setSuccess('Prescription created successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Error creating prescription:', err);
      setError(err.response?.data?.error || 'Failed to create prescription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleClose = () => {
    setStep(1);
    setMedicationSearch('');
    setSelectedMedication(null);
    setMedicationDetails(null);
    setSigStructured({
      dose: '',
      route: 'ORAL',
      frequency: '',
      duration: '',
      asNeeded: false,
      additionalInstructions: ''
    });
    setQuantity('30');
    setDaysSupply('');
    setRefills('0');
    setSubstitutionAllowed(true);
    setSelectedPharmacy(null);
    setPharmacySearch('');
    setInteractions([]);
    setShowInteractionWarning(false);
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="E-Prescribe" size="xl">
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((stepNum) => (
            <React.Fragment key={stepNum}>
              <div className={`flex flex-col items-center ${step >= stepNum ? 'text-primary-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step >= stepNum 
                    ? 'bg-primary-600 border-primary-600 text-white' 
                    : 'border-gray-300 bg-white'
                }`}>
                  {step > stepNum ? <Check className="w-5 h-5" /> : stepNum}
                </div>
                <span className="text-xs mt-1 font-medium">
                  {stepNum === 1 ? 'Medication' : stepNum === 2 ? 'Details' : stepNum === 3 ? 'Pharmacy' : 'Review'}
                </span>
              </div>
              {stepNum < 4 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > stepNum ? 'bg-primary-600' : 'bg-gray-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Step 1: Medication Search */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Medications
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={medicationSearch}
                  onChange={(e) => setMedicationSearch(e.target.value)}
                  placeholder="Search by medication name (e.g., lisinopril, aspirin)..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader className="w-5 h-5 text-primary-600 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Medication Results */}
            {medicationResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {medicationResults.map((med, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectMedication(med)}
                    className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{med.name}</p>
                      {med.synonym && med.synonym !== med.name && (
                        <p className="text-sm text-gray-500">{med.synonym}</p>
                      )}
                      {med.strength && (
                        <p className="text-xs text-gray-500 mt-1">{med.strength}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}

            {medicationSearch.length >= 2 && !searching && medicationResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No medications found. Try a different search term.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Sig Builder */}
        {step === 2 && selectedMedication && (
          <div className="space-y-4">
            {/* Selected Medication Display */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary-900">{selectedMedication.name}</p>
                  {medicationDetails && (
                    <p className="text-sm text-primary-700">
                      {medicationDetails.form && `${medicationDetails.form} • `}
                      {medicationDetails.controlled && `Controlled Substance ${medicationDetails.schedule || ''}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedMedication(null);
                    setMedicationDetails(null);
                    setStep(1);
                  }}
                  className="text-primary-600 hover:text-primary-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Interaction Warning */}
            {showInteractionWarning && interactions.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800 mb-1">Drug Interaction Warning</p>
                    {interactions.map((interaction, idx) => (
                      <p key={idx} className="text-sm text-yellow-700">
                        {interaction.description || 'Potential drug interaction detected'}
                      </p>
                    ))}
                  </div>
                  <button onClick={() => setShowInteractionWarning(false)}>
                    <X className="w-4 h-4 text-yellow-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Sig Builder */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Prescription Instructions (Sig)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dose <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sigStructured.dose}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, dose: e.target.value }))}
                    placeholder="e.g., 10 MG, 1 TAB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sigStructured.route}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, route: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {routes.map(route => (
                      <option key={route} value={route}>{route}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sigStructured.frequency}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select frequency...</option>
                    {frequencies.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={sigStructured.duration}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 7 days, 2 weeks"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={sigStructured.asNeeded}
                    onChange={(e) => setSigStructured(prev => ({ ...prev, asNeeded: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">As needed (PRN)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Instructions
                </label>
                <input
                  type="text"
                  value={sigStructured.additionalInstructions}
                  onChange={(e) => setSigStructured(prev => ({ ...prev, additionalInstructions: e.target.value }))}
                  placeholder="e.g., with food, take with full glass of water"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Sig Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Sig Preview:</p>
                <p className="text-sm text-gray-900 font-mono">{buildSigText() || 'Enter prescription details above...'}</p>
              </div>
            </div>

            {/* Quantity and Refills */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days Supply
                </label>
                <input
                  type="number"
                  value={daysSupply}
                  onChange={(e) => setDaysSupply(e.target.value)}
                  placeholder="Auto-calculated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refills
                </label>
                <input
                  type="number"
                  value={refills}
                  onChange={(e) => setRefills(e.target.value)}
                  min="0"
                  max="11"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Substitution */}
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="substitution"
                checked={substitutionAllowed}
                onChange={(e) => setSubstitutionAllowed(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="substitution" className="text-sm text-gray-700">
                Allow generic substitution (uncheck for "Dispense As Written")
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Pharmacy Selection */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Pharmacy
              </label>
              <div className="flex space-x-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={pharmacySearch}
                    onChange={(e) => setPharmacySearch(e.target.value)}
                    placeholder="Search by name, city, or zip..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  onClick={() => setUseLocation(!useLocation)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    useLocation
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Use current location"
                >
                  <MapPin className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pharmacy Results */}
            {pharmacyResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {pharmacyResults.map((pharmacy) => (
                  <button
                    key={pharmacy.id}
                    onClick={() => handleSelectPharmacy(pharmacy)}
                    className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-start justify-between text-left"
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
                      <p className="text-sm text-gray-600 mt-1">{pharmacy.address?.full}</p>
                      {pharmacy.phone && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center space-x-1">
                          <Phone className="w-3 h-3" />
                          <span>{pharmacy.phone}</span>
                        </p>
                      )}
                      {pharmacy.distanceMiles && (
                        <p className="text-xs text-gray-500 mt-1">
                          {pharmacy.distanceMiles} miles away
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                  </button>
                ))}
              </div>
            )}

            {pharmacySearch.length >= 2 && pharmacyResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No pharmacies found. Try a different search or use location search.
              </p>
            )}

            {/* Skip Pharmacy Option */}
            <button
              onClick={() => {
                setSelectedPharmacy(null);
                setStep(4);
              }}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg border border-gray-200"
            >
              Skip pharmacy selection (will remain in draft)
            </button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Review Prescription</h3>

            {/* Medication */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Medication</p>
              <p className="text-gray-900">{selectedMedication?.name}</p>
            </div>

            {/* Sig */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Instructions</p>
              <p className="text-gray-900">{buildSigText()}</p>
            </div>

            {/* Quantity/Refills */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Quantity</p>
                <p className="text-gray-900">{quantity}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Days Supply</p>
                <p className="text-gray-900">{daysSupply || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Refills</p>
                <p className="text-gray-900">{refills}</p>
              </div>
            </div>

            {/* Pharmacy */}
            {selectedPharmacy ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Pharmacy</p>
                <p className="text-gray-900">{selectedPharmacy.name}</p>
                <p className="text-sm text-gray-600">{selectedPharmacy.address?.full}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  No pharmacy selected. Prescription will be saved as draft.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
              } else {
                handleClose();
              }
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{step > 1 ? 'Back' : 'Cancel'}</span>
          </button>

          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 2) {
                  setStep(3);
                } else if (step === 3) {
                  setStep(4);
                }
              }}
              disabled={
                (step === 2 && (!sigStructured.dose || !sigStructured.frequency || !sigStructured.route)) ||
                loading
              }
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Prescription</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EPrescribeEnhanced;

