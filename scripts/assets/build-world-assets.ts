/**
 * Builds the web-ready world assets from the Poly Haven downloads (CC0):
 *
 * - Terrain texture atlases: five ground materials stacked vertically into one
 *   colour and one normal image (loaded as a texture array at runtime).
 * - Material textures for wood and roof tiles (colour, normal, ARM).
 * - Props (rock set, barrel, crate, lantern): decimated with
 *   meshoptimizer, textures as WebP, geometry meshopt-compressed.
 *
 *   node scripts/assets/download-polyhaven.ts   (once)
 *   node scripts/assets/build-world-assets.ts
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { dedup, meshopt, prune, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { POLYHAVEN_DIR, createIO } from './source-files.ts';

const OUT_TEX = resolve('public/assets/textures');
const OUT_MODELS = resolve('public/assets/models/world');

/** Order = layer index in the terrain shader (src/world/terrainMaterial.ts). */
export const TERRAIN_LAYERS = ['aerial_grass_rock', 'coast_sand_01', 'mossy_rock', 'park_dirt', 'cobblestone_floor_01'];
const LAYER_SIZE = 1024;

const MATERIALS: Record<string, { id: string; size: number }> = {
  wood: { id: 'old_planks_02', size: 1024 },
  roof: { id: 'clay_roof_tiles_02', size: 1024 },
  stone: { id: 'mossy_rock', size: 512 },
  cobble: { id: 'cobblestone_floor_01', size: 512 },
};

/** Props and their triangle budget per mesh. */
const PROPS: Record<string, { id: string; maxTris: number; texSize: number; error?: number }> = {
  rocks: { id: 'rock_moss_set_01', maxTris: 1400, texSize: 1024 },
  barrel: { id: 'Barrel_01', maxTris: 1400, texSize: 512 },
  crate: { id: 'wooden_crate_01', maxTris: 1200, texSize: 512 },
  lantern: { id: 'Lantern_01', maxTris: 2400, texSize: 512 },
};

const src = (...p: string[]) => {
  const file = join(POLYHAVEN_DIR, ...p);
  if (!existsSync(file)) throw new Error(`Quelldatei fehlt: ${file}\nZuerst scripts/assets/download-polyhaven.ts ausführen.`);
  return file;
};

let total = 0;
async function out(file: string, data: Uint8Array | Buffer) {
  await writeFile(file, data);
  total += data.byteLength;
  console.log(`  ${(data.byteLength / 1024).toFixed(0).padStart(5)} KB  ${file.slice(resolve('.').length + 1)}`);
}

async function stackLayers(map: string, quality: number): Promise<Buffer> {
  const layers = await Promise.all(
    TERRAIN_LAYERS.map((id) => sharp(src('textures', id, `${map}.jpg`)).resize(LAYER_SIZE, LAYER_SIZE).removeAlpha().toBuffer()),
  );
  return sharp({
    create: { width: LAYER_SIZE, height: LAYER_SIZE * layers.length, channels: 3, background: '#000' },
  })
    .composite(layers.map((input, i) => ({ input, left: 0, top: i * LAYER_SIZE })))
    .webp({ quality })
    .toBuffer();
}

async function buildTextures() {
  await mkdir(OUT_TEX, { recursive: true });
  await out(join(OUT_TEX, 'terrain-albedo.webp'), await stackLayers('Diffuse', 82));
  await out(join(OUT_TEX, 'terrain-normal.webp'), await stackLayers('nor_gl', 88));

  for (const [name, { id, size }] of Object.entries(MATERIALS)) {
    for (const [map, suffix, quality] of [
      ['Diffuse', 'albedo', 82],
      ['nor_gl', 'normal', 88],
      ['arm', 'arm', 85],
    ] as const) {
      const buf = await sharp(src('textures', id, `${map}.jpg`)).resize(size, size).webp({ quality }).toBuffer();
      await out(join(OUT_TEX, `${name}-${suffix}.webp`), buf);
    }
  }
}

async function buildProps() {
  await mkdir(OUT_MODELS, { recursive: true });
  const io = await createIO();
  await MeshoptSimplifier.ready;
  for (const [name, { id, maxTris, texSize, error = 0.02 }] of Object.entries(PROPS)) {
    const doc = await io.read(src('models', id, `${id}.gltf`));
    await doc.transform(weld());
    // Simplify each primitive towards the triangle budget.
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const tris = (prim.getIndices()?.getCount() ?? 0) / 3;
        if (tris > maxTris) {
          simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: maxTris / tris, error, lockBorder: false });
        }
      }
    }
    await textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 })(doc);
    await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const tris = doc
      .getRoot()
      .listMeshes()
      .map((m) => m.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0));
    console.log(`  ${name}: ${tris.join(', ')} Dreiecke`);
    await out(join(OUT_MODELS, `${name}.glb`), await io.writeBinary(doc));
  }
}

await buildTextures();
await buildProps();
console.log(`Gesamt ${(total / 1024 / 1024).toFixed(2)} MB`);
