import React, { createContext, useContext, useState, useEffect } from 'react';
import { patientsAPI } from '../services/api';

const PatientContext = createContext();

export const usePatient = () => useContext(PatientContext);

export const PatientProvider = ({ children }) => {
    const [patients, setPatients] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch patients from API
    const fetchPatients = async () => {
        try {
            setLoading(true);
            const response = await patientsAPI.search(''); // Empty search to get all patients
            const fetchedPatients = response.data.map(p => ({
                ...p,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
                // Calculate age from dob if needed
                age: p.dob ? Math.floor((new Date() - new Date(p.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null
            }));
            setPatients(fetchedPatients);
        } catch (error) {
            console.error('Error fetching patients:', error);
            // Fallback to empty array if API fails
            setPatients([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch patients from API on mount and auto-refresh
    useEffect(() => {
        fetchPatients();

        // Auto-refresh every 60 seconds (reduced frequency to prevent rate limiting)
        const interval = setInterval(() => {
            fetchPatients();
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    // Keep appointments in localStorage for now (can be migrated to API later)
    useEffect(() => {
        const saved = localStorage.getItem('appointments');
        if (saved) {
            try {
                setAppointments(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing saved appointments:', e);
            }
        }
    }, []);

    useEffect(() => {
        if (appointments.length > 0) {
            localStorage.setItem('appointments', JSON.stringify(appointments));
        }
    }, [appointments]);

    const addPatient = async (patient) => {
        try {
            const response = await patientsAPI.create({
                firstName: patient.firstName || patient.first_name,
                lastName: patient.lastName || patient.last_name,
                dob: patient.dob,
                sex: patient.sex,
                phone: patient.phone,
                email: patient.email,
                addressLine1: patient.addressLine1 || patient.address_line1,
                addressLine2: patient.addressLine2 || patient.address_line2,
                city: patient.city,
                state: patient.state,
                zip: patient.zip,
                insuranceProvider: patient.insuranceProvider || patient.insurance_provider,
                insuranceId: patient.insuranceId || patient.insurance_id,
            });
            const newPatient = {
                ...response.data,
                name: `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim() || 'Unknown Patient',
                age: response.data.dob ? Math.floor((new Date() - new Date(response.data.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null
            };
            // Refetch all patients to ensure we have the latest data
            await fetchPatients();
            return newPatient;
        } catch (error) {
            console.error('Error creating patient:', error);
            throw error;
        }
    };

    const addAppointment = (appt) => {
        const newAppt = { ...appt, id: appointments.length + 1 };
        setAppointments([...appointments, newAppt]);
    };

    const searchPatients = (query) => {
        if (!query) return [];
        return patients.filter(p => {
            const name = p.name ? p.name.toLowerCase() : '';
            const mrn = p.mrn ? p.mrn.toLowerCase() : '';
            const q = query.toLowerCase();
            return name.includes(q) || mrn.includes(q);
        });
    };

    const getPatient = (id) => {
        // Try to find by UUID (string match) or by converting to number for backward compatibility
        return patients.find(p => p.id === id || p.id === String(id) || p.id === Number(id));
    };

    return (
        <PatientContext.Provider value={{ patients, appointments, addPatient, addAppointment, searchPatients, getPatient, loading, fetchPatients }}>
            {children}
        </PatientContext.Provider>
    );
};
