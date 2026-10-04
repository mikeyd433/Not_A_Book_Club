/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Per-book accent color is set as a CSS custom property (see
    // src/lib/accent.ts) computed from the book's displayed cover.
    // Components read `accent`/`accent-contrast`, never a hardcoded literal.
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent, #7c3aed)',
        'accent-contrast': 'var(--color-accent-contrast, #ffffff)',
      },
      borderRadius: {
        card: '1rem',
      },
      // Just the header wordmark (Layout.tsx) -- everything else stays on
      // the system sans stack.
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
      },
    },
  },
  plugins: [],
}
