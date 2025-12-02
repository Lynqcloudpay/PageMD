import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />
    };

    return (
        <div className="fixed bottom-4 right-4 bg-white border border-paper-200 shadow-lg rounded-md p-4 flex items-center space-x-3 animate-in slide-in-from-bottom-5 duration-300 z-50">
            {icons[type]}
            <span className="text-ink-800 font-medium">{message}</span>
        </div>
    );
};

export default Toast;
