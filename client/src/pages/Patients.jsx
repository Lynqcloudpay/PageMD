import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Clock, Calendar, Plus, ChevronRight } from 'lucide-react';
import { patientsAPI } from '../services/api';
import { usePatient } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import AddPatientModal from '../components/AddPatientModal';
import { format, parseISO } from 'date-fns';

const Patients = () => {
    const navigate = useNavigate();
    const { patients, appointments, addPatient } = usePatient();
    const [searchFields, setSearchFields] = useState({
        name: '',
        dob: '',
        phone: '',
        mrn: ''
    });
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [pendingPatients, setPendingPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recentlyViewed, setRecentlyViewed] = useState([]);

    // Load recently viewed from local storage - scoped by clinic
    const { user } = useAuth();
    const storageKey = user?.id ? `recentPatients_${user.id}` : 'recentPatients';

    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setRecentlyViewed(JSON.parse(saved));
            } else {
                setRecentlyViewed([]);
            }
        } catch (e) {
            console.error('Failed to load recent patients', e);
        }
    }, [storageKey]);

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

    const hasFilters = Object.values(searchFields).some(v => v.trim() !== '');

    const triggerSearch = async () => {
        if (!hasFilters) {
            setFilteredPatients([]);
            return;
        }

        setLoading(true);
        try {
            const response = await patientsAPI.search(searchFields);
            setFilteredPatients(response.data);
        } catch (error) {
            console.error('Search failed', error);
            // Fallback local search
            const results = patients.filter(p => {
                const pName = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
                const pMrn = (p.mrn || '').toLowerCase();

                const nameMatch = !searchFields.name || pName.includes(searchFields.name.toLowerCase());
                const mrnMatch = !searchFields.mrn || pMrn.includes(searchFields.mrn.toLowerCase());

                return nameMatch && mrnMatch;
            });
            setFilteredPatients(results);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (hasFilters) {
                triggerSearch();
            } else {
                setFilteredPatients([]);
            }
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [searchFields]);

    const clearFilters = () => {
        setSearchFields({ name: '', dob: '', phone: '', mrn: '' });
        setFilteredPatients([]);
    };

    const handlePatientClick = (patientId) => {
        // Find patient details from search results or all patients
        const patient = filteredPatients.find(p => p.id === patientId) ||
            patients.find(p => p.id === patientId) ||
            recentlyViewed.find(p => p.id === patientId);

        if (patient) {
            const newRecent = [
                patient,
                ...recentlyViewed.filter(p => p.id !== patientId)
            ].slice(0, 10); // Keep last 10

            setRecentlyViewed(newRecent);
            localStorage.setItem(storageKey, JSON.stringify(newRecent));
        }

        navigate(`/patient/${patientId}/snapshot`);
    };

    const handleAddSuccess = (message) => {
        alert(message);
        setShowAddModal(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            triggerSearch();
        } else if (e.key === 'Escape') {
            clearFilters();
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

                {/* 4-Field Smart Search Row */}
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm" onKeyDown={handleKeyDown}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Name Search */}
                        <div className="relative">
                            <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                            <input
                                type="text"
                                placeholder="Name (First Last or Last, First)"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                                value={searchFields.name}
                                onChange={(e) => setSearchFields({ ...searchFields, name: e.target.value })}
                            />
                        </div>
                        {/* DOB Search */}
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                            <input
                                type="text"
                                placeholder="DOB (MM/DD/YYYY or YYYY)"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                                value={searchFields.dob}
                                onChange={(e) => setSearchFields({ ...searchFields, dob: e.target.value })}
                            />
                        </div>
                        {/* Phone Search */}
                        <div className="relative">
                            <Clock className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                            <input
                                type="tel"
                                placeholder="Phone (e.g. 3055551212)"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                                value={searchFields.phone}
                                onChange={(e) => setSearchFields({ ...searchFields, phone: e.target.value })}
                            />
                        </div>
                        {/* MRN Search */}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
                            <input
                                type="text"
                                placeholder="MRN (Partial or Exact)"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                                value={searchFields.mrn}
                                onChange={(e) => setSearchFields({ ...searchFields, mrn: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={clearFilters}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                        >
                            Clear All (Esc)
                        </button>
                        <button
                            onClick={triggerSearch}
                            className="px-4 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-lg transition-all border border-blue-200"
                        >
                            Search (Enter)
                        </button>
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

                {/* Search Results or Recently Viewed / All Patients */}
                {hasFilters ? (
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
                                    <PatientListItem
                                        key={patient.id}
                                        patient={patient}
                                        index={index}
                                        onClick={() => handlePatientClick(patient.id)}
                                        highlight={searchFields}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                <Search className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                                <h3 className="text-lg font-medium text-gray-900 mb-1">No patients found</h3>
                                <p className="text-sm text-gray-500 mb-6">We couldn't find any patients matching those criteria.</p>
                                <div className="space-y-4 max-w-xs mx-auto text-left bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Suggestions:</p>
                                    <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                                        <li>Try searching for part of the name (e.g. "chr" for "Christopher")</li>
                                        <li>Verify the MRN is correct</li>
                                        <li>Try searching by year of birth only (e.g. "1990")</li>
                                        <li>Remove some filters to broaden your search</li>
                                    </ul>
                                </div>
                                <button
                                    onClick={clearFilters}
                                    className="mt-6 text-blue-600 hover:text-blue-800 text-sm font-semibold"
                                >
                                    Reset all filters
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Recently Viewed */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <h2 className="font-semibold text-gray-800 text-sm">Recently Viewed</h2>
                                </div>
                                {recentlyViewed.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Clear recently viewed list?')) {
                                                setRecentlyViewed([]);
                                                localStorage.removeItem(storageKey);
                                            }
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                        Clear History
                                    </button>
                                )}
                            </div>
                            {recentlyViewed.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {recentlyViewed.map((patient, index) => (
                                        <PatientListItem
                                            key={`${patient.id}-${index}`}
                                            patient={patient}
                                            index={index}
                                            onClick={() => handlePatientClick(patient.id)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                                        <Clock className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <p className="mb-2 text-sm font-medium text-gray-900">No recently viewed patients</p>
                                    <p className="text-xs text-gray-500 mb-4">Search for a patient to view their chart. Recent patients will appear here.</p>
                                    <div className="text-center">
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-xs inline-flex items-center gap-2"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Enroll New Patient</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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

// --- Sub-components & Helpers ---

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

const PatientListItem = ({ patient, index, onClick, highlight }) => (
    <div
        onClick={onClick}
        className="p-3 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group border-l-4 border-transparent hover:border-blue-500"
    >
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 group-hover:bg-blue-200 transition-all">
                {index + 1}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors mb-1.5 flex items-center gap-2">
                    <HighlightText
                        text={patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'}
                        highlight={highlight?.name}
                    />
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                        <span className="text-gray-500 text-xs">MRN:</span>
                        <span className="font-mono font-semibold text-gray-700">
                            <HighlightText text={patient.mrn} highlight={highlight?.mrn} />
                        </span>
                    </span>
                    {(patient.dob || patient.date_of_birth) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                            <Calendar className="w-3 h-3 text-blue-600" />
                            <span className="font-medium">
                                <HighlightText text={formatDate(patient.dob || patient.date_of_birth)} highlight={highlight?.dob} />
                            </span>
                        </span>
                    )}
                    {(patient.phone || patient.phone_cell) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span className="font-medium">
                                <HighlightText text={patient.phone || patient.phone_cell} highlight={highlight?.phone} />
                            </span>
                        </span>
                    )}
                    {patient.sex && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${patient.sex === 'M' ? 'bg-blue-100 text-blue-700' :
                            patient.sex === 'F' ? 'bg-pink-100 text-pink-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : patient.sex}
                        </span>
                    )}
                </div>
            </div>
        </div>
        <div className="flex-shrink-0 ml-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-all">
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
        </div>
    </div>
);

const HighlightText = ({ text, highlight }) => {
    if (!highlight || !text) return <span>{text}</span>;

    const textStr = String(text);
    const highlightStr = String(highlight).trim();

    if (!highlightStr) return <span>{textStr}</span>;

    // Special handling for Phone Search: If highlight is digits, match any digit sequence in text
    // E.g. highlight "305123" matches "(305) 123-4567"
    const isPhoneQuery = /^\d+$/.test(highlightStr) && highlightStr.length >= 3;

    try {
        if (isPhoneQuery) {
            // Complex case: highlight digits across symbols
            // We'll use a regex that allows any non-digit character between the digits of the highlight
            const regexStr = highlightStr.split('').join('[^\\d]*');
            const regex = new RegExp(`(${regexStr})`, 'gi');
            const parts = textStr.split(regex);

            return (
                <span>
                    {parts.map((part, i) =>
                        regex.test(part)
                            ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
                            : part
                    )}
                </span>
            );
        }

        // Default case: simple string match
        const parts = textStr.split(new RegExp(`(${highlightStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlightStr.toLowerCase()
                        ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
                        : part
                )}
            </span>
        );
    } catch (e) {
        return <span>{textStr}</span>;
    }
};

