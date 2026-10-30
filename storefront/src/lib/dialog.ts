/**
 * Diálogos del sitio (confirmar / avisar).
 *
 * `window.confirm` y `window.alert` rompen el lenguaje visual: cajas grises
 * del sistema, sin marca y bloqueantes. Estos helpers pintan un modal propio,
 * accesible (rol dialog, Escape, foco devuelto) y devuelven una promesa.
 *
 * Los estilos viven en `styles/global.css` (`.dsp-dialog*`) porque el nodo se
 * crea en tiempo de ejecución.
 */

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** `null` = sin botón de cancelar (solo avisar). */
  cancelLabel?: string | null;
  tone?: 'default' | 'danger';
}

let dialogId = 0;

function openDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const id = `dsp-dialog-title-${++dialogId}`;

    const overlay = document.createElement('div');
    overlay.className = 'dsp-dialog-overlay';

    const panel = document.createElement('div');
    panel.className = 'dsp-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', id);

    const title = document.createElement('p');
    title.className = 'dsp-dialog-title';
    title.id = id;
    title.textContent = options.title;
    panel.appendChild(title);

    if (options.message) {
      const body = document.createElement('p');
      body.className = 'dsp-dialog-message';
      body.textContent = options.message;
      panel.appendChild(body);
    }

    const actions = document.createElement('div');
    actions.className = 'dsp-dialog-actions';

    let settled = false;

    const close = (value: boolean) => {
      if (settled) return;
      settled = true;

      document.removeEventListener('keydown', onKey);
      overlay.remove();
      previous?.focus?.();
      resolve(value);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    };

    let first: HTMLButtonElement | null = null;

    if (options.cancelLabel !== null) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-outline';
      cancel.textContent = options.cancelLabel ?? 'Cancelar';
      cancel.addEventListener('click', () => close(false));
      actions.appendChild(cancel);
      first = cancel;
    }

    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = `btn-gold${options.tone === 'danger' ? ' dsp-dialog-danger' : ''}`;
    accept.textContent = options.confirmLabel ?? 'Aceptar';
    accept.addEventListener('click', () => close(true));
    actions.appendChild(accept);

    first ??= accept;

    panel.appendChild(actions);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    first.focus();
  });
}

/** Pregunta sí/no. Resuelve `true` solo si se confirma. */
export function askConfirm(options: DialogOptions): Promise<boolean> {
  return openDialog(options);
}

/** Aviso con un único botón. */
export function notify(
  message: string,
  options: { title?: string; tone?: 'default' | 'danger' } = {}
): Promise<boolean> {
  return openDialog({
    title: options.title ?? (options.tone === 'danger' ? 'No se pudo completar' : 'Listo'),
    message,
    confirmLabel: 'Entendido',
    cancelLabel: null,
    tone: options.tone,
  });
}
