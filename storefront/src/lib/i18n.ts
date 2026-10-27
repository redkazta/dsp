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
    brandTagline: 'Streetwear artesanal prensado a mano, una pieza a la vez.',
    brandTagline2: 'Diseño callejero con energía de lujo.',
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
      reveal: 'Reflex',
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
      reflective: 'Reflectivo en:',
      normalPhase: 'Normal en:',
      notReflective: 'Sin reflejo',
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
      goCheckout: 'Ir al pago',
      openCart: 'Ver carrito',
      cartCta: 'Ver mi carrito',
      colorLabel: 'Color',
      piecesLeft: 'piezas',
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
      viewProduct: 'Ver producto',
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
      orderNotFound: 'No encontramos este pedido en tu cuenta. Verifica el número o revisa tus pedidos.',
      orderSignIn: 'Entra a tu cuenta para ver el detalle completo de tus pedidos.',
      paidApproved: 'Pago aprobado',
      paidPending: 'Pago en proceso',
      thankYou: 'Gracias',
      confirmingPayment: 'Estamos confirmando tu pago',
      customerFallback: 'cliente',
      free: 'Gratis',
      logout: 'Cerrar sesión',
      orderClosed: 'Este pedido se cerró como',
      orderProgress: 'Progreso del pedido',
      tracking: 'Guía',
      carrier: 'Paquetería',
      track: 'Rastrear',
      trackPackage: 'Rastrear paquete',
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
      passwordConfirm: 'Confirmar contraseña',
      passwordConfirmPlaceholder: 'Repite tu contraseña',
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
      alreadyRegistered:
        'Ese correo ya tiene cuenta. Entra con tu contraseña o usa Continuar con Google si te registraste así.',
      profileSection: 'Mis datos',
      saveChanges: 'Guardar cambios',
      saveError: 'No pudimos guardar tus datos. Revisa el nombre e intenta de nuevo.',
      googleNoCredential: 'Google no devolvió credenciales. Intenta de nuevo.',
      googleSignInFailed: 'No pudimos iniciar sesión con Google. Intenta de nuevo.',
      googleUnavailable: 'Google no está disponible en este navegador.',
      googleLoadFailed: 'No se pudo cargar Google. Revisa tu conexión.',
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
      recoverTitle: 'Recuperar contraseña',
      recoverMetaTitle: 'Recuperar contraseña | Dinero Sobre Problemas',
      recoverMetaDescription: 'Restablece el acceso a tu cuenta.',
      recoverIntro:
        'Escribe el correo con el que compraste y te enviamos un enlace para crear una nueva.',
      recoverSubmit: 'Enviar enlace',
      recoverSending: 'Enviando…',
      recoverNeedEmail: 'Escribe tu correo.',
      recoverNotFound: 'No encontramos una cuenta con ese correo.',
      recoverFailed: 'No pudimos enviar el enlace. Intenta de nuevo en un minuto.',
      recoverSent:
        'Si existe una cuenta con ese correo, recibirás el enlace en unos minutos.',
      backToLogin: 'Volver a iniciar sesión',
      newPasswordTitle: 'Nueva contraseña',
      newPasswordMetaTitle: 'Nueva contraseña | Dinero Sobre Problemas',
      newPasswordMetaDescription: 'Elige una contraseña nueva para tu cuenta.',
      newPasswordIntro: 'Elige una contraseña nueva para tu cuenta.',
      newPasswordSubmit: 'Guardar contraseña',
      newPasswordSaving: 'Guardando…',
      newPasswordTooShort: 'La contraseña debe tener al menos 8 caracteres.',
      newPasswordFailed:
        'No pudimos cambiar la contraseña. Pide un enlace nuevo.',
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

    // ---------------- Onboarding (primer acceso con Google) ----------------
    onboarding: {
      metaTitle: 'Completa tu cuenta | Dinero Sobre Problemas',
      metaDescription: 'Termina de configurar tu cuenta para agilizar tus compras.',
      label: 'Bienvenido',
      title: 'Completa tu cuenta',
      subtitle: 'Solo faltan estos datos para agilizar tus compras.',
      signedInAs: 'Entraste como',
      displayName: 'Nombre completo',
      save: 'Guardar y continuar',
      skip: 'Completar más tarde',
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

    // ---------------- Páginas legales e informativas ----------------
    legal: {
      help: 'Ayuda',
      legal: 'Legal',
      lastUpdated: 'Última actualización',
      updatedOn: '17 de octubre de 2026',
      viewCatalog: 'Ver catálogo',
      shipping: {
        title: 'Envíos',
        sections: [
          {
            title: 'Producción',
            p: [
              'Cada prenda se personaliza a mano después de tu compra. Por eso los pedidos salen de taller en 2 a 3 días hábiles posteriores a la confirmación del pago.',
            ],
          },
          {
            title: 'Tiempos de entrega',
            items: [
              'México: 3 a 7 días hábiles.',
              'Estados Unidos: 7 a 12 días hábiles.',
              'Los tiempos son estimados y pueden variar en temporada alta.',
            ],
          },
          {
            title: 'Costos',
            items: [
              'Gratis en pedidos superiores a $150 USD.',
              'Pedidos menores: el costo se calcula en el checkout.',
              'Envíos internacionales: costo calculado según destino y peso.',
            ],
          },
          {
            title: 'Seguimiento',
            p: [
              'Cuando tu pedido es despachado recibirás un correo con el número de guía para seguirlo con la paquetería.',
            ],
          },
          {
            title: 'Devoluciones',
            p: [
              'Consulta nuestras condiciones completas en los Términos y Condiciones.',
            ],
          },
        ],
      },
      returns: {
        title: 'Devoluciones',
        sections: [
          {
            title: 'Plazo',
            p: [
              'Tienes 30 días naturales desde la recepción para solicitar un cambio o devolución.',
            ],
          },
          {
            title: 'Requisitos',
            items: [
              'La prenda no debe haber sido usada, lavada ni alterada.',
              'Debe conservar etiquetas y empaque original.',
              'Adjunta tu número de pedido y fotos del artículo.',
            ],
          },
          {
            title: 'Cómo solicitarla',
            items: [
              'Escríbenos a hola@dinerosobreproblemas.com con el asunto «Devolución #pedido».',
              'Te confirmaremos si aplica y te daremos instrucciones de envío.',
              'Una vez recibida la pieza, procesamos el cambio o reembolso en 5 días hábiles.',
            ],
          },
          {
            title: 'Excepciones',
            p: [
              'Por tratarse de piezas personalizadas bajo pedido, los artículos marcados como «edición limitada» solo pueden devolverse por defecto de fabricación o por error en la talla enviada.',
            ],
          },
          {
            title: 'Garantía',
            p: [
              'Si tu prenda presenta un defecto de fabricación, contáctanos con fotos dentro de los 15 días posteriores a la entrega. Reponemos la pieza o reembolsamos el importe sin costo.',
            ],
          },
        ],
      },
      contact: {
        title: 'Hablemos',
        label: 'Contacto',
        name: 'Nombre',
        subject: 'Asunto',
        message: 'Mensaje',
        send: 'Enviar mensaje',
        opening: 'Abriendo tu cliente de correo…',
        emailLabel: 'Email',
        social: 'Redes',
        customTitle: 'Pedidos especiales',
        customText: 'Para jeans personalizados y piezas a medida, escríbenos por DM en Instagram con tu talla y diseño deseado.',
        responseTitle: 'Tiempo de respuesta',
        responseText: 'Menos de 24 horas hábiles.',
      },
      sizes: {
        title: 'Guía de tallas',
        intro: 'Medidas de la prenda extendida, en centímetros. El corte es relajado; si buscas un ajuste más holgado, sube una talla.',
        colSize: 'Talla',
        colChest: 'Pecho (cm)',
        colLength: 'Largo (cm)',
        howTitle: 'Cómo medirte',
        howChest: 'Pecho: mide alrededor de la parte más ancha del torso, con la cinta horizontal.',
        howLength: 'Largo: desde el hombro hasta el borde inferior de la prenda.',
        doubtsTitle: 'Dudas',
        doubtsText: 'Escríbenos o mándanos un mensaje por Instagram y te ayudamos a elegir.',
      },
      privacy: {
        title: 'Política de Privacidad',
        sections: [
          {
            title: '1. Quiénes somos',
            p: [
              'Dinero Sobre Problemas («DSP», «nosotros») opera la tienda en línea disponible en dspstorefront.vercel.app. Esta política explica qué datos personales recopilamos, con qué finalidad y cómo los protegemos.',
            ],
          },
          {
            title: '2. Datos que recopilamos',
            items: [
              'Datos de cuenta: nombre, correo electrónico, contraseña cifrada y, si inicias sesión con Google, tu nombre, correo y foto de perfil públicas de tu cuenta de Google.',
              'Datos de pedido: productos comprados, importe, dirección de envío, teléfono y correo de contacto.',
              'Datos de pago: procesados directamente por nuestro proveedor de pagos. Nunca almacenamos números de tarjeta.',
              'Datos técnicos: dirección IP, tipo de navegador y páginas visitadas, con fines de seguridad y mejora del servicio.',
            ],
          },
          {
            title: '3. Inicio de sesión con Google',
            p: [
              'Puedes crear una cuenta o iniciar sesión usando tu cuenta de Google (Google Sign-In). Al hacerlo, Google nos comparte únicamente tu correo principal, tu nombre público y foto de perfil, y un identificador único de tu cuenta.',
              'No solicitamos ni recibimos acceso a tu Gmail, contactos, calendario, Google Drive ni ningún otro dato de tu cuenta de Google. Los permisos solicitados se limitan a los alcances básicos de identidad (correo y perfil).',
              'Estos datos se usan exclusivamente para identificar tu cuenta y mostrarte tu nombre en la tienda. Puedes revocar el acceso en cualquier momento desde la configuración de tu cuenta de Google.',
            ],
          },
          {
            title: '4. Finalidad del tratamiento',
            items: [
              'Procesar y enviar tus pedidos.',
              'Enviarte confirmaciones y avisos de seguimiento.',
              'Atender solicitudes de soporte, devoluciones y garantías.',
              'Prevenir fraudes y cumplir obligaciones legales.',
              'Enviarte novedades de la marca, solo si lo autorizas expresamente.',
            ],
          },
          {
            title: '5. Con quién compartimos la información',
            items: [
              'Supabase — base de datos y autenticación.',
              'Stripe — procesamiento de pagos.',
              'Vercel / Render — infraestructura de hosting.',
              'Paqueterías — únicamente los datos necesarios para entregar tu pedido.',
            ],
          },
          {
            title: '6. Conservación',
            p: [
              'Conservamos los datos de tu cuenta mientras esté activa. Los datos de pedidos se conservan durante el plazo exigido por las obligaciones fiscales y contables aplicables.',
            ],
          },
          {
            title: '7. Tus derechos (ARCO)',
            p: [
              'Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos, así como su portabilidad, escribiendo a hola@dinerosobreproblemas.com. Responderemos en un plazo máximo de 20 días hábiles.',
            ],
          },
          {
            title: '8. Cookies',
            p: [
              'Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y el contenido de tu carrito. No utilizamos cookies publicitarias de terceros.',
            ],
          },
          {
            title: '9. Seguridad',
            p: [
              'Aplicamos cifrado en tránsito (HTTPS), contraseñas con hash y controles de acceso por fila en la base de datos, de modo que cada usuario solo puede consultar su propia información.',
            ],
          },
          {
            title: '10. Cambios a esta política',
            p: [
              'Podemos actualizar esta política. La versión vigente siempre estará publicada en esta página con su fecha de actualización.',
            ],
          },
        ],
      },
      terms: {
        title: 'Términos y Condiciones',
        sections: [
          {
            title: '1. Aceptación',
            p: [
              'Al comprar en dspstorefront.vercel.app aceptas estos términos. Si no estás de acuerdo, te pedimos no realizar compras.',
            ],
          },
          {
            title: '2. Productos',
            p: [
              'Nuestras prendas se personalizan a mano, una por una. Esto significa que:',
            ],
            items: [
              'Cada pieza es única; pueden existir variaciones mínimas en el acabado.',
              'Las fotografías son ilustrativas; el color puede variar ligeramente según la pantalla.',
              'Los productos se producen bajo pedido y en ediciones limitadas.',
            ],
          },
          {
            title: '3. Precios y pagos',
            p: [
              'Los precios se muestran en dólares estadounidenses (USD) e incluyen impuestos. El cobro se realiza a través de una pasarela de pago segura; no almacenamos datos de tarjetas. El pedido se confirma cuando el pago es aprobado.',
            ],
          },
          {
            title: '4. Producción y envíos',
            items: [
              'Tiempo de producción: 2 a 3 días hábiles después de confirmado el pago.',
              'Tiempo de envío: 3 a 7 días hábiles dentro de México. Envíos a Estados Unidos disponibles en el checkout.',
              'Envío gratis en pedidos superiores a $150 USD.',
              'Te enviaremos un número de guía por correo cuando tu pedido sea despachado.',
            ],
          },
          {
            title: '5. Devoluciones y cambios',
            p: [
              'Aceptamos devoluciones dentro de 30 días naturales posteriores a la recepción, siempre que:',
            ],
            items: [
              'La prenda no haya sido usada, lavada ni alterada.',
              'Conserve etiquetas y empaque original.',
              'Nos contactes previamente a hola@dinerosobreproblemas.com.',
            ],
            after: [
              'Por tratarse de piezas personalizadas, los artículos marcados como «edición limitada bajo pedido» solo pueden devolverse por defecto de fabricación o error en la talla enviada.',
            ],
          },
          {
            title: '6. Garantía por defecto',
            p: [
              'Si tu prenda presenta un defecto de fabricación, contáctanos con fotos del producto dentro de los 15 días posteriores a la entrega. Repondremos la pieza o reembolsaremos el importe sin costo adicional.',
            ],
          },
          {
            title: '7. Cuidado de las prendas',
            items: [
              'Lavar al revés con agua fría.',
              'No planchar directamente sobre el estampado o vinil.',
              'Secar al aire para conservar el diseño.',
              'Evitar el uso de secadora y blanqueadores.',
            ],
          },
          {
            title: '8. Cancelaciones',
            p: [
              'Puedes cancelar un pedido sin costo mientras no haya iniciado su producción. Una vez iniciada la personalización, la cancelación no aplica.',
            ],
          },
          {
            title: '9. Propiedad intelectual',
            p: [
              'El nombre, logotipo, diseños y fotografías de Dinero Sobre Problemas son propiedad de la marca. Queda prohibida su reproducción total o parcial sin autorización escrita.',
            ],
          },
          {
            title: '10. Contacto',
            p: [
              'Para cualquier duda sobre estos términos, escríbenos a hola@dinerosobreproblemas.com.',
            ],
          },
        ],
      },
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
      noResults: 'Sin resultados.',
      view: 'Ver',
      remove: 'Quitar',
      noSavedWish: 'Sin favoritos guardados.',
      noOrders: 'Aún no tienes pedidos.',
      viewDetail: 'Ver detalle',
      changePassword: 'Cambiar contraseña',
    },
  },

  en: {
    // La marca no se traduce: siempre en español.
    brand: 'Dinero Sobre Problemas',
    brandShort: 'DSP',
    brandTagline: 'Hand-pressed craft streetwear, one piece at a time.',
    brandTagline2: 'Street design with a luxury edge.',
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
      reveal: 'Reflex',
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
      reflective: 'Reflective in:',
      normalPhase: 'Normal in:',
      notReflective: 'No reflection',
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
      goCheckout: 'Go to checkout',
      openCart: 'View cart',
      cartCta: 'View my cart',
      colorLabel: 'Colour',
      piecesLeft: 'pieces',
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
      viewProduct: 'View product',
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
      orderNotFound: 'We could not find this order in your account. Check the number or review your orders.',
      orderSignIn: 'Sign in to your account to see the full details of your orders.',
      paidApproved: 'Payment approved',
      paidPending: 'Payment processing',
      thankYou: 'Thanks',
      confirmingPayment: 'We are confirming your payment',
      customerFallback: 'customer',
      free: 'Free',
      title: 'My account',
      metaTitle: 'My account | Dinero Sobre Problemas',
      orders: 'Orders',
      noOrders: 'You have no orders yet.',
      logout: 'Sign out',
      orderClosed: 'This order was closed as',
      orderProgress: 'Order progress',
      tracking: 'Tracking',
      carrier: 'Carrier',
      track: 'Track',
      trackPackage: 'Track package',
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
      passwordConfirm: 'Confirm password',
      passwordConfirmPlaceholder: 'Repeat your password',
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
      alreadyRegistered:
        'That email already has an account. Sign in with your password or use Continue with Google if that is how you signed up.',
      profileSection: 'My details',
      saveChanges: 'Save changes',
      saveError: 'We could not save your details. Check your name and try again.',
      googleNoCredential: 'Google did not return credentials. Try again.',
      googleSignInFailed: 'We could not sign you in with Google. Try again.',
      googleUnavailable: 'Google is not available in this browser.',
      googleLoadFailed: 'Google could not load. Check your connection.',
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
      recoverTitle: 'Reset password',
      recoverMetaTitle: 'Reset password | Dinero Sobre Problemas',
      recoverMetaDescription: 'Restore access to your account.',
      recoverIntro: 'Enter the email you used to buy and we will send you a link to set a new one.',
      recoverSubmit: 'Send link',
      recoverSending: 'Sending…',
      recoverNeedEmail: 'Enter your email.',
      recoverNotFound: 'We could not find an account with that email.',
      recoverFailed: 'We could not send the link. Try again in a minute.',
      recoverSent: 'If an account exists with that email, you will get the link within minutes.',
      backToLogin: 'Back to sign in',
      newPasswordTitle: 'New password',
      newPasswordMetaTitle: 'New password | Dinero Sobre Problemas',
      newPasswordMetaDescription: 'Choose a new password for your account.',
      newPasswordIntro: 'Choose a new password for your account.',
      newPasswordSubmit: 'Save password',
      newPasswordSaving: 'Saving…',
      newPasswordTooShort: 'The password must be at least 8 characters.',
      newPasswordFailed: 'We could not change the password. Request a new link.',
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

    // ---------------- Onboarding (first Google sign-in) ----------------
    onboarding: {
      metaTitle: 'Complete your account | Dinero Sobre Problemas',
      metaDescription: 'Finish setting up your account to speed up checkout.',
      label: 'Welcome',
      title: 'Complete your account',
      subtitle: 'Just these details to speed up your purchases.',
      signedInAs: 'You signed in as',
      displayName: 'Full name',
      save: 'Save and continue',
      skip: 'Complete later',
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

    // ---------------- Legal and informational pages ----------------
    legal: {
      help: 'Help',
      legal: 'Legal',
      lastUpdated: 'Last updated',
      updatedOn: 'October 17, 2026',
      viewCatalog: 'Browse the catalogue',
      shipping: {
        title: 'Shipping',
        sections: [
          {
            title: 'Production',
            p: [
              'Every garment is customised by hand after your purchase. That is why orders leave the workshop 2 to 3 business days after payment is confirmed.',
            ],
          },
          {
            title: 'Delivery times',
            items: [
              'Mexico: 3 to 7 business days.',
              'United States: 7 to 12 business days.',
              'Times are estimates and may vary during peak season.',
            ],
          },
          {
            title: 'Costs',
            items: [
              'Free on orders over $150 USD.',
              'Smaller orders: the cost is calculated at checkout.',
              'International shipping: cost calculated by destination and weight.',
            ],
          },
          {
            title: 'Tracking',
            p: [
              'Once your order ships you will receive an email with the tracking number so you can follow it with the carrier.',
            ],
          },
          {
            title: 'Returns',
            p: [
              'See the full conditions in our Terms and Conditions.',
            ],
          },
        ],
      },
      returns: {
        title: 'Returns',
        sections: [
          {
            title: 'Window',
            p: [
              'You have 30 calendar days from delivery to request an exchange or return.',
            ],
          },
          {
            title: 'Requirements',
            items: [
              'The garment must not have been worn, washed or altered.',
              'Tags and original packaging must be kept.',
              'Include your order number and photos of the item.',
            ],
          },
          {
            title: 'How to request it',
            items: [
              'Email hola@dinerosobreproblemas.com with the subject "Return #order".',
              'We will confirm whether it applies and send you shipping instructions.',
              'Once we receive the piece, we process the exchange or refund within 5 business days.',
            ],
          },
          {
            title: 'Exceptions',
            p: [
              'Because these are custom pieces made to order, items marked as "limited edition" can only be returned for a manufacturing defect or if the wrong size was shipped.',
            ],
          },
          {
            title: 'Warranty',
            p: [
              'If your garment has a manufacturing defect, contact us with photos within 15 days of delivery. We replace the piece or refund the amount at no cost.',
            ],
          },
        ],
      },
      contact: {
        title: "Let's talk",
        label: 'Contact',
        name: 'Name',
        subject: 'Subject',
        message: 'Message',
        send: 'Send message',
        opening: 'Opening your email client…',
        emailLabel: 'Email',
        social: 'Social',
        customTitle: 'Custom orders',
        customText: 'For custom jeans and made-to-measure pieces, send us a DM on Instagram with your size and the design you want.',
        responseTitle: 'Response time',
        responseText: 'Under 24 business hours.',
      },
      sizes: {
        title: 'Size guide',
        intro: 'Measurements of the garment laid flat, in centimetres. The cut is relaxed; if you want a looser fit, go up one size.',
        colSize: 'Size',
        colChest: 'Chest (cm)',
        colLength: 'Length (cm)',
        howTitle: 'How to measure yourself',
        howChest: 'Chest: measure around the widest part of your torso with the tape horizontal.',
        howLength: 'Length: from the shoulder to the bottom edge of the garment.',
        doubtsTitle: 'Questions',
        doubtsText: 'Email us or send us a message on Instagram and we will help you choose.',
      },
      privacy: {
        title: 'Privacy Policy',
        sections: [
          {
            title: '1. Who we are',
            p: [
              'Dinero Sobre Problemas ("DSP", "we") operates the online store available at dspstorefront.vercel.app. This policy explains what personal data we collect, for what purpose and how we protect it.',
            ],
          },
          {
            title: '2. Data we collect',
            items: [
              'Account data: name, email address, encrypted password and, if you sign in with Google, your public name, email and profile photo from your Google account.',
              'Order data: products purchased, amount, shipping address, phone and contact email.',
              'Payment data: processed directly by our payment provider. We never store card numbers.',
              'Technical data: IP address, browser type and pages visited, for security and service improvement.',
            ],
          },
          {
            title: '3. Signing in with Google',
            p: [
              'You can create an account or sign in using your Google account (Google Sign-In). When you do, Google shares only your primary email address, your public name and profile photo, and a unique identifier for your account.',
              'We do not request or receive access to your Gmail, contacts, calendar, Google Drive or any other Google account data. The requested permissions are limited to basic identity scopes (email and profile).',
              'This data is used solely to identify your account and show your name in the store. You can revoke access at any time from your Google account settings.',
            ],
          },
          {
            title: '4. Purpose of processing',
            items: [
              'To process and ship your orders.',
              'To send you confirmations and tracking notices.',
              'To handle support, return and warranty requests.',
              'To prevent fraud and comply with legal obligations.',
              'To send you brand news, only if you expressly allow it.',
            ],
          },
          {
            title: '5. Who we share information with',
            items: [
              'Supabase — database and authentication.',
              'Stripe — payment processing.',
              'Vercel / Render — hosting infrastructure.',
              'Carriers — only the data needed to deliver your order.',
            ],
          },
          {
            title: '6. Retention',
            p: [
              'We keep your account data while the account is active. Order data is kept for the period required by applicable tax and accounting obligations.',
            ],
          },
          {
            title: '7. Your rights (ARCO)',
            p: [
              'You can request access, rectification, cancellation or objection to the processing of your data, as well as its portability, by writing to hola@dinerosobreproblemas.com. We will reply within a maximum of 20 business days.',
            ],
          },
          {
            title: '8. Cookies',
            p: [
              'We use strictly necessary cookies to keep you signed in and to store your cart contents. We do not use third-party advertising cookies.',
            ],
          },
          {
            title: '9. Security',
            p: [
              'We apply encryption in transit (HTTPS), hashed passwords and row-level access controls in the database, so each user can only query their own information.',
            ],
          },
          {
            title: '10. Changes to this policy',
            p: [
              'We may update this policy. The current version will always be published on this page along with its update date.',
            ],
          },
        ],
      },
      terms: {
        title: 'Terms and Conditions',
        sections: [
          {
            title: '1. Acceptance',
            p: [
              'By purchasing at dspstorefront.vercel.app you accept these terms. If you do not agree, please do not place an order.',
            ],
          },
          {
            title: '2. Products',
            p: [
              'Our garments are customised by hand, one by one. This means:',
            ],
            items: [
              'Every piece is unique; minimal variations in the finish may exist.',
              'Photographs are illustrative; colour may vary slightly depending on your screen.',
              'Products are made to order and in limited editions.',
            ],
          },
          {
            title: '3. Prices and payments',
            p: [
              'Prices are shown in US dollars (USD) and include taxes. Payment is taken through a secure payment gateway; we do not store card data. Your order is confirmed when payment is approved.',
            ],
          },
          {
            title: '4. Production and shipping',
            items: [
              'Production time: 2 to 3 business days after payment is confirmed.',
              'Shipping time: 3 to 7 business days within Mexico. Shipping to the United States is available at checkout.',
              'Free shipping on orders over $150 USD.',
              'We will email you a tracking number once your order ships.',
            ],
          },
          {
            title: '5. Returns and exchanges',
            p: [
              'We accept returns within 30 calendar days of delivery, provided that:',
            ],
            items: [
              'The garment has not been worn, washed or altered.',
              'Tags and original packaging are kept.',
              'You contact us first at hola@dinerosobreproblemas.com.',
            ],
            after: [
              'Because these are custom pieces, items marked as "limited edition made to order" can only be returned for a manufacturing defect or if the wrong size was shipped.',
            ],
          },
          {
            title: '6. Warranty for defects',
            p: [
              'If your garment has a manufacturing defect, contact us with photos of the product within 15 days of delivery. We will replace the piece or refund the amount at no extra cost.',
            ],
          },
          {
            title: '7. Garment care',
            items: [
              'Wash inside out in cold water.',
              'Do not iron directly over the print or vinyl.',
              'Air dry to preserve the design.',
              'Avoid tumble drying and bleach.',
            ],
          },
          {
            title: '8. Cancellations',
            p: [
              'You can cancel an order at no cost as long as production has not started. Once customisation has begun, cancellation no longer applies.',
            ],
          },
          {
            title: '9. Intellectual property',
            p: [
              'The name, logo, designs and photographs of Dinero Sobre Problemas are the property of the brand. Total or partial reproduction without written permission is prohibited.',
            ],
          },
          {
            title: '10. Contact',
            p: [
              'For any questions about these terms, email hola@dinerosobreproblemas.com.',
            ],
          },
        ],
      },
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
      noResults: 'No results.',
      view: 'View',
      remove: 'Remove',
      noSavedWish: 'No saved favourites.',
      noOrders: 'You have no orders yet.',
      viewDetail: 'View details',
      changePassword: 'Change password',
    },
  },
} as const;

/** El español es la forma canónica; el inglés debe tener las mismas claves. */
export type Copy = typeof copy.es;

export function getCopy(lang: Lang | string | null | undefined): Copy {
  return copy[normalizeLang(lang)] as Copy;
}

/**
 * Nombre visible de una categoría.
 *
 * `categories.name` está en español en la base (es el nombre comercial del
 * producto), así que en inglés se traduce aquí por slug. Si no hay
 * traducción se devuelve el nombre original.
 */
const CATEGORY_LABELS: Record<string, { es: string; en: string }> = {
  camisas: { es: 'Camisas', en: 'Shirts' },
  playeras: { es: 'Playeras', en: 'Tees' },
  jeans: { es: 'Jeans', en: 'Jeans' },
};

export function categoryName(
  lang: Lang | string | null | undefined,
  category: { slug?: string | null; name?: string | null } | null | undefined
): string | null {
  if (!category) return null;

  const dict = category.slug ? CATEGORY_LABELS[category.slug] : undefined;
  if (dict) return dict[normalizeLang(lang)];

  return category.name ?? null;
}
