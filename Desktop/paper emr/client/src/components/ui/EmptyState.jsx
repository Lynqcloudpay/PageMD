import React from 'react';

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  actionLabel,
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-4">
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="px-4 py-2 text-white rounded-lg transition-all duration-200 hover:shadow-md"
          style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563EB, #1D4ED8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3B82F6, #2563EB)'}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;










