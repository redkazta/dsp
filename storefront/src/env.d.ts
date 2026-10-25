/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_GOOGLE_CLIENT_ID: string;
  readonly PUBLIC_API_URL?: string;

  // Solo servidor (Vercel → Settings → Environment Variables con "Sensitive")
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly INTERNAL_API_TOKEN?: string;

  // Stripe (Checkout alojado): el secreto solo lo lee el servidor.
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  readonly PUBLIC_STRIPE_TEST_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
    isAuthenticated: boolean;
    firstName: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    isStaff: boolean;
  }
}

/**
 * `node:crypto` sin `@types/node`.
 * Declaración mínima: solo la usa la verificación de firma del webhook de Stripe.
 */
declare module 'node:crypto' {
  interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'hex'): string;
  }

  export function createHmac(algorithm: string, key: string): Hmac;
}
