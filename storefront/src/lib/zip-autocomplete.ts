/**
 * Autocompletado ZIP → ciudad/estado en el checkout (navegador).
 *
 * El ZIP se captura primero; al completar cinco dígitos (o al salir del campo)
 * se consulta `/api/zipcode-lookup` y se rellenan ciudad y estado. El resultado
 * nunca bloquea el formulario: si el ZIP no existe o la llamada falla, el
 * cliente escribe ciudad y estado a mano.
 *
 * El estado solo se preselecciona si existe en el `select` (catálogo
 * `us_regions` y `enabled_for_shipping`). Si el ZIP apunta a una región no
 * disponible, se avisa sin bloquear y se deja el select como estaba.
 */

export interface ZipLookupResult {
  city: string | null;
  state: string | null;
}

export interface ZipAutocompleteCallbacks {
  /** Endpoint de lookup. */
  lookupUrl?: string;
  /** Se dispara al empezar y al terminar la consulta (indicador de carga). */
  onLoading?: (loading: boolean) => void;
  /** El ZIP apunta a un estado que no se ofrece en el checkout. */
  onStateUnavailable?: (state: string) => void;
  /** El ZIP se encontró y se rellenaron los campos. */
  onFilled?: (result: ZipLookupResult) => void;
}

/** Consulta el endpoint. Devuelve `null` si la llamada falla o responde raro. */
export async function fetchZipLookup(
  zip: string,
  lookupUrl = '/api/zipcode-lookup'
): Promise<ZipLookupResult | null> {
  try {
    const res = await fetch(`${lookupUrl}?zip=${encodeURIComponent(zip)}`);
    if (!res.ok) return null;

    const data: any = await res.json();
    const city = typeof data?.city === 'string' && data.city.trim() ? data.city.trim() : null;
    const state = typeof data?.state === 'string' && data.state.trim() ? data.state.trim() : null;

    return { city, state };
  } catch {
    return null;
  }
}

/** Códigos de estado que el select ofrece (vacío = sin select). */
function selectableStates(select: HTMLSelectElement | null): Set<string> {
  if (!select) return new Set();
  return new Set(
    [...select.options]
      .map((o) => o.value.trim())
      .filter((value) => value.length > 0)
  );
}

/**
 * Conecta el campo ZIP con ciudad y estado.
 *
 * @returns Función para quitar los listeners (útil si el formulario se
 *          reemplaza sin recargar la página).
 */
export function wireZipAutocomplete(
  form: HTMLFormElement,
  callbacks: ZipAutocompleteCallbacks = {}
): () => void {
  const zipInput = form.elements.namedItem('postalCode') as HTMLInputElement | null;
  const cityInput = form.elements.namedItem('city') as HTMLInputElement | null;
  const stateSelect = form.elements.namedItem('state') as HTMLSelectElement | null;

  if (!zipInput) return () => {};

  const lookupUrl = callbacks.lookupUrl ?? '/api/zipcode-lookup';
  const states = selectableStates(stateSelect);

  let seq = 0;
  let lastZip = '';
  let loading = false;

  const setLoading = (next: boolean) => {
    if (loading === next) return;
    loading = next;
    callbacks.onLoading?.(next);
  };

  async function run(zip: string) {
    if (!/^\d{5}$/.test(zip) || zip === lastZip) return;
    lastZip = zip;

    const current = ++seq;
    setLoading(true);

    const result = await fetchZipLookup(zip, lookupUrl);

    // Llegó tarde: el cliente ya cambió el ZIP.
    if (current !== seq) return;
    setLoading(false);

    // ZIP desconocido o endpoint caído: no se toca nada y no se bloquea.
    if (!result || !result.city || !result.state) return;

    if (cityInput) {
      cityInput.value = result.city;
      cityInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (stateSelect && states.size > 0) {
      if (states.has(result.state)) {
        stateSelect.value = result.state;
        stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        callbacks.onStateUnavailable?.(result.state);
      }
    }

    callbacks.onFilled?.(result);
  }

  const onInput = () => {
    const raw = zipInput.value.trim();
    if (!raw) {
      // Al borrar el ZIP se permite volver a consultarlo.
      lastZip = '';
      return;
    }
    if (/^\d{5}$/.test(raw)) void run(raw);
  };

  const onBlur = () => {
    const raw = zipInput.value.trim();
    if (/^\d{5}(-\d{4})?$/.test(raw)) void run(raw.slice(0, 5));
  };

  zipInput.addEventListener('input', onInput);
  zipInput.addEventListener('blur', onBlur);

  return () => {
    zipInput.removeEventListener('input', onInput);
    zipInput.removeEventListener('blur', onBlur);
  };
}
