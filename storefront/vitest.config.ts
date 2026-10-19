import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // En el build de Astro los módulos compartidos leen import.meta.env;
    // en Vitest no existe, así que se neutraliza.
    'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify('http://localhost'),
    'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
