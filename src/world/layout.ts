import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * World layout (docs/SPEC.md, section 4). Coordinates in metres:
 * +x = east, -z = north, y = up, sea level = 0. Island ≈ 200 × 150 m.
 */
export const SEA_LEVEL = 0;
export const ISLAND_RADIUS_X = 100;
export const ISLAND_RADIUS_Z = 75;

export const PATH_HALF_WIDTH = 1.5;
export const CREEK_HALF_WIDTH = 2.2;

/** Path from the beach in the south to the house on the hill in the north. */
const PATH_POINTS: [number, number][] = [
  [2, 56],
  [0, 46],
  [-6, 35],
  [-6, 23],
  [0, 12],
  [4, 0],
  [5, -12],
  [1, -24],
  [7, -35],
  [17, -44],
  [27, -51],
];

/**
 * Creek from a spring in the east to the waterfall over the west cliff
 * (direction taken from the reference images, see open question in ai-log).
 */
const CREEK_POINTS: [number, number][] = [
  [64, -10],
  [56, -4],
  [42, 2],
  [24, 2],
  [5, -1],
  [-16, 5],
  [-38, 9],
  [-60, 8],
  [-82, 12],
  [-106, 16],
];

export const HOUSE_POSITION = { x: 32, z: -57 };
export const WINDMILL_POSITION = { x: -18, z: -52 };

function curve(points: [number, number][]) {
  return new CatmullRomCurve3(
    points.map(([x, z]) => new Vector3(x, 0, z)),
    false,
    'centripetal',
  );
}

export const PATH_SAMPLES = 400;
export const CREEK_SAMPLES = 400;

/** Evenly spaced samples along the path (x, z only; y = 0). */
export const pathSamples = curve(PATH_POINTS).getSpacedPoints(PATH_SAMPLES - 1);
export const creekSamples = curve(CREEK_POINTS).getSpacedPoints(CREEK_SAMPLES - 1);
