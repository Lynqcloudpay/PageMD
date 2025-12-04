import React, { useState, useEffect } from 'react';
import { X, CreditCard, Pill, Send, FileText, Edit2, Save, Plus, Trash2, Calendar, Building2, MapPin, Phone } from 'lucide-react';
import { patientsAPI, referralsAPI, ordersAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';
import Toast from './ui/Toast';

const PatientHub = ({ patientId, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('insurance');
    const [patient, setPatient] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    
    // Form state for insurance/pharmacy
    const [formData, setFormData] = useState({
        insuranceProvider: '',
        insuranceId: '',
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: ''
    });

    useEffect(() => {
        if (isOpen && patientId) {
            fetchAllData();
        }
    }, [isOpen, patientId]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch patient data
            const patientResponse = await patientsAPI.get(patientId);
            const patientData = patientResponse.data || patientResponse;
            setPatient(patientData);
            
            // Set form data from patient
            setFormData({
                insuranceProvider: patientData.insurance_provider || '',
                insuranceId: patientData.insurance_id || '',
                pharmacyName: patientData.pharmacy_name || '',
                pharmacyAddress: patientData.pharmacy_address || '',
                pharmacyPhone: patientData.pharmacy_phone || ''
            });

            // Fetch referrals
            try {
                const referralsResponse = await referralsAPI.getByPatient(patientId);
                const referralsData = Array.isArray(referralsResponse) 
                    ? referralsResponse 
                    : (referralsResponse?.data || []);
                setReferrals(referralsData);
            } catch (err) {
                console.error('Error fetching referrals:', err);
                setReferrals([]);
            }

            // Fetch prescriptions (orders with type 'rx')
            try {
                const ordersResponse = await ordersAPI.getByPatient(patientId);
                const ordersData = Array.isArray(ordersResponse)
                    ? ordersResponse
                    : (ordersResponse?.data || []);
                const rxOrders = ordersData.filter(order => order.order_type === 'rx');
                setPrescriptions(rxOrders);
            } catch (err) {
                console.error('Error fetching prescriptions:', err);
                setPrescriptions([]);
            }

            // Fetch documents
            try {
                const docsResponse = await documentsAPI.getByPatient(patientId);
                const docsData = Array.isArray(docsResponse)
                    ? docsResponse
                    : (docsResponse?.data || []);
                setDocuments(docsData);
            } catch (err) {
                console.error('Error fetching documents:', err);
                setDocuments([]);
            }
        } catch (error) {
            console.error('Error fetching patient hub data:', error);
            showToast('Failed to load patient information', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update patient with insurance and pharmacy info
            const updateData = {
                insuranceProvider: formData.insuranceProvider,
                insuranceId: formData.insuranceId,
                pharmacyName: formData.pharmacyName,
                pharmacyAddress: formData.pharmacyAddress,
                pharmacyPhone: formData.pharmacyPhone
            };

            await patientsAPI.update(patientId, updateData);
            setEditing(false);
            await fetchAllData(); // Refresh data
            showToast('Patient information updated successfully');
        } catch (error) {
            console.error('Error updating patient:', error);
            showToast('Failed to update patient information', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'insurance', label: 'Insurance', icon: CreditCard },
        { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
        { id: 'referrals', label: 'Referrals', icon: Send },
        { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
        { id: 'documents', label: 'Documents', icon: FileText }
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-paper-200 bg-paper-50">
                    <h2 className="text-xl font-serif font-bold text-ink-900">Patient Hub</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-paper-200 rounded-md text-ink-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-paper-200 bg-white overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-paper-700 text-paper-700 bg-paper-50'
                                        : 'border-transparent text-ink-600 hover:text-ink-900 hover:bg-paper-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12 text-ink-500">Loading...</div>
                    ) : (
                        <>
                            {/* Insurance Tab */}
                            {activeTab === 'insurance' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-ink-900">Insurance Information</h3>
                                        {!editing && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-paper-100 hover:bg-paper-200 text-ink-700 rounded-md"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                <span>Edit</span>
                                            </button>
                                        )}
                                    </div>

                                    {editing ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-ink-700 mb-1">
                                                    Insurance Provider
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.insuranceProvider}
                                                    onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                                    placeholder="e.g., Blue Cross Blue Shield"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-ink-700 mb-1">
                                                    Insurance ID / Member Number
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.insuranceId}
                                                    onChange={(e) => setFormData({ ...formData, insuranceId: e.target.value })}
                                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                                    placeholder="Member ID"
                                                />
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="flex items-center space-x-2 px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>{saving ? 'Saving...' : 'Save'}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditing(false);
                                                        // Reset form data
                                                        setFormData({
                                                            insuranceProvider: patient?.insurance_provider || '',
                                                            insuranceId: patient?.insurance_id || '',
                                                            pharmacyName: patient?.pharmacy_name || '',
                                                            pharmacyAddress: patient?.pharmacy_address || '',
                                                            pharmacyPhone: patient?.pharmacy_phone || ''
                                                        });
                                                    }}
                                                    className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 bg-paper-50 p-4 rounded-lg border border-paper-200">
                                            <div>
                                                <span className="text-sm font-medium text-ink-600">Insurance Provider:</span>
                                                <p className="text-ink-900 mt-1">
                                                    {patient?.insurance_provider || 'Not set'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-ink-600">Insurance ID:</span>
                                                <p className="text-ink-900 mt-1">
                                                    {patient?.insurance_id || 'Not set'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pharmacy Tab */}
                            {activeTab === 'pharmacy' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-ink-900">Pharmacy Information</h3>
                                        {!editing && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-paper-100 hover:bg-paper-200 text-ink-700 rounded-md"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                <span>Edit</span>
                                            </button>
                                        )}
                                    </div>

                                    {editing ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-ink-700 mb-1">
                                                    Pharmacy Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.pharmacyName}
                                                    onChange={(e) => setFormData({ ...formData, pharmacyName: e.target.value })}
                                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                                    placeholder="e.g., CVS Pharmacy"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-ink-700 mb-1">
                                                    Pharmacy Address
                                                </label>
                                                <textarea
                                                    value={formData.pharmacyAddress}
                                                    onChange={(e) => setFormData({ ...formData, pharmacyAddress: e.target.value })}
                                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                                    rows="2"
                                                    placeholder="Street address, City, State ZIP"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-ink-700 mb-1">
                                                    Pharmacy Phone
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.pharmacyPhone}
                                                    onChange={(e) => setFormData({ ...formData, pharmacyPhone: e.target.value })}
                                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                                    placeholder="(555) 123-4567"
                                                />
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="flex items-center space-x-2 px-4 py-2 text-white rounded-md disabled:opacity-50 transition-all duration-200 hover:shadow-md"
                                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>{saving ? 'Saving...' : 'Save'}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditing(false);
                                                        setFormData({
                                                            insuranceProvider: patient?.insurance_provider || '',
                                                            insuranceId: patient?.insurance_id || '',
                                                            pharmacyName: patient?.pharmacy_name || '',
                                                            pharmacyAddress: patient?.pharmacy_address || '',
                                                            pharmacyPhone: patient?.pharmacy_phone || ''
                                                        });
                                                    }}
                                                    className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 bg-paper-50 p-4 rounded-lg border border-paper-200">
                                            <div>
                                                <span className="text-sm font-medium text-ink-600">Pharmacy Name:</span>
                                                <p className="text-ink-900 mt-1">
                                                    {patient?.pharmacy_name || 'Not set'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-ink-600">Address:</span>
                                                <p className="text-ink-900 mt-1 whitespace-pre-line">
                                                    {patient?.pharmacy_address || 'Not set'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-ink-600">Phone:</span>
                                                <p className="text-ink-900 mt-1">
                                                    {patient?.pharmacy_phone || 'Not set'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Referrals Tab */}
                            {activeTab === 'referrals' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-ink-900">Referrals Sent</h3>
                                        <span className="text-sm text-ink-500">{referrals.length} total</span>
                                    </div>

                                    {referrals.length === 0 ? (
                                        <div className="text-center py-8 text-ink-500 bg-paper-50 rounded-lg border border-paper-200">
                                            No referrals found
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {referrals.map((referral) => (
                                                <div key={referral.id} className="bg-paper-50 p-4 rounded-lg border border-paper-200">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-ink-900">
                                                                {referral.recipient_name}
                                                            </div>
                                                            <div className="text-sm text-ink-600 mt-1">
                                                                {referral.recipient_specialty}
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded ${
                                                            referral.status === 'sent' ? 'bg-green-100 text-green-700' :
                                                            referral.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {referral.status}
                                                        </span>
                                                    </div>
                                                    {referral.recipient_address && (
                                                        <div className="text-sm text-ink-600 mt-2 flex items-start">
                                                            <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                                                            <span className="whitespace-pre-line">{referral.recipient_address}</span>
                                                        </div>
                                                    )}
                                                    {referral.reason && (
                                                        <div className="text-sm text-ink-700 mt-2">
                                                            <span className="font-medium">Reason:</span> {referral.reason}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-ink-500 mt-2 flex items-center space-x-4">
                                                        <span className="flex items-center">
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            {format(new Date(referral.created_at), 'MMM d, yyyy')}
                                                        </span>
                                                        {referral.created_by_first_name && (
                                                            <span>
                                                                By {referral.created_by_first_name} {referral.created_by_last_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Prescriptions Tab */}
                            {activeTab === 'prescriptions' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-ink-900">Prescriptions Sent</h3>
                                        <span className="text-sm text-ink-500">{prescriptions.length} total</span>
                                    </div>

                                    {prescriptions.length === 0 ? (
                                        <div className="text-center py-8 text-ink-500 bg-paper-50 rounded-lg border border-paper-200">
                                            No prescriptions found
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {prescriptions.map((rx) => {
                                                const payload = typeof rx.order_payload === 'string' 
                                                    ? JSON.parse(rx.order_payload || '{}')
                                                    : (rx.order_payload || {});
                                                return (
                                                    <div key={rx.id} className="bg-paper-50 p-4 rounded-lg border border-paper-200">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="font-semibold text-ink-900">
                                                                    {payload.medication || 'Unknown Medication'}
                                                                </div>
                                                                {payload.dosage && (
                                                                    <div className="text-sm text-ink-600 mt-1">
                                                                        {payload.dosage} {payload.frequency || ''}
                                                                    </div>
                                                                )}
                                                                {payload.quantity && (
                                                                    <div className="text-sm text-ink-600">
                                                                        Quantity: {payload.quantity}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`text-xs px-2 py-1 rounded ${
                                                                rx.status === 'sent' ? 'bg-green-100 text-green-700' :
                                                                rx.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                rx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {rx.status}
                                                            </span>
                                                        </div>
                                                        {payload.instructions && (
                                                            <div className="text-sm text-ink-700 mt-2">
                                                                <span className="font-medium">Instructions:</span> {payload.instructions}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-ink-500 mt-2 flex items-center space-x-4">
                                                            <span className="flex items-center">
                                                                <Calendar className="w-3 h-3 mr-1" />
                                                                {format(new Date(rx.created_at), 'MMM d, yyyy')}
                                                            </span>
                                                            {rx.ordered_by_first_name && (
                                                                <span>
                                                                    By {rx.ordered_by_first_name} {rx.ordered_by_last_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Documents Tab */}
                            {activeTab === 'documents' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-ink-900">Documents</h3>
                                        <span className="text-sm text-ink-500">{documents.length} total</span>
                                    </div>

                                    {documents.length === 0 ? (
                                        <div className="text-center py-8 text-ink-500 bg-paper-50 rounded-lg border border-paper-200">
                                            No documents found
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {documents.map((doc) => (
                                                <div key={doc.id} className="bg-paper-50 p-4 rounded-lg border border-paper-200">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-ink-900 flex items-center">
                                                                <FileText className="w-4 h-4 mr-2" />
                                                                {doc.filename}
                                                            </div>
                                                            {doc.doc_type && (
                                                                <div className="text-sm text-ink-600 mt-1">
                                                                    Type: {doc.doc_type}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-ink-500 mt-2 flex items-center space-x-4">
                                                        <span className="flex items-center">
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            {format(new Date(doc.created_at), 'MMM d, yyyy')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
};

export default PatientHub;










