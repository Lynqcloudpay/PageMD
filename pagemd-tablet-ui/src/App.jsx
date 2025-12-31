import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { TodayQueuePage } from './pages/TodayQueuePage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientChartPage } from './pages/PatientChartPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<TodayQueuePage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patient/:patientId" element={<PatientChartPage />} />
            <Route path="/tasks" element={<PlaceholderPage title="Tasks" />} />
            <Route path="/messages" element={<PlaceholderPage title="Messages" />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Placeholder for pages not yet implemented
function PlaceholderPage({ title }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-slate-400">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p>Coming soon</p>
      </div>
    </div>
  );
}

export default App;
