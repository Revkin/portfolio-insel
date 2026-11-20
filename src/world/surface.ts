import { CLIMB_ROCK, GRID, getTerrain } from './terrain.ts';
import { HOUSE_POSITION, PATH_HALF_WIDTH, WINDMILL_POSITION } from './layout.ts';
import { clamp, fbm, lerp, smoothstep, valueNoise } from './math.ts';

/**
 * Ground surface per terrain vertex, shared by the terrain material, grass
 * and scattering: which material covers the ground and how dense grass grows.
 */
export interface SurfaceData {
  /** Per vertex: weights of sand, rock, dirt, cobble (grass = the rest). */
  splat: Float32Array;
  /** Per vertex: 0..1 grass density. */
  grass: Float32Array;
  /** Per vertex: 0..1 slope (0 = flat, 1 = vertical). */
  slope: Float32Array;
}

let cached: SurfaceData | null = null;

export function getSurface(): SurfaceData {
  cached ??= build();
  return cached;
}

function build(): SurfaceData {
  const t = getTerrain();
  const { nx, nz, heights } = t;
  const splat = new Float32Array(nx * nz * 4);
  const grass = new Float32Array(nx * nz);
  const slope = new Float32Array(nx * nz);
  const s = GRID.step;

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const x = GRID.minX + ix * s;
      const z = GRID.minZ + iz * s;
      const h = heights[i]!;

      // Slope from central differences.
      const hx = heights[iz * nx + Math.min(ix + 1, nx - 1)]! - heights[iz * nx + Math.max(ix - 1, 0)]!;
      const hz = heights[Math.min(iz + 1, nz - 1) * nx + ix]! - heights[Math.max(iz - 1, 0) * nx + ix]!;
      const gx = hx / (2 * s);
      const gz = hz / (2 * s);
      const sl = 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
      slope[i] = sl;

      const n1 = fbm(x * 0.35, z * 0.35, 2);
      const n2 = valueNoise(x * 0.9 + 11, z * 0.9 - 4);

      // Rock on steep ground; the climbing mesa and the west cliff are rocky anyway.
      const mesa = smoothstep(CLIMB_ROCK.radius + 2.5, CLIMB_ROCK.radius - 0.5, Math.hypot(x - CLIMB_ROCK.x, (z - CLIMB_ROCK.z) * 1.15));
      let rock = Math.max(smoothstep(0.12, 0.3, sl + (n1 - 0.5) * 0.12), mesa * (h > 8 ? 0.55 : 1));
      // Beach and sea floor.
      let sand = smoothstep(1.7 + (n1 - 0.5) * 0.8, 0.8, h);
      // Path: cobbles in the middle, packed dirt around them and at the edges.
      const pd = t.pathDist[i]!;
      const pathCore = 1 - smoothstep(PATH_HALF_WIDTH - 0.5, PATH_HALF_WIDTH + 0.2, pd + (n2 - 0.5) * 0.6);
      const pathEdge = 1 - smoothstep(PATH_HALF_WIDTH, PATH_HALF_WIDTH + 1.6, pd + (n1 - 0.5) * 1.4);
      let cobble = pathCore * smoothstep(0.32, 0.55, fbm(x * 0.45 + 3, z * 0.45 - 1, 2));
      let dirt = Math.max(pathCore - cobble, pathEdge * 0.75);
      // Creek bed: dirt and pebbles.
      const cd = t.creekDist[i]!;
      const creekBed = 1 - smoothstep(2.4, 4.2, cd + (n1 - 0.5));
      dirt = Math.max(dirt, creekBed * 0.6);
      rock = Math.max(rock, creekBed * 0.4);
      // Trampled ground around house and windmill.
      const dh = Math.hypot(x - HOUSE_POSITION.x, z - HOUSE_POSITION.z);
      dirt = Math.max(dirt, (1 - smoothstep(6, 10, dh + (n1 - 0.5) * 3)) * 0.8);
      const dw = Math.hypot(x - WINDMILL_POSITION.x, z - WINDMILL_POSITION.z);
      dirt = Math.max(dirt, (1 - smoothstep(3.5, 6, dw + (n1 - 0.5) * 2)) * 0.7);

      // Priorities: path beats rock beats sand.
      cobble = clamp(cobble, 0, 1);
      dirt = clamp(dirt, 0, 1 - cobble);
      rock = clamp(rock * (1 - pathCore), 0, 1 - cobble - dirt);
      sand = clamp(sand, 0, 1 - cobble - dirt - rock);
      splat[i * 4] = sand;
      splat[i * 4 + 1] = rock;
      splat[i * 4 + 2] = dirt;
      splat[i * 4 + 3] = cobble;

      const bare = sand + rock + dirt + cobble;
      // Patchy density, thinner near the coast.
      const patches = lerp(0.55, 1, smoothstep(0.3, 0.6, fbm(x * 0.07 - 5, z * 0.07 + 2, 3)));
      grass[i] = clamp(1 - bare * 1.6, 0, 1) * patches * smoothstep(0.9, 1.8, h);
    }
  }
  return { splat, grass, slope };
}

/** Bilinear lookup of a per-vertex array (stride 1) at a world position. */
export function sampleGrid(values: Float32Array, x: number, z: number, stride = 1, offset = 0): number {
  const { nx, nz } = getTerrain();
  const gx = clamp((x - GRID.minX) / GRID.step, 0, nx - 1.001);
  const gz = clamp((z - GRID.minZ) / GRID.step, 0, nz - 1.001);
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const v = (jx: number, jz: number) => values[((iz + jz) * nx + ix + jx) * stride + offset]!;
  return lerp(lerp(v(0, 0), v(1, 0), fx), lerp(v(0, 1), v(1, 1), fx), fz);
}
