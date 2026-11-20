import {
  CREEK_HALF_WIDTH,
  HOUSE_POSITION,
  ISLAND_RADIUS_X,
  ISLAND_RADIUS_Z,
  PATH_HALF_WIDTH,
  SEA_LEVEL,
  WINDMILL_POSITION,
  creekSamples,
  pathSamples,
} from './layout.ts';
import { clamp, fbm, lerp, makePolyline, nearestOnPolyline, sampleArray, smoothstep, type Polyline } from './math.ts';

/**
 * Procedural graybox terrain. Everything that needs the ground height (physics,
 * path, portals, camera) reads it from the same grid, so they always agree.
 */

export const GRID = { minX: -130, maxX: 130, minZ: -105, maxZ: 105, step: 1 } as const;
/** Distance from the creek centre line at which carving the bed starts. */
const CREEK_CARVE_WIDTH = CREEK_HALF_WIDTH + 4;
/** Distances to path and creek are stored up to this value (metres). */
export const DIST_CAP = 12;
const NX = Math.round((GRID.maxX - GRID.minX) / GRID.step) + 1;
const NZ = Math.round((GRID.maxZ - GRID.minZ) / GRID.step) + 1;

/** Island shape before path, creek and building pads are applied. */
export function baseHeight(x: number, z: number): number {
  const nx = x / ISLAND_RADIUS_X;
  const nz = z / ISLAND_RADIUS_Z;
  const wobble = (fbm(x * 0.015 + 3.1, z * 0.015 - 7.4, 3) - 0.5) * 0.22;
  const d = Math.sqrt(nx * nx + nz * nz) + wobble;

  const south = smoothstep(20, 70, z); // beach
  const west = smoothstep(-45, -85, x); // cliff side

  // Where the coast starts to fall off: gentle beach in the south, steep cliff in the west.
  const inner = 0.8 - 0.1 * south + 0.13 * west;
  const land = smoothstep(1.0, inner, d);

  let h = -7 + land * 9;
  h += land * (fbm(x * 0.03, z * 0.03, 4) - 0.5) * 3;
  h -= south * land * 0.8;

  // Hill in the north with the windmill.
  h += land * 9 * Math.exp(-(((x - WINDMILL_POSITION.x) / 30) ** 2 + ((z - WINDMILL_POSITION.z) / 22) ** 2));
  // Raised, rocky ground in the west.
  h += land * west * 4.5;
  h += land * west * (fbm(x * 0.08, z * 0.08, 3) - 0.5) * 3;

  // Rock mesa with steep, climbable walls and a flat top to glide from.
  const dm = Math.hypot(x - CLIMB_ROCK.x, (z - CLIMB_ROCK.z) * 1.15);
  h += land * CLIMB_ROCK.height * smoothstep(CLIMB_ROCK.radius + 3, CLIMB_ROCK.radius - 1, dm);
  return h;
}

/** Climbing rock in the west (SPEC 4.4: high enough to climb and glide). */
export const CLIMB_ROCK = { x: -74, z: -26, radius: 10, height: 9 } as const;

export interface TerrainData {
  nx: number;
  nz: number;
  heights: Float32Array;
  /** 0..1 per vertex: how much the vertex belongs to the path surface. */
  pathMask: Float32Array;
  /** 0..1 per vertex: creek bed. */
  creekMask: Float32Array;
  /** Distance of each vertex to the path centre line (capped at DIST_CAP). */
  pathDist: Float32Array;
  /** Distance of each vertex to the creek centre line (capped at DIST_CAP). */
  creekDist: Float32Array;
  path: Polyline;
  pathHeights: Float32Array;
  creek: Polyline;
  /** Water surface height along the creek. */
  creekWater: Float32Array;
  /** Last creek sample before the waterfall drops into the sea. */
  creekEnd: number;
  bridge: { x: number; z: number; y: number; angle: number; length: number };
}

function smoothProfile(values: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = clamp(i + k, 0, values.length - 1);
      sum += values[j]!;
      n++;
    }
    out[i] = sum / n;
  }
  return out;
}

function build(): TerrainData {
  const path = makePolyline(pathSamples);
  const creek = makePolyline(creekSamples);

  // Path height profile: smoothed terrain, always above the water.
  const rawPath = new Float32Array(pathSamples.map((p) => baseHeight(p.x, p.z)));
  const pathHeights = smoothProfile(rawPath, 20).map((h) => Math.max(h, 1.0));

  // Creek water level: flows downhill only (running minimum from the spring).
  const creekWater = new Float32Array(creekSamples.length);
  let level = Infinity;
  let creekEnd = creekSamples.length - 1;
  for (let i = 0; i < creekSamples.length; i++) {
    const p = creekSamples[i]!;
    let ground = baseHeight(p.x, p.z);
    const onPath = nearestOnPolyline(path, p.x, p.z, 6);
    if (onPath.dist < PATH_HALF_WIDTH + 3) ground = Math.min(ground, sampleArray(pathHeights, onPath.index));
    level = Math.min(level, ground - 0.9);
    creekWater[i] = Math.max(level, 0.4);
    if (ground < 0.5 && creekEnd === creekSamples.length - 1 && i > creekSamples.length / 2) creekEnd = i;
  }

  // Bridge where path and creek cross.
  let bestDist = Infinity;
  let bridgeIndex = 0;
  for (let i = 0; i < pathSamples.length; i++) {
    const p = pathSamples[i]!;
    const r = nearestOnPolyline(creek, p.x, p.z, 4);
    if (r.dist < bestDist) {
      bestDist = r.dist;
      bridgeIndex = i;
    }
  }
  const bp = pathSamples[bridgeIndex]!;
  const prev = pathSamples[Math.max(bridgeIndex - 3, 0)]!;
  const next = pathSamples[Math.min(bridgeIndex + 3, pathSamples.length - 1)]!;
  // The deck spans the whole carved channel (see carving below) so both ends
  // sit on flat path ground; its top is only a small step above the path.
  const bridge = {
    x: bp.x,
    z: bp.z,
    y: pathHeights[bridgeIndex]! - 0.03,
    angle: Math.atan2(next.x - prev.x, next.z - prev.z),
    length: (CREEK_CARVE_WIDTH + 0.8) * 2,
  };

  const heights = new Float32Array(NX * NZ);
  const pathMask = new Float32Array(NX * NZ);
  const creekMask = new Float32Array(NX * NZ);
  const pathDist = new Float32Array(NX * NZ).fill(DIST_CAP);
  const creekDist = new Float32Array(NX * NZ).fill(DIST_CAP);

  const pathEnd = pathSamples[pathSamples.length - 1]!;
  const pathEndHeight = pathHeights[pathHeights.length - 1]!;

  for (let iz = 0; iz < NZ; iz++) {
    const z = GRID.minZ + iz * GRID.step;
    for (let ix = 0; ix < NX; ix++) {
      const x = GRID.minX + ix * GRID.step;
      let h = baseHeight(x, z);

      // Flatten along the path.
      const onPath = nearestOnPolyline(path, x, z, DIST_CAP);
      pathDist[iz * NX + ix] = Math.min(onPath.dist, DIST_CAP);
      if (onPath.dist < PATH_HALF_WIDTH + 6) {
        const ph = sampleArray(pathHeights, onPath.index);
        h = lerp(ph, h, smoothstep(PATH_HALF_WIDTH + 0.5, PATH_HALF_WIDTH + 6, onPath.dist));
        pathMask[iz * NX + ix] = 1 - smoothstep(PATH_HALF_WIDTH - 0.2, PATH_HALF_WIDTH + 0.4, onPath.dist);
      }

      // Level pad for the house at the end of the path.
      const dh = Math.hypot(x - HOUSE_POSITION.x, z - HOUSE_POSITION.z);
      if (dh < 16) h = lerp(pathEndHeight, h, smoothstep(9, 16, dh));
      const de = Math.hypot(x - pathEnd.x, z - pathEnd.z);
      if (de < 8) h = lerp(pathEndHeight, h, smoothstep(4, 8, de));

      // Carve the creek bed (only ever lowers the ground).
      const onCreek = nearestOnPolyline(creek, x, z, DIST_CAP);
      if (onCreek.index <= creekEnd + 2) creekDist[iz * NX + ix] = Math.min(onCreek.dist, DIST_CAP);
      if (onCreek.dist < CREEK_CARVE_WIDTH && onCreek.index <= creekEnd + 2) {
        const bed = sampleArray(creekWater, onCreek.index) - 0.7;
        const carved = lerp(bed, h, smoothstep(CREEK_HALF_WIDTH * 0.6, CREEK_CARVE_WIDTH, onCreek.dist));
        if (carved < h) h = carved;
        creekMask[iz * NX + ix] = 1 - smoothstep(CREEK_HALF_WIDTH * 0.8, CREEK_HALF_WIDTH + 1, onCreek.dist);
      }

      heights[iz * NX + ix] = h;
    }
  }

  return { nx: NX, nz: NZ, heights, pathMask, creekMask, pathDist, creekDist, path, pathHeights, creek, creekWater, creekEnd, bridge };
}

let cached: TerrainData | null = null;

export function getTerrain(): TerrainData {
  cached ??= build();
  return cached;
}

/** Bilinear ground height at any world position (outside the grid: deep sea). */
export function sampleHeight(x: number, z: number): number {
  const t = getTerrain();
  const gx = (x - GRID.minX) / GRID.step;
  const gz = (z - GRID.minZ) / GRID.step;
  if (gx < 0 || gz < 0 || gx > t.nx - 1 || gz > t.nz - 1) return -7;
  const ix = Math.min(Math.floor(gx), t.nx - 2);
  const iz = Math.min(Math.floor(gz), t.nz - 2);
  const fx = gx - ix;
  const fz = gz - iz;
  const h = t.heights;
  const i = iz * t.nx + ix;
  return lerp(lerp(h[i]!, h[i + 1]!, fx), lerp(h[i + t.nx]!, h[i + t.nx + 1]!, fx), fz);
}

/**
 * Water surface at (x, z): the creek level inside the creek channel, else the
 * sea level. Callers compare it with the ground/feet height.
 */
export function waterSurfaceAt(x: number, z: number): number {
  const t = getTerrain();
  const onCreek = nearestOnPolyline(t.creek, x, z, CREEK_HALF_WIDTH);
  if (onCreek.dist < CREEK_HALF_WIDTH && onCreek.index <= t.creekEnd) {
    return Math.max(sampleArray(t.creekWater, onCreek.index), SEA_LEVEL);
  }
  return SEA_LEVEL;
}

/** Height of the walkable path surface at a fractional path sample index. */
export function pathHeightAt(index: number): number {
  return sampleArray(getTerrain().pathHeights, index);
}
