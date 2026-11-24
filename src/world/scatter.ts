import { PROJECTS } from '../content/projects.ts';
import { computePortalPlacements } from '../portals/placement.ts';
import { DOCK, HOUSE_POSITION, PATH_HALF_WIDTH, WINDMILL_POSITION } from './layout.ts';
import { CLIMB_ROCK, DIST_CAP, getTerrain } from './terrain.ts';
import { sampleGrid } from './surface.ts';

/** Small deterministic PRNG (mulberry32) so the world looks the same every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Zone {
  x: number;
  z: number;
  r: number;
}

let zones: Zone[] | null = null;

/** Places that must stay clear of vegetation and props. */
function keepOutZones(): Zone[] {
  if (zones) return zones;
  const t = getTerrain();
  const list: Zone[] = [
    { x: HOUSE_POSITION.x, z: HOUSE_POSITION.z, r: 8 },
    { x: WINDMILL_POSITION.x, z: WINDMILL_POSITION.z, r: 4.5 },
    { x: t.bridge.x, z: t.bridge.z, r: t.bridge.length / 2 + 1 },
    { x: DOCK.x, z: DOCK.z, r: 4 },
    { x: DOCK.x + 6, z: DOCK.z + 2, r: 4 },
  ];
  for (const p of computePortalPlacements(PROJECTS.length)) {
    list.push({ x: p.x, z: p.z, r: 2.6 });
    list.push({ x: p.interact.x, z: p.interact.z, r: 1.6 });
  }
  zones = list;
  return list;
}

/**
 * Open ground kept free of trees and rocks: the meadow east of the path, the
 * approaches to the climbing rock (east and south, also the glide line) and
 * the beach at the start. The movement smoke tests run there as well.
 */
const OPEN_AREAS = [
  { minX: 8, maxX: 80, minZ: 19, maxZ: 31 },
  { minX: -68, maxX: -36, minZ: -33, maxZ: -19 },
  { minX: -81, maxX: -67, minZ: -22, maxZ: -4 },
  { minX: -16, maxX: 22, minZ: 44, maxZ: 80 },
];

export interface FreeOptions {
  /** Minimum distance from the path edge. */
  path?: number;
  /** Minimum distance from the creek centre line. */
  creek?: number;
  /** Extra radius around keep-out zones. */
  margin?: number;
  /** Keep the climbing mesa (walls and top) clear. */
  mesa?: boolean;
  /** Allow the open areas (for grass). */
  ignoreOpen?: boolean;
}

/** True if (x, z) is free for scattering under the given clearances. */
export function isFree(x: number, z: number, opts: FreeOptions = {}): boolean {
  const t = getTerrain();
  const pathClear = opts.path ?? 0;
  const pd = sampleGrid(t.pathDist, x, z);
  if (pd < DIST_CAP && pd < PATH_HALF_WIDTH + pathClear) return false;
  const cd = sampleGrid(t.creekDist, x, z);
  if (opts.creek !== undefined && cd < opts.creek) return false;
  if (opts.mesa && Math.hypot(x - CLIMB_ROCK.x, (z - CLIMB_ROCK.z) * 1.15) < CLIMB_ROCK.radius + 4) return false;
  for (const a of opts.ignoreOpen ? [] : OPEN_AREAS) {
    if (x > a.minX && x < a.maxX && z > a.minZ && z < a.maxZ) return false;
  }
  const m = opts.margin ?? 0;
  for (const zn of keepOutZones()) {
    if (Math.hypot(x - zn.x, z - zn.z) < zn.r + m) return false;
  }
  return true;
}
