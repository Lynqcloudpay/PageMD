import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';

/**
 * AppLayout - Matches main PageMD EMR layout structure
 * Sidebar fixed left (w-72), content area with ml-72
 */
export function AppLayout() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <div className="flex min-h-screen bg-white">
            {/* Sidebar - fixed left, same as main EMR */}
            <Sidebar />

            {/* Main Content - offset by sidebar width */}
            <main className="flex-1 ml-72 bg-[#F8FAFC]">
                <Outlet />
            </main>
        </div>
    );
}
