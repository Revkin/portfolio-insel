import { PROJECTS } from '../content/projects.ts';
import { computePortalPlacements } from '../portals/placement.ts';
import { HOUSE_POSITION, PATH_HALF_WIDTH, WINDMILL_POSITION } from './layout.ts';
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
  ];
  for (const p of computePortalPlacements(PROJECTS.length)) {
    list.push({ x: p.x, z: p.z, r: 2.6 });
    list.push({ x: p.interact.x, z: p.interact.z, r: 1.6 });
  }
  zones = list;
  return list;
}

export interface FreeOptions {
  /** Minimum distance from the path edge. */
  path?: number;
  /** Minimum distance from the creek centre line. */
  creek?: number;
  /** Extra radius around keep-out zones. */
  margin?: number;
  /** Keep the climbing mesa (walls and top) clear. */
  mesa?: boolean;
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
  const m = opts.margin ?? 0;
  for (const zn of keepOutZones()) {
    if (Math.hypot(x - zn.x, z - zn.z) < zn.r + m) return false;
  }
  return true;
}
