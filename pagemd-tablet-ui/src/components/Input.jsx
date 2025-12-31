import { forwardRef } from 'react';
import { cn } from '../utils/helpers';

export const Input = forwardRef(({
    label,
    error,
    className,
    containerClassName,
    ...props
}, ref) => {
    return (
        <div className={cn('flex flex-col gap-1.5', containerClassName)}>
            {label && (
                <label className="text-sm font-medium text-slate-700">
                    {label}
                </label>
            )}
            <input
                ref={ref}
                className={cn(
                    'w-full px-4 py-3 min-h-[44px] text-base rounded-lg border transition-all duration-150',
                    'bg-white border-slate-200',
                    'placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
                    error && 'border-error-500 focus:ring-error-500',
                    className
                )}
                {...props}
            />
            {error && (
                <span className="text-sm text-error-500">{error}</span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export const TextArea = forwardRef(({
    label,
    error,
    className,
    containerClassName,
    rows = 4,
    ...props
}, ref) => {
    return (
        <div className={cn('flex flex-col gap-1.5', containerClassName)}>
            {label && (
                <label className="text-sm font-medium text-slate-700">
                    {label}
                </label>
            )}
            <textarea
                ref={ref}
                rows={rows}
                className={cn(
                    'w-full px-4 py-3 text-base rounded-lg border transition-all duration-150 resize-none',
                    'bg-white border-slate-200',
                    'placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    error && 'border-error-500 focus:ring-error-500',
                    className
                )}
                {...props}
            />
            {error && (
                <span className="text-sm text-error-500">{error}</span>
            )}
        </div>
    );
});

TextArea.displayName = 'TextArea';
