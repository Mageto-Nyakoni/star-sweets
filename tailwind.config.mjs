import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ss-pink':    '#F5BFD0',
        'ss-pink-dk': '#E899B4',
        'ss-pink-lt': '#FDE8EF',
        'ss-maroon':  '#8C1A1A',
        'ss-red':     '#C4536A',
        'ss-cherry':  '#3A1520',
        'ss-berry':   '#6B2535',
        'ss-mist':    '#9B7B85',
        'ss-cream':   '#FAF5EE',
        'ss-blush':   '#F5EAE8',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        'star-sweets': {
          'primary':           '#F5BFD0',
          'primary-focus':     '#E899B4',
          'primary-content':   '#3A1520',
          'secondary':         '#8C1A1A',
          'secondary-focus':   '#6B2535',
          'secondary-content': '#FAF5EE',
          'accent':            '#C4536A',
          'accent-focus':      '#A33A55',
          'accent-content':    '#FAF5EE',
          'neutral':           '#3A1520',
          'neutral-focus':     '#2A0F16',
          'neutral-content':   '#FAF5EE',
          'base-100':          '#FAF5EE',
          'base-200':          '#F0E8E0',
          'base-300':          '#E5D8CC',
          'base-content':      '#3A1520',
          '--rounded-btn':     '9999px',
          '--rounded-box':     '0.5rem',
          '--rounded-badge':   '9999px',
          '--animation-btn':   '0.18s',
        },
      },
    ],
    darkTheme: false,
    base:      true,
    styled:    true,
    utils:     true,
  },
};
