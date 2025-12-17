import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Clock, Calendar, Plus, ChevronRight } from 'lucide-react';
import { patientsAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import AddPatientModal from '../components/AddPatientModal';
import { format, parseISO } from 'date-fns';

const Patients = () => {
    const navigate = useNavigate();
    const { patients, appointments, addPatient } = usePatient();
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [pendingPatients, setPendingPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Get current user (mock for now - in production would come from auth context)
    const currentProvider = "Dr. Rodriguez";

    useEffect(() => {
        // Get patients with pending appointments assigned to current provider
        const pending = appointments
            .filter(apt => apt.provider === currentProvider && apt.patientId)
            .map(apt => {
                const patient = patients.find(p => p.id === apt.patientId || String(p.id) === String(apt.patientId));
                return patient ? { ...patient, appointment: apt } : null;
            })
            .filter(Boolean);

        setPendingPatients(pending);
    }, [appointments, patients, currentProvider]);

    useEffect(() => {
        // Debounce search to reduce API calls
        const timeoutId = setTimeout(() => {
            if (searchQuery.trim()) {
                setLoading(true);
                // Try API first, fallback to local search
                patientsAPI.search(searchQuery)
                    .then(response => {
                        setFilteredPatients(response.data);
                        setLoading(false);
                    })
                    .catch(() => {
                        // Fallback to local search
                        const results = patients.filter(p =>
                            (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (p.mrn && p.mrn.toLowerCase().includes(searchQuery.toLowerCase()))
                        );
                        setFilteredPatients(results);
                        setLoading(false);
                    });
            } else {
                setFilteredPatients([]);
            }
        }, 300); // 300ms debounce delay

        return () => clearTimeout(timeoutId);
    }, [searchQuery, patients]);

    const handlePatientClick = (patientId) => {
        navigate(`/patient/${patientId}/snapshot`);
    };

    const handleAddSuccess = (message) => {
        alert(message);
        setShowAddModal(false);
    };

    // Format date helper
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = typeof dateString === 'string' && dateString.includes('T')
                ? parseISO(dateString)
                : new Date(dateString);
            return format(date, 'MMM d, yyyy');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="h-full bg-white w-full">
            <div className="p-4 w-full">
                {/* Header - Compact Design */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-0.5">Patients</h1>
                        <p className="text-gray-500 text-xs">Manage your patient list</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm flex items-center gap-2 transition-all hover:bg-blue-700 hover:shadow-md text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Enroll New Patient</span>
                    </button>
                </div>

                {/* Search Bar - Compact Design */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                        <input
                            type="text"
                            placeholder="Search patients by name or MRN..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Pending Appointments Section - Compact Cards */}
                {pendingPatients.length > 0 && (
                    <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 shadow-sm">
                        <h2 className="font-semibold text-gray-800 mb-3 flex items-center text-sm">
                            <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center mr-2">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            Pending to be Seen ({pendingPatients.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {pendingPatients.map((patient) => (
                                <div
                                    key={patient.id}
                                    onClick={() => handlePatientClick(patient.id)}
                                    className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md cursor-pointer transition-all hover:border-blue-400 group"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                            <User className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{patient.name}</h3>
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-500 text-xs">MRN:</span>
                                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{patient.mrn}</span>
                                        </div>
                                        {patient.appointment && (
                                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                                                <Calendar className="w-3 h-3 text-blue-600" />
                                                <span className="text-blue-600 font-medium text-xs">
                                                    {patient.appointment.type} - {patient.appointment.time}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Results or All Patients - Compact Card Design */}
                {searchQuery.trim() ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-blue-50 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Search className="w-4 h-4 text-blue-600" />
                                </div>
                                <h2 className="font-semibold text-gray-800 text-sm">
                                    Search Results ({filteredPatients.length})
                                </h2>
                            </div>
                        </div>
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-3"></div>
                                <p className="text-sm font-medium">Searching...</p>
                            </div>
                        ) : filteredPatients.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {filteredPatients.map((patient, index) => (
                                    <div
                                        key={patient.id}
                                        onClick={() => handlePatientClick(patient.id)}
                                        className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group border-l-4 border-transparent hover:border-blue-500"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 group-hover:bg-blue-200 transition-all">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors mb-1.5">{patient.name || `${patient.first_name} ${patient.last_name}`}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                                                        <span className="text-gray-500 text-xs">MRN:</span>
                                                        <span className="font-mono font-semibold text-gray-700">{patient.mrn}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                                                        <Calendar className="w-3 h-3 text-blue-600" />
                                                        <span className="font-medium">{formatDate(patient.dob || patient.date_of_birth)}</span>
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${patient.sex === 'M' ? 'bg-blue-100 text-blue-700' :
                                                            patient.sex === 'F' ? 'bg-pink-100 text-pink-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : patient.sex}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 ml-3">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-all">
                                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <User className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No patients found</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <h2 className="font-semibold text-gray-800 text-sm">All Patients ({patients.length})</h2>
                            </div>
                        </div>
                        {patients.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {patients.map((patient, index) => (
                                    <div
                                        key={patient.id}
                                        onClick={() => handlePatientClick(patient.id)}
                                        className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group border-l-4 border-transparent hover:border-blue-500"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 group-hover:bg-blue-200 transition-all">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors mb-1.5">{patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                                                        <span className="text-gray-500 text-xs">MRN:</span>
                                                        <span className="font-mono font-semibold text-gray-700">{patient.mrn}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                                                        <Calendar className="w-3 h-3 text-blue-600" />
                                                        <span className="font-medium">{formatDate(patient.dob || patient.date_of_birth)}</span>
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${patient.sex === 'M' ? 'bg-blue-100 text-blue-700' :
                                                            patient.sex === 'F' ? 'bg-pink-100 text-pink-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : patient.sex}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 ml-3">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-all">
                                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="mb-4 text-sm">No patients enrolled yet.</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow-sm transition-all hover:bg-blue-700 hover:shadow-md font-medium text-sm"
                                >
                                    Enroll First Patient
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Add Patient Modal */}
                <AddPatientModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={handleAddSuccess}
                />
            </div>
        </div>
    );
};

export default Patients;

