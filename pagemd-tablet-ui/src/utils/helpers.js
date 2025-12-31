import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function formatDate(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);

    if (format === 'short') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (format === 'time') {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (format === 'full') {
        return d.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
    }
    return d.toISOString();
}

export function formatAge(dob) {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return `${age}yo`;
}

export function getInitials(firstName, lastName) {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function getStatusColor(status) {
    const colors = {
        scheduled: 'bg-slate-100 text-slate-600',
        arrived: 'bg-blue-100 text-blue-700',
        roomed: 'bg-purple-100 text-purple-700',
        'in-progress': 'bg-amber-100 text-amber-700',
        ready: 'bg-green-100 text-green-700',
        completed: 'bg-green-500 text-white',
        cancelled: 'bg-red-100 text-red-600',
    };
    return colors[status?.toLowerCase()] || colors.scheduled;
}
