/**
 * GET /api/lang?lang=es|en&next=/ruta
 *
 * Guarda la preferencia de idioma en la cookie `dsp_lang` y vuelve a la
 * página actual.
 *
 * Es GET a propósito: Astro 5 bloquea POST cross-site (security.checkOrigin)
 * y, detrás del rewrite de Vercel, el `Origin` del formulario no siempre
 * coincide con el host que ve Astro → "Cross-site POST form submissions are
 * forbidden". Un GET de navegación no pasa por esa comprobación y sigue
 * funcionando con el botón normal (enlace), sin JavaScript.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { LANG_COOKIE, normalizeLang } from '../../lib/i18n';

export const prerender = false;

/** `next` seguro: solo rutas internas. */
function safeNext(raw: string | null) {
  const value = (raw ?? '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export const GET: APIRoute = async ({
  request,
  cookies,
  redirect,
}: {
  request: Request;
  cookies: AstroCookies;
  redirect: (path: string, status?: number) => Response;
}) => {
  const url = new URL(request.url);
  const lang = normalizeLang(url.searchParams.get('lang'));
  const next = safeNext(url.searchParams.get('next'));

  cookies.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });

  // 303: el navegador sigue con GET (evita reenviar la petición al recargar).
  return redirect(next, 303);
};
