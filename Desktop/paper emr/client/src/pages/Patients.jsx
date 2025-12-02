import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Clock, Calendar, Plus } from 'lucide-react';
import { patientsAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import AddPatientModal from '../components/AddPatientModal';

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
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.mrn.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    setFilteredPatients(results);
                    setLoading(false);
                });
        } else {
            setFilteredPatients([]);
        }
    }, [searchQuery, patients]);

    const handlePatientClick = (patientId) => {
        navigate(`/patient/${patientId}/snapshot`);
    };

    const handleAddSuccess = (message) => {
        alert(message);
        setShowAddModal(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-ink-900">Patients</h1>
                    <p className="text-ink-500 text-sm mt-1">Manage your patient list</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800 shadow-sm flex items-center space-x-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>Enroll New Patient</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400" />
                    <input
                        type="text"
                        placeholder="Search patients by name or MRN..."
                        className="w-full pl-10 pr-4 py-3 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Pending Appointments Section */}
            {pendingPatients.length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h2 className="font-bold text-ink-900 mb-3 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-700" />
                        Pending to be Seen ({pendingPatients.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingPatients.map((patient) => (
                            <div
                                key={patient.id}
                                onClick={() => handlePatientClick(patient.id)}
                                className="bg-white rounded-lg border border-blue-200 p-4 hover:shadow-md cursor-pointer transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                        <User className="w-4 h-4 text-ink-400" />
                                        <h3 className="font-bold text-ink-900">{patient.name}</h3>
                                    </div>
                                </div>
                                <div className="text-sm text-ink-600 space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-ink-500">MRN:</span>
                                        <span className="font-mono text-xs">{patient.mrn}</span>
                                    </div>
                                    {patient.appointment && (
                                        <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-paper-100">
                                            <Calendar className="w-3 h-3 text-blue-600" />
                                            <span className="text-blue-700 font-medium">
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

            {/* Search Results or All Patients */}
            {searchQuery.trim() ? (
                <div className="bg-white rounded-lg shadow-sm border border-paper-200">
                    <div className="px-4 py-3 bg-paper-100 border-b border-paper-200">
                        <h2 className="font-bold text-ink-900">
                            Search Results ({filteredPatients.length})
                        </h2>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-ink-500">Searching...</div>
                    ) : filteredPatients.length > 0 ? (
                        <div className="divide-y divide-paper-100">
                            {filteredPatients.map((patient) => (
                                <div
                                    key={patient.id}
                                    onClick={() => handlePatientClick(patient.id)}
                                    className="p-4 hover:bg-paper-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-ink-900">{patient.name || `${patient.first_name} ${patient.last_name}`}</h3>
                                            <div className="text-sm text-ink-500 mt-1 flex items-center space-x-3">
                                                <span className="font-mono">{patient.mrn}</span>
                                                <span>{patient.dob || patient.date_of_birth}</span>
                                                <span>{patient.sex}</span>
                                            </div>
                                        </div>
                                        <div className="text-ink-400">
                                            <User className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-ink-500">No patients found</div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-paper-200">
                    <div className="px-4 py-3 bg-paper-100 border-b border-paper-200 flex items-center justify-between">
                        <h2 className="font-bold text-ink-900">All Patients ({patients.length})</h2>
                    </div>
                    {patients.length > 0 ? (
                        <div className="divide-y divide-paper-100">
                            {patients.map((patient) => (
                                <div
                                    key={patient.id}
                                    onClick={() => handlePatientClick(patient.id)}
                                    className="p-4 hover:bg-paper-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-ink-900">{patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'}</h3>
                                            <div className="text-sm text-ink-500 mt-1 flex items-center space-x-3">
                                                <span className="font-mono">{patient.mrn}</span>
                                                <span>{patient.dob || patient.date_of_birth}</span>
                                                <span>{patient.sex}</span>
                                            </div>
                                        </div>
                                        <div className="text-ink-400">
                                            <User className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-ink-500">
                            <p className="mb-4">No patients enrolled yet.</p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800"
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
    );
};

export default Patients;

