import React, { useState, useEffect } from 'react';
import { 
  Pill, Search, X, AlertTriangle, Check, Building2, Phone, 
  Clock, RefreshCw, ChevronRight, Shield, Info
} from 'lucide-react';
import Modal from './ui/Modal';
import { useAuth } from '../context/AuthContext';
import { 
  searchMedications, 
  checkDrugInteractions, 
  searchPharmacies,
  medicationDatabase 
} from '../data/medications';

const EPrescribe = ({ isOpen, onClose, onSuccess, patientId, patientName, currentMedications = [] }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: medication, 2: details, 3: pharmacy, 4: review
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMed, setSelectedMed] = useState(null);
  const [prescription, setPrescription] = useState({
    strength: '',
    quantity: '30',
    refills: '0',
    sig: '',
    daw: false, // Dispense As Written
    priorAuth: false,
    notes: '',
  });
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [showInteractionWarning, setShowInteractionWarning] = useState(false);
  const [allergyAlert, setAllergyAlert] = useState(null);

  // Search medications
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = searchMedications(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Search pharmacies
  useEffect(() => {
    const results = searchPharmacies(pharmacySearch);
    setPharmacies(results);
  }, [pharmacySearch]);

  // Check drug interactions when medication is selected
  useEffect(() => {
    if (selectedMed && currentMedications.length > 0) {
      const allMeds = [...currentMedications.map(m => m.name || m), selectedMed.name];
      const foundInteractions = checkDrugInteractions(allMeds);
      setInteractions(foundInteractions);
      if (foundInteractions.length > 0) {
        setShowInteractionWarning(true);
      }
    }
  }, [selectedMed, currentMedications]);

  // Handle medication selection
  const handleSelectMedication = (med) => {
    setSelectedMed(med);
    setPrescription({
      ...prescription,
      strength: med.strengths?.[0] || '',
      sig: med.defaultSig || '',
    });
    setSearchQuery('');
    setSearchResults([]);
    setStep(2);
  };

  // Handle pharmacy selection
  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setStep(4);
  };

  // Submit prescription
  const handleSubmit = () => {
    const rxData = {
      medication: selectedMed.name,
      brandName: selectedMed.brandNames?.[0],
      strength: prescription.strength,
      quantity: prescription.quantity,
      refills: prescription.refills,
      sig: prescription.sig,
      daw: prescription.daw,
      pharmacy: selectedPharmacy,
      prescriber: user?.name || 'Provider',
      date: new Date().toISOString(),
      controlled: selectedMed.controlled,
      schedule: selectedMed.schedule,
    };
    
    onSuccess(`Prescription sent: ${selectedMed.name} ${prescription.strength} - ${prescription.sig}`);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setStep(1);
    setSearchQuery('');
    setSelectedMed(null);
    setPrescription({
      strength: '',
      quantity: '30',
      refills: '0',
      sig: '',
      daw: false,
      priorAuth: false,
      notes: '',
    });
    setSelectedPharmacy(null);
    setInteractions([]);
    setShowInteractionWarning(false);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'severe': return 'bg-red-100 border-red-300 text-red-800';
      case 'moderate': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'mild': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="e-Prescribe" size="large">
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {['Medication', 'Details', 'Pharmacy', 'Review'].map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > idx + 1 ? 'bg-green-500 text-white' :
                step === idx + 1 ? 'text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {step > idx + 1 ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`ml-2 text-sm ${step === idx + 1 ? 'font-medium text-ink-900' : 'text-ink-500'}`}>
                {label}
              </span>
              {idx < 3 && <ChevronRight className="w-4 h-4 mx-4 text-ink-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Drug Interaction Warning Modal */}
      {showInteractionWarning && interactions.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-red-800">Drug Interaction Alert</h4>
              <div className="mt-2 space-y-2">
                {interactions.map((interaction, idx) => (
                  <div key={idx} className={`p-2 rounded border ${getSeverityColor(interaction.severity)}`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold capitalize">{interaction.severity}</span>
                      <span>•</span>
                      <span>{interaction.medications.join(' + ')}</span>
                    </div>
                    <p className="text-sm mt-1">{interaction.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => setShowInteractionWarning(false)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Acknowledge & Continue
                </button>
                <button
                  onClick={() => { setSelectedMed(null); setStep(1); setShowInteractionWarning(false); }}
                  className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded text-sm hover:bg-red-50"
                >
                  Select Different Medication
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Medication Search */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <Pill className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              placeholder="Search medication by name, brand, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-paper-300 rounded-lg text-lg focus:ring-2 focus:ring-paper-400"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="border border-paper-200 rounded-lg max-h-96 overflow-y-auto">
              {searchResults.map((med, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectMedication(med)}
                  className="w-full text-left p-4 hover:bg-paper-50 border-b border-paper-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink-900">{med.name}</p>
                      <p className="text-sm text-ink-600">{med.brandNames?.join(', ')}</p>
                      <p className="text-xs text-ink-500 mt-1">{med.class} • {med.category}</p>
                    </div>
                    {med.controlled && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                        Schedule {med.schedule}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {med.strengths?.slice(0, 4).map((strength, i) => (
                      <span key={i} className="text-xs bg-paper-100 text-ink-600 px-2 py-0.5 rounded">
                        {strength}
                      </span>
                    ))}
                    {med.strengths?.length > 4 && (
                      <span className="text-xs text-ink-400">+{med.strengths.length - 4} more</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="text-center py-8 text-ink-500">
              No medications found matching "{searchQuery}"
            </div>
          )}

          {/* Common/Favorites */}
          {!searchQuery && (
            <div>
              <h3 className="text-sm font-semibold text-ink-500 uppercase mb-2">Common Medications</h3>
              <div className="grid grid-cols-2 gap-2">
                {medicationDatabase.slice(0, 8).map((med, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectMedication(med)}
                    className="text-left p-3 border border-paper-200 rounded-lg hover:bg-paper-50"
                  >
                    <p className="font-medium text-ink-900 text-sm">{med.name}</p>
                    <p className="text-xs text-ink-500">{med.class}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Prescription Details */}
      {step === 2 && selectedMed && (
        <div className="space-y-4">
          {/* Selected Medication */}
          <div className="p-4 bg-paper-50 rounded-lg border border-paper-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-ink-900">{selectedMed.name}</p>
                <p className="text-sm text-ink-600">{selectedMed.brandNames?.join(', ')}</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-paper-700 hover:underline"
              >
                Change
              </button>
            </div>
          </div>

          {/* Prescription Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Strength</label>
              <select
                value={prescription.strength}
                onChange={(e) => setPrescription({ ...prescription, strength: e.target.value })}
                className="w-full p-2 border border-paper-300 rounded-md"
              >
                {selectedMed.strengths?.map((s, i) => (
                  <option key={i} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Form</label>
              <select className="w-full p-2 border border-paper-300 rounded-md">
                {selectedMed.forms?.map((f, i) => (
                  <option key={i} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Sig (Directions)</label>
            <input
              type="text"
              value={prescription.sig}
              onChange={(e) => setPrescription({ ...prescription, sig: e.target.value })}
              className="w-full p-2 border border-paper-300 rounded-md"
              placeholder="e.g., Take 1 tablet by mouth once daily"
            />
            {/* Common Sigs */}
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                'Take 1 tablet by mouth once daily',
                'Take 1 tablet by mouth twice daily',
                'Take 1 tablet by mouth three times daily',
                'Take as directed',
              ].map((sig, i) => (
                <button
                  key={i}
                  onClick={() => setPrescription({ ...prescription, sig })}
                  className="text-xs bg-paper-100 hover:bg-paper-200 text-ink-600 px-2 py-1 rounded"
                >
                  {sig.substring(0, 25)}...
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Quantity</label>
              <input
                type="number"
                value={prescription.quantity}
                onChange={(e) => setPrescription({ ...prescription, quantity: e.target.value })}
                className="w-full p-2 border border-paper-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Refills</label>
              <select
                value={prescription.refills}
                onChange={(e) => setPrescription({ ...prescription, refills: e.target.value })}
                className="w-full p-2 border border-paper-300 rounded-md"
              >
                {selectedMed.controlled && selectedMed.schedule === 'II' ? (
                  <option value="0">0 (Schedule II)</option>
                ) : (
                  <>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="11">11</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={prescription.daw}
                onChange={(e) => setPrescription({ ...prescription, daw: e.target.checked })}
                className="rounded text-paper-600"
              />
              <span className="text-sm text-ink-700">DAW (Dispense As Written)</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Pharmacy Notes (Optional)</label>
            <textarea
              value={prescription.notes}
              onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })}
              className="w-full p-2 border border-paper-300 rounded-md h-20"
              placeholder="Additional instructions for pharmacy..."
            />
          </div>

          {/* Controlled Substance Warning */}
          {selectedMed.controlled && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
              <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Controlled Substance - Schedule {selectedMed.schedule}</p>
                <p className="text-sm text-yellow-700">PDMP check required. DEA number will be included.</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!prescription.sig || !prescription.strength}
              className="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
              style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
            >
              Continue to Pharmacy
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Pharmacy Selection */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              placeholder="Search pharmacy by name or location..."
              value={pharmacySearch}
              onChange={(e) => setPharmacySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-paper-300 rounded-lg focus:ring-2 focus:ring-paper-400"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pharmacies.map((pharmacy, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPharmacy(pharmacy)}
                className={`w-full text-left p-4 border rounded-lg hover:bg-paper-50 ${
                  selectedPharmacy?.ncpdp === pharmacy.ncpdp 
                    ? 'border-paper-700 bg-paper-50' 
                    : 'border-paper-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{pharmacy.name}</p>
                    <p className="text-sm text-ink-600">{pharmacy.address}</p>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-ink-500">
                      <span className="flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {pharmacy.phone}
                      </span>
                      {pharmacy.isMailOrder && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Mail Order
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedPharmacy?.ncpdp === pharmacy.ncpdp && (
                    <Check className="w-5 h-5 text-paper-700" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Send */}
      {step === 4 && selectedMed && selectedPharmacy && (
        <div className="space-y-4">
          <div className="p-4 bg-paper-50 rounded-lg border border-paper-200">
            <h3 className="font-bold text-ink-900 mb-3">Prescription Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-ink-500">Patient:</span>
                <span className="font-medium text-ink-900">{patientName || 'Patient'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Medication:</span>
                <span className="font-medium text-ink-900">{selectedMed.name} {prescription.strength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Directions:</span>
                <span className="font-medium text-ink-900">{prescription.sig}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Quantity:</span>
                <span className="font-medium text-ink-900">{prescription.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Refills:</span>
                <span className="font-medium text-ink-900">{prescription.refills}</span>
              </div>
              {prescription.daw && (
                <div className="flex justify-between">
                  <span className="text-ink-500">DAW:</span>
                  <span className="font-medium text-ink-900">Yes - Dispense As Written</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Sending to:
            </h4>
            <p className="font-semibold text-blue-900 mt-1">{selectedPharmacy.name}</p>
            <p className="text-sm text-blue-700">{selectedPharmacy.address}</p>
            <p className="text-sm text-blue-700">{selectedPharmacy.phone}</p>
          </div>

          {interactions.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {interactions.length} drug interaction(s) acknowledged
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Sign & Send Prescription</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default EPrescribe;

