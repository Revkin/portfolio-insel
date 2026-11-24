import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PbrSet } from './textures.ts';

/**
 * Small helpers for the buildings and props that are built in code (bridge,
 * fences, house, windmill, dock, boat). Parts are plain geometries with
 * position, normal and uv; texture scale is baked into the uvs (metres / tile),
 * so one material works for parts of any size.
 */

export type Vec3 = [number, number, number];

export interface PartOptions {
  position?: Vec3;
  rotation?: Vec3;
  /** Texture tile size in metres (default 1). */
  tile?: number;
}

const ATTRS = ['position', 'normal', 'uv'];

function clean(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!ATTRS.includes(name)) out.deleteAttribute(name);
  out.clearGroups();
  return out;
}

/**
 * Box projection: each face gets the two axes it lies in, the longer extent of
 * the part along u (plank and grain direction follows the long side).
 */
export function projectUV(g: BufferGeometry, tile = 1): BufferGeometry {
  g.computeBoundingBox();
  const size = new Vector3();
  g.boundingBox!.getSize(size);
  const ext = [size.x, size.y, size.z];
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const k = n[0]! >= n[1]! && n[0]! >= n[2]! ? 0 : n[1]! >= n[2]! ? 1 : 2;
    let [a, b] = [0, 1, 2].filter((axis) => axis !== k) as [number, number];
    if (ext[a]! < ext[b]!) [a, b] = [b, a];
    uv[i * 2] = p[a]! / tile;
    uv[i * 2 + 1] = p[b]! / tile;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

export function transform(g: BufferGeometry, position?: Vec3, rotation?: Vec3, scale?: Vec3): BufferGeometry {
  const m = new Matrix4().compose(
    new Vector3(...(position ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(rotation ?? [0, 0, 0]))),
    new Vector3(...(scale ?? [1, 1, 1])),
  );
  return g.applyMatrix4(m);
}

function finish(g: BufferGeometry, o: PartOptions, project = true): BufferGeometry {
  const out = clean(g);
  if (project) projectUV(out, o.tile ?? 1);
  return transform(out, o.position, o.rotation);
}

/** Box with tiled uvs. */
export function box(w: number, h: number, d: number, o: PartOptions = {}): BufferGeometry {
  return finish(new BoxGeometry(w, h, d), o);
}

/**
 * Cylinder (or cone) with the texture wrapped around it; the grain runs along
 * the length, as on a post.
 */
export function cylinder(radiusTop: number, radiusBottom: number, h: number, segments: number, o: PartOptions = {}): BufferGeometry {
  const g = clean(new CylinderGeometry(radiusTop, radiusBottom, h, segments));
  const tile = o.tile ?? 1;
  const uv = g.getAttribute('uv');
  const circ = Math.PI * 2 * Math.max(radiusTop, radiusBottom);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getY(i) * h) / tile, (uv.getX(i) * circ) / tile);
  return finish(g, o, false);
}

/** Any geometry with box-projected uvs. */
export function part(g: BufferGeometry, o: PartOptions = {}): BufferGeometry {
  return finish(g, o);
}

/** Square beam from a to b (rails, spars, struts). */
export function beam(a: Vector3, b: Vector3, width: number, height = width, tile = 1): BufferGeometry {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  const g = clean(new BoxGeometry(len, height, width));
  projectUV(g, tile);
  const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir.normalize());
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  return g.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)));
}

/** Merges parts into one geometry (one draw call per material). */
export function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts.map(clean), false);
  if (!g) throw new Error('merged: incompatible parts');
  g.computeBoundingSphere();
  return g;
}

/** Points of a hanging cable between a and b. */
export function catenary(a: Vector3, b: Vector3, sag: number, segments = 10): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    out.push(new Vector3().lerpVectors(a, b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  return out;
}

/** Thin tube along points (cables, ropes, rims). */
export function tube(points: Vector3[], radius: number, radial = 5): BufferGeometry {
  const curve = new CatmullRomCurve3(points);
  return clean(new TubeGeometry(curve, Math.max(points.length * 2, 4), radius, radial, false));
}

/** Material from a PBR texture set; `color` tints the albedo. */
export function pbrMaterial(set: PbrSet, color: ColorRepresentation = '#ffffff', extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
  return Object.assign(
    new MeshStandardMaterial({
      map: set.map,
      normalMap: set.normalMap,
      roughnessMap: set.arm,
      aoMap: set.arm,
      aoMapIntensity: 0.8,
      metalness: 0,
      color,
    }),
    extra,
  );
}

/** Glowing material for neon edges and signs (stays bright, picked up by bloom later). */
export function neonMaterial(color: ColorRepresentation, intensity = 1.6): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, toneMapped: false });
}
