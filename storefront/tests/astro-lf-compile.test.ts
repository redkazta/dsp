import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { transform } from '@astrojs/compiler';
import * as esbuild from 'esbuild';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (full.endsWith('.astro')) acc.push(full);
  }
  return acc;
}

/**
 * Vercel clona con saltos de línea LF; en Windows el árbol de trabajo suele
 * tener CRLF. El compilador de Astro genera código distinto según el salto y
 * con LF podía truncar una línea cuando el frontmatter tenía un `import`
 * después de código (`const canceled = Astr` … `';`), que esbuild Reportaba
 * como "Unterminated string literal".
 *
 * Esta prueba compila cada `.astro` con LF y exige que esbuild lo parsee.
 */
describe('compilación con LF (el entorno de Vercel)', () => {
  it('no trunca ninguna página ni componente', async () => {
    const failures: string[] = [];

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

      let code: string;
      try {
        code = (await transform(source, { sourcemap: 'both', filename: rel })).code;
      } catch (error) {
        failures.push(`${rel}: compilación — ${(error as Error).message}`);
        continue;
      }

      try {
        await esbuild.transform(code, { loader: 'ts', jsx: 'automatic' });
      } catch (error) {
        const first = (error as { errors?: Array<{ text?: string; location?: { line?: number; column?: number } }> })
          .errors?.[0];
        failures.push(
          `${rel}: ${first?.text ?? 'error de parseo'} @ ${first?.location?.line}:${first?.location?.column}`
        );
      }
    }

    expect(failures).toEqual([]);
  }, 180_000);
});
