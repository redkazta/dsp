/**
 * Tailwind Configuration - Dinero Sobre Problemas
 * Negro profundo · Oro brillante · Blanco de alto contraste
 * Regla: sobre fondo oscuro siempre texto claro (nunca gris apagado).
 */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        negro: {
          profundo: '#060606',
          carbono: '#0E0E0E',
          elevado: '#161616',
        },
        oro: {
          elegante: '#F2C94C', // oro más brillante
          suave: '#FFDA6B',
          oscuro: '#C9A227',
        },
        // Alias heredados: usan currentColor para que NUNCA se vean grises.
        // Sobre fondo oscuro heredan el blanco y se regulan con opacidad.
        plata: {
          metalico: 'inherit',
          claro: 'inherit',
          oscuro: 'inherit',
        },
        blancoRoto: '#FFFFFF',
      },
      fontFamily: {
        titulos: ['"Playfair Display"', 'Georgia', 'serif'],
        cuerpo: ['Inter', 'system-ui', 'sans-serif'],
        acentos: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      fontSize: {
        // Escala ligeramente más generosa
        xs: ['0.875rem', { lineHeight: '1.5' }],
        sm: ['0.9375rem', { lineHeight: '1.6' }],
        base: ['1.0625rem', { lineHeight: '1.7' }],
        lg: ['1.1875rem', { lineHeight: '1.7' }],
        xl: ['1.3125rem', { lineHeight: '1.6' }],
      },
      borderWidth: {
        DEFAULT: '1px',
        // líneas más gruesas
        2: '2px',
        3: '3px',
      },
      letterSpacing: {
        mega: '0.35em',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out both',
        'fade-in': 'fadeIn 1.2s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      transitionDuration: {
        400: '400ms',
      },
    },
  },
  plugins: [],
};
