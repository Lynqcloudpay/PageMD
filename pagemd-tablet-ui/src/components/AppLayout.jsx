import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';

export function AppLayout() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50">
            <Sidebar />
            <main className="flex-1 overflow-hidden flex flex-col">
                <Outlet />
            </main>
        </div>
    );
}
