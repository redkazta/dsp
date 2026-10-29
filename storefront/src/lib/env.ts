/**
 * Lectura de variables de entorno del servidor.
 *
 * `import.meta.env.X` se resuelve en tiempo de BUILD: si la variable no
 * existía al compilar, queda grabada como `undefined` y el runtime nunca la
 * ve. Vercel, en cambio, inyecta las variables en `process.env` al ejecutar
 * la función. Por eso aquí se prioriza `process.env` y `import.meta.env`
 * queda solo como respaldo (útil en `astro dev`, que sí las carga del .env).
 */

const runtime = (): Record<string, string | undefined> => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env ?? {};
};

/** Variable de servidor: runtime primero, build como respaldo. */
export function serverEnv(name: string): string | undefined {
  const live = runtime()[name];
  if (typeof live === 'string' && live.length > 0) return live;

  const baked = (import.meta.env as Record<string, unknown>)[name];
  return typeof baked === 'string' && baked.length > 0 ? baked : undefined;
}
