import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { valueNoise } from './math.ts';
import { rng } from './scatter.ts';

/**
 * Procedural trees in a stylised-realistic look (SPEC 3). Each variant is two
 * geometries: trunk (bark material) and foliage (vertex-coloured leaves).
 * Foliage normals are bent outwards from the crown centre so the crown is lit
 * like one soft volume instead of many small facets.
 */
export interface TreeVariant {
  trunk: BufferGeometry;
  foliage: BufferGeometry;
  /** Trunk radius at the base, for the collider. */
  trunkRadius: number;
  height: number;
}

const UP = new Vector3(0, 1, 0);

function setColor(g: BufferGeometry, color: (p: Vector3, n: Vector3) => Color) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const out = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    const c = color(p, n);
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(out, 3));
}

/** Bends normals towards the direction from `center` (soft, rounded shading). */
function sphericalNormals(g: BufferGeometry, center: Vector3, amount: number) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(center).normalize();
    n.fromBufferAttribute(nrm, i).lerp(p, amount).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
}

/** Tapered, slightly bent limb from `from` along `dir`. */
function limb(from: Vector3, dir: Vector3, length: number, r0: number, r1: number, bend: Vector3): BufferGeometry {
  const g = new CylinderGeometry(r1, r0, length, 7, 4, true);
  g.translate(0, length / 2, 0);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y / length;
    // Bark bumps and a gentle curve.
    const bump = 1 + (valueNoise(v.x * 9 + v.y * 3, v.z * 9) - 0.5) * 0.25;
    v.x *= bump;
    v.z *= bump;
    v.addScaledVector(bend, t * t);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  g.translate(from.x, from.y, from.z);
  g.computeVertexNormals();
  return g;
}

/** Noise-displaced blob for the crown. */
function blob(center: Vector3, radius: number, seed: number): BufferGeometry {
  // Polyhedra come unindexed: weld them so the normals are smooth.
  const raw = new IcosahedronGeometry(radius, 2);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const g = mergeVertices(raw);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const d = 1 + (valueNoise(n.x * 2.2 + seed, n.y * 2.2 + n.z * 1.7) - 0.5) * 0.45;
    v.multiplyScalar(d);
    v.y *= 0.82; // slightly flattened
    pos.setXYZ(i, v.x + center.x, v.y + center.y, v.z + center.z);
  }
  g.computeVertexNormals();
  const out = g.toNonIndexed();
  out.setAttribute('uv', new BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
  return out;
}

/** Leaf cards scattered over a blob surface, facing outwards. */
function leafCards(center: Vector3, radius: number, count: number, random: () => number): BufferGeometry[] {
  const cards: BufferGeometry[] = [];
  const q = new Quaternion();
  for (let i = 0; i < count; i++) {
    const dir = new Vector3(random() * 2 - 1, random() * 1.6 - 0.5, random() * 2 - 1).normalize();
    const size = radius * (0.6 + random() * 0.4);
    const c = new PlaneGeometry(size, size);
    // Face roughly outwards, with a random twist.
    q.setFromUnitVectors(new Vector3(0, 0, 1), dir);
    c.rotateZ(random() * Math.PI * 2);
    c.applyQuaternion(q);
    const p = center.clone().addScaledVector(dir, radius * (0.95 + random() * 0.25));
    p.y -= radius * 0.08;
    c.translate(p.x, p.y, p.z);
    cards.push(c);
  }
  return cards;
}

function prepare(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (!out.getAttribute('uv')) out.setAttribute('uv', new BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
  return out;
}

const LEAF_GREENS = ['#4C7A2B', '#5A8A30', '#3F6B26', '#6B9137'].map((c) => new Color(c));
const PINE_GREENS = ['#2F5530', '#3A6233', '#284A2B'].map((c) => new Color(c));
const BARK = new Color('#5A4632');

/** Round deciduous tree: bent trunk, a few main branches, clustered crown. */
export function deciduousTree(seed: number): TreeVariant {
  const random = rng(seed);
  const height = 5.5 + random() * 2.5;
  const trunkH = height * 0.5;
  const r0 = 0.32 + random() * 0.08;
  const lean = new Vector3(random() - 0.5, 0, random() - 0.5).multiplyScalar(0.8);
  const parts = [limb(new Vector3(0, -0.3, 0), UP, trunkH + 0.3, r0, r0 * 0.6, lean)];
  const top = new Vector3(lean.x, trunkH, lean.z);

  const crownCenter = top.clone().add(new Vector3(0, height * 0.22, 0));
  const blobs: BufferGeometry[] = [];
  const cards: BufferGeometry[] = [];
  const branches = 3 + Math.floor(random() * 2);
  const greens = LEAF_GREENS[Math.floor(random() * LEAF_GREENS.length)]!;
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + random() * 0.8;
    const dir = new Vector3(Math.cos(a) * 0.8, 0.9 + random() * 0.4, Math.sin(a) * 0.8);
    const len = height * (0.28 + random() * 0.12);
    parts.push(limb(top.clone().addScaledVector(UP, -0.2), dir, len, r0 * 0.5, r0 * 0.18, new Vector3(0, 0.3, 0)));
    const end = top.clone().addScaledVector(dir.normalize(), len);
    const r = 1.2 + random() * 0.7;
    blobs.push(blob(end, r, seed + b * 7.3));
    cards.push(...leafCards(end, r, 22, random));
  }
  // Fill the middle and top of the crown.
  for (let k = 0; k < 3; k++) {
    const c = crownCenter.clone().add(new Vector3((random() - 0.5) * 1.6, k * 0.8 + random() * 0.5, (random() - 0.5) * 1.6));
    const r = 1.4 + random() * 0.6;
    blobs.push(blob(c, r, seed + 40 + k));
    cards.push(...leafCards(c, r, 18, random));
  }

  const trunk = mergeGeometries(parts.map(prepare))!;
  setColor(trunk, (p) => BARK.clone().multiplyScalar(0.8 + valueNoise(p.y * 3, p.x * 5) * 0.4));

  const blobGeo = mergeGeometries(blobs.map(prepare))!;
  const cardGeo = mergeGeometries(cards.map(prepare))!;
  // Blobs are fully opaque: give them uv (0.5, 0.5) = the solid centre of the leaf texture.
  const buv = blobGeo.getAttribute('uv');
  for (let i = 0; i < buv.count; i++) buv.setXY(i, 0.5, 0.5);
  const foliage = mergeGeometries([blobGeo, cardGeo])!;
  const crownH = new Vector3();
  foliage.computeBoundingBox();
  foliage.boundingBox!.getCenter(crownH);
  sphericalNormals(foliage, crownH, 0.75);
  const minY = foliage.boundingBox!.min.y;
  const spanY = foliage.boundingBox!.max.y - minY;
  setColor(foliage, (p) => {
    const t = (p.y - minY) / spanY;
    const n = valueNoise(p.x * 1.3 + seed, p.z * 1.3 + p.y);
    return greens.clone().multiplyScalar(0.62 + t * 0.5 + (n - 0.5) * 0.25);
  });
  return { trunk, foliage, trunkRadius: r0, height };
}

/** Conifer: straight trunk with stacked, jagged cone layers. */
export function pineTree(seed: number): TreeVariant {
  const random = rng(seed);
  const height = 6 + random() * 4;
  const r0 = 0.22 + random() * 0.06;
  const trunk = mergeGeometries([prepare(limb(new Vector3(0, -0.3, 0), UP, height * 0.55, r0, r0 * 0.5, new Vector3()))])!;
  setColor(trunk, (p) => BARK.clone().multiplyScalar(0.7 + valueNoise(p.y * 3, p.x * 5) * 0.3));

  const layers = 5 + Math.floor(random() * 2);
  const cones: BufferGeometry[] = [];
  const base = height * 0.2;
  const greens = PINE_GREENS[Math.floor(random() * PINE_GREENS.length)]!;
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1);
    const radius = (1 - t * 0.78) * (height * 0.26);
    const h = radius * 1.35;
    const y = base + t * (height - base - h * 0.6);
    const g = new ConeGeometry(radius, h, 12, 3, true);
    const pos = g.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const rim = v.y < -h * 0.4 ? 1 : 0;
      const ang = Math.atan2(v.z, v.x);
      // Jagged, drooping rim.
      const jag = 1 + (valueNoise(ang * 3 + l * 5, seed) - 0.5) * 0.5 * rim + Math.sin(ang * 6 + l) * 0.08 * rim;
      v.x *= jag;
      v.z *= jag;
      v.y -= rim * (valueNoise(ang * 4, l + seed) * 0.35);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.rotateY(random() * Math.PI);
    g.translate(0, y + h / 2, 0);
    g.computeVertexNormals();
    cones.push(prepare(g));
  }
  const foliage = mergeGeometries(cones)!;
  sphericalNormals(foliage, new Vector3(0, height * 0.45, 0), 0.55);
  setColor(foliage, (p) => {
    const t = p.y / height;
    const n = valueNoise(p.x * 2 + seed, p.z * 2 + p.y * 1.5);
    return greens.clone().multiplyScalar(0.7 + t * 0.45 + (n - 0.5) * 0.3);
  });
  const uv = foliage.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
  return { trunk, foliage, trunkRadius: r0, height };
}

/** Low shrub: a few blobs with leaf cards, no visible trunk. */
export function bush(seed: number): TreeVariant {
  const random = rng(seed);
  const blobs: BufferGeometry[] = [];
  const cards: BufferGeometry[] = [];
  const n = 3 + Math.floor(random() * 3);
  for (let i = 0; i < n; i++) {
    const c = new Vector3((random() - 0.5) * 1.4, 0.35 + random() * 0.35, (random() - 0.5) * 1.4);
    const r = 0.55 + random() * 0.35;
    blobs.push(blob(c, r, seed + i * 3.1));
    cards.push(...leafCards(c, r, 10, random));
  }
  const blobGeo = mergeGeometries(blobs.map(prepare))!;
  const buv = blobGeo.getAttribute('uv');
  for (let i = 0; i < buv.count; i++) buv.setXY(i, 0.5, 0.5);
  const foliage = mergeGeometries([blobGeo, mergeGeometries(cards.map(prepare))!])!;
  sphericalNormals(foliage, new Vector3(0, 0.3, 0), 0.7);
  const greens = LEAF_GREENS[Math.floor(random() * LEAF_GREENS.length)]!;
  setColor(foliage, (p) => greens.clone().multiplyScalar(0.6 + p.y * 0.35 + (valueNoise(p.x * 3, p.z * 3) - 0.5) * 0.25));
  const trunk = new BufferGeometry();
  return { trunk, foliage, trunkRadius: 0, height: 1.2 };
}

/**
 * Leaf cluster texture drawn at runtime (no image asset): many small leaves
 * in light grey so the vertex colour decides the green. The centre is solid
 * (used by the opaque crown blobs).
 */
export function createLeafTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const random = rng(99);
  ctx.fillStyle = '#d9d9d9';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 70; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * size * 0.38;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    const shade = 170 + Math.floor(random() * 85);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + (random() - 0.5) * 1.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.065, size * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
