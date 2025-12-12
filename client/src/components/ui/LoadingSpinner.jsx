import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ size = 'md', className = '', text }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className={`${sizes[size]} animate-spin text-primary-600 dark:text-primary-400`} />
      {text && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;






























