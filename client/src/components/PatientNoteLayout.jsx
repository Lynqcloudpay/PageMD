import React, { useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import PatientHeader from './PatientHeader';
import PatientChartPanel from './PatientChartPanel';
import EPrescribeEnhanced from './EPrescribeEnhanced';
import MessagingModal from './MessagingModal';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';

const PatientNoteLayout = ({ children }) => {
    const { id } = useParams();
    const { user } = useAuth();
    const { getPatient } = usePatient();
    const patient = getPatient(id);

    const [showChart, setShowChart] = useState(false);
    const [chartTab, setChartTab] = useState('overview');
    const [showEPrescribe, setShowEPrescribe] = useState(false);
    const [showMessaging, setShowMessaging] = useState(false);

    // Action Handler called by PatientHeader
    const handleAction = (tab, action) => {
        // If the first argument is exactly 'message', it's coming from PatientHeader's onAction?.('message')
        if (tab === 'message') {
            setShowMessaging(true);
            return;
        }

        if (tab) {
            setChartTab(tab);
            setShowChart(true);
        } else if (action === 'eprescribe') {
            setShowEPrescribe(true);
        } else if (action === 'upload') {
            // "Upload" just opens the Documents tab in the chart panel
            // where upload functionality already exists
            setChartTab('documents');
            setShowChart(true);
        } else if (action === 'message') {
            setShowMessaging(true);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <PatientHeader
                onOpenChart={() => { setChartTab('history'); setShowChart(true); }}
                onAction={handleAction}
                onMessage={() => setShowMessaging(true)}
            />

            {children ? children : (
                <Outlet context={{
                    openChart: (tab = 'overview') => { setChartTab(tab); setShowChart(true); },
                    openEPrescribe: () => setShowEPrescribe(true),
                    openMessaging: () => setShowMessaging(true)
                }} />
            )}

            <PatientChartPanel
                patientId={id}
                isOpen={showChart}
                onClose={() => setShowChart(false)}
                initialTab={chartTab}
            />

            {showEPrescribe && (
                <EPrescribeEnhanced
                    isOpen={true}
                    onClose={() => setShowEPrescribe(false)}
                    patientId={id}
                    onSuccess={() => setShowEPrescribe(false)}
                />
            )}

            {showMessaging && (
                <MessagingModal
                    isOpen={true}
                    onClose={() => setShowMessaging(false)}
                    patient={patient}
                    currentUser={user}
                />
            )}
        </div>
    );
};

export default PatientNoteLayout;
