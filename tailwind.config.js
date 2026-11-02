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
        slate: {
          50: '#F3F4F6',
          100: '#E5E7EB',
          200: '#D1D5DB',
          300: '#9CA3AF',
          400: '#6B7280',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#030712',
        },
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#15803D',
          500: '#39FF14',
          600: '#15803D',
          700: '#166534',
          800: '#14532D',
          900: '#052E16',
          950: '#022C22',
        },
        emerald: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#15803D',
          500: '#15803D',
          600: '#166534',
          700: '#14532D',
          800: '#14532D',
          900: '#052E16',
          950: '#022C22',
        },
        dark: {
          bg: '#F3F4F6',
          card: '#FFFFFF',
          cardMuted: '#F9FAFB',
          border: '#E5E7EB',
          hover: '#E5E7EB'
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 25px -5px rgba(57, 255, 20, 0.25)',
      }
    },
  },
  plugins: [],
}
