import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { Sparkles, Save, X, Lightbulb, BookOpen } from 'lucide-react';

const MdmModal = ({ isOpen, onClose, mdmText, diagnosis, onSave }) => {
    const [text, setText] = useState(mdmText || '');

    useEffect(() => {
        if (isOpen) {
            setText(mdmText || '');
        }
    }, [isOpen, mdmText]);

    const handleSave = () => {
        onSave(text);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Clinical Logic & MDM"
            size="lg"
            className="mdm-modal-override"
        >
            <div className="space-y-6">
                {/* Diagnosis Context Header */}
                <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                    <div className="p-2 bg-blue-100 rounded-xl">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">Target Diagnosis</span>
                        <h4 className="text-sm font-bold text-gray-800 leading-tight">
                            {diagnosis || 'General Health Management'}
                        </h4>
                    </div>
                </div>

                {/* MDM Editor */}
                <div className="relative group">
                    <div className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest z-10">
                        Medical Decision Making
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Detail your clinical reasoning, differential considerations, and order justifications here..."
                        className="w-full min-h-[350px] p-6 bg-gray-50/30 border border-gray-200 rounded-2xl text-[14px] text-gray-700 leading-relaxed outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all shadow-inner placeholder:text-gray-300 resize-none font-medium"
                        autoFocus
                    />

                    {/* Character/Token Hint */}
                    <div className="mt-2 flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                            <Lightbulb className="w-3 h-3" />
                            <span>Be concise. Focus on clinical rationale and risk assessment.</span>
                        </div>
                        <div className="text-[10px] font-mono text-gray-300">
                            {text.length} characters
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MdmModal;
