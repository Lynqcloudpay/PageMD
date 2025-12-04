import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, AlertCircle, Pill, ClipboardList, Users, Heart, Save, ArrowLeft } from 'lucide-react';
import { patientsAPI } from '../services/api';
import Toast from './ui/Toast';
import { format } from 'date-fns';

const PatientDataManager = ({ patientId, isOpen, onClose, initialTab = 'problems', onUpdate, onBack }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [problems, setProblems] = useState([]);
    const [medications, setMedications] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [familyHistory, setFamilyHistory] = useState([]);
    const [socialHistory, setSocialHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [toast, setToast] = useState(null);
    
    // Form states
    const [problemForm, setProblemForm] = useState({ problemName: '', icd10Code: '', onsetDate: '', status: 'active' });
    const [medicationForm, setMedicationForm] = useState({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '', active: true });
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: '', onsetDate: '', active: true });
    const [familyHistoryForm, setFamilyHistoryForm] = useState({ condition: '', relationship: '', ageAtDiagnosis: '', ageAtDeath: '', notes: '' });
    const [socialHistoryForm, setSocialHistoryForm] = useState({
        smokingStatus: '', smokingPackYears: '', alcoholUse: '', alcoholQuantity: '',
        drugUse: '', exerciseFrequency: '', diet: '', occupation: '', livingSituation: '', notes: ''
    });

    useEffect(() => {
        if (isOpen && patientId) {
            setActiveTab(initialTab); // Set tab when opening
            fetchAllData();
        }
    }, [isOpen, patientId, initialTab]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [problemsRes, medicationsRes, allergiesRes, familyHistoryRes, socialHistoryRes] = await Promise.all([
                patientsAPI.getProblems(patientId),
                patientsAPI.getMedications(patientId),
                patientsAPI.getAllergies(patientId),
                patientsAPI.getFamilyHistory(patientId),
                patientsAPI.getSocialHistory(patientId)
            ]);

            setProblems(Array.isArray(problemsRes.data) ? problemsRes.data : []);
            setMedications(Array.isArray(medicationsRes.data) ? medicationsRes.data : []);
            setAllergies(Array.isArray(allergiesRes.data) ? allergiesRes.data : []);
            setFamilyHistory(Array.isArray(familyHistoryRes.data) ? familyHistoryRes.data : []);
            setSocialHistory(socialHistoryRes.data || null);
            
            if (socialHistoryRes.data) {
                setSocialHistoryForm({
                    smokingStatus: socialHistoryRes.data.smoking_status || '',
                    smokingPackYears: socialHistoryRes.data.smoking_pack_years || '',
                    alcoholUse: socialHistoryRes.data.alcohol_use || '',
                    alcoholQuantity: socialHistoryRes.data.alcohol_quantity || '',
                    drugUse: socialHistoryRes.data.drug_use || '',
                    exerciseFrequency: socialHistoryRes.data.exercise_frequency || '',
                    diet: socialHistoryRes.data.diet || '',
                    occupation: socialHistoryRes.data.occupation || '',
                    livingSituation: socialHistoryRes.data.living_situation || '',
                    notes: socialHistoryRes.data.notes || ''
                });
            }
        } catch (error) {
            console.error('Error fetching patient data:', error);
            showToast('Failed to load patient data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const triggerUpdate = () => {
        if (onUpdate) {
            onUpdate();
        }
    };

    // Problems
    const handleAddProblem = async () => {
        try {
            const response = await patientsAPI.addProblem(patientId, {
                problemName: problemForm.problemName,
                icd10Code: problemForm.icd10Code,
                onsetDate: problemForm.onsetDate || null
            });
            setProblems([response.data, ...problems]);
            setProblemForm({ problemName: '', icd10Code: '', onsetDate: '', status: 'active' });
            showToast('Problem added successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to add problem', 'error');
        }
    };

    const handleUpdateProblem = async (id) => {
        try {
            const response = await patientsAPI.updateProblem(id, problemForm);
            setProblems(problems.map(p => p.id === id ? response.data : p));
            setEditing(null);
            setProblemForm({ problemName: '', icd10Code: '', onsetDate: '', status: 'active' });
            showToast('Problem updated successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to update problem', 'error');
        }
    };

    const handleDeleteProblem = async (id) => {
        if (!window.confirm('Are you sure you want to delete this problem?')) return;
        try {
            await patientsAPI.deleteProblem(id);
            setProblems(problems.filter(p => p.id !== id));
            showToast('Problem deleted successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to delete problem', 'error');
        }
    };

    // Medications
    const handleAddMedication = async () => {
        try {
            const response = await patientsAPI.addMedication(patientId, {
                medicationName: medicationForm.medicationName,
                dosage: medicationForm.dosage,
                frequency: medicationForm.frequency,
                route: medicationForm.route,
                startDate: medicationForm.startDate || null
            });
            setMedications([response.data, ...medications]);
            setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '', active: true });
            showToast('Medication added successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to add medication', 'error');
        }
    };

    const handleUpdateMedication = async (id) => {
        try {
            const response = await patientsAPI.updateMedication(id, medicationForm);
            setMedications(medications.map(m => m.id === id ? response.data : m));
            setEditing(null);
            setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '', active: true });
            showToast('Medication updated successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to update medication', 'error');
        }
    };

    const handleDeleteMedication = async (id) => {
        if (!window.confirm('Are you sure you want to delete this medication?')) return;
        try {
            await patientsAPI.deleteMedication(id);
            setMedications(medications.filter(m => m.id !== id));
            showToast('Medication deleted successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to delete medication', 'error');
        }
    };

    // Allergies
    const handleAddAllergy = async () => {
        try {
            const response = await patientsAPI.addAllergy(patientId, {
                allergen: allergyForm.allergen,
                reaction: allergyForm.reaction,
                severity: allergyForm.severity,
                onsetDate: allergyForm.onsetDate || null
            });
            setAllergies([response.data, ...allergies]);
            setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '', active: true });
            showToast('Allergy added successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to add allergy', 'error');
        }
    };

    const handleUpdateAllergy = async (id) => {
        try {
            const response = await patientsAPI.updateAllergy(id, allergyForm);
            setAllergies(allergies.map(a => a.id === id ? response.data : a));
            setEditing(null);
            setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '', active: true });
            showToast('Allergy updated successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to update allergy', 'error');
        }
    };

    const handleDeleteAllergy = async (id) => {
        if (!window.confirm('Are you sure you want to delete this allergy?')) return;
        try {
            await patientsAPI.deleteAllergy(id);
            setAllergies(allergies.filter(a => a.id !== id));
            showToast('Allergy deleted successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to delete allergy', 'error');
        }
    };

    // Family History
    const handleAddFamilyHistory = async () => {
        try {
            const response = await patientsAPI.addFamilyHistory(patientId, {
                condition: familyHistoryForm.condition,
                relationship: familyHistoryForm.relationship,
                ageAtDiagnosis: familyHistoryForm.ageAtDiagnosis || null,
                ageAtDeath: familyHistoryForm.ageAtDeath || null,
                notes: familyHistoryForm.notes
            });
            setFamilyHistory([response.data, ...familyHistory]);
            setFamilyHistoryForm({ condition: '', relationship: '', ageAtDiagnosis: '', ageAtDeath: '', notes: '' });
            showToast('Family history added successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to add family history', 'error');
        }
    };

    const handleUpdateFamilyHistory = async (id) => {
        try {
            const response = await patientsAPI.updateFamilyHistory(id, familyHistoryForm);
            setFamilyHistory(familyHistory.map(fh => fh.id === id ? response.data : fh));
            setEditing(null);
            setFamilyHistoryForm({ condition: '', relationship: '', ageAtDiagnosis: '', ageAtDeath: '', notes: '' });
            showToast('Family history updated successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to update family history', 'error');
        }
    };

    const handleDeleteFamilyHistory = async (id) => {
        if (!window.confirm('Are you sure you want to delete this family history entry?')) return;
        try {
            await patientsAPI.deleteFamilyHistory(id);
            setFamilyHistory(familyHistory.filter(fh => fh.id !== id));
            showToast('Family history deleted successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to delete family history', 'error');
        }
    };

    // Social History
    const handleSaveSocialHistory = async () => {
        try {
            await patientsAPI.saveSocialHistory(patientId, socialHistoryForm);
            await fetchAllData();
            showToast('Social history saved successfully');
            triggerUpdate();
        } catch (error) {
            showToast('Failed to save social history', 'error');
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'problems', label: 'Problems', icon: ClipboardList },
        { id: 'medications', label: 'Medications', icon: Pill },
        { id: 'allergies', label: 'Allergies', icon: AlertCircle },
        { id: 'family', label: 'Family History', icon: Users },
        { id: 'social', label: 'Social History', icon: Heart }
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <div className="flex items-center space-x-3">
                        {onBack && (
                            <button 
                                onClick={onBack} 
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                                title="Back to Patient Chart"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h2 className="text-xl font-semibold text-gray-900">Patient Data Manager</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary-600 text-primary-700 bg-primary-50'
                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading...</div>
                    ) : (
                        <>
                            {/* Problems Tab */}
                            {activeTab === 'problems' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Problems List</h3>
                                        <button
                                            onClick={() => {
                                                setEditing('new-problem');
                                                setProblemForm({ problemName: '', icd10Code: '', onsetDate: '', status: 'active' });
                                            }}
                                            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Problem</span>
                                        </button>
                                    </div>

                                    {(editing === 'new-problem' || editing?.startsWith('problem-')) && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-3">
                                                {editing === 'new-problem' ? 'Add New Problem' : 'Edit Problem'}
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Problem Name *</label>
                                                    <input
                                                        type="text"
                                                        value={problemForm.problemName}
                                                        onChange={(e) => setProblemForm({ ...problemForm, problemName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        placeholder="e.g., Type 2 Diabetes"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Code</label>
                                                    <input
                                                        type="text"
                                                        value={problemForm.icd10Code}
                                                        onChange={(e) => setProblemForm({ ...problemForm, icd10Code: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        placeholder="e.g., E11.9"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
                                                        <input
                                                            type="date"
                                                            value={problemForm.onsetDate}
                                                            onChange={(e) => setProblemForm({ ...problemForm, onsetDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                                        <select
                                                            value={problemForm.status}
                                                            onChange={(e) => setProblemForm({ ...problemForm, status: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        >
                                                            <option value="active">Active</option>
                                                            <option value="resolved">Resolved</option>
                                                            <option value="inactive">Inactive</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            if (editing === 'new-problem') {
                                                                handleAddProblem();
                                                            } else {
                                                                handleUpdateProblem(editing.replace('problem-', ''));
                                                            }
                                                        }}
                                                        disabled={!problemForm.problemName}
                                                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                    >
                                                        <Save className="w-4 h-4 inline mr-1" />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditing(null);
                                                            setProblemForm({ problemName: '', icd10Code: '', onsetDate: '', status: 'active' });
                                                        }}
                                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {problems.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                                                No problems recorded
                                            </div>
                                        ) : (
                                            problems.map((problem) => (
                                                <div key={problem.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-900">{problem.problem_name}</div>
                                                        {problem.icd10_code && (
                                                            <div className="text-sm text-gray-600">ICD-10: {problem.icd10_code}</div>
                                                        )}
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Status: <span className={`font-medium ${
                                                                problem.status === 'active' ? 'text-red-600' :
                                                                problem.status === 'resolved' ? 'text-green-600' : 'text-gray-600'
                                                            }`}>{problem.status}</span>
                                                            {problem.onset_date && ` • Onset: ${format(new Date(problem.onset_date), 'MMM d, yyyy')}`}
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditing(`problem-${problem.id}`);
                                                                setProblemForm({
                                                                    problemName: problem.problem_name,
                                                                    icd10Code: problem.icd10_code || '',
                                                                    onsetDate: problem.onset_date ? format(new Date(problem.onset_date), 'yyyy-MM-dd') : '',
                                                                    status: problem.status
                                                                });
                                                            }}
                                                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProblem(problem.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Medications Tab - Similar structure */}
                            {activeTab === 'medications' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
                                        <button
                                            onClick={() => {
                                                setEditing('new-medication');
                                                setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '', active: true });
                                            }}
                                            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Medication</span>
                                        </button>
                                    </div>

                                    {(editing === 'new-medication' || editing?.startsWith('medication-')) && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-3">
                                                {editing === 'new-medication' ? 'Add New Medication' : 'Edit Medication'}
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                                                    <input
                                                        type="text"
                                                        value={medicationForm.medicationName}
                                                        onChange={(e) => setMedicationForm({ ...medicationForm, medicationName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                                                        <input
                                                            type="text"
                                                            value={medicationForm.dosage}
                                                            onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                            placeholder="e.g., 10mg"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                                        <input
                                                            type="text"
                                                            value={medicationForm.frequency}
                                                            onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                            placeholder="e.g., Once daily"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                                                        <input
                                                            type="text"
                                                            value={medicationForm.route}
                                                            onChange={(e) => setMedicationForm({ ...medicationForm, route: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                            placeholder="e.g., PO"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                        <input
                                                            type="date"
                                                            value={medicationForm.startDate}
                                                            onChange={(e) => setMedicationForm({ ...medicationForm, startDate: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            if (editing === 'new-medication') {
                                                                handleAddMedication();
                                                            } else {
                                                                handleUpdateMedication(editing.replace('medication-', ''));
                                                            }
                                                        }}
                                                        disabled={!medicationForm.medicationName}
                                                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                    >
                                                        <Save className="w-4 h-4 inline mr-1" />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditing(null);
                                                            setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '', active: true });
                                                        }}
                                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {medications.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                                                No medications recorded
                                            </div>
                                        ) : (
                                            medications.map((med) => (
                                                <div key={med.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-900">{med.medication_name}</div>
                                                        <div className="text-sm text-gray-600">
                                                            {med.dosage && `${med.dosage} `}
                                                            {med.frequency && `${med.frequency} `}
                                                            {med.route && `(${med.route})`}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {med.active ? <span className="text-green-600">Active</span> : <span className="text-gray-600">Inactive</span>}
                                                            {med.start_date && ` • Started: ${format(new Date(med.start_date), 'MMM d, yyyy')}`}
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditing(`medication-${med.id}`);
                                                                setMedicationForm({
                                                                    medicationName: med.medication_name,
                                                                    dosage: med.dosage || '',
                                                                    frequency: med.frequency || '',
                                                                    route: med.route || '',
                                                                    startDate: med.start_date ? format(new Date(med.start_date), 'yyyy-MM-dd') : '',
                                                                    active: med.active
                                                                });
                                                            }}
                                                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMedication(med.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Allergies Tab - Similar structure */}
                            {activeTab === 'allergies' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Allergies</h3>
                                        <button
                                            onClick={() => {
                                                setEditing('new-allergy');
                                                setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '', active: true });
                                            }}
                                            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Allergy</span>
                                        </button>
                                    </div>

                                    {(editing === 'new-allergy' || editing?.startsWith('allergy-')) && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-3">
                                                {editing === 'new-allergy' ? 'Add New Allergy' : 'Edit Allergy'}
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Allergen *</label>
                                                    <input
                                                        type="text"
                                                        value={allergyForm.allergen}
                                                        onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Reaction</label>
                                                        <input
                                                            type="text"
                                                            value={allergyForm.reaction}
                                                            onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                                                        <select
                                                            value={allergyForm.severity}
                                                            onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="mild">Mild</option>
                                                            <option value="moderate">Moderate</option>
                                                            <option value="severe">Severe</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
                                                    <input
                                                        type="date"
                                                        value={allergyForm.onsetDate}
                                                        onChange={(e) => setAllergyForm({ ...allergyForm, onsetDate: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    />
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            if (editing === 'new-allergy') {
                                                                handleAddAllergy();
                                                            } else {
                                                                handleUpdateAllergy(editing.replace('allergy-', ''));
                                                            }
                                                        }}
                                                        disabled={!allergyForm.allergen}
                                                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                    >
                                                        <Save className="w-4 h-4 inline mr-1" />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditing(null);
                                                            setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '', active: true });
                                                        }}
                                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {allergies.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                                                No allergies recorded
                                            </div>
                                        ) : (
                                            allergies.map((allergy) => (
                                                <div key={allergy.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-900">{allergy.allergen}</div>
                                                        {allergy.reaction && (
                                                            <div className="text-sm text-gray-600">Reaction: {allergy.reaction}</div>
                                                        )}
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {allergy.severity && `Severity: ${allergy.severity} • `}
                                                            {allergy.active ? <span className="text-red-600">Active</span> : <span className="text-gray-600">Inactive</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditing(`allergy-${allergy.id}`);
                                                                setAllergyForm({
                                                                    allergen: allergy.allergen,
                                                                    reaction: allergy.reaction || '',
                                                                    severity: allergy.severity || '',
                                                                    onsetDate: allergy.onset_date ? format(new Date(allergy.onset_date), 'yyyy-MM-dd') : '',
                                                                    active: allergy.active
                                                                });
                                                            }}
                                                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAllergy(allergy.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Family History Tab */}
                            {activeTab === 'family' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Family History</h3>
                                        <button
                                            onClick={() => {
                                                setEditing('new-family');
                                                setFamilyHistoryForm({ condition: '', relationship: '', ageAtDiagnosis: '', ageAtDeath: '', notes: '' });
                                            }}
                                            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Family History</span>
                                        </button>
                                    </div>

                                    {(editing === 'new-family' || editing?.startsWith('family-')) && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-3">
                                                {editing === 'new-family' ? 'Add Family History' : 'Edit Family History'}
                                            </h4>
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                                                        <input
                                                            type="text"
                                                            value={familyHistoryForm.condition}
                                                            onChange={(e) => setFamilyHistoryForm({ ...familyHistoryForm, condition: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                                                        <input
                                                            type="text"
                                                            value={familyHistoryForm.relationship}
                                                            onChange={(e) => setFamilyHistoryForm({ ...familyHistoryForm, relationship: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                            placeholder="e.g., Mother, Father"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Age at Diagnosis</label>
                                                        <input
                                                            type="number"
                                                            value={familyHistoryForm.ageAtDiagnosis}
                                                            onChange={(e) => setFamilyHistoryForm({ ...familyHistoryForm, ageAtDiagnosis: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Age at Death</label>
                                                        <input
                                                            type="number"
                                                            value={familyHistoryForm.ageAtDeath}
                                                            onChange={(e) => setFamilyHistoryForm({ ...familyHistoryForm, ageAtDeath: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                                    <textarea
                                                        value={familyHistoryForm.notes}
                                                        onChange={(e) => setFamilyHistoryForm({ ...familyHistoryForm, notes: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        rows="2"
                                                    />
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            if (editing === 'new-family') {
                                                                handleAddFamilyHistory();
                                                            } else {
                                                                handleUpdateFamilyHistory(editing.replace('family-', ''));
                                                            }
                                                        }}
                                                        disabled={!familyHistoryForm.condition || !familyHistoryForm.relationship}
                                                        className="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                    >
                                                        <Save className="w-4 h-4 inline mr-1" />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditing(null);
                                                            setFamilyHistoryForm({ condition: '', relationship: '', ageAtDiagnosis: '', ageAtDeath: '', notes: '' });
                                                        }}
                                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {familyHistory.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                                                No family history recorded
                                            </div>
                                        ) : (
                                            familyHistory.map((fh) => (
                                                <div key={fh.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-900">{fh.condition}</div>
                                                        <div className="text-sm text-gray-600">Relationship: {fh.relationship}</div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {fh.age_at_diagnosis && `Diagnosed at age ${fh.age_at_diagnosis} • `}
                                                            {fh.age_at_death && `Died at age ${fh.age_at_death}`}
                                                        </div>
                                                        {fh.notes && (
                                                            <div className="text-sm text-gray-600 mt-1">{fh.notes}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditing(`family-${fh.id}`);
                                                                setFamilyHistoryForm({
                                                                    condition: fh.condition,
                                                                    relationship: fh.relationship,
                                                                    ageAtDiagnosis: fh.age_at_diagnosis || '',
                                                                    ageAtDeath: fh.age_at_death || '',
                                                                    notes: fh.notes || ''
                                                                });
                                                            }}
                                                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFamilyHistory(fh.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Social History Tab */}
                            {activeTab === 'social' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Social History</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Smoking Status</label>
                                                <select
                                                    value={socialHistoryForm.smokingStatus}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, smokingStatus: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="never">Never</option>
                                                    <option value="former">Former</option>
                                                    <option value="current">Current</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Pack Years</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={socialHistoryForm.smokingPackYears}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, smokingPackYears: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Alcohol Use</label>
                                                <select
                                                    value={socialHistoryForm.alcoholUse}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, alcoholUse: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="none">None</option>
                                                    <option value="occasional">Occasional</option>
                                                    <option value="moderate">Moderate</option>
                                                    <option value="heavy">Heavy</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Alcohol Quantity</label>
                                                <input
                                                    type="text"
                                                    value={socialHistoryForm.alcoholQuantity}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, alcoholQuantity: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    placeholder="e.g., 1-2 drinks/week"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Use</label>
                                                <select
                                                    value={socialHistoryForm.drugUse}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, drugUse: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="none">None</option>
                                                    <option value="recreational">Recreational</option>
                                                    <option value="past">Past Use</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Frequency</label>
                                                <input
                                                    type="text"
                                                    value={socialHistoryForm.exerciseFrequency}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, exerciseFrequency: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    placeholder="e.g., 3x/week"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Diet</label>
                                                <input
                                                    type="text"
                                                    value={socialHistoryForm.diet}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, diet: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    placeholder="e.g., Balanced, Vegetarian"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                                                <input
                                                    type="text"
                                                    value={socialHistoryForm.occupation}
                                                    onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, occupation: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Living Situation</label>
                                            <input
                                                type="text"
                                                value={socialHistoryForm.livingSituation}
                                                onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, livingSituation: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                placeholder="e.g., Lives alone, With family"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                            <textarea
                                                value={socialHistoryForm.notes}
                                                onChange={(e) => setSocialHistoryForm({ ...socialHistoryForm, notes: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                rows="3"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSaveSocialHistory}
                                            className="w-full px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            <Save className="w-4 h-4 inline mr-1" />
                                            Save Social History
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
};

export default PatientDataManager;









