import React from 'react';
import { ShieldAlert, X, Info, Zap } from 'lucide-react';

const DemoBanner = () => {
    return (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] animate-gradient-x text-white py-2 px-4 relative z-[9999] shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-xs md:text-sm font-bold tracking-tight">
                <div className="flex items-center gap-2 px-2 py-0.5 bg-white/20 rounded-full border border-white/30 backdrop-blur-md">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>DEMO MODE</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-x-2 gap-y-1">
                    <span className="opacity-90">All changes are temporary and isolated to this session.</span>
                    <div className="hidden md:block w-1 h-1 bg-white/30 rounded-full"></div>
                    <div className="flex items-center gap-1.5 text-blue-100 italic">
                        <Info className="w-3.5 h-3.5" />
                        <span>External integrations (Rx, Labs, Fax) are simulated.</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    animation: gradient-x 15s ease infinite;
                }
            `}} />
        </div>
    );
};

export default DemoBanner;
