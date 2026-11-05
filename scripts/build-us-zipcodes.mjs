#!/usr/bin/env node
/**
 * Genera `data/us_zipcodes.json` a partir del dataset público de Vega
 * (~42 000 ZIP codes de EE. UU.).
 *
 * Uso:
 *   node scripts/build-us-zipcodes.mjs                 # descarga la fuente
 *   node scripts/build-us-zipcodes.mjs ruta/al.csv     # usa un CSV local
 *
 * El CSV debe traer las columnas `zip_code`, `city` y `state`. El JSON de
 * salida es un arreglo de `{ zip, city, state }`, ordenado por ZIP.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/vega/vega-datasets/main/data/zipcodes.csv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'data', 'us_zipcodes.json');

async function loadCsv() {
  const local = process.argv[2];
  if (local) return readFile(resolve(process.cwd(), local), 'utf8');

  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`No se pudo descargar ${SOURCE}: ${res.status}`);
  return res.text();
}

async function main() {
  const csv = await loadCsv();
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const header = headerLine.split(',');

  const iZip = header.indexOf('zip_code');
  const iCity = header.indexOf('city');
  const iState = header.indexOf('state');

  if (iZip < 0 || iCity < 0 || iState < 0) {
    throw new Error('El CSV debe tener las columnas zip_code, city y state.');
  }

  const byZip = new Map();

  for (const line of lines) {
    if (!line) continue;
    const cols = line.split(',');
    const zip = (cols[iZip] ?? '').trim();
    const city = (cols[iCity] ?? '').trim();
    const state = (cols[iState] ?? '').trim().toUpperCase();

    if (!/^\d{5}$/.test(zip) || !city || !/^[A-Z]{2}$/.test(state)) continue;
    byZip.set(zip, { zip, city, state });
  }

  const rows = [...byZip.values()].sort((a, b) => a.zip.localeCompare(b.zip));

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(rows)}\n`, 'utf8');

  console.log(`Escritos ${rows.length} ZIP codes en ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
