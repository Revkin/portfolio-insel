import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import { GRID, getTerrain } from './terrain.ts';
import { getSurface } from './surface.ts';
import { fbm, smoothstep } from './math.ts';
import { createTerrainMaterial } from './terrainMaterial.ts';
import { useTextureArray } from './textures.ts';

/*
 * Vertex colours only tint the textured ground: large-scale variation in the
 * grass, wet sand at the waterline and a blue-green cast under water.
 */
/** The grass ground texture is olive; pull it towards the colour of the blades. */
const TINT_GRASS = new Color('#7E9A55');
const TINT_LUSH = new Color('#5F8A3C');
const TINT_DRY = new Color('#D8C890');
const WET = new Color('#9A9080');
const UNDERWATER = new Color('#5E8C88');
const DEEP = new Color('#173F4D');

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

  const surface = getSurface();
  const colors = new Float32Array(nx * nz * 3);
  const c = new Color();
  for (let i = 0; i < nx * nz; i++) {
    const x = positions[i * 3]!;
    const z = positions[i * 3 + 2]!;
    const h = heights[i]!;
    c.setRGB(1, 1, 1);
    // Patches of lusher and drier grass (only visible where grass ground shows).
    const grassGround = 1 - surface.splat[i * 4]! - surface.splat[i * 4 + 1]! - surface.splat[i * 4 + 2]! - surface.splat[i * 4 + 3]!;
    c.lerp(TINT_GRASS, grassGround * 0.9);
    c.lerp(TINT_LUSH, grassGround * smoothstep(0.35, 0.7, fbm(x * 0.05, z * 0.05, 3)) * 0.8);
    c.lerp(TINT_DRY, grassGround * smoothstep(0.55, 0.8, fbm(x * 0.04 + 9, z * 0.04 - 3, 3)) * 0.6);
    c.lerp(WET, smoothstep(0.9, 0.2, h) * 0.7);
    c.lerp(UNDERWATER, smoothstep(0.1, -1.2, h));
    c.lerp(DEEP, smoothstep(-2, -6, h));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('splat', new BufferAttribute(surface.splat, 4));

  return { geometry, positions, indices };
}

export function Terrain() {
  const { geometry, positions, indices } = useMemo(() => buildGeometry(), []);
  const albedo = useTextureArray('terrain-albedo', true);
  const normal = useTextureArray('terrain-normal', false);
  const material = useMemo(() => createTerrainMaterial(albedo, normal), [albedo, normal]);

  return (
    // Steep terrain is climbable (the slope check happens in the player's locomotion).
    <RigidBody type="fixed" colliders={false} userData={{ climbable: true }}>
      <TrimeshCollider args={[positions, indices]} />
      <mesh geometry={geometry} material={material} receiveShadow castShadow />
    </RigidBody>
  );
}
