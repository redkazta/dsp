/**
 * Textos de producto en dos idiomas.
 *
 * La base guarda el español en las columnas canónicas (`name`, `description`)
 * y el inglés en las columnas `*_en`. Si la traducción está vacía se cae al
 * español: **nunca se ve un hueco**.
 *
 * El nombre de la marca no se traduce; eso ya se resuelve en `i18n.ts`.
 */
import type { Lang } from './i18n';

type ProductTexts = {
  name?: string | null;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
};

/** Nombre visible de la pieza en el idioma activo. */
export function productName(product: ProductTexts | null | undefined, lang: Lang): string {
  const es = product?.name ?? '';
  if (lang !== 'en') return es;

  const en = product?.name_en?.trim();
  return en || es;
}

/** Descripción en el idioma activo, con respaldo al español. */
export function productDescription(
  product: ProductTexts | null | undefined,
  lang: Lang
): string {
  const es = product?.description ?? '';
  if (lang !== 'en') return es;

  const en = product?.description_en?.trim();
  return en || es;
}

/** ¿Falta la traducción al inglés? Lo usa el ERP para avisar. */
export function missingEnglish(product: ProductTexts | null | undefined) {
  return {
    name: !product?.name_en?.trim(),
    description: !product?.description_en?.trim(),
  };
}
