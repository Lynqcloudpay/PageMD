import { cn } from '../utils/helpers';

export function Card({ children, className, onClick, ...props }) {
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                'bg-white rounded-xl border border-slate-200 shadow-soft',
                onClick && 'cursor-pointer hover:shadow-medium hover:border-slate-300 transition-all active:scale-[0.99]',
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
}

export function CardHeader({ children, className }) {
    return (
        <div className={cn('px-5 py-4 border-b border-slate-100', className)}>
            {children}
        </div>
    );
}

export function CardContent({ children, className }) {
    return (
        <div className={cn('px-5 py-4', className)}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className }) {
    return (
        <div className={cn('px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl', className)}>
            {children}
        </div>
    );
}
