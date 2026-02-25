import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformAdmin } from '../context/PlatformAdminContext';
import { Shield, ChevronLeft, Database } from 'lucide-react';
import ArchiveBrowser from '../components/ArchiveBrowser';

const PlatformAdminArchives = () => {
    const navigate = useNavigate();
    const { isAuthenticated, admin, logout } = usePlatformAdmin();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/platform-admin/login');
        }
    }, [isAuthenticated, navigate]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/platform-admin/dashboard')}
                                className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-500" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Database className="w-5 h-5 text-cyan-600" />
                                    Archives
                                </h1>
                                <p className="text-xs text-gray-500">Manage HIPAA-compliant backups</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-medium text-gray-600 border border-gray-200">
                                {admin?.email}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 py-8">
                <div className="mb-6">
                    <ArchiveBrowser />
                </div>
            </main>
        </div>
    );
};

export default PlatformAdminArchives;
