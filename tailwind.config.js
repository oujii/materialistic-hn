/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        hn: {
          orange: '#FF6600',
          amber: '#FFB74D',
          'amber-light': '#FFE0B2',
          'amber-bg': '#FFF8E1',
          fire: '#FF9800',
          comment: '#F44336',
          'text-primary': 'rgba(0,0,0,0.87)',
          'text-secondary': 'rgba(0,0,0,0.54)',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
