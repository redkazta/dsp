import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { labelBlockReason, quoteRates, type DhlPackage } from '../src/lib/dhl';

const pkg: DhlPackage = { weight: 1, length: 10, width: 8, height: 2 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('DHL /rates', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      DHL_API_KEY: 'test-key',
      DHL_API_SECRET: 'test-secret',
      DHL_ACCOUNT_NUMBER: '123456789',
      DHL_ORIGIN_ZIP: '90001',
      DHL_ORIGIN_CITY: 'Los Angeles',
      DHL_API_BASE_URL: 'https://example.test/mydhlapi/test',
    };
  });

  afterEach(() => {
    process.env = env;
    vi.restoreAllMocks();
  });

  it('cotiza una pieza con GET y usa la tarifa negociada (BILLC)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        products: [
          {
            productCode: 'P',
            productName: 'EXPRESS WORLDWIDE',
            deliveryCapabilities: { totalTransitDays: 2, estimatedDeliveryDateAndTime: '2026-11-10' },
            totalPrice: [
              { priceCurrency: 'USD', currencyType: 'LIST', price: 25 },
              { priceCurrency: 'USD', currencyType: 'BILLC', price: 18.4 },
            ],
          },
        ],
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await quoteRates({
      destinationZip: '10001',
      destinationCity: 'New York',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0]).toMatchObject({
      productCode: 'P',
      amount: 18.4,
      currency: 'USD',
      estimatedDays: 2,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(url).toContain('/rates?');
    expect(url).toContain('currencyCode=USD');
    expect(url).toContain('destinationPostalCode=10001');
    expect(url).toContain('isCustomsDeclarable=false');
  });

  it('usa POST cuando hay más de un paquete', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        products: [
          {
            productCode: 'P',
            productName: 'EXPRESS',
            totalPrice: [{ priceCurrency: 'USD', currencyType: 'BILLC', price: 30 }],
          },
        ],
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await quoteRates({
      destinationZip: '20001',
      destinationCity: 'Washington',
      packages: [pkg, pkg],
    });

    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(url.endsWith('/rates')).toBe(true);

    const body = JSON.parse(String(init.body));
    expect(body.packages).toHaveLength(2);
    expect(body.accounts[0]).toEqual({ typeCode: 'shipper', number: '123456789' });
  });

  it('cachea la misma combinación', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        products: [
          {
            productCode: 'P',
            productName: 'EXPRESS',
            totalPrice: [{ priceCurrency: 'USD', currencyType: 'BILLC', price: 20 }],
          },
        ],
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const input = { destinationZip: '30301', destinationCity: 'Atlanta', packages: [pkg] };

    await quoteRates(input);
    await quoteRates(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cae al fallback si DHL falla y no cachea el error', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: 'Rate limit' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    const input = { destinationZip: '60601', destinationCity: 'Chicago', packages: [pkg] };

    const first = await quoteRates(input);
    const second = await quoteRates(input);

    expect(first).toEqual({ ok: false, reason: 'upstream_error' });
    expect(second.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('descarta tarifas que no estén en USD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          products: [
            {
              productCode: 'P',
              productName: 'EXPRESS',
              totalPrice: [{ priceCurrency: 'MXN', currencyType: 'BILLC', price: 200 }],
            },
          ],
        })
      )
    );

    const result = await quoteRates({
      destinationZip: '33101',
      destinationCity: 'Miami',
      packages: [pkg],
    });

    expect(result).toEqual({ ok: false, reason: 'no_rates' });
  });

  it('valida el ZIP antes de llamar a DHL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await quoteRates({
      destinationZip: '1234',
      destinationCity: 'Nowhere',
      packages: [pkg],
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_zip' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('DHL /shipments — bloqueo por verificación', () => {
  it('permite generar solo con verified o corrected', () => {
    expect(labelBlockReason('verified')).toBeNull();
    expect(labelBlockReason('corrected')).toBeNull();
  });

  it('bloquea pending e invalid', () => {
    expect(labelBlockReason('pending')).toBe('pending');
    expect(labelBlockReason('invalid')).toBe('invalid');
    expect(labelBlockReason(null)).toBe('pending');
  });
});
