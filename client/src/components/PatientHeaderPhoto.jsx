import React from 'react';

const PatientHeaderPhoto = ({ firstName, lastName, photoUrl, className = "w-16 h-16 text-xl", onClick }) => {
    // Generate initials
    const initials = `${firstName?.[0] || '?'}${lastName?.[0] || '?'}`.toUpperCase();

    // Choose a stable background color based on name hash (optional, using blue for now consistently)
    const bgColor = "bg-blue-100";
    const textColor = "text-blue-600";

    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold overflow-hidden border-2 border-white ring-2 ring-gray-100 ${bgColor} ${textColor} ${className} ${onClick ? 'cursor-pointer hover:ring-blue-200' : ''}`}
            onClick={onClick}
        >
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt={`${firstName} ${lastName}`}
                    className="w-full h-full object-cover"
                />
            ) : (
                <span>{initials}</span>
            )}
        </div>
    );
};

export default PatientHeaderPhoto;
