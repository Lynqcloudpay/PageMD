import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi } from '../api/client';
import { Button } from '../components/Button';
import { cn, getInitials, formatAge } from '../utils/helpers';
import { Search, User, ChevronRight, UserPlus } from 'lucide-react';

export function PatientsPage() {
    const [query, setQuery] = useState('');
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const response = await patientsApi.search(query);
            setPatients(response.data || []);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
                    <Button variant="primary">
                        <UserPlus className="w-5 h-5" />
                        Add Patient
                    </Button>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, MRN, or DOB..."
                            className="w-full pl-12 pr-4 py-4 text-base rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        />
                    </div>
                    <Button type="submit" loading={loading} size="lg">
                        Search
                    </Button>
                </form>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-6">
                {patients.length > 0 ? (
                    <div className="grid gap-3 max-w-4xl mx-auto">
                        {patients.map(patient => (
                            <button
                                key={patient.id}
                                onClick={() => navigate(`/patient/${patient.id}`)}
                                className="w-full flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 hover:border-primary-300 hover:shadow-soft transition-all text-left"
                            >
                                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                                    {getInitials(patient.first_name, patient.last_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 text-lg">
                                        {patient.last_name}, {patient.first_name}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                        <span>{formatAge(patient.date_of_birth)}</span>
                                        <span>•</span>
                                        <span>{patient.sex}</span>
                                        <span>•</span>
                                        <span className="font-mono">MRN: {patient.mrn || 'N/A'}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-6 h-6 text-slate-300" />
                            </button>
                        ))}
                    </div>
                ) : query && !loading ? (
                    <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                        <User className="w-12 h-12 mb-3" />
                        <p>No patients found</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                        <Search className="w-12 h-12 mb-3" />
                        <p>Search for a patient to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
}
