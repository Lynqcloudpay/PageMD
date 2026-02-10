import React, { useState, useEffect, useMemo } from 'react';
import { usePlatformAdmin } from '../context/PlatformAdminContext';
import { HiDownload, HiSearch, HiArchive, HiChevronRight, HiChevronDown } from 'react-icons/hi';
import { format } from 'date-fns';

const ArchiveBrowser = () => {
    const { apiCall, token: platformToken } = usePlatformAdmin();
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [expandedClinics, setExpandedClinics] = useState({});

    useEffect(() => {
        fetchArchives();
    }, []);

    const fetchArchives = async () => {
        try {
            setLoading(true);
            const data = await apiCall('GET', '/archives');
            if (Array.isArray(data)) {
                setArchives(data);
                // Initialize expanded state for all clinics
                const expanded = {};
                data.forEach(arch => {
                    expanded[arch.clinic_slug] = true;
                });
                setExpandedClinics(expanded);
            } else {
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
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/super/archives/${filename}`, {
                headers: {
                    'X-Platform-Token': platformToken
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

    const toggleClinic = (slug) => {
        setExpandedClinics(prev => ({
            ...prev,
            [slug]: !prev[slug]
        }));
    };

    // Filter Logic
    const filteredArchives = archives.filter(arch => {
        const searchTerm = search.toLowerCase();
        return (
            arch.filename.toLowerCase().includes(searchTerm) ||
            arch.clinic_slug.toLowerCase().includes(searchTerm) ||
            arch.clinic_id.toLowerCase().includes(searchTerm)
        );
    });

    // Grouping Logic
    const groupedArchives = useMemo(() => {
        const groups = {};
        filteredArchives.forEach(arch => {
            const slug = arch.clinic_slug || 'External/Unknown';
            if (!groups[slug]) groups[slug] = [];
            groups[slug].push(arch);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredArchives]);

    if (!loading && archives.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <HiArchive className="text-slate-400 text-2xl" />
                </div>
                <h3 className="text-slate-900 font-semibold mb-1">No Archives Found</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">Deleted clinics with successful HIPAA archival will appear here.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            {/* Toolbar */}
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Archive Retrieval</h2>
                    <p className="text-xs text-slate-500">Search and manage encrypted backups by clinic.</p>
                </div>

                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <HiSearch className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by clinic or filename..."
                        className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none w-full transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading && (
                <div className="p-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Loading archives...</p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm mx-6 my-6 rounded-xl border border-red-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="p-6 space-y-4">
                    {groupedArchives.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic text-sm">
                            No matching archives for "{search}"
                        </div>
                    ) : (
                        groupedArchives.map(([slug, files]) => (
                            <div key={slug} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <button
                                    onClick={() => toggleClinic(slug)}
                                    className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100/80 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                                            <Database size={16} className="text-cyan-700" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">{slug}</span>
                                            <span className="ml-3 text-[10px] font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                                                {files.length} {files.length === 1 ? 'Archive' : 'Archives'}
                                            </span>
                                        </div>
                                    </div>
                                    {expandedClinics[slug] ? <HiChevronDown className="text-slate-400" /> : <HiChevronRight className="text-slate-400" />}
                                </button>

                                {expandedClinics[slug] && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-slate-600 border-t border-slate-100">
                                            <thead className="bg-white text-slate-400 uppercase font-semibold text-[10px] tracking-widest border-b border-slate-50">
                                                <tr>
                                                    <th className="px-6 py-3">File Version / Identifier</th>
                                                    <th className="px-6 py-3">Archived Date</th>
                                                    <th className="px-6 py-3">Size</th>
                                                    <th className="px-6 py-3 text-right pr-8">Extraction</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {files.map((file) => (
                                                    <tr key={file.filename} className="hover:bg-cyan-50/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-mono text-slate-600 truncate max-w-[400px]" title={file.filename}>
                                                                    {file.filename}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono mt-0.5 opacity-60">ID: {file.clinic_id}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                            {format(new Date(file.created_at), 'MMM d, yyyy · HH:mm')}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                        </td>
                                                        <td className="px-6 py-4 text-right pr-6">
                                                            <button
                                                                onClick={() => handleDownload(file.filename)}
                                                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0"
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
                            </div>
                        ))
                    )}
                </div>
            )}

            {!loading && filteredArchives.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex justify-between items-center">
                    <span>Active Clusters: {groupedArchives.length}</span>
                    <span>Inventory Count: {filteredArchives.length} files</span>
                </div>
            )}
        </div>
    );
};

// Help helper for icons within the component
const Database = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

export default ArchiveBrowser;
