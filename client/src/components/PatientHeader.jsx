import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    User, Phone, Mail, MapPin, CreditCard, Building2, Users,
    Edit, Camera, X, Check, ChevronDown, ChevronUp,
    Pill, FileText, Send, Upload, AlertCircle
} from 'lucide-react';
import { PrescriptionModal, OrderModal, ReferralModal, UploadModal } from './ActionModals';
import Toast from './ui/Toast';
import { usePatient } from '../context/PatientContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { patientsAPI } from '../services/api';

const PatientHeader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getPatient } = usePatient();
    const { addTab } = usePatientTabs();

    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [toast, setToast] = useState(null);

    // Edit state
    const [editMode, setEditMode] = useState(null); // 'phone', 'email', 'address', 'insurance', 'pharmacy', 'emergency'
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // Photo state
    const [showPhotoUpload, setShowPhotoUpload] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);

    // Modals
    const [activeModal, setActiveModal] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Fetch patient data
    useEffect(() => {
        const fetchPatient = async () => {
            if (!id) return;
            try {
                setLoading(true);
                // Try context first
                let patientData = getPatient(id);
                if (!patientData) {
                    const response = await patientsAPI.getById(id);
                    patientData = response.data;
                }

                // Normalize field names
                const normalized = {
                    ...patientData,
                    firstName: patientData.firstName || patientData.first_name,
                    lastName: patientData.lastName || patientData.last_name,
                    dob: patientData.dob || patientData.date_of_birth,
                    phone: patientData.phone,
                    email: patientData.email,
                    addressLine1: patientData.addressLine1 || patientData.address_line1,
                    city: patientData.city,
                    state: patientData.state,
                    zip: patientData.zip,
                    insuranceProvider: patientData.insuranceProvider || patientData.insurance_provider,
                    insuranceId: patientData.insuranceId || patientData.insurance_id,
                    pharmacyName: patientData.pharmacyName || patientData.pharmacy_name,
                    pharmacyPhone: patientData.pharmacyPhone || patientData.pharmacy_phone,
                    emergencyContactName: patientData.emergencyContactName || patientData.emergency_contact_name,
                    emergencyContactPhone: patientData.emergencyContactPhone || patientData.emergency_contact_phone,
                    emergencyContactRelationship: patientData.emergencyContactRelationship || patientData.emergency_contact_relationship,
                    photoUrl: patientData.photoUrl || patientData.photo_url
                };

                setPatient(normalized);
                addTab(id, `${normalized.firstName} ${normalized.lastName}`, `/patient/${id}`);
            } catch (error) {
                console.error('Error fetching patient:', error);
                showToast('Failed to load patient', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchPatient();
    }, [id, getPatient, addTab, showToast]);

    // Calculate age
    const calculateAge = (dob) => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Format phone number
    const formatPhone = (phone) => {
        if (!phone) return '—';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    // Start editing
    const startEdit = (field) => {
        const form = {};
        switch (field) {
            case 'phone':
                form.phone = patient.phone || '';
                break;
            case 'email':
                form.email = patient.email || '';
                break;
            case 'address':
                form.addressLine1 = patient.addressLine1 || '';
                form.city = patient.city || '';
                form.state = patient.state || '';
                form.zip = patient.zip || '';
                break;
            case 'insurance':
                form.insuranceProvider = patient.insuranceProvider || '';
                form.insuranceId = patient.insuranceId || '';
                break;
            case 'pharmacy':
                form.pharmacyName = patient.pharmacyName || '';
                form.pharmacyPhone = patient.pharmacyPhone || '';
                break;
            case 'emergency':
                form.emergencyContactName = patient.emergencyContactName || '';
                form.emergencyContactPhone = patient.emergencyContactPhone || '';
                form.emergencyContactRelationship = patient.emergencyContactRelationship || '';
                break;
        }
        setEditForm(form);
        setEditMode(field);
    };

    // Save edit
    const saveEdit = async () => {
        if (!id || !editMode) return;
        setSaving(true);

        try {
            // Clean phone numbers
            const cleanPhone = (val) => val ? val.replace(/\D/g, '') : null;

            const updateData = { ...editForm };
            if (updateData.phone) updateData.phone = cleanPhone(updateData.phone);
            if (updateData.pharmacyPhone) updateData.pharmacyPhone = cleanPhone(updateData.pharmacyPhone);
            if (updateData.emergencyContactPhone) updateData.emergencyContactPhone = cleanPhone(updateData.emergencyContactPhone);

            await patientsAPI.update(id, updateData);

            // Update local state
            setPatient(prev => ({ ...prev, ...editForm }));
            setEditMode(null);
            showToast('Updated successfully');
        } catch (error) {
            console.error('Error updating patient:', error);
            showToast(error.response?.data?.error || 'Failed to update', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Handle photo upload
    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('Photo must be under 5MB', 'error');
            return;
        }

        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);
        setShowPhotoUpload(true);
    };

    const savePhoto = async () => {
        if (!photoFile || !id) return;
        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('photo', photoFile);

            const response = await patientsAPI.uploadPhoto(id, formData);
            const newUrl = response.data?.photoUrl || response.data?.photo_url;

            if (newUrl) {
                setPatient(prev => ({ ...prev, photoUrl: newUrl }));
            }

            setShowPhotoUpload(false);
            setPhotoPreview(null);
            setPhotoFile(null);
            showToast('Photo updated');
        } catch (error) {
            console.error('Error uploading photo:', error);
            showToast('Failed to upload photo', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !patient) {
        return (
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="animate-pulse flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
                    <div className="space-y-2">
                        <div className="h-5 bg-gray-200 rounded w-48"></div>
                        <div className="h-4 bg-gray-100 rounded w-32"></div>
                    </div>
                </div>
            </div>
        );
    }

    const age = calculateAge(patient.dob);
    const initials = `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();

    // Editable info card component
    const InfoCard = ({ icon: Icon, label, value, field, color = 'gray' }) => {
        const isEditing = editMode === field;

        return (
            <div className={`group relative flex items-start gap-2 p-2 rounded-lg transition-colors ${isEditing ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-gray-50'}`}>
                <div className={`p-1.5 rounded-md bg-${color}-50`}>
                    <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
                    {isEditing ? (
                        <div className="space-y-1.5 mt-1">
                            {field === 'phone' && (
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="(555) 555-5555"
                                    autoFocus
                                />
                            )}
                            {field === 'email' && (
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="email@example.com"
                                    autoFocus
                                />
                            )}
                            {field === 'address' && (
                                <>
                                    <input
                                        type="text"
                                        value={editForm.addressLine1}
                                        onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="Street address"
                                        autoFocus
                                    />
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            value={editForm.city}
                                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                                            placeholder="City"
                                        />
                                        <input
                                            type="text"
                                            value={editForm.state}
                                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                                            className="w-14 text-sm border border-gray-200 rounded px-2 py-1"
                                            placeholder="ST"
                                        />
                                        <input
                                            type="text"
                                            value={editForm.zip}
                                            onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                                            className="w-20 text-sm border border-gray-200 rounded px-2 py-1"
                                            placeholder="ZIP"
                                        />
                                    </div>
                                </>
                            )}
                            {field === 'insurance' && (
                                <>
                                    <input
                                        type="text"
                                        value={editForm.insuranceProvider}
                                        onChange={(e) => setEditForm({ ...editForm, insuranceProvider: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="Insurance provider"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        value={editForm.insuranceId}
                                        onChange={(e) => setEditForm({ ...editForm, insuranceId: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                                        placeholder="Member ID"
                                    />
                                </>
                            )}
                            {field === 'pharmacy' && (
                                <>
                                    <input
                                        type="text"
                                        value={editForm.pharmacyName}
                                        onChange={(e) => setEditForm({ ...editForm, pharmacyName: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="Pharmacy name"
                                        autoFocus
                                    />
                                    <input
                                        type="tel"
                                        value={editForm.pharmacyPhone}
                                        onChange={(e) => setEditForm({ ...editForm, pharmacyPhone: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                                        placeholder="Phone"
                                    />
                                </>
                            )}
                            {field === 'emergency' && (
                                <>
                                    <input
                                        type="text"
                                        value={editForm.emergencyContactName}
                                        onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="Contact name"
                                        autoFocus
                                    />
                                    <div className="flex gap-1">
                                        <input
                                            type="tel"
                                            value={editForm.emergencyContactPhone}
                                            onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                                            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                                            placeholder="Phone"
                                        />
                                        <input
                                            type="text"
                                            value={editForm.emergencyContactRelationship}
                                            onChange={(e) => setEditForm({ ...editForm, emergencyContactRelationship: e.target.value })}
                                            className="w-24 text-sm border border-gray-200 rounded px-2 py-1"
                                            placeholder="Relation"
                                        />
                                    </div>
                                </>
                            )}
                            <div className="flex gap-1 pt-1">
                                <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded disabled:opacity-50"
                                >
                                    <Check className="w-3 h-3" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditMode(null)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-3 h-3" />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-700 truncate">{value || '—'}</span>
                            <button
                                onClick={() => startEdit(field)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-primary-600 transition-opacity"
                            >
                                <Edit className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="bg-white border-b border-gray-200 shadow-sm">
                {/* Main Header Row */}
                <div className="px-6 py-3 flex items-center justify-between">
                    {/* Left: Avatar + Name */}
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative group">
                            <div
                                onClick={() => document.getElementById('photo-input').click()}
                                className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 border-2 border-white shadow-md flex items-center justify-center cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary-200 transition-all"
                            >
                                {patient.photoUrl ? (
                                    <img
                                        src={`${patient.photoUrl}?v=${Date.now()}`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <span className="text-lg font-bold text-primary-600">{initials}</span>
                                )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => document.getElementById('photo-input').click()}>
                                <Camera className="w-5 h-5 text-white" />
                            </div>
                            <input
                                id="photo-input"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoSelect}
                                className="hidden"
                            />
                        </div>

                        {/* Name & Basic Info */}
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                {patient.firstName} {patient.lastName}
                            </h1>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="font-medium text-gray-700">{age}y {patient.sex?.charAt(0) || ''}</span>
                                <span>•</span>
                                <span>DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : '—'}</span>
                                <span>•</span>
                                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">MRN: {patient.mrn}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Quick Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveModal('order')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Order
                        </button>
                        <button
                            onClick={() => setActiveModal('prescription')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <Pill className="w-4 h-4" />
                            Rx
                        </button>
                        <button
                            onClick={() => setActiveModal('referral')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            Refer
                        </button>
                        <button
                            onClick={() => setActiveModal('upload')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            Upload
                        </button>

                        {/* Expand/Collapse */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Expandable Details */}
                {isExpanded && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                            <InfoCard icon={Phone} label="Phone" value={formatPhone(patient.phone)} field="phone" color="blue" />
                            <InfoCard icon={Mail} label="Email" value={patient.email} field="email" color="purple" />
                            <InfoCard
                                icon={MapPin}
                                label="Address"
                                value={[patient.addressLine1, patient.city, patient.state, patient.zip].filter(Boolean).join(', ') || '—'}
                                field="address"
                                color="green"
                            />
                            <InfoCard
                                icon={CreditCard}
                                label="Insurance"
                                value={patient.insuranceProvider ? `${patient.insuranceProvider}${patient.insuranceId ? ` • ${patient.insuranceId}` : ''}` : '—'}
                                field="insurance"
                                color="amber"
                            />
                            <InfoCard
                                icon={Building2}
                                label="Pharmacy"
                                value={patient.pharmacyName ? `${patient.pharmacyName}${patient.pharmacyPhone ? ` • ${formatPhone(patient.pharmacyPhone)}` : ''}` : '—'}
                                field="pharmacy"
                                color="teal"
                            />
                            <InfoCard
                                icon={Users}
                                label="Emergency Contact"
                                value={patient.emergencyContactName ? `${patient.emergencyContactName}${patient.emergencyContactRelationship ? ` (${patient.emergencyContactRelationship})` : ''}` : '—'}
                                field="emergency"
                                color="red"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Photo Upload Modal */}
            {showPhotoUpload && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPhotoUpload(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Photo</h3>
                        {photoPreview && (
                            <div className="mb-4 flex justify-center">
                                <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-full object-cover border-4 border-gray-100" />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={savePhoto}
                                disabled={saving}
                                className="flex-1 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Photo'}
                            </button>
                            <button
                                onClick={() => { setShowPhotoUpload(false); setPhotoPreview(null); setPhotoFile(null); }}
                                className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Modals */}
            <OrderModal
                isOpen={activeModal === 'order'}
                onClose={() => setActiveModal(null)}
                onSuccess={() => { setActiveModal(null); showToast('Order added'); }}
                patientId={id}
            />
            <PrescriptionModal
                isOpen={activeModal === 'prescription'}
                onClose={() => setActiveModal(null)}
                onSuccess={() => { setActiveModal(null); showToast('Prescription added'); }}
            />
            <ReferralModal
                isOpen={activeModal === 'referral'}
                onClose={() => setActiveModal(null)}
                onSuccess={() => { setActiveModal(null); showToast('Referral created'); }}
            />
            <UploadModal
                isOpen={activeModal === 'upload'}
                onClose={() => setActiveModal(null)}
                patientId={id}
                onSuccess={() => { setActiveModal(null); showToast('Document uploaded'); }}
            />
        </>
    );
};

export default PatientHeader;
