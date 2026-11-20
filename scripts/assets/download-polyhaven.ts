/**
 * Downloads the CC0 Poly Haven assets used by the world (Phase 4) into
 * ../asset-downloads/polyhaven (outside the repo). Already present files are
 * skipped. Only the processed, compressed versions go into the repo
 * (see build-world-assets.ts).
 *
 *   node scripts/assets/download-polyhaven.ts
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { POLYHAVEN_DIR } from './source-files.ts';

const UA = 'portfolio-insel-asset-script';

/** Texture sets: 1K JPG colour, OpenGL normal, ARM (AO/roughness/metal). */
export const TEXTURES = [
  'mossy_rock',
  'cobblestone_floor_01',
  'park_dirt',
  'old_planks_02',
  'coast_sand_01',
  'clay_roof_tiles_02',
  'aerial_grass_rock',
] as const;
export const MODELS = ['rock_moss_set_01', 'Barrel_01', 'wooden_crate_01', 'Lantern_01'] as const;

interface FileEntry {
  url: string;
  size: number;
  include?: Record<string, { url: string; size: number }>;
}
type Files = Record<string, Record<string, Record<string, FileEntry>>>;

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.polyhaven.com/${path}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return (await res.json()) as T;
}

let total = 0;
async function save(url: string, dest: string) {
  if (existsSync(dest)) return;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  total += buf.byteLength;
  console.log(`  ${(buf.byteLength / 1e6).toFixed(2)} MB  ${dest.slice(POLYHAVEN_DIR.length + 1)}`);
}

async function main() {
  for (const id of TEXTURES) {
    const f = await api<Files>(`files/${id}`);
    for (const map of ['Diffuse', 'nor_gl', 'arm']) {
      const entry = f[map]?.['1k']?.['jpg'];
      if (!entry) throw new Error(`${id}: Karte ${map} fehlt`);
      await save(entry.url, join(POLYHAVEN_DIR, 'textures', id, `${map}.jpg`));
    }
  }
  for (const id of MODELS) {
    const f = await api<Files>(`files/${id}`);
    const entry = f['gltf']?.['1k']?.['gltf'];
    if (!entry) throw new Error(`${id}: kein 1K-glTF`);
    const dir = join(POLYHAVEN_DIR, 'models', id);
    await save(entry.url, join(dir, `${id}.gltf`));
    for (const [rel, inc] of Object.entries(entry.include ?? {})) await save(inc.url, join(dir, rel));
  }
  console.log(`Fertig, ${(total / 1e6).toFixed(1)} MB neu geladen.`);
}

await main();
