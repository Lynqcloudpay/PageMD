import React, { useState } from 'react';
import { Lock, checkCircle, X, Loader2, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import api from '../services/api';
import { showSuccess, showError } from '../utils/toast';

const PortalResetPasswordModal = ({ isOpen, onClose, patient }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        if (password.length < 8) {
            showError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post(`/patients/${patient.id}/portal/reset-password`, {
                password
            });
            if (response.data.success) {
                setSuccess(true);
                showSuccess('Portal password reset successfully');
            }
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomPassword = () => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let retVal = "";
        for (let i = 0; i < 12; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        setPassword(retVal);
    };

    if (!patient) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Reset Portal Password"
            size="md"
        >
            {success ? (
                <div className="py-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Lock size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900">Password Updated</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">
                            The portal password for <span className="font-semibold text-slate-800">{patient.first_name} {patient.last_name}</span> has been updated.
                        </p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl max-w-xs mx-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">New Password</div>
                        <div className="text-lg font-mono font-bold text-slate-900 select-all">{password}</div>
                        <p className="text-[10px] text-amber-600 font-bold mt-2 uppercase tracking-tight">Please provide this to the patient securely.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <form onSubmit={handleReset} className="space-y-6 pt-2">
                    <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                            <Lock size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900">Security Reset</h4>
                            <p className="text-xs text-blue-700/70 leading-relaxed">
                                You are resetting the portal password for this patient. This action will take effect immediately.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">New Password</label>
                                <button
                                    type="button"
                                    onClick={generateRandomPassword}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                >
                                    Generate Random
                                </button>
                            </div>
                            <input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all outline-none"
                                placeholder="Enter at least 8 characters..."
                                required
                                minLength={8}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-700 font-medium leading-normal">
                                Ensure you communicate this password to the patient through a secure channel (e.g., in person or over the phone).
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || password.length < 8}
                            className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Update Password'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default PortalResetPasswordModal;
