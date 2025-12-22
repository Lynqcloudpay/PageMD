import React, { useState } from 'react';
import {
    Phone, Mail, MapPin, Shield, Activity,
    AlertCircle, Edit2, Camera, X, Check,
    ExternalLink, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const PatientHeader = ({ patient, onUpdate, onOpenChart, onOpenToday }) => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [loading, setLoading] = useState(false);

    // Safety check - prevent crash if patient is loading
    if (!patient) return null;

    // Initialize edit form
    const handleEditClick = () => {
        setEditForm({
            first_name: patient.first_name,
            last_name: patient.last_name,
            dob: patient.dob ? patient.dob.split('T')[0] : '', // Keep YYYY-MM-DD for input type="date"
            gender: patient.gender,
            mrn: patient.mrn,
            phone: patient.phone,
            email: patient.email,
            address_street: patient.address_street,
            insurance_provider: patient.insurance_provider,
            pharmacy_name: patient.pharmacy_name,
            emergency_contact_name: patient.emergency_contact_name
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put(`/patients/${patient.id}`, editForm);
            onUpdate(); // Refresh parent
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update patient", err);
            alert("Failed to save changes.");
        } finally {
            setLoading(false);
        }
    };

    // Helper for grid items
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
                        {isEditing ? (
                            <div className="flex gap-2 mb-2">
                                <input
                                    className="border rounded px-2 py-1 text-lg font-bold w-32"
                                    value={editForm.first_name}
                                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                                />
                                <input
                                    className="border rounded px-2 py-1 text-lg font-bold w-32"
                                    value={editForm.last_name}
                                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                                />
                            </div>
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                {patient.first_name} {patient.last_name}
                                <button
                                    onClick={handleEditClick}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
                                    title="Edit Patient"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </h1>
                        )}

                        <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="border rounded px-2 py-1 text-xs"
                                        value={editForm.dob}
                                        onChange={e => setEditForm({ ...editForm, dob: e.target.value })}
                                    />
                                    <input
                                        placeholder="MRN"
                                        className="border rounded px-2 py-1 text-xs w-24"
                                        value={editForm.mrn}
                                        onChange={e => setEditForm({ ...editForm, mrn: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                            >
                                {loading ? 'Saving...' : <><Check size={16} /> Save Changes</>}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onOpenToday}
                                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-transparent rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                Open Today's Visit
                            </button>
                            <button
                                onClick={onOpenChart}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all hover:shadow flex items-center gap-2"
                            >
                                <ExternalLink size={16} />
                                Open Chart
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-gray-100">

                {/* Contact */}
                <div className="bg-white p-2">
                    {isEditing ? (
                        <div className="space-y-2 p-1">
                            <input
                                className="w-full text-xs border rounded p-1"
                                placeholder="Phone"
                                value={editForm.phone}
                                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            />
                            <input
                                className="w-full text-xs border rounded p-1"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            />
                        </div>
                    ) : (
                        <>
                            <InfoItem icon={Phone} label="Contact" value={patient.phone} subValue={patient.email} />
                        </>
                    )}
                </div>

                {/* Address */}
                <div className="bg-white p-2">
                    {isEditing ? (
                        <textarea
                            className="w-full text-xs border rounded p-1 h-full resize-none"
                            placeholder="Street Address"
                            value={editForm.address_street}
                            onChange={e => setEditForm({ ...editForm, address_street: e.target.value })}
                        />
                    ) : (
                        <InfoItem icon={MapPin} label="Address" value={patient.address_street} />
                    )}
                </div>

                {/* Insurance */}
                <div className="bg-white p-2">
                    {isEditing ? (
                        <input
                            className="w-full text-xs border rounded p-1"
                            placeholder="Insurance Provider"
                            value={editForm.insurance_provider}
                            onChange={e => setEditForm({ ...editForm, insurance_provider: e.target.value })}
                        />
                    ) : (
                        <InfoItem icon={Shield} label="Insurance" value={patient.insurance_provider || 'Self Pay'} />
                    )}
                </div>

                {/* Pharmacy */}
                <div className="bg-white p-2">
                    {isEditing ? (
                        <input
                            className="w-full text-xs border rounded p-1"
                            placeholder="Pharmacy Name"
                            value={editForm.pharmacy_name}
                            onChange={e => setEditForm({ ...editForm, pharmacy_name: e.target.value })}
                        />
                    ) : (
                        <InfoItem icon={Activity} label="Pharmacy" value={patient.pharmacy_name} />
                    )}
                </div>

                {/* Emergency */}
                <div className="bg-white p-2">
                    {isEditing ? (
                        <input
                            className="w-full text-xs border rounded p-1"
                            placeholder="Emergency Contact"
                            value={editForm.emergency_contact_name}
                            onChange={e => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                        />
                    ) : (
                        <InfoItem icon={AlertCircle} label="Emergency" value={patient.emergency_contact_name} />
                    )}
                </div>

            </div>
        </div>
    );
};

export default PatientHeader;
