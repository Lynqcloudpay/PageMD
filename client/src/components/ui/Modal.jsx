import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md', className = '', preventOutsideClick = false, onBeforeClose }) => {
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setShowConfirm(false);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, preventOutsideClick, onBeforeClose]);

    const handleClose = () => {
        if (preventOutsideClick || onBeforeClose) {
            // Check if we should prevent closing
            if (onBeforeClose && typeof onBeforeClose === 'function') {
                const shouldClose = onBeforeClose();
                if (shouldClose === false) {
                    return;
                }
            }
            if (preventOutsideClick) {
                setShowConfirm(true);
                return;
            }
        }
        onClose();
    };

    const confirmClose = () => {
        setShowConfirm(false);
        onClose();
    };

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        '2xl': 'max-w-6xl',
        full: 'max-w-full mx-4',
    };

    return (
        <>
            {showConfirm && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 max-w-md">
                        <h3 className="text-lg font-semibold mb-2">Discard changes?</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            You have unsaved changes. Are you sure you want to close?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmClose}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div
                className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in"
                onClick={preventOutsideClick ? undefined : handleClose}
            >
                <div
                    className={`
                    bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full ${sizes[size]}
                    animate-scale-in max-h-[90vh] flex flex-col
                    ${className}
                `}
                    onClick={(e) => e.stopPropagation()}
                >
                    {title && (
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
                                {title}
                            </h3>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className={`${title ? 'p-6' : 'p-6'} overflow-y-auto flex-1 min-h-0`}>
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Modal;
