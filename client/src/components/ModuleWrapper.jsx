import React from 'react';

const ModuleWrapper = ({ children, isEditMode, className = '' }) => {
    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${isEditMode ? 'ring-2 ring-blue-300' : ''} ${className}`}>
            {children}
        </div>
    );
};

export default ModuleWrapper;






















