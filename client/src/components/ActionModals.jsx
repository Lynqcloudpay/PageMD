import React, { useState, useEffect, useMemo } from 'react';
import Modal from './ui/Modal';
import { Pill, Stethoscope, Upload, Send, Search, X, ShoppingCart, Trash2, Plus, Check, ChevronRight, RotateCcw, ClipboardList, Link, ChevronDown } from 'lucide-react';
import { searchLabTests, searchImaging } from '../data/labCodes';
import axios from 'axios';
import { codesAPI, referralsAPI, eprescribeAPI, medicationsAPI, ordersCatalogAPI, ordersetsAPI, patientsAPI, icd10API } from '../services/api';

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

export const OrderModal = ({ isOpen, onClose, onSuccess, onSave, initialTab = 'labs', diagnoses = [], existingOrders = [], patientId = null, visitId = null, initialMedications = null }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    // Removed orderStep state
    const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
    const [isDiagnosisDropdownOpen, setIsDiagnosisDropdownOpen] = useState(false);
    const [isAddingNewDiagnosis, setIsAddingNewDiagnosis] = useState(false);

    // State for editing cart group diagnoses
    const [editingGroupDx, setEditingGroupDx] = useState(null);
    const [groupDxSearch, setGroupDxSearch] = useState('');
    const [groupDxResults, setGroupDxResults] = useState([]);
    const [labVendor, setLabVendor] = useState('quest');
    const [referralReason, setReferralReason] = useState('');
    const [currentMed, setCurrentMed] = useState({ name: '', sig: '', dispense: '', refills: '0', note: '' });
    const [searchingMed, setSearchingMed] = useState(false);
    const [medResults, setMedResults] = useState([]);
    const [orderSets, setOrderSets] = useState([]);
    const [loadingOrderSets, setLoadingOrderSets] = useState(false);
    const [showSaveOrderSetModal, setShowSaveOrderSetModal] = useState(false);
    const [newOrderSetName, setNewOrderSetName] = useState('');

    const [activeMedications, setActiveMedications] = useState([]);
    const [loadingActiveMeds, setLoadingActiveMeds] = useState(false);

    // E-Prescribe Integration State
    const [rxMode, setRxMode] = useState('manual'); // 'manual' or 'electronic'
    const [selectedPharmacy, setSelectedPharmacy] = useState(null);
    const [pharmacySearch, setPharmacySearch] = useState('');
    const [pharmacyResults, setPharmacyResults] = useState([]);
    const [searchingPharmacies, setSearchingPharmacies] = useState(false);

    // Step 1: Diagnosis Selection State
    const [newICD10Search, setNewICD10Search] = useState('');
    const [newICD10Results, setNewICD10Results] = useState([]);

    // ICD-10 Search Effect for Group Editor
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (groupDxSearch.length >= 2) {
                try {
                    const response = await icd10API.search(groupDxSearch);
                    setGroupDxResults(response.data || []);
                } catch (error) {
                    setGroupDxResults([]);
                }
            } else {
                setGroupDxResults([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [groupDxSearch]);

    // ICD-10 Search Effect
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (newICD10Search.length >= 2) {
                try {
                    const response = await icd10API.search(newICD10Search);
                    setNewICD10Results(response.data || []);
                } catch (error) {
                    setNewICD10Results([]);
                }
            } else {
                setNewICD10Results([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [newICD10Search]);

    // Memoize diagnoses to prevent reset on parent re-renders
    const diagnosesString = useMemo(() => JSON.stringify(diagnoses), [diagnoses]);

    // Aggregate all available diagnoses including existing ones, the currently selected one (if new), and any attached to cart items
    const availableDiagnoses = useMemo(() => {
        const set = new Set(diagnoses);
        if (selectedDiagnosis && selectedDiagnosis !== 'new' && selectedDiagnosis !== 'Unassigned') {
            set.add(selectedDiagnosis);
        }
        cart.forEach(item => {
            if (item.diagnosis && item.diagnosis !== 'Unassigned') {
                set.add(item.diagnosis);
            }
        });
        return Array.from(set);
    }, [diagnoses, selectedDiagnosis, cart]);
    const existingOrdersString = useMemo(() => JSON.stringify(existingOrders), [existingOrders]);

    // Track if modal has been initialized to prevent resets
    const initializedRef = React.useRef(false);

    useEffect(() => {
        if (isOpen && activeTab === 'ordersets') {
            fetchOrderSets();
        }
        if (isOpen && activeTab === 'medications' && patientId) {
            if (initialMedications && initialMedications.length > 0) {
                setActiveMedications(initialMedications);
                setLoadingActiveMeds(false);
            } else {
                setLoadingActiveMeds(true);
                patientsAPI.getMedications(patientId)
                    .then(res => {
                        setActiveMedications(res.data || []);
                    })
                    .catch(err => console.error('Error fetching active meds:', err))
                    .finally(() => setLoadingActiveMeds(false));
            }
        }
    }, [isOpen, activeTab, patientId, initialMedications]);

    const fetchOrderSets = async () => {
        setLoadingOrderSets(true);
        try {
            const response = await ordersetsAPI.getAll();
            setOrderSets(response.data || []);
        } catch (error) {
            console.error('Error fetching order sets:', error);
        } finally {
            setLoadingOrderSets(false);
        }
    };

    const applyOrderSet = (orderSet) => {
        if (!selectedDiagnosis && diagnoses.length > 1) {
            alert('Please select a diagnosis first to link these orders');
            return;
        }

        const diagnosis = selectedDiagnosis || diagnoses[0] || 'Unassigned';
        const newItems = orderSet.orders.map(order => {
            let type = 'other';
            // Map server types to frontend cart types
            if (order.type === 'lab') type = 'labs';
            else if (order.type === 'imaging') type = 'imaging';
            else if (order.type === 'procedure') type = 'procedures';
            else if (order.type === 'referral') type = 'referrals';
            else if (order.type === 'rx' || order.type === 'prescription') type = 'medications';

            return {
                id: Date.now() + Math.random(),
                type: type,
                name: order.payload.name || order.payload.medicationName || order.payload.recipientName || 'Unlabeled Order',
                details: order.payload,
                diagnosis: diagnosis,
                sig: order.payload.sig || '',
                dispense: order.payload.dispense || order.payload.quantity || '',
                reason: order.payload.reason || ''
            };
        });

        setCart([...cart, ...newItems]);
    };

    const saveCurrentAsOrderSet = async () => {
        if (!newOrderSetName.trim()) {
            alert('Please enter a name for the order set');
            return;
        }

        if (cart.length === 0) {
            alert('Your cart is empty. Add some orders first.');
            return;
        }

        try {
            const ordersToSave = cart.map(item => {
                let type = 'other';
                if (item.type === 'labs') type = 'lab';
                else if (item.type === 'imaging') type = 'imaging';
                else if (item.type === 'procedures') type = 'procedure';
                else if (item.type === 'referrals') type = 'referral';
                else if (item.type === 'medications') type = 'prescription';
                else type = 'procedure'; // Map unknown/other to generic procedure for backend compatibility

                return {
                    type,
                    payload: item.details || {
                        name: item.name,
                        sig: item.sig,
                        dispense: item.dispense,
                        reason: item.reason
                    }
                };
            });

            await ordersetsAPI.create({
                name: newOrderSetName,
                orders: ordersToSave,
                specialty: 'general',
                category: 'user-defined'
            });

            alert('Order set saved successfully!');
            setShowSaveOrderSetModal(false);
            setNewOrderSetName('');
            if (activeTab === 'ordersets') {
                fetchOrderSets();
            }
        } catch (error) {
            console.error('Error saving order set:', error);
            alert('Failed to save order set');
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setActiveTab(initialTab);

            // Default select first available diagnosis if none selected
            if (diagnoses.length > 0 && !selectedDiagnosis) {
                setSelectedDiagnosis(diagnoses[0]);
            }

            setIsDiagnosisDropdownOpen(false);
            setIsAddingNewDiagnosis(false);
            setNewICD10Search('');
            setNewICD10Results([]);

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

                            if (orderStr.startsWith('Lab: ') || orderStr.startsWith('Lab ')) {
                                type = 'labs';
                                name = orderStr.includes(': ') ? orderStr.substring(5).split('[')[0].trim() : orderStr.substring(4).trim();
                            } else if (orderStr.startsWith('Imaging: ') || orderStr.startsWith('Imaging ')) {
                                type = 'imaging';
                                name = orderStr.includes(': ') ? orderStr.substring(9).split('[')[0].trim() : orderStr.substring(8).trim();
                            } else if (orderStr.startsWith('Procedure: ') || orderStr.startsWith('Procedure ')) {
                                type = 'procedures';
                                name = orderStr.includes(': ') ? orderStr.substring(11).split('[')[0].trim() : orderStr.substring(10).trim();
                            } else if (orderStr.startsWith('Referral: ') || orderStr.startsWith('Referral ')) {
                                type = 'referrals';
                                const prefix = orderStr.includes(': ') ? 'Referral: ' : 'Referral ';
                                const parts = orderStr.substring(prefix.length).split(' - ');
                                name = parts[0].trim();
                                if (parts.length > 1) reason = parts[1].trim();
                            } else if (orderStr.startsWith('Prescription: ') || orderStr.startsWith('Prescription ')) {
                                type = 'medications';
                                const prefix = orderStr.includes(': ') ? 'Prescription: ' : 'Prescription ';
                                // Prescription: Name - Sig, Dispense: #
                                const safeOrderStr = typeof orderStr === 'string' ? orderStr : (typeof orderStr === 'object' ? JSON.stringify(orderStr) : String(orderStr));
                                const match = safeOrderStr.match(/(?:Prescription: |Prescription )(.*?) - (.*?), Dispense: (.*)/);
                                if (match) {
                                    name = match[1].trim();
                                    sig = match[2].trim();
                                    dispense = match[3].trim();
                                } else {
                                    name = safeOrderStr.substring(prefix.length).trim();
                                }
                            } else if (orderStr === 'Lab' || orderStr === 'Imaging' || orderStr === 'Procedure') {
                                // Handle edge case where only the header was captured
                                if (orderStr === 'Lab') type = 'labs';
                                else if (orderStr === 'Imaging') type = 'imaging';
                                else if (orderStr === 'Procedure') type = 'procedures';
                                name = `Unspecified ${orderStr}`;
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
            initializedRef.current = true;
        }

        // Reset initialized flag when modal closes
        if (!isOpen) {
            initializedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialTab]);

    // Group cart by diagnosis, then by type within each diagnosis
    const groupedCart = useMemo(() => {
        const typeOrder = ['labs', 'imaging', 'procedures', 'referrals', 'medications'];
        const byDiagnosis = {};

        cart.forEach(item => {
            const dx = item.diagnosis || 'Unassigned';
            if (!byDiagnosis[dx]) byDiagnosis[dx] = {};
            const type = item.type || 'other';
            if (!byDiagnosis[dx][type]) byDiagnosis[dx][type] = [];
            byDiagnosis[dx][type].push(item);
        });

        // Sort types within each diagnosis
        Object.keys(byDiagnosis).forEach(dx => {
            const orderedTypes = {};
            typeOrder.forEach(t => {
                if (byDiagnosis[dx][t]) orderedTypes[t] = byDiagnosis[dx][t];
            });
            Object.keys(byDiagnosis[dx]).forEach(t => {
                if (!orderedTypes[t]) orderedTypes[t] = byDiagnosis[dx][t];
            });
            byDiagnosis[dx] = orderedTypes;
        });

        return byDiagnosis;
    }, [cart]);

    const typeLabels = {
        labs: { label: 'L', color: 'bg-purple-500', textColor: 'text-purple-700' },
        imaging: { label: 'I', color: 'bg-blue-500', textColor: 'text-blue-700' },
        procedures: { label: 'P', color: 'bg-amber-500', textColor: 'text-amber-700' },
        referrals: { label: 'R', color: 'bg-orange-500', textColor: 'text-orange-700' },
        medications: { label: 'M', color: 'bg-green-500', textColor: 'text-green-700' },
        other: { label: 'O', color: 'bg-gray-500', textColor: 'text-gray-700' }
    };

    // Unified search logic
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setSearchResults([]);
            setMedResults([]);
            return;
        }

        if (activeTab === 'medications') {
            const searchTimer = setTimeout(async () => {
                setSearchingMed(true);
                try {
                    // Use backend proxy to avoid CORS and leverage robust server-side logic (OpenFDA + RxNorm + Fallback)
                    const response = await medicationsAPI.search(query);
                    setMedResults(response.data || []);
                } catch (e) {
                    console.error('Medication search error:', e);
                    setMedResults([]);
                } finally {
                    setSearchingMed(false);
                }
            }, 300);
            return () => clearTimeout(searchTimer);
        }

        let results = [];
        const lowerQuery = query.toLowerCase();

        // Use new orders catalog API for labs, imaging, procedures
        if (['labs', 'imaging', 'procedures'].includes(activeTab)) {
            const searchTimer = setTimeout(async () => {
                try {
                    const typeMap = { labs: 'LAB', imaging: 'IMAGING', procedures: 'PROCEDURE' };
                    const response = await ordersCatalogAPI.search(query, typeMap[activeTab]);
                    const catalogResults = (response.data || []).map(item => ({
                        name: item.name,
                        loinc: item.loinc_code,
                        category: item.category,
                        instructions: item.instructions,
                        catalogId: item.id
                    }));

                    // Merge with local data for backward compatibility
                    let localResults = [];
                    if (activeTab === 'labs') {
                        localResults = searchLabTests(lowerQuery, labVendor).slice(0, 10).map(t => ({
                            name: t.name,
                            questCode: t.questCode,
                            labcorpCode: t.labcorpCode,
                            description: t.description
                        }));
                    } else if (activeTab === 'imaging') {
                        localResults = searchImaging(lowerQuery).slice(0, 10).map(s => ({
                            name: s.name,
                            description: s.description
                        }));
                    }

                    // Combine: catalog first, then local (deduplicated)
                    const seenNames = new Set(catalogResults.map(r => r.name.toLowerCase()));
                    const combined = [...catalogResults, ...localResults.filter(r => !seenNames.has(r.name.toLowerCase()))];
                    setSearchResults(combined.slice(0, 25));
                } catch (err) {
                    console.error('Catalog search error:', err);
                    // Fallback to local data
                    if (activeTab === 'labs') {
                        setSearchResults(searchLabTests(lowerQuery, labVendor).slice(0, 20));
                    } else if (activeTab === 'imaging') {
                        setSearchResults(searchImaging(lowerQuery).slice(0, 20));
                    }
                }
            }, 300);
            return () => clearTimeout(searchTimer);
        }

        switch (activeTab) {
            case 'labs':
                results = searchLabTests(lowerQuery, labVendor).slice(0, 20);
                break;
            case 'imaging':
                results = searchImaging(lowerQuery).slice(0, 20);
                break;
            case 'procedures':
                // Procedures without CPT codes
                const commonProcs = [
                    { name: 'EKG (12-Lead)' },
                    { name: 'Spirometry' },
                    { name: 'Skin Biopsy' },
                    { name: 'Joint Injection (Major)' },
                    { name: 'Ear Wax Removal (Cerumen)' },
                    { name: 'I&D (Simple)' },
                    { name: 'Pap Smear' },
                    { name: 'Urinalysis (Non-automated)' },
                    { name: 'Pregnancy Test (Urine)' },
                    { name: 'Rapid Strep Test' },
                    { name: 'Influenza A&B' },
                    { name: 'Immunization Admin' },
                    { name: 'Therapeutic Injection (IM)' },
                    { name: 'Annual Wellness Visit' }
                ];
                results = commonProcs.filter(p => p.name.toLowerCase().includes(lowerQuery));
                break;
            case 'referrals':
                const specialties = [
                    'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 'Hematology',
                    'Infectious Disease', 'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology',
                    'Orthopedic Surgery', 'Otolaryngology (ENT)', 'Pain Management', 'Physical Therapy',
                    'Podiatry', 'Psychiatry', 'Pulmonology', 'Rheumatology', 'Sleep Medicine',
                    'Sports Medicine', 'Urology', 'Vascular Surgery', 'General Surgery', 'OB/GYN'
                ];
                results = specialties.filter(s => s.toLowerCase().includes(lowerQuery)).map(s => ({ name: s }));
                break;
            default:
                break;
        }
        setSearchResults(results);
    }, [searchQuery, activeTab, labVendor]);

    const addToCart = (item) => {
        const newItem = {
            ...item,
            id: Date.now() + Math.random(),
            type: activeTab,
            name: item.name,
            details: item,
            diagnosis: selectedDiagnosis,
            // Use item values if present, otherwise fallback to state
            reason: item.reason || (activeTab === 'referrals' ? referralReason : ''),
            sig: item.sig || (activeTab === 'medications' ? currentMed.sig : ''),
            dispense: item.dispense || (activeTab === 'medications' ? currentMed.dispense : ''),
            refills: item.refills || (activeTab === 'medications' ? currentMed.refills : ''),
            note: item.note || (activeTab === 'medications' ? currentMed.note : ''),
            pharmacy: activeTab === 'medications' && rxMode === 'electronic' ? selectedPharmacy : null,
            rxMode: activeTab === 'medications' ? rxMode : 'manual'
        };

        setCart([...cart, newItem]);
        setSearchQuery('');
        setReferralReason('');
        setCurrentMed({ name: '', sig: '', dispense: '', refills: '0', note: '' });
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateCartItemDx = (id, dx) => {
        setCart(cart.map(item => item.id === id ? { ...item, diagnosis: dx } : item));
    };

    const updateGroupDiagnosis = (oldDx, newDx) => {
        setCart(cart.map(item => item.diagnosis === oldDx ? { ...item, diagnosis: newDx } : item));
        setEditingGroupDx(null);
    };

    const handleBatchSubmit = async () => {
        if (onSave) {
            // Group cart items by diagnosis to reconstruct structured plan
            const newPlanStructured = [];
            const grouped = {};

            cart.forEach(item => {
                const dx = item.diagnosis || 'Unassigned';
                if (!grouped[dx]) grouped[dx] = [];

                let orderText = '';
                if (item.type === 'labs') {
                    orderText = item.originalString || `Lab: ${item.name}${item.loinc ? ` [${item.loinc}]` : ''}`;
                } else if (item.type === 'imaging') {
                    orderText = `Imaging: ${item.name}${item.loinc ? ` [${item.loinc}]` : ''}`;
                } else if (item.type === 'procedures') {
                    orderText = `Procedure: ${item.name}${item.loinc ? ` [${item.loinc}]` : ''}`;
                } else if (item.type === 'referrals') {
                    orderText = `Referral: ${item.name}${item.reason ? ` - ${item.reason}` : ''}`;
                } else if (item.type === 'medications') {
                    orderText = item.originalString || `Prescription: ${item.name} - ${item.sig}, Dispense: ${item.dispense}`;
                } else {
                    orderText = item.name;
                }
                grouped[dx].push(orderText);
            });

            // Create structured plan list
            Object.keys(grouped).forEach(dx => {
                newPlanStructured.push({
                    diagnosis: dx,
                    orders: grouped[dx]
                });
            });

            onSave(newPlanStructured);

            // Save specialized items to their dedicated APIs for tracking
            if (patientId) {
                // Use for...of to handle async properly and wait for completion
                for (const item of cart) {
                    if (item.originalString && !item.action) continue;

                    try {
                        if (item.type === 'referrals') {
                            await referralsAPI.create({
                                patientId,
                                visitId,
                                recipientName: item.name,
                                recipientSpecialty: item.name,
                                reason: item.reason || item.diagnosis || 'General Referral',
                                status: 'sent',
                                notes: `Linked to: ${item.diagnosis || 'General'}`,
                                diagnosisObjects: [{ problem_name: item.diagnosis || 'General' }]
                            });
                        }

                        if (item.type === 'medications') {
                            if (item.action === 'stop' && item.medicationId) {
                                await patientsAPI.updateMedication(item.medicationId, { active: false, status: 'discontinued', endDate: new Date().toISOString() });
                                continue;
                            }

                            if (item.action === 'continue') continue;

                            // 1. ALWAYS add to patient medication record first
                            if (!item.action || item.action === 'refill') {
                                try {
                                    console.log(`[OrderModal] Pushing NEW medication to patient record: ${item.name}`);
                                    const medRes = await patientsAPI.addMedication(patientId, {
                                        medicationName: item.name,
                                        dosage: item.dispense || '',
                                        frequency: item.sig || 'As directed',
                                        route: '',
                                        startDate: new Date().toISOString(),
                                        active: true,
                                        status: 'active'
                                    });
                                    console.log(`[OrderModal] Successfully added medication to record: ${item.name}`, medRes.data);
                                } catch (e) {
                                    console.error(`[OrderModal] Failed to sync medication ${item.name} to record:`, e);
                                    if (e.response?.data?.error) {
                                        alert(`Warning: Could not add ${item.name} to patient current medications list. Reason: ${e.response.data.error}`);
                                    }
                                }
                            }

                            // 2. Separately handle E-Rx Draft (don't let failure here block the record save)
                            try {
                                console.log(`[OrderModal] Attempting E-Rx draft creation for: ${item.name}`);
                                await eprescribeAPI.createDraft(patientId, {
                                    medicationName: item.name,
                                    medicationDisplay: item.name,
                                    sig: item.sig || 'As directed',
                                    quantity: parseInt(item.dispense) || 30,
                                    diagnosis: item.diagnosis || 'General',
                                    dateWritten: new Date().toISOString()
                                });
                                console.log(`[OrderModal] E-Rx draft created successfully for: ${item.name}`);
                            } catch (erxError) {
                                console.warn('[OrderModal] E-Rx draft creation failed (skipping):', erxError);
                            }
                        }

                        // 3. Persist catalog orders to visit_orders Table
                        if (['labs', 'imaging', 'procedures'].includes(item.type)) {
                            const catalogId = item.catalogId || item.details?.catalogId;
                            if (catalogId) {
                                try {
                                    await ordersCatalogAPI.createVisitOrder(visitId, {
                                        catalog_id: catalogId,
                                        patient_id: patientId,
                                        diagnosis_icd10_ids: [item.diagnosis || 'Unassigned'],
                                        priority: 'ROUTINE'
                                    });
                                } catch (orderErr) {
                                    console.error('[OrderModal] Failed to persist visit_order:', orderErr);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error saving ${item.type}:`, error);
                    }
                }

                // Trigger refresh in chart/snapshot AFTER all saves are done
                console.log('[OrderModal] Dispatching patient-data-updated event');
                window.dispatchEvent(new CustomEvent('patient-data-updated'));

                if (onSuccess) onSuccess();
                onClose();
            }
        } else {
            // Fallback for older usage
            cart.forEach(item => {
                let orderText = ''; // ... (same generation logic)
                // ... logic to call onSuccess
                // For brevity, assuming onSave is used now.
                if (item.type === 'labs') {
                    orderText = `Lab: ${item.name}`;
                } else if (item.type === 'imaging') {
                    orderText = `Imaging: ${item.name}`;
                } else if (item.type === 'procedures') {
                    orderText = `Procedure: ${item.name}`;
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

    // Sub-component for search result item - NO CPT CODES displayed
    const SearchResultItem = ({ item }) => (
        <button
            type="button"
            onClick={() => addToCart(item)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center group transition-colors"
        >
            <div>
                <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                    {activeTab === 'labs' && item.loinc && (
                        <span className="text-primary-600">LOINC: {item.loinc}</span>
                    )}
                    {item.category && <span className="text-gray-400">{item.category}</span>}
                    {item.description && <span>{item.description}</span>}
                </div>
            </div>
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Order Entry" size="2xl">
            <div className="flex flex-col h-[700px] overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    <div className="flex-1 flex overflow-x-auto">
                        {['Labs', 'Imaging', 'Procedures', 'Referrals', 'Medications', 'Order Sets'].map(tab => {
                            const id = tab.toLowerCase().replace(' ', '');
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

                {/* Diagnosis Selector - Custom Dropdown with Add New */}
                <div className="p-3 bg-blue-50 border-b border-blue-200 relative z-20">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Select Diagnosis for Orders:</label>

                    {!isAddingNewDiagnosis ? (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsDiagnosisDropdownOpen(!isDiagnosisDropdownOpen)}
                                className="w-full text-left p-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 flex justify-between items-center shadow-sm"
                            >
                                <span className={!selectedDiagnosis ? 'text-gray-400' : 'text-gray-900 font-medium'}>
                                    {selectedDiagnosis || '-- Select Diagnosis --'}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isDiagnosisDropdownOpen ? 'rotate-90' : ''}`} />
                            </button>

                            {isDiagnosisDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
                                    {availableDiagnoses.length > 0 && availableDiagnoses.map((dx, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDiagnosis(dx);
                                                setIsDiagnosisDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-800 border-b border-gray-50 last:border-0"
                                        >
                                            {dx}
                                        </button>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddingNewDiagnosis(true);
                                            setIsDiagnosisDropdownOpen(false);
                                            // Reset search
                                            setNewICD10Search('');
                                            setNewICD10Results([]);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-primary-50 text-sm text-primary-700 font-bold bg-gray-50 flex items-center gap-2 sticky bottom-0"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add New Diagnosis...
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-top-1 bg-white p-2 rounded-md border border-primary-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-primary-700 uppercase">Search ICD-10 Code</label>
                                <button
                                    onClick={() => {
                                        setIsAddingNewDiagnosis(false);
                                        setNewICD10Search('');
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    className="w-full pl-9 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="Type code or description (e.g. I10, Hypertension)..."
                                    value={newICD10Search}
                                    onChange={e => setNewICD10Search(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {newICD10Results.length > 0 && (
                                <div className="mt-2 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                                    {newICD10Results.map((result, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                const dxString = `${result.code} - ${result.description}`;
                                                setSelectedDiagnosis(dxString);
                                                setIsAddingNewDiagnosis(false);
                                                setNewICD10Search('');
                                                setNewICD10Results([]);
                                            }}
                                            className="w-full text-left p-2 hover:bg-primary-50 border-b border-gray-100 last:border-0 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-primary-700 text-xs bg-primary-50 px-1.5 py-0.5 rounded">{result.code}</span>
                                                <span className="text-gray-700 text-xs">{result.description}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!newICD10Results.length && newICD10Search.length > 2 && (
                                <button
                                    onClick={() => {
                                        setSelectedDiagnosis(newICD10Search);
                                        setIsAddingNewDiagnosis(false);
                                        setNewICD10Search('');
                                    }}
                                    className="mt-2 w-full py-1.5 bg-primary-600 text-white rounded text-xs font-bold hover:bg-primary-700 shadow-sm transition-colors"
                                >
                                    Use "{newICD10Search}"
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column: Search & Browse */}
                    <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
                        <div className="p-4 border-b border-gray-100">

                            {/* Search Input - hide for medications tab which has its own search */}
                            {activeTab !== 'medications' && (
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
                            )}
                        </div>

                        {/* Search Results / Browse Content */}
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'ordersets' ? (
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">My Order Sets</h3>
                                        <button
                                            onClick={fetchOrderSets}
                                            className="text-primary-600 hover:text-primary-700 p-1"
                                            title="Refresh"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {loadingOrderSets ? (
                                        <div className="text-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                                            <p className="text-gray-500 text-xs mt-2">Loading sets...</p>
                                        </div>
                                    ) : orderSets.length > 0 ? (
                                        <div className="space-y-3">
                                            {orderSets.map(set => (
                                                <div key={set.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden hover:border-primary-300 transition-colors shadow-sm">
                                                    <div className="p-3 bg-gray-50/50 flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 text-sm">{set.name}</h4>
                                                            <p className="text-[10px] text-gray-500 line-clamp-1">{set.description || 'No description'}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => applyOrderSet(set)}
                                                            className="px-2 py-1 bg-primary-600 text-white text-[10px] font-bold rounded hover:bg-primary-700 shadow-sm"
                                                        >
                                                            Add Set
                                                        </button>
                                                    </div>
                                                    <div className="p-2 border-t border-gray-100 flex flex-wrap gap-1">
                                                        {set.orders.slice(0, 5).map((order, i) => (
                                                            <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                                {order.type.toUpperCase()}: {(order.payload.name || order.payload.medicationName || '...').substring(0, 15)}
                                                            </span>
                                                        ))}
                                                        {set.orders.length > 5 && (
                                                            <span className="text-[9px] text-gray-400 px-1.5 py-0.5">+{set.orders.length - 5} more</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-lg">
                                            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-gray-500 text-sm">No order sets found.</p>
                                            <p className="text-gray-400 text-xs mt-1">Add items to your cart and click "Save as Set" to create one.</p>
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === 'medications' ? (
                                <div className="p-4 space-y-4 overflow-y-auto">
                                    {/* Rx Mode Toggle */}
                                    <div className="flex p-1 bg-gray-100 rounded-lg">
                                        <button
                                            onClick={() => setRxMode('manual')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${rxMode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Prescribe Rx
                                        </button>
                                        <button
                                            onClick={() => setRxMode('electronic')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${rxMode === 'electronic' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            E-Prescribe
                                        </button>
                                    </div>

                                    {rxMode === 'electronic' && (
                                        <div className="space-y-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                            <label className="block text-xs font-bold text-blue-700 uppercase flex justify-between">
                                                <span>Target Pharmacy</span>
                                                <span className="text-blue-400 font-normal">Required for E-Rx</span>
                                            </label>
                                            {!selectedPharmacy ? (
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
                                                    <input
                                                        className="w-full pl-8 p-2 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                                                        placeholder="Search Pharmacy (e.g. CVS Miami)..."
                                                        value={pharmacySearch}
                                                        onChange={(e) => {
                                                            setPharmacySearch(e.target.value);
                                                            if (e.target.value.length > 2) {
                                                                setSearchingPharmacies(true);
                                                                eprescribeAPI.searchPharmacies(e.target.value)
                                                                    .then(res => setPharmacyResults(res.data || []))
                                                                    .catch(() => setPharmacyResults([]))
                                                                    .finally(() => setSearchingPharmacies(false));
                                                            }
                                                        }}
                                                    />
                                                    {searchingPharmacies && <div className="absolute right-3 top-2.5 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                                                    {pharmacyResults.length > 0 && (
                                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto">
                                                            {pharmacyResults.map(ph => (
                                                                <button
                                                                    key={ph.id}
                                                                    onClick={() => {
                                                                        setSelectedPharmacy(ph);
                                                                        setPharmacyResults([]);
                                                                        setPharmacySearch('');
                                                                    }}
                                                                    className="w-full text-left p-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                                >
                                                                    <div className="font-bold text-gray-800">{ph.name}</div>
                                                                    <div className="text-gray-500">{ph.addressLine1}, {ph.city}</div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between bg-white p-2 border border-blue-200 rounded text-sm text-blue-800 shadow-sm">
                                                    <div>
                                                        <span className="font-bold block">{selectedPharmacy.name}</span>
                                                        <span className="text-xs text-blue-600 block">{selectedPharmacy.addressLine1}, {selectedPharmacy.city}</span>
                                                    </div>
                                                    <button onClick={() => setSelectedPharmacy(null)} className="text-gray-400 hover:text-red-500 p-1">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Medication Search */}
                                    {!currentMed.name ? (
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    className="w-full pl-9 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-sm"
                                                    placeholder="Search medication name..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    autoFocus
                                                />
                                                {searchingMed && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>}
                                            </div>

                                            {/* Search Results */}
                                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                                {medResults.length > 0 ? (
                                                    medResults.map((m, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setCurrentMed({
                                                                    name: m.name,
                                                                    sig: '',
                                                                    dispense: '30',
                                                                    refills: '0',
                                                                    note: ''
                                                                });
                                                                setSearchQuery('');
                                                                setMedResults([]);
                                                            }}
                                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary-50 border border-gray-100 hover:border-primary-200 transition-all text-left group shadow-sm hover:shadow"
                                                        >
                                                            <Pill className="w-5 h-5 text-primary-400 group-hover:text-primary-600 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                                                                    {(m.name || '')
                                                                        .replace(/&amp;/g, '&')
                                                                        .replace(/&#x2f;/gi, '/')
                                                                        .replace(/&#47;/g, '/')
                                                                        .replace(/&quot;/g, '"')
                                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                                </p>
                                                                {m.strength && <p className="text-xs text-gray-500 mt-0.5">{m.strength}</p>}
                                                            </div>
                                                            <div className="text-xs font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Select →
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : searchQuery.length > 2 && !searchingMed ? (
                                                    <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                                                        <p className="text-sm text-gray-500 mb-3">No matching medications found</p>
                                                        <button
                                                            onClick={() => {
                                                                setCurrentMed({
                                                                    name: searchQuery,
                                                                    sig: '',
                                                                    dispense: '30',
                                                                    refills: '0',
                                                                    note: ''
                                                                });
                                                                setSearchQuery('');
                                                            }}
                                                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                        >
                                                            Add "{searchQuery}" as custom medication
                                                        </button>
                                                    </div>
                                                ) : searchQuery.length === 0 ? (
                                                    <div className="p-6 text-center text-gray-400 text-sm">
                                                        <Pill className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                        <p>Type to search medications...</p>
                                                        <p className="text-xs mt-1">Results from RxNorm database</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : (
                                        /* Medication Detail Form */
                                        <div className="space-y-4 animate-in slide-in-from-top-2">
                                            <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg flex justify-between items-center text-primary-900">
                                                <span className="font-bold text-sm truncate">
                                                    {(currentMed.name || '')
                                                        .replace(/&amp;/g, '&')
                                                        .replace(/&#x2f;/gi, '/')
                                                        .replace(/&#47;/g, '/')
                                                        .replace(/&quot;/g, '"')
                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                </span>
                                                <button onClick={() => setCurrentMed({ name: '', sig: '', dispense: '30', refills: '0', note: '' })} className="p-1 hover:bg-white rounded-full transition-colors"><X className="w-4 h-4" /></button>
                                            </div>

                                            <div className="grid grid-cols-12 gap-3">
                                                <div className="col-span-8">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sig / Instructions</label>
                                                    <select
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                                                        value={currentMed.sig}
                                                        onChange={e => setCurrentMed({ ...currentMed, sig: e.target.value })}
                                                        autoFocus
                                                    >
                                                        <option value="">Select frequency...</option>
                                                        <option value="1 tab PO daily">1 tab PO daily (QD)</option>
                                                        <option value="1 tab PO BID">1 tab PO BID</option>
                                                        <option value="1 tab PO TID">1 tab PO TID</option>
                                                        <option value="1 tab PO QID">1 tab PO QID</option>
                                                        <option value="1 tab PO at bedtime">1 tab PO QHS</option>
                                                        <option value="1 tab PO PRN">1 tab PO PRN</option>
                                                        <option value="1 tab PO q6h">1 tab PO q6h</option>
                                                        <option value="1 tab PO q8h">1 tab PO q8h</option>
                                                        <option value="1 tab PO q12h">1 tab PO q12h</option>
                                                        <option value="2 tabs PO daily">2 tabs PO daily</option>
                                                        <option value="1/2 tab PO daily">1/2 tab PO daily</option>
                                                        <option value="As directed">As directed</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qty</label>
                                                    <input
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary-500"
                                                        value={currentMed.dispense}
                                                        onChange={e => setCurrentMed({ ...currentMed, dispense: e.target.value })}
                                                        placeholder="30"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Refills</label>
                                                    <select
                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                                                        value={currentMed.refills}
                                                        onChange={e => setCurrentMed({ ...currentMed, refills: e.target.value })}
                                                    >
                                                        {[0, 1, 2, 3, 5, 11].map(r => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <button
                                                disabled={!currentMed.sig}
                                                onClick={() => {
                                                    addToCart({
                                                        name: currentMed.name,
                                                        sig: currentMed.sig,
                                                        dispense: currentMed.dispense,
                                                        refills: currentMed.refills,
                                                        type: 'medications',
                                                        diagnosis: selectedDiagnosis,
                                                        pharmacy: rxMode === 'electronic' ? selectedPharmacy : null,
                                                        rxMode: rxMode
                                                    });
                                                    setCurrentMed({ name: '', sig: '', dispense: '30', refills: '0', note: '' });
                                                }}
                                                className="w-full py-2.5 bg-primary-600 text-white rounded-md text-sm font-bold shadow-md hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Add to Order
                                            </button>
                                        </div>
                                    )}
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

                    {/* Right Column: Home Meds + Cart */}
                    <div className="w-1/2 flex flex-col bg-gray-50/50">
                        {/* Home Medications Section - Only show on medications tab */}
                        {activeTab === 'medications' && activeMedications.length > 0 && (
                            <div className="border-b border-gray-200 bg-white">
                                <div className="p-3 border-b border-gray-100">
                                    <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                                        <Pill className="w-4 h-4 text-green-600" />
                                        Home Medications ({activeMedications.length})
                                    </h3>
                                </div>
                                <div className="max-h-[180px] overflow-y-auto p-2 space-y-1.5">
                                    {activeMedications.filter(m => m.active !== false).map(med => (
                                        <div key={med.id} className="bg-gray-50 p-2 rounded border border-gray-100 flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-xs text-gray-800 truncate">
                                                    {(med.medication_name || '')
                                                        .replace(/&amp;/g, '&')
                                                        .replace(/&#x2f;/gi, '/')
                                                        .replace(/&#47;/g, '/')
                                                        .replace(/&quot;/g, '"')
                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                </div>
                                                <div className="text-[10px] text-gray-500">{med.frequency}</div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => addToCart({
                                                        name: med.medication_name,
                                                        sig: med.frequency,
                                                        type: 'medications',
                                                        diagnosis: selectedDiagnosis,
                                                        action: 'continue',
                                                        originalString: `Continue: ${med.medication_name} ${med.frequency}`
                                                    })}
                                                    className="px-1.5 py-1 text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                                                >
                                                    Continue
                                                </button>
                                                <button
                                                    onClick={() => addToCart({
                                                        name: med.medication_name,
                                                        sig: med.frequency,
                                                        dispense: '30',
                                                        type: 'medications',
                                                        diagnosis: selectedDiagnosis,
                                                        action: 'refill',
                                                        originalString: `Refill: ${med.medication_name} ${med.frequency}`
                                                    })}
                                                    className="px-1.5 py-1 text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                                                >
                                                    Refill
                                                </button>
                                                <button
                                                    onClick={() => addToCart({
                                                        name: med.medication_name,
                                                        sig: 'DISCONTINUE',
                                                        type: 'medications',
                                                        action: 'stop',
                                                        originalString: `Stop: ${med.medication_name}`
                                                    })}
                                                    className="px-1.5 py-1 text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100"
                                                >
                                                    Stop
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Orders */}
                        <div className="p-3 bg-white border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                                <ShoppingCart className="w-4 h-4 text-primary-600" />
                                Pending Orders ({cart.length})
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg py-8">
                                    <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm">Your cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {Object.entries(groupedCart).map(([diagnosis, typeGroups]) => {
                                        const isEditing = editingGroupDx === diagnosis;
                                        return (
                                            <div key={diagnosis} className="bg-white border border-gray-200 rounded-lg overflow-visible relative"> {/* Changed overflow-hidden to overflow-visible for dropdown */}
                                                <div
                                                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => {
                                                        setEditingGroupDx(isEditing ? null : diagnosis);
                                                        setGroupDxSearch('');
                                                        setGroupDxResults([]);
                                                    }}
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                                                    <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-wide flex-1 truncate">
                                                        {diagnosis === 'Unassigned' ? 'No Diagnosis' : diagnosis.substring(0, 35)}
                                                    </h4>
                                                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isEditing ? 'rotate-180' : ''}`} />
                                                </div>

                                                {isEditing && (
                                                    <div className="absolute top-9 left-0 right-0 z-30 bg-white border border-gray-200 shadow-xl rounded-b-lg p-2 animate-in fade-in zoom-in-95 duration-100 origin-top">
                                                        <div className="max-h-32 overflow-y-auto mb-2 space-y-1">
                                                            <label className="text-[10px] uppercase font-bold text-gray-400 px-1">Switch to existing:</label>
                                                            {availableDiagnoses.filter(d => d !== diagnosis).map(dx => (
                                                                <button
                                                                    key={dx}
                                                                    onClick={() => updateGroupDiagnosis(diagnosis, dx)}
                                                                    className="block w-full text-left text-xs p-1.5 rounded hover:bg-blue-50 text-gray-700 truncate"
                                                                >
                                                                    {dx}
                                                                </button>
                                                            ))}
                                                            {availableDiagnoses.length === 0 && <p className="text-xs text-gray-300 italic px-1">No other diagnoses</p>}
                                                        </div>

                                                        <div className="pt-2 border-t border-gray-100 bg-gray-50 p-2 -mx-2 -mb-2 rounded-b-lg">
                                                            <label className="text-[10px] uppercase font-bold text-primary-600 mb-1 block">Or Add New Diagnosis:</label>
                                                            <input
                                                                placeholder="Search ICD-10 (e.g. Hypertension)..."
                                                                className="w-full text-xs p-1.5 border border-primary-200 rounded focus:ring-1 focus:ring-primary-500 mb-1"
                                                                value={groupDxSearch}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setGroupDxSearch(val);
                                                                }}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {groupDxResults.length > 0 && (
                                                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded bg-white mt-1 shadow-inner">
                                                                    {groupDxResults.map(res => (
                                                                        <button
                                                                            key={res.code}
                                                                            onClick={() => updateGroupDiagnosis(diagnosis, `${res.code} - ${res.description}`)}
                                                                            className="block w-full text-left text-xs p-1.5 hover:bg-primary-50 border-b border-gray-50 last:border-0"
                                                                        >
                                                                            <span className="font-bold text-primary-700">{res.code}</span> <span className="text-gray-600">{res.description}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {!groupDxResults.length && groupDxSearch.length > 2 && (
                                                                <button
                                                                    onClick={() => updateGroupDiagnosis(diagnosis, groupDxSearch)}
                                                                    className="mt-1 w-full text-center text-[10px] font-bold text-white bg-primary-600 py-1 rounded hover:bg-primary-700"
                                                                >
                                                                    Use "{groupDxSearch}"
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="p-1.5 space-y-0.5">
                                                    {Object.entries(typeGroups).map(([type, items]) => {
                                                        const typeInfo = typeLabels[type] || typeLabels.other;
                                                        return items.map((item) => (
                                                            <div key={item.id} className="group flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-gray-50 transition-colors">
                                                                <span className={`${typeInfo.color} text-white text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0`}>
                                                                    {typeInfo.label}
                                                                </span>
                                                                <span className="text-xs text-gray-700 flex-1 truncate">
                                                                    {(item.name || '')
                                                                        .replace(/&amp;/g, '&')
                                                                        .replace(/&#x2f;/gi, '/')
                                                                        .replace(/&#47;/g, '/')
                                                                        .replace(/&quot;/g, '"')
                                                                        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))}
                                                                </span>

                                                                {/* Diagnosis Re-linker */}
                                                                {availableDiagnoses.length > 0 && (
                                                                    <div className="relative flex items-center justify-center w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Link className="w-3 h-3 text-gray-400 hover:text-primary-600" />
                                                                        <select
                                                                            value={item.diagnosis || ''}
                                                                            onChange={(e) => updateCartItemDx(item.id, e.target.value)}
                                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                            title="Move to another diagnosis"
                                                                        >
                                                                            {availableDiagnoses.map(dx => (
                                                                                <option key={dx} value={dx}>{dx}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}

                                                                <button
                                                                    onClick={() => removeFromCart(item.id)}
                                                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ));
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-white border-t border-gray-200 flex flex-col gap-3">
                            {showSaveOrderSetModal ? (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Save current cart as order set</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter set name (e.g. Hypertension Protocol)"
                                            className="flex-1 p-2 text-sm border border-primary-300 rounded-md focus:ring-1 focus:ring-primary-500"
                                            value={newOrderSetName}
                                            onChange={e => setNewOrderSetName(e.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveCurrentAsOrderSet}
                                            className="px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-md hover:bg-primary-700"
                                        >
                                            Save Set
                                        </button>
                                        <button
                                            onClick={() => setShowSaveOrderSetModal(false)}
                                            className="px-2 py-2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center w-full">
                                    <button
                                        onClick={() => setShowSaveOrderSetModal(true)}
                                        disabled={cart.length === 0}
                                        className="text-primary-600 text-xs font-bold flex items-center gap-1 hover:underline disabled:opacity-30 disabled:grayscale"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Save as Set
                                    </button>
                                    <div className="flex gap-3">
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
                            )}
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
