/**
 * Complete Integration Example
 * 
 * This file shows how to integrate all the new e-prescribing
 * and code search components into your VisitNote page.
 */

import React, { useState, useEffect } from 'react';
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import CodeSearchModal from '../components/CodeSearchModal';
import { prescriptionsAPI, codesAPI } from '../services/api';

const VisitNoteWithEnhancedFeatures = ({ patientId, visitId }) => {
  // E-Prescribing
  const [showEPrescribe, setShowEPrescribe] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);

  // Code Search
  const [showICD10Modal, setShowICD10Modal] = useState(false);
  const [showCPTModal, setShowCPTModal] = useState(false);
  const [selectedICD10Codes, setSelectedICD10Codes] = useState([]);
  const [selectedCPTCodes, setSelectedCPTCodes] = useState([]);

  // Load prescriptions on mount
  useEffect(() => {
    if (patientId) {
      loadPrescriptions();
    }
  }, [patientId]);

  const loadPrescriptions = async () => {
    try {
      const response = await prescriptionsAPI.getByPatient(patientId);
      setPrescriptions(response.data || []);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    }
  };

  const handleAddICD10 = (code) => {
    setSelectedICD10Codes(prev => [...prev, code]);
    // Also add to assessment section in your note
  };

  const handleAddCPT = (code) => {
    setSelectedCPTCodes(prev => [...prev, code]);
    // Add to billing/procedure codes
  };

  return (
    <div>
      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => setShowEPrescribe(true)}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Pill className="w-4 h-4 inline mr-1" />
          e-Prescribe
        </button>

        <button
          onClick={() => setShowICD10Modal(true)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Add ICD-10
        </button>

        <button
          onClick={() => setShowCPTModal(true)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Add CPT
        </button>
      </div>

      {/* Selected Codes Display */}
      {selectedICD10Codes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Selected ICD-10 Codes:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedICD10Codes.map((code, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
              >
                {code.code} - {code.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Prescriptions */}
      {prescriptions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Recent Prescriptions:</h4>
          <div className="space-y-2">
            {prescriptions.slice(0, 5).map(prescription => (
              <div key={prescription.id} className="p-2 bg-gray-50 rounded">
                <p className="text-sm font-medium">{prescription.medication_name}</p>
                <p className="text-xs text-gray-600">{prescription.sig}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <EPrescribeEnhanced
        isOpen={showEPrescribe}
        onClose={() => setShowEPrescribe(false)}
        onSuccess={() => {
          loadPrescriptions();
          setShowEPrescribe(false);
        }}
        patientId={patientId}
        visitId={visitId}
      />

      <CodeSearchModal
        isOpen={showICD10Modal}
        onClose={() => setShowICD10Modal(false)}
        onSelect={handleAddICD10}
        codeType="ICD10"
        multiSelect={true}
        selectedCodes={selectedICD10Codes}
      />

      <CodeSearchModal
        isOpen={showCPTModal}
        onClose={() => setShowCPTModal(false)}
        onSelect={handleAddCPT}
        codeType="CPT"
        multiSelect={true}
        selectedCodes={selectedCPTCodes}
      />
    </div>
  );
};

export default VisitNoteWithEnhancedFeatures;






















