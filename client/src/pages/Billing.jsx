import React, { useState, useEffect } from 'react';
import {
    DollarSign, Search, Filter, Download, Upload, Plus, FileText,
    CheckCircle2, XCircle, Clock, AlertCircle, Edit, Trash2, Eye,
    Calendar, User, Building2, Receipt, TrendingUp, CreditCard, X,
    Lightbulb, Zap, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { billingAPI, patientsAPI, visitsAPI, codesAPI, superbillsAPI } from '../services/api';
import { format } from 'date-fns';
import Modal from '../components/ui/Modal';
import CodeSearchModal from '../components/CodeSearchModal';
import { usePrivileges } from '../hooks/usePrivileges';
// Automatic code extraction removed - codes must be added manually

const Billing = () => {
    const navigate = useNavigate();
    const [claims, setClaims] = useState([]);
    const [filteredClaims, setFilteredClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showSuperbillModal, setShowSuperbillModal] = useState(false);
    const [showEditClaimModal, setShowEditClaimModal] = useState(false);
    const [filters, setFilters] = useState({
        status: 'all',
        dateRange: 'all',
        search: ''
    });
    const [statistics, setStatistics] = useState({
        total: 0,
        pending: 0,
        submitted: 0,
        paid: 0,
        denied: 0,
        totalAmount: 0,
        paidAmount: 0
    });

    useEffect(() => {
        fetchAllClaims();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [claims, filters]);

    const fetchAllClaims = async () => {
        setLoading(true);
        try {
            const response = await billingAPI.getAllClaims();
            setClaims(response.data || []);
        } catch (error) {
            console.error('Error fetching claims:', error);
            setClaims([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...claims];

        // Status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        // Date range filter
        if (filters.dateRange !== 'all') {
            const now = new Date();
            let startDate;
            switch (filters.dateRange) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                default:
                    startDate = null;
            }
            if (startDate) {
                filtered = filtered.filter(c => {
                    const claimDate = new Date(c.created_at || c.visit_date);
                    return claimDate >= startDate;
                });
            }
        }

        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c => {
                const patientName = `${c.patient_first_name || ''} ${c.patient_last_name || ''}`.toLowerCase();
                const claimNumber = (c.claim_number || '').toLowerCase();
                return patientName.includes(searchLower) || claimNumber.includes(searchLower);
            });
        }

        // Update statistics
        const stats = {
            total: claims.length,
            pending: claims.filter(c => c.status === 'pending').length,
            submitted: claims.filter(c => c.status === 'submitted').length,
            paid: claims.filter(c => c.status === 'paid').length,
            denied: claims.filter(c => c.status === 'denied').length,
            totalAmount: claims.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0),
            paidAmount: claims.filter(c => c.status === 'paid').reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0)
        };
        setStatistics(stats);

        setFilteredClaims(filtered);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            submitted: 'bg-blue-100 text-blue-800',
            paid: 'bg-green-100 text-green-800',
            denied: 'bg-red-100 text-red-800',
            cancelled: 'bg-gray-100 text-gray-800'
        };
        return styles[status] || styles.pending;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'paid':
                return <CheckCircle2 className="w-4 h-4" />;
            case 'denied':
                return <XCircle className="w-4 h-4" />;
            case 'submitted':
                return <Clock className="w-4 h-4" />;
            default:
                return <AlertCircle className="w-4 h-4" />;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Claims</h1>
                    <p className="text-sm text-gray-600 mt-1">Manage claims, superbills, and billing operations</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setShowSuperbillModal(true)}
                        className="px-4 py-2 text-white rounded-lg flex items-center space-x-2 transition-all duration-200 hover:shadow-md"
                        style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Superbill</span>
                    </button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Claims</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{statistics.total}</p>
                        </div>
                        <Receipt className="w-8 h-8 text-primary-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600 mt-1">{statistics.pending}</p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Paid</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{statistics.paid}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Amount</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">${statistics.totalAmount.toFixed(2)}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-primary-600" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Patient name, claim #..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="paid">Paid</option>
                            <option value="denied">Denied</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                        <select
                            value={filters.dateRange}
                            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ status: 'all', dateRange: 'all', search: '' })}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Claims Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <p className="mt-4 text-gray-600">Loading claims...</p>
                    </div>
                ) : filteredClaims.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No claims found</p>
                        <button
                            onClick={() => setShowSuperbillModal(true)}
                            className="mt-4 px-4 py-2 text-white rounded-lg transition-all duration-200 hover:shadow-md"
                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                        >
                            Create First Superbill
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim #</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredClaims.map((claim) => (
                                    <tr key={claim.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {claim.claim_number || `CLM-${claim.id.slice(0, 8)}`}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                            {claim.patient_first_name && claim.patient_last_name
                                                ? `${claim.patient_first_name} ${claim.patient_last_name}`
                                                : 'Unknown Patient'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                            {claim.visit_date ? format(new Date(claim.visit_date), 'MM/dd/yyyy') : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            ${parseFloat(claim.total_amount || 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                                                {getStatusIcon(claim.status)}
                                                <span>{claim.status || 'pending'}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                            {claim.created_at ? format(new Date(claim.created_at), 'MM/dd/yyyy') : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedClaim(claim);
                                                        setShowClaimModal(true);
                                                    }}
                                                    className="text-primary-600 hover:text-primary-700"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedClaim(claim);
                                                        setShowEditClaimModal(true);
                                                    }}
                                                    className="text-gray-600 hover:text-gray-700"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Claim Detail Modal */}
            {showClaimModal && selectedClaim && (
                <ClaimDetailModal
                    claim={selectedClaim}
                    isOpen={showClaimModal}
                    onClose={() => {
                        setShowClaimModal(false);
                        setSelectedClaim(null);
                    }}
                />
            )}

            {/* Superbill Modal */}
            {showSuperbillModal && (
                <SuperbillModal
                    isOpen={showSuperbillModal}
                    onClose={() => setShowSuperbillModal(false)}
                    onSuccess={() => {
                        fetchAllClaims();
                        setShowSuperbillModal(false);
                    }}
                />
            )}
        </div>
    );
};

// Claim Detail Modal Component
const ClaimDetailModal = ({ claim, isOpen, onClose }) => {
    if (!isOpen) return null;

    const diagnosisCodes = Array.isArray(claim.diagnosis_codes)
        ? claim.diagnosis_codes
        : (claim.diagnosis_codes ? JSON.parse(claim.diagnosis_codes) : []);

    const procedureCodes = Array.isArray(claim.procedure_codes)
        ? claim.procedure_codes
        : (claim.procedure_codes ? JSON.parse(claim.procedure_codes) : []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Claim Details" size="lg">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Claim Number</label>
                        <p className="mt-1 text-sm text-gray-900">{claim.claim_number || `CLM-${claim.id.slice(0, 8)}`}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">{claim.status || 'pending'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Visit Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                            {claim.visit_date ? format(new Date(claim.visit_date), 'MM/dd/yyyy') : 'N/A'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                            ${parseFloat(claim.total_amount || 0).toFixed(2)}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis Codes (ICD-10)</label>
                    <div className="space-y-1">
                        {diagnosisCodes.length > 0 ? (
                            diagnosisCodes.map((dx, idx) => (
                                <div key={idx} className="text-sm text-gray-900">
                                    <span className="font-medium">{dx.code}</span> - {dx.description}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500">No diagnosis codes</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Procedure Codes (CPT)</label>
                    <div className="space-y-1">
                        {procedureCodes.length > 0 ? (
                            procedureCodes.map((proc, idx) => (
                                <div key={idx} className="text-sm text-gray-900">
                                    <span className="font-medium">{proc.code}</span> - {proc.description}
                                    {proc.amount && (
                                        <span className="ml-2 text-gray-600">(${parseFloat(proc.amount).toFixed(2)})</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500">No procedure codes</p>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// Superbill Modal Component - Commercial Grade
const SuperbillModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [patients, setPatients] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [visits, setVisits] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [diagnosisCodes, setDiagnosisCodes] = useState([]);
    const [procedureCodes, setProcedureCodes] = useState([]);
    const [feeSchedule, setFeeSchedule] = useState([]);
    const [availableDiagnosisCodes, setAvailableDiagnosisCodes] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [showNotePreview, setShowNotePreview] = useState(false);
    const [visitNote, setVisitNote] = useState(null);
    const [showAddDiagnosis, setShowAddDiagnosis] = useState(false);
    const [showAddProcedure, setShowAddProcedure] = useState(false);
    const [showICD10Modal, setShowICD10Modal] = useState(false);
    const [showCPTModal, setShowCPTModal] = useState(false);
    const [diagnosisSearch, setDiagnosisSearch] = useState('');
    const [procedureSearch, setProcedureSearch] = useState('');
    const [billingNotes, setBillingNotes] = useState([]);
    const [qualityMeasures, setQualityMeasures] = useState([]);
    const [existingSuperbills, setExistingSuperbills] = useState([]);
    const { hasPrivilege } = usePrivileges();
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            fetchFeeSchedule();
            fetchAvailableDiagnosisCodes();
        } else {
            // Reset state when modal closes
            setStep(1);
            setSelectedPatient(null);
            setSelectedVisit(null);
            setSearchQuery('');
            setDiagnosisCodes([]);
            setProcedureCodes([]);
            setVisitNote(null);
            setSearchResults([]);
            setShowAddDiagnosis(false);
            setShowAddProcedure(false);
            setShowNotePreview(false);
            setBillingNotes([]);
            setQualityMeasures([]);
            setExistingSuperbills([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedPatient && step === 1) {
            fetchPatientVisits();
        }
    }, [selectedPatient, step]);

    useEffect(() => {
        if (selectedVisit && selectedPatient) {
            loadVisitData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVisit, selectedPatient]);

    useEffect(() => {
        calculateTotal();
    }, [procedureCodes]);

    // Search patients when searchQuery changes
    useEffect(() => {
        if (!isOpen || step !== 1) return;

        const searchPatients = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                const response = await patientsAPI.search(searchQuery);
                const results = Array.isArray(response.data) ? response.data : [];
                setSearchResults(results.slice(0, 10)); // Limit to 10 results
            } catch (error) {
                console.error('Error searching patients:', error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        };

        const timeoutId = setTimeout(searchPatients, 300); // Debounce
        return () => clearTimeout(timeoutId);
    }, [searchQuery, isOpen, step]);

    const fetchFeeSchedule = async () => {
        try {
            const response = await billingAPI.getFeeSchedule();
            setFeeSchedule(response.data || []);
        } catch (error) {
            console.error('Error fetching fee schedule:', error);
        }
    };

    const fetchAvailableDiagnosisCodes = async () => {
        try {
            const response = await codesAPI.searchICD10('');
            setAvailableDiagnosisCodes(response.data || []);
        } catch (error) {
            console.error('Error fetching diagnosis codes:', error);
            // Fallback: try to get codes from patient problems if available
            if (selectedPatient) {
                try {
                    const problemsResponse = await patientsAPI.getProblems(selectedPatient.id);
                    const problems = problemsResponse.data || [];
                    setAvailableDiagnosisCodes(problems
                        .filter(p => p.icd10_code)
                        .map(p => ({ code: p.icd10_code, description: p.problem_name })));
                } catch (err) {
                    console.error('Error fetching problems as fallback:', err);
                }
            }
        }
    };

    const fetchPatientVisits = async (patient = null) => {
        const patientToUse = patient || selectedPatient;
        if (!patientToUse) return;
        try {
            const response = await visitsAPI.getByPatient(patientToUse.id);
            const visitsData = response.data || [];
            setVisits(visitsData);
            if (patient) {
                setSelectedPatient(patient);
            }

            // Also fetch existing superbills
            const sbRes = await superbillsAPI.getByPatient(patientToUse.id);
            setExistingSuperbills(sbRes.data || []);
        } catch (error) {
            console.error('Error fetching visits/superbills:', error);
            setVisits([]);
        }
    };

    const loadVisitData = async () => {
        if (!selectedVisit || !selectedPatient) return;

        try {
            // Fetch visit data
            const visitResponse = await visitsAPI.get(selectedVisit.id);
            const visit = visitResponse.data;
            const noteText = visit.note_draft || visit.note_signed || '';
            setVisitNote(noteText);

            // Load patient problems for diagnosis codes
            const problemsResponse = await patientsAPI.getProblems(selectedPatient.id);
            const problems = problemsResponse.data || [];

            // Automatic code extraction removed - codes must be added manually
            // Diagnosis and procedure codes will remain empty until manually added

        } catch (error) {
            console.error('Error loading visit data:', error);
        }
    };

    const calculateTotal = () => {
        const total = procedureCodes.reduce((sum, proc) => {
            return sum + parseFloat(proc.amount || 0);
        }, 0);
        setTotalAmount(total);
    };

    const handleCreateSuperbill = async () => {
        if (!selectedVisit) {
            alert('Please select a visit');
            return;
        }

        setLoading(true);
        try {
            // Create the commercial superbill from the visit
            // This will auto-prepopulate from notes and orders
            const response = await superbillsAPI.fromVisit(selectedVisit.id);
            const sbId = response.data.id;

            // Optionally, we could add the manual codes selected in Step 2 here,
            // but the new Superbill editor is better for that.
            // For now, let's just navigate to the full editor.

            navigate(`/patient/${selectedPatient.id}/superbill/${sbId}`);
            onSuccess();
        } catch (error) {
            console.error('Error creating superbill:', error);
            alert('Failed to create superbill: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Superbill" size="xl">
            <div className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-center space-x-4 mb-6">
                    <div className={`flex items-center ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'text-white' : 'bg-gray-200'}`} style={step >= 1 ? { background: '#3B82F6' } : {}}>
                            1
                        </div>
                        <span className="ml-2 text-sm font-medium">Patient & Visit</span>
                    </div>
                    <div className="w-12 h-0.5" style={step >= 2 ? { background: '#3B82F6' } : { background: '#E5E7EB' }}></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-strong-azure' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'text-white' : 'bg-gray-200'}`} style={step >= 2 ? { background: '#3B82F6' } : {}}>
                            2
                        </div>
                        <span className="ml-2 text-sm font-medium">Codes & Charges</span>
                    </div>
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search Patient</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or MRN..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    autoFocus
                                />
                            </div>

                            {/* Patient search results dropdown */}
                            {searchQuery.trim().length >= 2 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {searching ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                    ) : searchResults.length > 0 ? (
                                        <div className="divide-y divide-gray-200">
                                            {searchResults.map((patient) => (
                                                <button
                                                    key={patient.id}
                                                    onClick={() => {
                                                        setSelectedPatient(patient);
                                                        setSearchQuery(`${patient.first_name} ${patient.last_name}${patient.mrn ? ` (MRN: ${patient.mrn})` : ''}`);
                                                        setSearchResults([]);
                                                        fetchPatientVisits(patient);
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="font-medium text-gray-900">
                                                        {patient.first_name} {patient.last_name}
                                                    </div>
                                                    {patient.mrn && (
                                                        <div className="text-sm text-gray-500 mt-0.5">
                                                            MRN: {patient.mrn}
                                                        </div>
                                                    )}
                                                    {patient.dob && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            DOB: {format(new Date(patient.dob), 'MM/dd/yyyy')}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-gray-500">
                                            No patients found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedPatient && (
                            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {selectedPatient.first_name} {selectedPatient.last_name}
                                        </div>
                                        {selectedPatient.mrn && (
                                            <div className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedPatient(null);
                                            setSelectedVisit(null);
                                            setSearchQuery('');
                                            setVisits([]);
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedPatient && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Visit</label>
                                {visits.length === 0 ? (
                                    <div className="text-sm text-gray-500 p-3 border border-gray-300 rounded-md">
                                        Loading visits...
                                    </div>
                                ) : (
                                    <select
                                        value={selectedVisit?.id || ''}
                                        onChange={(e) => {
                                            const visit = visits.find(v => v.id === e.target.value);
                                            setSelectedVisit(visit);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Select a visit</option>
                                        {visits
                                            .filter(v => v.note_signed_at || v.locked)
                                            .map(visit => (
                                                <option key={visit.id} value={visit.id}>
                                                    {format(new Date(visit.visit_date), 'MM/dd/yyyy')} - {visit.visit_type || 'Office Visit'}
                                                </option>
                                            ))}
                                    </select>
                                )}
                                {visits.length > 0 && visits.filter(v => v.note_signed_at || v.locked).length === 0 && (
                                    <div className="mt-2 text-sm text-red-600">
                                        No signed visits found for this patient
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedPatient && existingSuperbills.length > 0 && (
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Existing Superbills</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {existingSuperbills.map(sb => (
                                        <button
                                            key={sb.id}
                                            onClick={() => {
                                                navigate(`/patient/${selectedPatient.id}/superbill/${sb.id}`);
                                                onClose();
                                            }}
                                            className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Receipt className="w-4 h-4 text-blue-500" />
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-gray-900">{format(new Date(sb.service_date_from), 'MM/dd/yyyy')}</div>
                                                    <div className="text-xs text-gray-500">{sb.provider_first_name ? `${sb.provider_first_name} ${sb.provider_last_name}` : 'No provider'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sb.status === 'FINALIZED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {sb.status}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!selectedVisit}
                                className="px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && selectedVisit && (
                    <div className="space-y-4">
                        {/* Peek at Note Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowNotePreview(true)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300 flex items-center space-x-2"
                                title="View Visit Note"
                            >
                                <Eye className="w-4 h-4" />
                                <span>Peek at Note</span>
                            </button>
                        </div>

                        {/* Diagnosis Codes */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">Diagnosis Codes (ICD-10)</label>
                                <div className="flex items-center space-x-2">
                                    {hasPrivilege('search_icd10') && (
                                        <button
                                            onClick={() => setShowICD10Modal(true)}
                                            className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                                            title="Search ICD-10 Codes"
                                        >
                                            Search ICD-10
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowAddDiagnosis(!showAddDiagnosis)}
                                        className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                                    >
                                        {showAddDiagnosis ? 'Cancel' : '+ Add'}
                                    </button>
                                </div>
                            </div>
                            {showAddDiagnosis && (
                                <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="Search ICD-10 codes..."
                                        value={diagnosisSearch}
                                        onChange={(e) => setDiagnosisSearch(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                                    />
                                    <div className="mt-2 max-h-32 overflow-y-auto">
                                        {availableDiagnosisCodes
                                            .filter(code =>
                                                code.code.toLowerCase().includes(diagnosisSearch.toLowerCase()) ||
                                                (code.description || '').toLowerCase().includes(diagnosisSearch.toLowerCase())
                                            )
                                            .slice(0, 5)
                                            .map((code) => (
                                                <button
                                                    key={code.id || code.code}
                                                    onClick={() => {
                                                        if (!diagnosisCodes.find(dx => dx.code === code.code)) {
                                                            setDiagnosisCodes([...diagnosisCodes, {
                                                                code: code.code,
                                                                description: code.description || ''
                                                            }]);
                                                        }
                                                        setDiagnosisSearch('');
                                                        setShowAddDiagnosis(false);
                                                    }}
                                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                                                >
                                                    {code.code} - {code.description}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                            <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto bg-gray-50">
                                {diagnosisCodes.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-2">No diagnosis codes added</p>
                                ) : (
                                    diagnosisCodes.map((dx, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-white rounded">
                                            <span className="text-sm">{dx.code} - {dx.description}</span>
                                            <button
                                                onClick={() => setDiagnosisCodes(diagnosisCodes.filter((_, i) => i !== idx))}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Procedure Codes */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">Procedure Codes (CPT)</label>
                                <div className="flex items-center space-x-2">
                                    {hasPrivilege('search_cpt') && (
                                        <button
                                            onClick={() => setShowCPTModal(true)}
                                            className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                                            title="Search CPT Codes"
                                        >
                                            Search CPT
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowAddProcedure(!showAddProcedure)}
                                        className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                                    >
                                        {showAddProcedure ? 'Cancel' : '+ Add'}
                                    </button>
                                </div>
                            </div>
                            {showAddProcedure && (
                                <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="Search CPT codes..."
                                        value={procedureSearch}
                                        onChange={(e) => setProcedureSearch(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                                    />
                                    <div className="mt-2 max-h-32 overflow-y-auto">
                                        {feeSchedule
                                            .filter(f => f.code_type === 'CPT')
                                            .filter(code =>
                                                code.code.toLowerCase().includes(procedureSearch.toLowerCase()) ||
                                                (code.description || '').toLowerCase().includes(procedureSearch.toLowerCase())
                                            )
                                            .slice(0, 5)
                                            .map((code) => (
                                                <button
                                                    key={code.id || code.code}
                                                    onClick={() => {
                                                        if (!procedureCodes.find(p => p.code === code.code)) {
                                                            setProcedureCodes([...procedureCodes, {
                                                                code: code.code,
                                                                description: code.description || '',
                                                                amount: code.fee_amount || 0
                                                            }]);
                                                        }
                                                        setProcedureSearch('');
                                                        setShowAddProcedure(false);
                                                    }}
                                                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded flex items-center justify-between"
                                                >
                                                    <span>{code.code} - {code.description}</span>
                                                    {code.fee_amount && (
                                                        <span className="text-xs font-semibold text-gray-600">
                                                            ${parseFloat(code.fee_amount).toFixed(2)}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                            <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto bg-gray-50">
                                {procedureCodes.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-2">No procedure codes added</p>
                                ) : (
                                    procedureCodes.map((proc, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-white rounded">
                                            <span className="text-sm">{proc.code} - {proc.description}</span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-semibold">${parseFloat(proc.amount || 0).toFixed(2)}</span>
                                                <button
                                                    onClick={() => setProcedureCodes(procedureCodes.filter((_, i) => i !== idx))}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quality Measures Detected */}
                        {qualityMeasures.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Zap className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-800">Quality Measures Detected</span>
                                </div>
                                <div className="space-y-1">
                                    {qualityMeasures.map((measure, idx) => (
                                        <div key={idx} className="text-xs text-green-700 flex items-center space-x-2">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span className="capitalize">{measure.measure.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Billing Optimization Notes */}
                        {billingNotes.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Info className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-blue-800">Billing Notes</span>
                                </div>
                                <div className="space-y-1">
                                    {billingNotes.map((note, idx) => (
                                        <div key={idx} className="text-xs text-blue-700 flex items-start space-x-2">
                                            {note.startsWith('💡') ? (
                                                <>
                                                    <Lightbulb className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                                                    <span>{note.replace('💡 TIP: ', '')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-blue-500">•</span>
                                                    <span>{note}</span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Total */}
                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold">Total Amount:</span>
                                <span className="text-xl font-bold text-primary-600">${totalAmount.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Based on 2024 Medicare Physician Fee Schedule rates</p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCreateSuperbill}
                                disabled={loading || diagnosisCodes.length === 0 || procedureCodes.length === 0}
                                className="px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                            >
                                {loading ? 'Creating...' : 'Create Superbill'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Note Preview Modal */}
                {showNotePreview && visitNote && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowNotePreview(false)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Visit Note Preview</h3>
                                <button onClick={() => setShowNotePreview(false)} className="p-1 hover:bg-gray-100 rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono">{visitNote}</pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* Code Search Modals */}
                {hasPrivilege('search_icd10') && (
                    <CodeSearchModal
                        isOpen={showICD10Modal}
                        onClose={() => setShowICD10Modal(false)}
                        onSelect={(code) => {
                            if (!diagnosisCodes.find(d => d.code === code.code)) {
                                setDiagnosisCodes([...diagnosisCodes, {
                                    code: code.code,
                                    description: code.description || ''
                                }]);
                            }
                            setShowICD10Modal(false);
                        }}
                        codeType="ICD10"
                        multiSelect={true}
                        selectedCodes={diagnosisCodes}
                    />
                )}

                {hasPrivilege('search_cpt') && (
                    <CodeSearchModal
                        isOpen={showCPTModal}
                        onClose={() => setShowCPTModal(false)}
                        onSelect={(code) => {
                            if (!procedureCodes.find(p => p.code === code.code)) {
                                const feeCode = feeSchedule.find(f => f.code === code.code && f.code_type === 'CPT');
                                setProcedureCodes([...procedureCodes, {
                                    code: code.code,
                                    description: code.description || '',
                                    amount: feeCode?.fee_amount || 0
                                }]);
                            }
                            setShowCPTModal(false);
                        }}
                        codeType="CPT"
                        multiSelect={true}
                        selectedCodes={procedureCodes}
                    />
                )}
            </div>
        </Modal>
    );
};

export default Billing;

