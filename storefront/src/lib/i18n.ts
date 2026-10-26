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

    // ---------------- Tienda ----------------
    shop: {
      metaTitle: 'Tienda | Dinero Sobre Problemas',
      metaDescription:
        'Catálogo completo de playeras ¡D$P!. Siete acabados, tallas S a XL, envío a todo México.',
      breadcrumbHome: 'Inicio',
      breadcrumb: 'Tienda',
      collection: 'Colección',
      allPieces: 'Todas las piezas',
      productOne: 'producto',
      productMany: 'productos',
      forQuery: 'para',
      allChips: 'Todas',
      searchPlaceholder: 'Buscar…',
      viewCart: 'Ver carrito',
      sortNewest: 'Más recientes',
      sortPriceAsc: 'Precio: menor a mayor',
      sortPriceDesc: 'Precio: mayor a menor',
      sortNameAsc: 'Nombre A-Z',
      priceAll: 'Todos los precios',
      priceUpTo: 'Hasta',
      priceFrom: 'Más de',
      loadErrorTitle: 'No pudimos cargar el catálogo',
      loadErrorText: 'Revisa la conexión con Supabase o las variables de entorno.',
      emptyTitle: 'Sin resultados',
      emptyForQuery: 'No encontramos piezas para',
      emptyCollection: 'Todavía no hay productos publicados en esta colección.',
      seeAll: 'Ver todo',
      goHome: 'Ir al inicio',
      noProducts: 'No hay productos disponibles por el momento.',
    },

    // ---------------- Ficha de producto ----------------
    product: {
      selectSize: 'Elige talla',
      selectColor: 'Elige color',
      quantity: 'Cantidad',
      addToCart: 'Agregar al carrito',
      adding: 'Agregando…',
      added: '¡Agregado!',
      soldOut: 'Agotado',
      outOfStockSize: 'Esa talla no está disponible',
      wishlistAdd: 'Guardar en favoritos',
      wishlistRemove: 'Quitar de favoritos',
      freeShipping: 'Envío gratis desde $150 USD',
      shippingInfo: 'Envío estándar $15 · gratis desde $150',
      madeToOrder: 'Hecho bajo pedido, una pieza a la vez.',
      description: 'Descripción',
      details: 'Detalles',
      related: 'También te puede gustar',
      sizeGuide: 'Guía de tallas',
      notFoundTitle: 'Pieza no encontrada',
      notFoundText: 'Puede que se haya agotado o cambiado de nombre.',
      backToShop: 'Volver a la tienda',
      lowStock: 'Últimas piezas',
      previousPhoto: 'Foto anterior',
      nextPhoto: 'Foto siguiente',
      photos: 'fotos',
      seeView: 'Ver',
      front: 'Frente',
      back: 'Espalda',
      frontFlash: 'Frente · flash',
      backFlash: 'Espalda · flash',
      noImage: 'Sin imagen',
      wishlistShort: 'Favorito',
      defaultDescription:
        'Playera oversize de algodón premium. Logo ¡D$P! estampado al frente.',
      detailsTitle: 'Detalles del producto',
      stockAvailable: 'Stock disponible:',
      category: 'Categoría:',
      shippingTitle: 'Envío y devoluciones',
      shippingText:
        'Envío gratis en pedidos superiores a $150 USD. Devoluciones aceptadas dentro de 30 días con etiqueta original.',
      completeLook: 'Completa el look',
      size: 'Talla',
      color: 'Color',
      selectSizeError: 'Selecciona una talla',
      selectColorError: 'Selecciona un color',
      combinationUnavailable: 'Combinación no disponible',
      wishlistSaved: 'Guardado',
    },

    // ---------------- Carrito ----------------
    cart: {
      title: 'Carrito',
      metaTitle: 'Carrito | Dinero Sobre Problemas',
      metaDescription: 'Revisa tu selección antes de pagar.',
      emptyTitle: 'Tu carrito está vacío',
      emptyText: 'Encuentra tu próxima pieza del drop.',
      summary: 'Resumen',
      subtotal: 'Subtotal',
      shipping: 'Envío',
      free: 'Gratis',
      total: 'Total',
      checkout: 'Ir al pago',
      continueShopping: 'Seguir comprando',
      remove: 'Quitar',
      loading: 'Cargando…',
      suggestions: 'Por si te sirve',
      shippingAtPay: 'Calculado al pagar',
      viewWishlist: 'Ver favoritos',
      freeFrom: 'Envío gratis desde',
      madeToOrderTime: 'Piezas producidas bajo pedido · 2 a 3 semanas',
      removeOne: 'Quitar uno',
      addOne: 'Agregar uno',
      freeShippingDone: 'Ya tienes envío gratis ✓',
      freeShippingMissing: 'Te faltan',
      forFree: 'para envío gratis',
      unavailableRemoved: 'Retiramos piezas que ya no están disponibles.',
    },

    // ---------------- Checkout ----------------
    checkout: {
      metaTitle: 'Checkout | Dinero Sobre Problemas',
      metaDescription: 'Completa tu compra de forma segura.',
      title: 'Finalizar compra',
      subtitle: 'Producción bajo pedido · Pago seguro con Stripe',
      step1: 'Información de contacto',
      step2: 'Dirección de envío',
      step3: 'Pago',
      firstName: 'Nombre',
      lastName: 'Apellidos',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      phonePlaceholder: '10 dígitos',
      street: 'Calle y número',
      colonia: 'Colonia',
      postalCode: 'Código postal',
      city: 'Ciudad',
      state: 'Estado',
      references: 'Referencias',
      referencesPlaceholder: 'Entre calles, número de casa…',
      notes: 'Notas del pedido',
      notesPlaceholder: 'Diseño, color, talla especial o cualquier indicación.',
      cardTitle: 'Tarjeta de crédito o débito',
      cardText:
        'Al continuar te llevamos a la pantalla segura de Stripe para capturar tu tarjeta. Tus datos nunca pasan por esta tienda.',
      cardUnavailable:
        'El pago con tarjeta no está disponible en este momento. Escríbenos para completar tu pedido.',
      orderTitle: 'Tu pedido',
      total: 'Total',
      pay: 'Pagar y confirmar',
      opening: 'Abriendo pago seguro…',
      emptyTitle: 'Tu carrito está vacío',
      goShop: 'Ir a la tienda',
      terms: 'Al confirmar aceptas nuestros',
      termsLink: 'términos',
      privacyLink: 'política de privacidad',
      and: 'y la',
      returnsLink: 'política de devoluciones',
      required: 'Este campo es obligatorio.',
      invalidEmail: 'Escribe un correo electrónico válido.',
      invalidPhone: 'El teléfono debe tener 10 dígitos (o incluir lada).',
      invalidPostal: 'Código postal de 5 dígitos (o 4-6 si es de otro país).',
      fixErrors: 'Por favor corrige los errores en el formulario.',
      emptyCartError: 'Tu carrito está vacío. Agrega productos antes de continuar.',
      waitCart: 'Espera mientras verificamos tu carrito…',
      openFailed: 'No pudimos abrir la pantalla de pago. Intenta de nuevo.',
      connection: 'No pudimos conectar con la tienda. Revisa tu conexión e intenta de nuevo.',
      removedPieces: 'Retiramos',
      pieceOne: 'pieza',
      pieceMany: 'piezas',
      unavailableNow: 'que ya no están disponibles.',
    },

    // ---------------- Cuenta / acceso ----------------
    account: {
      title: 'Mi cuenta',
      metaTitle: 'Mi cuenta | Dinero Sobre Problemas',
      orders: 'Pedidos',
      noOrders: 'Todavía no tienes pedidos.',
      logout: 'Cerrar sesión',
      loginTitle: 'Iniciar sesión',
      loginSubtitle: 'Accede a tu cuenta, revisa tus pedidos y guarda tus datos.',
      registerTitle: 'Crear cuenta',
      loginMetaTitle: 'Iniciar sesión | Dinero Sobre Problemas',
      registerMetaTitle: 'Crear cuenta | Dinero Sobre Problemas',
      registerSubtitle: 'Únete al drop y guarda tus favoritos.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      confirmPassword: 'Confirma tu contraseña',
      name: 'Nombre',
      lastName: 'Apellidos',
      phone: 'Teléfono',
      birthDate: 'Fecha de nacimiento',
      marketing: 'Quiero recibir novedades y drops.',
      acceptTerms: 'Acepto los términos y la política de privacidad.',
      enter: 'Entrar',
      create: 'Crear cuenta',
      forgot: '¿Olvidaste tu contraseña?',
      noAccount: '¿No tienes cuenta?',
      hasAccount: '¿Ya tienes cuenta?',
      goRegister: 'Regístrate',
      goLogin: 'Inicia sesión',
      continueGoogle: 'Continuar con Google',
      or: 'o',
      joinLabel: 'Únete',
      accountLabel: 'Cuenta',
      registerIntro: 'Crea tu cuenta para comprar más rápido y seguir tus pedidos.',
      loginIntro: 'Entra para ver tus pedidos y guardar tus datos.',
      emailPlaceholder: 'tu@correo.com',
      birthDateHint: 'Opcional. Solo para promociones de cumpleaños.',
      passwordPlaceholder: 'Tu contraseña',
      passwordNewPlaceholder: 'Mínimo 8 caracteres',
      passwordHint: 'Al menos 8 caracteres. Usa mayúsculas, números o símbolos.',
      confirmPasswordPlaceholder: 'Repite tu contraseña',
      togglePassword: 'Mostrar u ocultar contraseña',
      andThe: 'y la',
      processing: 'Procesando…',
      missingName: 'Escribe tu nombre y apellidos.',
      shortPassword: 'La contraseña debe tener al menos 8 caracteres.',
      passwordMismatch: 'Las contraseñas no coinciden.',
      mustAccept: 'Debes aceptar los términos y la política de privacidad.',
      confirmEmail: 'Revisa tu correo para confirmar tu cuenta.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
      profileSection: 'Mis datos',
      saveChanges: 'Guardar cambios',
      saved: 'Guardado ✓',
      myWishlist: 'Mis favoritos',
      myAddresses: 'Mis direcciones',
      listLabel: 'Lista',
      wishlistTitle: 'Favoritos',
      wishlistMetaTitle: 'Mis favoritos | Dinero Sobre Problemas',
      wishlistEmptyTitle: 'Todavía nada guardado',
      wishlistEmptyText:
        'Toca el corazón en cualquier pieza del catálogo para guardarla aquí.',
      wishlistLoading: 'Cargando favoritos…',
      chooseSize: 'Elegir talla',
    },

    // ---------------- Nosotros ----------------
    about: {
      metaTitle: 'Nosotros | Dinero Sobre Problemas',
      metaDescription:
        'Streetwear artesanal prensado a mano. Piezas atemporales con energía de lujo. No seguimos modas, las creamos.',
      label: 'Streetwear artesanal',
      headline1: 'Del suelo al cielo,',
      headline2: 'sin miedo al fracaso',
      intro:
        'Diseñamos prendas con atención al detalle, prensadas a mano una por una. Cada pieza refleja el balance entre estilo callejero y calidad artesanal — hecha para quienes valoran la autenticidad por encima de las tendencias.',
      rootsLabel: 'Nuestras raíces',
      roots:
        'Arraigada en la cultura mexicana, nuestra marca crea prendas prensadas a mano que combinan el estilo callejero con la esencia artesanal, reflejando autenticidad, pasión y orgullo por nuestras raíces mientras abrazamos la energía contemporánea del streetwear.',
      pillars: [
        {
          title: 'Prensado a mano',
          text: 'Cada prenda se personaliza individualmente. Nada de producción en masa, nada de dos piezas iguales.',
        },
        {
          title: 'Ediciones limitadas',
          text: 'Producimos por drop. Cuando se agota, no se vuelve a producir igual.',
        },
        {
          title: 'Hecho bajo pedido',
          text: 'Preparamos tu pieza en 2–3 días después de tu compra y la enviamos de inmediato.',
        },
      ],
      philosophyLabel: 'Nuestra filosofía',
      quote1: 'Que el silencio',
      quote2: 'también hace',
      quoteAccent: 'ruido',
      philosophy:
        'Hecha para quienes se mueven en silencio y mantienen la mirada en el legado, no en la atención. Porque los problemas pasan, pero el dinero y la visión se mantienen.',
      closingTitle: 'No seguimos modas, las creamos',
      closingText: 'Descubre el drop reflectivo antes de que se agote.',
      closingCta: 'Ver catálogo',
    },

    // ---------------- Confirmación de pedido ----------------
    order: {
      received: 'Pedido recibido',
      thanks: 'Gracias por tu compra',
      tracking: 'Seguimiento',
      pieces: 'Piezas',
      shippingSection: 'Envío',
    },

    // ---------------- 404 ----------------
    notFound: {
      metaTitle: 'Página no encontrada | Dinero Sobre Problemas',
      metaDescription: 'La página que buscas no existe.',
      label: 'Error 404',
      title: 'Perdido',
      text: 'La página que buscas no existe o fue movida. Pero el buen estilo nunca se pierde.',
    },

    // ---------------- Páginas de contenido ----------------
    content: {
      contactMetaTitle: 'Contacto | Dinero Sobre Problemas',
      contactMetaDescription: 'Escríbenos. Respondemos en menos de 24 horas.',
      returnsMetaTitle: 'Devoluciones | Dinero Sobre Problemas',
      returnsMetaDescription: 'Cómo solicitar un cambio o devolución.',
      shippingMetaTitle: 'Envíos | Dinero Sobre Problemas',
      shippingMetaDescription: 'Tiempos de producción, envíos y cobertura.',
      sizesMetaTitle: 'Guía de tallas | Dinero Sobre Problemas',
      sizesMetaDescription: 'Medidas en centímetros para elegir tu talla correcta.',
      privacyMetaTitle: 'Privacidad | Dinero Sobre Problemas',
      privacyMetaDescription: 'Cómo tratamos tus datos personales.',
      termsMetaTitle: 'Términos | Dinero Sobre Problemas',
      termsMetaDescription: 'Condiciones de compra y uso del sitio.',
    },

    errors: {
      noSession: 'Inicia sesión o crea tu cuenta para completar el pedido.',
      badRequest: 'Revisa los datos de contacto y envío.',
      cardDeclined: 'La tarjeta fue rechazada. Prueba con otra.',
      unavailable: 'Una pieza de tu carrito ya no está disponible.',
      paymentUnavailable: 'El pago con tarjeta no está disponible en este momento.',
      paymentError: 'No pudimos iniciar el pago. Intenta de nuevo en un momento.',
      storage: 'No pudimos guardar tu carrito. Intenta de nuevo.',
    },

    common: {
      loading: 'Cargando…',
      error: 'Algo salió mal. Intenta de nuevo.',
      retry: 'Reintentar',
      close: 'Cerrar',
      save: 'Guardar',
      cancel: 'Cancelar',
      back: 'Volver',
      search: 'Buscar',
      itemOne: 'producto',
      itemMany: 'productos',
      piece: 'Pieza',
      client: 'Cliente',
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

    // ---------------- Shop ----------------
    shop: {
      metaTitle: 'Shop | Dinero Sobre Problemas',
      metaDescription:
        'Full ¡D$P! shirt catalogue. Seven finishes, sizes S to XL, shipping across Mexico.',
      breadcrumbHome: 'Home',
      breadcrumb: 'Shop',
      collection: 'Collection',
      allPieces: 'All pieces',
      productOne: 'item',
      productMany: 'items',
      forQuery: 'for',
      allChips: 'All',
      searchPlaceholder: 'Search…',
      viewCart: 'View cart',
      sortNewest: 'Newest',
      sortPriceAsc: 'Price: low to high',
      sortPriceDesc: 'Price: high to low',
      sortNameAsc: 'Name A-Z',
      priceAll: 'All prices',
      priceUpTo: 'Up to',
      priceFrom: 'Over',
      loadErrorTitle: 'We could not load the catalogue',
      loadErrorText: 'Check the Supabase connection or the environment variables.',
      emptyTitle: 'No results',
      emptyForQuery: 'We found no pieces for',
      emptyCollection: 'No products published in this collection yet.',
      seeAll: 'See all',
      goHome: 'Go home',
      noProducts: 'No products available right now.',
    },

    // ---------------- Product page ----------------
    product: {
      selectSize: 'Choose size',
      selectColor: 'Choose colour',
      quantity: 'Quantity',
      addToCart: 'Add to cart',
      adding: 'Adding…',
      added: 'Added!',
      soldOut: 'Sold out',
      outOfStockSize: 'That size is not available',
      wishlistAdd: 'Save to wishlist',
      wishlistRemove: 'Remove from wishlist',
      freeShipping: 'Free shipping from $150 USD',
      shippingInfo: 'Standard shipping $15 · free from $150',
      madeToOrder: 'Made to order, one piece at a time.',
      description: 'Description',
      details: 'Details',
      related: 'You may also like',
      sizeGuide: 'Size guide',
      notFoundTitle: 'Piece not found',
      notFoundText: 'It may have sold out or been renamed.',
      backToShop: 'Back to the shop',
      lowStock: 'Last pieces',
      previousPhoto: 'Previous photo',
      nextPhoto: 'Next photo',
      photos: 'photos',
      seeView: 'View',
      front: 'Front',
      back: 'Back',
      frontFlash: 'Front · flash',
      backFlash: 'Back · flash',
      noImage: 'No image',
      wishlistShort: 'Favourite',
      defaultDescription:
        'Oversized premium cotton shirt. ¡D$P! logo printed on the front.',
      detailsTitle: 'Product details',
      stockAvailable: 'In stock:',
      category: 'Category:',
      shippingTitle: 'Shipping and returns',
      shippingText:
        'Free shipping on orders over $150 USD. Returns accepted within 30 days with the original tag.',
      completeLook: 'Complete the look',
      size: 'Size',
      color: 'Colour',
      selectSizeError: 'Choose a size',
      selectColorError: 'Choose a colour',
      combinationUnavailable: 'Combination not available',
      wishlistSaved: 'Saved',
    },

    // ---------------- Cart ----------------
    cart: {
      title: 'Cart',
      metaTitle: 'Cart | Dinero Sobre Problemas',
      metaDescription: 'Review your selection before paying.',
      emptyTitle: 'Your cart is empty',
      emptyText: 'Find your next piece from the drop.',
      summary: 'Summary',
      subtotal: 'Subtotal',
      shipping: 'Shipping',
      free: 'Free',
      total: 'Total',
      checkout: 'Go to checkout',
      continueShopping: 'Keep shopping',
      remove: 'Remove',
      loading: 'Loading…',
      suggestions: 'You may also like',
      shippingAtPay: 'Calculated at checkout',
      viewWishlist: 'View wishlist',
      freeFrom: 'Free shipping from',
      madeToOrderTime: 'Made-to-order pieces · 2 to 3 weeks',
      removeOne: 'Remove one',
      addOne: 'Add one',
      freeShippingDone: 'You have free shipping ✓',
      freeShippingMissing: 'You are',
      forFree: 'away from free shipping',
      unavailableRemoved: 'We removed items that are no longer available.',
    },

    // ---------------- Checkout ----------------
    checkout: {
      metaTitle: 'Checkout | Dinero Sobre Problemas',
      metaDescription: 'Complete your purchase securely.',
      title: 'Checkout',
      subtitle: 'Made to order · Secure payment with Stripe',
      step1: 'Contact information',
      step2: 'Shipping address',
      step3: 'Payment',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email address',
      phone: 'Phone',
      phonePlaceholder: '10 digits',
      street: 'Street and number',
      colonia: 'Neighbourhood',
      postalCode: 'ZIP code',
      city: 'City',
      state: 'State',
      references: 'References',
      referencesPlaceholder: 'Between streets, house number…',
      notes: 'Order notes',
      notesPlaceholder: 'Design, colour, special size or any instructions.',
      cardTitle: 'Credit or debit card',
      cardText:
        'We will take you to Stripe\u2019s secure page to enter your card. Your details never pass through this store.',
      cardUnavailable:
        'Card payment is not available right now. Message us to complete your order.',
      orderTitle: 'Your order',
      total: 'Total',
      pay: 'Pay and confirm',
      opening: 'Opening secure payment…',
      emptyTitle: 'Your cart is empty',
      goShop: 'Go to the shop',
      terms: 'By confirming you accept our',
      termsLink: 'terms',
      privacyLink: 'privacy policy',
      and: 'and the',
      returnsLink: 'returns policy',
      required: 'This field is required.',
      invalidEmail: 'Enter a valid email address.',
      invalidPhone: 'The phone must have 10 digits (or include a country code).',
      invalidPostal: 'ZIP code of 5 digits (or 4-6 for other countries).',
      fixErrors: 'Please fix the errors in the form.',
      emptyCartError: 'Your cart is empty. Add products before continuing.',
      waitCart: 'Hold on while we check your cart…',
      openFailed: 'We could not open the payment page. Try again.',
      connection: 'We could not reach the store. Check your connection and try again.',
      removedPieces: 'We removed',
      pieceOne: 'item',
      pieceMany: 'items',
      unavailableNow: 'that are no longer available.',
    },

    // ---------------- Account / sign in ----------------
    account: {
      title: 'My account',
      metaTitle: 'My account | Dinero Sobre Problemas',
      orders: 'Orders',
      noOrders: 'You have no orders yet.',
      logout: 'Sign out',
      loginTitle: 'Sign in',
      loginSubtitle: 'Access your account, check your orders and save your details.',
      registerTitle: 'Create account',
      loginMetaTitle: 'Sign in | Dinero Sobre Problemas',
      registerMetaTitle: 'Create account | Dinero Sobre Problemas',
      registerSubtitle: 'Join the drop and save your favourites.',
      email: 'Email address',
      password: 'Password',
      confirmPassword: 'Confirm your password',
      name: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      birthDate: 'Date of birth',
      marketing: 'Send me news and drops.',
      acceptTerms: 'I accept the terms and the privacy policy.',
      enter: 'Sign in',
      create: 'Create account',
      forgot: 'Forgot your password?',
      noAccount: 'No account yet?',
      hasAccount: 'Already have an account?',
      goRegister: 'Sign up',
      goLogin: 'Sign in',
      continueGoogle: 'Continue with Google',
      or: 'or',
      joinLabel: 'Join',
      accountLabel: 'Account',
      registerIntro: 'Create your account to check out faster and follow your orders.',
      loginIntro: 'Sign in to see your orders and save your details.',
      emailPlaceholder: 'you@email.com',
      birthDateHint: 'Optional. Only for birthday promotions.',
      passwordPlaceholder: 'Your password',
      passwordNewPlaceholder: 'At least 8 characters',
      passwordHint: 'At least 8 characters. Use capitals, numbers or symbols.',
      confirmPasswordPlaceholder: 'Repeat your password',
      togglePassword: 'Show or hide password',
      andThe: 'and the',
      processing: 'Processing…',
      missingName: 'Enter your first and last name.',
      shortPassword: 'The password must be at least 8 characters.',
      passwordMismatch: 'The passwords do not match.',
      mustAccept: 'You must accept the terms and the privacy policy.',
      confirmEmail: 'Check your email to confirm your account.',
      invalidCredentials: 'Wrong email or password.',
      profileSection: 'My details',
      saveChanges: 'Save changes',
      saved: 'Saved ✓',
      myWishlist: 'My wishlist',
      myAddresses: 'My addresses',
      listLabel: 'List',
      wishlistTitle: 'Wishlist',
      wishlistMetaTitle: 'My wishlist | Dinero Sobre Problemas',
      wishlistEmptyTitle: 'Nothing saved yet',
      wishlistEmptyText: 'Tap the heart on any piece in the catalogue to save it here.',
      wishlistLoading: 'Loading wishlist…',
      chooseSize: 'Choose size',
    },

    // ---------------- About ----------------
    about: {
      metaTitle: 'About | Dinero Sobre Problemas',
      metaDescription:
        'Hand-pressed craft streetwear. Timeless pieces with a luxury edge. We do not follow trends, we create them.',
      label: 'Craft streetwear',
      headline1: 'From the ground to the sky,',
      headline2: 'afraid of nothing',
      intro:
        'We design garments with attention to detail, pressed by hand one at a time. Each piece reflects the balance between street style and craft quality — made for those who value authenticity over trends.',
      rootsLabel: 'Our roots',
      roots:
        'Rooted in Mexican culture, our brand creates hand-pressed garments that blend street style with a craft soul, reflecting authenticity, passion and pride in our roots while embracing the contemporary energy of streetwear.',
      pillars: [
        {
          title: 'Hand pressed',
          text: 'Every garment is personalised one by one. No mass production, no two identical pieces.',
        },
        {
          title: 'Limited editions',
          text: 'We produce by drop. Once it sells out, it is never made the same way again.',
        },
        {
          title: 'Made to order',
          text: 'We prepare your piece in 2–3 days after purchase and ship it right away.',
        },
      ],
      philosophyLabel: 'Our philosophy',
      quote1: 'Silence also',
      quote2: 'makes',
      quoteAccent: 'noise',
      philosophy:
        'Made for those who move in silence and keep their eyes on the legacy, not the spotlight. Because problems pass, but money and vision remain.',
      closingTitle: 'We do not follow trends, we create them',
      closingText: 'Find the reflective drop before it sells out.',
      closingCta: 'View catalogue',
    },

    // ---------------- Order confirmation ----------------
    order: {
      received: 'Order received',
      thanks: 'Thanks for your purchase',
      tracking: 'Tracking',
      pieces: 'Pieces',
      shippingSection: 'Shipping',
    },

    // ---------------- 404 ----------------
    notFound: {
      metaTitle: 'Page not found | Dinero Sobre Problemas',
      metaDescription: 'The page you are looking for does not exist.',
      label: 'Error 404',
      title: 'Lost',
      text: 'The page you are looking for does not exist or was moved. But good style is never lost.',
    },

    // ---------------- Content pages ----------------
    content: {
      contactMetaTitle: 'Contact | Dinero Sobre Problemas',
      contactMetaDescription: 'Write to us. We reply in under 24 hours.',
      returnsMetaTitle: 'Returns | Dinero Sobre Problemas',
      returnsMetaDescription: 'How to request an exchange or return.',
      shippingMetaTitle: 'Shipping | Dinero Sobre Problemas',
      shippingMetaDescription: 'Production times, shipping and coverage.',
      sizesMetaTitle: 'Size guide | Dinero Sobre Problemas',
      sizesMetaDescription: 'Measurements in centimetres to pick your right size.',
      privacyMetaTitle: 'Privacy | Dinero Sobre Problemas',
      privacyMetaDescription: 'How we handle your personal data.',
      termsMetaTitle: 'Terms | Dinero Sobre Problemas',
      termsMetaDescription: 'Purchase and site usage conditions.',
    },

    errors: {
      noSession: 'Sign in or create an account to complete your order.',
      badRequest: 'Check your contact and shipping details.',
      cardDeclined: 'The card was declined. Try another one.',
      unavailable: 'An item in your cart is no longer available.',
      paymentUnavailable: 'Card payment is not available right now.',
      paymentError: 'We could not start the payment. Try again in a moment.',
      storage: 'We could not save your cart. Try again.',
    },

    common: {
      loading: 'Loading…',
      error: 'Something went wrong. Try again.',
      retry: 'Retry',
      close: 'Close',
      save: 'Save',
      cancel: 'Cancel',
      back: 'Back',
      search: 'Search',
      itemOne: 'item',
      itemMany: 'items',
      piece: 'Piece',
      client: 'Customer',
    },
  },
} as const;

/** El español es la forma canónica; el inglés debe tener las mismas claves. */
export type Copy = typeof copy.es;

export function getCopy(lang: Lang | string | null | undefined): Copy {
  return copy[normalizeLang(lang)] as Copy;
}
