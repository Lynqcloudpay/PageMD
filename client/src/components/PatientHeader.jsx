import React, { useState, useEffect } from 'react';
import {
    Phone, Mail, MapPin, Shield, Activity,
    AlertCircle, Edit2, Camera, X, Check,
    ExternalLink, Calendar, FileText, Upload, Pill
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import PatientHeaderPhoto from './PatientHeaderPhoto';

// Robust date formatter that ignores timezones completely
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        // Expect YYYY-MM-DD from API
        const part = dateString.split('T')[0];
        const [y, m, d] = part.split('-');
        return `${parseInt(m)}/${parseInt(d)}/${y}`;
    } catch (e) {
        return dateString;
    }
};

// Robust age calculator
const calculateAge = (dob) => {
    if (!dob) return null;
    try {
        const part = dob.split('T')[0];
        const [y, m, d] = part.split('-').map(n => parseInt(n));
        const today = new Date();
        let age = today.getFullYear() - y;
        const mDiff = (today.getMonth() + 1) - m;
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
            age--;
        }
        return age;
    } catch (e) {
        return null;
    }
};

const PatientHeader = ({ patient: propPatient, onUpdate, onOpenChart, onOpenToday, onAction }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [fetchedPatient, setFetchedPatient] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [loading, setLoading] = useState(false);

    // Use passed patient or fetched patient
    const patient = propPatient || fetchedPatient;

    // Fetch patient if not provided and we have an ID
    useEffect(() => {
        const fetchPatient = async () => {
            if (!propPatient && id && !fetchedPatient) {
                try {
                    const response = await api.get(`/patients/${id}`);
                    setFetchedPatient(response.data);
                } catch (error) {
                    console.error("Failed to fetch patient for header:", error);
                }
            }
        };
        fetchPatient();
    }, [propPatient, id, fetchedPatient]);

    // Safety check
    if (!patient) return null;

    // Initialize edit form with comprehensive fields
    const handleEditClick = () => {
        setEditForm({
            // Personal
            first_name: patient.first_name || '',
            middle_name: patient.middle_name || '',
            last_name: patient.last_name || '',
            name_suffix: patient.name_suffix || '',
            preferred_name: patient.preferred_name || '',
            dob: patient.dob ? patient.dob.split('T')[0] : '',
            sex: patient.sex || '',
            gender: patient.gender || '',
            marital_status: patient.marital_status || '',
            race: patient.race || '',
            ethnicity: patient.ethnicity || '',
            mrn: patient.mrn || '',

            // Contact
            phone: patient.phone || '',
            phone_cell: patient.phone_cell || '',
            phone_work: patient.phone_work || '',
            email: patient.email || '',
            preferred_language: patient.preferred_language || 'English',

            // Address
            address_line1: patient.address_line1 || '',
            address_line2: patient.address_line2 || '',
            city: patient.city || '',
            state: patient.state || '',
            zip: patient.zip || '',

            // Employment
            employment_status: patient.employment_status || '',
            occupation: patient.occupation || '',
            employer_name: patient.employer_name || '',

            // Insurance
            insurance_provider: patient.insurance_provider || '',
            insurance_id: patient.insurance_id || '',
            insurance_group_number: patient.insurance_group_number || '',
            insurance_plan_name: patient.insurance_plan_name || '',
            insurance_subscriber_name: patient.insurance_subscriber_name || '',

            // Pharmacy
            pharmacy_name: patient.pharmacy_name || '',
            pharmacy_phone: patient.pharmacy_phone || '',

            // Emergency
            emergency_contact_name: patient.emergency_contact_name || '',
            emergency_contact_phone: patient.emergency_contact_phone || '',
            emergency_contact_relationship: patient.emergency_contact_relationship || ''
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Convert snake_case to camelCase for API
            const payload = {};
            Object.keys(editForm).forEach(key => {
                const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                payload[camelKey] = editForm[key];
            });

            await api.put(`/patients/${patient.id}`, payload);
            onUpdate?.(); // Refresh parent if callback provided

            // If we fetched locally, we should update strict state too
            if (fetchedPatient) {
                const response = await api.get(`/patients/${patient.id}`);
                setFetchedPatient(response.data);
            }

            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update patient", err);
            alert("Failed to save changes.");
        } finally {
            setLoading(false);
        }
    };

    // Helper to render form fields
    const renderField = (label, key, type = "text", options = null, width = "w-full") => (
        <div className="mb-2">
            <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">{label}</label>
            {options ? (
                <select
                    className={`border border-gray-300 rounded px-2 py-1 text-xs ${width} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={editForm[key]}
                    onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                >
                    <option value="">Select...</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    className={`border border-gray-300 rounded px-2 py-1 text-xs ${width} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={editForm[key]}
                    onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                />
            )}
        </div>
    );

    // US States
    const usStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    // Helper for grid items (View Mode)
    const InfoItem = ({ icon: Icon, label, value, subValue, onClick }) => (
        <div
            className={`flex items-start gap-2 p-2 rounded-md transition-colors ${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="mt-0.5 text-gray-400">
                <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">
                    {label}
                </div>
                <div className="text-xs font-medium text-gray-900 truncate" title={value}>
                    {value || <span className="text-gray-400 italic">Not set</span>}
                </div>
                {subValue && (
                    <div className="text-[10px] text-gray-500 truncate">{subValue}</div>
                )}
            </div>
        </div>
    );

    // Default handler for Open Chart
    const handleOpenChart = () => {
        if (onOpenChart) {
            onOpenChart();
        } else {
            const targetId = patient?.id || id;
            if (targetId) {
                navigate(`/patient/${targetId}/snapshot?tab=history`);
            }
        }
    };



    if (isEditing) {
        return (
            <div className="bg-white border border-blue-200 shadow-md rounded-lg mb-6 overflow-hidden ring-2 ring-blue-100">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-800 flex items-center gap-2">
                        <Edit2 size={16} />
                        Update Patient Demographics
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm flex items-center gap-1.5"
                        >
                            {loading ? 'Saving...' : <><Check size={14} /> Save Changes</>}
                        </button>
                    </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Identity Section */}
                    <div className="space-y-1">
                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2 text-sm">Identity</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("First Name", "first_name")}
                            {renderField("Last Name", "last_name")}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("Middle Name", "middle_name")}
                            {renderField("Suffix", "name_suffix", "text", ["Jr", "Sr", "II", "III", "IV"])}
                        </div>
                        {renderField("Preferred Name", "preferred_name")}
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("DOB", "dob", "date")}
                            {renderField("Sex", "sex", "text", ["M", "F", "Other"])}
                        </div>
                        {renderField("Gender Identity", "gender", "text", ["Male", "Female", "Non-binary", "Transgender Male", "Transgender Female"])}
                        {renderField("Marital Status", "marital_status", "text", ["Single", "Married", "Divorced", "Widowed", "Partnered"])}
                    </div>

                    {/* Contact & Address */}
                    <div className="space-y-1">
                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2 text-sm">Contact & Address</h4>
                        {renderField("Primary Phone", "phone", "tel")}
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("Cell Phone", "phone_cell", "tel")}
                            {renderField("Work Phone", "phone_work", "tel")}
                        </div>
                        {renderField("Email", "email", "email")}

                        <div className="pt-2 border-t border-dashed mt-2">
                            {renderField("Street Address", "address_line1")}
                            {renderField("Apt / Suite", "address_line2")}
                            <div className="grid grid-cols-3 gap-2">
                                {renderField("City", "city")}
                                {renderField("State", "state", "text", usStates)}
                                {renderField("Zip", "zip")}
                            </div>
                        </div>
                    </div>

                    {/* Insurance & Employment */}
                    <div className="space-y-1">
                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2 text-sm">Insurance & Employment</h4>
                        {renderField("Primary Insurance", "insurance_provider")}
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("Member ID", "insurance_id")}
                            {renderField("Group No.", "insurance_group_number")}
                        </div>
                        {renderField("Plan Name", "insurance_plan_name")}
                        {renderField("Subscriber Name", "insurance_subscriber_name")}

                        <div className="pt-2 border-t border-dashed mt-2">
                            {renderField("Employment Status", "employment_status", "text", ["Employed", "Unemployed", "Retired", "Student", "Disabled"])}
                            {renderField("Occupation", "occupation")}
                            {renderField("Employer", "employer_name")}
                        </div>
                    </div>

                    {/* Medical & Emergency */}
                    <div className="space-y-1">
                        <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2 text-sm">Emergency & Pharmacy</h4>
                        {renderField("Emergency Contact", "emergency_contact_name")}
                        <div className="grid grid-cols-2 gap-2">
                            {renderField("Phone", "emergency_contact_phone", "tel")}
                            {renderField("Relation", "emergency_contact_relationship")}
                        </div>

                        <div className="pt-2 border-t border-dashed mt-2">
                            {renderField("Pharmacy Name", "pharmacy_name")}
                            {renderField("Pharmacy Phone", "pharmacy_phone", "tel")}
                        </div>

                        <div className="pt-2 border-t border-dashed mt-2">
                            {renderField("MRN (Internal)", "mrn")}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // View Mode
    return (
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg mb-6 overflow-hidden">
            {/* Top Bar: Identity & Actions */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-blue-50/30 to-transparent">
                <div className="flex items-center gap-5">
                    {/* Photo */}
                    <div className="relative group">
                        <PatientHeaderPhoto
                            firstName={patient.first_name}
                            lastName={patient.last_name}
                            className="w-16 h-16 text-xl shadow-sm ring-2 ring-white"
                        />
                    </div>

                    {/* Name & Key Stats */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            {/* Clicking name also goes to chart as a shortcut */}
                            <span
                                className="cursor-pointer hover:text-blue-800 transition-colors"
                                onClick={() => navigate(`/patient/${patient?.id || id}/snapshot`)}
                            >
                                {patient.first_name} {patient.last_name}
                            </span>
                            <button
                                onClick={handleEditClick}
                                className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
                                title="Edit Patient"
                            >
                                <Edit2 size={14} />
                            </button>
                        </h1>

                        <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                            <span className="font-medium text-gray-900">{calculateAge(patient.dob)} years old</span>
                            <span className="text-gray-300">|</span>
                            <span className="flex items-center gap-1">
                                <span className="text-xs uppercase tracking-wide text-gray-500">DOB</span>
                                {formatDate(patient.dob)}
                            </span>
                            <span className="text-gray-300">|</span>
                            <span className="font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded text-xs">
                                {patient.mrn}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenChart}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all hover:shadow flex items-center gap-2"
                    >
                        <ExternalLink size={16} />
                        Open Chart
                    </button>
                </div>
            </div>

            {/* Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-gray-100">
                {/* Contact */}
                <div className="bg-white p-2">
                    <InfoItem icon={Phone} label="Contact" value={patient.phone} subValue={patient.email} />
                </div>
                {/* Address */}
                <div className="bg-white p-2">
                    <InfoItem icon={MapPin} label="Address" value={patient.address_street} />
                </div>
                {/* Insurance */}
                <div className="bg-white p-2">
                    <InfoItem icon={Shield} label="Insurance" value={patient.insurance_provider || 'Self Pay'} />
                </div>
                {/* Pharmacy */}
                <div className="bg-white p-2">
                    <InfoItem icon={Activity} label="Pharmacy" value={patient.pharmacy_name} />
                </div>
                {/* Emergency */}
                <div className="bg-white p-2">
                    <InfoItem icon={AlertCircle} label="Emergency" value={patient.emergency_contact_name} />
                </div>
            </div>

            {/* Quick Actions Bar - Visible Everywhere */}

        </div>
    );
};

export default PatientHeader;
