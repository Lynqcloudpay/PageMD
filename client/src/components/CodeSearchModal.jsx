/**
 * Code Search Modal Component
 * 
 * Universal code search modal for ICD-10 and CPT codes
 * Supports:
 * - Real-time search with debouncing
 * - Database-backed search with fallback
 * - Code selection and attachment
 * - Multiple selection support
 * - Hierarchy indicators for ICD-10 codes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Check, FileText, Loader, AlertCircle, ChevronRight, Layers } from 'lucide-react';
import Modal from './ui/Modal';
import { codesAPI, icd10HierarchyAPI } from '../services/api';

const CodeSearchModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  codeType = 'ICD10', // 'ICD10' or 'CPT'
  multiSelect = false,
  selectedCodes = [] // Array of already selected codes
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(selectedCodes || []);
  const [codesWithHierarchy, setCodesWithHierarchy] = useState(new Set()); // Track which codes have hierarchies
  const [checkingHierarchies, setCheckingHierarchies] = useState(false);

  // Fetch parent codes with hierarchies once on mount
  useEffect(() => {
    if (codeType === 'ICD10') {
      setCheckingHierarchies(true);
      const fetchHierarchyParents = async () => {
        try {
          const response = await icd10HierarchyAPI.getParents();
          if (response.data) {
            const hierarchySet = new Set(response.data.map(item => item.parent_code));
            setCodesWithHierarchy(hierarchySet);
          }
        } catch (error) {
          console.error('Error fetching hierarchy parents:', error);
        } finally {
          setCheckingHierarchies(false);
        }
      };
      fetchHierarchyParents();
    } else {
      setCodesWithHierarchy(new Set());
    }
  }, [codeType]);

  // Debounced search - show popular codes when empty, search when 2+ characters
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        // If search is empty or less than 2 chars, show popular codes (first 50)
        // Otherwise, perform search
        const query = searchQuery.length >= 2 ? searchQuery : '';
        const response = codeType === 'ICD10' 
          ? await codesAPI.searchICD10(query)
          : await codesAPI.searchCPT(query);
        
        let results = response.data || [];
        
        // Sort results: shortest description first, with hierarchy codes prioritized
        if (codeType === 'ICD10') {
          // Use current codesWithHierarchy state value
          results = results.sort((a, b) => {
            const aHasHierarchy = codesWithHierarchy.has(a.code) || codesWithHierarchy.has(a.code.match(/^([A-Z]\d+)/)?.[1]);
            const bHasHierarchy = codesWithHierarchy.has(b.code) || codesWithHierarchy.has(b.code.match(/^([A-Z]\d+)/)?.[1]);
            const aDescLength = (a.description || '').length;
            const bDescLength = (b.description || '').length;
            
            // First priority: hierarchy codes come first
            if (aHasHierarchy && !bHasHierarchy) return -1;
            if (!aHasHierarchy && bHasHierarchy) return 1;
            
            // Second priority: shortest description first
            if (aDescLength !== bDescLength) {
              return aDescLength - bDescLength;
            }
            
            // If same length, sort alphabetically by code
            return a.code.localeCompare(b.code);
          });
        } else {
          // For CPT, just sort by description length
          results = results.sort((a, b) => {
            const aDescLength = (a.description || '').length;
            const bDescLength = (b.description || '').length;
            if (aDescLength !== bDescLength) {
              return aDescLength - bDescLength;
            }
            return a.code.localeCompare(b.code);
          });
        }
        
        setResults(results);
      } catch (err) {
        console.error('Code search error:', err);
        setError('Failed to search codes. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, codeType, codesWithHierarchy]);

  // Handle code selection
  const handleSelectCode = (code) => {
    if (multiSelect) {
      const isSelected = selected.some(c => c.code === code.code);
      if (isSelected) {
        setSelected(selected.filter(c => c.code !== code.code));
      } else {
        setSelected([...selected, code]);
      }
    } else {
      onSelect(code);
      handleClose();
    }
  };

  // Handle confirm for multi-select
  const handleConfirm = () => {
    if (selected.length > 0) {
      onSelect(multiSelect ? selected : selected[0]);
    }
    handleClose();
  };

  // Reset on close
  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    setSelected(selectedCodes || []);
    setError(null);
    setCodesWithHierarchy(new Set());
    onClose();
  };

  // Check if code is selected
  const isCodeSelected = (code) => {
    return selected.some(c => c.code === code.code);
  };

  // Check if code has hierarchy
  const hasHierarchy = (code) => {
    return codesWithHierarchy.has(code.code);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Search ${codeType} Codes`} size="lg">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${codeType} codes by code or description...`}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autoFocus
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader className="w-5 h-5 text-primary-600 animate-spin" />
            </div>
          )}
          {searchQuery && !loading && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Selected Codes Count (multi-select) */}
        {multiSelect && selected.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-2">
            <p className="text-sm text-primary-800">
              <strong>{selected.length}</strong> {selected.length === 1 ? 'code' : 'codes'} selected
            </p>
          </div>
        )}

        {/* Results */}
        <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {searchQuery.length === 0 && (
                <div className="p-3 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs text-blue-800 font-medium">
                    Showing popular {codeType} codes. Type to search for specific codes.
                  </p>
                </div>
              )}
              {results.map((code, idx) => {
                const isSelected = isCodeSelected(code);
                const hasHier = hasHierarchy(code);
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectCode(code)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                    } ${hasHier ? 'border-r-4 border-green-500' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="font-mono font-semibold text-gray-900">{code.code}</span>
                          {hasHier && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                              <Layers className="w-3 h-3" />
                              Refine
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 ml-6">{code.description}</p>
                        {code.billable !== undefined && (
                          <span className={`inline-block mt-2 ml-6 text-xs px-2 py-0.5 rounded ${
                            code.billable 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {code.billable ? 'Billable' : 'Non-billable'}
                          </span>
                        )}
                      </div>
                      {hasHier && (
                        <ChevronRight className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <Loader className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Searching codes...</p>
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No codes found matching "{searchQuery}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Start typing to search {codeType} codes</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {codeType === 'ICD10' && checkingHierarchies && (
              <span className="flex items-center gap-1">
                <Loader className="w-3 h-3 animate-spin" />
                Checking for refinement options...
              </span>
            )}
            {codeType === 'ICD10' && !checkingHierarchies && codesWithHierarchy.size > 0 && (
              <span className="text-green-600 font-medium">
                {codesWithHierarchy.size} code{codesWithHierarchy.size !== 1 ? 's' : ''} can be refined
              </span>
            )}
          </div>
          {multiSelect && (
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add {selected.length > 0 ? `${selected.length} ` : ''}Code{selected.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CodeSearchModal;
