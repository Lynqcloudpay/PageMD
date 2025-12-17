/**
 * Diagnosis Selector Component
 * 
 * Reusable component for selecting one or more diagnoses/problems
 * Used when creating orders (prescriptions, labs, referrals, procedures)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Search, AlertCircle, Check } from 'lucide-react';
import { patientsAPI, codesAPI } from '../services/api';

const DiagnosisSelector = ({
  patientId,
  selectedDiagnoses = [],
  onDiagnosesChange,
  required = true,
  allowMultiple = true,
  className = '',
  assessmentDiagnoses = [], // Array of diagnosis strings from assessment (e.g., ["I10 - Essential hypertension", "E11.65 - Type 2 diabetes"])
  onAddToAssessment = null // Callback to add new diagnosis to assessment
}) => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [icd10Results, setIcd10Results] = useState([]);
  const [searchingICD10, setSearchingICD10] = useState(false);

  // Fetch patient problems/diagnoses
  useEffect(() => {
    if (patientId) {
      fetchProblems();
    }
  }, [patientId]);

  // Convert assessment diagnoses to problem format
  const assessmentProblems = useMemo(() => {
    if (!assessmentDiagnoses || !Array.isArray(assessmentDiagnoses)) {
      return [];
    }
    const problems = assessmentDiagnoses.map((dx, idx) => {
      if (!dx || typeof dx !== 'string') return null;
      // Strip any HTML tags that might have been included
      const cleanDx = dx.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
      if (!cleanDx) return null;

      // Parse diagnosis string - handle multiple formats:
      // 1. "I10 - Essential hypertension" (code first with dash)
      // 2. "Essential hypertension (I10)" (code in parentheses at end)
      // 3. "I10-Essential hypertension" (code first without spaces)

      // Try format 1 & 3: Code first with dash
      let match = cleanDx.match(/^([A-Z]\d{2}(?:\.\d+)?)\s*[-–—]\s*(.+)$/);
      if (match) {
        return {
          id: `assessment-${idx}`,
          problem_name: match[2].trim(),
          name: match[2].trim(),
          icd10_code: match[1],
          icd10Code: match[1],
          status: 'active',
          fromAssessment: true
        };
      }

      // Try format 2: Code in parentheses at end (handles nested parens like "Description (NSTEMI) (I21.4)")
      // Match the LAST set of parentheses that contains an ICD-10 code
      const parenMatch = cleanDx.match(/\(([A-Z]\d{2}(?:\.\d+)?)\)\s*$/);
      if (parenMatch) {
        const code = parenMatch[1];
        // Extract everything before the last parentheses with ICD-10 code
        const nameMatch = cleanDx.match(/^(.+?)\s*\([A-Z]\d{2}(?:\.\d+)?\)\s*$/);
        const problemName = nameMatch ? nameMatch[1].trim() : cleanDx.replace(/\s*\([A-Z]\d{2}(?:\.\d+)?\)\s*$/, '').trim();
        return {
          id: `assessment-${idx}`,
          problem_name: problemName,
          name: problemName,
          icd10_code: code,
          icd10Code: code,
          status: 'active',
          fromAssessment: true
        };
      }

      // If no code found, treat entire string as name
      return {
        id: `assessment-${idx}`,
        problem_name: cleanDx,
        name: cleanDx,
        icd10_code: '',
        icd10Code: '',
        status: 'active',
        fromAssessment: true
      };
    }).filter(Boolean); // Remove any null entries

    // Debug: Log to help troubleshoot
    if (problems.length > 0) {
      console.log('DiagnosisSelector: Converted assessmentProblems:', problems);
    } else if (assessmentDiagnoses.length > 0) {
      console.log('DiagnosisSelector: assessmentDiagnoses provided but no problems created:', assessmentDiagnoses);
    }

    return problems;
  }, [assessmentDiagnoses]);

  // Search ICD-10 codes when typing
  useEffect(() => {
    const searchICD10 = async () => {
      if (searchTerm.trim().length >= 2 && searchTerm.trim().length > 0) {
        setSearchingICD10(true);
        try {
          const response = await codesAPI.searchICD10(searchTerm.trim());
          setIcd10Results(response.data || []);
        } catch (error) {
          console.error('Error searching ICD-10:', error);
          setIcd10Results([]);
        } finally {
          setSearchingICD10(false);
        }
      } else {
        setIcd10Results([]);
      }
    };

    const debounceTimer = setTimeout(searchICD10, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Filter problems based on search - only show assessment diagnoses
  useEffect(() => {
    console.log('DiagnosisSelector: Filter effect triggered. searchTerm:', searchTerm, 'assessmentProblems.length:', assessmentProblems.length, 'assessmentDiagnoses:', assessmentDiagnoses);
    if (searchTerm.trim().length === 0) {
      // Show assessment problems when search is empty
      console.log('DiagnosisSelector: Setting filteredProblems to assessmentProblems:', assessmentProblems);
      setFilteredProblems(assessmentProblems);
    } else {
      // Filter assessment problems by search term
      const search = (searchTerm || '').toLowerCase();
      const filtered = assessmentProblems.filter(p => {
        if (!p) return false;
        const problemName = (p.problem_name || p.name || '').toLowerCase();
        const icd10Code = (p.icd10_code || p.icd10Code || '').toLowerCase();
        return problemName.includes(search) || icd10Code.includes(search);
      });
      console.log('DiagnosisSelector: Filtered problems:', filtered);
      setFilteredProblems(filtered);
    }
  }, [searchTerm, assessmentProblems, assessmentDiagnoses]);

  // Initialize filteredProblems when assessmentProblems first become available and search is empty
  useEffect(() => {
    if (assessmentProblems.length > 0 && searchTerm.trim().length === 0) {
      // Only update if filteredProblems is empty or doesn't match assessmentProblems
      setFilteredProblems(prev => {
        if (prev.length === 0 || prev.length !== assessmentProblems.length) {
          console.log('DiagnosisSelector: Initializing filteredProblems with assessmentProblems:', assessmentProblems);
          return assessmentProblems;
        }
        return prev;
      });
    }
  }, [assessmentProblems, searchTerm]);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const response = await patientsAPI.getProblems(patientId);
      const problemsData = response.data || response || [];
      setProblems(problemsData);
      // Don't set filteredProblems here - let the useEffect handle it based on assessmentProblems
    } catch (error) {
      console.error('Error fetching problems:', error);
      setProblems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDiagnosis = (problem) => {
    if (!allowMultiple && selectedDiagnoses.length > 0) {
      // Replace existing if only one allowed
      onDiagnosesChange([problem]);
    } else {
      // Add if not already selected
      if (!selectedDiagnoses.find(d => d.id === problem.id)) {
        onDiagnosesChange([...selectedDiagnoses, problem]);
      }
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleAddNewDiagnosis = async (icd10Code) => {
    // Find the ICD-10 code details
    const codeDetails = icd10Results.find(r => r.code === icd10Code);
    if (!codeDetails) return;

    const diagnosisText = `${codeDetails.code} - ${codeDetails.description}`;

    // Add to assessment FIRST if callback provided - this will trigger a re-render
    // and the new diagnosis will appear in assessmentProblems
    if (onAddToAssessment) {
      console.log('DiagnosisSelector: Adding new diagnosis to assessment:', diagnosisText);
      onAddToAssessment(diagnosisText);
    }

    // Create a temporary problem object
    const newProblem = {
      id: `temp-${codeDetails.code}`,
      problem_name: codeDetails.description,
      name: codeDetails.description,
      icd10_code: codeDetails.code,
      icd10Code: codeDetails.code,
      status: 'active',
      fromAssessment: true
    };

    // Add to selected diagnoses
    handleAddDiagnosis(newProblem);

    // Clear search and close dropdown
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveDiagnosis = (problemId) => {
    onDiagnosesChange(selectedDiagnoses.filter(d => d.id !== problemId));
  };

  const getProblemDisplayName = (problem) => {
    return problem.problem_name || problem.name || 'Unknown Diagnosis';
  };

  const getProblemCode = (problem) => {
    return problem.icd10_code || problem.icd10Code || '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-xs font-semibold text-gray-900">
        Diagnosis {required && <span className="text-red-500">*</span>}
        {allowMultiple && <span className="text-xs font-normal text-gray-500 ml-1">(Select one or more)</span>}
      </label>

      {/* Selected Diagnoses */}
      {selectedDiagnoses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDiagnoses.map((diagnosis) => (
            <div
              key={diagnosis.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary-50 border border-primary-200 rounded-md"
            >
              <span className="text-xs font-medium text-primary-900">
                {getProblemDisplayName(diagnosis)}
                {getProblemCode(diagnosis) && (
                  <span className="text-xs text-primary-600 ml-1">
                    ({getProblemCode(diagnosis)})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveDiagnosis(diagnosis.id)}
                className="text-primary-600 hover:text-primary-800 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search/Add Diagnosis */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={selectedDiagnoses.length === 0 ? "Search assessment diagnoses..." : "Add another diagnosis..."}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {searchingICD10 ? (
                <div className="p-2 text-center">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <p className="text-xs text-gray-500 mt-1">Searching...</p>
                </div>
              ) : filteredProblems.length > 0 ? (
                <>
                  {filteredProblems.map((problem) => {
                    const isSelected = selectedDiagnoses.find(d => d.id === problem.id);
                    return (
                      <button
                        key={problem.id}
                        type="button"
                        onClick={() => handleAddDiagnosis(problem)}
                        disabled={isSelected}
                        className={`w-full p-2 hover:bg-primary-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between text-left transition-colors ${isSelected ? 'bg-gray-50 opacity-60 cursor-not-allowed' : ''
                          }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-gray-900">
                              {getProblemDisplayName(problem)}
                            </p>
                            {isSelected && (
                              <Check className="w-3 h-3 text-primary-600" />
                            )}
                          </div>
                          {getProblemCode(problem) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {getProblemCode(problem)}
                            </p>
                          )}
                        </div>
                        {!isSelected && <Plus className="w-4 h-4 text-gray-400" />}
                      </button>
                    );
                  })}
                  {/* Show ICD-10 search results if available */}
                  {icd10Results.length > 0 && searchTerm.trim().length >= 2 && (
                    <>
                      <div className="border-t border-gray-200 p-1">
                        <p className="text-xs font-semibold text-gray-600 px-2 py-1">Add New Diagnosis:</p>
                      </div>
                      {icd10Results.slice(0, 5).map((result) => (
                        <button
                          key={result.code}
                          type="button"
                          onClick={() => handleAddNewDiagnosis(result.code)}
                          className="w-full p-2 hover:bg-green-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between text-left transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900">{result.description}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{result.code}</p>
                          </div>
                          <Plus className="w-4 h-4 text-green-600" />
                        </button>
                      ))}
                    </>
                  )}
                </>
              ) : icd10Results.length > 0 && searchTerm.trim().length >= 2 ? (
                <>
                  <div className="border-b border-gray-200 p-1">
                    <p className="text-xs font-semibold text-gray-600 px-2 py-1">Add New Diagnosis:</p>
                  </div>
                  {icd10Results.slice(0, 5).map((result) => (
                    <button
                      key={result.code}
                      type="button"
                      onClick={() => handleAddNewDiagnosis(result.code)}
                      className="w-full p-2 hover:bg-green-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">{result.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{result.code}</p>
                      </div>
                      <Plus className="w-4 h-4 text-green-600" />
                    </button>
                  ))}
                </>
              ) : (
                <div className="p-3 text-center">
                  <AlertCircle className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">No diagnoses found</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {searchTerm ? 'Search for ICD-10 codes to add new diagnosis' : 'Add diagnoses to Assessment first'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Validation Message */}
      {required && selectedDiagnoses.length === 0 && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          At least one diagnosis is required
        </p>
      )}
      {assessmentDiagnoses.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          No diagnoses in Assessment. Add diagnoses to Assessment first, or search to add new ones.
        </p>
      )}
    </div>
  );
};

export default DiagnosisSelector;
