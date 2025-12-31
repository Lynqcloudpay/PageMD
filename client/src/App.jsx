import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import PatientHeader from './components/PatientHeader'
import PatientNoteLayout from './components/PatientNoteLayout'
import Snapshot from './pages/Snapshot'
import VisitNote from './pages/VisitNote'
import Schedule from './pages/Schedule'
import MySchedule from './pages/MySchedule'

import Patients from './pages/Patients'
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import FeaturesPage from './pages/FeaturesPage'
import SecurityPage from './pages/SecurityPage'
import PricingPage from './pages/PricingPage'
import ContactPage from './pages/ContactPage'
import AboutPage from './pages/AboutPage'
import Dashboard from './pages/Dashboard'
import PendingNotes from './pages/PendingNotes'
import TaskManager from './pages/TaskManager'
import Analytics from './pages/Analytics'
import Messages from './pages/Messages'
import Telehealth from './pages/Telehealth'
import Billing from './pages/Billing'
import UserManagement from './pages/UserManagement'
import AdminSettings from './pages/AdminSettings'
import Cancellations from './pages/Cancellations'
import Profile from './pages/Profile'
import Superbill from './pages/Superbill'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { PatientProvider } from './context/PatientContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PatientTabsProvider } from './context/PatientTabsContext'
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext'
import { TaskProvider } from './context/TaskContext'
import { PlatformAdminProvider } from './context/PlatformAdminContext'
import PlatformAdminLogin from './pages/PlatformAdminLogin'
import PlatformAdminDashboard from './pages/PlatformAdminDashboard'
import PlatformAdminClinics from './pages/PlatformAdminClinics'
import PlatformAdminTeam from './pages/PlatformAdminTeam'
import PlatformAdminProfile from './pages/PlatformAdminProfile'
import PlatformAdminClinicDetails from './pages/PlatformAdminClinicDetails'
import PlatformAdminRoles from './pages/PlatformAdminRoles'
import PlatformAdminSupport from './pages/PlatformAdminSupport'
import PlatformAdminRevenue from './pages/PlatformAdminRevenue'
import ImpersonateHandler from './pages/ImpersonateHandler'

// Patient Redirect Component - redirects /patient/:id to /patient/:id/snapshot
const PatientRedirect = () => {
    const { id } = useParams();
    return <Navigate to={`/patient/${id}/snapshot`} replace />;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    // ALWAYS call all hooks at the top level, unconditionally
    const auth = useAuth();
    const navigate = useNavigate();
    const hasRedirectedRef = useRef(false);

    // Handle redirect in useEffect to avoid hook order issues
    useEffect(() => {
        if (auth && !auth.loading && !auth.user && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            navigate('/login', { replace: true });
        }
        // Reset redirect flag if user becomes available
        if (auth?.user) {
            hasRedirectedRef.current = false;
        }
    }, [auth?.loading, auth?.user, navigate]);

    // Now handle conditional rendering AFTER all hooks are called
    if (!auth || auth.loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-deep-gray/70">Loading...</div>
            </div>
        );
    }

    if (!auth.user) {
        // Show loading while redirect happens (useEffect will handle redirect)
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-deep-gray/70">Redirecting to login...</div>
            </div>
        );
    }

    console.log('ProtectedRoute: Access granted');
    return <>{children}</>;
};

function App() {
    return (
        <Router>
            <PlatformAdminProvider>
                <AuthProvider>
                    <PatientProvider>
                        <TaskProvider>
                            <KeyboardShortcutsProvider>
                                <PatientTabsProvider>
                                    <div className="min-h-screen font-sans bg-white">
                                        <Routes>
                                            {/* Platform Admin Routes */}
                                            <Route path="/platform-admin" element={<Navigate to="/platform-admin/login" replace />} />
                                            <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
                                            <Route path="/platform-admin/dashboard" element={<PlatformAdminDashboard />} />
                                            <Route path="/platform-admin/clinics" element={<PlatformAdminClinics />} />
                                            <Route path="/platform-admin/clinics/:id" element={<PlatformAdminClinicDetails />} />
                                            <Route path="/platform-admin/roles" element={<PlatformAdminRoles />} />
                                            <Route path="/platform-admin/revenue" element={<PlatformAdminRevenue />} />
                                            <Route path="/platform-admin/support" element={<PlatformAdminSupport />} />
                                            <Route path="/platform-admin/team" element={<PlatformAdminTeam />} />
                                            {/* <Route path="/platform-admin/database" element={<PlatformAdminDatabase />} /> */}
                                            <Route path="/platform-admin/settings" element={<PlatformAdminProfile />} />
                                            {/* <Route path="/platform-admin/system" element={<PlatformAdminSystem />} /> */}

                                            {/* Regular EMR Routes */}
                                            {/* Clinic Auth & Impersonation */}
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/auth/impersonate" element={<ImpersonateHandler />} />
                                            <Route path="/" element={<LandingPage />} />
                                            <Route path="/features" element={<FeaturesPage />} />
                                            <Route path="/security" element={<SecurityPage />} />
                                            <Route path="/pricing" element={<PricingPage />} />
                                            <Route path="/contact" element={<ContactPage />} />
                                            <Route path="/about" element={<AboutPage />} />
                                            <Route path="/dashboard" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Dashboard /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/schedule" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Schedule /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/my-schedule" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><MySchedule /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/patients" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Patients /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/pending-notes" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><PendingNotes /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/tasks" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><TaskManager /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/analytics" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Analytics /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/messages" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Messages /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/telehealth" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Telehealth /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/billing" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Billing /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/cancellations" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Cancellations /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/users" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><UserManagement /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/admin-settings" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><AdminSettings /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/profile" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Profile /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            {/* Patient routes - flat structure to avoid nested Routes issues */}

                                            <Route path="/patient/:id/visit/new" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout>
                                                            <PatientNoteLayout>
                                                                <VisitNote />
                                                            </PatientNoteLayout>
                                                        </Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/patient/:id/visit/:visitId" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout>
                                                            <PatientNoteLayout>
                                                                <VisitNote />
                                                            </PatientNoteLayout>
                                                        </Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/patient/:id/superbill/:superbillId" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout>
                                                            <Superbill />
                                                        </Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/patient/:id/snapshot" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Snapshot /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            <Route path="/patient/:id/notes" element={
                                                <ProtectedRoute>
                                                    <ErrorBoundary>
                                                        <Layout><Snapshot showNotesOnly={true} /></Layout>
                                                    </ErrorBoundary>
                                                </ProtectedRoute>
                                            } />
                                            {/* Catch-all redirect for /patient/:id - must come LAST */}
                                            <Route path="/patient/:id" element={
                                                <PatientRedirect />
                                            } />
                                        </Routes>
                                    </div>
                                </PatientTabsProvider>
                            </KeyboardShortcutsProvider>
                        </TaskProvider>
                    </PatientProvider>
                </AuthProvider>
            </PlatformAdminProvider>
        </Router>
    )
}

export default App
