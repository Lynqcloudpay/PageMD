import React, { useState, useRef } from 'react';
import { X, Upload, Camera, Trash2, Check, AlertCircle } from 'lucide-react';
import { patientsAPI } from '../services/api';

const PatientPhotoModal = ({ isOpen, onClose, patient, onUpdate }) => {
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        // Validation
        if (!selectedFile.type.startsWith('image/')) {
            setError('Please select an image file (JPG, PNG, WEBP).');
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB.');
            return;
        }

        setFile(selectedFile);
        setError(null);

        // Generate preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleSave = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('photo', file);
            await patientsAPI.uploadPhoto(patient.id, formData);
            onUpdate?.();
            onClose();
        } catch (err) {
            console.error('Failed to upload photo:', err);
            setError(err.response?.data?.error || 'Failed to upload photo. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!window.confirm('Are you sure you want to remove the patient photo?')) return;
        setLoading(true);
        setError(null);

        try {
            await patientsAPI.removePhoto(patient.id);
            onUpdate?.();
            onClose();
        } catch (err) {
            console.error('Failed to remove photo:', err);
            setError(err.response?.data?.error || 'Failed to remove photo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <Camera size={20} className="text-blue-600" />
                            Update Profile Photo
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {patient.first_name} {patient.last_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8">
                    {/* Preview Area */}
                    <div className="flex flex-col items-center justify-center mb-8">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-full border-4 border-slate-100 shadow-inner overflow-hidden bg-slate-50 flex items-center justify-center">
                                {preview || patient.photo_url ? (
                                    <img
                                        src={preview || patient.photo_url}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-slate-300 flex flex-col items-center gap-2">
                                        <Upload size={48} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">No Image</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-1 right-1 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 active:scale-95"
                            >
                                <Upload size={18} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-in slide-in-from-top-2">
                            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-bold leading-relaxed">{error}</p>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />

                    <div className="space-y-3">
                        {!file && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all group flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-sm font-black">Upload New Photo</span>
                                <span className="text-[10px] font-bold uppercase opacity-60">JPG, PNG or WEBP (Max 5MB)</span>
                            </button>
                        )}

                        <div className="flex gap-3">
                            {patient.photo_url && !file && (
                                <button
                                    onClick={handleRemove}
                                    disabled={loading}
                                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> Remove Photo
                                </button>
                            )}

                            {file && (
                                <>
                                    <button
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        disabled={loading}
                                        className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="flex-[2] py-3 px-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <Check size={16} />
                                        )}
                                        {loading ? 'Saving...' : 'Save Photo'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientPhotoModal;
