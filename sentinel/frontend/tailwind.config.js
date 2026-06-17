/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Fraunces', 'Georgia', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        sm: '10px',
        lg: '20px',
        hero: '28px',
      },
      colors: {
        bg: {
          base: 'var(--color-bg-base)',
          card: 'var(--color-bg-card)',
          surface: 'var(--color-bg-surface)',
          overlay: 'var(--color-bg-overlay)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        success: '#0f9d58',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
      },
      transitionTimingFunction: {
        slow: 'cubic-bezier(0.4,0,0.2,1)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
      },
      width: {
        sidebar: '272px',
        'sidebar-collapsed': '84px',
      },
      height: {
        header: '76px',
      },
    },
  },
  plugins: [],
}
