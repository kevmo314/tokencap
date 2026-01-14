/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Match the landing page color scheme
        bg: {
          DEFAULT: '#0a0a0b',
          secondary: '#111113',
          tertiary: '#18181b',
        },
        accent: {
          DEFAULT: '#10b981',
          hover: '#059669',
        },
        border: '#27272a',
        'code-bg': '#1a1a1d',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
