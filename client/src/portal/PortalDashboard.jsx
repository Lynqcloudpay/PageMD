import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    MessageSquare,
    Calendar,
    FileText,
    LogOut,
    User,
    Phone,
    Activity,
    ShieldCheck,
    ChevronRight,
    Pill,
    AlertCircle,
    ClipboardList,
    FlaskConical,
    Menu,
    X
} from 'lucide-react';
import PortalMessages from './PortalMessages';
import PortalAppointments from './PortalAppointments';

const PortalDashboard = () => {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, messages, appointments, record
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem('portalToken');
                if (!token) {
                    navigate('/portal/login');
                    return;
                }

                const apiBase = import.meta.env.VITE_API_URL || '/api';
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
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Secure Records...</div>
            </div>
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
                    <div className="p-16 text-center bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/50 animate-in fade-in zoom-in duration-300">
                        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Health Record Vault</h3>
                        <p className="text-slate-500 max-w-md mx-auto leading-relaxed">Your detailed clinical documents, lab results, and visit summaries are being synchronized and will be available shortly.</p>
                        <button
                            onClick={() => setActiveTab('overview')}
                            className="mt-8 px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                );
            case 'overview':
            default:
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            {/* Patient Info Card */}
                            <div className="xl:col-span-2 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 p-10 border border-slate-50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50 group-hover:bg-blue-100 transition-colors" />

                                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8 mb-10">
                                    <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20 ring-4 ring-slate-50">
                                        <User className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{patient?.first_name} {patient?.last_name}</h2>
                                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">Active Profile</div>
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Patient MRN: <span className="text-slate-600">{patient?.id?.slice(0, 8).toUpperCase()}</span></p>
                                    </div>
                                </div>

                                <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            <Calendar className="w-3 h-3" /> Date of Birth
                                        </div>
                                        <div className="text-xl font-black text-slate-800">{patient?.dob}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            <ShieldCheck className="w-3 h-3" /> Biological Sex
                                        </div>
                                        <div className="text-xl font-black text-slate-800 capitalize">{patient?.sex || 'Not Specified'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            <Phone className="w-3 h-3" /> Contact Phone
                                        </div>
                                        <div className="text-xl font-black text-slate-800">{patient?.phone || 'No phone on file'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Cards */}
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => setActiveTab('appointments')}
                                    className="group relative h-1/2 w-full text-left bg-blue-600 hover:bg-blue-700 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-300/40 transition-all hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                                                <Calendar className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-white w-fit mb-4">Recommended</div>
                                            <h3 className="text-2xl font-black text-white tracking-tight leading-tight">Request an<br />Appointment</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                                            Schedule now <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className="group relative h-1/2 w-full text-left bg-white hover:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/60 transition-all hover:shadow-slate-900/10 hover:-translate-y-1 border border-slate-50"
                                >
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <div className="w-12 h-12 bg-blue-50 group-hover:bg-white/10 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                                                <MessageSquare className="w-6 h-6 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-white tracking-tight leading-tight">Secure<br />Messaging</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-white/60 font-bold text-sm transition-colors">
                                            Message your provider <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <QuickCard
                                title="Medications"
                                icon={<Pill className="w-6 h-6" />}
                                status="Active"
                                count="No changes"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Allergies"
                                icon={<AlertCircle className="w-6 h-6" />}
                                status="Verified"
                                count="3 on file"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Visit Notes"
                                icon={<ClipboardList className="w-6 h-6" />}
                                status="Latest: 2025"
                                count="View full chart"
                                onClick={() => setActiveTab('record')}
                            />
                            <QuickCard
                                title="Lab Results"
                                icon={<FlaskConical className="w-6 h-6" />}
                                status="Syncing"
                                count="Check back soon"
                                onClick={() => setActiveTab('record')}
                            />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-blue-100">
            {/* Desktop Sidebar */}
            <aside className="w-[280px] hidden lg:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-100 z-50">
                <div className="p-10">
                    <div className="flex items-center gap-3 mb-12">
                        <img src="/logo.png" alt="PageMD Logo" className="h-10 object-contain" />
                        <div className="h-6 w-px bg-slate-200" />
                        <span className="font-black text-slate-900 text-xl tracking-tighter">PORTAL</span>
                    </div>

                    <nav className="space-y-2">
                        <NavItem
                            icon={<LayoutDashboard className="w-5 h-5" />}
                            label="Overview"
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                        />
                        <NavItem
                            icon={<FileText className="w-5 h-5" />}
                            label="Health Record"
                            active={activeTab === 'record'}
                            onClick={() => setActiveTab('record')}
                        />
                        <NavItem
                            icon={<MessageSquare className="w-5 h-5" />}
                            label="Messages"
                            active={activeTab === 'messages'}
                            onClick={() => setActiveTab('messages')}
                        />
                        <NavItem
                            icon={<Calendar className="w-5 h-5" />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => setActiveTab('appointments')}
                        />
                    </nav>
                </div>

                <div className="mt-auto p-8 pt-0">
                    <div className="bg-slate-50 rounded-3xl p-6 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Activity className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Support</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-wider">Need assistance with your records? Call the clinic directly.</p>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.removeItem('portalToken');
                            navigate('/portal/login');
                        }}
                        className="w-full flex items-center gap-3 p-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all font-black uppercase tracking-widest text-[11px]"
                    >
                        <LogOut className="w-4 h-4" /> Log Out Session
                    </button>
                </div>
            </aside>

            {/* Mobile Nav */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 z-[60] flex justify-between items-center">
                <img src="/logo.png" alt="PageMD Logo" className="h-8 object-contain" />
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-900">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 bg-white z-[55] pt-24 animate-in slide-in-from-top duration-300">
                    <nav className="px-6 space-y-4">
                        <NavItem
                            icon={<LayoutDashboard className="w-5 h-5" />}
                            label="Overview"
                            active={activeTab === 'overview'}
                            onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<FileText className="w-5 h-5" />}
                            label="Health Record"
                            active={activeTab === 'record'}
                            onClick={() => { setActiveTab('record'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<MessageSquare className="w-5 h-5" />}
                            label="Messages"
                            active={activeTab === 'messages'}
                            onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }}
                        />
                        <NavItem
                            icon={<Calendar className="w-5 h-5" />}
                            label="Appointments"
                            active={activeTab === 'appointments'}
                            onClick={() => { setActiveTab('appointments'); setIsMobileMenuOpen(false); }}
                        />
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-[280px] overflow-x-hidden min-h-screen">
                <main className="max-w-7xl mx-auto p-6 md:p-10 lg:p-16 pt-28 lg:pt-16">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${active
            ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10'
            : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
    >
        <span className={`transition-transform duration-500 ${active ? 'scale-110' : ''}`}>{icon}</span>
        <span className="font-black text-sm uppercase tracking-widest">{label}</span>
    </button>
);

const QuickCard = ({ title, icon, status, count, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-50 hover:shadow-2xl hover:shadow-slate-300/40 transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="w-14 h-14 mb-6 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all duration-500">
            {icon}
        </div>
        <h3 className="font-black text-slate-900 mb-2 tracking-tight">{title}</h3>
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">{status}</span>
            <span className="text-xs text-slate-400 font-bold">{count}</span>
        </div>
    </div>
);

export default PortalDashboard;
