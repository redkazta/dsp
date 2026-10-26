/**
 * i18n — textos centralizados y claves de traducción.
 *
 * Regla: ninguna cadena visible se escribe en el componente; se toma de
 * `copy[lang]`. El tipo `Copy` es la interfaz en español: si se agrega una
 * clave nueva, TypeScript obliga a traducirla en `en`.
 *
 * El idioma se resuelve en el servidor (middleware → `Astro.locals.lang`) a
 * partir de la cookie `dsp_lang` o, si no hay, del `Accept-Language`.
 */

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'es';

/** Cookie donde se guarda la preferencia (1 año). */
export const LANG_COOKIE = 'dsp_lang';

export const LANG_LABEL: Record<Lang, string> = {
  es: 'ES',
  en: 'EN',
};

/** Texto del botón: muestra el idioma al que puedes cambiar… o el actual. */
export const LANG_TOGGLE_LABEL: Record<Lang, string> = {
  es: 'ESP/EN',
  en: 'ENG/ESP',
};

/**
 * Datos por idioma para el `<html lang>` y el formateo de fechas/moneda.
 * Coinciden con los códigos de Intl para fechas.
 */
export const LOCALE: Record<Lang, string> = {
  es: 'es-MX',
  en: 'en-US',
};

export function normalizeLang(value: string | null | undefined): Lang {
  const v = (value ?? '').trim().toLowerCase().slice(0, 2);
  return v === 'en' || v === 'es' ? (v as Lang) : DEFAULT_LANG;
}

/** Del header `Accept-Language` saca el idioma soportado con más peso. */
export function langFromAcceptHeader(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const weight = q ? Number(q.split('=')[1]) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranked) {
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('en')) return 'en';
  }

  return DEFAULT_LANG;
}

// ---------------------------------------------------------------- Copy

export const copy = {
  es: {
    brand: 'Dinero Sobre Problemas',
    brandShort: 'DSP',
    meta: {
      home: {
        title: 'Dinero Sobre Problemas | Streetwear Reflective Premium',
        description:
          'Camisas reflectivas, hoodies y piezas atemporales. Diseño callejero con energía de lujo.',
      },
    },
    announcements: [
      'Envío gratis en pedidos superiores a $150 USD',
      'Drop Reflective disponible por tiempo limitado',
    ],
    nav: {
      tienda: 'Tienda',
      nosotros: 'Nosotros',
      cuenta: 'Cuenta',
      buscar: 'Buscar',
      menu: 'Abrir menú',
      carrito: 'Carrito',
      favoritos: 'Favoritos',
    },
    header: {
      home: 'Ir al inicio',
      search: 'Buscar piezas',
      close: 'Cerrar',
      language: 'Cambiar idioma',
      login: 'Iniciar sesión',
      accountMenu: 'Opciones de la cuenta',
      myAccount: 'Mi cuenta',
      myOrders: 'Mis pedidos',
      checkout: 'Finalizar compra',
      admin: 'Panel de administración',
      logout: 'Cerrar sesión',
      welcome: 'Hola',
      viewAccount: 'Ver mi cuenta',
    },
    hero: {
      cta: 'Ver drop',
      ctaFull: 'Ver el drop',
    },
    search: {
      placeholder: 'Buscar piezas…',
      hint: 'Escribe al menos 2 letras.',
      noResults: 'Sin resultados.',
      results: 'Resultados',
    },
    footer: {
      tienda: 'Tienda',
      catalogue: 'Catálogo',
      about: 'Nosotros',
      contact: 'Contacto',
      sizes: 'Guía de tallas',
      help: 'Ayuda',
      shipping: 'Envíos',
      returns: 'Devoluciones',
      privacy: 'Privacidad',
      terms: 'Términos',
      rights: 'Todos los derechos reservados',
      payments: 'Pagos seguros con tarjeta',
    },
    trust: {
      shippingTitle: 'Envío express',
      shippingText: '24-48h en zona metropolitana',
      secureTitle: 'Pago seguro',
      secureText: 'Tarjetas de crédito y débito',
      returnsTitle: 'Devoluciones',
      returnsText: '30 días sin preguntas',
      supportTitle: 'Atención 1:1',
      supportText: 'WhatsApp y DM abiertos',
    },
  },

  en: {
    brand: 'Dinero Sobre Problemas',
    brandShort: 'DSP',
    meta: {
      home: {
        title: 'Dinero Sobre Problemas | Premium Reflective Streetwear',
        description:
          'Reflective shirts, hoodies and timeless pieces. Street design with a luxury edge.',
      },
    },
    announcements: [
      'Free shipping on orders over $150 USD',
      'Reflective drop available for a limited time',
    ],
    nav: {
      tienda: 'Shop',
      nosotros: 'About',
      cuenta: 'Account',
      buscar: 'Search',
      menu: 'Open menu',
      carrito: 'Cart',
      favoritos: 'Wishlist',
    },
    header: {
      home: 'Go to home',
      search: 'Search pieces',
      close: 'Close',
      language: 'Change language',
      login: 'Sign in',
      accountMenu: 'Account options',
      myAccount: 'My account',
      myOrders: 'My orders',
      checkout: 'Checkout',
      admin: 'Admin panel',
      logout: 'Sign out',
      welcome: 'Hi',
      viewAccount: 'View my account',
    },
    hero: {
      cta: 'Shop the drop',
      ctaFull: 'Shop the drop',
    },
    search: {
      placeholder: 'Search pieces…',
      hint: 'Type at least 2 letters.',
      noResults: 'No results.',
      results: 'Results',
    },
    footer: {
      tienda: 'Shop',
      catalogue: 'Catalogue',
      about: 'About',
      contact: 'Contact',
      sizes: 'Size guide',
      help: 'Help',
      shipping: 'Shipping',
      returns: 'Returns',
      privacy: 'Privacy',
      terms: 'Terms',
      rights: 'All rights reserved',
      payments: 'Secure card payments',
    },
    trust: {
      shippingTitle: 'Express shipping',
      shippingText: '24-48h in the metro area',
      secureTitle: 'Secure payment',
      secureText: 'Credit and debit cards',
      returnsTitle: 'Returns',
      returnsText: '30 days, no questions',
      supportTitle: '1:1 support',
      supportText: 'WhatsApp and DMs open',
    },
  },
} as const;

/** El español es la forma canónica; el inglés debe tener las mismas claves. */
export type Copy = typeof copy.es;

export function getCopy(lang: Lang | string | null | undefined): Copy {
  return copy[normalizeLang(lang)] as Copy;
}
