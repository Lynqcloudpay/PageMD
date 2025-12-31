import { forwardRef } from 'react';
import { cn } from '../utils/helpers';
import { Loader2 } from 'lucide-react';

const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-soft',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    outline: 'border-2 border-primary-500 text-primary-600 hover:bg-primary-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-error-500 hover:bg-error-600 text-white',
    success: 'bg-success-500 hover:bg-success-600 text-white',
};

const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[52px]',
    icon: 'p-2.5 min-h-[44px] min-w-[44px]',
};

export const Button = forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className,
    ...props
}, ref) => {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'active:scale-[0.98]',
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
});

Button.displayName = 'Button';
