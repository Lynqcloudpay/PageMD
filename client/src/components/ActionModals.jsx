import React, { useState, useEffect, useMemo } from 'react';
import Modal from './ui/Modal';
import { Pill, Stethoscope, Upload, Send, Search, X, ShoppingCart, Trash2, Plus, Check, ChevronRight } from 'lucide-react';
import { searchLabTests, searchImaging } from '../data/labCodes';
import { codesAPI, referralsAPI, eprescribeAPI } from '../services/api';

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

export const OrderModal = ({ isOpen, onClose, onSuccess, onSave, initialTab = 'labs', diagnoses = [], existingOrders = [], patientId = null, visitId = null }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [orderStep, setOrderStep] = useState(1); // 1: diagnosis selection, 2: ordering
    const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
    const [labVendor, setLabVendor] = useState('quest');
    const [referralReason, setReferralReason] = useState('');
    const [currentMed, setCurrentMed] = useState({ name: '', sig: '', dispense: '' });

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setActiveTab(initialTab);
            // Always start at diagnosis selection if diagnoses exist
            setOrderStep(diagnoses.length > 0 ? 1 : 2);
            setSelectedDiagnosis(diagnoses.length === 1 ? diagnoses[0] : '');

            // Populate cart from existing orders
            const initialCart = [];
            if (existingOrders && existingOrders.length > 0) {
                existingOrders.forEach(group => {
                    const dx = group.diagnosis;
                    if (group.orders) {
                        group.orders.forEach(orderStr => {
                            // Parse order string to determine type and content
                            let type = 'other';
                            let name = orderStr;
                            let details = {};
                            let sig = '';
                            let dispense = '';
                            let reason = '';

                            if (orderStr.startsWith('Lab: ')) {
                                type = 'labs';
                                name = orderStr.substring(5).split('[')[0].trim();
                            } else if (orderStr.startsWith('Imaging: ')) {
                                type = 'imaging';
                                name = orderStr.substring(9).split('[')[0].trim();
                            } else if (orderStr.startsWith('Procedure: ')) {
                                type = 'procedures';
                                name = orderStr.substring(11).split('[')[0].trim();
                            } else if (orderStr.startsWith('Referral: ')) {
                                type = 'referrals';
                                const parts = orderStr.substring(10).split(' - ');
                                name = parts[0].trim();
                                if (parts.length > 1) reason = parts[1].trim();
                            } else if (orderStr.startsWith('Prescription: ')) {
                                type = 'medications';
                                // Prescription: Name - Sig, Dispense: #
                                const match = orderStr.match(/Prescription: (.*?) - (.*?), Dispense: (.*)/);
                                if (match) {
                                    name = match[1].trim();
                                    sig = match[2].trim();
                                    dispense = match[3].trim();
                                } else {
                                    name = orderStr.substring(14).trim();
                                }
                            }

                            initialCart.push({
                                id: Date.now() + Math.random(),
                                type,
                                name,
                                details,
                                diagnosis: dx,
                                sig,
                                dispense,
                                reason,
                                originalString: orderStr // Keep original for reference
                            });
                        });
                    }
                });
            }
            setCart(initialCart);
        }
    }, [isOpen, initialTab, diagnoses, existingOrders]);

    // Group cart by diagnosis
    const groupedCart = useMemo(() => {
        const groups = {};
        cart.forEach(item => {
            const dx = item.diagnosis || 'Unassigned';
            if (!groups[dx]) groups[dx] = [];
            groups[dx].push(item);
        });
        return groups;
    }, [cart]);

    // Search Logic
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.toLowerCase();
        let results = [];

        switch (activeTab) {
            case 'labs':
                results = searchLabTests(query).slice(0, 20);
                break;
            case 'imaging':
                results = searchImaging(query).slice(0, 20);
                break;
            case 'procedures':
                // Expanded list of common clinical procedures
                const commonProcs = [
                    { name: '93000 - EKG (12-Lead)', cpt: '93000' },
                    { name: '94010 - Spirometry', cpt: '94010' },
                    { name: '11100 - Skin Biopsy', cpt: '11100' },
                    { name: '20610 - Joint Injection (Major)', cpt: '20610' },
                    { name: '69210 - Ear Wax Removal (Cerumen)', cpt: '69210' },
                    { name: '10060 - I&D (Simple)', cpt: '10060' },
                    { name: '88141 - Pap Smear', cpt: '88141' },
                    { name: '81002 - Urinalysis (Non-automated)', cpt: '81002' },
                    { name: '81025 - Pregnancy Test (Urine)', cpt: '81025' },
                    { name: '87880 - Rapid Strep Test', cpt: '87880' },
                    { name: '87804 - Influenza A&B', cpt: '87804' },
                    { name: '90471 - Immunization Admin', cpt: '90471' },
                    { name: '99213 - Evaluation/Management', cpt: '99213' },
                    { name: '96372 - Therapeutic Injection (IM)', cpt: '96372' },
                    { name: 'G0439 - AWV (Subsequent)', cpt: 'G0439' }
                ];
                results = commonProcs.filter(p => p.name.toLowerCase().includes(query) || p.cpt?.includes(query));
                break;
            case 'referrals':
                const specialties = [
                    'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Hematology',
                    'Infectious Disease', 'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology',
                    'Orthopedic Surgery', 'Otolaryngology (ENT)', 'Pain Management', 'Physical Therapy',
                    'Podiatry', 'Psychiatry', 'Pulmonology', 'Rheumatology', 'Sleep Medicine',
                    'Sports Medicine', 'Urology', 'Vascular Surgery', 'General Surgery', 'OB/GYN'
                ];
                results = specialties.filter(s => s.toLowerCase().includes(query)).map(s => ({ name: s }));
                break;
            case 'medications':
                // Rely on user typing for now, or mock
                // In a real app, this would hit medicationsAPI.search(query)
                // For now, allow adding whatever they type via the "Add custom" button if no results
                results = []; // handled by API usually
                break;
            default:
                break;
        }
        setSearchResults(results);
    }, [searchQuery, activeTab]);

    const addToCart = (item) => {
        const newItem = {
            id: Date.now() + Math.random(),
            type: activeTab,
            name: item.name,
            details: item,
            diagnosis: selectedDiagnosis,
            // Referral specific
            reason: activeTab === 'referrals' ? referralReason : '',
            // Med specific
            sig: activeTab === 'medications' ? currentMed.sig : '',
            dispense: activeTab === 'medications' ? currentMed.dispense : ''
        };

        setCart([...cart, newItem]);
        setSearchQuery('');
        setReferralReason('');
        setCurrentMed({ name: '', sig: '', dispense: '' });
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateCartItemDx = (id, dx) => {
        setCart(cart.map(item => item.id === id ? { ...item, diagnosis: dx } : item));
    };

    const handleBatchSubmit = () => {
        if (onSave) {
            // Group cart items by diagnosis to reconstruct structured plan
            const newPlanStructured = [];
            const grouped = {};

            // Initialize groups with diagnoses that have existing orders or new ones
            // We want to preserve the order of diagnoses if possible, or just append

            cart.forEach(item => {
                const dx = item.diagnosis || 'Unassigned';
                if (!grouped[dx]) grouped[dx] = [];

                let orderText = '';
                // If we parsed it from existing, we might have originalString. 
                // However, user might have EDITED it (though we don't support inline edit yet, just delete/add).
                // Re-generate string to be safe and consistent.

                if (item.type === 'labs') {
                    const code = item.details?.questCode || item.details?.labcorpCode; // Might be missing if loaded from string
                    const company = labVendor === 'quest' ? 'Quest' : 'LabCorp';
                    // If we have details, use them. If not, use name (loaded from string)
                    if (item.originalString && !item.details?.questCode) {
                        orderText = item.originalString; // Preserve original if we didn't fully parse details
                    } else {
                        orderText = `Lab: ${item.name} [${company}: ${code || 'N/A'}]`;
                    }
                } else if (item.type === 'imaging') {
                    if (item.originalString && !item.details?.cpt) {
                        orderText = item.originalString;
                    } else {
                        orderText = `Imaging: ${item.name}${item.details?.cpt ? ` [CPT: ${item.details.cpt}]` : ''}`;
                    }
                } else if (item.type === 'procedures') {
                    if (item.originalString && !item.details?.cpt) {
                        orderText = item.originalString;
                    } else {
                        orderText = `Procedure: ${item.name}${item.details?.cpt ? ` [CPT: ${item.details.cpt}]` : ''}`;
                    }
                } else if (item.type === 'referrals') {
                    orderText = `Referral: ${item.name}${item.reason ? ` - ${item.reason}` : ''}`;
                } else if (item.type === 'medications') {
                    orderText = `Prescription: ${item.name} - ${item.sig}, Dispense: ${item.dispense}`;
                } else {
                    orderText = item.name;
                }

                grouped[dx].push(orderText);
            });

            // Convert to array format expected by planStructured
            Object.keys(grouped).forEach(dx => {
                newPlanStructured.push({
                    diagnosis: dx,
                    orders: grouped[dx]
                });
            });

            onSave(newPlanStructured);

            // Save referrals and prescriptions to database for tracking
            if (patientId) {
                cart.forEach(async (item) => {
                    try {
                        if (item.type === 'referrals' && !item.originalString) {
                            // Only save new referrals (not ones loaded from existing orders)
                            await referralsAPI.create({
                                patientId,
                                visitId,
                                recipientName: item.name,
                                specialty: item.name,
                                reason: item.reason || item.diagnosis || '',
                                status: 'sent',
                                notes: `Linked to: ${item.diagnosis || 'General'}`
                            });
                        }
                        if (item.type === 'medications' && !item.originalString) {
                            // Only save new prescriptions (not ones loaded from existing orders)
                            await eprescribeAPI.createDraft(patientId, {
                                drugName: item.name,
                                dosage: item.sig,
                                dispense: item.dispense,
                                diagnosis: item.diagnosis || 'General',
                                dateWritten: new Date().toISOString()
                            });
                        }
                    } catch (error) {
                        console.error('Error saving to database:', error);
                    }
                });
            }
        } else {
            // Fallback for older usage
            cart.forEach(item => {
                let orderText = ''; // ... (same generation logic)
                // ... logic to call onSuccess
                // For brevity, assuming onSave is used now.
                if (item.type === 'labs') {
                    const code = labVendor === 'quest' ? item.details?.questCode : item.details?.labcorpCode;
                    const company = labVendor === 'quest' ? 'Quest' : 'LabCorp';
                    orderText = `Lab: ${item.name} [${company}: ${code || 'N/A'}]`;
                } else if (item.type === 'imaging') {
                    orderText = `Imaging: ${item.name}${item.details?.cpt ? ` [CPT: ${item.details.cpt}]` : ''}`;
                } else if (item.type === 'procedures') {
                    orderText = `Procedure: ${item.name}${item.details?.cpt ? ` [CPT: ${item.details.cpt}]` : ''}`;
                } else if (item.type === 'referrals') {
                    orderText = `Referral: ${item.name}${item.reason ? ` - ${item.reason}` : ''}`;
                } else if (item.type === 'medications') {
                    orderText = `Prescription: ${item.name} - ${item.sig}, Dispense: ${item.dispense}`;
                }

                if (item.diagnosis && item.diagnosis !== 'None') {
                    onSuccess(item.diagnosis, orderText);
                } else {
                    onSuccess(diagnoses[0] || 'General', orderText);
                }
            });
        }
        onClose();
    };

    // Sub-component for search result item
    const SearchResultItem = ({ item }) => (
        <button
            type="button"
            onClick={() => addToCart(item)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center group transition-colors"
        >
            <div>
                <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                    {activeTab === 'labs' && (
                        <span>
                            {labVendor === 'quest' ? `Quest: ${item.questCode}` : `LabCorp: ${item.labcorpCode}`}
                            {item.cpt && ` • CPT: ${item.cpt}`}
                        </span>
                    )}
                    {(activeTab === 'imaging' || activeTab === 'procedures') && item.cpt && (
                        <span>CPT: {item.cpt}</span>
                    )}
                </div>
            </div>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Order Entry" size="xl">
            <div className="flex flex-col h-[600px] overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    <div className="flex-1 flex overflow-x-auto">
                        {['Labs', 'Imaging', 'Procedures', 'Referrals', 'Medications'].map(tab => {
                            const id = tab.toLowerCase();
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`px-6 py-3 text-sm font-medium transition-colors border-r border-gray-200 whitespace-nowrap ${activeTab === id
                                        ? 'bg-white text-primary-600 border-t-2 border-t-primary-600'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Diagnosis Selector - Compact dropdown at top */}
                {diagnoses.length > 0 && (
                    <div className="p-3 bg-blue-50 border-b border-blue-200">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Select Diagnosis for Orders:</label>
                        <select
                            value={selectedDiagnosis}
                            onChange={(e) => setSelectedDiagnosis(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">-- Select Diagnosis --</option>
                            {diagnoses.map((dx, idx) => (
                                <option key={idx} value={dx}>{dx}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column: Search & Browse */}
                    <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
                        <div className="p-4 border-b border-gray-100">
                            {/* Vendor Toggle for Labs */}
                            {activeTab === 'labs' && (
                                <div className="flex rounded-md shadow-sm mb-3">
                                    <button
                                        onClick={() => setLabVendor('quest')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-l-md border ${labVendor === 'quest' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-200'}`}
                                    >
                                        Quest
                                    </button>
                                    <button
                                        onClick={() => setLabVendor('labcorp')}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-r-md border-t border-b border-r ${labVendor === 'labcorp' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-200'}`}
                                    >
                                        LabCorp
                                    </button>
                                </div>
                            )}

                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeTab}...`}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Search Results */}
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'medications' ? (
                                <div className="p-4 space-y-4">
                                    <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700 mb-4">
                                        Use e-Prescribe for simpler workflows. Use this form to manually document prescriptions.
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Medication Name</label>
                                            <input
                                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                                value={currentMed.name}
                                                onChange={e => setCurrentMed({ ...currentMed, name: e.target.value })}
                                                placeholder="e.g. Lisinopril 10mg"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Sig</label>
                                                <input
                                                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                                    value={currentMed.sig}
                                                    onChange={e => setCurrentMed({ ...currentMed, sig: e.target.value })}
                                                    placeholder="e.g. 1 tab PO daily"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Dispense</label>
                                                <input
                                                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                                    value={currentMed.dispense}
                                                    onChange={e => setCurrentMed({ ...currentMed, dispense: e.target.value })}
                                                    placeholder="e.g. 30"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            disabled={!currentMed.name || !currentMed.sig}
                                            onClick={() => addToCart({ name: currentMed.name })}
                                            className="w-full py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                        >
                                            Add Medication
                                        </button>
                                    </div>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {searchResults.map((item, idx) => (
                                        <SearchResultItem key={idx} item={item} />
                                    ))}
                                </div>
                            ) : searchQuery.length > 2 ? (
                                <div className="p-8 text-center">
                                    <p className="text-gray-500 text-sm">No results found.</p>
                                    <button
                                        onClick={() => addToCart({ name: searchQuery })}
                                        className="mt-2 text-primary-600 text-sm hover:underline"
                                    >
                                        Add "{searchQuery}" as custom order
                                    </button>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    Start typing to search {activeTab}...
                                </div>
                            )}
                        </div>

                        {/* Referral Extras */}
                        {activeTab === 'referrals' && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Referral Reason (optional)</label>
                                <input
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2"
                                    placeholder="e.g. Evaluate and Treat"
                                    value={referralReason}
                                    onChange={e => setReferralReason(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Column: Cart */}
                    <div className="w-1/2 flex flex-col bg-gray-50/50">
                        <div className="p-4 bg-white border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 text-primary-600" />
                                Pending Orders ({cart.length})
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                    <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm">Your cart is empty</p>
                                </div>
                            ) : (
                                Object.entries(groupedCart).map(([diagnosis, items]) => (
                                    <div key={diagnosis} className="space-y-3">
                                        <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                                            <h4 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                                {diagnosis === 'Unassigned' ? 'Unassigned Diagnosis' : diagnosis}
                                            </h4>
                                            <span className="text-[10px] text-gray-300 font-normal">({items.length})</span>
                                        </div>
                                        <div className="space-y-3">
                                            {items.map((item) => (
                                                <div key={item.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 group hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${item.type === 'labs' ? 'bg-purple-100 text-purple-700' :
                                                                    item.type === 'imaging' ? 'bg-blue-100 text-blue-700' :
                                                                        item.type === 'medications' ? 'bg-green-100 text-green-700' :
                                                                            'bg-orange-100 text-orange-700'
                                                                    }`}>{item.type}</span>
                                                                <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                                                            </div>
                                                            {item.type === 'medications' && (
                                                                <div className="text-xs text-gray-500 mt-0.5 ml-1">
                                                                    {item.sig} • #{item.dispense}
                                                                </div>
                                                            )}
                                                            {item.type === 'referrals' && item.reason && (
                                                                <div className="text-xs text-gray-500 mt-0.5 ml-1">
                                                                    Reason: {item.reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-2 bg-gray-50 p-2 rounded text-xs border border-gray-100">
                                                        <span className="text-gray-400 font-medium whitespace-nowrap">Dx:</span>
                                                        <select
                                                            value={item.diagnosis}
                                                            onChange={(e) => updateCartItemDx(item.id, e.target.value)}
                                                            className="w-full bg-transparent border-0 focus:ring-0 text-gray-700 py-0 px-0 cursor-pointer"
                                                        >
                                                            <option value="">-- Unassigned --</option>
                                                            {diagnoses.map((dx, idx) => (
                                                                <option key={idx} value={dx}>{dx}</option>
                                                            ))}
                                                            <option value="General">General / Routine</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBatchSubmit}
                                disabled={cart.length === 0}
                                className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Sign & Submit ({cart.length})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal >
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
