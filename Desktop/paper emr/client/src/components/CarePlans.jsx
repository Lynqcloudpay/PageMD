import React, { useState, useEffect } from 'react';
import { 
  Target, Plus, X, ChevronDown, ChevronRight, Check, Clock, 
  AlertCircle, Calendar, Activity, FileText, Pill
} from 'lucide-react';
import Modal from './ui/Modal';
import { carePlanTemplates, searchCarePlans } from '../data/carePlans';
import { format } from 'date-fns';

const CarePlans = ({ isOpen, onClose, patientId, patientProblems = [], onAddCarePlan }) => {
  const [activeCarePlans, setActiveCarePlans] = useState([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});

  // Get matching care plans based on patient problems
  const matchingPlans = Object.entries(carePlanTemplates)
    .filter(([key, plan]) => 
      patientProblems.some(problem => 
        plan.icd10 === problem.code || 
        plan.name.toLowerCase().includes(problem.condition?.toLowerCase() || '')
      )
    )
    .map(([key, plan]) => ({ key, ...plan }));

  // Search care plans
  const searchResults = searchCarePlans(searchQuery);

  const handleAddPlan = (plan) => {
    const newPlan = {
      id: Date.now(),
      ...plan,
      startDate: new Date().toISOString(),
      status: 'active',
      goalProgress: plan.goals.map(g => ({ ...g, status: 'pending', value: null })),
    };
    setActiveCarePlans([...activeCarePlans, newPlan]);
    setShowAddPlan(false);
    if (onAddCarePlan) {
      onAddCarePlan(newPlan);
    }
  };

  const toggleSection = (planId, section) => {
    const key = `${planId}-${section}`;
    setExpandedSection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionExpanded = (planId, section) => {
    return expandedSection[`${planId}-${section}`];
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Care Plans" size="large">
      <div className="space-y-4">
        {/* Suggested Care Plans */}
        {matchingPlans.length > 0 && activeCarePlans.length === 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 flex items-center mb-2">
              <AlertCircle className="w-4 h-4 mr-2" />
              Suggested Care Plans
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Based on the patient's problem list, these care plans may be applicable:
            </p>
            <div className="flex flex-wrap gap-2">
              {matchingPlans.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => handleAddPlan(plan)}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {plan.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Care Plans */}
        {activeCarePlans.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-ink-900">Active Care Plans</h3>
            {activeCarePlans.map(plan => (
              <div key={plan.id} className="border border-paper-200 rounded-lg overflow-hidden">
                {/* Plan Header */}
                <div 
                  className="p-4 bg-paper-50 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-paper-600" />
                    <div>
                      <h4 className="font-semibold text-ink-900">{plan.name}</h4>
                      <p className="text-xs text-ink-500">
                        Started {format(new Date(plan.startDate), 'MMM d, yyyy')} • ICD-10: {plan.icd10}
                      </p>
                    </div>
                  </div>
                  {expandedPlan === plan.id ? (
                    <ChevronDown className="w-5 h-5 text-ink-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-ink-400" />
                  )}
                </div>

                {/* Plan Details */}
                {expandedPlan === plan.id && (
                  <div className="p-4 space-y-4">
                    {/* Goals Section */}
                    <div>
                      <button
                        onClick={() => toggleSection(plan.id, 'goals')}
                        className="w-full flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="font-medium text-green-800 flex items-center">
                          <Target className="w-4 h-4 mr-2" />
                          Goals ({plan.goals.length})
                        </span>
                        {isSectionExpanded(plan.id, 'goals') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isSectionExpanded(plan.id, 'goals') && (
                        <div className="mt-2 space-y-2 pl-4">
                          {plan.goals.map((goal, idx) => (
                            <div key={idx} className="p-2 bg-white border border-paper-100 rounded">
                              <p className="text-sm font-medium text-ink-800">{goal.goal}</p>
                              <div className="flex items-center space-x-4 mt-1 text-xs text-ink-500">
                                <span>Target: {goal.target}</span>
                                <span>Frequency: {goal.frequency}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Monitoring Section */}
                    <div>
                      <button
                        onClick={() => toggleSection(plan.id, 'monitoring')}
                        className="w-full flex items-center justify-between p-2 bg-blue-50 rounded"
                      >
                        <span className="font-medium text-blue-800 flex items-center">
                          <Activity className="w-4 h-4 mr-2" />
                          Monitoring ({plan.monitoring.length})
                        </span>
                        {isSectionExpanded(plan.id, 'monitoring') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isSectionExpanded(plan.id, 'monitoring') && (
                        <div className="mt-2 space-y-2 pl-4">
                          {plan.monitoring.map((item, idx) => (
                            <div key={idx} className="p-2 bg-white border border-paper-100 rounded flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium text-ink-800">{item.test}</p>
                                <p className="text-xs text-ink-500">{item.frequency}</p>
                              </div>
                              {item.cpt && <span className="text-xs bg-paper-100 px-2 py-0.5 rounded">CPT: {item.cpt}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Interventions Section */}
                    <div>
                      <button
                        onClick={() => toggleSection(plan.id, 'interventions')}
                        className="w-full flex items-center justify-between p-2 bg-purple-50 rounded"
                      >
                        <span className="font-medium text-purple-800 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Interventions ({plan.interventions.length})
                        </span>
                        {isSectionExpanded(plan.id, 'interventions') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isSectionExpanded(plan.id, 'interventions') && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {plan.interventions.map((item, idx) => (
                            <li key={idx} className="text-sm text-ink-700 flex items-start">
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Medications Section */}
                    <div>
                      <button
                        onClick={() => toggleSection(plan.id, 'medications')}
                        className="w-full flex items-center justify-between p-2 bg-orange-50 rounded"
                      >
                        <span className="font-medium text-orange-800 flex items-center">
                          <Pill className="w-4 h-4 mr-2" />
                          Recommended Medications ({plan.medications.length})
                        </span>
                        {isSectionExpanded(plan.id, 'medications') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isSectionExpanded(plan.id, 'medications') && (
                        <div className="mt-2 space-y-2 pl-4">
                          {plan.medications.map((med, idx) => (
                            <div key={idx} className="p-2 bg-white border border-paper-100 rounded">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-ink-800">{med.name}</span>
                                {med.firstLine && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">First Line</span>
                                )}
                              </div>
                              <p className="text-xs text-ink-500 mt-1">{med.notes}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Patient Education Section */}
                    <div>
                      <button
                        onClick={() => toggleSection(plan.id, 'education')}
                        className="w-full flex items-center justify-between p-2 bg-yellow-50 rounded"
                      >
                        <span className="font-medium text-yellow-800 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Patient Education ({plan.patientEducation.length})
                        </span>
                        {isSectionExpanded(plan.id, 'education') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {isSectionExpanded(plan.id, 'education') && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {plan.patientEducation.map((item, idx) => (
                            <li key={idx} className="text-sm text-ink-700 flex items-start">
                              <Check className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add New Care Plan */}
        {showAddPlan ? (
          <div className="border border-paper-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-ink-900">Add Care Plan</h4>
              <button onClick={() => setShowAddPlan(false)} className="p-1 hover:bg-paper-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Search care plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border border-paper-300 rounded-md mb-3"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchResults.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => handleAddPlan(plan)}
                  className="w-full text-left p-3 border border-paper-200 rounded-lg hover:bg-paper-50"
                >
                  <p className="font-medium text-ink-900">{plan.name}</p>
                  <p className="text-xs text-ink-500">ICD-10: {plan.icd10}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddPlan(true)}
            className="w-full p-3 border-2 border-dashed border-paper-300 rounded-lg text-paper-600 hover:bg-paper-50 hover:border-paper-400 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Care Plan</span>
          </button>
        )}
      </div>
    </Modal>
  );
};

export default CarePlans;














