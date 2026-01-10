import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import PatientHeader from './components/PatientHeader'
import PatientNoteLayout from './components/PatientNoteLayout'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { PatientProvider } from './context/PatientContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PatientTabsProvider } from './context/PatientTabsContext'
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext'
import { TaskProvider } from './context/TaskContext'
import { PlatformAdminProvider } from './context/PlatformAdminContext'
import { NotificationProvider } from './components/NotificationProvider'

// Lazy loaded pages/components
const Snapshot = React.lazy(() => import('./pages/Snapshot'));
const VisitNote = React.lazy(() => import('./pages/VisitNote'));
const Schedule = React.lazy(() => import('./pages/Schedule'));
const MySchedule = React.lazy(() => import('./pages/MySchedule'));
const Patients = React.lazy(() => import('./pages/Patients'));
const Login = React.lazy(() => import('./pages/Login'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const FeaturesPage = React.lazy(() => import('./pages/FeaturesPage'));
const SecurityPage = React.lazy(() => import('./pages/SecurityPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const PendingNotes = React.lazy(() => import('./pages/PendingNotes'));
const Inbasket = React.lazy(() => import('./pages/Inbasket'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Messages = React.lazy(() => import('./pages/Messages'));
const Telehealth = React.lazy(() => import('./pages/Telehealth'));
const Billing = React.lazy(() => import('./pages/Billing'));
const BillingManager = React.lazy(() => import('./pages/BillingManager'));
const PaymentPosting = React.lazy(() => import('./pages/PaymentPosting'));
const BillingReports = React.lazy(() => import('./pages/BillingReports'));
const PatientStatements = React.lazy(() => import('./pages/PatientStatements'));
const ClaimViewer = React.lazy(() => import('./pages/ClaimViewer'));
const AdminSettings = React.lazy(() => import('./pages/AdminSettings'));
const UserManagement = React.lazy(() => import('./pages/UserManagement'));
const Cancellations = React.lazy(() => import('./pages/Cancellations'));
const Profile = React.lazy(() => import('./pages/Profile'));
const FeeSheet = React.lazy(() => import('./pages/FeeSheet'));
const Compliance = React.lazy(() => import('./pages/Compliance'));

const PlatformAdminLogin = React.lazy(() => import('./pages/PlatformAdminLogin'));
const PlatformAdminDashboard = React.lazy(() => import('./pages/PlatformAdminDashboard'));
const PlatformAdminClinics = React.lazy(() => import('./pages/PlatformAdminClinics'));
const PlatformAdminTeam = React.lazy(() => import('./pages/PlatformAdminTeam'));
const PlatformAdminProfile = React.lazy(() => import('./pages/PlatformAdminProfile'));
const PlatformAdminClinicDetails = React.lazy(() => import('./pages/PlatformAdminClinicDetails'));
const PlatformAdminRoles = React.lazy(() => import('./pages/PlatformAdminRoles'));
const PlatformAdminSupport = React.lazy(() => import('./pages/PlatformAdminSupport'));
const PlatformAdminRevenue = React.lazy(() => import('./pages/PlatformAdminRevenue'));
const ImpersonateHandler = React.lazy(() => import('./pages/ImpersonateHandler'));
const SalesAdmin = React.lazy(() => import('./pages/SalesAdmin'));

const PortalLogin = React.lazy(() => import('./portal/PortalLogin'));
const PortalDashboard = React.lazy(() => import('./portal/PortalDashboard'));
const PortalRegister = React.lazy(() => import('./portal/PortalRegister'));
const PortalForgotPassword = React.lazy(() => import('./portal/PortalForgotPassword'));
const PortalResetPassword = React.lazy(() => import('./portal/PortalResetPassword'));
const PublicIntake = React.lazy(() => import('./pages/PublicIntake'));
const DigitalIntake = React.lazy(() => import('./pages/DigitalIntake'));

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
                <NotificationProvider>
                    <AuthProvider>
                        <PatientProvider>
                            <TaskProvider>
                                <KeyboardShortcutsProvider>
                                    <PatientTabsProvider>
                                        <div className="min-h-screen font-sans bg-white">
                                            <React.Suspense fallback={
                                                <div className="min-h-screen flex items-center justify-center">
                                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                                                    <Route path="/digital-intake" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><DigitalIntake /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/intake" element={
                                                        <React.Suspense fallback={<div>Loading Registration...</div>}>
                                                            <PublicIntake />
                                                        </React.Suspense>
                                                    } />
                                                    <Route path="/sales-admin" element={<SalesAdmin />} />

                                                    {/* Patient Portal Routes */}
                                                    <Route path="/portal/login" element={<PortalLogin />} />
                                                    <Route path="/portal/register" element={<PortalRegister />} />
                                                    <Route path="/portal/forgot-password" element={<PortalForgotPassword />} />
                                                    <Route path="/portal/reset-password" element={<PortalResetPassword />} />
                                                    <Route path="/portal/dashboard" element={<PortalDashboard />} />
                                                    <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
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
                                                                <Layout><Inbasket /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    {/* Alias /inbox to /tasks */}
                                                    <Route path="/inbox" element={<Navigate to="/tasks" replace />} />
                                                    <Route path="/analytics" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><Analytics /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/compliance" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><Compliance /></Layout>
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
                                                    <Route path="/billing/manager" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><BillingManager /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/claims/:id" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><ClaimViewer /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/billing/posting" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><PaymentPosting /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/billing/reports/ar-aging" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><BillingReports /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/billing/reports/collections" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><BillingReports /></Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/billing/statements" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout><PatientStatements /></Layout>
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
                                                    <Route path="/patient/:id/fee-sheet/:visitId" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout>
                                                                    <FeeSheet />
                                                                </Layout>
                                                            </ErrorBoundary>
                                                        </ProtectedRoute>
                                                    } />
                                                    <Route path="/patient/:id/superbill/:visitId" element={
                                                        <ProtectedRoute>
                                                            <ErrorBoundary>
                                                                <Layout>
                                                                    <FeeSheet />
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
                                            </React.Suspense>
                                        </div>
                                    </PatientTabsProvider>
                                </KeyboardShortcutsProvider>
                            </TaskProvider>
                        </PatientProvider>
                    </AuthProvider>
                </NotificationProvider>
            </PlatformAdminProvider>
        </Router>
    )
}

export default App
