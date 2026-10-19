import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';

// SSR en todo el sitio: el middleware resuelve la sesión (header, /admin,
// /cuenta) y cada página puede renderizar su estado inicial sin parpadeos.
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind()],
  site: 'https://dspstorefront.vercel.app',
  image: {
    domains: ['dzrxwmyxxhjonhbfgfvo.supabase.co'],
  },
});
