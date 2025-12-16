import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import PatientHeader from './components/PatientHeader'
import Snapshot from './pages/Snapshot'
import VisitNote from './pages/VisitNote'
import Schedule from './pages/Schedule'
import MySchedule from './pages/MySchedule'
import Patients from './pages/Patients'
import Login from './pages/Login'
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
import Layout from './components/Layout'
import { PatientProvider } from './context/PatientContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PatientTabsProvider } from './context/PatientTabsContext'
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext'
import { TaskProvider } from './context/TaskContext'

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

    return <>{children}</>;
};

function App() {
    return (
        
            <AuthProvider>
                <PatientProvider>
                    <TaskProvider>
                        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <KeyboardShortcutsProvider>
                            <PatientTabsProvider>
                                <div className="min-h-screen font-sans bg-white">
                                    <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={
                                    <ProtectedRoute>
                                        <Layout><Dashboard /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/schedule" element={
                                    <ProtectedRoute>
                                        <Layout><Schedule /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/my-schedule" element={
                                    <ProtectedRoute>
                                        <Layout><MySchedule /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/patients" element={
                                    <ProtectedRoute>
                                        <Layout><Patients /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/pending-notes" element={
                                    <ProtectedRoute>
                                        <Layout><PendingNotes /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/tasks" element={
                                    <ProtectedRoute>
                                        <Layout><TaskManager /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/analytics" element={
                                    <ProtectedRoute>
                                        <Layout><Analytics /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/messages" element={
                                    <ProtectedRoute>
                                        <Layout><Messages /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/telehealth" element={
                                    <ProtectedRoute>
                                        <Layout><Telehealth /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/billing" element={
                                    <ProtectedRoute>
                                        <Layout><Billing /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/cancellations" element={
                                    <ProtectedRoute>
                                        <Layout><Cancellations /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/users" element={
                                    <ProtectedRoute>
                                        <Layout><UserManagement /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/admin-settings" element={
                                    <ProtectedRoute>
                                        <Layout><AdminSettings /></Layout>
                                    </ProtectedRoute>
                                } />
                                {/* Patient routes - flat structure to avoid nested Routes issues */}
                                <Route path="/patient/:id/visit/new" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <PatientHeader />
                                            <VisitNote />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/patient/:id/visit/:visitId" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <PatientHeader />
                                            <VisitNote />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/patient/:id/snapshot" element={
                                    <ProtectedRoute>
                                        <Layout><Snapshot /></Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/patient/:id/notes" element={
                                    <ProtectedRoute>
                                        <Layout><Snapshot showNotesOnly={true} /></Layout>
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
                    </Router>
                    </TaskProvider>
                </PatientProvider>
            </AuthProvider>
        
    )
}

export default App
