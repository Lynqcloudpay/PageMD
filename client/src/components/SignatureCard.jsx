import React from 'react';
import { format } from 'date-fns';
import { Shield, CheckCircle2, User, Clock, HardDrive, FileSignature } from 'lucide-react';

const SignatureCard = ({
    type = 'Author',
    signerName,
    date,
    role,
    isPreliminary = false,
    attestationText = '',
    authorshipModel = 'Addendum'
}) => {
    if (!signerName) return null;

    return (
        <div className={`mt-6 p-5 rounded-2xl border transition-all ${isPreliminary
                ? 'bg-amber-50/50 border-amber-200'
                : 'bg-green-50/30 border-green-200'
            }`}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${isPreliminary ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                            }`}>
                            <FileSignature className="w-4 h-4" />
                        </div>
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            {type === 'Cosigner' ? 'Attending Cosignature' : 'Electronic Signature'}
                        </h4>
                        {!isPreliminary && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-bold uppercase tracking-tighter">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Validated
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-gray-900 leading-none">{signerName}</span>
                            {role && <span className="text-xs font-semibold text-gray-500">({role})</span>}
                        </div>

                        <div className="flex items-center gap-3 text-gray-500">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-semibold">
                                    {date ? format(new Date(date), 'MMM d, yyyy @ h:mm a') : 'Pending'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                <span className="text-[10px] font-semibold uppercase tracking-tighter">Forensic ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    {attestationText && (
                        <div className="mt-4 p-3 bg-white/60 rounded-xl border border-gray-100 italic">
                            <p className="text-xs text-gray-700 leading-relaxed">
                                <span className="font-bold not-italic text-[10px] uppercase text-gray-400 block mb-1">Clinical Attestation:</span>
                                {attestationText}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <Shield className="w-4 h-4 text-primary-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary-600">Secure Vault Manifest</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureCard;
