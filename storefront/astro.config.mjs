// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  // SSR: páginas dinámicas (producto/[slug], carrito, checkout)
  // SSG: páginas estáticas (home, tienda)
  output: 'hybrid',
  adapter: vercel(),
  integrations: [tailwind()],
  site: 'https://dinerosobreproblemas.com',
  image: {
    domains: ['dzrxwmyxxhjonhbfgfvo.supabase.co'],
  },
});
