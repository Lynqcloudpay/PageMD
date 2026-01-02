import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PortalMessages from './PortalMessages';
import PortalAppointments from './PortalAppointments';

const PortalDashboard = () => {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, messages, appointments, record
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem('portalToken');
                if (!token) {
                    navigate('/portal/login');
                    return;
                }

                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const response = await axios.get(`${apiBase}/portal/chart/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setPatient(response.data);
            } catch (err) {
                console.error('Failed to fetch dashboard:', err);
                if (err.response?.status === 401) {
                    navigate('/portal/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [navigate]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-pulse text-slate-400 font-medium">Loading your health portal...</div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'messages':
                return <PortalMessages />;
            case 'appointments':
                return <PortalAppointments />;
            case 'record':
                return (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <div className="text-4xl mb-4">📂</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">My Health Record</h3>
                        <p>Detailed lab results and visit notes will appear here soon.</p>
                        <button onClick={() => setActiveTab('overview')} className="mt-4 text-blue-600 font-bold">Back to Overview</button>
                    </div>
                );
            case 'overview':
            default:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 md:col-span-2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">👤</div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{patient?.first_name} {patient?.last_name}</h2>
                                        <p className="text-slate-500">Patient MRN: {patient?.id?.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                                    <div>
                                        <div className="text-slate-400 mb-1 font-medium">Date of Birth</div>
                                        <div className="font-bold text-slate-800">{patient?.dob}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-1 font-medium">Gender</div>
                                        <div className="font-bold text-slate-800 capitalize">{patient?.sex || 'Not Specified'}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-1 font-medium">Phone</div>
                                        <div className="font-bold text-slate-800">{patient?.phone || 'No phone on file'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setActiveTab('appointments')}
                                    className="w-full text-left bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-3xl shadow-xl shadow-blue-200 transition-all transform hover:-translate-y-1"
                                >
                                    <div className="text-xs uppercase tracking-widest opacity-70 mb-2 font-bold">Recommended</div>
                                    <div className="font-bold text-lg">Request Appointment</div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 p-6 rounded-3xl shadow-sm transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <div className="font-bold text-slate-800">Secure Messaging</div>
                                        <div className="text-xs text-slate-500">Message your provider</div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-white text-slate-400 transition">→</div>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <Card title="Medications" icon="💊" count="Active" onClick={() => setActiveTab('record')} />
                            <Card title="Allergies" icon="⚠️" count="Active" onClick={() => setActiveTab('record')} />
                            <Card title="Visit Notes" icon="📄" count="Last: 2025" onClick={() => setActiveTab('record')} />
                            <Card title="Lab Results" icon="🧬" count="Latest" onClick={() => setActiveTab('record')} />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex">
            {/* Sidebar Desktop */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <span className="text-white font-black text-xl italic">PMD</span>
                        </div>
                        <span className="font-black text-slate-800 text-xl tracking-tight">Portal</span>
                    </div>

                    <nav className="space-y-2">
                        <NavItem icon="🏠" label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                        <NavItem icon="📂" label="Health Record" active={activeTab === 'record'} onClick={() => setActiveTab('record')} />
                        <NavItem icon="💬" label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
                        <NavItem icon="📅" label="Appointments" active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} />
                    </nav>
                </div>

                <div className="mt-auto p-8 pt-0">
                    <button
                        onClick={() => {
                            localStorage.removeItem('portalToken');
                            navigate('/portal/login');
                        }}
                        className="w-full flex items-center gap-3 p-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all font-bold"
                    >
                        <span>🚪</span> Log Out
                    </button>
                </div>
            </aside>

            {/* Mobile Nav Top */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-100 p-4 z-40 flex justify-between items-center">
                <div className="font-black text-blue-600">PMD Portal</div>
                <button className="p-2 text-slate-500">☰</button>
            </div>

            <div className="flex-1 overflow-x-hidden">
                <main className="max-w-6xl mx-auto p-6 lg:p-12 pt-24 lg:pt-12">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'
            }`}
    >
        <span className="text-xl">{icon}</span>
        {label}
    </button>
);

const Card = ({ title, icon, count, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group hover:-translate-y-1"
    >
        <div className="text-3xl mb-4 p-4 bg-slate-50 rounded-2xl w-fit group-hover:bg-blue-50 transition-colors">{icon}</div>
        <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{count}</div>
    </div>
);

export default PortalDashboard;
