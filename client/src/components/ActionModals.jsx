import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './ui/Modal';
import DiagnosisSelector from './DiagnosisSelector';
import { Pill, Stethoscope, Upload, Send, Search, X } from 'lucide-react';
import { searchLabTests, searchImaging } from '../data/labCodes';
import { codesAPI, ordersAPI, documentsAPI } from '../services/api';

export const PrescriptionModal = ({ isOpen, onClose, onSuccess, diagnoses = [], patientId, assessmentDiagnoses = [], onAddToAssessment = null }) => {
    const [med, setMed] = useState('');
    const [sig, setSig] = useState('');
    const [dispense, setDispense] = useState('');
    const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setMed('');
            setSig('');
            setDispense('');
            setSelectedDiagnoses([]);
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedDiagnoses.length === 0) {
            alert('Please select at least one diagnosis');
            return;
        }
        // Extract diagnosis text from selected diagnoses
        const diagnosisTexts = selectedDiagnoses.map(d => {
            const code = d.icd10_code || d.icd10Code || '';
            const name = d.problem_name || d.name || '';
            return code ? `${code} - ${name}` : name;
        });
        const prescriptionText = `Prescription: ${med} - ${sig}, Dispense: ${dispense}`;
        onSuccess(diagnosisTexts.join(', '), prescriptionText);
        setMed('');
        setSig('');
        setDispense('');
        setSelectedDiagnoses([]);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New e-Prescription">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Diagnosis Selection */}
                {patientId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
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
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Medication</label>
                    <div className="relative">
                        <Pill className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search medication..."
                            className="w-full pl-9 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                            value={med}
                            onChange={(e) => setMed(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Sig</label>
                        <input
                            type="text"
                            placeholder="e.g. 1 tab PO daily"
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={sig}
                            onChange={(e) => setSig(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Dispense</label>
                        <input
                            type="text"
                            placeholder="e.g. 30"
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={dispense}
                            onChange={(e) => setDispense(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-deep-gray/20 rounded-md hover:bg-soft-gray text-deep-gray">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>Sign & Send</button>
                </div>
            </form>
        </Modal>
    );
};

export const OrderModal = ({ isOpen, onClose, onSuccess, orderType = 'lab', patientId, visitId, diagnoses = [], preSelectedDiagnoses = [], assessmentDiagnoses = [], onAddToAssessment = null, returnTemplateOnly = false }) => {
    const [order, setOrder] = useState('');
    const [selectedType, setSelectedType] = useState(orderType);
    const [selectedDiagnoses, setSelectedDiagnoses] = useState([]); // Array of diagnosis objects
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [selectedLabs, setSelectedLabs] = useState([]); // Array of selected labs
    const [labCompany, setLabCompany] = useState('quest'); // 'quest' or 'labcorp'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(-1); // For keyboard navigation
    const searchInputRef = useRef(null);

    // Use diagnoses directly in render, but only update selectedDiagnosis when modal opens
    // This prevents infinite loops from diagnoses array reference changes
    const diagnosesArray = diagnoses || [];

    useEffect(() => {
        if (isOpen) {
            setSelectedType(orderType);
            setOrder('');
            setSelectedDiagnoses(preSelectedDiagnoses.length > 0 ? preSelectedDiagnoses : []);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedTest(null);
            setSelectedLabs([]);
            setLabCompany('quest');
            setError(null);
            setSelectedIndex(-1);
            // Focus search input when modal opens
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 100);
        }
    }, [isOpen, orderType, preSelectedDiagnoses]);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            if (selectedType === 'lab') {
                const results = searchLabTests(searchQuery);
                setSearchResults(results.slice(0, 10));
            } else if (selectedType === 'imaging') {
                const results = searchImaging(searchQuery);
                setSearchResults(results.slice(0, 10));
            } else {
                setSearchResults([]);
            }
        } else {
            setSearchResults([]);
        }
        // Reset selected index when search changes
        setSelectedIndex(-1);
    }, [searchQuery, selectedType]);

    const handleTestSelect = (test) => {
        // For labs, add to selected labs list instead of replacing
        if (selectedType === 'lab') {
            // Check if already selected
            if (!selectedLabs.find(l => l.name === test.name)) {
                setSelectedLabs([...selectedLabs, test]);
            }
            setSelectedTest(null);
            // Clear search and refocus input for continuous ordering
            setSearchQuery('');
            setSearchResults([]);
            setSelectedIndex(-1);
            // Auto-focus search bar after adding lab
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 50);
        } else {
            setSelectedTest(test);
            setOrder(test.name);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedIndex(-1);
        }
    };

    const handleKeyDown = (e) => {
        if (searchResults.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev =>
                prev < searchResults.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < searchResults.length) {
            e.preventDefault();
            handleTestSelect(searchResults[selectedIndex]);
        }
    };

    const removeLab = (labName) => {
        setSelectedLabs(selectedLabs.filter(l => l.name !== labName));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate diagnosis requirement
        if (!selectedDiagnoses || selectedDiagnoses.length === 0) {
            setError('Please select at least one diagnosis for this order');
            return;
        }

        // For labs, require at least one lab selected
        if (selectedType === 'lab' && selectedLabs.length === 0) {
            setError('Please select at least one lab test');
            return;
        }

        // For imaging/procedures, require order text
        if (selectedType !== 'lab' && !order) {
            setError('Please enter the order details');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get all diagnosis IDs (including assessment diagnoses)
            // We'll send both IDs and objects so backend can create problems for assessment diagnoses
            const diagnosisIds = selectedDiagnoses
                .map(d => d.id)
                .filter(id => id && id.toString() !== 'undefined' && id.toString() !== 'null');

            if (diagnosisIds.length === 0) {
                setError('Please select at least one diagnosis.');
                setLoading(false);
                return;
            }

            const orderTypeMap = {
                'lab': 'lab',
                'imaging': 'imaging',
                'procedure': 'procedure'
            };

            // Send diagnosis objects along with IDs for assessment diagnoses
            const diagnosisObjects = selectedDiagnoses.map(d => ({
                id: d.id,
                problem_name: d.problem_name || d.name,
                name: d.problem_name || d.name,
                icd10_code: d.icd10_code || d.icd10Code,
                icd10Code: d.icd10_code || d.icd10Code
            }));

            console.log('OrderModal: Sending diagnosis data:', {
                diagnosisIds: diagnosisIds,
                diagnosisObjects: diagnosisObjects,
                selectedDiagnoses: selectedDiagnoses
            });
            console.log('OrderModal: Full diagnosis IDs:', JSON.stringify(diagnosisIds, null, 2));
            console.log('OrderModal: Full diagnosis objects:', JSON.stringify(diagnosisObjects, null, 2));
            console.log('OrderModal: Full selected diagnoses:', JSON.stringify(selectedDiagnoses, null, 2));

            // Build order templates for ordersets
            let orderTemplates = [];

            if (returnTemplateOnly) {
                // Return templates instead of creating orders
                if (selectedType === 'lab') {
                    selectedLabs.forEach(lab => {
                        const code = labCompany === 'quest' ? lab.questCode : lab.labcorpCode;
                        const companyName = labCompany === 'quest' ? 'Quest' : 'LabCorp';
                        orderTemplates.push({
                            type: 'lab',
                            payload: {
                                test_name: lab.name,
                                testName: lab.name,
                                name: lab.name,
                                company: companyName,
                                code: code,
                                cpt: lab.cpt || null
                            }
                        });
                    });
                } else {
                    const orderPayload = {
                        name: order,
                        description: order,
                        studyName: selectedType === 'imaging' ? order : undefined,
                        procedureName: selectedType === 'procedure' ? order : undefined,
                        cpt: selectedTest?.cpt || null
                    };
                    orderTemplates.push({
                        type: orderTypeMap[selectedType],
                        payload: orderPayload
                    });
                }
            } else {
                // Create actual orders
                if (selectedType === 'lab') {
                    // Create separate order for each lab
                    const orderPromises = selectedLabs.map(async (lab) => {
                        const code = labCompany === 'quest' ? lab.questCode : lab.labcorpCode;
                        const companyName = labCompany === 'quest' ? 'Quest' : 'LabCorp';
                        const orderPayload = {
                            test_name: lab.name,
                            testName: lab.name,
                            name: lab.name,
                            company: companyName,
                            code: code,
                            cpt: lab.cpt || null
                        };

                        return ordersAPI.create({
                            patientId,
                            visitId,
                            orderType: orderTypeMap[selectedType],
                            orderPayload,
                            diagnosisIds,
                            diagnosisObjects
                        });
                    });

                    await Promise.all(orderPromises);
                } else {
                    // Single order for imaging/procedures
                    const orderPayload = {
                        name: order,
                        description: order,
                        cpt: selectedTest?.cpt || null
                    };

                    await ordersAPI.create({
                        patientId,
                        visitId,
                        orderType: orderTypeMap[selectedType],
                        orderPayload,
                        diagnosisIds,
                        diagnosisObjects
                    });
                }
            }

            // Call onSuccess with diagnosis objects for backward compatibility
            // Format diagnosis text with ICD-10 code if available (matches assessment format)
            const diagnosisText = selectedDiagnoses.map(d => {
                const code = d.icd10_code || d.icd10Code || '';
                const name = d.problem_name || d.name || '';
                return code ? `${code} - ${name}` : name;
            }).join(', ');
            const typeLabel = selectedType === 'lab' ? 'Lab' : selectedType === 'imaging' ? 'Imaging' : 'Procedure';
            let orderText = '';

            if (selectedType === 'lab') {
                selectedLabs.forEach(lab => {
                    const code = labCompany === 'quest' ? lab.questCode : lab.labcorpCode;
                    const companyName = labCompany === 'quest' ? 'Quest' : 'LabCorp';
                    const labText = `${lab.name} [${companyName}: ${code}${lab.cpt ? `, CPT: ${lab.cpt}` : ''}]`;
                    orderText += (orderText ? '; ' : '') + `${typeLabel}: ${labText}`;
                });
            } else {
                orderText = `${typeLabel}: ${order}`;
                if (selectedTest && selectedType === 'imaging' && selectedTest.cpt) {
                    orderText += ` [CPT: ${selectedTest.cpt}]`;
                }
            }

            if (onSuccess) {
                if (returnTemplateOnly) {
                    // Pass order templates as third parameter
                    onSuccess(diagnosisText, orderText, orderTemplates.length === 1 ? orderTemplates[0] : orderTemplates);
                } else {
                    onSuccess(diagnosisText, orderText, selectedDiagnoses);
                }
            }

            setOrder('');
            setSelectedDiagnoses([]);
            setSelectedTest(null);
            setSelectedLabs([]);
            setError(null);
            onClose();
        } catch (err) {
            console.error('Error creating order:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create order. Please try again.';
            const errorDetails = err.response?.data?.details;
            if (errorDetails) {
                console.error('Error details:', errorDetails);
                setError(`${errorMessage}${errorDetails.detail ? `: ${errorDetails.detail}` : ''}${errorDetails.constraint ? ` (Constraint: ${errorDetails.constraint})` : ''}`);
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const getPlaceholder = () => {
        if (selectedType === 'lab') return 'Search labs (e.g., CBC, CMP, Lipid Panel, Quest code, LabCorp code)...';
        if (selectedType === 'imaging') return 'Search imaging (e.g., Chest X-ray, CT Head, MRI, CPT code)...';
        return 'Search procedures (e.g., EKG, Colonoscopy)...';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Order">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Order Type</label>
                    <select
                        value={selectedType}
                        onChange={(e) => {
                            setSelectedType(e.target.value);
                            setSelectedLabs([]);
                            setSelectedTest(null);
                            setSearchQuery('');
                        }}
                        className="w-full p-2 border border-paper-300 rounded-md"
                    >
                        <option value="lab">Lab</option>
                        <option value="imaging">Imaging</option>
                        <option value="procedure">Procedure</option>
                    </select>
                </div>

                {/* Lab Company Selection (only for labs) */}
                {selectedType === 'lab' && (
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Lab Company</label>
                        <select
                            value={labCompany}
                            onChange={(e) => setLabCompany(e.target.value)}
                            className="w-full p-2 border border-paper-300 rounded-md"
                        >
                            <option value="quest">Quest Diagnostics</option>
                            <option value="labcorp">LabCorp</option>
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">
                        {selectedType === 'lab' ? 'Test Name' : selectedType === 'imaging' ? 'Study Name' : 'Procedure Name'}
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4 z-10" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={getPlaceholder()}
                            className="w-full pl-9 pr-8 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                            value={searchQuery || order}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (!e.target.value) {
                                    setOrder('');
                                    setSelectedTest(null);
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            required={selectedType !== 'lab'}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-ink-400 hover:text-ink-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-1 border border-paper-300 rounded-md bg-white shadow-lg max-h-60 overflow-y-auto z-20 relative">
                            {searchResults.map((test, idx) => {
                                const isSelected = selectedType === 'lab' && selectedLabs.find(l => l.name === test.name);
                                const isHighlighted = idx === selectedIndex;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleTestSelect(test)}
                                        disabled={isSelected}
                                        className={`w-full text-left px-3 py-2 border-b border-paper-100 last:border-b-0 ${isSelected
                                            ? 'bg-green-50 opacity-75 cursor-not-allowed'
                                            : isHighlighted
                                                ? 'bg-blue-50 hover:bg-blue-100'
                                                : 'hover:bg-paper-50'
                                            }`}
                                    >
                                        <div className="font-medium text-ink-900 flex items-center justify-between">
                                            <span>{test.name}</span>
                                            {isSelected && <span className="text-xs text-green-600 font-medium">✓ Added</span>}
                                        </div>
                                        {selectedType === 'lab' && (
                                            <div className="text-xs text-ink-600 mt-1">
                                                {test.questCode && <span className="mr-2">Quest: {test.questCode}</span>}
                                                {test.labcorpCode && <span className="mr-2">LabCorp: {test.labcorpCode}</span>}
                                                {test.cpt && <span>CPT: {test.cpt}</span>}
                                            </div>
                                        )}
                                        {selectedType === 'imaging' && test.cpt && (
                                            <div className="text-xs text-ink-600 mt-1">CPT: {test.cpt}</div>
                                        )}
                                        {test.description && (
                                            <div className="text-xs text-ink-500 mt-1">{test.description}</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {/* Selected Labs List (for lab orders) */}
                    {selectedType === 'lab' && selectedLabs.length > 0 && (
                        <div className="mt-2 space-y-2">
                            <div className="text-xs font-medium text-ink-700">Selected Labs ({selectedLabs.length}):</div>
                            {selectedLabs.map((lab, idx) => {
                                const code = labCompany === 'quest' ? lab.questCode : lab.labcorpCode;
                                const companyName = labCompany === 'quest' ? 'Quest' : 'LabCorp';
                                return (
                                    <div key={idx} className="p-2 bg-paper-50 border border-paper-200 rounded text-sm flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium text-ink-900">{lab.name}</div>
                                            <div className="text-xs text-ink-600 mt-1">
                                                <span className="mr-3">{companyName}: {code}</span>
                                                {lab.cpt && <span>CPT: {lab.cpt}</span>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeLab(lab.name)}
                                            className="ml-2 text-red-600 hover:text-red-800"
                                            title="Remove"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Selected Test (for imaging/procedures) */}
                    {selectedType !== 'lab' && selectedTest && (
                        <div className="mt-2 p-2 bg-paper-50 border border-paper-200 rounded text-sm">
                            <div className="font-medium text-ink-900">{selectedTest.name}</div>
                            {selectedType === 'imaging' && selectedTest.cpt && (
                                <div className="text-xs text-ink-600 mt-1">CPT: {selectedTest.cpt}</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Diagnosis Selection */}
                {patientId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
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

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                        {error}
                    </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50">Cancel</button>
                    <button
                        type="submit"
                        disabled={loading || selectedDiagnoses.length === 0 || ((selectedType === 'lab' && selectedLabs.length === 0) || (selectedType !== 'lab' && !order))}
                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Creating Order...</span>
                            </>
                        ) : (
                            selectedType === 'lab' ? `Place Order (${selectedLabs.length} lab${selectedLabs.length !== 1 ? 's' : ''})` : 'Place Order'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export const ReferralModal = ({ isOpen, onClose, onSuccess, diagnoses = [], patientId, visitId, assessmentDiagnoses = [], onAddToAssessment = null, returnTemplateOnly = false }) => {
    const [specialty, setSpecialty] = useState('');
    const [reason, setReason] = useState('');
    const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSpecialty('');
            setReason('');
            setSelectedDiagnoses([]);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedDiagnoses.length === 0) {
            alert('Please select at least one diagnosis');
            return;
        }

        const referralText = `Referral: ${specialty}${reason ? ` - ${reason}` : ''}`;
        // Extract diagnosis text from selected diagnoses
        const diagnosisTexts = selectedDiagnoses.map(d => {
            const code = d.icd10_code || d.icd10Code || '';
            const name = d.problem_name || d.name || '';
            return code ? `${code} - ${name}` : name;
        });

        if (returnTemplateOnly) {
            // Return referral template for orderset
            const referralTemplate = {
                type: 'referral',
                payload: {
                    specialist: specialty,
                    reason: reason || null
                }
            };
            onSuccess(diagnosisTexts.join(', '), referralText, referralTemplate);
            setSpecialty('');
            setReason('');
            setSelectedDiagnoses([]);
            onClose();
        } else {
            // Create actual referral record
            try {
                setCreating(true);
                const { referralsAPI } = await import('../services/api');
                const diagnosisIds = selectedDiagnoses.map(d => d.id).filter(id => id);

                // Send diagnosis objects along with IDs for assessment diagnoses
                const diagnosisObjects = selectedDiagnoses.map(d => ({
                    id: d.id,
                    problem_name: d.problem_name || d.name,
                    name: d.problem_name || d.name,
                    icd10_code: d.icd10_code || d.icd10Code,
                    icd10Code: d.icd10_code || d.icd10Code
                }));

                await referralsAPI.create({
                    patientId,
                    visitId: visitId || null,
                    recipientName: specialty,
                    recipientSpecialty: specialty,
                    reason: reason || '',
                    diagnosisIds: diagnosisIds,
                    diagnosisObjects: diagnosisObjects
                });

                onSuccess(diagnosisTexts.join(', '), referralText);
                setSpecialty('');
                setReason('');
                setSelectedDiagnoses([]);
                onClose();
            } catch (error) {
                console.error('Error creating referral:', error);
                console.log('Referral error response:', error?.response?.data);
                const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error.message || 'Failed to create referral. Please try again.';
                const errorDetails = error?.response?.data?.details;
                if (errorDetails) {
                    console.error('Error details:', errorDetails);
                    alert(`${errorMessage}\n\nDetails: ${JSON.stringify(errorDetails, null, 2)}`);
                } else {
                    alert(errorMessage);
                }
            } finally {
                setCreating(false);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Referral">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Diagnosis Selection */}
                {patientId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
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
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Specialty / Provider</label>
                    <div className="relative">
                        <Send className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search specialty..."
                            className="w-full pl-9 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Reason for Referral</label>
                    <textarea
                        className="w-full p-2 border border-paper-300 rounded-md h-24"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                    ></textarea>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} disabled={creating} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50 disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={creating} className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md disabled:opacity-50" style={{ background: creating ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => !creating && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')} onMouseLeave={(e) => !creating && (e.currentTarget.style.background = creating ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)')}>
                        {creating ? 'Creating...' : 'Send Referral'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};



export const UploadModal = ({ isOpen, onClose, onSuccess, patientId, visitId }) => {
    const [file, setFile] = useState(null);
    const [docType, setDocType] = useState('Lab Result');
    const [tags, setTags] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setDocType('Lab Result');
            setTags('');
            setError(null);
            setUploading(false);
        }
    }, [isOpen]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB');
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile) {
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB');
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('patientId', patientId);
            if (visitId) formData.append('visitId', visitId);
            formData.append('docType', docType);
            formData.append('tags', tags);

            await documentsAPI.upload(formData);
            onSuccess("Document uploaded successfully");
            onClose();
        } catch (err) {
            console.error('Error uploading document:', err);
            setError(err.response?.data?.error || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload Document">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div
                    onClick={triggerFileInput}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className={`border-2 border-dashed ${file ? 'border-green-500 bg-green-50' : 'border-paper-300 hover:bg-paper-50'} rounded-lg p-8 text-center transition-colors cursor-pointer`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Upload className={`w-12 h-12 mx-auto mb-2 ${file ? 'text-green-500' : 'text-paper-400'}`} />
                    <p className={`font-medium ${file ? 'text-green-700' : 'text-ink-600'}`}>
                        {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-ink-400 text-sm mt-1">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, JPG, PNG (max 10MB)'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Document Type</label>
                    <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full p-2 border border-paper-300 rounded-md"
                    >
                        <option>Lab Result</option>
                        <option>Imaging Report</option>
                        <option>Consult Note</option>
                        <option>EKG</option>
                        <option>ECHO</option>
                        <option>Other</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Tags (optional)</label>
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g. cardiac, urgent, follow-up"
                        className="w-full p-2 border border-paper-300 rounded-md"
                    />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={uploading || !file}
                        className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: uploading ? '#9CA3AF' : 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => !uploading && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                        onMouseLeave={(e) => !uploading && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
