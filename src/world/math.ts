/** Small deterministic math helpers for procedural generation. */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep; edges may be given in descending order. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iz: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** 2D value noise in [0, 1]. */
export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/** Fractal value noise in [0, 1]. */
export function fbm(x: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f + i * 17.3, z * f - i * 9.1) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export interface Polyline {
  xs: Float32Array;
  zs: Float32Array;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function makePolyline(points: { x: number; z: number }[]): Polyline {
  const xs = new Float32Array(points.map((p) => p.x));
  const zs = new Float32Array(points.map((p) => p.z));
  return {
    xs,
    zs,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/**
 * Distance from (x, z) to the polyline and the fractional sample index of the
 * closest point. Returns Infinity quickly when outside the bbox + margin.
 */
export function nearestOnPolyline(
  line: Polyline,
  x: number,
  z: number,
  margin: number,
): { dist: number; index: number } {
  if (x < line.minX - margin || x > line.maxX + margin || z < line.minZ - margin || z > line.maxZ + margin) {
    return { dist: Infinity, index: 0 };
  }
  let best = Infinity;
  let bestIndex = 0;
  const n = line.xs.length;
  for (let i = 0; i < n - 1; i++) {
    const ax = line.xs[i]!;
    const az = line.zs[i]!;
    const bx = line.xs[i + 1]!;
    const bz = line.zs[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1) : 0;
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) {
      best = d2;
      bestIndex = i + t;
    }
  }
  return { dist: Math.sqrt(best), index: bestIndex };
}

/** Linear interpolation into a sampled array by fractional index. */
export function sampleArray(arr: ArrayLike<number>, index: number): number {
  const i0 = clamp(Math.floor(index), 0, arr.length - 1);
  const i1 = Math.min(i0 + 1, arr.length - 1);
  return lerp(arr[i0]!, arr[i1]!, index - i0);
}
