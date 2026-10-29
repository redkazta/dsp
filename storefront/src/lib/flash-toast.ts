/**
 * Aviso flotante global (toast tipo "sweet alert").
 *
 * Se usa para confirmar acciones sueltas: "Producto añadido al carrito",
 * "Producto guardado en favoritos", etc.
 *
 * - Aparece centrado en la pantalla, por encima de todo, y se va solo.
 * - Vive en `document.body` y se crea una sola vez por página.
 * - El texto llega ya traducido desde quien lo dispara (`copy[lang]`).
 * - No bloquea la página ni abre ningún panel: solo confirma.
 */

const HOST_ID = 'dsp-flash-toast';
const SHOW_MS = 2600;

type ToastTone = 'cart' | 'wish' | 'info';

let hideTimer: number | undefined;

function host(): HTMLElement {
  let el = document.getElementById(HOST_ID);
  if (el) return el;

  el = document.createElement('div');
  el.id = HOST_ID;
  el.className = 'dsp-flash';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  return el;
}

const ICONS: Record<ToastTone, string> = {
  cart: '<path d="M6 6h15l-1.7 8.5a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L6 4H3"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
  wish: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
};

/**
 * Muestra un aviso breve.
 * @param title   Mensaje principal, ya traducido.
 * @param options `detail` = nombre del producto, `tone` = icono.
 */
export function showFlashToast(
  title: string,
  options: { detail?: string | null; tone?: ToastTone } = {}
): void {
  if (typeof document === 'undefined' || !title) return;

  // El texto llega ya traducido, pero puede incluir nombres de producto:
  // se escapa antes de entrar en `innerHTML`.
  const esc = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const el = host();
  const tone = options.tone ?? 'info';
  const fill = tone === 'wish' ? 'currentColor' : 'none';

  el.dataset.tone = tone;
  el.innerHTML = `
    <span class="dsp-flash-icon" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[tone]}</svg>
    </span>
    <span class="dsp-flash-text">
      <strong>${esc(title)}</strong>
      ${options.detail ? `<span>${esc(options.detail)}</span>` : ''}
    </span>
  `;

  // Reinicia la animación si se dispara varias veces seguidas.
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => el.classList.remove('is-visible'), SHOW_MS);
}
