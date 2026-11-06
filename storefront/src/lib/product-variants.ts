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

/**
 * Variantes vivas: las borradas no se listan, no se ofrecen ni cuentan para
 * el stock en ninguna vista. El servidor trae ``*``, así que el filtro tiene
 * que aplicar aquí, no en la consulta.
 */
export function liveVariants(raw: unknown): any[] {
  return (Array.isArray(raw) ? raw : []).filter(
    (v: any) => v && typeof v === 'object' && v.is_deleted !== true
  );
}

export interface CardStockState {
  /** La consulta trajo la columna `stock` en al menos una variante. */
  stockKnown: boolean;
  totalStock: number;
  soldOut: boolean;
  /** Variantes comprables: con stock y no borradas. */
  available: any[];
}

/**
 * Estado de stock de una tarjeta de producto.
 *
 * Importante: **no** reutiliza `sanitizeVariants` porque esa función convierte
 * un `stock` ausente en 0, y aquí justo necesitamos distinguir "0" de "no 
 * preguntamos por el stock". Varios listados (carrito, favoritos) piden
 * `product_variants(price)` sin `stock`; asumir 0 pintaba un badge falso de
 * Agotado en toda la fila.
 */
export function cardStockState(raw: unknown): CardStockState {
  const list = liveVariants(raw);

  const stockOf = (v: any) => (Number.isFinite(Number(v.stock)) && v.stock !== null ? Number(v.stock) : 0);

  const stockKnown = list.some((v: any) => typeof v.stock === 'number' && Number.isFinite(v.stock));
  const totalStock = list.reduce((sum: number, v: any) => sum + stockOf(v), 0);
  const available = list.filter((v: any) => stockOf(v) > 0);

  return { stockKnown, totalStock, soldOut: stockKnown && totalStock === 0, available };
}
