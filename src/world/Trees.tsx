import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three';
import { GRID, sampleHeight } from './terrain.ts';
import { getSurface, sampleGrid } from './surface.ts';
import { fbm } from './math.ts';
import { isFree, rng } from './scatter.ts';
import { bush, createLeafTexture, deciduousTree, pineTree, type TreeVariant } from './treeGeometry.ts';

type Kind = 'tree' | 'pine' | 'bush';

interface Placement {
  kind: Kind;
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

const VARIANTS: Record<Kind, number> = { tree: 4, pine: 3, bush: 3 };
/** Minimum distance between two trunks (metres). */
const SPACING: Record<Kind, number> = { tree: 6, pine: 4.5, bush: 2.2 };
const TARGET: Record<Kind, number> = { tree: 26, pine: 30, bush: 55 };

function place(): Placement[] {
  const random = rng(4242);
  const surface = getSurface();
  const out: Placement[] = [];
  const kinds: Kind[] = ['tree', 'pine', 'bush'];
  for (const kind of kinds) {
    let placed = 0;
    for (let attempt = 0; attempt < 6000 && placed < TARGET[kind]; attempt++) {
      const x = GRID.minX + random() * (GRID.maxX - GRID.minX);
      const z = GRID.minZ + random() * (GRID.maxZ - GRID.minZ);
      const y = sampleHeight(x, z);
      if (y < 1.6) continue;
      if (sampleGrid(surface.grass, x, z) < 0.35 || sampleGrid(surface.slope, x, z) > 0.2) continue;
      // Woods in loose groups; pines rather in the east and north, round trees in the west.
      const groups = fbm(x * 0.03 + 5, z * 0.03 - 8, 3);
      const east = (x + 100) / 200;
      const bias = kind === 'pine' ? east * 0.5 + (z < -10 ? 0.15 : 0) : kind === 'tree' ? (1 - east) * 0.45 : 0.3;
      if (groups + bias < 0.72) continue;
      const clear = kind === 'bush' ? 1.5 : 4.5;
      if (!isFree(x, z, { path: clear, creek: kind === 'bush' ? 3 : 4.5, margin: kind === 'bush' ? 0.5 : 2.5, mesa: true })) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(SPACING[p.kind], SPACING[kind]) * (p.kind === kind ? 1 : 0.6))) continue;
      out.push({
        kind,
        variant: Math.floor(random() * VARIANTS[kind]),
        x,
        y,
        z,
        yaw: random() * Math.PI * 2,
        scale: 0.8 + random() * 0.45,
      });
      placed++;
    }
  }
  return out;
}

interface TreeState {
  placements: Placement[];
  meshes: InstancedMesh[];
  uniforms: { uTime: { value: number } };
}

let state: TreeState | null = null;

function swayMaterial(material: MeshStandardMaterial, amount: number, uniforms: TreeState['uniforms']) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
vec3 ip = vec3(0.0);
#endif
float hgt = max(position.y - 1.0, 0.0);
float sway = sin(uTime * 0.9 + ip.x * 0.3 + ip.z * 0.2) * ${amount.toFixed(3)} * hgt;
transformed.x += sway;
transformed.z += sway * 0.6;
transformed += normal * sin(uTime * 4.0 + position.x * 3.0 + position.y * 2.0 + ip.x) * ${(amount * 0.4).toFixed(3)};`,
      );
  };
  material.customProgramCacheKey = () => `sway-${amount}`;
}

function getTrees(): TreeState {
  if (state) return state;
  const uniforms = { uTime: { value: 0 } };
  const placements = place();
  const leafTexture = createLeafTexture();
  const bark = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const leaves = new MeshStandardMaterial({
    vertexColors: true,
    map: leafTexture,
    alphaTest: 0.5,
    side: DoubleSide,
    roughness: 0.8,
  });
  swayMaterial(leaves, 0.02, uniforms);
  const needles = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide });
  swayMaterial(needles, 0.012, uniforms);

  const builders: Record<Kind, (seed: number) => TreeVariant> = { tree: deciduousTree, pine: pineTree, bush };
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  for (const kind of Object.keys(VARIANTS) as Kind[]) {
    for (let v = 0; v < VARIANTS[kind]; v++) {
      const list = placements.filter((pl) => pl.kind === kind && pl.variant === v);
      if (list.length === 0) continue;
      const variant = builders[kind](1000 + v * 17 + kind.length * 101);
      const parts: [BufferGeometry, MeshStandardMaterial][] = [[variant.foliage, kind === 'pine' ? needles : leaves]];
      if (variant.trunk.getAttribute('position')) parts.push([variant.trunk, bark]);
      for (const [geometry, material] of parts) {
        const mesh = new InstancedMesh(geometry, material, list.length);
        list.forEach((pl, i) => {
          q.setFromAxisAngle(new Vector3(0, 1, 0), pl.yaw);
          s.setScalar(pl.scale);
          p.set(pl.x, pl.y, pl.z);
          mesh.setMatrixAt(i, m.compose(p, q, s));
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        meshes.push(mesh);
      }
    }
  }
  state = { placements, meshes, uniforms };
  return state;
}

function updateTrees(time: number) {
  getTrees().uniforms.uTime.value = time;
}

/** Trees, pines and bushes, instanced per variant; trunks get colliders. */
export function Trees() {
  const { placements, meshes } = getTrees();
  useFrame((s) => updateTrees(s.clock.elapsedTime));
  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {placements
          .filter((pl) => pl.kind !== 'bush')
          .map((pl, i) => (
            <CylinderCollider key={i} args={[1.6, (pl.kind === 'pine' ? 0.3 : 0.4) * pl.scale]} position={[pl.x, pl.y + 1.4, pl.z]} />
          ))}
      </RigidBody>
    </group>
  );
}

/** For other systems (rocks, props) that should not overlap trees. */
export function treePositions(): { x: number; z: number; r: number }[] {
  return getTrees().placements.map((p) => ({ x: p.x, z: p.z, r: p.kind === 'bush' ? 1.2 : 2 }));
}
