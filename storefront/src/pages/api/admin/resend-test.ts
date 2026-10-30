/**
 * /api/admin/resend-test — diagnóstico de Resend desde producción.
 *
 * Solo staff. Comprueba, en este orden:
 *   1. qué variables ve el runtime (`RESEND_API_KEY`, `RESEND_DOMAIN`,
 *      `CONTACT_EMAIL`) — el fallo típico es que falten en el deployment
 *      actual o que el scope no sea Production;
 *   2. si la clave es válida y qué dominios tiene Resend (`GET /domains`);
 *   3. opcionalmente envía un correo de prueba al staff que lo abre (`?send=1`).
 *
 * La respuesta es JSON plano: se abre en el navegador y se lee.
 */
import type { APIRoute } from 'astro';
import { serverEnv } from '../../../lib/env';
import { resendConfig } from '../../../lib/resend';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const mask = (v: string | undefined) => {
  if (!v) return null;
  if (v.length <= 8) return `${v.slice(0, 2)}… (${v.length} chars)`;
  return `${v.slice(0, 6)}…${v.slice(-4)} (${v.length} chars)`;
};

export const GET: APIRoute = async (context: any) => {
  const { locals, url } = context;

  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const rawDomain = serverEnv('RESEND_DOMAIN');
  const cfg = resendConfig();

  const report: Record<string, any> = {
    env: {
      RESEND_API_KEY: mask(cfg.apiKey),
      // Nombres presentes (sin valores): delata typos tipo RESEND_APIKEY.
      variables_resend_presentes: Object.keys(
        (globalThis as any).process?.env ?? {}
      ).filter((k) => k.toUpperCase().includes('RESEND')),
      RESEND_DOMAIN_bruto: rawDomain ?? null,
      RESEND_DOMAIN_normalizado: cfg.domain,
      CONTACT_EMAIL: cfg.contactEmail,
      remitente_efectivo: cfg.from,
      staff_email: locals.email ?? null,
    },
  };

  if (!cfg.apiKey) {
    report.veredicto =
      'Falta RESEND_API_KEY en este deployment. Añádela en Vercel con scope Production y haz Redeploy (las variables nuevas no llegan a un deployment ya creado).';
    return json(report, 500);
  }

  // 1) ¿La clave sirve? /domains responde 401 si es inválida o revocada.
  const domainsRes = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  }).catch(() => null);

  if (!domainsRes) {
    report.veredicto = 'No se pudo conectar con la API de Resend desde el servidor.';
    return json(report, 502);
  }

  const domainsBody: any = await domainsRes.json().catch(() => null);
  report.dominios_http = domainsRes.status;

  if (!domainsRes.ok) {
    report.resend_respuesta = domainsBody;
    report.veredicto =
      domainsRes.status === 401
        ? 'La clave es inválida o fue revocada. Genera una nueva en Resend → API Keys y actualiza RESEND_API_KEY.'
        : 'Resend rechazó la petición; revisa resend_respuesta.';
    return json(report, 502);
  }

  const domains = Array.isArray(domainsBody?.data) ? domainsBody.data : [];
  report.dominios = domains.map((d: any) => ({ name: d.name, status: d.status, region: d.region }));

  const match = domains.find((d: any) => d.name === cfg.domain);
  report.dominio_en_resend = match
    ? { name: match.name, status: match.status }
    : 'no existe en esta cuenta';

  // 2) Envío real de prueba (solo al correo del staff autenticado).
  if (url.searchParams.get('send') === '1') {
    const to = locals.email as string | null;
    if (!to) {
      report.envio_prueba = 'sin correo de staff en la sesión';
    } else {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.from,
          to,
          subject: 'Prueba de Resend · D$P',
          html: '<p>Si ves este correo, Resend está funcionando desde producción.</p>',
        }),
      }).catch(() => null);

      if (!sendRes) {
        report.envio_prueba = 'no se pudo conectar';
      } else {
        report.envio_prueba = { http: sendRes.status, respuesta: await sendRes.json().catch(() => null) };
      }
    }
  }

  report.veredicto = match?.status === 'verified'
    ? 'Dominio verificado y clave válida. Prueba `?send=1` para confirmar la entrega; si el envío da 200, revisa Spam y Resend → Emails.'
    : `El remitente usa "${cfg.domain}", que ${match ? `está en Resend como "${match.status}" (sin verificar)` : 'no está en esta cuenta'}. Mientras no esté "verified", Resend solo entrega al correo del dueño de la cuenta.`;

  return json(report);
};
