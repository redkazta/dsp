// Valida la sintaxis de cada bloque <script> de una página Astro, con el
// mismo esbuild que usa el build del cliente.
//
//   node check-scripts.cjs src/pages/checkout.astro
//   node check-scripts.cjs            # revisa todas las páginas
//
// Sirve para detectar temprano errores que solo aparecen al compilar el
// bundle del navegador ("Unterminated string literal" y similares).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ESBUILD = path.join('node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');

function collect(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];

  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.astro')) out.push(full);
    }
  };
  walk(target);
  return out;
}

const files = collect(process.argv[2] || 'src');
let total = 0;
let failed = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];

  blocks.forEach((m, i) => {
    total += 1;
    const tmp = `.__block_${process.pid}_${i}.ts`;
    fs.writeFileSync(tmp, m[1]);

    try {
      execFileSync(ESBUILD, [tmp, '--outfile=.__out.js'], { stdio: 'pipe' });
    } catch (e) {
      failed += 1;
      console.log(`✗ ${file} (bloque ${i})`);
      console.log(
        (e.stderr?.toString() || '')
          .split('\n')
          .filter((l) => l.trim())
          .slice(0, 8)
          .map((l) => `   ${l}`)
          .join('\n')
      );
    } finally {
      fs.unlinkSync(tmp);
      try {
        fs.unlinkSync('.__out.js');
      } catch {}
    }
  });
}

console.log(`\n${total - failed}/${total} bloques <script> válidos`);

if (failed > 0) {
  console.log(`${failed} con error de sintaxis`);
  process.exit(1);
}
