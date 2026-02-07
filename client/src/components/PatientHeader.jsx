import React, { useState, useEffect } from 'react';
import {
    Phone, Mail, MapPin, Shield, Activity,
    AlertCircle, Edit2, Camera, X, Check,
    ExternalLink, Calendar, FileText, Upload, Pill, Receipt, Users,
    Lock, User, AlertTriangle, FlaskConical, ChevronDown, MessageSquare
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import PatientHeaderPhoto from './PatientHeaderPhoto';
import PortalInviteModal from './PortalInviteModal';
import PortalResetPasswordModal from './PortalResetPasswordModal';
import PatientFlagsManager from './PatientFlagsManager';
import FlagAcknowledgmentModal from './FlagAcknowledgmentModal';
import { patientFlagsAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';
import PatientPhotoModal from './PatientPhotoModal';

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

const PatientHeader = ({ patient: propPatient, onUpdate, onOpenChart, onOpenToday, onAction, onMessage }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { can } = usePermissions();
    const canEditSettings = can('settings:edit');
    const [fetchedPatient, setFetchedPatient] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [loading, setLoading] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);
    const [inviteData, setInviteData] = useState(null);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    // Flags State
    const [flags, setFlags] = useState([]);
    const [isFlagsPanelOpen, setIsFlagsPanelOpen] = useState(false);
    const [unacknowledgedCriticalFlags, setUnacknowledgedCriticalFlags] = useState([]);
    const [showAckModal, setShowAckModal] = useState(false);

    // Use passed patient or fetched patient
    const patient = propPatient || fetchedPatient;

    // Fetch patient & flags
    useEffect(() => {
        const fetchData = async () => {
            if (!propPatient && id && !fetchedPatient) {
                try {
                    const response = await api.get(`/patients/${id}`);
                    setFetchedPatient(response.data);
                } catch (error) {
                    console.error("Failed to fetch patient for header:", error);
                }
            }

            if (id) {
                try {
                    const flagsRes = await patientFlagsAPI.getByPatient(id);
                    const allFlags = flagsRes.data || [];
                    setFlags(allFlags);

                    // Check for critical flags requiring acknowledgment
                    const criticalReqAck = allFlags.filter(f =>
                        f.status === 'active' &&
                        f.requires_acknowledgment &&
                        !f.current_user_acknowledged
                    );

                    if (criticalReqAck.length > 0) {
                        setUnacknowledgedCriticalFlags(criticalReqAck);
                        setShowAckModal(true);
                    }
                } catch (err) {
                    console.error("Failed to fetch flags:", err);
                }
            }
        };
        fetchData();
    }, [propPatient, id, fetchedPatient]);

    const refreshFlags = async () => {
        if (id) {
            const flagsRes = await patientFlagsAPI.getByPatient(id);
            setFlags(flagsRes.data || []);
        }
    };

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
            pharmacy_address: patient.pharmacy_address || '',

            // Emergency
            emergency_contact_name: patient.emergency_contact_name || '',
            emergency_contact_phone: patient.emergency_contact_phone || '',
            emergency_contact_relationship: patient.emergency_contact_relationship || '',

            // Privacy
            is_restricted: patient.is_restricted || false,
            restriction_reason: patient.restriction_reason || ''
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
    const InfoItem = ({ icon: Icon, label, children, onClick }) => (
        <div
            className={`flex items-start gap-2 p-2 rounded-md transition-colors h-full ${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="mt-0.5 text-gray-400 flex-shrink-0">
                <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1">
                    {label}
                </div>
                <div className="text-xs text-gray-900">
                    {children}
                </div>
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
                            {renderField("Pharmacy Address", "pharmacy_address")}
                        </div>

                        <div className="pt-2 border-t border-dashed mt-2">
                            {renderField("MRN (Internal)", "mrn")}
                        </div>

                        {canEditSettings && (
                            <div className="pt-4 border-t-2 border-red-100 mt-4 space-y-3">
                                <h4 className="font-black text-red-600 uppercase tracking-widest text-[10px]">Privacy & Security</h4>
                                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                                    <input
                                        type="checkbox"
                                        id="is_restricted"
                                        checked={editForm.is_restricted}
                                        onChange={e => setEditForm({ ...editForm, is_restricted: e.target.checked })}
                                        className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
                                    />
                                    <label htmlFor="is_restricted" className="text-xs font-black text-red-700 uppercase tracking-tighter">
                                        Restrict Chart (Break-the-Glass)
                                    </label>
                                </div>
                                {editForm.is_restricted && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        {renderField("Restriction Reason", "restriction_reason", "text", ["VIP / Famous Patient", "Employee Record", "Family Record", "Sensitive Condition", "Security Concern"])}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // View Mode
    const activeFlags = flags.filter(f => f.status === 'active');
    const bannerFlags = activeFlags
        .sort((a, b) => (b.severity === 'critical' ? 1 : -1))
        .slice(0, 2);

    return (
        <div className="flex flex-col gap-0 mb-4 relative">
            {/* Acknowledgment Modal */}
            {showAckModal && (
                <FlagAcknowledgmentModal
                    flags={unacknowledgedCriticalFlags}
                    onAcknowledged={() => setShowAckModal(false)}
                />
            )}

            <div className="bg-white border border-gray-200 shadow-sm rounded-lg">
                {/* Flags Manager Panel */}
                {isFlagsPanelOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                        <div className="w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300">
                            <PatientFlagsManager
                                patientId={patient.id}
                                onClose={() => setIsFlagsPanelOpen(false)}
                                onUpdate={refreshFlags}
                            />
                        </div>
                    </div>
                )}
                {/* Top Bar: Identity & Actions */}
                <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-gradient-to-br from-blue-50/50 via-sky-50 to-indigo-50/50 text-slate-900 relative shadow-sm rounded-t-lg">
                    {/* Decorative Background Elements - Clipped in own container */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-lg">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/20 rounded-full blur-3xl -mr-20 -mt-20" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100/20 rounded-full blur-3xl -ml-10 -mb-10" />
                    </div>

                    <div className="flex items-center gap-5 relative z-10">
                        {/* Photo */}
                        <div className="relative group">
                            <PatientHeaderPhoto
                                firstName={patient.first_name}
                                lastName={patient.last_name}
                                photoUrl={patient.photo_url}
                                className="w-20 h-20 text-2xl shadow-lg ring-4 ring-white/60 cursor-pointer hover:ring-white/80 hover:scale-105 transition-all duration-300"
                                onClick={() => setIsPhotoModalOpen(true)}
                            />
                            <button
                                onClick={() => setIsPhotoModalOpen(true)}
                                className="absolute bottom-0 right-0 p-2 bg-white text-blue-500 rounded-full shadow-lg border border-blue-100 hover:bg-blue-50 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Camera size={14} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Name & Key Stats */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <h1
                                    className="text-2xl font-bold tracking-tight text-slate-900 cursor-pointer hover:text-blue-600 transition-colors select-none"
                                    onClick={() => navigate(`/patient/${patient?.id || id}/snapshot`)}
                                >
                                    {patient.first_name || ''} {patient.last_name || ''}
                                </h1>
                                <button
                                    onClick={handleEditClick}
                                    className="p-1.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                    title="Edit Patient Demographics"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                {/* Age & Sex Combined Pill */}
                                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-blue-100 text-slate-600 rounded-full text-[11px] font-semibold shadow-sm">
                                    <User className="w-3 h-3 text-blue-400" />
                                    <span>{calculateAge(patient.dob)}y • {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : patient.sex || 'N/A'}</span>
                                </div>

                                {/* DOB Pill */}
                                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-blue-100 text-slate-600 rounded-full text-[11px] font-semibold shadow-sm">
                                    <Calendar className="w-3 h-3 text-indigo-400" />
                                    <span>{formatDate(patient.dob)}</span>
                                </div>

                                {/* MRN Pill - Distinct Contrast */}
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm">
                                    <span className="opacity-60">MRN:</span>
                                    <span>{patient.mrn}</span>
                                </div>

                                {/* Status Flags */}
                                {/* Status Flags */}
                                <button
                                    onClick={() => setIsFlagsPanelOpen(true)}
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all ${activeFlags.length > 0
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {activeFlags.length > 0 ? (
                                        <AlertTriangle size={11} className="text-rose-500" />
                                    ) : (
                                        <Shield size={11} className="text-slate-400" />
                                    )}
                                    {activeFlags.length > 0
                                        ? `${activeFlags.length} ${activeFlags.length === 1 ? 'Clinical Alert' : 'Clinical Alerts'}`
                                        : 'Clinical Alerts'}
                                </button>

                                {patient.is_restricted && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                        <Lock size={11} className="text-rose-400" />
                                        Restricted
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="flex items-center gap-3 relative z-10">
                        {/* Portal Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsPortalMenuOpen(!isPortalMenuOpen)}
                                className={`px-4 py-2 text-[13px] font-bold rounded-xl border transition-all flex items-center gap-2 shadow-sm ${isPortalMenuOpen
                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <Users size={16} />
                                Patient Portal
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isPortalMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isPortalMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[90]"
                                        onClick={() => setIsPortalMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] py-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                        <div className="px-4 py-2 mb-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portal Management</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsPortalMenuOpen(false);
                                                setInviteData(null);
                                                setIsInviteModalOpen(true);
                                            }}
                                            className="w-full px-4 py-3 text-left text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                <Users size={14} />
                                            </div>
                                            Invite to Patient Portal
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsPortalMenuOpen(false);
                                                setIsResetModalOpen(true);
                                            }}
                                            className="w-full px-4 py-3 text-left text-[11px] font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-3 transition-colors border-t border-slate-50"
                                        >
                                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                                                <Lock size={14} />
                                            </div>
                                            Reset Portal Password
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <PortalInviteModal
                            isOpen={isInviteModalOpen}
                            onClose={() => setIsInviteModalOpen(false)}
                            patient={patient}
                            inviteData={inviteData}
                        />

                        <PortalResetPasswordModal
                            isOpen={isResetModalOpen}
                            onClose={() => setIsResetModalOpen(false)}
                            patient={patient}
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onMessage) onMessage();
                                else onAction?.('message');
                            }}
                            className="px-4 py-2.5 text-[13px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2"
                        >
                            <MessageSquare size={16} strokeWidth={2.5} />
                            Message
                        </button>
                        <button
                            onClick={handleOpenChart}
                            className="px-5 py-2.5 text-[13px] font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <ExternalLink size={16} strokeWidth={2} />
                            Open Chart
                        </button>
                    </div>

                </div>

                {/* Detail Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-slate-100 border-t border-slate-100">
                    {/* Contact */}
                    <div className="bg-white p-2 px-4 border-r border-slate-50">
                        <InfoItem icon={Phone} label="Contact" color="text-blue-500">
                            <div className="font-semibold text-[11px] text-slate-900 leading-tight truncate">{patient.phone || <span className="text-slate-300 font-normal italic">No phone</span>}</div>
                            {patient.email && <div className="text-slate-400 text-[10px] font-medium truncate leading-tight mt-0.5">{patient.email}</div>}
                        </InfoItem>
                    </div>
                    {/* Address */}
                    <div className="bg-white p-2 px-4 border-r border-slate-50">
                        <InfoItem icon={MapPin} label="Primary Address" color="text-indigo-500">
                            <div className="font-semibold text-[11px] text-slate-900 leading-tight truncate">{patient.address_line1 || <span className="text-slate-300 font-normal italic">Not set</span>}</div>
                            {patient.city && <div className="text-slate-400 text-[10px] font-medium truncate leading-tight mt-0.5">{patient.city}, {patient.state}</div>}
                        </InfoItem>
                    </div>
                    {/* Insurance */}
                    <div className="bg-white p-2 px-4 border-r border-slate-50">
                        <InfoItem icon={Shield} label="Insurance" color="text-emerald-500">
                            <div className="font-semibold text-[11px] text-slate-900 leading-tight truncate">{patient.insurance_provider || <span className="text-slate-300 font-normal italic">Self Pay</span>}</div>
                            {patient.insurance_id && <div className="text-slate-400 text-[10px] font-medium truncate leading-tight mt-0.5">ID: {patient.insurance_id}</div>}
                        </InfoItem>
                    </div>
                    {/* Pharmacy */}
                    <div className="bg-white p-2 px-4 border-r border-slate-50">
                        <InfoItem icon={FlaskConical} label="Pharmacy" color="text-amber-500">
                            <div className="font-semibold text-[11px] text-slate-900 leading-tight truncate">{patient.pharmacy_name || <span className="text-slate-300 font-normal italic">Not specified</span>}</div>
                            {patient.pharmacy_phone && <div className="text-slate-400 text-[10px] font-medium truncate leading-tight mt-0.5">{patient.pharmacy_phone}</div>}
                        </InfoItem>
                    </div>
                    {/* Emergency */}
                    <div className="bg-white p-2 px-4">
                        <InfoItem icon={AlertTriangle} label="Emergency Contact" color="text-rose-500">
                            <div className="font-semibold text-[11px] text-slate-900 leading-tight truncate">{patient.emergency_contact_name || <span className="text-slate-300 font-normal italic">Not set</span>}</div>
                            {patient.emergency_contact_phone && <div className="text-slate-400 text-[10px] font-medium truncate leading-tight mt-0.5">{patient.emergency_contact_phone}</div>}
                        </InfoItem>
                    </div>
                </div>

                {/* Quick Actions Bar - Visible Everywhere */}

                <PatientPhotoModal
                    isOpen={isPhotoModalOpen}
                    onClose={() => setIsPhotoModalOpen(false)}
                    patient={patient}
                    onUpdate={onUpdate}
                />
            </div>
        </div>
    );
};

export default PatientHeader;
