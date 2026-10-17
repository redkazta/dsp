/**
 * Tailwind Configuration for WildForgeLabs
 * Paleta: Negro (#0A0A0A), Oro (#D4AF37), Plateado (#C0C0C0)
 */
export default {
  darkMode: "class",
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal
        negro: {
          profundo: "#0A0A0A",
          carbono: "#1A1A1A",
        },
        oro: {
          elegante: "#D4AF37",
          suave: "#E8C874",
        },
        plata: {
          metalico: "#C0C0C0",
          claro: "#E5E5E5",
        },
        blancoRoto: "#F5F5F5",
      },
      fontFamily: {
        titulos: ["Playfair Display", "Cormorant Garamond", "Bebas Neue", "serif"],
        cuerpo: ["Inter", "Satoshi", "Manrope", "sans-serif"],
        acentos: ["Space Grotesk", "Archivo", "sans-serif"],
      },
    },
  },
  plugins: [],
};