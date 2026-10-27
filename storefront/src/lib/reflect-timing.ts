/**
 * Timing compartido del carrusel y del reflejo.
 *
 * Es la **única** fuente de verdad: si el carrusel cambia de intervalo y el
 * reflejo no, ambos derivan y el encendido deja de caer con el cambio de
 * pieza. Antes había tres constantes sueltas (carousel.ts, reflect-anim.ts y
 * HeroCarousel.astro) que había que mantener a mano en sincronía.
 *
 * El ciclo del reflejo se **deriva** de aquí:
 *
 *   cuenta (2 ticks)   = 2000 ms
 *   + encendido        = 2500 ms
 *   ─────────────────────────────
 *   total              = 4500 ms = intervalo del carrusel
 *
 * Si `ROTATION_MS` cambia, `COUNT_STEP_MS` y `HOLD_MS` se recalculan solos.
 */

/** Cada cuánto el carrusel pasa a la siguiente pieza. */
export const ROTATION_MS = 4500;

/** Desde qué número arranca la cuenta ("Reflectivo en… 2"). */
export const COUNT_FROM = 2;

/** Cuánto dura la cuenta atrás completa. Ocupa el 44 % de la vuelta. */
const COUNT_SPAN_MS = Math.round(ROTATION_MS * 0.444);

/** Lo que se ve cada número. */
export const COUNT_STEP_MS = Math.round(COUNT_SPAN_MS / COUNT_FROM);

/** Cuánto se queda encendida la foto del reflejo (el resto de la vuelta). */
export const HOLD_MS = ROTATION_MS - COUNT_SPAN_MS;

/** Margen tras una interacción manual antes de retomar el ciclo. */
export const RESUME_MS = 6000;

/** Tiempo que dura el flash de brillo sobre la foto. */
export const FLASH_MS = 650;
