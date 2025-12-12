import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User, FileText, Pill, Stethoscope, Upload, Send, ChevronDown, ChevronUp, Search, Menu, AlertCircle, X, Plus, Save, Camera, FileImage, Phone, Mail, MapPin, CreditCard, Building2, Users, Edit } from 'lucide-react';
import { PrescriptionModal, OrderModal, ReferralModal, UploadModal } from './ActionModals';
import Toast from './ui/Toast';
import { usePatient } from '../context/PatientContext';
import { usePatientTabs } from '../context/PatientTabsContext';
import { patientsAPI } from '../services/api';

const PatientHeader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getPatient } = usePatient();
    const { addTab, updateTabPath } = usePatientTabs();
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
    const [toast, setToast] = useState(null);
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAllergyModal, setShowAllergyModal] = useState(false);
    const [showMedicationModal, setShowMedicationModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showDemographicsModal, setShowDemographicsModal] = useState(false);
    const [demographicsField, setDemographicsField] = useState(null); // 'phone', 'email', 'address', 'insurance', 'pharmacy', 'emergency'
    const [demographicsForm, setDemographicsForm] = useState({
        phone: '',
        email: '',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        insurance_provider: '',
        insurance_id: '',
        pharmacy_name: '',
        pharmacy_phone: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: ''
    });
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: '', onsetDate: '' });
    const [medicationForm, setMedicationForm] = useState({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '' });
    const [photoMode, setPhotoMode] = useState(null); // 'webcam' or 'upload'
    const [webcamStream, setWebcamStream] = useState(null);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [photoVersion, setPhotoVersion] = useState(0); // Track photo updates for cache busting
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Format phone number to (xxx) xxx-xxxx
    const formatPhone = (phone) => {
        if (!phone) return null;
        // Remove all non-digits
        const cleaned = phone.replace(/\D/g, '');
        // Format to (xxx) xxx-xxxx
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        // Return original if not 10 digits
        return phone;
    };

    // Format phone number input as user types
    const formatPhoneInput = (value) => {
        // Remove all non-digits
        const cleaned = value.replace(/\D/g, '');
        // Limit to 10 digits
        const limited = cleaned.slice(0, 10);
        // Format to (xxx) xxx-xxxx
        if (limited.length === 0) return '';
        if (limited.length <= 3) return `(${limited}`;
        if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
        return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    };

    // Format full address for display
    const formatAddress = (patient) => {
        if (!patient) return 'Not provided';
        const parts = [];
        if (patient.address_line1) parts.push(patient.address_line1);
        if (patient.city) parts.push(patient.city);
        if (patient.state) parts.push(patient.state);
        if (patient.zip) parts.push(patient.zip);
        return parts.length > 0 ? parts.join(', ') : 'Not provided';
    };

    const handleAddAllergy = async () => {
        if (!allergyForm.allergen.trim()) {
            showToast('Please enter an allergen', 'error');
            return;
        }

        try {
            await patientsAPI.addAllergy(id, {
                allergen: allergyForm.allergen.trim(),
                reaction: allergyForm.reaction.trim() || null,
                severity: allergyForm.severity || null,
                onsetDate: allergyForm.onsetDate || null
            });
            
            // Refresh patient data
            await refreshPatientData();
            
            setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '' });
            setShowAllergyModal(false);
            showToast('Allergy added successfully');
        } catch (error) {
            console.error('Error adding allergy:', error);
            showToast('Failed to add allergy', 'error');
        }
    };

    const handleAddMedication = async () => {
        if (!medicationForm.medicationName.trim()) {
            showToast('Please enter a medication name', 'error');
            return;
        }

        try {
            await patientsAPI.addMedication(id, {
                medicationName: medicationForm.medicationName.trim(),
                dosage: medicationForm.dosage.trim() || null,
                frequency: medicationForm.frequency.trim() || null,
                route: medicationForm.route.trim() || null,
                startDate: medicationForm.startDate || null
            });
            
            // Refresh patient data
            await refreshPatientData();
            
            setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '' });
            setShowMedicationModal(false);
            showToast('Medication added successfully');
        } catch (error) {
            console.error('Error adding medication:', error);
            showToast('Failed to add medication', 'error');
        }
    };

    const refreshPatientData = async () => {
        if (!id) return;
        try {
            const response = await patientsAPI.get(id);
            const apiPatient = response.data;
            
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
            
            // Check if photo_url has changed
            const previousPhotoUrl = patient?.photo_url;
            const newPhotoUrl = apiPatient.photo_url || null;
            const photoChanged = previousPhotoUrl !== newPhotoUrl;
            
            const patientData = {
                id: apiPatient.id,
                name: `${apiPatient.first_name} ${apiPatient.last_name}`,
                first_name: apiPatient.first_name,
                last_name: apiPatient.last_name,
                mrn: apiPatient.mrn,
                dob: apiPatient.dob,
                age: calculateAge(apiPatient.dob),
                sex: apiPatient.sex,
                photo_url: newPhotoUrl,
                phone: apiPatient.phone || null,
                email: apiPatient.email || null,
                address_line1: apiPatient.address_line1 || null,
                city: apiPatient.city || null,
                state: apiPatient.state || null,
                zip: apiPatient.zip || null,
                insurance_provider: apiPatient.insurance_provider || null,
                insurance_id: apiPatient.insurance_id || null,
                pharmacy_name: apiPatient.pharmacy_name || null,
                pharmacy_phone: apiPatient.pharmacy_phone || null,
                emergency_contact_name: apiPatient.emergency_contact_name || null,
                emergency_contact_phone: apiPatient.emergency_contact_phone || null,
                emergency_contact_relationship: apiPatient.emergency_contact_relationship || null
            };
            setPatient(patientData);
            
            // Increment photo version if photo URL changed
            if (photoChanged) {
                setPhotoVersion(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error refreshing patient data:', error);
        }
    };

    const handleOpenDemographics = (field) => {
        setDemographicsField(field);
        // Pre-fill form with current patient data
        // Format phone numbers for display in the form
        const currentPhone = patient?.phone ? formatPhone(patient.phone) : '';
        const currentPharmacyPhone = patient?.pharmacy_phone ? formatPhone(patient.pharmacy_phone) : '';
        const currentEmergencyPhone = patient?.emergency_contact_phone ? formatPhone(patient.emergency_contact_phone) : '';
        
        setDemographicsForm({
            phone: currentPhone,
            email: patient?.email || '',
            address_line1: patient?.address_line1 || '',
            city: patient?.city || '',
            state: patient?.state || '',
            zip: patient?.zip || '',
            insurance_provider: patient?.insurance_provider || '',
            insurance_id: patient?.insurance_id || '',
            pharmacy_name: patient?.pharmacy_name || '',
            pharmacy_phone: currentPharmacyPhone,
            emergency_contact_name: patient?.emergency_contact_name || '',
            emergency_contact_phone: currentEmergencyPhone,
            emergency_contact_relationship: patient?.emergency_contact_relationship || ''
        });
        setShowDemographicsModal(true);
    };

    const handleSaveDemographics = async () => {
        if (!id) return;
        
        try {
            const updateData = {};
            
            // Only update the field being edited
            // Convert to camelCase for API compatibility
            switch (demographicsField) {
                case 'phone':
                    // Remove formatting and save as digits only
                    const cleanedPhone = demographicsForm.phone ? demographicsForm.phone.replace(/\D/g, '') : null;
                    updateData.phone = cleanedPhone || null;
                    break;
                case 'email':
                    updateData.email = demographicsForm.email || null;
                    break;
                case 'address':
                    updateData.addressLine1 = demographicsForm.address_line1 || null;
                    updateData.city = demographicsForm.city || null;
                    updateData.state = demographicsForm.state || null;
                    updateData.zip = demographicsForm.zip || null;
                    break;
                case 'insurance':
                    updateData.insuranceProvider = demographicsForm.insurance_provider || null;
                    updateData.insuranceId = demographicsForm.insurance_id || null;
                    break;
                case 'pharmacy':
                    updateData.pharmacyName = demographicsForm.pharmacy_name || null;
                    // Remove formatting and save as digits only
                    const cleanedPharmacyPhone = demographicsForm.pharmacy_phone ? demographicsForm.pharmacy_phone.replace(/\D/g, '') : null;
                    updateData.pharmacyPhone = cleanedPharmacyPhone || null;
                    break;
                case 'emergency':
                    updateData.emergencyContactName = demographicsForm.emergency_contact_name || null;
                    // Remove formatting and save as digits only
                    const cleanedEmergencyPhone = demographicsForm.emergency_contact_phone ? demographicsForm.emergency_contact_phone.replace(/\D/g, '') : null;
                    updateData.emergencyContactPhone = cleanedEmergencyPhone || null;
                    updateData.emergencyContactRelationship = demographicsForm.emergency_contact_relationship || null;
                    break;
            }
            
            console.log('Updating patient with data:', updateData);
            await patientsAPI.update(id, updateData);
            await refreshPatientData();
            setShowDemographicsModal(false);
            setDemographicsField(null);
            showToast('Patient information updated successfully');
        } catch (error) {
            console.error('Error updating patient demographics:', error);
            console.error('Error response:', error.response?.data);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to update patient information';
            showToast(errorMessage, 'error');
        }
    };

    // Webcam functions
    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setWebcamStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing webcam:', error);
            showToast('Could not access webcam. Please check permissions.', 'error');
        }
    };

    const stopWebcam = () => {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            setWebcamStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedPhoto(dataUrl);
            stopWebcam();
        }
    };

    const handleFileUpload = (e) => {
        console.log('handleFileUpload called', e.target.files);
        const file = e.target.files?.[0];
        if (file) {
            console.log('File selected:', file.name, file.type, file.size);
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                showToast('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'error');
                e.target.value = ''; // Reset file input
                return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showToast('File size must be less than 5MB', 'error');
                e.target.value = ''; // Reset file input
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log('File read complete, setting captured photo');
                setCapturedPhoto(reader.result);
                setPhotoMode('upload'); // Ensure photoMode is set
            };
            reader.onerror = () => {
                console.error('Error reading file');
                showToast('Error reading file. Please try again.', 'error');
                e.target.value = ''; // Reset file input
            };
            reader.readAsDataURL(file);
        } else {
            console.log('No file selected');
        }
    };

    const handleSavePhoto = async () => {
        if (!capturedPhoto || !id) {
            showToast('No photo to save', 'error');
            return;
        }

        try {
            console.log('Saving photo for patient:', id);
            const uploadResponse = await patientsAPI.uploadPhotoBase64(id, capturedPhoto);
            console.log('Photo upload response:', uploadResponse);
            
            // Update patient state with new photo_url immediately
            if (uploadResponse.data?.photoUrl || uploadResponse.data?.patient?.photo_url) {
                const newPhotoUrl = uploadResponse.data?.photoUrl || uploadResponse.data?.patient?.photo_url;
                setPatient(prev => ({
                    ...prev,
                    photo_url: newPhotoUrl
                }));
                // Increment photo version to force cache bust
                setPhotoVersion(prev => prev + 1);
            }
            
            // Refresh patient data to get updated photo_url (but don't await to avoid blocking UI)
            refreshPatientData().catch(err => console.error('Error refreshing patient data:', err));
            
            setShowPhotoModal(false);
            setPhotoMode(null);
            setCapturedPhoto(null);
            showToast('Photo uploaded successfully');
        } catch (error) {
            console.error('Error uploading photo:', error);
            console.error('Error details:', error.response?.data || error.message);
            showToast(error.response?.data?.error || 'Failed to upload photo. Please try again.', 'error');
        }
    };

    // Cleanup webcam on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [webcamStream]);

    useEffect(() => {
        const fetchPatient = async () => {
            if (!id) return;
            
            setLoading(true);
            try {
                // Fetch full patient data
                const response = await patientsAPI.get(id);
                const apiPatient = response.data;
                
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
                    
                    const patientData = {
                        id: apiPatient.id,
                        name: `${apiPatient.first_name} ${apiPatient.last_name}`,
                    first_name: apiPatient.first_name,
                    last_name: apiPatient.last_name,
                        mrn: apiPatient.mrn,
                        dob: apiPatient.dob,
                    age: calculateAge(apiPatient.dob),
                        sex: apiPatient.sex,
                    photo_url: apiPatient.photo_url || null,
                    phone: apiPatient.phone || null,
                    email: apiPatient.email || null,
                    address_line1: apiPatient.address_line1 || null,
                    city: apiPatient.city || null,
                    state: apiPatient.state || null,
                    zip: apiPatient.zip || null,
                    insurance_provider: apiPatient.insurance_provider || null,
                    insurance_id: apiPatient.insurance_id || null,
                    pharmacy_name: apiPatient.pharmacy_name || null,
                    pharmacy_phone: apiPatient.pharmacy_phone || null,
                    emergency_contact_name: apiPatient.emergency_contact_name || null,
                    emergency_contact_phone: apiPatient.emergency_contact_phone || null,
                    emergency_contact_relationship: apiPatient.emergency_contact_relationship || null
                };
                
                    setPatient(patientData);
                    // Add to tabs
                    addTab(patientData);
                    // Update tab path based on current route
                    const currentPath = window.location.pathname;
                    updateTabPath(apiPatient.id, currentPath);
            } catch (error) {
                // Fallback to local storage
                const localPatient = getPatient(id);
                if (localPatient) {
                    setPatient({
                        id: localPatient.id,
                        name: localPatient.name,
                        mrn: localPatient.mrn,
                        dob: localPatient.dob,
                        age: localPatient.age || (new Date().getFullYear() - new Date(localPatient.dob).getFullYear()),
                        sex: localPatient.sex,
                        photoUrl: localPatient.photoUrl || null,
                        allergies: localPatient.allergies || [],
                        medications: localPatient.medications || [],
                        lastVisit: null
                    });
                } else {
                    // Default fallback
                    setPatient({
                        id: id,
                        name: "Patient",
                        mrn: "N/A",
                        dob: "",
                        age: null,
                        sex: "",
                        first_name: "",
                        last_name: "",
                        photo_url: null,
                        phone: null,
                        email: null,
                        address_line1: null,
                        city: null,
                        state: null,
                        zip: null,
                        insurance_provider: null,
                        insurance_id: null,
                        pharmacy_name: null,
                        pharmacy_phone: null
                    });
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPatient();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Generate photo URL with cache-busting (must be before early returns)
    const photoUrl = useMemo(() => {
        if (!patient?.photo_url) return null;
        const baseUrl = patient.photo_url.startsWith('http') 
            ? patient.photo_url 
            : `http://localhost:3000${patient.photo_url}`;
        return `${baseUrl}?v=${photoVersion}`;
    }, [patient?.photo_url, photoVersion]);

    if (loading || !patient) {
        return (
            <div className="bg-white border-b border-ink-200 shadow-sm sticky top-0 z-40 p-6">
                <div className="text-center text-ink-500">Loading patient...</div>
            </div>
        );
    }

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

    const age = patient ? calculateAge(patient.dob) : null;

    return (
        <>
            <div className="bg-white border-b border-gray-200 shadow-sm">
                {/* Patient Hub Header Section */}
                {/* Patient Info Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-white border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        {/* Left: Photo and Basic Info */}
                        <div className="flex items-center space-x-4">
                            {/* Patient Photo */}
                            <button
                                onClick={() => setShowPhotoModal(true)}
                                className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-300 transition-all cursor-pointer relative group overflow-hidden flex-shrink-0 ring-2 ring-white shadow-md"
                                title="Click to add/change photo"
                            >
                                {photoUrl ? (
                                    <>
                                        <img 
                                            src={photoUrl}
                                            alt={patient?.first_name || 'Patient'}
                                            className="w-full h-full object-cover rounded-full"
                                            key={`${patient.photo_url}-${photoVersion}`}
                                            onError={(e) => {
                                                console.error('Error loading patient photo:', patient.photo_url);
                                                e.target.style.display = 'none';
                                            }}
                                            onLoad={(e) => {
                                                e.target.style.display = 'block';
                                            }}
                                        />
                                        <div className="absolute inset-0 hidden items-center justify-center bg-black bg-opacity-50 group-hover:flex transition-opacity rounded-full">
                                            <Camera className="w-4 h-4 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <User className="w-8 h-8" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 transition-opacity rounded-full">
                                            <Camera className="w-4 h-4 text-white" />
                                        </div>
                                    </>
                                )}
                            </button>
                            
                            {/* Patient Name and Info */}
                            <div className="min-w-0">
                                <Link 
                                    to={`/patient/${id}/snapshot`}
                                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-primary-700 transition-colors mb-1 block"
                                >
                                    {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient Chart'}
                                </Link>
                                {patient && (
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <span>{age !== null && `${age} years old`}</span>
                                        <span className="text-gray-300">•</span>
                                        <span>MRN: <span className="font-semibold text-gray-700">{patient.mrn}</span></span>
                                        <span className="text-gray-300">•</span>
                                        <span>DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Right: Actions */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                            <button onClick={() => setActiveModal('rx')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="e-Prescribe">
                                <Pill className="w-5 h-5" />
                            </button>
                            <button onClick={() => setActiveModal('order')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Orders">
                                <Stethoscope className="w-5 h-5" />
                            </button>
                            <button onClick={() => setActiveModal('upload')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Upload Document">
                                <Upload className="w-5 h-5" />
                            </button>
                            <button onClick={() => setActiveModal('refer')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refer">
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Demographics Section */}
                {patient && (
                    <div className="px-6 py-1.5">
                        <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
                            {/* Phone */}
                            <div 
                                onClick={() => handleOpenDemographics('phone')}
                                className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                            >
                                <div className="flex items-center justify-center mb-0.5 relative">
                                    <div className="flex items-center space-x-0.5">
                                        <Phone className="w-2.5 h-2.5 text-primary-600" />
                                        <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Phone</span>
                                    </div>
                                    <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                </div>
                                <div className="text-[11px] font-medium text-gray-900 leading-tight">{formatPhone(patient.phone) || 'Not provided'}</div>
                            </div>

                            {/* Email */}
                            <div 
                                onClick={() => handleOpenDemographics('email')}
                                className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                            >
                                <div className="flex items-center justify-center mb-0.5 relative">
                                    <div className="flex items-center space-x-0.5">
                                        <Mail className="w-2.5 h-2.5 text-primary-600" />
                                        <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Email</span>
                                    </div>
                                    <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                </div>
                                <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.email || 'Not provided'}</div>
                            </div>

                            {/* Address */}
                            <div 
                                onClick={() => handleOpenDemographics('address')}
                                className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                            >
                                <div className="flex items-center justify-center mb-0.5 relative">
                                    <div className="flex items-center space-x-0.5">
                                        <MapPin className="w-2.5 h-2.5 text-primary-600" />
                                        <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Address</span>
                                    </div>
                                    <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                </div>
                                <div className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2">{formatAddress(patient)}</div>
                            </div>

                            {/* Insurance */}
                            <div 
                                onClick={() => handleOpenDemographics('insurance')}
                                className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                            >
                                <div className="flex items-center justify-center mb-0.5 relative">
                                    <div className="flex items-center space-x-0.5">
                                        <CreditCard className="w-2.5 h-2.5 text-primary-600" />
                                        <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Insurance</span>
                                    </div>
                                    <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                </div>
                                <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.insurance_provider || 'Not on file'}</div>
                                {patient.insurance_id && (
                                    <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                        Policy: {patient.insurance_id}
                                    </div>
                                )}
                            </div>

                            {/* Pharmacy */}
                            <div 
                                onClick={() => handleOpenDemographics('pharmacy')}
                                className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                            >
                                <div className="flex items-center justify-center mb-0.5 relative">
                                    <div className="flex items-center space-x-0.5">
                                        <Building2 className="w-2.5 h-2.5 text-primary-600" />
                                        <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Pharmacy</span>
                                    </div>
                                    <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                </div>
                                <div className="text-[11px] font-medium text-gray-900 leading-tight">{patient.pharmacy_name || 'Not on file'}</div>
                                {patient.pharmacy_phone && (
                                    <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                        {formatPhone(patient.pharmacy_phone)}
                                    </div>
                                )}
                                {patient.pharmacy_address && (
                                    <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                        {patient.pharmacy_address}
                                    </div>
                                )}
                            </div>

                            {/* Emergency Contact */}
                            {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
                                <div 
                                    onClick={() => handleOpenDemographics('emergency')}
                                    className="group cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-300 rounded p-1 transition-all relative text-center"
                                >
                                    <div className="flex items-center justify-center mb-0.5 relative">
                                        <div className="flex items-center space-x-0.5">
                                            <Users className="w-2.5 h-2.5 text-primary-600" />
                                            <span className="text-[9px] font-semibold text-gray-700 uppercase tracking-wide">Emergency</span>
                                        </div>
                                        <Edit className="w-2 h-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-900 leading-tight line-clamp-2">
                                        {patient.emergency_contact_name && (
                                            <div>
                                                {patient.emergency_contact_name}
                                                {patient.emergency_contact_phone && (
                                                    <span className="text-[9px] text-gray-600"> • {formatPhone(patient.emergency_contact_phone)}</span>
                                                )}
                                            </div>
                                        )}
                                        {!patient.emergency_contact_name && patient.emergency_contact_phone && (
                                            <div>{formatPhone(patient.emergency_contact_phone)}</div>
                                        )}
                                        {patient.emergency_contact_relationship && (
                                            <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">
                                                {patient.emergency_contact_relationship}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <PrescriptionModal isOpen={activeModal === 'rx'} onClose={() => setActiveModal(null)} onSuccess={(diagnosis, text) => showToast('Prescription added', 'success')} />
            <OrderModal isOpen={activeModal === 'order'} onClose={() => setActiveModal(null)} onSuccess={(diagnosis, text) => showToast('Order added', 'success')} />
            <ReferralModal isOpen={activeModal === 'refer'} onClose={() => setActiveModal(null)} onSuccess={(diagnosis, text) => showToast('Referral added', 'success')} />
            <UploadModal isOpen={activeModal === 'upload'} onClose={() => setActiveModal(null)} onSuccess={showToast} />

            {/* Allergy Modal */}
            {showAllergyModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowAllergyModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <span>Add Allergy</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAllergyModal(false);
                                    setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '' });
                                }}
                                className="p-1 hover:bg-paper-100 rounded text-ink-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-ink-700 mb-1">Allergen *</label>
                                <input
                                    type="text"
                                    value={allergyForm.allergen}
                                    onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    placeholder="e.g., Penicillin, Latex, Peanuts"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink-700 mb-1">Reaction</label>
                                <input
                                    type="text"
                                    value={allergyForm.reaction}
                                    onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    placeholder="e.g., Hives, Anaphylaxis, Rash"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Severity</label>
                                    <select
                                        value={allergyForm.severity}
                                        onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    >
                                        <option value="">Select...</option>
                                        <option value="mild">Mild</option>
                                        <option value="moderate">Moderate</option>
                                        <option value="severe">Severe</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Onset Date</label>
                                    <input
                                        type="date"
                                        value={allergyForm.onsetDate}
                                        onChange={(e) => setAllergyForm({ ...allergyForm, onsetDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handleAddAllergy}
                                    disabled={!allergyForm.allergen.trim()}
                                    className="flex-1 px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>Add Allergy</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAllergyModal(false);
                                        setAllergyForm({ allergen: '', reaction: '', severity: '', onsetDate: '' });
                                    }}
                                    className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Medication Modal */}
            {showMedicationModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowMedicationModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
                                <Pill className="w-5 h-5 text-paper-700" />
                                <span>Add Medication</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setShowMedicationModal(false);
                                    setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '' });
                                }}
                                className="p-1 hover:bg-paper-100 rounded text-ink-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-ink-700 mb-1">Medication Name *</label>
                                <input
                                    type="text"
                                    value={medicationForm.medicationName}
                                    onChange={(e) => setMedicationForm({ ...medicationForm, medicationName: e.target.value })}
                                    className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    placeholder="e.g., Metformin, Lisinopril"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Dosage</label>
                                    <input
                                        type="text"
                                        value={medicationForm.dosage}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        placeholder="e.g., 10mg, 500mg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Frequency</label>
                                    <input
                                        type="text"
                                        value={medicationForm.frequency}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        placeholder="e.g., Once daily, BID"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Route</label>
                                    <input
                                        type="text"
                                        value={medicationForm.route}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, route: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                        placeholder="e.g., PO, IV, Topical"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={medicationForm.startDate}
                                        onChange={(e) => setMedicationForm({ ...medicationForm, startDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-paper-300 rounded-md focus:ring-2 focus:ring-paper-400 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handleAddMedication}
                                    disabled={!medicationForm.medicationName.trim()}
                                    className="flex-1 px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)')}
                                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)')}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>Add Medication</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMedicationModal(false);
                                        setMedicationForm({ medicationName: '', dosage: '', frequency: '', route: '', startDate: '' });
                                    }}
                                    className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Modal */}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => {
                    setShowPhotoModal(false);
                    setPhotoMode(null);
                    stopWebcam();
                    setCapturedPhoto(null);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
                                <Camera className="w-5 h-5 text-paper-700" />
                                <span>Add Patient Photo</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setShowPhotoModal(false);
                                    setPhotoMode(null);
                                    stopWebcam();
                                    setCapturedPhoto(null);
                                }}
                                className="p-1 hover:bg-paper-100 rounded text-ink-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Hidden file input - always present */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        
                        {!photoMode ? (
                            <div className="space-y-4">
                                <p className="text-sm text-ink-600 mb-4">Choose how you want to add the photo:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={async () => {
                                            setPhotoMode('webcam');
                                            await startWebcam();
                                        }}
                                        className="flex flex-col items-center justify-center p-6 border-2 border-paper-300 rounded-lg hover:border-paper-500 hover:bg-paper-50 transition-colors"
                                    >
                                        <Camera className="w-12 h-12 text-paper-700 mb-2" />
                                        <span className="font-medium text-ink-900">Use Webcam</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPhotoMode('upload');
                                            setTimeout(() => {
                                                fileInputRef.current?.click();
                                            }, 100);
                                        }}
                                        className="flex flex-col items-center justify-center p-6 border-2 border-paper-300 rounded-lg hover:border-paper-500 hover:bg-paper-50 transition-colors"
                                    >
                                        <FileImage className="w-12 h-12 text-paper-700 mb-2" />
                                        <span className="font-medium text-ink-900">Upload Photo</span>
                                    </button>
                                </div>
                            </div>
                        ) : photoMode === 'webcam' ? (
                            <div className="space-y-4">
                                {!capturedPhoto ? (
                                    <>
                                        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={capturePhoto}
                                                className="flex-1 px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                            >
                                                <Camera className="w-4 h-4" />
                                                <span>Capture Photo</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    stopWebcam();
                                                    setPhotoMode(null);
                                                }}
                                                className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                            <img src={capturedPhoto} alt="Captured" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={handleSavePhoto}
                                                className="flex-1 px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                            >
                                                <Save className="w-4 h-4" />
                                                <span>Save Photo</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setCapturedPhoto(null);
                                                    await startWebcam();
                                                }}
                                                className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                            >
                                                Retake
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPhotoMode(null);
                                                    setCapturedPhoto(null);
                                                    stopWebcam();
                                                }}
                                                className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {capturedPhoto ? (
                                    <>
                                        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                            <img src={capturedPhoto} alt="Uploaded" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={handleSavePhoto}
                                                className="flex-1 px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                            >
                                                <Save className="w-4 h-4" />
                                                <span>Save Photo</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCapturedPhoto(null);
                                                    setTimeout(() => {
                                                        fileInputRef.current?.click();
                                                    }, 100);
                                                }}
                                                className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                            >
                                                Choose Different
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPhotoMode(null);
                                                    setCapturedPhoto(null);
                                                }}
                                                className="px-4 py-2 bg-paper-100 text-ink-700 rounded-md hover:bg-paper-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-ink-600 mb-4">No file selected</p>
                                        <button
                                            onClick={() => {
                                                setTimeout(() => {
                                                    fileInputRef.current?.click();
                                                }, 100);
                                            }}
                                            className="px-4 py-2 text-white rounded-md transition-all duration-200 hover:shadow-md"
                                            style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                        >
                                            Choose File
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Demographics Modal */}
            {showDemographicsModal && demographicsField && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => {
                    setShowDemographicsModal(false);
                    setDemographicsField(null);
                }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {demographicsField === 'phone' && 'Edit Phone'}
                                {demographicsField === 'email' && 'Edit Email'}
                                {demographicsField === 'address' && 'Edit Address'}
                                {demographicsField === 'insurance' && 'Edit Insurance'}
                                {demographicsField === 'pharmacy' && 'Edit Pharmacy'}
                                {demographicsField === 'emergency' && 'Edit Emergency Contact'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowDemographicsModal(false);
                                    setDemographicsField(null);
                                }}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Phone */}
                            {demographicsField === 'phone' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={demographicsForm.phone}
                                        onChange={(e) => {
                                            const formatted = formatPhoneInput(e.target.value);
                                            setDemographicsForm({ ...demographicsForm, phone: formatted });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="(555) 123-4567"
                                        maxLength={14}
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Email */}
                            {demographicsField === 'email' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={demographicsForm.email}
                                        onChange={(e) => setDemographicsForm({ ...demographicsForm, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="patient@example.com"
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Address */}
                            {demographicsField === 'address' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.address_line1}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, address_line1: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="123 Main St"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.city}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, city: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="City"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                            <input
                                                type="text"
                                                value={demographicsForm.state}
                                                onChange={(e) => setDemographicsForm({ ...demographicsForm, state: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="State"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.zip}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, zip: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="12345"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Insurance */}
                            {demographicsField === 'insurance' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.insurance_provider}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, insurance_provider: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="Insurance Company Name"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Policy/Group Number</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.insurance_id}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, insurance_id: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="Policy or Group Number"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Pharmacy */}
                            {demographicsField === 'pharmacy' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.pharmacy_name}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, pharmacy_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="Pharmacy Name"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Phone</label>
                                        <input
                                            type="tel"
                                            value={demographicsForm.pharmacy_phone}
                                            onChange={(e) => {
                                                const formatted = formatPhoneInput(e.target.value);
                                                setDemographicsForm({ ...demographicsForm, pharmacy_phone: formatted });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="(555) 123-4567"
                                            maxLength={14}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Emergency Contact */}
                            {demographicsField === 'emergency' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.emergency_contact_name}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, emergency_contact_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="Full Name"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={demographicsForm.emergency_contact_phone}
                                            onChange={(e) => {
                                                const formatted = formatPhoneInput(e.target.value);
                                                setDemographicsForm({ ...demographicsForm, emergency_contact_phone: formatted });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="(555) 123-4567"
                                            maxLength={14}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                        <input
                                            type="text"
                                            value={demographicsForm.emergency_contact_relationship}
                                            onChange={(e) => setDemographicsForm({ ...demographicsForm, emergency_contact_relationship: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="e.g., Spouse, Parent, Friend"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handleSaveDemographics}
                                    className="flex-1 px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 transition-all duration-200 hover:shadow-md"
                                    style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>Save</span>
                                </button>
                                <button
                                    onClick={() => {
                                        // Clear the field
                                        const clearedForm = { ...demographicsForm };
                                        switch (demographicsField) {
                                            case 'phone':
                                                clearedForm.phone = '';
                                                break;
                                            case 'email':
                                                clearedForm.email = '';
                                                break;
                                            case 'address':
                                                clearedForm.address_line1 = '';
                                                clearedForm.city = '';
                                                clearedForm.state = '';
                                                clearedForm.zip = '';
                                                break;
                                            case 'insurance':
                                                clearedForm.insurance_provider = '';
                                                clearedForm.insurance_id = '';
                                                break;
                                            case 'pharmacy':
                                                clearedForm.pharmacy_name = '';
                                                clearedForm.pharmacy_phone = '';
                                                break;
                                            case 'emergency':
                                                clearedForm.emergency_contact_name = '';
                                                clearedForm.emergency_contact_phone = '';
                                                clearedForm.emergency_contact_relationship = '';
                                                break;
                                        }
                                        setDemographicsForm(clearedForm);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDemographicsModal(false);
                                        setDemographicsField(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
};

export default PatientHeader;
