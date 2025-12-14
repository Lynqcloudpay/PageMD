import React from 'react';
import { FileText } from 'lucide-react';

const MacFolder = ({ note, isExpanded, onToggle, onClick }) => {
    return (
        <div
            className="group relative cursor-pointer"
            onClick={onClick}
        >
            {/* Mac-style folder icon */}
            <div className="flex flex-col items-center space-y-2 p-3 hover:bg-neutral-100 rounded-lg transition-colors">
                {/* Folder icon - Mac style */}
                <div className="relative">
                    {/* Folder body */}
                    <div className="w-16 h-14 bg-gradient-to-br from-blue-400 to-blue-500 rounded-t-lg rounded-br-lg shadow-md relative overflow-hidden">
                        {/* Folder tab */}
                        <div className="absolute top-0 left-0 w-8 h-4 bg-gradient-to-br from-blue-300 to-blue-400 rounded-tl-lg rounded-tr-sm"></div>
                        {/* Folder highlight */}
                        <div className="absolute top-1 left-1 w-6 h-3 bg-blue-200/30 rounded-sm"></div>
                        {/* Document icon inside */}
                        <div className="absolute bottom-2 right-2 w-6 h-8 bg-white/90 rounded-sm shadow-sm flex items-center justify-center">
                            <FileText className="w-3 h-3 text-blue-600" />
                        </div>
                    </div>
                    {/* Status badge */}
                    {note.signed ? (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    ) : (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                    )}
                </div>
                
                {/* Folder label */}
                <div className="text-center max-w-[80px]">
                    <p className="text-xs font-medium text-neutral-700 truncate" title={note.type}>
                        {note.type}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{note.date}</p>
                </div>
            </div>
            
            {/* Expanded content overlay */}
            {isExpanded && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 p-4 z-50">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-neutral-900">{note.type}</h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle();
                                }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-xs text-neutral-600 space-y-1">
                            <p><span className="font-medium">Date:</span> {note.date}</p>
                            <p><span className="font-medium">Provider:</span> {note.provider}</p>
                            {note.summary && (
                                <div className="mt-2 pt-2 border-t border-neutral-200">
                                    <p className="font-medium mb-1">Summary:</p>
                                    <p className="text-neutral-700">{note.summary}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                            className={`w-full mt-3 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                note.signed 
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            }`}
                        >
                            {note.signed ? 'View Chart' : 'Edit Note'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MacFolder;












