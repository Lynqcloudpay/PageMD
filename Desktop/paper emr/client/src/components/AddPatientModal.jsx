import React, { useState } from 'react';
import Modal from './ui/Modal';
import { usePatient } from '../context/PatientContext';
import { patientsAPI } from '../services/api';

const AddPatientModal = ({ isOpen, onClose, onSuccess }) => {
    const { addPatient } = usePatient();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dob: '',
        sex: 'F',
        phone: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Try API first, fallback to local if API fails
            try {
                const response = await patientsAPI.create({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    dob: formData.dob,
                    sex: formData.sex,
                    phone: formData.phone,
                    email: formData.email
                });
                const newPatient = response.data;
                addPatient({
                    id: newPatient.id || Date.now(),
                    name: `${newPatient.first_name} ${newPatient.last_name}`,
                    mrn: newPatient.mrn,
                    dob: newPatient.dob,
                    sex: newPatient.sex,
                    phone: newPatient.phone,
                    age: new Date().getFullYear() - new Date(newPatient.dob).getFullYear()
                });
                onSuccess(`Patient ${newPatient.first_name} ${newPatient.last_name} enrolled successfully`);
            } catch (apiError) {
                // Fallback to local storage if API is not available
                console.warn('API not available, using local storage:', apiError);
                const age = new Date().getFullYear() - new Date(formData.dob).getFullYear();
                const newPatient = addPatient({ 
                    name: `${formData.firstName} ${formData.lastName}`,
                    dob: formData.dob,
                    sex: formData.sex,
                    phone: formData.phone,
                    age
                });
                onSuccess(`Patient ${newPatient.name} enrolled successfully`);
            }
            setFormData({ firstName: '', lastName: '', dob: '', sex: 'F', phone: '', email: '' });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to enroll patient');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enroll New Patient">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
                        {error}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">First Name</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Last Name</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400"
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Date of Birth</label>
                        <input
                            type="date"
                            required
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={formData.dob}
                            onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Sex</label>
                        <select
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={formData.sex}
                            onChange={e => setFormData({ ...formData, sex: e.target.value })}
                        >
                            <option value="F">Female</option>
                            <option value="M">Male</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Phone Number</label>
                        <input
                            type="tel"
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Email (optional)</label>
                        <input
                            type="email"
                            className="w-full p-2 border border-paper-300 rounded-md"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 border border-paper-300 rounded-md hover:bg-paper-50 disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800 disabled:opacity-50">
                        {loading ? 'Enrolling...' : 'Enroll Patient'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddPatientModal;
