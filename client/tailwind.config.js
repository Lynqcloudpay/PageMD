/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Primary Colors - PageMD EMR Global Palette
                'graphite-black': '#111827',
                'deep-gray': '#1F2937',

                // Accent Colors
                'strong-azure': '#3B82F6',
                'fresh-green': '#22C55E',

                // Neutrals
                'soft-gray': '#F3F4F6',
                'white': '#FFFFFF',

                // Semantic aliases for compatibility - NOW AZURE for consistent button colors
                primary: {
                    DEFAULT: '#3B82F6',  // strong-azure
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    300: '#93C5FD',
                    400: '#60A5FA',
                    500: '#3B82F6',  // strong-azure
                    600: '#3B82F6',  // strong-azure (main button color)
                    700: '#2563EB',  // darker azure (hover)
                    800: '#1D4ED8',  // even darker azure
                    900: '#1E40AF',  // darkest azure
                },
                accent: {
                    DEFAULT: '#3B82F6',  // strong-azure
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    300: '#93C5FD',
                    400: '#60A5FA',
                    500: '#3B82F6',  // strong-azure
                    600: '#2563EB',
                    700: '#1D4ED8',
                    800: '#1E40AF',
                    900: '#1E3A8A',
                },
                success: {
                    DEFAULT: '#22C55E',  // fresh-green
                    50: '#F0FDF4',
                    100: '#DCFCE7',
                    200: '#BBF7D0',
                    300: '#86EFAC',
                    400: '#4ADE80',
                    500: '#22C55E',  // fresh-green
                    600: '#16A34A',
                    700: '#15803D',
                    800: '#166534',
                    900: '#14532D',
                },
                neutral: {
                    DEFAULT: '#F3F4F6',  // soft-gray
                    50: '#FFFFFF',  // white
                    100: '#F3F4F6',  // soft-gray
                    200: '#E5E7EB',
                    300: '#D1D5DB',
                    400: '#9CA3AF',
                    500: '#6B7280',
                    600: '#4B5563',
                    700: '#1F2937',  // deep-gray
                    800: '#111827',  // graphite-black
                    900: '#111827',  // graphite-black
                },
                // Clinical Status Colors (safe + subtle)
                success: {
                    50: '#F0FDF4',
                    100: '#DCFCE7',
                    200: '#BBF7D0',
                    300: '#86EFAC',
                    400: '#4ADE80',
                    500: '#16A34A',  // Safe Green (Normal) - Clinical
                    600: '#15803D',
                    700: '#166534',
                    800: '#14532D',
                    900: '#14532D',
                },
                // Warning/Alert Amber (Caution - Clinical)
                warning: {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    200: '#FDE68A',
                    300: '#FCD34D',
                    400: '#FBBF24',
                    500: '#F59E0B',  // Amber (Caution) - Clinical
                    600: '#D97706',
                    700: '#B45309',
                    800: '#92400E',
                    900: '#78350F',
                },
                // Error/Critical Red (Abnormal - Clinical)
                error: {
                    50: '#FEF2F2',
                    100: '#FEE2E2',
                    200: '#FECACA',
                    300: '#FCA5A5',
                    400: '#F87171',
                    500: '#DC2626',  // Clinical Red (Abnormal) - muted for medical use
                    600: '#B91C1C',
                    700: '#991B1B',
                    800: '#7F1D1D',
                    900: '#7F1D1D',
                },
                // Neutral Grays (monochrome palette)
                neutral: {
                    50: '#FFFFFF',   // White
                    100: '#F3F4F6',  // Soft Gray
                    200: '#E5E7EB',  // Light gray
                    300: '#D1D5DB',  // Medium light gray
                    400: '#9CA3AF',  // Medium gray
                    500: '#6B7280',  // Base gray
                    600: '#4B5563',  // Dark gray
                    700: '#374151',  // Very dark gray
                    800: '#1F2937',  // Deep Gray
                    900: '#111827',  // Graphite Black
                }
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                display: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            fontSize: {
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            borderRadius: {
                'xl': '0.75rem',
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
                'medium': '0 4px 16px rgba(0, 0, 0, 0.08)',
                'large': '0 8px 32px rgba(0, 0, 0, 0.12)',
                'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
            },
            animation: {
                'fade-in': 'fadeIn 0.2s ease-in-out',
                'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
                'float-slow': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 6s ease-in-out 3s infinite',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
