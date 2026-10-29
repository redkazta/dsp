import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';

// SSR en todo el sitio: el middleware resuelve la sesión (header, /admin,
// /cuenta) y cada página puede renderizar su estado inicial sin parpadeos.

// Dominio canónico: el que Google debe indexar. Los demás (apex, *.vercel.app)
// son espejos y en Vercel se redirigen a este. Cambiar el dominio = cambiar
// SITE_URL en Vercel, sin tocar código.
const SITE_URL = process.env.SITE_URL || 'https://www.dinerosobreproblemas.com';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind()],
  site: SITE_URL,
  image: {
    domains: ['dzrxwmyxxhjonhbfgfvo.supabase.co'],
  },
});
