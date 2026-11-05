import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLabel,
  fallbackTransitDays,
  fedexConfig,
  isFedexConfigured,
  labelBlockReason,
  quoteRates,
  type FedexPackage,
} from '../src/lib/fedex';

const pkg: FedexPackage = { weight: 1, length: 10, width: 8, height: 2 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Responde el token y delega el resto al handler. */
function mockFedex(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (input: any, init: any) => {
    const url = String(input);
    if (url.endsWith('/oauth/token')) return jsonResponse({ access_token: 'token-123' });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const rateCalls = (mock: any) =>
  mock.mock.calls.filter((call: any[]) => String(call[0]).includes('/rate/v1/rates/quotes'));

describe('FedEx /rate/v1/rates/quotes', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '90001',
      FEDEX_ORIGIN_CITY: 'Los Angeles',
      FEDEX_ORIGIN_STATE: 'CA',
      FEDEX_BASE_URL: 'https://fedex.test',
    };
  });

  afterEach(() => {
    process.env = env;
    vi.restoreAllMocks();
  });

  it('cotiza en USD y descarta servicios internacionales', async () => {
    const mock = mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_GROUND',
              serviceName: 'FedEx Ground',
              commitmentDetails: { commitDate: '2026-11-10' },
              operationalDetail: { transitTime: '3' },
              ratedShipmentDetails: [
                { rateType: 'LIST', currency: 'USD', totalNetCharge: 22.5 },
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 18.4 },
              ],
            },
            {
              serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
              serviceName: 'International Priority',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 60 },
              ],
            },
          ],
        },
      })
    );

    const result = await quoteRates({
      destinationZip: '10001',
      destinationCity: 'New York',
      destinationState: 'NY',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      productCode: 'FEDEX_GROUND',
      amount: 18.4,
      currency: 'USD',
      deliveryDate: '2026-11-10',
      estimatedDays: 3,
      estimated: false,
    });

    const [url, init] = rateCalls(mock)[0] as [string, RequestInit];
    expect(url).toBe('https://fedex.test/rate/v1/rates/quotes');
    expect(init.method).toBe('POST');
    expect((init.headers as any).Authorization).toBe('Bearer token-123');

    const body = JSON.parse(String(init.body));
    expect(body.accountNumber).toEqual({ value: '123456789' });
    expect(body.requestedShipment.preferredCurrency).toBe('USD');
    expect(body.requestedShipment.returnTransitAndCommit).toBe(true);
    expect(body.requestedShipment.packageCount).toBe(1);
    expect(body.requestedShipment.recipient.address.postalCode).toBe('10001');
    expect(body.requestedShipment.shipper.address.countryCode).toBe('US');
  });

  it('cachea la misma combinación y pide el token una sola vez', async () => {
    const mock = mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_GROUND',
              serviceName: 'FedEx Ground',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 20 },
              ],
            },
          ],
        },
      })
    );

    const input = { destinationZip: '30301', destinationCity: 'Atlanta', packages: [pkg] };

    await quoteRates(input);
    await quoteRates(input);

    expect(rateCalls(mock)).toHaveLength(1);
    expect(
      mock.mock.calls.filter((call: any[]) => String(call[0]).endsWith('/oauth/token')).length
    ).toBeLessThanOrEqual(1);
  });

  it('cae al fallback si FedEx falla y no cachea el error', async () => {
    const mock = mockFedex(() => jsonResponse({ errors: [{ message: 'Rate limit' }] }, 500));

    const input = { destinationZip: '60601', destinationCity: 'Chicago', packages: [pkg] };

    const first = await quoteRates(input);
    const second = await quoteRates(input);

    expect(first).toEqual({ ok: false, reason: 'upstream_error' });
    expect(second.ok).toBe(false);
    expect(rateCalls(mock)).toHaveLength(2);
  });

  it('lee tránsito desde commitDetails cuando falta operationalDetail', async () => {
    mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_2_DAY',
              serviceName: 'FedEx 2Day',
              commitDetails: { commitDate: '2026-11-08', transitDays: '2' },
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 24 },
              ],
            },
          ],
        },
      })
    );

    const result = await quoteRates({
      destinationZip: '98101',
      destinationCity: 'Seattle',
      destinationState: 'WA',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0]).toMatchObject({
      productCode: 'FEDEX_2_DAY',
      estimatedDays: 2,
      deliveryDate: '2026-11-08',
      estimated: false,
    });
  });

  it('usa los días de respaldo y marca estimated cuando FedEx no da compromiso', async () => {
    mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FIRST_OVERNIGHT',
              serviceName: 'FedEx First Overnight',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 160 },
              ],
            },
            {
              serviceType: 'FEDEX_2_DAY_AM',
              serviceName: 'FedEx 2Day AM',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 70 },
              ],
            },
            {
              serviceType: 'FEDEX_EXPRESS_SAVER',
              serviceName: 'FedEx Express Saver',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 55 },
              ],
            },
          ],
        },
      })
    );

    const result = await quoteRates({
      destinationZip: '84101',
      destinationCity: 'Salt Lake City',
      destinationState: 'UT',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byCode = Object.fromEntries(result.data.map((o) => [o.productCode, o]));

    expect(byCode.FIRST_OVERNIGHT).toMatchObject({
      estimatedDays: 1,
      deliveryDate: null,
      estimated: true,
    });
    expect(byCode.FEDEX_2_DAY_AM).toMatchObject({ estimatedDays: 2, estimated: true });
    expect(byCode.FEDEX_EXPRESS_SAVER).toMatchObject({ estimatedDays: 3, estimated: true });
  });

  it('deja el ETA en null si el servicio no tiene respaldo conocido', async () => {
    mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_HOME_DELIVERY_CUSTOM',
              serviceName: 'FedEx Custom',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 30 },
              ],
            },
          ],
        },
      })
    );

    const result = await quoteRates({
      destinationZip: '89101',
      destinationCity: 'Las Vegas',
      destinationState: 'NV',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0]).toMatchObject({ estimatedDays: null, estimated: false });
  });

  it('fallbackTransitDays cubre los servicios domésticos del selector', () => {
    expect(fallbackTransitDays('FIRST_OVERNIGHT')).toBe(1);
    expect(fallbackTransitDays('PRIORITY_OVERNIGHT')).toBe(1);
    expect(fallbackTransitDays('STANDARD_OVERNIGHT')).toBe(1);
    expect(fallbackTransitDays('FEDEX_2_DAY_AM')).toBe(2);
    expect(fallbackTransitDays('FEDEX_2_DAY')).toBe(2);
    expect(fallbackTransitDays('FEDEX_EXPRESS_SAVER')).toBe(3);
    expect(fallbackTransitDays('fedex_ground')).toBe(5);
    expect(fallbackTransitDays('UNKNOWN')).toBeNull();
  });

  it('reintenta una vez si FedEx rechaza el token (401)', async () => {
    let rateAttempts = 0;

    const mock = mockFedex((url) => {
      if (!url.includes('/rate/v1/rates/quotes')) return jsonResponse({}, 404);
      rateAttempts += 1;

      if (rateAttempts === 1) {
        return jsonResponse({ errors: [{ message: 'Token expired' }] }, 401);
      }

      return jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_GROUND',
              serviceName: 'FedEx Ground',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 19.5 },
              ],
            },
          ],
        },
      });
    });

    const result = await quoteRates({
      destinationZip: '80201',
      destinationCity: 'Denver',
      destinationState: 'CO',
      packages: [pkg],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({ productCode: 'FEDEX_GROUND', amount: 19.5 });
    expect(rateCalls(mock)).toHaveLength(2);
  });

  it('descarta tarifas que no estén en USD', async () => {
    mockFedex(() =>
      jsonResponse({
        output: {
          rateReplyDetails: [
            {
              serviceType: 'FEDEX_GROUND',
              serviceName: 'FedEx Ground',
              ratedShipmentDetails: [
                { rateType: 'ACCOUNT', currency: 'MXN', totalNetCharge: 200 },
              ],
            },
          ],
        },
      })
    );

    const result = await quoteRates({
      destinationZip: '33101',
      destinationCity: 'Miami',
      packages: [pkg],
    });

    expect(result).toEqual({ ok: false, reason: 'no_rates' });
  });

  it('valida el ZIP antes de llamar a FedEx', async () => {
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

describe('FedEx /ship/v1/shipments — bloqueo por verificación', () => {
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

describe('FedEx /ship/v1/shipments — guía', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '90001',
      FEDEX_ORIGIN_CITY: 'Los Angeles',
      FEDEX_ORIGIN_STATE: 'CA',
      FEDEX_ORIGIN_ADDRESS: '123 Main St',
      FEDEX_ORIGIN_PHONE: '+13105550000',
      FEDEX_BASE_URL: 'https://fedex.test',
    };
  });

  afterEach(() => {
    process.env = env;
    vi.restoreAllMocks();
  });

  it('devuelve tracking y el PDF en base64', async () => {
    const mock = mockFedex(() =>
      jsonResponse({
        output: {
          transactionShipments: [
            {
              masterTrackingNumber: '794800000001',
              pieceResponses: [
                {
                  trackingNumber: '794800000001',
                  packageDocuments: [
                    {
                      docType: 'LABEL',
                      contentType: 'PDF',
                      content: 'JVBERi0xLjQK',
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    );

    const result = await createLabel({
      orderNumber: 'DSP-001',
      destination: {
        name: 'Jane Doe',
        line1: '1 Infinite Loop',
        city: 'Cupertino',
        state: 'CA',
        zip: '95014',
        phone: '+14085550000',
      },
      packages: [pkg],
      productCode: 'FEDEX_GROUND',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.trackingNumber).toBe('794800000001');
    expect(result.data.documents[0]).toMatchObject({
      imageFormat: 'PDF',
      content: 'JVBERi0xLjQK',
    });

    const [url, init] = mock.mock.calls.find((call: any[]) =>
      String(call[0]).includes('/ship/v1/shipments')
    ) as [string, RequestInit];
    expect(url).toBe('https://fedex.test/ship/v1/shipments');

    const body = JSON.parse(String(init.body));
    expect(body.labelResponseOptions).toBe('LABEL');
    expect(body.requestedShipment.serviceType).toBe('FEDEX_GROUND');
    expect(body.requestedShipment.labelSpecification.imageType).toBe('PDF');
    expect(body.requestedShipment.shippingChargesPayment.paymentType).toBe('SENDER');
    expect(body.requestedShipment.recipients[0].address.postalCode).toBe('95014');
  });

  it('marca address_rejected cuando FedEx rechaza la dirección', async () => {
    mockFedex(() =>
      jsonResponse({ errors: [{ message: 'Invalid recipient postal code' }] }, 400)
    );

    const result = await createLabel({
      orderNumber: 'DSP-002',
      destination: {
        name: 'Jane Doe',
        line1: 'Bogus 1',
        city: 'Nowhere',
        state: 'CA',
        zip: '00000',
      },
      packages: [pkg],
      productCode: 'FEDEX_GROUND',
    });

    expect(result).toEqual({ ok: false, reason: 'address_rejected' });
  });
});

describe('FedEx origen (bodega)', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
    vi.restoreAllMocks();
  });

  it('exige ciudad y estado cuando hay FEDEX_ORIGIN_ZIP', async () => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '76104',
    };

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(isFedexConfigured()).toBe(false);
    expect(fedexConfig()).toBeNull();

    const result = await quoteRates({
      destinationZip: '10001',
      destinationCity: 'New York',
      packages: [pkg],
    });

    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa Fort Worth, TX como shipper', () => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '76104',
      FEDEX_ORIGIN_CITY: 'Fort Worth',
      FEDEX_ORIGIN_STATE: 'TX',
      FEDEX_ORIGIN_COUNTRY: 'US',
    };

    expect(fedexConfig()).toMatchObject({
      originZip: '76104',
      originCity: 'Fort Worth',
      originState: 'TX',
      originCountry: 'US',
    });
  });

  it('rechaza un país distinto de US y un ZIP inválido', () => {
    process.env = {
      ...env,
      FEDEX_CLIENT_ID: 'client-id',
      FEDEX_CLIENT_SECRET: 'client-secret',
      FEDEX_ACCOUNT_NUMBER: '123456789',
      FEDEX_ORIGIN_ZIP: '76104',
      FEDEX_ORIGIN_CITY: 'Fort Worth',
      FEDEX_ORIGIN_STATE: 'TX',
      FEDEX_ORIGIN_COUNTRY: 'MX',
    };

    expect(fedexConfig()).toBeNull();

    process.env = {
      ...process.env,
      FEDEX_ORIGIN_COUNTRY: 'US',
      FEDEX_ORIGIN_ZIP: '7610',
    };

    expect(fedexConfig()).toBeNull();
  });
});
