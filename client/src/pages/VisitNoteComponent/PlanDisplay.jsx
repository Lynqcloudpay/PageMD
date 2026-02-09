import React from 'react';

const PlanDisplay = ({ plan }) => {
    if (!plan) return null;
    const lines = plan.split('\n');
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            formattedLines.push(<br key={i} />);
            continue;
        }

        // Match diagnosis headers like **__Diagnosis Name__**
        if (line.startsWith('**__') && line.endsWith('__**')) {
            const diagnosis = line.replace(/^\*\*__/, '').replace(/__\*\*$/, '');
            formattedLines.push(
                <div key={i} className="text-xs font-bold text-slate-800 border-l-2 border-blue-400/50 pl-3 py-1 mb-3 mt-5 first:mt-0 uppercase tracking-tight">
                    {diagnosis}
                </div>
            );
        } else if (line.startsWith('  - ') || line.startsWith('  • ') || line.startsWith('• ')) {
            const orderText = line.replace(/^(  - |  • |• )/, '');
            formattedLines.push(
                <div key={i} className="ml-5 text-sm text-slate-600 mb-2 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{orderText}</span>
                </div>
            );
        } else {
            formattedLines.push(
                <div key={i} className="text-sm text-slate-600 mb-2 leading-relaxed">
                    {line}
                </div>
            );
        }
    }

    return (
        <div className="whitespace-pre-wrap vn-soft-ui bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
            {formattedLines}
        </div>
    );
};

export default PlanDisplay;
