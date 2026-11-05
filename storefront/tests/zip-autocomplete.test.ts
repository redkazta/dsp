// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchZipLookup, wireZipAutocomplete } from '../src/lib/zip-autocomplete';

function mountForm() {
  document.body.innerHTML = `
    <form id="checkout-form">
      <input id="postalCode" name="postalCode" />
      <input id="city" name="city" />
      <select id="state" name="state">
        <option value="">Elige tu estado</option>
        <option value="TX">Texas</option>
        <option value="NY">New York</option>
        <option value="CA">California</option>
      </select>
    </form>`;

  return {
    form: document.getElementById('checkout-form') as HTMLFormElement,
    zip: document.getElementById('postalCode') as HTMLInputElement,
    city: document.getElementById('city') as HTMLInputElement,
    state: document.getElementById('state') as HTMLSelectElement,
  };
}

function stubLookup(handler: (zip: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: any) => {
    const url = new URL(String(input), 'https://store.test');
    return handler(url.searchParams.get('zip') ?? '');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('autocompletado ZIP → ciudad/estado', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('76104 autocompleta Fort Worth, TX', async () => {
    const { form, zip, city, state } = mountForm();
    stubLookup((zipCode) =>
      zipCode === '76104' ? json({ city: 'Fort Worth', state: 'TX' }) : json({ city: null, state: null })
    );

    wireZipAutocomplete(form);
    type(zip, '76104');

    await vi.waitFor(() => expect(city.value).toBe('Fort Worth'));
    expect(state.value).toBe('TX');
  });

  it('al cambiar a 10001 actualiza ciudad y estado', async () => {
    const { form, zip, city, state } = mountForm();
    stubLookup((zipCode) =>
      zipCode === '76104'
        ? json({ city: 'Fort Worth', state: 'TX' })
        : json({ city: 'New York', state: 'NY' })
    );

    wireZipAutocomplete(form);

    type(zip, '76104');
    await vi.waitFor(() => expect(city.value).toBe('Fort Worth'));

    type(zip, '10001');
    await vi.waitFor(() => expect(city.value).toBe('New York'));
    expect(state.value).toBe('NY');
  });

  it('el cliente puede editar ciudad y estado después del autocompletado', async () => {
    const { form, zip, city, state } = mountForm();
    stubLookup(() => json({ city: 'Fort Worth', state: 'TX' }));

    wireZipAutocomplete(form);
    type(zip, '76104');
    await vi.waitFor(() => expect(city.value).toBe('Fort Worth'));

    city.value = 'Mi ciudad';
    state.value = 'CA';

    expect(city.value).toBe('Mi ciudad');
    expect(state.value).toBe('CA');
  });

  it('si el endpoint falla, no autocompleta ni lanza', async () => {
    const { form, zip, city, state } = mountForm();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));

    const onLoading = vi.fn();
    wireZipAutocomplete(form, { onLoading });

    type(zip, '76104');
    await vi.waitFor(() => expect(onLoading).toHaveBeenLastCalledWith(false));

    expect(city.value).toBe('');
    expect(state.value).toBe('');
    expect(onLoading).toHaveBeenCalledWith(true);
  });

  it('un ZIP desconocido deja los campos vacíos', async () => {
    const { form, zip, city, state } = mountForm();
    stubLookup(() => json({ city: null, state: null }));

    wireZipAutocomplete(form);
    type(zip, '00000');

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(city.value).toBe('');
    expect(state.value).toBe('');
  });

  it('no preselecciona un estado fuera del catálogo y avisa', async () => {
    const { form, zip, city, state } = mountForm();
    stubLookup(() => json({ city: 'San Juan', state: 'PR' }));

    const onStateUnavailable = vi.fn();
    wireZipAutocomplete(form, { onStateUnavailable });
    type(zip, '00901');

    await vi.waitFor(() => expect(city.value).toBe('San Juan'));
    expect(state.value).toBe('');
    expect(onStateUnavailable).toHaveBeenCalledWith('PR');
  });

  it('al perder el foco consulta ZIP+4 con los cinco primeros dígitos', async () => {
    const { form, zip, city } = mountForm();
    const mock = stubLookup(() => json({ city: 'Fort Worth', state: 'TX' }));

    wireZipAutocomplete(form);
    zip.value = '76104-1234';
    zip.dispatchEvent(new Event('blur'));

    await vi.waitFor(() => expect(city.value).toBe('Fort Worth'));
    expect(String(mock.mock.calls[0][0])).toContain('zip=76104');
  });
});

describe('fetchZipLookup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve null cuando el endpoint responde error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'invalid_zip' }, 400)));
    await expect(fetchZipLookup('1234')).resolves.toBeNull();
  });

  it('devuelve null cuando la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    await expect(fetchZipLookup('76104')).resolves.toBeNull();
  });
});
