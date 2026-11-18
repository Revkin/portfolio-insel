import { PATH_HALF_WIDTH } from '../world/layout.ts';
import { getTerrain, sampleHeight } from '../world/terrain.ts';
import { sampleArray } from '../world/math.ts';

export interface PortalPlacement {
  /** Ground position of the portal centre. */
  x: number;
  y: number;
  z: number;
  /** Rotation around y; the portal's front (+z local) faces the path. */
  rotationY: number;
  /** Point in front of the portal used for the interaction distance check. */
  interact: { x: number; z: number };
  /** Unit vector pointing out of the portal front. */
  front: { x: number; z: number };
}

const PATH_START = 0.1;
const PATH_END = 0.86;
const SIDE_OFFSET = PATH_HALF_WIDTH + 3.2;
/** Keep portals away from the bridge (in path fractions). */
const BRIDGE_CLEARANCE = 0.05;

/**
 * Evenly distributes `count` portals along the path, alternating sides.
 * Positions depend only on the number of projects (SPEC section 4).
 */
export function computePortalPlacements(count: number): PortalPlacement[] {
  const t = getTerrain();
  const { xs, zs } = t.path;
  const n = xs.length;

  // Path fraction of the bridge.
  let bridgeFrac = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(xs[i]! - t.bridge.x, zs[i]! - t.bridge.z);
    if (d < best) {
      best = d;
      bridgeFrac = i / (n - 1);
    }
  }

  const placements: PortalPlacement[] = [];
  for (let k = 0; k < count; k++) {
    let frac = PATH_START + ((k + 0.5) / count) * (PATH_END - PATH_START);
    if (Math.abs(frac - bridgeFrac) < BRIDGE_CLEARANCE) {
      frac = bridgeFrac + Math.sign(frac - bridgeFrac || 1) * BRIDGE_CLEARANCE;
    }
    const index = frac * (n - 1);
    const px = sampleArray(xs, index);
    const pz = sampleArray(zs, index);
    const i0 = Math.max(Math.floor(index) - 2, 0);
    const i1 = Math.min(Math.floor(index) + 2, n - 1);
    let tx = xs[i1]! - xs[i0]!;
    let tz = zs[i1]! - zs[i0]!;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;

    const side = k % 2 === 0 ? 1 : -1;
    // Left-hand normal of the path direction.
    const nx = -tz * side;
    const nz = tx * side;
    const x = px + nx * SIDE_OFFSET;
    const z = pz + nz * SIDE_OFFSET;
    // Front faces back towards the path centre.
    const front = { x: -nx, z: -nz };
    placements.push({
      x,
      y: sampleHeight(x, z),
      z,
      rotationY: Math.atan2(front.x, front.z),
      front,
      interact: { x: x + front.x * 1.4, z: z + front.z * 1.4 },
    });
  }
  return placements;
}
