import React, { useState } from 'react';
import Modal from './ui/Modal';
import { usePatient } from '../context/PatientContext';
import { patientsAPI } from '../services/api';
import { ChevronRight, ChevronLeft, User, Phone, MapPin, CreditCard, Pill, Users, FileText } from 'lucide-react';

const AddPatientModal = ({ isOpen, onClose, onSuccess }) => {
    const { addPatient } = usePatient();
    const [currentSection, setCurrentSection] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const totalSections = 7;

    const [formData, setFormData] = useState({
        // Personal Information
        firstName: '',
        middleName: '',
        lastName: '',
        nameSuffix: '',
        preferredName: '',
        dob: '',
        sex: 'M',
        gender: '',
        race: '',
        ethnicity: '',
        maritalStatus: '',

        // Contact Information
        phone: '',
        phoneSecondary: '',
        phoneCell: '',
        phoneWork: '',
        phonePreferred: 'Primary',
        email: '',
        emailSecondary: '',
        preferredLanguage: 'English',
        interpreterNeeded: false,
        communicationPreference: 'Phone',
        consentToText: false,
        consentToEmail: false,

        // Address
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        country: 'United States',
        addressType: 'Home',

        // Employment
        employmentStatus: '',
        occupation: '',
        employerName: '',

        // Insurance
        insuranceProvider: '',
        insuranceId: '',
        insuranceGroupNumber: '',
        insurancePlanName: '',
        insurancePlanType: '',
        insuranceSubscriberName: '',
        insuranceSubscriberDob: '',
        insuranceSubscriberRelationship: 'Self',
        insuranceCopay: '',
        insuranceEffectiveDate: '',
        insuranceExpiryDate: '',
        insuranceNotes: '',

        // Pharmacy
        pharmacyName: '',
        pharmacyAddress: '',
        pharmacyPhone: '',
        pharmacyNpi: '',
        pharmacyFax: '',
        pharmacyPreferred: true,

        // Emergency Contact
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelationship: '',
        emergencyContactAddress: '',
        emergencyContact2Name: '',
        emergencyContact2Phone: '',
        emergencyContact2Relationship: '',

        // Additional
        referralSource: '',
        smokingStatus: '',
        alcoholUse: '',
        allergiesKnown: false,
        notes: '',
    });

    const sections = [
        { id: 1, title: 'Personal Info', icon: User },
        { id: 2, title: 'Contact', icon: Phone },
        { id: 3, title: 'Address', icon: MapPin },
        { id: 4, title: 'Insurance', icon: CreditCard },
        { id: 5, title: 'Pharmacy', icon: Pill },
        { id: 6, title: 'Emergency Contact', icon: Users },
        { id: 7, title: 'Additional', icon: FileText },
    ];

    const updateFormData = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Transform camelCase to snake_case for backend
            const backendData = {
                first_name: formData.firstName,
                middle_name: formData.middleName,
                last_name: formData.lastName,
                name_suffix: formData.nameSuffix,
                preferred_name: formData.preferredName,
                dob: formData.dob,
                sex: formData.sex,
                gender: formData.gender,
                race: formData.race,
                ethnicity: formData.ethnicity,
                marital_status: formData.maritalStatus,
                phone: formData.phone,
                phone_secondary: formData.phoneSecondary,
                phone_cell: formData.phoneCell,
                phone_work: formData.phoneWork,
                phone_preferred: formData.phonePreferred,
                email: formData.email,
                email_secondary: formData.emailSecondary,
                preferred_language: formData.preferredLanguage,
                interpreter_needed: formData.interpreterNeeded,
                communication_preference: formData.communicationPreference,
                consent_to_text: formData.consentToText,
                consent_to_email: formData.consentToEmail,
                address_line1: formData.addressLine1,
                address_line2: formData.addressLine2,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                country: formData.country,
                address_type: formData.addressType,
                employment_status: formData.employmentStatus,
                occupation: formData.occupation,
                employer_name: formData.employerName,
                insurance_provider: formData.insuranceProvider,
                insurance_id: formData.insuranceId,
                insurance_group_number: formData.insuranceGroupNumber,
                insurance_plan_name: formData.insurancePlanName,
                insurance_plan_type: formData.insurancePlanType,
                insurance_subscriber_name: formData.insuranceSubscriberName,
                insurance_subscriber_dob: formData.insuranceSubscriberDob,
                insurance_subscriber_relationship: formData.insuranceSubscriberRelationship,
                insurance_copay: formData.insuranceCopay,
                insurance_effective_date: formData.insuranceEffectiveDate,
                insurance_expiry_date: formData.insuranceExpiryDate,
                insurance_notes: formData.insuranceNotes,
                pharmacy_name: formData.pharmacyName,
                pharmacy_address: formData.pharmacyAddress,
                pharmacy_phone: formData.pharmacyPhone,
                pharmacy_npi: formData.pharmacyNpi,
                pharmacy_fax: formData.pharmacyFax,
                pharmacy_preferred: formData.pharmacyPreferred,
                emergency_contact_name: formData.emergencyContactName,
                emergency_contact_phone: formData.emergencyContactPhone,
                emergency_contact_relationship: formData.emergencyContactRelationship,
                emergency_contact_address: formData.emergencyContactAddress,
                emergency_contact2_name: formData.emergencyContact2Name,
                emergency_contact2_phone: formData.emergencyContact2Phone,
                emergency_contact2_relationship: formData.emergencyContact2Relationship,
                referral_source: formData.referralSource,
                smoking_status: formData.smokingStatus,
                alcohol_use: formData.alcoholUse,
                allergies_known: formData.allergiesKnown,
                notes: formData.notes,
            };

            const response = await patientsAPI.create(backendData);
            const newPatient = response.data || response;

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
            setFormData({
                firstName: '', middleName: '', lastName: '', nameSuffix: '', preferredName: '',
                dob: '', sex: 'M', gender: '', race: '', ethnicity: '', maritalStatus: '',
                phone: '', phoneSecondary: '', phoneCell: '', phoneWork: '', phonePreferred: 'Primary',
                email: '', emailSecondary: '', preferredLanguage: 'English', interpreterNeeded: false,
                communicationPreference: 'Phone', consentToText: false, consentToEmail: false,
                addressLine1: '', addressLine2: '', city: '', state: '', zip: '',
                country: 'United States', addressType: 'Home',
                employmentStatus: '', occupation: '', employerName: '',
                insuranceProvider: '', insuranceId: '', insuranceGroupNumber: '', insurancePlanName: '',
                insurancePlanType: '', insuranceSubscriberName: '', insuranceSubscriberDob: '',
                insuranceSubscriberRelationship: 'Self', insuranceCopay: '', insuranceEffectiveDate: '',
                insuranceExpiryDate: '', insuranceNotes: '',
                pharmacyName: '', pharmacyAddress: '', pharmacyPhone: '', pharmacyNpi: '',
                pharmacyFax: '', pharmacyPreferred: true,
                emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
                emergencyContactAddress: '', emergencyContact2Name: '', emergencyContact2Phone: '',
                emergencyContact2Relationship: '',
                referralSource: '', smokingStatus: '', alcoholUse: '', allergiesKnown: false, notes: '',
            });
            setCurrentSection(1);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to enroll patient');
        } finally {
            setLoading(false);
        }
    };

    const nextSection = () => {
        if (currentSection < totalSections) {
            setCurrentSection(currentSection + 1);
        }
    };

    const prevSection = () => {
        if (currentSection > 1) {
            setCurrentSection(currentSection - 1);
        }
    };

    const goToSection = (sectionId) => {
        setCurrentSection(sectionId);
    };

    // US States
    const usStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    const renderSectionContent = () => {
        switch (currentSection) {
            case 1: // Personal Information
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.firstName}
                                    onChange={e => updateFormData('firstName', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.middleName}
                                    onChange={e => updateFormData('middleName', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.lastName}
                                    onChange={e => updateFormData('lastName', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.nameSuffix}
                                    onChange={e => updateFormData('nameSuffix', e.target.value)}
                                >
                                    <option value="">None</option>
                                    <option value="Jr">Jr</option>
                                    <option value="Sr">Sr</option>
                                    <option value="II">II</option>
                                    <option value="III">III</option>
                                    <option value="IV">IV</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name</label>
                                <input
                                    type="text"
                                    placeholder="What name would you like to be called?"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.preferredName}
                                    onChange={e => updateFormData('preferredName', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date of Birth <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.dob}
                                    onChange={e => updateFormData('dob', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sex <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.sex}
                                    onChange={e => updateFormData('sex', e.target.value)}
                                >
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender Identity</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.gender}
                                    onChange={e => updateFormData('gender', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Transgender Male">Transgender Male</option>
                                    <option value="Transgender Female">Transgender Female</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.maritalStatus}
                                    onChange={e => updateFormData('maritalStatus', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Widowed">Widowed</option>
                                    <option value="Domestic Partner">Domestic Partner</option>
                                    <option value="Separated">Separated</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Race</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.race}
                                    onChange={e => updateFormData('race', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                                    <option value="Asian">Asian</option>
                                    <option value="Black or African American">Black or African American</option>
                                    <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                                    <option value="White">White</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to answer">Prefer not to answer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ethnicity</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.ethnicity}
                                    onChange={e => updateFormData('ethnicity', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Hispanic or Latino">Hispanic or Latino</option>
                                    <option value="Not Hispanic or Latino">Not Hispanic or Latino</option>
                                    <option value="Prefer not to answer">Prefer not to answer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );

            case 2: // Contact Information
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Phone</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.phone}
                                    onChange={e => updateFormData('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.phoneCell}
                                    onChange={e => updateFormData('phoneCell', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Work Phone</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.phoneWork}
                                    onChange={e => updateFormData('phoneWork', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.phoneSecondary}
                                    onChange={e => updateFormData('phoneSecondary', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Phone</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.phonePreferred}
                                    onChange={e => updateFormData('phonePreferred', e.target.value)}
                                >
                                    <option value="Primary">Primary</option>
                                    <option value="Cell">Cell</option>
                                    <option value="Work">Work</option>
                                    <option value="Secondary">Secondary</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="patient@email.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.email}
                                    onChange={e => updateFormData('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Email</label>
                                <input
                                    type="email"
                                    placeholder="patient@email.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.emailSecondary}
                                    onChange={e => updateFormData('emailSecondary', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.preferredLanguage}
                                    onChange={e => updateFormData('preferredLanguage', e.target.value)}
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="Mandarin">Mandarin</option>
                                    <option value="Vietnamese">Vietnamese</option>
                                    <option value="Arabic">Arabic</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Communication Preference</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.communicationPreference}
                                    onChange={e => updateFormData('communicationPreference', e.target.value)}
                                >
                                    <option value="Phone">Phone</option>
                                    <option value="Email">Email</option>
                                    <option value="Text">Text</option>
                                    <option value="Mail">Mail</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={formData.interpreterNeeded}
                                    onChange={e => updateFormData('interpreterNeeded', e.target.checked)}
                                />
                                <span className="text-sm text-gray-700">Interpreter needed</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={formData.consentToText}
                                    onChange={e => updateFormData('consentToText', e.target.checked)}
                                />
                                <span className="text-sm text-gray-700">Consent to receive text messages</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={formData.consentToEmail}
                                    onChange={e => updateFormData('consentToEmail', e.target.checked)}
                                />
                                <span className="text-sm text-gray-700">Consent to receive emails</span>
                            </label>
                        </div>
                    </div>
                );

            case 3: // Address
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                            <input
                                type="text"
                                placeholder="123 Main Street"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={formData.addressLine1}
                                onChange={e => updateFormData('addressLine1', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                            <input
                                type="text"
                                placeholder="Apt, Suite, Unit, etc."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={formData.addressLine2}
                                onChange={e => updateFormData('addressLine2', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.city}
                                    onChange={e => updateFormData('city', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.state}
                                    onChange={e => updateFormData('state', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    {usStates.map(state => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                                <input
                                    type="text"
                                    placeholder="12345"
                                    maxLength="10"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.zip}
                                    onChange={e => updateFormData('zip', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.country}
                                    onChange={e => updateFormData('country', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.addressType}
                                    onChange={e => updateFormData('addressType', e.target.value)}
                                >
                                    <option value="Home">Home</option>
                                    <option value="Work">Work</option>
                                    <option value="Mailing">Mailing</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.employmentStatus}
                                    onChange={e => updateFormData('employmentStatus', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Employed">Employed</option>
                                    <option value="Unemployed">Unemployed</option>
                                    <option value="Retired">Retired</option>
                                    <option value="Student">Student</option>
                                    <option value="Disabled">Disabled</option>
                                    <option value="Self-Employed">Self-Employed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Teacher, Engineer"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.occupation}
                                    onChange={e => updateFormData('occupation', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.employerName}
                                    onChange={e => updateFormData('employerName', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 4: // Insurance
                return (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Insurance information can be added later if not available at registration.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Blue Cross Blue Shield, Aetna"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceProvider}
                                    onChange={e => updateFormData('insuranceProvider', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Member ID</label>
                                <input
                                    type="text"
                                    placeholder="Insurance member ID"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceId}
                                    onChange={e => updateFormData('insuranceId', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group Number</label>
                                <input
                                    type="text"
                                    placeholder="Group number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceGroupNumber}
                                    onChange={e => updateFormData('insuranceGroupNumber', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                                <input
                                    type="text"
                                    placeholder="Plan name"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insurancePlanName}
                                    onChange={e => updateFormData('insurancePlanName', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insurancePlanType}
                                    onChange={e => updateFormData('insurancePlanType', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="HMO">HMO</option>
                                    <option value="PPO">PPO</option>
                                    <option value="POS">POS</option>
                                    <option value="EPO">EPO</option>
                                    <option value="Medicaid">Medicaid</option>
                                    <option value="Medicare">Medicare</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Copay Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceCopay}
                                    onChange={e => updateFormData('insuranceCopay', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceEffectiveDate}
                                    onChange={e => updateFormData('insuranceEffectiveDate', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceExpiryDate}
                                    onChange={e => updateFormData('insuranceExpiryDate', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subscriber Name (if different)</label>
                                <input
                                    type="text"
                                    placeholder="Name of policyholder"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceSubscriberName}
                                    onChange={e => updateFormData('insuranceSubscriberName', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subscriber DOB</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceSubscriberDob}
                                    onChange={e => updateFormData('insuranceSubscriberDob', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship to Subscriber</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceSubscriberRelationship}
                                    onChange={e => updateFormData('insuranceSubscriberRelationship', e.target.value)}
                                >
                                    <option value="Self">Self</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Child">Child</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Notes</label>
                                <textarea
                                    rows="3"
                                    placeholder="Additional insurance information..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.insuranceNotes}
                                    onChange={e => updateFormData('insuranceNotes', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 5: // Pharmacy
                return (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Pharmacy information helps us send prescriptions electronically.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., CVS, Walgreens, Rite Aid"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.pharmacyName}
                                    onChange={e => updateFormData('pharmacyName', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Address</label>
                                <input
                                    type="text"
                                    placeholder="Street address of pharmacy"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.pharmacyAddress}
                                    onChange={e => updateFormData('pharmacyAddress', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Phone</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.pharmacyPhone}
                                    onChange={e => updateFormData('pharmacyPhone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Fax</label>
                                <input
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.pharmacyFax}
                                    onChange={e => updateFormData('pharmacyFax', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy NPI</label>
                                <input
                                    type="text"
                                    placeholder="10-digit NPI number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.pharmacyNpi}
                                    onChange={e => updateFormData('pharmacyNpi', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center pt-6">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        checked={formData.pharmacyPreferred}
                                        onChange={e => updateFormData('pharmacyPreferred', e.target.checked)}
                                    />
                                    <span className="text-sm text-gray-700">This is my preferred pharmacy</span>
                                </label>
                            </div>
                        </div>
                    </div>
                );

            case 6: // Emergency Contact
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Primary Emergency Contact</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContactName}
                                        onChange={e => updateFormData('emergencyContactName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="(555) 123-4567"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContactPhone}
                                        onChange={e => updateFormData('emergencyContactPhone', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContactRelationship}
                                        onChange={e => updateFormData('emergencyContactRelationship', e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Parent">Parent</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Child">Child</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContactAddress}
                                        onChange={e => updateFormData('emergencyContactAddress', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Secondary Emergency Contact</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContact2Name}
                                        onChange={e => updateFormData('emergencyContact2Name', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="(555) 123-4567"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContact2Phone}
                                        onChange={e => updateFormData('emergencyContact2Phone', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.emergencyContact2Relationship}
                                        onChange={e => updateFormData('emergencyContact2Relationship', e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Parent">Parent</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Child">Child</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 7: // Additional Information
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referral Source</label>
                            <input
                                type="text"
                                placeholder="How did you hear about us?"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={formData.referralSource}
                                onChange={e => updateFormData('referralSource', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Smoking Status</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.smokingStatus}
                                    onChange={e => updateFormData('smokingStatus', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Never">Never</option>
                                    <option value="Current">Current</option>
                                    <option value="Former">Former</option>
                                    <option value="Unknown">Unknown</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alcohol Use</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.alcoholUse}
                                    onChange={e => updateFormData('alcoholUse', e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="None">None</option>
                                    <option value="Social">Social</option>
                                    <option value="Regular">Regular</option>
                                    <option value="Heavy">Heavy</option>
                                    <option value="Unknown">Unknown</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 mb-4">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={formData.allergiesKnown}
                                    onChange={e => updateFormData('allergiesKnown', e.target.checked)}
                                />
                                <span className="text-sm text-gray-700">Patient has known allergies</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                            <textarea
                                rows="4"
                                placeholder="Any additional information about the patient..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={formData.notes}
                                onChange={e => updateFormData('notes', e.target.value)}
                            />
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!isOpen) return null;

    const currentSectionData = sections[currentSection - 1];
    const Icon = currentSectionData?.icon || User;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Register New Patient" size="xl" preventOutsideClick={loading}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Section Navigation Tabs */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 mb-6 pb-2 border-b border-gray-200">
                    {sections.map((section) => {
                        const SectionIcon = section.icon;
                        const isActive = section.id === currentSection;
                        const isCompleted = section.id < currentSection;

                        return (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => goToSection(section.id)}
                                disabled={loading}
                                className={`
                                    flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-md text-[10px] sm:text-xs font-medium transition-all
                                    min-w-0 w-full
                                    ${isActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : isCompleted
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }
                                    ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                                title={section.title}
                            >
                                <SectionIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                <span className="truncate w-full text-center leading-tight">{section.title}</span>
                                {isCompleted && <span className="text-[9px] leading-none">✓</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Section Content */}
                <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(80vh - 200px)' }}>
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <Icon className="w-5 h-5 text-blue-600" />
                            {currentSectionData?.title}
                        </h3>
                        {renderSectionContent()}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={prevSection}
                        disabled={currentSection === 1 || loading}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                            ${currentSection === 1 || loading
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }
                        `}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                    </button>

                    <div className="text-sm text-gray-500">
                        Step {currentSection} of {totalSections}
                    </div>

                    {currentSection < totalSections ? (
                        <button
                            type="button"
                            onClick={nextSection}
                            disabled={loading}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-white
                                ${loading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }
                            `}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading || !formData.firstName || !formData.lastName || !formData.dob}
                            className={`
                                px-6 py-2 rounded-lg font-medium text-white transition-all
                                ${loading || !formData.firstName || !formData.lastName || !formData.dob
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 shadow-md'
                                }
                            `}
                        >
                            {loading ? 'Registering...' : 'Register Patient'}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default AddPatientModal;
