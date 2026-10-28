/**
 * Feedback de validación en formularios y fichas de producto.
 *
 * Cuando el usuario pulsa un botón y le falta algo (talla, color, un campo
 * obligatorio), no basta con un texto de error: hay que **llevar la mirada**
 * al sitio. Este módulo hace eso:
 *
 *   1. sacude el campo que falta (`nudge`)
 *   2. le pone un anillo de error
 *   3. escribe el mensaje debajo, subrayado y con la sacudida (`alert`)
 *
 * Respeta `prefers-reduced-motion`: sin animación, pero con el anillo y el
 * texto, para que el aviso siga siendo inconfundible.
 */

const NUDGE_CLASS = 'dsp-nudge';
const INVALID_CLASS = 'dsp-invalid';
const ALERT_CLASS = 'dsp-alert';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * ¿Es un elemento del DOM? Sin navegador (SSR, tests) devuelve false en vez
 * de lanzar: `instanceof HTMLElement` explota si el constructor no existe.
 */
function isEl(el: unknown): el is HTMLElement {
  return typeof HTMLElement !== 'undefined' && el instanceof HTMLElement;
}

/** Quita una clase, fuerza reflow y la vuelve a poner (reinicia animación). */
function restart(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Sacude el elemento y lo marca como inválido.
 * `focus` lleva ahí el foco y lo trae a la vista.
 */
export function nudge(el: Element | null, options: { focus?: boolean } = {}) {
  if (!isEl(el)) return;

  restart(el, NUDGE_CLASS);
  el.classList.add(INVALID_CLASS);

  window.clearTimeout((el as any).__nudgeTimer);
  (el as any).__nudgeTimer = window.setTimeout(() => {
    el.classList.remove(NUDGE_CLASS);
    el.classList.remove(INVALID_CLASS);
  }, 1600);

  // El foco va al primer control: teclado y lectores de pantalla lo agradecen.
  const target =
    el.querySelector<HTMLElement>('button, [href], input, select, textarea') ?? el;

  if (options.focus !== false) {
    target.focus?.({ preventScroll: false });
    el.scrollIntoView?.({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

/** Sacude todos los botones de un grupo de opciones (tallas, colores…). */
export function nudgeGroup(selector: string) {
  const items = [...document.querySelectorAll(selector)];
  items.forEach((el, i) => {
    // Escalonado: se lee como un barrido, no como un temblor único.
    window.setTimeout(() => {
      restart(el as HTMLElement, NUDGE_CLASS);
      (el as HTMLElement).classList.add(INVALID_CLASS);
      window.setTimeout(() => {
        (el as HTMLElement).classList.remove(NUDGE_CLASS);
        (el as HTMLElement).classList.remove(INVALID_CLASS);
      }, 1200);
    }, i * 45);
  });
}

/**
 * Escribe un aviso bajo un botón y lo sacude.
 * Devuelve una función para ocultarlo.
 */
export function alert(el: Element | null, message: string, tone: 'error' | 'success' = 'error') {
  if (!isEl(el) || !message) return () => {};

  el.textContent = message;
  el.dataset.tone = tone;
  el.hidden = false;
  el.classList.remove('hidden');

  if (tone === 'error') {
    restart(el, ALERT_CLASS);
  }

  window.clearTimeout((el as any).__alertTimer);
  (el as any).__alertTimer = window.setTimeout(
    () => {
      el.classList.add('hidden');
      el.hidden = true;
    },
    tone === 'error' ? 4200 : 2600
  );

  return () => {
    el.classList.add('hidden');
    el.hidden = true;
  };
}

/**
 * Pone el botón en estado "trabajando": deshabilitado, con spinner y el
 * texto de progreso. Devuelve el texto original para restaurarlo.
 */
export function busy(btn: HTMLButtonElement | null, label: string): () => void {
  if (!btn) return () => {};

  const original = btn.innerHTML;
  const wasDisabled = btn.disabled;

  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `<span class="dsp-spinner" aria-hidden="true"></span><span>${label}</span>`;

  return () => {
    btn.innerHTML = original;
    btn.disabled = wasDisabled;
    btn.removeAttribute('aria-busy');
  };
}

/** Pulso verde/dorado de confirmación sobre un elemento. */
export function confirm(el: Element | null) {
  if (!isEl(el)) return;
  restart(el, 'dsp-confirmed');
  window.setTimeout(() => el.classList.remove('dsp-confirmed'), 900);
}
