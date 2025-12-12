import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  iconPosition = 'left',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active-scale';
  
  const variants = {
    primary: 'text-white shadow-sm hover:shadow-md focus:ring-strong-azure',
    secondary: 'bg-soft-gray text-deep-gray hover:bg-deep-gray hover:text-white focus:ring-strong-azure border border-deep-gray/20',
    success: 'bg-fresh-green text-white hover:bg-fresh-green/90 focus:ring-fresh-green shadow-sm hover:shadow-md',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-md',
    ghost: 'bg-transparent text-deep-gray hover:bg-soft-gray focus:ring-strong-azure',
    outline: 'bg-transparent border-2 border-strong-azure text-strong-azure hover:bg-strong-azure/5 focus:ring-strong-azure',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };
  
  const getButtonStyle = () => {
    if (variant === 'primary') {
      return {
        background: 'linear-gradient(to right, #3B82F6, #2563EB)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      };
    }
    return {};
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      style={getButtonStyle()}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="w-4 h-4 mr-2" />
      )}
      {children}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="w-4 h-4 ml-2" />
      )}
    </button>
  );
};

export default Button;










