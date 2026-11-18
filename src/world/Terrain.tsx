import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import { GRID, getTerrain } from './terrain.ts';
import { fbm, smoothstep } from './math.ts';
import { PALETTE } from '../content/palette.ts';

const GRASS = new Color(PALETTE.grassDay);
const GRASS_DARK = new Color('#4F6B2A');
const SAND = new Color('#CDBB8A');
const SEABED = new Color('#6B6A55');
/** Deep sea floor blends into the water colour so the grid edge is invisible. */
const DEEP = new Color('#123E50');
const ROCK = new Color('#6F6A63');
const PATH = new Color(PALETTE.pathStone);
const CREEK_BED = new Color('#4A5546');

function buildGeometry() {
  const t = getTerrain();
  const { nx, nz, heights } = t;
  const positions = new Float32Array(nx * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      positions[i * 3] = GRID.minX + ix * GRID.step;
      positions[i * 3 + 1] = heights[i]!;
      positions[i * 3 + 2] = GRID.minZ + iz * GRID.step;
    }
  }

  const indices = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter-clockwise seen from above (+y) so normals point up.
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(nx * nz * 3);
  const c = new Color();
  for (let i = 0; i < nx * nz; i++) {
    const x = positions[i * 3]!;
    const z = positions[i * 3 + 2]!;
    const h = heights[i]!;
    const slope = 1 - normals.getY(i);

    c.copy(GRASS).lerp(GRASS_DARK, fbm(x * 0.06, z * 0.06, 3));
    c.lerp(SAND, smoothstep(1.6, 0.6, h));
    c.lerp(SEABED, smoothstep(-0.2, -2, h));
    c.lerp(DEEP, smoothstep(-2.5, -6, h));
    c.lerp(ROCK, smoothstep(0.25, 0.45, slope));
    c.lerp(CREEK_BED, t.creekMask[i]! * 0.85);
    c.lerp(PATH, t.pathMask[i]!);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  return { geometry, positions, indices };
}

export function Terrain() {
  const { geometry, positions, indices } = useMemo(() => buildGeometry(), []);

  return (
    // Steep terrain is climbable (the slope check happens in the player's locomotion).
    <RigidBody type="fixed" colliders={false} userData={{ climbable: true }}>
      <TrimeshCollider args={[positions, indices]} />
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
    </RigidBody>
  );
}
