/**
 * Tailwind Configuration - Dinero Sobre Problemas
 * Paleta: Negro (#0A0A0A), Oro (#D4AF37), Plateado (#C0C0C0)
 */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        negro: {
          profundo: '#0A0A0A',
          carbono: '#121212',
          elevado: '#1A1A1A',
        },
        oro: {
          elegante: '#D4AF37',
          suave: '#E8C874',
          oscuro: '#A88A28',
        },
        plata: {
          metalico: '#C0C0C0',
          claro: '#E5E5E5',
          oscuro: '#8A8A8A',
        },
        blancoRoto: '#F5F5F5',
      },
      fontFamily: {
        titulos: ['"Playfair Display"', 'Georgia', 'serif'],
        cuerpo: ['Inter', 'system-ui', 'sans-serif'],
        acentos: ['"Space Grotesk"', 'Inter', 'sans-serif'],
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
