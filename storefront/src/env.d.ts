/// <reference types="astro/client" />

/** Identificadores de pestaña para los canales de sincronización. */
interface Window {
  __dspWishlistTab?: string;
  __dspCartTab?: string;
}

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
  readonly STRIPE_SECRET_KEY_LIVE?: string;
  readonly STRIPE_SECRET_KEY_TEST?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly STRIPE_WEBHOOK_SECRET_LIVE?: string;
  readonly STRIPE_WEBHOOK_SECRET_TEST?: string;

  // FedEx — Rates and Transit Times API + Ship API (solo servidor). Sin estas
  // variables el checkout usa la tarifa plana de `store_settings`.
  readonly FEDEX_CLIENT_ID?: string;
  readonly FEDEX_CLIENT_SECRET?: string;
  readonly FEDEX_ACCOUNT_NUMBER?: string;
  readonly FEDEX_BASE_URL?: string;
  readonly FEDEX_ORIGIN_ZIP?: string;
  readonly FEDEX_ORIGIN_CITY?: string;
  readonly FEDEX_ORIGIN_STATE?: string;
  readonly FEDEX_ORIGIN_COUNTRY?: string;
  readonly FEDEX_ORIGIN_COMPANY?: string;
  readonly FEDEX_ORIGIN_ADDRESS?: string;
  readonly FEDEX_ORIGIN_PHONE?: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE?: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST?: string;

  /** `live` | `test`: elige la ranura de llaves de Stripe. Por defecto se deduce de la llave. */
  readonly PUBLIC_STRIPE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
    isAuthenticated: boolean;
    firstName: string | null;
    /** Nombre completo de la cuenta (o el de pila si no hay). */
    fullName: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    isStaff: boolean;
    /** Idioma de la tienda (cookie `dsp_lang` o Accept-Language). */
    lang: import('./lib/i18n').Lang;
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
