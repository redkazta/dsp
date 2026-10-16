/**
 * Astro Configuration for WildForgeLabs Storefront
 * Tailwind CSS con paleta de colores: Negro, Oro, Plateado
 */

import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  integrations: [],
  vitePlugins: [tailwind()],
  // Configuración SEO automática
  experimental: {
    islandMerge: true
  }
});