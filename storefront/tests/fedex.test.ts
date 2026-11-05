import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLabel,
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
  mock.mock.calls.filter(([url]: [string]) => String(url).includes('/rate/v1/rates/quotes'));

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
    });

    const [url, init] = rateCalls(mock)[0] as [string, RequestInit];
    expect(url).toBe('https://fedex.test/rate/v1/rates/quotes');
    expect(init.method).toBe('POST');
    expect((init.headers as any).Authorization).toBe('Bearer token-123');

    const body = JSON.parse(String(init.body));
    expect(body.accountNumber).toEqual({ value: '123456789' });
    expect(body.requestedShipment.preferredCurrency).toBe('USD');
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
      mock.mock.calls.filter(([url]: [string]) => String(url).endsWith('/oauth/token')).length
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

    const [url, init] = mock.mock.calls.find(([u]: [string]) =>
      String(u).includes('/ship/v1/shipments')
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
