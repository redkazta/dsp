/**
 * Reloj compartido entre el badge del reflejo y los carruseles.
 *
 * Antes cada uno tenía su propio `setInterval` y derivaban. Ahora existe
 * **una** variable de tiempo, `phase`, que:
 *
 *   - avanza sola cada `TICK_MS` (nadie tiene que empujarla),
 *   - la leen el badge y el carrusel cuando quieren,
 *   - y se puede **sincronizar** a mano (`sync()`), que es lo que permite
 *     reiniciar el ciclo al cambiar de página o al navegar a mano.
 *
 * El carrusel sigue siendo autónomo: escucha los latidos y decide qué hacer.
 */
import { ROTATION_MS } from './reflect-timing';

/** Cada cuánto late el reloj compartido (un número del badge). */
export const TICK_MS = 1000;

type Listener = (tick: number) => void;

const listeners = new Set<Listener>();

/** Latidos acumulados desde que cargó la página. */
let phase = 0;
let timer: number | undefined;

/** Cuántos latidos dura una vuelta completa (4 s → 4). */
export const TICKS_PER_ROTATION = Math.round(ROTATION_MS / TICK_MS);

export function currentTick(): number {
  return phase;
}

/** ¿Toca avanzar de pieza? Una vez por vuelta, no en cada latido. */
export function isRotationTick(tick: number): boolean {
  return tick > 0 && tick % TICKS_PER_ROTATION === 0;
}

/** Suscribe al latido. Devuelve la función para desuscribirse. */
export function onTick(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reinicia el reloj (nueva página, o el usuario navegó a mano). */
export function sync(): void {
  phase = 0;
  listeners.forEach((fn) => fn(phase));
}

function start() {
  if (timer !== undefined) return;
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  timer = window.setInterval(() => {
    if (document.hidden) return;
    phase += 1;
    listeners.forEach((fn) => fn(phase));
  }, TICK_MS);
}

start();
