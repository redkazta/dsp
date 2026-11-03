/**
 * GET /api/admin/stripe-status — ¿con qué llaves está cobrando el sitio?
 *
 * Solo staff. No devuelve secretos: únicamente prefijos y si cada variable
 * existe. Sirve para responder "¿por qué me manda a checkout de pruebas?"
 * sin bucear en los logs de Vercel.
 *
 * Revisa: https://www.dinerosobreproblemas.com/api/admin/stripe-status
 */
import type { APIRoute } from 'astro';
import { serverEnv } from '../../../lib/env';
import {
  stripeEnv,
  stripeMode,
  stripeSecretKey,
  stripePublishableKey,
  stripeWebhookSecret,
} from '../../../lib/stripe';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** `sk_live_…` → `sk_live_…abcd`: suficiente para reconocer la llave. */
function mask(key: string | undefined | null) {
  if (!key) return null;
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

export const GET: APIRoute = async (context: any) => {
  if (!context.locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const env = stripeEnv();
  const mode = stripeMode();

  const publishable = stripePublishableKey();
  const webhook = stripeWebhookSecret();

  const result = {
    demoPrices: 'ver lib/demo.ts',
    stripe: {
      /** Valor crudo de la variable de build (vacío = no existe). */
      PUBLIC_STRIPE_ENV: (import.meta.env.PUBLIC_STRIPE_ENV as string | undefined) ?? null,
      resolvedEnv: env,
      /** Se lee del prefijo real de la llave: es lo que Stripe cobra. */
      resolvedMode: mode,
      secretKey: mask(stripeSecretKey()),
      publishableKey: mask(publishable),
      webhookSecret: webhook ? mask(webhook) : null,
    },
    slots: {
      STRIPE_SECRET_KEY: Boolean(serverEnv('STRIPE_SECRET_KEY')),
      STRIPE_SECRET_KEY_LIVE: Boolean(serverEnv('STRIPE_SECRET_KEY_LIVE')),
      STRIPE_SECRET_KEY_TEST: Boolean(serverEnv('STRIPE_SECRET_KEY_TEST')),
      PUBLIC_STRIPE_PUBLISHABLE_KEY: Boolean(import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY),
      PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE: Boolean(
        import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE
      ),
      PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST: Boolean(
        import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
      ),
      STRIPE_WEBHOOK_SECRET: Boolean(serverEnv('STRIPE_WEBHOOK_SECRET')),
      STRIPE_WEBHOOK_SECRET_LIVE: Boolean(serverEnv('STRIPE_WEBHOOK_SECRET_LIVE')),
      STRIPE_WEBHOOK_SECRET_TEST: Boolean(serverEnv('STRIPE_WEBHOOK_SECRET_TEST')),
    },
  };

  const warnings: string[] = [];

  if (env === 'live' && mode === 'test') {
    warnings.push(
      'PUBLIC_STRIPE_ENV=live pero la llave secreta no es live: falta STRIPE_SECRET_KEY_LIVE o el redeploy.'
    );
  }
  if (env === 'test') {
    warnings.push(
      'Se está cobrando en modo TEST (cs_test_…). Agrega STRIPE_SECRET_KEY_LIVE y PUBLIC_STRIPE_ENV=live, y vuelve a desplegar.'
    );
  }
  if (mode === 'live' && !webhook) {
    warnings.push(
      'Modo live sin secreto de webhook: sin volver al navegador, los pedidos no se marcarán pagados.'
    );
  }
  if (!publishable) {
    warnings.push('Falta la llave publicable del entorno activo.');
  }

  return json({ ...result, warnings });
};
