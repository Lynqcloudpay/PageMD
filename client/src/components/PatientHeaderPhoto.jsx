import React from 'react';
import tokenManager from '../services/tokenManager';

const PatientHeaderPhoto = ({ firstName, lastName, photoUrl, className = "w-24 h-24 text-3xl", onClick }) => {
    // Generate initials
    const initials = `${firstName?.[0] || '?'}${lastName?.[0] || '?'}`.toUpperCase();

    // Append token for authenticated image loading if it's an internal API URL
    const authenticatedPhotoUrl = photoUrl && photoUrl.startsWith('/api/')
        ? `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}token=${tokenManager.getToken()}`
        : photoUrl;

    // Choose a stable background color based on name hash (optional, using blue for now consistently)
    const bgColor = "bg-blue-50";
    const textColor = "text-blue-600";

    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-200 ${bgColor} ${textColor} ${className} ${onClick ? 'cursor-pointer hover:ring-blue-400 hover:shadow-md transition-all' : ''}`}
            onClick={onClick}
        >
            {authenticatedPhotoUrl ? (
                <img
                    src={authenticatedPhotoUrl}
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
