module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: '100%',
            a: { textDecoration: 'underline', textUnderlineOffset: '2px' },
            code: {
              backgroundColor: theme('colors.gray.100'),
              padding: '0.125rem 0.375rem',
              borderRadius: theme('borderRadius.lg'),
              fontWeight: '500',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: 0,
              borderRadius: 0,
            },
            ul: { marginTop: '0.5rem', marginBottom: '0.5rem' },
            ol: { marginTop: '0.5rem', marginBottom: '0.5rem' },
            li: { marginTop: '0.125rem', marginBottom: '0.125rem' },
          },
        },
        invert: {
          css: {
            code: {
              backgroundColor: theme('colors.gray.800'),
              color: theme('colors.gray.100'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}