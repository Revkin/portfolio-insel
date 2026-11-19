/**
 * Builds the player character from the Quaternius CC0 packs (SPEC section 6):
 *
 *   public/assets/models/character.glb        – Superhero_Male base mesh + hair,
 *       techwear clothing painted into the base colour texture, glowing seams
 *       as an emissive mask, textures downsized to WebP, meshopt-compressed.
 *   public/assets/models/character-anims.glb  – only the clips the game uses,
 *       rotations only (+ scaled pelvis translation) so they keep the
 *       character's own proportions.
 *
 *   node scripts/assets/build-character.ts
 *
 * Source packs: see scripts/assets/source-files.ts (downloaded, not committed).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Accessor, type Document, type Node, type Primitive, type Texture } from '@gltf-transform/core';
import { dedup, meshopt, mergeDocuments, prune, resample, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { SOURCES, createIO, readGltfLenient } from './source-files.ts';

const OUT_DIR = resolve('public/assets/models');

/** Clips used by the game (UAL1 Standard names). */
const CLIPS = [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Sprint_Loop',
  'Jump_Start',
  'Jump_Loop',
  'Jump_Land',
  'Swim_Idle_Loop',
  'Swim_Fwd_Loop',
];

// ---------------------------------------------------------------- clothing

type Region = 'skin' | 'jacket' | 'pants' | 'boots';
const REGIONS: Region[] = ['skin', 'jacket', 'pants', 'boots'];

function regionForJoint(name: string): Region {
  if (/^(spine_0[123]|clavicle_|upperarm_|lowerarm_)/.test(name)) return 'jacket';
  if (/^(pelvis|thigh_|calf_)/.test(name)) return 'pants';
  if (/^(foot_|ball_)/.test(name)) return 'boots';
  return 'skin'; // head, neck, hands, fingers
}

/** Techwear palette (character sheet: dark grey/black, cyan seams). */
const CLOTH: Record<Exclude<Region, 'skin'>, [number, number, number]> = {
  jacket: [74, 82, 96],
  pants: [44, 47, 54],
  boots: [52, 47, 44],
};
const SOLE: [number, number, number] = [70, 64, 58];
const SEAM: [number, number, number] = [62, 242, 230];

/**
 * Glowing seam lines, defined on the T-pose (metres, +y up, +z front,
 * +x = character's left). Returns true if the point lies on a seam.
 */
function onSeam(x: number, y: number, z: number): boolean {
  const ax = Math.abs(x);
  const w = 0.006;
  // Torso front: two vertical strips and a horizontal band under the chest.
  if (z > 0.02 && ax < 0.2) {
    if (Math.abs(ax - 0.075) < w && y > 1.13 && y < 1.43) return true;
    if (Math.abs(y - 1.2) < w && ax < 0.16) return true;
  }
  // Back: line along the spine.
  if (z < -0.05 && ax < w && y > 1.12 && y < 1.46) return true;
  // Arms (T-pose along ±x): rings at mid upper arm and at the cuff, and a line on top.
  if (ax > 0.24 && ax < 0.72) {
    if (Math.abs(ax - 0.34) < w || Math.abs(ax - 0.64) < w) return true;
    const angle = Math.atan2(z + 0.065, y - 1.455); // 0 = top of the arm
    if (Math.abs(angle) < 0.09 && ax > 0.27 && ax < 0.62) return true;
  }
  return false;
}

interface Raster {
  width: number;
  height: number;
  region: Int8Array; // -1 = not covered
  pos: Float32Array; // xyz per pixel
}

/** Rasterises the mesh into UV space: per pixel the dominant region and the T-pose position. */
function rasterise(prim: Primitive, jointNames: string[], width: number, height: number): Raster {
  const uv = prim.getAttribute('TEXCOORD_0')!;
  const posAttr = prim.getAttribute('POSITION')!;
  const joints = prim.getAttribute('JOINTS_0')!;
  const weights = prim.getAttribute('WEIGHTS_0')!;
  const indices = prim.getIndices()!;

  const vRegion = new Int8Array(uv.getCount());
  const j = [0, 0, 0, 0];
  const wv = [0, 0, 0, 0];
  for (let i = 0; i < uv.getCount(); i++) {
    joints.getElement(i, j);
    weights.getElement(i, wv);
    const score = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) score[REGIONS.indexOf(regionForJoint(jointNames[j[k]!] ?? ''))]! += wv[k]!;
    vRegion[i] = score.indexOf(Math.max(...score));
  }

  const out: Raster = {
    width,
    height,
    region: new Int8Array(width * height).fill(-1),
    pos: new Float32Array(width * height * 3),
  };
  const a = [0, 0];
  const b = [0, 0];
  const c = [0, 0];
  const pa = [0, 0, 0];
  const pb = [0, 0, 0];
  const pc = [0, 0, 0];
  for (let t = 0; t < indices.getCount(); t += 3) {
    const i0 = indices.getScalar(t);
    const i1 = indices.getScalar(t + 1);
    const i2 = indices.getScalar(t + 2);
    uv.getElement(i0, a);
    uv.getElement(i1, b);
    uv.getElement(i2, c);
    posAttr.getElement(i0, pa);
    posAttr.getElement(i1, pb);
    posAttr.getElement(i2, pc);
    const ax = a[0]! * width, ay = a[1]! * height;
    const bx = b[0]! * width, by = b[1]! * height;
    const cx = c[0]! * width, cy = c[1]! * height;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1);
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1);
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5;
        const sy = py + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) / area;
        const w2 = 1 - w0 - w1;
        // Slightly conservative so UV island borders get covered.
        if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
        const idx = py * width + px;
        // Region: majority of the triangle's corners, weighted by barycentrics.
        const s = [0, 0, 0, 0];
        s[vRegion[i0]!]! += w0;
        s[vRegion[i1]!]! += w1;
        s[vRegion[i2]!]! += w2;
        out.region[idx] = s.indexOf(Math.max(...s));
        out.pos[idx * 3] = pa[0]! * w0 + pb[0]! * w1 + pc[0]! * w2;
        out.pos[idx * 3 + 1] = pa[1]! * w0 + pb[1]! * w1 + pc[1]! * w2;
        out.pos[idx * 3 + 2] = pa[2]! * w0 + pb[2]! * w1 + pc[2]! * w2;
      }
    }
  }
  return out;
}

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

async function paintClothing(doc: Document, bodyNode: Node) {
  const mesh = bodyNode.getMesh()!;
  const skin = bodyNode.getSkin()!;
  const prim = mesh.listPrimitives()[0]!;
  const material = prim.getMaterial()!;
  const baseTex = material.getBaseColorTexture()!;
  const jointNames = skin.listJoints().map((n) => n.getName());

  const SIZE = 1024;
  // Use the lighter skin variant from the pack (closer to the character sheet).
  const skinSource = existsSync(SOURCES.skinLight) ? await readFile(SOURCES.skinLight) : Buffer.from(baseTex.getImage()!);
  const { data: orig } = await sharp(skinSource)
    .resize(SIZE, SIZE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = rasterise(prim, jointNames, SIZE, SIZE);

  const color = Buffer.from(orig);
  const emissive = Buffer.alloc(SIZE * SIZE * 3);
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const reg = r.region[i]!;
    if (reg < 0) continue;
    counts[reg]!++;
    const region = REGIONS[reg]!;
    if (region === 'skin') continue;
    const x = r.pos[i * 3]!;
    const y = r.pos[i * 3 + 1]!;
    const z = r.pos[i * 3 + 2]!;
    const lum = (orig[i * 4]! * 0.3 + orig[i * 4 + 1]! * 0.59 + orig[i * 4 + 2]! * 0.11) / 255;
    // Keep a little of the sculpted shading, plus fine fabric noise.
    const shade = 0.9 + (lum - 0.6) * 0.15 + (hash(i % SIZE, (i / SIZE) | 0) - 0.5) * 0.05;
    let rgb = region === 'boots' && y < 0.035 ? SOLE : CLOTH[region];
    if (region === 'jacket' && onSeam(x, y, z)) {
      rgb = SEAM;
      emissive[i * 3] = SEAM[0];
      emissive[i * 3 + 1] = SEAM[1];
      emissive[i * 3 + 2] = SEAM[2];
    }
    const k = rgb === SEAM ? 1 : shade;
    color[i * 4] = Math.min(255, rgb[0] * k);
    color[i * 4 + 1] = Math.min(255, rgb[1] * k);
    color[i * 4 + 2] = Math.min(255, rgb[2] * k);
  }
  console.log(
    `  Kleidung: ${REGIONS.map((n, i) => `${n} ${((counts[i]! / (SIZE * SIZE)) * 100).toFixed(1)} %`).join(', ')}`,
  );

  const png = await sharp(color, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
  baseTex.setImage(new Uint8Array(png)).setMimeType('image/png').setURI('character_basecolor.png');

  const emissivePng = await sharp(emissive, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
  const emissiveTex: Texture = doc
    .createTexture('character_emissive')
    .setImage(new Uint8Array(emissivePng))
    .setMimeType('image/png')
    .setURI('character_emissive.png');
  material.setEmissiveTexture(emissiveTex).setEmissiveFactor([1, 1, 1]);
  material.setName('M_Character');
}

// ---------------------------------------------------------------- character

async function buildCharacter() {
  const io = await createIO();
  const doc = await readGltfLenient(io, SOURCES.character);
  const hairDoc = await readGltfLenient(io, SOURCES.hair);

  const root = doc.getRoot();
  const body = root.listNodes().find((n) => n.getName() === 'SuperHero_Male');
  if (!body) throw new Error('SuperHero_Male mesh node not found');
  body.setName('Body');

  await paintClothing(doc, body);

  // Hair: a static mesh (origin at 0) attached to the Head bone at runtime.
  mergeDocuments(doc, hairDoc);
  const scenes = root.listScenes();
  const main = scenes[0]!;
  for (const extra of scenes.slice(1)) {
    for (const child of extra.listChildren()) {
      if (child.getMesh()) {
        child.setName('Hair');
        main.addChild(child);
      }
    }
    extra.dispose();
  }
  root.setDefaultScene(main);

  // Downsize textures and convert to WebP.
  await textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 })(doc);
  await doc.transform(unpartition(), prune(), dedup());
  disposeOrphanAccessors(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  const out = resolve(OUT_DIR, 'character.glb');
  await writeFile(out, await io.writeBinary(doc));
  return out;
}

/**
 * Accessors of disposed animation channels are not always removed by prune();
 * drop every accessor that nothing references any more.
 */
function disposeOrphanAccessors(doc: Document): number {
  let removed = 0;
  for (const a of doc.getRoot().listAccessors()) {
    if (a.listParents().every((p) => p.propertyType === 'Root')) {
      a.dispose();
      removed++;
    }
  }
  return removed;
}

// ---------------------------------------------------------------- animations

function pelvisHeight(doc: Document): number {
  const pelvis = doc.getRoot().listNodes().find((n) => n.getName() === 'pelvis')!;
  return pelvis.getTranslation()[2]!; // root is Z-up
}

async function buildAnimations() {
  const io = await createIO();
  const doc = await io.read(SOURCES.animations);
  const character = await readGltfLenient(io, SOURCES.character);
  const scale = pelvisHeight(character) / pelvisHeight(doc);
  const root = doc.getRoot();

  for (const anim of root.listAnimations()) {
    if (!CLIPS.includes(anim.getName())) {
      // Samplers survive Animation.dispose() and would keep their keyframe data alive.
      anim.listChannels().forEach((c) => c.dispose());
      anim.listSamplers().forEach((s) => s.dispose());
      anim.dispose();
      continue;
    }
    for (const channel of anim.listChannels()) {
      const node = channel.getTargetNode()?.getName();
      const path = channel.getTargetPath();
      const keep = path === 'rotation' || (path === 'translation' && node === 'pelvis');
      if (!keep) {
        channel.getSampler()?.dispose();
        channel.dispose();
        continue;
      }
      if (path === 'translation') {
        // Adapt the pelvis height to the character's proportions.
        const output = channel.getSampler()!.getOutput() as Accessor;
        const arr = output.getArray()!.slice();
        for (let i = 0; i < arr.length; i++) arr[i] = arr[i]! * scale;
        output.setArray(arr);
      }
    }
  }
  const missing = CLIPS.filter((c) => !root.listAnimations().some((a) => a.getName() === c));
  if (missing.length) throw new Error(`Animation(en) fehlen: ${missing.join(', ')}`);

  // Drop the mannequin mesh; the bone nodes stay as animation targets.
  for (const node of root.listNodes()) {
    if (node.getMesh()) {
      node.setMesh(null);
      node.setSkin(null);
    }
  }
  await doc.transform(resample(), prune({ keepLeaves: true }), dedup());
  disposeOrphanAccessors(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  const out = resolve(OUT_DIR, 'character-anims.glb');
  await writeFile(out, await io.writeBinary(doc));
  console.log(`  Pelvis-Skalierung ${scale.toFixed(3)}, Clips: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
  return out;
}

await mkdir(OUT_DIR, { recursive: true });
console.log('Charakter …');
const c = await buildCharacter();
console.log(`  → ${c}`);
console.log('Animationen …');
const a = await buildAnimations();
console.log(`  → ${a}`);
