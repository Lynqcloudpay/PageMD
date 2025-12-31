import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { TodaySchedulePage } from './pages/TodaySchedulePage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientChartPage } from './pages/PatientChartPage';
import { VisitNotePage } from './pages/VisitNotePage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes - same structure as main EMR */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<TodaySchedulePage />} />
            <Route path="/schedule" element={<TodaySchedulePage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patient/:patientId" element={<PatientChartPage />} />
            <Route path="/patient/:patientId/snapshot" element={<PatientChartPage />} />
            <Route path="/patient/:patientId/note" element={<VisitNotePage />} />
            <Route path="/patient/:patientId/visit/:visitId" element={<VisitNotePage />} />
            <Route path="/cancellations" element={<PlaceholderPage title="Cancellations" />} />
            <Route path="/pending-notes" element={<PlaceholderPage title="Pending Notes" />} />
            <Route path="/telehealth" element={<PlaceholderPage title="Telehealth" />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Placeholder for pages that mirror main EMR but aren't tablet-specific
function PlaceholderPage({ title }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center text-gray-400">
        <h2 className="text-2xl font-bold text-gray-500 mb-2">{title}</h2>
        <p>This page uses the same data as the main PageMD EMR.</p>
        <p className="text-sm mt-2">Access via main desktop for full functionality.</p>
      </div>
    </div>
  );
}

export default App;
