/**
 * Piezas reflectivas: galería ordenada y qué pares se alternan.
 *
 * Cada prenda puede tener dos vistas (frente y espalda) y cada vista dos
 * tomas (sin flash y con flash). El orden importa:
 *
 *   frente · frente-flash · espalda · espalda-flash
 *
 * Así el ciclo natural `0 → 1 → 2 → 3 → 0` recorre **cada vista con su
 * reflejo**: frente normal, frente encendido, espalda normal, espalda
 * encendida. Antes quedaban intercaladas (frente, frente-flash,
 * espalda-flash, espalda) y el ciclo solo alternaba las dos primeras.
 *
 * El atributo vive en la prenda (`products.is_reflective`); el nombre del
 * archivo solo se usa para reconocer la vista y el flash.
 */

/** ¿La URL corresponde a una toma con el flash encendido? */
export function isFlashUrl(url: string | null | undefined): boolean {
  const file = String(url ?? '').toLowerCase();
  // `no_flash_front.jpg` es sin flash: se descarta antes de buscar "flash".
  return /flash/.test(file.replace(/no[_-]?flash/g, ''));
}

/** ¿La URL es la espalda? */
export function isBackUrl(url: string | null | undefined): boolean {
  return /(back|espalda)/i.test(String(url ?? ''));
}

export interface ReflectImagePlan {
  /** Fotos en orden: vista normal seguida de su toma con flash. */
  images: string[];
  /** Índice de la primera toma con flash (el par que enciende el ciclo). */
  flashIndex: number;
  /** La pieza se puede animar (es reflectiva y tiene las dos tomas). */
  animatable: boolean;
}

/**
 * Ordena la galería agrupando **vista + su flash**.
 *
 *     […/01-frente, …/02-espalda, …/03-frente-flash, …/04-espalda-flash]
 *  →  […/01-frente, …/03-frente-flash, …/02-espalda, …/04-espalda-flash]
 *
 * Se conservan todas las fotos: antes se descartaba la espalda.
 */
export function planReflectImages(
  raw: Array<{ url: string; position?: number | null }> | null | undefined,
  isReflective: boolean
): ReflectImagePlan {
  const sorted = [...(raw ?? [])]
    .filter((img) => Boolean(img?.url))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const urls = [...new Set(sorted.map((img) => img.url))];

  if (!isReflective) {
    return { images: urls, flashIndex: urls.findIndex(isFlashUrl), animatable: false };
  }

  const plain = urls.filter((url) => !isFlashUrl(url));
  const flash = urls.filter(isFlashUrl);

  // Sin toma con flash no hay nada que encender.
  if (flash.length === 0) {
    return { images: urls, flashIndex: -1, animatable: false };
  }

  /*
   * Se agrupa por vista. El orden de las vistas sale del orden original de
   * las fotos "normales" (la portada primero), y cada vista arrastra su
   * toma con flash justo detrás.
   */
  const views = [...plain];

  // Una vista que solo existe con flash (raro) también entra.
  for (const url of flash) {
    const sameView = views.some(
      (plainUrl) => isBackUrl(plainUrl) === isBackUrl(url)
    );
    if (!sameView && !views.includes(url)) views.push(url);
  }

  const images: string[] = [];

  for (const view of views) {
    images.push(view);

    const itsFlash = flash.find(
      (url) => isBackUrl(url) === isBackUrl(view) && !images.includes(url)
    );
    if (itsFlash) images.push(itsFlash);
  }

  // Cualquier flash que no haya encontrado pareja, al final.
  for (const url of flash) {
    if (!images.includes(url)) images.push(url);
  }

  const flashIndex = images.findIndex(isFlashUrl);

  return { images, flashIndex, animatable: flashIndex > 0 };
}
