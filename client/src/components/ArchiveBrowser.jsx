import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { HiDownload, HiSearch, HiArchive } from 'react-icons/hi';
import { format } from 'date-fns';

const ArchiveBrowser = () => {
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchArchives();
    }, []);

    const fetchArchives = async () => {
        try {
            setLoading(true);
            const data = await apiCall('/super/archives');
            // Ensure data is an array
            if (Array.isArray(data)) {
                setArchives(data);
            } else {
                console.error("[ArchiveBrowser] API returned non-array:", data);
                setArchives([]);
            }
        } catch (err) {
            console.error("[ArchiveBrowser] Failed to fetch archives:", err);
            setError('Failed to load archives. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (filename) => {
        try {
            // We use a direct window.location for secure download triggering via browser
            // The request will include the cookie/session, but for Platform Admin we
            // usually use a token in header. Since this is a file download, we might need
            // to fetch as blob if auth is header-based.
            const token = localStorage.getItem('platform_token');

            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/super/archives/${filename}`, {
                headers: {
                    'x-platform-token': token
                }
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download error:", err);
            alert('Failed to download archive.');
        }
    };

    // Filter Logic
    const filteredArchives = archives.filter(arch =>
        arch.filename.toLowerCase().includes(search.toLowerCase())
    );

    // Initial Empty State
    if (!loading && archives.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <HiArchive className="text-gray-400 text-xl" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">No Archives Found</h3>
                <p className="text-gray-500 text-sm">Deleted clinics will appear here.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header / Toolbar */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Clinic Archives</h2>
                    <p className="text-sm text-gray-500">HIPAA-compliant encrypted backups of deleted clinics.</p>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiSearch className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search filename..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none w-full sm:w-64"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="p-8 text-center text-gray-500 text-sm">
                    Loading archives...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm mx-6 my-4 rounded">
                    {error}
                </div>
            )}

            {/* Table */}
            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-6 py-3">Filename</th>
                                <th className="px-6 py-3">Created At</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredArchives.map((file) => (
                                <tr key={file.filename} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-xs text-gray-900">
                                        {file.filename}
                                    </td>
                                    <td className="px-6 py-4">
                                        {format(new Date(file.created_at), 'MMM d, yyyy HH:mm')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDownload(file.filename)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
                                        >
                                            <HiDownload className="text-sm" />
                                            Download
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer / Pagination (Optional) */}
            {!loading && filteredArchives.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between">
                    <span>Showing {filteredArchives.length} archives</span>
                </div>
            )}
        </div>
    );
};

export default ArchiveBrowser;
