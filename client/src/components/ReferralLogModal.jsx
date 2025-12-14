import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { referralsAPI } from '../services/api';
import { format } from 'date-fns';

const ReferralLogModal = ({ isOpen, onClose, patientId }) => {
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && patientId) {
            fetchReferrals();
        }
    }, [isOpen, patientId]);

    const fetchReferrals = async () => {
        setLoading(true);
        try {
            const response = await referralsAPI.getByPatient(patientId);
            setReferrals(response.data || []);
        } catch (error) {
            console.error('Error fetching referrals:', error);
            setReferrals([]);
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
                <span>{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}</span>
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
                            <ExternalLink className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Referral Log</h2>
                            <p className="text-sm text-gray-500">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
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
                            <p className="mt-4 text-gray-600">Loading referrals...</p>
                        </div>
                    ) : referrals.length === 0 ? (
                        <div className="text-center py-12">
                            <ExternalLink className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Referrals</h3>
                            <p className="text-gray-600">No referrals have been recorded for this patient.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {referrals.map((referral) => {
                                const recipientName = referral.recipient_name || 'Unknown Provider';
                                const specialty = referral.recipient_specialty || '';
                                const reason = referral.reason || '';
                                const date = referral.created_at ? format(new Date(referral.created_at), 'MMM d, yyyy') : '';

                                return (
                                    <div key={referral.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">{recipientName}</h3>
                                                    {getStatusBadge(referral.status)}
                                                </div>
                                                {specialty && (
                                                    <p className="text-sm text-gray-700 mb-1">
                                                        <span className="font-medium">Specialty:</span> {specialty}
                                                    </p>
                                                )}
                                                {reason && (
                                                    <p className="text-sm text-gray-700 mb-1 mt-2">
                                                        <span className="font-medium">Reason:</span> {reason}
                                                    </p>
                                                )}
                                                {referral.recipient_address && (
                                                    <p className="text-sm text-gray-600 mt-2">
                                                        <span className="font-medium">Address:</span> {referral.recipient_address}
                                                    </p>
                                                )}
                                            </div>
                                            {date && (
                                                <div className="flex items-center space-x-1 text-xs text-gray-500 ml-4">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{date}</span>
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

export default ReferralLogModal;






