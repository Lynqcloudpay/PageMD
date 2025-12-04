import React, { useState, useEffect, useMemo } from 'react';
import Modal from './ui/Modal';
import { Pill, Stethoscope, Upload, Send, Search, X } from 'lucide-react';
import { searchLabTests, searchImaging } from '../data/labCodes';
import { codesAPI } from '../services/api';

export const PrescriptionModal = ({ isOpen, onClose, onSuccess, diagnoses = [] }) => {
    const [med, setMed] = useState('');
    const [sig, setSig] = useState('');
    const [dispense, setDispense] = useState('');
    const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
    const [newDiagnosis, setNewDiagnosis] = useState('');
    const [useNewDiagnosis, setUseNewDiagnosis] = useState(false);
    const [icd10Search, setIcd10Search] = useState('');
    const [icd10Results, setIcd10Results] = useState([]);

    // Memoize diagnoses string to prevent infinite re-renders from array reference changes
    const diagnosesString = useMemo(() => JSON.stringify(diagnoses), [diagnoses]);

    useEffect(() => {
        if (isOpen) {
            setMed('');
            setSig('');
            setDispense('');
            setSelectedDiagnosis(diagnoses.length > 0 ? diagnoses[0] : '');
            setNewDiagnosis('');
            setUseNewDiagnosis(false);
            setIcd10Search('');
            setIcd10Results([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, diagnosesString]);

    // ICD-10 search - show popular codes when empty, search when 2+ characters
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                // If search is empty or less than 2 chars, show popular codes (first 50)
                // Otherwise, perform search
                const query = icd10Search.trim().length >= 2 ? icd10Search : '';
                const response = await codesAPI.searchICD10(query);
                setIcd10Results(response.data || []);
            } catch (error) {
                setIcd10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const diagnosis = useNewDiagnosis ? newDiagnosis : selectedDiagnosis;
        if (!diagnosis) {
            alert('Please select or enter a diagnosis');
            return;
        }
        const prescriptionText = `Prescription: ${med} - ${sig}, Dispense: ${dispense}`;
        onSuccess(diagnosis, prescriptionText);
        setMed('');
        setSig('');
        setDispense('');
        setSelectedDiagnosis('');
        setNewDiagnosis('');
        setUseNewDiagnosis(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New e-Prescription">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Link to Diagnosis</label>
                    {diagnoses.length > 0 ? (
                        <>
                            <div className="mb-2">
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={!useNewDiagnosis} 
                                        onChange={() => setUseNewDiagnosis(false)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Select from Assessment</span>
                                </label>
                                {!useNewDiagnosis && (
                                    <select
                                        value={selectedDiagnosis}
                                        onChange={(e) => setSelectedDiagnosis(e.target.value)}
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                    >
                                        <option value="">-- Select Diagnosis --</option>
                                        {diagnoses.map((dx, idx) => (
                                            <option key={idx} value={dx}>{dx}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={useNewDiagnosis} 
                                        onChange={() => setUseNewDiagnosis(true)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Add New Diagnosis</span>
                                </label>
                                {useNewDiagnosis && (
                                    <div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Search ICD-10 codes..."
                                                className="w-full pl-9 pr-2 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                                value={icd10Search}
                                                onChange={(e) => setIcd10Search(e.target.value)}
                                            />
                                        </div>
                                        {icd10Results.length > 0 && (
                                            <div className="mt-1 border border-paper-300 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                                                {icd10Results.map((code) => (
                                                    <button
                                                        key={code.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewDiagnosis(`${code.code} - ${code.description}`);
                                                            setIcd10Search('');
                                                            setIcd10Results([]);
                                                        }}
                                                        className="w-full text-left p-2 border-b border-paper-100 hover:bg-paper-50 transition-colors"
                                                    >
                                                        <div className="font-medium text-ink-900 text-sm">{code.code}</div>
                                                        <div className="text-xs text-ink-600">{code.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {newDiagnosis && (
                                            <div className="mt-2 p-2 bg-paper-50 border border-paper-200 rounded text-sm">
                                                <div className="font-medium text-ink-900">Selected: {newDiagnosis}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Enter diagnosis..."
                                className="w-full p-2 border border-paper-300 rounded-md mb-2"
                                value={useNewDiagnosis ? newDiagnosis : ''}
                                onChange={(e) => {
                                    setNewDiagnosis(e.target.value);
                                    setUseNewDiagnosis(true);
                                }}
                                required
                            />
                            <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">No diagnoses in Assessment. New diagnosis will be added to Assessment.</p>
                        </div>
                    )}
                </div>
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

export const OrderModal = ({ isOpen, onClose, onSuccess, orderType = 'lab', diagnoses = [] }) => {
    const [order, setOrder] = useState('');
    const [selectedType, setSelectedType] = useState(orderType);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [selectedLabs, setSelectedLabs] = useState([]); // Array of selected labs
    const [labCompany, setLabCompany] = useState('quest'); // 'quest' or 'labcorp'
    const [newDiagnosis, setNewDiagnosis] = useState('');
    const [icd10Search, setIcd10Search] = useState('');
    const [icd10Results, setIcd10Results] = useState([]);

    // Use diagnoses directly in render, but only update selectedDiagnosis when modal opens
    // This prevents infinite loops from diagnoses array reference changes
    const diagnosesArray = diagnoses || [];

    useEffect(() => {
        if (isOpen) {
            setSelectedType(orderType);
            setOrder('');
            setSelectedDiagnosis(diagnosesArray.length > 0 ? diagnosesArray[0] : '');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedTest(null);
            setSelectedLabs([]);
            setLabCompany('quest');
            setNewDiagnosis('');
            setIcd10Search('');
            setIcd10Results([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, orderType]);

    // ICD-10 search - show popular codes when empty, search when 2+ characters
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                // If search is empty or less than 2 chars, show popular codes (first 50)
                // Otherwise, perform search
                const query = icd10Search.trim().length >= 2 ? icd10Search : '';
                const response = await codesAPI.searchICD10(query);
                setIcd10Results(response.data || []);
            } catch (error) {
                setIcd10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

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
    }, [searchQuery, selectedType]);

    const handleTestSelect = (test) => {
        // For labs, add to selected labs list instead of replacing
        if (selectedType === 'lab') {
            // Check if already selected
            if (!selectedLabs.find(l => l.name === test.name)) {
                setSelectedLabs([...selectedLabs, test]);
            }
            setSelectedTest(null);
        } else {
            setSelectedTest(test);
            setOrder(test.name);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeLab = (labName) => {
        setSelectedLabs(selectedLabs.filter(l => l.name !== labName));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // For labs, require at least one lab selected
        if (selectedType === 'lab' && selectedLabs.length === 0) {
            return;
        }
        
        // For imaging/procedures, require order text
        if (selectedType !== 'lab' && !order) {
            return;
        }
        
        // Require diagnosis selection
        const finalDiagnosis = selectedDiagnosis.startsWith('NEW:') ? selectedDiagnosis.replace('NEW:', '') : selectedDiagnosis;
        if (!finalDiagnosis) {
            alert('Please select or enter a diagnosis');
            return;
        }

        const typeLabel = selectedType === 'lab' ? 'Lab' : selectedType === 'imaging' ? 'Imaging' : 'Procedure';
        let orderText = '';
        
        if (selectedType === 'lab') {
            // Build order text - each lab as separate order (will be split by semicolon for display)
            selectedLabs.forEach(lab => {
                const code = labCompany === 'quest' ? lab.questCode : lab.labcorpCode;
                const companyName = labCompany === 'quest' ? 'Quest' : 'LabCorp';
                const labText = `${lab.name} [${companyName}: ${code}${lab.cpt ? `, CPT: ${lab.cpt}` : ''}]`;
                orderText += (orderText ? '; ' : '') + `${typeLabel}: ${labText}`;
            });
        } else {
            // Single order for imaging/procedures
            orderText = `${typeLabel}: ${order}`;
            if (selectedTest && selectedType === 'imaging' && selectedTest.cpt) {
                orderText += ` [CPT: ${selectedTest.cpt}]`;
            }
        }
        
        onSuccess(finalDiagnosis, orderText);
        setOrder('');
        setSelectedDiagnosis('');
        setSelectedTest(null);
        setSelectedLabs([]);
        onClose();
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
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleTestSelect(test)}
                                        disabled={isSelected}
                                        className={`w-full text-left px-3 py-2 hover:bg-paper-50 border-b border-paper-100 last:border-b-0 ${
                                            isSelected ? 'bg-green-50 opacity-75 cursor-not-allowed' : ''
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
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Link to Diagnosis</label>
                    {diagnosesArray.length > 0 ? (
                        <>
                            <div className="mb-2">
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={!selectedDiagnosis.startsWith('NEW:')} 
                                        onChange={() => {
                                            setSelectedDiagnosis(diagnosesArray[0] || '');
                                        }}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Select from Assessment</span>
                                </label>
                                {!selectedDiagnosis.startsWith('NEW:') && (
                                    <select
                                        value={selectedDiagnosis}
                                        onChange={(e) => setSelectedDiagnosis(e.target.value)}
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                    >
                                        <option value="">-- Select Diagnosis --</option>
                                        {diagnosesArray.map((dx, idx) => (
                                            <option key={idx} value={dx}>{dx}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={selectedDiagnosis.startsWith('NEW:')} 
                                        onChange={() => setSelectedDiagnosis('NEW:')}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Add New Diagnosis</span>
                                </label>
                                {selectedDiagnosis.startsWith('NEW:') && (
                                    <div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Search ICD-10 codes..."
                                                className="w-full pl-9 pr-2 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                                value={icd10Search}
                                                onChange={(e) => setIcd10Search(e.target.value)}
                                            />
                                        </div>
                                        {icd10Results.length > 0 && (
                                            <div className="mt-1 border border-paper-300 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                                                {icd10Results.map((code) => (
                                                    <button
                                                        key={code.code}
                                                        type="button"
                                                        onClick={() => {
                                                            const diagnosisText = `${code.code} - ${code.description}`;
                                                            setSelectedDiagnosis('NEW:' + diagnosisText);
                                                            setNewDiagnosis(diagnosisText);
                                                            setIcd10Search('');
                                                            setIcd10Results([]);
                                                        }}
                                                        className="w-full text-left p-2 border-b border-paper-100 hover:bg-paper-50 transition-colors"
                                                    >
                                                        <div className="font-medium text-ink-900 text-sm">{code.code}</div>
                                                        <div className="text-xs text-ink-600">{code.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {newDiagnosis && (
                                            <div className="mt-2 p-2 bg-paper-50 border border-paper-200 rounded text-sm">
                                                <div className="font-medium text-ink-900">Selected: {newDiagnosis}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search ICD-10 codes..."
                                    className="w-full pl-9 pr-2 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                    value={icd10Search}
                                    onChange={(e) => setIcd10Search(e.target.value)}
                                />
                            </div>
                            {icd10Results.length > 0 && (
                                <div className="mb-2 border border-paper-300 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                                    {icd10Results.map((code) => (
                                        <button
                                            key={code.code}
                                            type="button"
                                            onClick={() => {
                                                const diagnosisText = `${code.code} - ${code.description}`;
                                                setSelectedDiagnosis('NEW:' + diagnosisText);
                                                setNewDiagnosis(diagnosisText);
                                                setIcd10Search('');
                                                setIcd10Results([]);
                                            }}
                                            className="w-full text-left p-2 border-b border-paper-100 hover:bg-paper-50 transition-colors"
                                        >
                                            <div className="font-medium text-ink-900 text-sm">{code.code}</div>
                                            <div className="text-xs text-ink-600">{code.description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {newDiagnosis && (
                                <div className="mb-2 p-2 bg-paper-50 border border-paper-200 rounded text-sm">
                                    <div className="font-medium text-ink-900">Selected: {newDiagnosis}</div>
                                </div>
                            )}
                            <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">No diagnoses in Assessment. New diagnosis will be added to Assessment.</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50">Cancel</button>
                    <button 
                        type="submit" 
                        disabled={(selectedType === 'lab' && selectedLabs.length === 0) || (selectedType !== 'lab' && !order)}
                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                    >
                        {selectedType === 'lab' ? `Place Order (${selectedLabs.length} lab${selectedLabs.length !== 1 ? 's' : ''})` : 'Place Order'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export const ReferralModal = ({ isOpen, onClose, onSuccess, diagnoses = [] }) => {
    const [specialty, setSpecialty] = useState('');
    const [reason, setReason] = useState('');
    const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
    const [newDiagnosis, setNewDiagnosis] = useState('');
    const [useNewDiagnosis, setUseNewDiagnosis] = useState(false);
    const [icd10Search, setIcd10Search] = useState('');
    const [icd10Results, setIcd10Results] = useState([]);

    // Memoize diagnoses to prevent infinite re-renders
    const diagnosesString = useMemo(() => JSON.stringify(diagnoses), [diagnoses]);
    
    useEffect(() => {
        if (isOpen) {
            setSpecialty('');
            setReason('');
            setSelectedDiagnosis(diagnoses.length > 0 ? diagnoses[0] : '');
            setNewDiagnosis('');
            setUseNewDiagnosis(false);
            setIcd10Search('');
            setIcd10Results([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, diagnosesString]);

    // ICD-10 search - show popular codes when empty, search when 2+ characters
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                // If search is empty or less than 2 chars, show popular codes (first 50)
                // Otherwise, perform search
                const query = icd10Search.trim().length >= 2 ? icd10Search : '';
                const response = await codesAPI.searchICD10(query);
                setIcd10Results(response.data || []);
            } catch (error) {
                setIcd10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [icd10Search]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const diagnosis = useNewDiagnosis ? newDiagnosis : selectedDiagnosis;
        if (!diagnosis) {
            alert('Please select or enter a diagnosis');
            return;
        }
        const referralText = `Referral: ${specialty}${reason ? ` - ${reason}` : ''}`;
        onSuccess(diagnosis, referralText);
        setSpecialty('');
        setReason('');
        setSelectedDiagnosis('');
        setNewDiagnosis('');
        setUseNewDiagnosis(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Referral">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Link to Diagnosis</label>
                    {diagnoses.length > 0 ? (
                        <>
                            <div className="mb-2">
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={!useNewDiagnosis} 
                                        onChange={() => setUseNewDiagnosis(false)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Select from Assessment</span>
                                </label>
                                {!useNewDiagnosis && (
                                    <select
                                        value={selectedDiagnosis}
                                        onChange={(e) => setSelectedDiagnosis(e.target.value)}
                                        className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                    >
                                        <option value="">-- Select Diagnosis --</option>
                                        {diagnoses.map((dx, idx) => (
                                            <option key={idx} value={dx}>{dx}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        checked={useNewDiagnosis} 
                                        onChange={() => setUseNewDiagnosis(true)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Add New Diagnosis</span>
                                </label>
                                {useNewDiagnosis && (
                                    <div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Search ICD-10 codes..."
                                                className="w-full pl-9 pr-2 p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                                                value={icd10Search}
                                                onChange={(e) => setIcd10Search(e.target.value)}
                                            />
                                        </div>
                                        {icd10Results.length > 0 && (
                                            <div className="mt-1 border border-paper-300 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                                                {icd10Results.map((code) => (
                                                    <button
                                                        key={code.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewDiagnosis(`${code.code} - ${code.description}`);
                                                            setIcd10Search('');
                                                            setIcd10Results([]);
                                                        }}
                                                        className="w-full text-left p-2 border-b border-paper-100 hover:bg-paper-50 transition-colors"
                                                    >
                                                        <div className="font-medium text-ink-900 text-sm">{code.code}</div>
                                                        <div className="text-xs text-ink-600">{code.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {newDiagnosis && (
                                            <div className="mt-2 p-2 bg-paper-50 border border-paper-200 rounded text-sm">
                                                <div className="font-medium text-ink-900">Selected: {newDiagnosis}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Enter diagnosis..."
                                className="w-full p-2 border border-paper-300 rounded-md mb-2"
                                value={useNewDiagnosis ? newDiagnosis : ''}
                                onChange={(e) => {
                                    setNewDiagnosis(e.target.value);
                                    setUseNewDiagnosis(true);
                                }}
                                required
                            />
                            <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">No diagnoses in Assessment. New diagnosis will be added to Assessment.</p>
                        </div>
                    )}
                </div>
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
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>Send Referral</button>
                </div>
            </form>
        </Modal>
    );
};

export const UploadModal = ({ isOpen, onClose, onSuccess }) => {
    const handleSubmit = (e) => {
        e.preventDefault();
        onSuccess("Document uploaded successfully");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload Document">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-paper-300 rounded-lg p-8 text-center hover:bg-paper-50 transition-colors cursor-pointer">
                    <Upload className="w-12 h-12 text-paper-400 mx-auto mb-2" />
                    <p className="text-ink-600 font-medium">Click to upload or drag and drop</p>
                    <p className="text-ink-400 text-sm">PDF, JPG, PNG (max 10MB)</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Document Type</label>
                    <select className="w-full p-2 border border-paper-300 rounded-md">
                        <option>Lab Result</option>
                        <option>Imaging Report</option>
                        <option>Consult Note</option>
                        <option>Other</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md" style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'} onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}>Upload</button>
                </div>
            </form>
        </Modal>
    );
};
