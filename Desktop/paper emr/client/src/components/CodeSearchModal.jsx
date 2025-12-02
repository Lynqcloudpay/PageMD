/**
 * Code Search Modal Component
 * 
 * Universal code search modal for ICD-10 and CPT codes
 * Supports:
 * - Real-time search with debouncing
 * - Database-backed search with fallback
 * - Code selection and attachment
 * - Multiple selection support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Check, FileText, Loader, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import { codesAPI } from '../services/api';

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

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = codeType === 'ICD10' 
          ? await codesAPI.searchICD10(searchQuery)
          : await codesAPI.searchCPT(searchQuery);
        
        setResults(response.data || []);
      } catch (err) {
        console.error('Code search error:', err);
        setError('Failed to search codes. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, codeType]);

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
    onClose();
  };

  // Check if code is selected
  const isCodeSelected = (code) => {
    return selected.some(c => c.code === code.code);
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
        {searchQuery.length >= 2 && (
          <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            {results.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {results.map((code, idx) => {
                  const isSelected = isCodeSelected(code);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectCode(code)}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="font-mono font-semibold text-gray-900">{code.code}</span>
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
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !loading ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No codes found matching "{searchQuery}"</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Instructions */}
        {searchQuery.length < 2 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Enter at least 2 characters to search {codeType} codes.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              You can search by code (e.g., "E11.9") or description (e.g., "diabetes").
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {multiSelect ? 'Cancel' : 'Close'}
          </button>

          {multiSelect && selected.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Add {selected.length} {selected.length === 1 ? 'Code' : 'Codes'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CodeSearchModal;

