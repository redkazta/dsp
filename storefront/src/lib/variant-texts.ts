/**
 * Textos de variante en el idioma activo.
 *
 * La base guarda tallas y colores en español (Negro, Gris metálico,
 * Unitalla…). El cliente inglés no debe ver español a media compra, así que
 * la capa de presentación traduce esas etiquetas; el valor crudo sigue
 * viajando en `data-*` para encontrar la variante correcta.
 */
import type { Lang } from './i18n';

const COLORS_EN: Record<string, string> = {
  negro: 'Black',
  blanco: 'White',
  'gris metalico': 'Metallic grey',
  'gris metálico': 'Metallic grey',
  gris: 'Grey',
  morado: 'Purple',
  violeta: 'Violet',
  naranja: 'Orange',
  rojo: 'Red',
  rosa: 'Pink',
  azul: 'Blue',
  'azul acero': 'Steel blue',
  'azul marino': 'Navy blue',
  verde: 'Green',
  amarillo: 'Yellow',
  beige: 'Beige',
  cafe: 'Brown',
  café: 'Brown',
  marron: 'Brown',
  marrón: 'Brown',
  dorado: 'Gold',
  plateado: 'Silver',
  transparente: 'Clear',
};

const SIZES_EN: Record<string, string> = {
  unitalla: 'One size',
  unica: 'One size',
  única: 'One size',
  'talla unica': 'One size',
  'talla única': 'One size',
};

const normalize = (value: string) => value.trim().toLowerCase();

/** Color visible: "Negro" → "Black" en inglés. */
export function colorLabel(color: string | null | undefined, lang: Lang): string {
  const raw = (color ?? '').trim();
  if (!raw || lang !== 'en') return raw;
  return COLORS_EN[normalize(raw)] ?? raw;
}

/** Talla visible: "Unitalla" → "One size" en inglés. */
export function sizeLabel(size: string | null | undefined, lang: Lang): string {
  const raw = (size ?? '').trim();
  if (!raw || lang !== 'en') return raw;
  return SIZES_EN[normalize(raw)] ?? raw;
}

/**
 * "XL · Negro" → "XL · Black"; "Unitalla · Gris metálico" → "One size ·
 * Metallic grey". Si la variante no trae `name`, se arma con talla y color.
 */
export function variantLabel(
  variant:
    | { name?: string | null; size?: string | null; color?: string | null }
    | null
    | undefined,
  lang: Lang
): string {
  if (!variant) return '';

  const raw = (variant.name ?? '').trim();
  const fallback = [variant.size, variant.color].filter(Boolean).join(' · ');

  if (lang !== 'en') return raw || fallback;

  const parts = raw
    ? raw
        .split('·')
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  if (parts.length === 0) {
    return [sizeLabel(variant.size, lang), colorLabel(variant.color, lang)]
      .filter(Boolean)
      .join(' · ');
  }

  return parts
    .map((part) => SIZES_EN[normalize(part)] ?? COLORS_EN[normalize(part)] ?? part)
    .join(' · ');
}
