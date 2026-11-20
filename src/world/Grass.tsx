import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
} from 'three';
import { GRID, getTerrain, sampleHeight } from './terrain.ts';
import { getSurface, sampleGrid } from './surface.ts';
import { fbm } from './math.ts';
import { isFree, rng } from './scatter.ts';
import { playerState } from '../player/playerState.ts';

/** Edge length of one grass chunk (metres). */
const CHUNK = 12;
/** Blades per square metre at full density. */
const DENSITY = 34;
/** Grass is drawn up to this distance from the camera, thinning out towards it. */
const DRAW_DISTANCE = 52;
/** Full density up to here. */
const FULL_DENSITY_DISTANCE = 14;

/** One tapered blade, 4 segments, y in [0, 1], width 1 at the root. */
function bladeGeometry(): InstancedBufferGeometry {
  const rows = 4;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let r = 0; r < rows; r++) {
    const v = r / rows;
    const w = 0.5 * (1 - v * 0.85);
    pos.push(-w, v, 0, w, v, 0);
    uv.push(0, v, 1, v);
  }
  pos.push(0, 1, 0);
  uv.push(0.5, 1);
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const t = (rows - 1) * 2;
  index.push(t, t + 1, t + 2);
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  // Normals point up: grass is lit like a soft surface, not like thin cards.
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
}

function createGrassMaterial(uniforms: Record<string, { value: unknown }>): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 iPos;   // x, y, z, yaw
attribute vec4 iShape; // height, width, lean, colour variation
uniform float uTime;
uniform vec3 uPlayer;
uniform float uDrawDistance;
varying float vHeight;
varying float vVar;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = position;
float h = iShape.x;
float d = distance(cameraPosition.xz, iPos.xz);
// Shrink towards the draw distance so the edge is invisible.
h *= smoothstep(uDrawDistance, uDrawDistance * 0.72, d);
float v = position.y;
vHeight = v;
vVar = iShape.w;
float c = cos(iPos.w), s = sin(iPos.w);
vec3 p = vec3(position.x * iShape.y, 0.0, 0.0);
// Natural lean plus wind: gusts travel across the island.
float gust = sin(uTime * 1.3 + iPos.x * 0.15 + iPos.z * 0.1) * 0.5 + 0.5;
float flutter = sin(uTime * 4.0 + iPos.x * 1.7 + iPos.z * 2.3) * 0.12;
vec2 lean = vec2(c, s) * iShape.z + vec2(0.55, 0.25) * (gust * 0.55 + flutter);
// Push away from the player.
vec2 away = iPos.xz - uPlayer.xz;
float dp = length(away);
float push = smoothstep(1.1, 0.2, dp) * step(abs(iPos.y - uPlayer.y), 1.5);
lean += (dp > 0.001 ? away / dp : vec2(0.0)) * push * 1.4;
float bend = v * v;
p = vec3(p.x * c, 0.0, -p.x * s);
p.xz += lean * bend * h * 0.55;
p.y = v * h * (1.0 - 0.25 * min(length(lean), 1.2) * bend);
transformed = iPos.xyz + p;`,
      )
      // Instances are placed in world space; skip the (identity) instancing chunk.
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');

    shader.fragmentShader = shader.fragmentShader
      // Both faces use the same upward normal (no dark back sides).
      .replace(
        '#include <normal_fragment_begin>',
        `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
vec3 normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
vec3 nonPerturbedNormal = normal;`,
      )
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uRoot;
uniform vec3 uTip;
uniform vec3 uDry;
varying float vHeight;
varying float vVar;`,
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec3 tip = mix(uTip, uDry, smoothstep(0.55, 1.0, vVar));
vec3 grassCol = mix(uRoot, tip, smoothstep(0.0, 0.9, vHeight));
grassCol *= 0.85 + 0.3 * fract(vVar * 7.31);
vec4 diffuseColor = vec4(grassCol, opacity);`,
      );
  };
  m.customProgramCacheKey = () => 'grass-v1';
  return m;
}

type GrassUniforms = {
  uTime: { value: number };
  uPlayer: { value: Vector3 };
  uDrawDistance: { value: number };
  uRoot: { value: Color };
  uTip: { value: Color };
  uDry: { value: Color };
};

interface Chunk {
  mesh: Mesh;
  center: Vector3;
  total: number;
}

function buildChunks(uniforms: Record<string, { value: unknown }>): Chunk[] {
  const t = getTerrain();
  const surface = getSurface();
  const base = bladeGeometry();
  const material = createGrassMaterial(uniforms);
  const chunks: Chunk[] = [];
  const random = rng(1337);

  for (let cz = GRID.minZ; cz < GRID.maxZ; cz += CHUNK) {
    for (let cx = GRID.minX; cx < GRID.maxX; cx += CHUNK) {
      // Skip chunks without any grass (sea, rock) quickly.
      let any = false;
      for (let sz = 0; sz <= 4 && !any; sz++) {
        for (let sx = 0; sx <= 4 && !any; sx++) any = sampleGrid(surface.grass, cx + (sx * CHUNK) / 4, cz + (sz * CHUNK) / 4) > 0;
      }
      if (!any) continue;
      const pos: number[] = [];
      const shape: number[] = [];
      const candidates = CHUNK * CHUNK * DENSITY;
      for (let k = 0; k < candidates; k++) {
        const x = cx + random() * CHUNK;
        const z = cz + random() * CHUNK;
        const r = random();
        const density = sampleGrid(surface.grass, x, z);
        if (r > density) continue;
        if (!isFree(x, z, { path: 0.15 })) continue;
        const y = sampleHeight(x, z);
        // Taller grass in clumps and away from the path.
        const clump = fbm(x * 0.12 + 7, z * 0.12 - 3, 2);
        const pd = sampleGrid(t.pathDist, x, z);
        const tall = random() < 0.12 ? 1.6 : 1;
        const height = (0.16 + clump * 0.42 + random() * 0.22) * tall * (0.5 + 0.5 * Math.min(1, (pd - 1.4) / 2.5));
        pos.push(x, y - 0.03, z, random() * Math.PI * 2);
        shape.push(height, 0.028 + random() * 0.03, (random() - 0.5) * 1.6, fbm(x * 0.05 - 2, z * 0.05 + 5, 2) * 0.6 + random() * 0.4);
      }
      const count = pos.length / 4;
      if (count === 0) continue;
      const g = base.clone() as InstancedBufferGeometry;
      g.setAttribute('iPos', new InstancedBufferAttribute(new Float32Array(pos), 4));
      g.setAttribute('iShape', new InstancedBufferAttribute(new Float32Array(shape), 4));
      g.instanceCount = count;
      const center = new Vector3(cx + CHUNK / 2, sampleHeight(cx + CHUNK / 2, cz + CHUNK / 2), cz + CHUNK / 2);
      // Bounds for frustum culling (instances are in world space).
      g.boundingSphere = new Sphere(center.clone(), CHUNK * 0.75 + 4);
      const mesh = new Mesh(g, material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      chunks.push({ mesh, center, total: count });
    }
  }
  return chunks;
}

const ROOT = new Color('#1E3210');
const TIP = new Color('#7E9C38');
const DRY = new Color('#B5A750');

/**
 * Instanced grass blades in chunks. Density follows the ground surface
 * (no grass on path, sand, rock or creek bed), sways in the wind and bends
 * away from the player. Far chunks draw fewer blades and fade out by height.
 */
let grassState: { chunks: Chunk[]; uniforms: GrassUniforms } | null = null;

function getGrass() {
  if (!grassState) {
    const uniforms = {
      uTime: { value: 0 },
      uPlayer: { value: new Vector3() },
      uDrawDistance: { value: DRAW_DISTANCE },
      uRoot: { value: ROOT },
      uTip: { value: TIP },
      uDry: { value: DRY },
    };
    grassState = { chunks: buildChunks(uniforms), uniforms };
  }
  return grassState;
}

/** Per-frame update: wind time, player position and distance-based thinning. */
function updateGrass(time: number, cam: Vector3) {
  const { chunks, uniforms } = getGrass();
  uniforms.uTime.value = time;
  uniforms.uPlayer.value.copy(playerState.position);
  for (const c of chunks) {
    const d = Math.hypot(cam.x - c.center.x, cam.z - c.center.z) - CHUNK * 0.7;
    const visible = d < DRAW_DISTANCE;
    c.mesh.visible = visible;
    if (!visible) continue;
    // Thin out with distance; the shader shrinks the remaining blades.
    const f = d < FULL_DENSITY_DISTANCE ? 1 : Math.max(0.2, 1 - (d - FULL_DENSITY_DISTANCE) / (DRAW_DISTANCE - FULL_DENSITY_DISTANCE));
    (c.mesh.geometry as InstancedBufferGeometry).instanceCount = Math.ceil(c.total * f);
  }
}

export function Grass() {
  const { chunks } = getGrass();
  useFrame((state) => updateGrass(state.clock.elapsedTime, state.camera.position));

  return (
    <group>
      {chunks.map((c, i) => (
        <primitive key={i} object={c.mesh} />
      ))}
    </group>
  );
}
