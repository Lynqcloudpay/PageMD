import React, { useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import PatientHeader from './components/PatientHeader'
import PatientNoteLayout from './components/PatientNoteLayout'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy load pages for performance
const Snapshot = lazy(() => import('./pages/Snapshot'));
const VisitNote = lazy(() => import('./pages/VisitNote'));
const Schedule = lazy(() => import('./pages/Schedule'));
const MySchedule = lazy(() => import('./pages/MySchedule'));
const Patients = lazy(() => import('./pages/Patients'));
const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PendingNotes = lazy(() => import('./pages/PendingNotes'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Messages = lazy(() => import('./pages/Messages'));
const Telehealth = lazy(() => import('./pages/Telehealth'));
const Billing = lazy(() => import('./pages/Billing'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Cancellations = lazy(() => import('./pages/Cancellations'));
const Profile = lazy(() => import('./pages/Profile'));
const Superbill = lazy(() => import('./pages/Superbill'));

// Platform Admin lazy loads
const PlatformAdminLogin = lazy(() => import('./pages/PlatformAdminLogin'));
const PlatformAdminDashboard = lazy(() => import('./pages/PlatformAdminDashboard'));
const PlatformAdminClinics = lazy(() => import('./pages/PlatformAdminClinics'));
const PlatformAdminTeam = lazy(() => import('./pages/PlatformAdminTeam'));
const PlatformAdminProfile = lazy(() => import('./pages/PlatformAdminProfile'));
const PlatformAdminClinicDetails = lazy(() => import('./pages/PlatformAdminClinicDetails'));
const PlatformAdminRoles = lazy(() => import('./pages/PlatformAdminRoles'));
const PlatformAdminSupport = lazy(() => import('./pages/PlatformAdminSupport'));
const PlatformAdminRevenue = lazy(() => import('./pages/PlatformAdminRevenue'));
const ImpersonateHandler = lazy(() => import('./pages/ImpersonateHandler'));
import { PatientProvider } from './context/PatientContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PatientTabsProvider } from './context/PatientTabsContext'
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext'
import { TaskProvider } from './context/TaskContext'
import { PlatformAdminProvider } from './context/PlatformAdminContext'
// No updates needed in these lines but replaced for block context

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

        <PlatformAdminProvider>
            <AuthProvider>
                <PatientProvider>
                    <TaskProvider>
                        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                            <KeyboardShortcutsProvider>
                                <PatientTabsProvider>
                                    <div className="min-h-screen font-sans bg-white">
                                        <Suspense fallback={
                                            <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                                                <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4" />
                                                <div className="text-sm font-medium text-gray-500 animate-pulse">Loading clinic...</div>
                                            </div>
                                        }>
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
                                        </Suspense>
                                    </div>
                                </PatientTabsProvider>
                            </KeyboardShortcutsProvider>
                        </Router>
                    </TaskProvider>
                </PatientProvider>
            </AuthProvider>
        </PlatformAdminProvider>

    )
}

export default App
