import React, { useState, useEffect } from 'react';
import {
    DollarSign, Search, Filter, Download, Upload, Plus, FileText,
    CheckCircle2, XCircle, Clock, AlertCircle, Edit, Trash2, Eye,
    Calendar, User, Building2, Receipt, TrendingUp, CreditCard, X,
    Lightbulb, Zap, Info, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { billingAPI, patientsAPI, visitsAPI, codesAPI } from '../services/api';
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
                    <h1 className="text-xl font-bold text-[#111827] tracking-tighter uppercase mb-0.5">Billing & Claims</h1>
                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Manage claims, fee sheets, and billing operations</p>
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
                        <span>Open Fee Sheet</span>
                    </button>
                    <button
                        onClick={() => navigate('/billing/reports/collections')}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
                    >
                        <FileText className="w-4 h-4" />
                        <span>Reports</span>
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
                            <p className="text-2xl font-semibold text-[#111827] mt-1">{statistics.total}</p>
                        </div>
                        <Receipt className="w-8 h-8 text-primary-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-semibold text-yellow-600 mt-1">{statistics.pending}</p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Paid</p>
                            <p className="text-2xl font-semibold text-green-600 mt-1">{statistics.paid}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Amount</p>
                            <p className="text-2xl font-semibold text-[#111827] mt-1">${statistics.totalAmount.toFixed(2)}</p>
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
                            Open First Fee Sheet
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
                                                        if (claim.status === 'unbilled' && claim.visit_id) {
                                                            navigate(`/patient/${claim.patient_id}/superbill/${claim.visit_id}`);
                                                        } else {
                                                            setSelectedClaim(claim);
                                                            setShowEditClaimModal(true);
                                                        }
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

            {/* Edit Claim Modal */}
            {showEditClaimModal && selectedClaim && (
                <EditClaimModal
                    claim={selectedClaim}
                    isOpen={showEditClaimModal}
                    onClose={() => {
                        setShowEditClaimModal(false);
                        setSelectedClaim(null);
                    }}
                    onSuccess={() => {
                        fetchAllClaims();
                        setShowEditClaimModal(false);
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

// Fee Sheet Modal Component - Ported from OpenEMR
const SuperbillModal = ({ isOpen, onClose, onSuccess }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [patients, setPatients] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [visits, setVisits] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [existingSuperbills, setExistingSuperbills] = useState([]);
    const { hasPrivilege } = usePrivileges();
    const navigate = useNavigate();

    // Missing state variables added to fix ReferenceErrors
    const [step, setStep] = useState(1);
    const [diagnosisCodes, setDiagnosisCodes] = useState([]);
    const [procedureCodes, setProcedureCodes] = useState([]);
    const [visitNote, setVisitNote] = useState(null);
    const [showAddDiagnosis, setShowAddDiagnosis] = useState(false);
    const [showAddProcedure, setShowAddProcedure] = useState(false);
    const [showNotePreview, setShowNotePreview] = useState(false);
    const [billingNotes, setBillingNotes] = useState([]);
    const [qualityMeasures, setQualityMeasures] = useState([]);
    const [availableDiagnosisCodes, setAvailableDiagnosisCodes] = useState([]);
    const [feeSchedule, setFeeSchedule] = useState([]);

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
        if (selectedPatient) {
            fetchPatientVisits();
        }
    }, [selectedPatient]);

    useEffect(() => {
        if (selectedVisit && selectedPatient) {
            loadVisitData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVisit, selectedPatient]);

    // Search patients when searchQuery changes
    useEffect(() => {
        if (!isOpen) return;

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
    }, [searchQuery, isOpen]);

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

            setExistingSuperbills([]);
        } catch (error) {
            console.error('Error fetching visits:', error);
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

    const handleCreateSuperbill = async () => {
        if (!selectedVisit) {
            alert('Please select a visit');
            return;
        }

        navigate(`/patient/${selectedPatient.id}/fee-sheet/${selectedVisit.id}`);
        onSuccess();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Open Fee Sheet" size="xl">
            <div className="space-y-6">
                {/* Step Indicator Removed - Direct Creation */}
                <div className="mb-4 text-sm text-gray-500">Select a patient and visit to open the fee sheet.</div>

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
                                        .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                                        .map(visit => (
                                            <option key={visit.id} value={visit.id}>
                                                {format(new Date(visit.visit_date), 'MM/dd/yyyy')} - {visit.visit_type || 'Office Visit'}
                                                {!visit.note_signed_at && !visit.locked ? ' (Unsigned)' : ''}
                                            </option>
                                        ))}
                                </select>
                            )}
                            {visits.length > 0 && (
                                <div className="mt-2 text-xs text-gray-500">
                                    Showing all visits (Signed & Unsigned)
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
                                        className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Receipt className="w-4 h-4 text-blue-500" />
                                            <div className="text-left">
                                                <div className="text-sm font-medium text-gray-900">{format(new Date(sb.service_date_from), 'MM/dd/yyyy')}</div>
                                                <div className="text-xs text-gray-500">{sb.provider_first_name ? `${sb.provider_first_name} ${sb.provider_last_name}` : 'No provider'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sb.status === 'FINALIZED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
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

                    <div className="flex justify-end pt-4 border-t gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateSuperbill}
                            disabled={!selectedVisit}
                            className="px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md"
                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                        >
                            Create Superbill
                        </button>
                    </div>
                </div>

            </div>
        </Modal>
    );
};

// Edit Claim Modal Component
const EditClaimModal = ({ claim, isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [claimData, setClaimData] = useState({
        status: claim.status || 'pending',
        claim_number: claim.claim_number || '',
        total_amount: claim.total_amount || 0,
        billing_notes: claim.billing_notes || ''
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            if (claim.status === 'unbilled') {
                // For unbilled, maybe we just update amount or something?
                // Most users should use the Superbill for this.
                alert('For unbilled encounters, please use the Superbill editor to make changes.');
                onClose();
                return;
            }
            await billingAPI.updateClaim(claim.id, claimData);
            onSuccess();
        } catch (error) {
            console.error('Error updating claim:', error);
            alert('Failed to update claim.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Claim" size="md">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Claim Number</label>
                    <input
                        type="text"
                        value={claimData.claim_number}
                        onChange={(e) => setClaimData({ ...claimData, claim_number: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        disabled={claim.status === 'unbilled'}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                        value={claimData.status}
                        onChange={(e) => setClaimData({ ...claimData, status: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        disabled={claim.status === 'unbilled'}
                    >
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="paid">Paid</option>
                        <option value="denied">Denied</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <input
                        type="number"
                        step="0.01"
                        value={claimData.total_amount}
                        onChange={(e) => setClaimData({ ...claimData, total_amount: parseFloat(e.target.value) })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        disabled={claim.status === 'unbilled'}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Internal Billing Notes</label>
                    <textarea
                        value={claimData.billing_notes}
                        onChange={(e) => setClaimData({ ...claimData, billing_notes: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        rows={3}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default Billing;

