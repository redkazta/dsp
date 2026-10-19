/**
 * Variantes de producto listas para el navegador.
 *
 * La ficha serializa las variantes en `data-variants`. Esto las reduce a
 * lo que la UI necesita (id, talla, color, precio) para no arrastrar
 * columnas internas ni depender de campos extra.
 */

export interface VariantOption {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
}

export function sanitizeVariants(raw: unknown): VariantOption[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((v: any) => v && typeof v.id === 'string')
    .map((v: any) => ({
      id: String(v.id),
      name: String(v.name ?? ''),
      size: v.size ? String(v.size) : null,
      color: v.color ? String(v.color) : null,
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
    }));
}
