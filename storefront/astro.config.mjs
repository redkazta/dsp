// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

// Todo es SSR: el middleware resuelve la sesión (header, /admin, /cuenta)
// y las páginas pueden renderizar el estado de autenticación en el primer HTML.
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind()],
  site: 'https://dinerosobreproblemas.com',
  image: {
    domains: ['dzrxwmyxxhjonhbfgfvo.supabase.co'],
  },
});
