import React, { useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import PatientHeader from './PatientHeader';
import PatientChartPanel from './PatientChartPanel';
import EPrescribeEnhanced from './EPrescribeEnhanced';

const PatientNoteLayout = ({ children }) => {
    const { id } = useParams();
    const [showChart, setShowChart] = useState(false);
    const [chartTab, setChartTab] = useState('overview');
    const [showEPrescribe, setShowEPrescribe] = useState(false);

    // Action Handler called by PatientHeader
    const handleAction = (tab, action) => {
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
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <PatientHeader
                onOpenChart={() => { setChartTab('history'); setShowChart(true); }}
                onAction={handleAction}
            />

            {children ? children : (
                <Outlet context={{
                    openChart: (tab = 'overview') => { setChartTab(tab); setShowChart(true); },
                    openEPrescribe: () => setShowEPrescribe(true)
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
        </div>
    );
};

export default PatientNoteLayout;
