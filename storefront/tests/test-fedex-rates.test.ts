import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/pages/api/admin/test-fedex-rates';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rateReply(zip: string) {
  return {
    output: {
      rateReplyDetails: [
        {
          serviceType: 'FEDEX_GROUND',
          serviceName: 'FedEx Ground',
          commitmentDetails: { commitDate: '2026-11-10' },
          operationalDetail: { transitTime: '3' },
          ratedShipmentDetails: [
            { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 10 + Number(zip.slice(-2)) / 100 },
          ],
        },
      ],
    },
    warnings: [{ code: 'W001', message: `aviso para ${zip}` }],
  };
}

/** Token + respuesta de tarifas; 60601 falla a propósito. */
function mockFedex() {
  const fetchMock = vi.fn(async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith('/oauth/token')) return jsonResponse({ access_token: 'token-123' });

    const body = JSON.parse(String(init?.body ?? '{}'));
    const zip = body?.requestedShipment?.recipient?.address?.postalCode;

    if (zip === '60601') {
      return jsonResponse(
        { errors: [{ code: 'RATE.UNEXPECTED', message: 'FedEx rechazó Chicago' }] },
        500
      );
    }

    return jsonResponse(rateReply(String(zip)));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const call = async (locals: Record<string, unknown>) => {
  const res = await GET({ locals } as any);
  return { status: res.status, body: await res.json() };
};

describe('GET /api/admin/test-fedex-rates', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '76104',
      FEDEX_ORIGIN_CITY: 'Fort Worth',
      FEDEX_ORIGIN_STATE: 'TX',
      FEDEX_ORIGIN_COUNTRY: 'US',
      FEDEX_BASE_URL: 'https://fedex.test',
    };
  });

  afterEach(() => {
    process.env = env;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('responde 401 sin sesión', async () => {
    const res = await call({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('responde 403 con sesión que no es staff', async () => {
    const res = await call({ user: { id: 'u1' }, isStaff: false });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('responde 503 si FedEx no está configurado', async () => {
    process.env = { ...process.env, FEDEX_CLIENT_ID: '' };
    const res = await call({ user: { id: 'u1' }, isStaff: true });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'fedex_not_configured' });
  });

  it('devuelve los cinco ZIPs con servicio, precio y respuesta cruda', async () => {
    mockFedex();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await call({ user: { id: 'admin' }, isStaff: true });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(5);
    expect(res.body.origin).toEqual({
      zip: '76104',
      city: 'Fort Worth',
      state: 'TX',
      country: 'US',
    });

    const [newYork, , chicago] = res.body.results;

    expect(newYork).toMatchObject({
      zip: '10001',
      city: 'New York',
      state: 'NY',
      status: 'ok',
      priceUsd: 10.01,
      estimatedDays: 3,
    });
    expect(newYork.services[0]).toMatchObject({
      productCode: 'FEDEX_GROUND',
      currency: 'USD',
    });
    expect(newYork.warnings).toEqual([{ code: 'W001', message: 'aviso para 10001' }]);
    expect(newYork.raw.output.rateReplyDetails).toHaveLength(1);

    // FedEx falla solo en Chicago; los demás siguen cotizando.
    expect(chicago).toMatchObject({
      zip: '60601',
      status: 'error',
      error: 'FedEx rechazó Chicago',
    });
    expect(chicago.errors).toEqual([
      { code: 'RATE.UNEXPECTED', message: 'FedEx rechazó Chicago' },
    ]);
    expect(chicago.raw.errors[0].message).toBe('FedEx rechazó Chicago');

    expect(res.body.results.filter((r: any) => r.status === 'ok')).toHaveLength(4);
    expect(res.body.results.filter((r: any) => r.status === 'error')).toHaveLength(1);

    // La respuesta cruda no se loguea.
    expect(log).not.toHaveBeenCalled();
  });
});
