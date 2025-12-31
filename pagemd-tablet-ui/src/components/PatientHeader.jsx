import { cn, getInitials, formatAge, getStatusColor } from '../utils/helpers';
import { AlertTriangle, Phone, User } from 'lucide-react';

export function PatientHeader({ patient, visit, className }) {
    if (!patient) return null;

    const allergies = patient.allergies || [];
    const hasAllergies = allergies.length > 0;

    return (
        <div className={cn(
            'bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10',
            className
        )}>
            <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                    {getInitials(patient.first_name, patient.last_name)}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-xl font-bold text-slate-900 truncate">
                            {patient.last_name}, {patient.first_name}
                        </h1>
                        {visit?.status && (
                            <span className={cn(
                                'px-2.5 py-1 rounded-full text-xs font-bold uppercase',
                                getStatusColor(visit.status)
                            )}>
                                {visit.status}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="font-medium">{formatAge(patient.date_of_birth)}</span>
                        <span>•</span>
                        <span>{patient.sex || 'Unknown'}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-600">MRN: {patient.mrn || 'N/A'}</span>
                    </div>
                </div>

                {/* Allergies Alert */}
                <div className={cn(
                    'px-4 py-2 rounded-lg flex items-center gap-2 shrink-0',
                    hasAllergies ? 'bg-error-50 border border-error-200' : 'bg-slate-50 border border-slate-200'
                )}>
                    <AlertTriangle className={cn('w-5 h-5', hasAllergies ? 'text-error-500' : 'text-slate-400')} />
                    <div>
                        <div className={cn('text-xs font-semibold uppercase', hasAllergies ? 'text-error-600' : 'text-slate-500')}>
                            Allergies
                        </div>
                        <div className={cn('text-sm font-medium', hasAllergies ? 'text-error-700' : 'text-slate-600')}>
                            {hasAllergies ? allergies.slice(0, 3).join(', ') : 'NKDA'}
                        </div>
                    </div>
                </div>

                {/* Contact Quick Actions */}
                <button className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <Phone className="w-5 h-5 text-slate-600" />
                </button>
            </div>
        </div>
    );
}
