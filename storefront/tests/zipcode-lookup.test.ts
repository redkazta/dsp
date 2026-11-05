import { describe, expect, it } from 'vitest';
import { GET } from '../src/pages/api/zipcode-lookup';
import { ZIPCODE_COUNT, lookupZipcode, normalizeZip } from '../src/lib/zipcodes';

async function call(query: string) {
  const request = new Request(`https://store.test/api/zipcode-lookup${query}`);
  const res = await GET({ request } as any);
  return { status: res.status, body: await res.json() };
}

describe('catálogo local de ZIP codes', () => {
  it('carga el dataset completo en memoria', () => {
    expect(ZIPCODE_COUNT).toBeGreaterThan(40000);
    expect(lookupZipcode('76104')).toEqual({ city: 'Fort Worth', state: 'TX' });
    expect(lookupZipcode('10001')).toEqual({ city: 'New York', state: 'NY' });
  });

  it('normaliza ZIP+4 y rechaza formatos raros', () => {
    expect(normalizeZip('76104-1234')).toBe('76104');
    expect(normalizeZip(' 10001 ')).toBe('10001');
    expect(normalizeZip('7610')).toBe('');
    expect(normalizeZip('ABCDE')).toBe('');
    expect(lookupZipcode('00000')).toBeNull();
  });
});

describe('GET /api/zipcode-lookup', () => {
  it('76104 → Fort Worth, TX', async () => {
    await expect(call('?zip=76104')).resolves.toEqual({
      status: 200,
      body: { city: 'Fort Worth', state: 'TX' },
    });
  });

  it('10001 → New York, NY', async () => {
    await expect(call('?zip=10001')).resolves.toEqual({
      status: 200,
      body: { city: 'New York', state: 'NY' },
    });
  });

  it('ZIP inexistente → ciudad y estado null', async () => {
    await expect(call('?zip=00000')).resolves.toEqual({
      status: 200,
      body: { city: null, state: null },
    });
  });

  it('formato inválido → 400', async () => {
    for (const query of ['', '?zip=', '?zip=1234', '?zip=ABCDE', '?zip=76104-1234']) {
      const res = await call(query);
      expect(res.status, query).toBe(400);
      expect(res.body).toEqual({ error: 'invalid_zip' });
    }
  });
});
