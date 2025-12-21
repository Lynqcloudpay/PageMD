import React, { useState, useEffect } from 'react';
import { codesAPI, medicationsAPI } from '../services/api';

const ProblemInput = ({ onSave, onCancel }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [onsetDate, setOnsetDate] = useState('');
    const [status, setStatus] = useState('active');

    useEffect(() => {
        if (!query || selected) {
            setResults([]);
            return;
        }
        const search = async () => {
            if (query.length < 2) return;
            setLoading(true);
            try {
                const res = await codesAPI.searchICD10(query);
                setResults(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        const timeout = setTimeout(search, 500);
        return () => clearTimeout(timeout);
    }, [query, selected]);

    const handleSelect = (item) => {
        setSelected(item);
        setQuery(item.description);
        setResults([]);
    };

    const handleSave = () => {
        if (!query) return;
        onSave({
            problemName: selected ? selected.description : query,
            icd10Code: selected ? selected.code : null,
            onsetDate: onsetDate || new Date().toISOString(),
            status
        });
    };

    return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSelected(null);
                    }}
                    placeholder="Search problem (ICD-10) or type name..."
                    className="w-full text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 p-1.5"
                    autoFocus
                />
                {loading && <div className="absolute right-2 top-2 text-xs text-gray-400">Loading...</div>}
                {results.length > 0 && !selected && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto z-10">
                        {results.map((r, i) => (
                            <button
                                key={r.code || i}
                                onClick={() => handleSelect(r)}
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 text-xs"
                            >
                                <span className="font-semibold">{r.code}</span> - {r.description}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="date"
                    value={onsetDate}
                    onChange={(e) => setOnsetDate(e.target.value)}
                    className="text-xs border-gray-300 rounded p-1.5 flex-1"
                />
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="text-xs border-gray-300 rounded p-1.5 w-24"
                >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                </select>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
                <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button onClick={handleSave} disabled={!query} className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:opacity-50">Save</button>
            </div>
        </div>
    );
};

const MedicationInput = ({ onSave, onCancel }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [details, setDetails] = useState({ dosage: '', frequency: '', route: '' });

    useEffect(() => {
        if (!query || selected) {
            setResults([]);
            return;
        }
        const search = async () => {
            if (query.length < 2) return;
            setLoading(true);
            try {
                const res = await medicationsAPI.search(query);
                setResults(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        const timeout = setTimeout(search, 500);
        return () => clearTimeout(timeout);
    }, [query, selected]);

    const handleSelect = (item) => {
        setSelected(item);
        // Uses synonym or name or conceptName based on RxNorm response
        setQuery(item.synonym || item.name || item.conceptName);
        setResults([]);
    };

    const handleSave = () => {
        if (!query) return;
        onSave({
            medicationName: query,
            ...details,
            startDate: new Date().toISOString(),
            active: true
        });
    };

    return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSelected(null);
                    }}
                    placeholder="Search medication..."
                    className="w-full text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 p-1.5"
                    autoFocus
                />
                {loading && <div className="absolute right-2 top-2 text-xs text-gray-400">Loading...</div>}

                {results.length > 0 && !selected && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto z-10">
                        {results.map((r, i) => (
                            <button
                                key={r.rxcui || i}
                                onClick={() => handleSelect(r)}
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 text-xs truncate"
                            >
                                {r.synonym || r.name || r.conceptName}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2">
                <input
                    type="text"
                    placeholder="Dosage (e.g. 10mg)"
                    value={details.dosage}
                    onChange={(e) => setDetails({ ...details, dosage: e.target.value })}
                    className="text-xs border-gray-300 rounded p-1.5"
                />
                <input
                    type="text"
                    placeholder="Freq (e.g. daily)"
                    value={details.frequency}
                    onChange={(e) => setDetails({ ...details, frequency: e.target.value })}
                    className="text-xs border-gray-300 rounded p-1.5"
                />
                <input
                    type="text"
                    placeholder="Route (e.g. PO)"
                    value={details.route}
                    onChange={(e) => setDetails({ ...details, route: e.target.value })}
                    className="text-xs border-gray-300 rounded p-1.5"
                />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
                <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button onClick={handleSave} disabled={!query} className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:opacity-50">Save</button>
            </div>
        </div>
    );
};

const AllergyInput = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState({ allergen: '', reaction: '', severity: 'unknown' });

    const handleSave = () => {
        if (!formData.allergen) return;
        onSave(formData);
    };

    return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
            <input
                type="text"
                value={formData.allergen}
                onChange={(e) => setFormData({ ...formData, allergen: e.target.value })}
                placeholder="Allergen (e.g. Penicillin)..."
                className="w-full text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 p-1.5"
                autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="text"
                    placeholder="Reaction (e.g. Hives)"
                    value={formData.reaction}
                    onChange={(e) => setFormData({ ...formData, reaction: e.target.value })}
                    className="text-xs border-gray-300 rounded p-1.5"
                />
                <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="text-xs border-gray-300 rounded p-1.5"
                >
                    <option value="unknown">Unknown</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                </select>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
                <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button onClick={handleSave} disabled={!formData.allergen} className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:opacity-50">Save</button>
            </div>
        </div>
    );
};

const FamilyHistoryInput = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState({ condition: '', relationship: '', notes: '' });

    const handleSave = () => {
        if (!formData.condition) return;
        onSave(formData);
    };

    return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="text"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="Condition (e.g. Diabetes)..."
                    className="text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 p-1.5"
                    autoFocus
                />
                <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    placeholder="Relationship (e.g. Mother)..."
                    className="text-sm border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 p-1.5"
                />
            </div>
            <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full text-xs border-gray-300 rounded p-1.5"
                rows="2"
            />
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
                <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button onClick={handleSave} disabled={!formData.condition} className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:opacity-50">Save</button>
            </div>
        </div>
    );
};

export { ProblemInput, MedicationInput, AllergyInput, FamilyHistoryInput };
