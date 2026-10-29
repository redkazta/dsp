/**
 * Rutas localizadas ES/EN.
 *
 * El sitio tiene **un solo archivo por página** (`/tienda.astro`,
 * `/contacto.astro`…), pero se sirve bajo la ruta de cada idioma:
 *
 *   ES: /tienda   /contacto   /nosotros   /carrito   /entrar
 *   EN: /shop     /contact    /about      /cart       /login
 *
 * Cómo funciona (sin duplicar páginas ni romper enlaces):
 *
 *   1. El middleware detecta que la URL pedida es el alias de otra ruta
 *      canónica y reescribe el render a esa página, sin cambiar la URL del
 *      navegador. No es un redirect: la barra sigue en `/shop`.
 *   2. `astro.config.mjs` añade rewrites en Vercel. Es necesario porque
 *      Vercel resuelve el archivo antes de llamar al middleware: sin ellos
 *      `/shop` daría 404 sin llegar nunca a la función.
 *   3. `localize()` es lo que usan los `href` para apuntar al idioma activo.
 *
 * Todo vive aquí: añadir una ruta es añadir una entrada a `ROUTES`.
 */

import type { Lang } from './i18n';

/**
 * Un segmento por idioma. `es` es la forma canónica (el archivo real).
 * En rutas con parámetro se escribe `:slug` y se sustituye al vuelo.
 */
export interface RouteEntry {
  es: string;
  en: string;
}

/**
 * Rutas públicas bilingües.
 *
 * Solo las que el visitante ve en la barra. Las privadas (`/cuenta`,
 * `/checkout`) y las de API se quedan tal cual: son post-login y no
 * aportan nada traducidas, además de romper enlaces guardados.
 */
export const ROUTES: Record<string, RouteEntry> = {
  shop: { es: '/tienda', en: '/shop' },
  contact: { es: '/contacto', en: '/contact' },
  about: { es: '/nosotros', en: '/about' },
  cart: { es: '/carrito', en: '/cart' },
  favorites: { es: '/favoritos', en: '/wishlist' },
  login: { es: '/entrar', en: '/login' },
  register: { es: '/registro', en: '/signup' },
  recover: { es: '/recuperar', en: '/recover' },
  sizes: { es: '/tallas', en: '/sizing' },
  shipping: { es: '/envios', en: '/shipping' },
  returns: { es: '/devoluciones', en: '/returns' },
  privacy: { es: '/privacidad', en: '/privacy' },
  terms: { es: '/terminos', en: '/terms' },
  products: { es: '/producto/:slug', en: '/product/:slug' },
};

export type RouteKey = keyof typeof ROUTES;

/** Idioma canónico: es el que tiene el archivo real en `src/pages`. */
export const CANONICAL_LANG: Lang = 'es';

/**
 * Todos los alias EN que el middleware debe reescribir.
 * Se generan del mapa: no hay listas paralelas que se desincronicen.
 */
export function localizedAliases(): Array<{ alias: string; target: string }> {
  return Object.values(ROUTES)
    .filter((r) => r.en !== r.es)
    .map((r) => {
      const alias = r.en.replace(':slug', '*');
      const target = r.es.replace(':slug', '*');
      return { alias, target };
    });
}

/**
 * Si `pathname` es la versión inglesa de una ruta canónica, devuelve la ruta
 * real que hay que renderizar. Si no coincide, devuelve `null`.
 *
 *   '/shop'                  → '/tienda'
 *   '/product/camisa-dsp'    → '/producto/camisa-dsp'
 *   '/tienda'                → null  (ya es la canónica)
 *   '/api/wishlist'          → null
 */
export function aliasToCanonical(pathname: string): string | null {
  const clean = normalizePath(pathname);

  for (const route of Object.values(ROUTES)) {
    if (route.en === route.es) continue;

    const aliasSegments = route.en.split('/').filter(Boolean);
    const targetSegments = route.es.split('/').filter(Boolean);
    const parts = clean.split('/').filter(Boolean);

    if (parts.length !== aliasSegments.length) continue;

    let matched = true;
    const out: string[] = [];

    for (let i = 0; i < aliasSegments.length; i += 1) {
      const a = aliasSegments[i];
      const part = parts[i];

      if (a.startsWith(':')) {
        // Parámetro: se copia tal cual al destino.
        out.push(part);
      } else if (a === part) {
        out.push(targetSegments[i]);
      } else {
        matched = false;
        break;
      }
    }

    if (matched) return `/${out.join('/')}`;
  }

  return null;
}

/**
 * Ruta canónica de un pathname, venga en el idioma que venga.
 *   '/shop' → '/tienda'   ·   '/tienda' → '/tienda'
 */
export function canonicalPath(pathname: string): string {
  return aliasToCanonical(pathname) ?? normalizePath(pathname);
}

/**
 * Construye la URL de una ruta en el idioma pedido.
 *
 *   localize('es', 'shop')                      → '/tienda'
 *   localize('en', 'shop')                      → '/shop'
 *   localize('en', 'products', 'camisa-violet') → '/product/camisa-violet'
 *   localize('en', 'shop', undefined, '?sort=x')→ '/shop?sort=x'
 */
export function localize(
  lang: Lang | string | null | undefined,
  key: RouteKey,
  param?: string | null,
  query?: string
): string {
  const entry = ROUTES[key];
  const resolvedLang: Lang = lang === 'en' ? 'en' : 'es';
  let path = entry[resolvedLang];

  if (param && path.includes(':slug')) {
    path = path.replace(':slug', encodeURIComponent(String(param)));
  }

  const qs = (query ?? '').trim();
  if (!qs) return path;

  if (qs === '?' || qs === '') return path;
  return `${path}${qs.startsWith('?') ? qs : `?${qs}`}`;
}

/**
 * Traduce una URL que apunta a la ruta canónica al idioma pedido.
 *
 * Se usa en el conmutador de idioma: al cambiar de idioma hay que llevar al
 * usuario a la MISMA página, no al inicio ni a una versión 404.
 *
 *   translateUrl('en', '/tienda?sort=newest') → '/shop?sort=newest'
 *   translateUrl('es', '/product/x')          → '/producto/x'
 *   translateUrl('en', '/api/x')              → '/api/x'
 */
export function translateUrl(lang: Lang, url: string): string {
  const [pathPart, ...rest] = String(url).split('?');
  const query = rest.length > 0 ? `?${rest.join('?')}` : '';
  const clean = normalizePath(pathPart);
  const targetLang: Lang = lang === 'en' ? 'en' : 'es';

  for (const route of Object.values(ROUTES)) {
    const parts = clean.split('/').filter(Boolean);

    // Se prueba contra AMBOS idiomas: el usuario puede llegar con la URL en
    // inglés y pedir volver al español (o al revés).
    for (const from of ['es', 'en'] as const) {
      const segments = route[from].split('/').filter(Boolean);
      if (parts.length !== segments.length) continue;

      let matched = true;
      const out: string[] = [];
      for (let i = 0; i < segments.length; i += 1) {
        const s = segments[i];
        if (s.startsWith(':')) out.push(parts[i]);
        else if (s === parts[i]) out.push(route[targetLang].split('/').filter(Boolean)[i]);
        else {
          matched = false;
          break;
        }
      }

      if (matched) return `/${out.join('/')}${query}`;
    }
  }

  return `${clean}${query}`;
}

/** Quita barra final y normaliza a minúsculas la comparación. */
function normalizePath(pathname: string): string {
  const value = String(pathname || '/').split('?')[0].split('#')[0];
  const trimmed = value.length > 1 ? value.replace(/\/+$/, '') : value;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
