import React, { useState, useEffect } from 'react';
import { 
  Syringe, Plus, X, Check, Clock, AlertTriangle, 
  Calendar, Search, ChevronDown, ChevronRight, FileText
} from 'lucide-react';
import Modal from './ui/Modal';
import { vaccineDatabase, getRecommendedVaccines, searchVaccines } from '../data/immunizations';
import { format, differenceInYears, addMonths, addYears } from 'date-fns';

const Immunizations = ({ 
  isOpen, 
  onClose, 
  patientId, 
  patientDOB, 
  patientConditions = [],
  onAdminister 
}) => {
  const [patientAge, setPatientAge] = useState(0);
  const [administeredVaccines, setAdministeredVaccines] = useState([]);
  const [showAdminister, setShowAdminister] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminForm, setAdminForm] = useState({
    lotNumber: '',
    expirationDate: '',
    manufacturer: '',
    site: 'Left Deltoid',
    route: 'IM',
    dose: 1,
    visProvided: true,
    notes: '',
  });

  // Calculate patient age
  useEffect(() => {
    if (patientDOB) {
      const age = differenceInYears(new Date(), new Date(patientDOB));
      setPatientAge(age);
    }
  }, [patientDOB]);

  // Mock administered vaccines
  useEffect(() => {
    setAdministeredVaccines([
      { id: 1, name: 'Influenza (Flu)', date: '2024-10-15', lotNumber: 'FL2024-A123', doseNumber: 1, site: 'Left Deltoid' },
      { id: 2, name: 'COVID-19 mRNA', date: '2024-09-01', lotNumber: 'MOD-2024-789', doseNumber: 1, site: 'Right Deltoid' },
      { id: 3, name: 'Tdap (Tetanus, Diphtheria, Pertussis)', date: '2020-03-15', lotNumber: 'TD-2020-456', doseNumber: 1, site: 'Left Deltoid' },
    ]);
  }, []);

  // Get recommended vaccines based on age and conditions
  const conditionNames = patientConditions.map(c => c.condition || c.name || c);
  const recommendedVaccines = getRecommendedVaccines(patientAge, conditionNames);

  // Filter out already administered vaccines for current year/cycle
  const dueVaccines = recommendedVaccines.filter(vaccine => {
    const administered = administeredVaccines.find(av => av.name === vaccine.name);
    if (!administered) return true;
    
    // Check if annual vaccine needs renewal
    if (vaccine.frequency.toLowerCase().includes('annual')) {
      const lastDate = new Date(administered.date);
      const oneYearAgo = addYears(new Date(), -1);
      return lastDate < oneYearAgo;
    }
    
    return false;
  });

  // Search results
  const searchResults = searchQuery ? searchVaccines(searchQuery) : [];

  const handleAdminister = (vaccine) => {
    setSelectedVaccine(vaccine);
    setAdminForm({
      ...adminForm,
      site: vaccine.site,
      route: vaccine.route,
    });
    setShowAdminister(true);
  };

  const handleSubmitAdministration = () => {
    const record = {
      id: Date.now(),
      name: selectedVaccine.name,
      date: new Date().toISOString(),
      lotNumber: adminForm.lotNumber,
      expirationDate: adminForm.expirationDate,
      manufacturer: adminForm.manufacturer,
      site: adminForm.site,
      route: adminForm.route,
      doseNumber: adminForm.dose,
      cvxCode: selectedVaccine.cvx,
      cptCode: selectedVaccine.code,
      notes: adminForm.notes,
    };
    
    setAdministeredVaccines([record, ...administeredVaccines]);
    
    if (onAdminister) {
      onAdminister(record);
    }
    
    setShowAdminister(false);
    setSelectedVaccine(null);
    setAdminForm({
      lotNumber: '',
      expirationDate: '',
      manufacturer: '',
      site: 'Left Deltoid',
      route: 'IM',
      dose: 1,
      visProvided: true,
      notes: '',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Immunization Record" size="large">
      <div className="space-y-6">
        {/* Due/Recommended Vaccines */}
        {dueVaccines.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 flex items-center mb-3">
              <Clock className="w-5 h-5 mr-2" />
              Due / Recommended Vaccines
            </h3>
            <div className="space-y-2">
              {dueVaccines.map((vaccine, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white border border-yellow-100 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-ink-900">{vaccine.name}</p>
                    <p className="text-xs text-ink-500">
                      {vaccine.reason} • {vaccine.frequency}
                    </p>
                    {vaccine.priority === 'high' && (
                      <span className="inline-flex items-center text-xs text-red-600 mt-1">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        High risk - recommended
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdminister(vaccine)}
                    className="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 flex items-center"
                  >
                    <Syringe className="w-3 h-3 mr-1" />
                    Administer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Administered Vaccines */}
        <div>
          <h3 className="font-semibold text-ink-900 mb-3 flex items-center">
            <Check className="w-5 h-5 mr-2 text-green-600" />
            Immunization History
          </h3>
          {administeredVaccines.length > 0 ? (
            <div className="border border-paper-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-ink-600">Vaccine</th>
                    <th className="text-left p-3 font-medium text-ink-600">Date</th>
                    <th className="text-left p-3 font-medium text-ink-600">Lot #</th>
                    <th className="text-left p-3 font-medium text-ink-600">Site</th>
                    <th className="text-left p-3 font-medium text-ink-600">Dose</th>
                  </tr>
                </thead>
                <tbody>
                  {administeredVaccines.map((vaccine) => (
                    <tr key={vaccine.id} className="border-t border-paper-100">
                      <td className="p-3 font-medium text-ink-900">{vaccine.name}</td>
                      <td className="p-3 text-ink-700">
                        {format(new Date(vaccine.date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-3 text-ink-600 font-mono text-xs">{vaccine.lotNumber}</td>
                      <td className="p-3 text-ink-600">{vaccine.site}</td>
                      <td className="p-3 text-ink-600">#{vaccine.doseNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-ink-500">
              No immunization records found
            </div>
          )}
        </div>

        {/* Add New Vaccine */}
        <div>
          <h3 className="font-semibold text-ink-900 mb-3">Add Vaccine</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search vaccines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-paper-300 rounded-md"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 border border-paper-200 rounded-lg max-h-60 overflow-y-auto">
              {searchResults.map((vaccine, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAdminister(vaccine)}
                  className="w-full text-left p-3 hover:bg-paper-50 border-b border-paper-100 last:border-b-0"
                >
                  <p className="font-medium text-ink-900">{vaccine.name}</p>
                  <p className="text-xs text-ink-500">
                    CPT: {vaccine.code} • CVX: {vaccine.cvx} • {vaccine.route}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Administration Modal */}
      {showAdminister && selectedVaccine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-paper-200 flex items-center justify-between">
              <h3 className="font-bold text-ink-900">Administer Vaccine</h3>
              <button onClick={() => setShowAdminister(false)} className="p-1 hover:bg-paper-100 rounded">
                <X className="w-5 h-5 text-ink-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Vaccine Info */}
              <div className="p-3 bg-paper-50 rounded-lg">
                <p className="font-semibold text-ink-900">{selectedVaccine.name}</p>
                <p className="text-sm text-ink-600">CPT: {selectedVaccine.code} • CVX: {selectedVaccine.cvx}</p>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Lot Number*</label>
                  <input
                    type="text"
                    value={adminForm.lotNumber}
                    onChange={(e) => setAdminForm({ ...adminForm, lotNumber: e.target.value })}
                    className="w-full p-2 border border-paper-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Expiration Date*</label>
                  <input
                    type="date"
                    value={adminForm.expirationDate}
                    onChange={(e) => setAdminForm({ ...adminForm, expirationDate: e.target.value })}
                    className="w-full p-2 border border-paper-300 rounded-md"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={adminForm.manufacturer}
                  onChange={(e) => setAdminForm({ ...adminForm, manufacturer: e.target.value })}
                  className="w-full p-2 border border-paper-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Site</label>
                  <select
                    value={adminForm.site}
                    onChange={(e) => setAdminForm({ ...adminForm, site: e.target.value })}
                    className="w-full p-2 border border-paper-300 rounded-md"
                  >
                    <option>Left Deltoid</option>
                    <option>Right Deltoid</option>
                    <option>Left Anterolateral Thigh</option>
                    <option>Right Anterolateral Thigh</option>
                    <option>Left Upper Arm</option>
                    <option>Right Upper Arm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Route</label>
                  <select
                    value={adminForm.route}
                    onChange={(e) => setAdminForm({ ...adminForm, route: e.target.value })}
                    className="w-full p-2 border border-paper-300 rounded-md"
                  >
                    <option value="IM">Intramuscular (IM)</option>
                    <option value="SQ">Subcutaneous (SQ)</option>
                    <option value="ID">Intradermal (ID)</option>
                    <option value="PO">Oral (PO)</option>
                    <option value="IN">Intranasal (IN)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Dose Number</label>
                <input
                  type="number"
                  min="1"
                  value={adminForm.dose}
                  onChange={(e) => setAdminForm({ ...adminForm, dose: parseInt(e.target.value) })}
                  className="w-full p-2 border border-paper-300 rounded-md"
                />
                {selectedVaccine.series > 1 && (
                  <p className="text-xs text-ink-500 mt-1">
                    This vaccine is part of a {selectedVaccine.series}-dose series
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="visProvided"
                  checked={adminForm.visProvided}
                  onChange={(e) => setAdminForm({ ...adminForm, visProvided: e.target.checked })}
                  className="rounded text-paper-600"
                />
                <label htmlFor="visProvided" className="text-sm text-ink-700">
                  Vaccine Information Statement (VIS) provided
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Notes</label>
                <textarea
                  value={adminForm.notes}
                  onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })}
                  className="w-full p-2 border border-paper-300 rounded-md h-20"
                  placeholder="Any reactions, comments..."
                />
              </div>

              {/* Contraindications Warning */}
              {selectedVaccine.contraindications && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-800 text-sm flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Contraindications
                  </p>
                  <ul className="mt-1 text-xs text-red-700 list-disc list-inside">
                    {selectedVaccine.contraindications.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-paper-200 flex justify-end space-x-2">
              <button
                onClick={() => setShowAdminister(false)}
                className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAdministration}
                disabled={!adminForm.lotNumber || !adminForm.expirationDate}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <Check className="w-4 h-4 mr-2" />
                Administer
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default Immunizations;














