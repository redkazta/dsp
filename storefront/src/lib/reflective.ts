/**
 * Piezas reflectivas: qué fotos mostrar y cuál es la del reflejo.
 *
 * El atributo vive en la prenda (`products.is_reflective`), no en el nombre
 * del archivo. El `-flash` solo se usa para *elegir la foto* del reflejo
 * dentro de la galería; si algún día cambian los nombres, basta con ajustar
 * `isFlashUrl`.
 */

/** ¿La URL corresponde a una toma con el flash encendido? */
export function isFlashUrl(url: string | null | undefined): boolean {
  const file = String(url ?? '').toLowerCase();
  // `no_flash_front.jpg` es sin flash: se descarta antes de buscar "flash".
  return /flash/.test(file.replace(/no[_-]?flash/g, ''));
}

export interface ReflectImagePlan {
  /** Fotos a mostrar en orden (sin las que no aportan). */
  images: string[];
  /** Índice de la toma con reflejo, o -1 si no hay. */
  flashIndex: number;
  /** La pieza se puede animar (es reflectiva y tiene las dos tomas). */
  animatable: boolean;
}

/**
 * Ordena la galería y localiza la toma con flash.
 *
 * Para una pieza reflectiva se muestran exactamente dos fotos: la portada
 * (sin flash) y la del reflejo. Meter espalda o fotos repetidas hace que el
 * cambio automático pierda el efecto de "encendido".
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

  const front = plain[0] ?? flash[0];
  const images = [front, flash[0]];

  return { images, flashIndex: images.indexOf(flash[0]), animatable: images.length === 2 };
}
