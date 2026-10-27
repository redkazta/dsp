/**
 * Timing del ciclo del reflejo.
 *
 * **Un solo reloj** para todo: el badge es el cronómetro del carrusel.
 * Antes había tres intervalos sueltos (autoavance del carrusel, avance de
 * tandas del hero y cuenta del reflejo) que se peleaban entre sí.
 *
 *   Reflectivo en: 2      foto A
 *   Reflectivo en: 1      foto A
 *                ↓ cambia de foto
 *   Normal en: 2          foto B (con flash)
 *   Normal en: 1          foto B (con flash)
 *                ↓ cambia de foto
 *   …vuelve a empezar
 *
 * Cada fase dura `PHASE_MS`, así que la vuelta completa son 4 s y cada
 * número se ve 1 s.
 */

/** Cada cuánto baja el número (y por tanto cada cuánto se mueve todo). */
export const COUNT_STEP_MS = 1000;

/** Números de cada fase: "2 … 1". */
export const COUNT_FROM = 2;

/** Cuánto dura una fase completa. */
export const PHASE_MS = COUNT_STEP_MS * COUNT_FROM;

/** Vuelta completa: reflejo + normal. Es el intervalo del carrusel. */
export const ROTATION_MS = PHASE_MS * 2;

/** Margen tras una interacción manual antes de retomar el ciclo. */
export const RESUME_MS = 6000;

/** Duración del destello de brillo sobre la foto. */
export const FLASH_MS = 650;
