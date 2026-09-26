/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        accent: {
          50:  '#ecfeff',
          100: '#cffafe',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
      },
      boxShadow: {
        'xs':         '0 1px 2px 0 rgba(0,0,0,0.05)',
        'glass':      '0 4px 24px 0 rgba(30, 64, 175, 0.07)',
        'glass-lg':   '0 8px 40px 0 rgba(30, 64, 175, 0.12)',
        'card':       '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px -4px rgba(37,99,235,0.13), 0 4px 8px -4px rgba(37,99,235,0.07)',
        'inner-brand':'inset 0 1px 0 0 rgba(255,255,255,0.08)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft':     'pulseSoft 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' },                                   to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(12px)' },    to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown:    { from: { opacity: '0', transform: 'translateY(-8px)' },    to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.96)' },         to: { opacity: '1', transform: 'scale(1)' } },
        pulseSoft:    { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(100%)' },    to: { opacity: '1', transform: 'translateX(0)' } },
      },
      backgroundImage: {
        'gradient-brand':   'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #3b82f6 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
        'gradient-card':    'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)',
        'gradient-kpi-blue':'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
        'gradient-kpi-green':'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        'gradient-kpi-amber':'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        'gradient-kpi-purple':'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
      },
    },
  },
  plugins: [],
}
