import React, { useState, useEffect } from 'react';
import { X, Pill, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Building2, Phone } from 'lucide-react';
import { prescriptionsAPI, ordersAPI } from '../services/api';
import { format } from 'date-fns';

const PrescriptionLogModal = ({ isOpen, onClose, patientId }) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [useNewAPI, setUseNewAPI] = useState(true); // Toggle between new and old API

    useEffect(() => {
        if (isOpen && patientId) {
            fetchPrescriptions();
        }
    }, [isOpen, patientId]);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            // Try new prescriptions API first
            if (useNewAPI) {
                try {
                    const response = await prescriptionsAPI.getByPatient(patientId);
                    setPrescriptions(response.data || []);
                    return;
                } catch (newAPIError) {
                    console.warn('New prescriptions API not available, falling back to orders API:', newAPIError);
                    setUseNewAPI(false);
                }
            }
            
            // Fallback to old orders API
            const response = await ordersAPI.getByPatient(patientId);
            const rxOrders = (response.data || []).filter(order => order.order_type === 'rx');
            setPrescriptions(rxOrders);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            setPrescriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            sent: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
            completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
            cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle }
        };
        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${config.color}`}>
                <Icon className="w-3 h-3" />
                <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Pill className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Prescription Log</h2>
                            <p className="text-sm text-gray-500">{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            <p className="mt-4 text-gray-600">Loading prescriptions...</p>
                        </div>
                    ) : prescriptions.length === 0 ? (
                        <div className="text-center py-12">
                            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Prescriptions</h3>
                            <p className="text-gray-600">No prescriptions have been recorded for this patient.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {prescriptions.map((prescription) => {
                                // Handle both new API format and old orders API format
                                const isNewFormat = prescription.medication_name !== undefined;
                                
                                const medicationName = isNewFormat 
                                    ? prescription.medication_name 
                                    : (prescription.order_payload?.medication_name || prescription.order_payload?.medication || 'Unknown Medication');
                                
                                const sig = isNewFormat 
                                    ? (prescription.sig_structured?.sigText || prescription.sig || '')
                                    : (prescription.order_payload?.sig || prescription.order_payload?.instructions || '');
                                
                                const quantity = isNewFormat
                                    ? prescription.quantity
                                    : (prescription.order_payload?.dispense || prescription.order_payload?.quantity || '');
                                
                                const refills = isNewFormat ? prescription.refills : null;
                                const pharmacyName = prescription.pharmacy_name;
                                const pharmacyPhone = prescription.pharmacy_phone;
                                const status = prescription.status || 'pending';
                                const date = prescription.created_at ? format(new Date(prescription.created_at), 'MMM d, yyyy') : '';
                                const writtenDate = prescription.written_date ? format(new Date(prescription.written_date), 'MMM d, yyyy') : '';

                                return (
                                    <div key={prescription.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">{medicationName}</h3>
                                                    {getStatusBadge(status)}
                                                </div>
                                                {sig && (
                                                    <p className="text-sm text-gray-700 mb-1">
                                                        <span className="font-medium">Sig:</span> {sig}
                                                    </p>
                                                )}
                                                <div className="flex items-center space-x-4 text-sm text-gray-700 mb-1">
                                                    {quantity && (
                                                        <span>
                                                            <span className="font-medium">Quantity:</span> {quantity}
                                                            {prescription.quantity_unit && ` ${prescription.quantity_unit}`}
                                                        </span>
                                                    )}
                                                    {refills !== null && refills !== undefined && (
                                                        <span>
                                                            <span className="font-medium">Refills:</span> {refills}
                                                        </span>
                                                    )}
                                                    {prescription.days_supply && (
                                                        <span>
                                                            <span className="font-medium">Days Supply:</span> {prescription.days_supply}
                                                        </span>
                                                    )}
                                                </div>
                                                {pharmacyName && (
                                                    <div className="text-sm text-gray-600 mt-2 flex items-center space-x-2">
                                                        <Building2 className="w-4 h-4" />
                                                        <span>{pharmacyName}</span>
                                                        {pharmacyPhone && (
                                                            <>
                                                                <Phone className="w-3 h-3 ml-2" />
                                                                <span>{pharmacyPhone}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {(date || writtenDate) && (
                                                <div className="flex flex-col items-end space-y-1 ml-4">
                                                    {writtenDate && (
                                                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>Written: {writtenDate}</span>
                                                        </div>
                                                    )}
                                                    {date && (
                                                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{date}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PrescriptionLogModal;

