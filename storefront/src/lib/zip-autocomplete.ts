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
  /** El ZIP no existe (o el endpoint falló) y se limpiaron los campos automáticos. */
  onNotFound?: (zip: string) => void;
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
  // Marca lo que rellenó el lookup para no borrar lo que el cliente escribió.
  let cityFromZip = false;
  let stateFromZip = false;
  // Evita que nuestros propios eventos marquen los campos como "manuales".
  let writing = false;

  const setLoading = (next: boolean) => {
    if (loading === next) return;
    loading = next;
    callbacks.onLoading?.(next);
  };

  const notify = (target: HTMLElement | null, event: 'input' | 'change') => {
    target?.dispatchEvent(new Event(event, { bubbles: true }));
  };

  /** Deshace solo lo autocompletado; lo escrito a mano se respeta. */
  function clearAutoFilled() {
    writing = true;
    try {
      if (cityFromZip && cityInput && cityInput.value) {
        cityInput.value = '';
        notify(cityInput, 'input');
      }
      if (stateFromZip && stateSelect && stateSelect.value) {
        stateSelect.value = '';
        notify(stateSelect, 'change');
      }
    } finally {
      writing = false;
    }
    cityFromZip = false;
    stateFromZip = false;
  }

  async function run(zip: string) {
    if (!/^\d{5}$/.test(zip) || zip === lastZip) return;
    lastZip = zip;

    const current = ++seq;
    setLoading(true);

    const result = await fetchZipLookup(zip, lookupUrl);

    // Llegó tarde: el cliente ya cambió el ZIP.
    if (current !== seq) return;
    setLoading(false);

    // ZIP desconocido o endpoint caído: se limpia lo autocompletado para no
    // cotizar con un destino que ya no corresponde. Nunca se bloquea.
    if (!result || !result.city || !result.state) {
      clearAutoFilled();
      callbacks.onNotFound?.(zip);
      return;
    }

    writing = true;
    try {
      if (cityInput) {
        cityInput.value = result.city;
        notify(cityInput, 'input');
        cityFromZip = true;
      }

      if (stateSelect && states.size > 0) {
        if (states.has(result.state)) {
          stateSelect.value = result.state;
          notify(stateSelect, 'change');
          stateFromZip = true;
        } else {
          callbacks.onStateUnavailable?.(result.state);
        }
      }
    } finally {
      writing = false;
    }

    callbacks.onFilled?.(result);
  }

  // Si el cliente corrige ciudad/estado a mano, dejan de ser "del ZIP".
  const onCityEdit = () => {
    if (!writing) cityFromZip = false;
  };
  const onStateEdit = () => {
    if (!writing) stateFromZip = false;
  };
  cityInput?.addEventListener('input', onCityEdit);
  stateSelect?.addEventListener('change', onStateEdit);

  const onInput = () => {
    const raw = zipInput.value.trim();
    if (!raw) {
      // Al borrar el ZIP se permite volver a consultarlo y se limpia lo auto.
      lastZip = '';
      clearAutoFilled();
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
    cityInput?.removeEventListener('input', onCityEdit);
    stateSelect?.removeEventListener('change', onStateEdit);
  };
}
