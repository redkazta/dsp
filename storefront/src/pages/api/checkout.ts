/**
 * POST /api/checkout
 *
 * Única puerta para empezar una compra. El navegador solo manda:
 *   - items: [{ variantId, qty }]
 *   - customer: datos de contacto y envío
 *
 * El servidor decide:
 *   - quién es el comprador (sesión de Supabase, no el cliente)
 *   - cuánto cuesta cada pieza (`priceItems`, precios de la base de datos)
 *   - crea el pedido en `pending` y devuelve la URL de Stripe Checkout
 *
 * Compra como invitado: sin sesión también se puede pagar. En ese caso la
 * orden se guarda con `user_id = null` y se escribe con el cliente admin
 * (service role), porque RLS no permite insertar pedidos anónimos.
 *
 * La tarjeta se captura en Stripe: aquí no se recibe ningún número,
 * vigencia ni CVV (PCI SAQ A).
 *
 * Requiere `SUPABASE_SERVICE_ROLE_KEY` (escritura sin RLS) y las llaves de
 * Stripe. Sin service role solo se puede pagar con sesión (RLS).
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from '../../lib/supabase-server';
import { readCustomer, startStripeCheckout } from '../../lib/checkout';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const error = (code: string, message: string, status: number) => json({ error: message, code }, status);

export const POST: APIRoute = async ({
  request,
  cookies,
  url,
  site,
  locals,
}: {
  request: Request;
  cookies: AstroCookies;
  url: URL;
  site: URL | undefined;
  locals: App.Locals;
}) => {
  const sessionClient = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return error('BAD_REQUEST', 'Cuerpo inválido.', 400);
  }

  const customer = readCustomer(payload);
  if (!customer) return error('BAD_REQUEST', 'Revisa los datos de contacto y envío.', 400);

  const admin = createSupabaseAdminClient();
  const db: SupabaseClient = admin ?? sessionClient;

  if (!admin && !user) {
    // Sin service role no hay forma de escribir un pedido anónimo (RLS).
    // Se manda a iniciar sesión, que es el único camino disponible.
    console.error('[checkout] invitado sin SUPABASE_SERVICE_ROLE_KEY');
    return error(
      'NO_SESSION',
      'El pago como invitado no está disponible ahora. Inicia sesión para continuar.',
      401
    );
  }

  const result = await startStripeCheckout({
    db,
    // Invitado → null; registrado → su id.
    userId: user?.id ?? null,
    customer,
    requestedItems: payload?.items,
    // El origen del request puede ser interno detrás del proxy; el dominio
    // público sale de `site` (astro.config → SITE_URL).
    origin: site?.origin ?? url.origin,
    returnPath: typeof payload?.returnPath === 'string' ? payload.returnPath : null,
    // Rutas separadas: el invitado nunca pasa por /checkout ni /confirmacion,
    // que siguen exigiendo sesión.
    checkoutPath: user ? '/checkout' : '/invitado/checkout',
    defaultReturnPath: user ? '/confirmacion' : '/invitado/confirmacion',
    lang: locals.lang === 'en' ? 'en' : 'es',
  });

  if (!result.ok) return error(result.code, result.message, result.status);

  return json({
    id: result.orderId,
    orderNumber: result.orderNumber,
    url: result.url,
  });
};
