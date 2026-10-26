import { describe, expect, it } from 'vitest';

/**
 * Replica la lógica de intercalado de `lib/home-products.ts` (la consulta a
 * Supabase no se puede simular sin red). Si cambia el algoritmo, este test
 * debe cambiar con él.
 */
function interleave<T extends { categoryId: string }>(
  products: T[],
  { perCategory = 8, max = 12 } = {}
): T[] {
  const buckets = new Map<string, T[]>();

  for (const p of products) {
    const bucket = buckets.get(p.categoryId) ?? [];
    if (bucket.length >= perCategory) continue;
    bucket.push(p);
    buckets.set(p.categoryId, bucket);
  }

  const queues = [...buckets.values()];
  const slides: T[] = [];
  let added = true;

  while (added && slides.length < max) {
    added = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        slides.push(next);
        added = true;
        if (slides.length >= max) break;
      }
    }
  }

  return slides;
}

const shirt = (id: number) => ({ id: `s${id}`, categoryId: 'camisas' });
const jeans = (id: number) => ({ id: `j${id}`, categoryId: 'jeans' });

describe('intercalado de la portada', () => {
  it('alterna playera, jean, playera, jean', () => {
    const result = interleave([
      shirt(1),
      shirt(2),
      shirt(3),
      jeans(1),
      jeans(2),
      shirt(4),
    ]);

    expect(result.map((p) => p.categoryId)).toEqual([
      'camisas',
      'jeans',
      'camisas',
      'jeans',
      'camisas',
      'camisas',
    ]);
  });

  it('nunca pone dos piezas de la misma categoría seguidas mientras haya de otra', () => {
    const result = interleave([shirt(1), shirt(2), jeans(1), jeans(2)]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].categoryId).not.toBe(result[i - 1].categoryId);
    }
  });

  it('respeta el máximo total y el cupo por categoría', () => {
    const many = [...Array.from({ length: 20 }, (_, i) => shirt(i)), ...Array.from({ length: 20 }, (_, i) => jeans(i))];

    expect(interleave(many, { max: 6 })).toHaveLength(6);
    expect(
      interleave(many, { perCategory: 2, max: 100 }).filter((p) => p.categoryId === 'camisas')
    ).toHaveLength(2);
  });

  it('funciona con una sola categoría y con lista vacía', () => {
    expect(interleave([shirt(1), shirt(2)]).map((p) => p.id)).toEqual(['s1', 's2']);
    expect(interleave([])).toEqual([]);
  });

  it('mantiene el orden de recencia dentro de cada categoría', () => {
    const result = interleave([shirt(3), shirt(2), jeans(9), shirt(1)]);
    expect(result.filter((p) => p.categoryId === 'camisas').map((p) => p.id)).toEqual([
      's3',
      's2',
      's1',
    ]);
  });
});
