/**
 * POST /api/lang  (form: lang=es|en, next=/ruta)
 *
 * Guarda la preferencia en la cookie `dsp_lang` y vuelve a la página actual.
 * Se usa como formulario normal (sin JS): el botón ESP/EN funciona aunque el
 * navegador tenga JavaScript desactivado.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { LANG_COOKIE, LANGS, normalizeLang } from '../../lib/i18n';

export const prerender = false;

const safeNext = (raw: FormDataEntryValue | null) => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
};

export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
}: {
  request: Request;
  cookies: AstroCookies;
  redirect: (path: string, status?: number) => Response;
}) => {
  const form = await request.formData().catch(() => null);
  const lang = normalizeLang(String(form?.get('lang') ?? ''));
  const next = safeNext(form?.get('next') ?? null);

  if ((LANGS as readonly string[]).includes(lang)) {
    cookies.set(LANG_COOKIE, lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: false,
    });
  }

  return redirect(next, 303);
};
