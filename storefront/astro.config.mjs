// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Con adapter de Vercel, las páginas con `prerender = true` (default)
  // se sirven estáticas; las que tienen `prerender = false` van a SSR.
  output: 'static',
  adapter: vercel(),
  integrations: [tailwind()],
  site: 'https://dinerosobreproblemas.com',
  image: {
    domains: ['dzrxwmyxxhjonhbfgfvo.supabase.co'],
  },
});
