import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  MeshStandardMaterial,
  NormalBlending,
  PerspectiveCamera,
  Quaternion,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { PALETTE } from '../content/palette.ts';
import { HOUSE_POSITION } from './layout.ts';
import { getTerrain, sampleHeight } from './terrain.ts';
import { usePbrSet } from './textures.ts';
import { beam, box, catenary, cylinder, merged, neonMaterial, part, pbrMaterial, transform, tube, type Vec3 } from './build.ts';
import { lanternGlow } from './props.ts';
import { PropInstances } from './PropInstances.tsx';

/*
 * The house at the end of the path (SPEC 4.6): stone base, plank walls, clay
 * roof, warm windows, neon signs without text, antennas, a dish, cables,
 * crates and barrels, smoke from the chimney. Local frame: front door at +z.
 */

const W = 8;
const D = 6;
const WALL_BOTTOM = 0.8;
const WALL_TOP = 3.8;
const RIDGE = 6.0;
const CHIMNEY: Vec3 = [2.6, 0, -1.2];
const CHIMNEY_TOP = 6.8;

/** House yaw: front door towards the end of the path. */
function houseFrame() {
  const { xs, zs } = getTerrain().path;
  const ex = xs[xs.length - 1]!;
  const ez = zs[zs.length - 1]!;
  const yaw = Math.atan2(ex - HOUSE_POSITION.x, ez - HOUSE_POSITION.z);
  return { x: HOUSE_POSITION.x, y: sampleHeight(HOUSE_POSITION.x, HOUSE_POSITION.z), z: HOUSE_POSITION.z, yaw };
}

interface Parts {
  stone: BufferGeometry[];
  wall: BufferGeometry[];
  trim: BufferGeometry[];
  roof: BufferGeometry[];
  glass: BufferGeometry[];
  metal: BufferGeometry[];
  cable: BufferGeometry[];
  panel: BufferGeometry[];
  neon: Record<'cyan' | 'magenta' | 'amber' | 'lime', BufferGeometry[]>;
}

/** Window in the wall plane: frame, cross and sill around a glowing pane. */
function addWindow(p: Parts, at: Vec3, yaw: number, w = 1.1, h = 1.0) {
  const local: BufferGeometry[] = [
    box(w + 0.2, 0.12, 0.12, { position: [0, h / 2 + 0.04, 0] }),
    box(w + 0.35, 0.1, 0.22, { position: [0, -h / 2 - 0.05, 0.05] }),
    box(0.1, h, 0.12, { position: [-w / 2 - 0.05, 0, 0] }),
    box(0.1, h, 0.12, { position: [w / 2 + 0.05, 0, 0] }),
    box(0.06, h, 0.06, { position: [0, 0, 0.03] }),
    box(w, 0.06, 0.06, { position: [0, 0, 0.03] }),
  ];
  for (const g of local) p.trim.push(transform(g, at, [0, yaw, 0]));
  p.glass.push(transform(box(w, h, 0.02, { position: [0, 0, -0.02] }), at, [0, yaw, 0]));
}

/** Rectangular neon sign without text: dark panel, glowing border, simple symbols. */
function addSign(p: Parts, at: Vec3, yaw: number, w: number, h: number, border: keyof Parts['neon'], symbol: keyof Parts['neon'], kind: 'bars' | 'dots' | 'ring') {
  const place = (g: BufferGeometry) => transform(g, at, [0, yaw, 0]);
  p.panel.push(place(box(w, h, 0.08)));
  const t = 0.05;
  for (const g of [
    box(w, t, t, { position: [0, h / 2 - t, 0.05] }),
    box(w, t, t, { position: [0, -h / 2 + t, 0.05] }),
    box(t, h, t, { position: [-w / 2 + t, 0, 0.05] }),
    box(t, h, t, { position: [w / 2 - t, 0, 0.05] }),
  ])
    p.neon[border].push(place(g));
  const inner = Math.min(w, h) * 0.5;
  if (kind === 'bars') {
    for (let i = 0; i < 3; i++) p.neon[symbol].push(place(box(w * (0.55 - i * 0.12), 0.06, 0.04, { position: [-w * i * 0.06, h * 0.18 - i * h * 0.18, 0.06] })));
  } else if (kind === 'dots') {
    for (let i = 0; i < 3; i++) p.neon[symbol].push(place(box(0.12, 0.12, 0.04, { position: [0, h * 0.28 - i * h * 0.28, 0.06] })));
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.neon[symbol].push(place(box(inner * 0.42, 0.05, 0.04, { position: [Math.cos(a) * inner * 0.5, Math.sin(a) * inner * 0.5, 0.06], rotation: [0, 0, a + Math.PI / 2] })));
    }
  }
}

function buildHouse(): Parts {
  const p: Parts = { stone: [], wall: [], trim: [], roof: [], glass: [], metal: [], cable: [], panel: [], neon: { cyan: [], magenta: [], amber: [], lime: [] } };

  // Stone base, steps and chimney.
  p.stone.push(box(W + 0.5, 1.1, D + 0.5, { position: [0, WALL_BOTTOM - 0.5, 0], tile: 1.4 }));
  p.stone.push(box(1.8, 0.32, 0.9, { position: [0, 0.16, D / 2 + 0.6], tile: 1.4 }));
  p.stone.push(box(0.95, CHIMNEY_TOP - 2.5, 0.95, { position: [CHIMNEY[0], (CHIMNEY_TOP + 2.5) / 2, CHIMNEY[2]], tile: 1.4 }));
  p.stone.push(box(1.15, 0.16, 1.15, { position: [CHIMNEY[0], CHIMNEY_TOP, CHIMNEY[2]], tile: 1.4 }));

  // Plank walls and gables (triangular prism under the roof).
  p.wall.push(box(W, WALL_TOP - WALL_BOTTOM, D, { position: [0, (WALL_TOP + WALL_BOTTOM) / 2, 0], tile: 1.8 }));
  const gable = new Shape();
  gable.moveTo(-D / 2, 0);
  gable.lineTo(D / 2, 0);
  gable.lineTo(0, RIDGE - WALL_TOP);
  gable.closePath();
  p.wall.push(part(new ExtrudeGeometry(gable, { depth: W - 0.02, bevelEnabled: false }), { position: [-(W - 0.02) / 2, WALL_TOP, 0], rotation: [0, Math.PI / 2, 0], tile: 1.8 }));

  // Corner posts, beams.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.trim.push(box(0.26, WALL_TOP - WALL_BOTTOM + 0.1, 0.26, { position: [(sx * W) / 2, (WALL_TOP + WALL_BOTTOM) / 2, (sz * D) / 2] }));
  for (const sz of [-1, 1]) p.trim.push(box(W + 0.3, 0.24, 0.3, { position: [0, WALL_TOP, (sz * D) / 2] }));
  for (const sx of [-1, 1]) p.trim.push(box(0.3, 0.24, D + 0.3, { position: [(sx * W) / 2, WALL_TOP, 0] }));

  // Roof: two slabs and a ridge cap.
  const over = 0.65;
  const run = D / 2 + over;
  const rise = ((RIDGE - WALL_TOP) / (D / 2)) * run;
  const slope = Math.atan2(rise, run);
  const len = Math.hypot(run, rise);
  for (const s of [-1, 1]) {
    p.roof.push(box(W + 1.1, 0.16, len + 0.1, { position: [0, RIDGE - rise / 2 + 0.12, (s * run) / 2], rotation: [s * slope, 0, 0], tile: 1.6 }));
  }
  p.trim.push(box(W + 1.2, 0.18, 0.36, { position: [0, RIDGE + 0.2, 0] }));

  // Door with frame, lantern bracket.
  p.trim.push(box(1.1, 2.1, 0.1, { position: [0, WALL_BOTTOM + 1.05, D / 2 + 0.04] }));
  p.trim.push(box(1.45, 0.14, 0.18, { position: [0, WALL_BOTTOM + 2.17, D / 2 + 0.06] }));
  for (const sx of [-1, 1]) p.trim.push(box(0.14, 2.2, 0.18, { position: [sx * 0.64, WALL_BOTTOM + 1.1, D / 2 + 0.06] }));
  p.metal.push(box(0.05, 0.05, 0.08, { position: [0.38, WALL_BOTTOM + 1.0, D / 2 + 0.12] }));
  p.trim.push(box(0.06, 0.06, 0.5, { position: [-1.0, WALL_BOTTOM + 2.0, D / 2 + 0.25] }));

  // Windows.
  for (const x of [-2.5, 2.5]) addWindow(p, [x, 2.35, D / 2 + 0.03], 0);
  addWindow(p, [-1.6, 2.35, -D / 2 - 0.03], Math.PI);
  addWindow(p, [1.8, 2.35, -D / 2 - 0.03], Math.PI);
  for (const s of [-1, 1]) addWindow(p, [(s * W) / 2 + s * 0.03, 2.35, 0], (s * Math.PI) / 2);
  addWindow(p, [W / 2 + 0.03, 4.6, 0], Math.PI / 2, 0.7, 0.6);
  addWindow(p, [-W / 2 - 0.03, 4.6, 0], -Math.PI / 2, 0.7, 0.6);

  // Neon signs (symbols only, no text).
  addSign(p, [0, 3.35, D / 2 + 0.1], 0, 1.9, 0.55, 'cyan', 'magenta', 'bars');
  // Hanging blade sign at the front corner, readable from the path.
  p.trim.push(box(0.08, 0.08, 1.0, { position: [W / 2 + 0.05, 3.25, D / 2 - 0.2], rotation: [0, Math.PI / 2, 0] }));
  addSign(p, [W / 2 + 0.55, 2.55, D / 2 - 0.2], 0, 0.6, 1.3, 'magenta', 'amber', 'dots');
  addSign(p, [-W / 2 - 0.06, 2.45, 1.9], -Math.PI / 2, 0.75, 0.75, 'lime', 'lime', 'ring');

  // Antennas on the ridge, a dish on the back slope, cables down the walls.
  const mast = (x: number, z: number, h: number) => {
    p.metal.push(cylinder(0.035, 0.045, h, 6, { position: [x, RIDGE + h / 2, z] }));
    for (let i = 0; i < 3; i++) {
      const y = RIDGE + h * (0.55 + i * 0.16);
      const half = 0.45 - i * 0.12;
      p.metal.push(beam(new Vector3(x - half, y, z), new Vector3(x + half, y, z), 0.025));
    }
  };
  mast(-3.0, 0.05, 2.7);
  mast(-2.2, -0.1, 1.7);
  const dish = new SphereGeometry(0.6, 18, 6, 0, Math.PI * 2, 0, 0.62);
  p.metal.push(part(dish, { position: [-0.6, 5.45, -1.95], rotation: [2.1, 0.5, 0] }));
  p.metal.push(cylinder(0.04, 0.04, 0.7, 6, { position: [-0.6, 5.05, -1.75] }));
  p.cable.push(tube(catenary(new Vector3(-3.0, RIDGE + 0.1, 0.1), new Vector3(-W / 2 - 0.05, WALL_TOP - 0.2, D / 2 - 0.3), 0.35), 0.022));
  p.cable.push(tube(catenary(new Vector3(-0.6, 4.9, -1.8), new Vector3(-W / 2 - 0.05, WALL_TOP - 0.3, -D / 2 + 0.4), 0.4), 0.022));
  p.cable.push(tube(catenary(new Vector3(W / 2 + 0.05, WALL_TOP - 0.25, D / 2 - 0.6), new Vector3(W / 2 + 1.4, 1.3, D / 2 + 1.2), 0.25), 0.022));
  return p;
}

function matrix(position: Vec3, yaw: number, scale: number): Matrix4 {
  return new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3().setScalar(scale));
}

const CRATES = [
  matrix([-W / 2 + 0.2, 0, D / 2 + 1.0], 0.2, 1.4),
  matrix([-W / 2 + 0.3, 0.46, D / 2 + 0.95], -0.15, 1.3),
  matrix([-W / 2 - 1.0, 0, D / 2 + 0.6], 1.3, 1.4),
  matrix([W / 2 + 1.5, 0, -1.6], 0.6, 1.4),
];
const BARRELS = [matrix([W / 2 + 1.0, 0, D / 2 + 0.9], 0.3, 1), matrix([W / 2 + 1.9, 0, D / 2 + 0.4], 1.8, 1), matrix([W / 2 + 1.2, 0, -0.4], 0.9, 1)];
const LANTERN = [matrix([-1.0, WALL_BOTTOM + 2.0 - 0.6, D / 2 + 0.45], 0.4, 1.6)];

const smokeVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
void main() {
  float t = fract(uTime * 0.07 + aSeed);
  vec3 p = position;
  p.y += t * 7.0;
  p.x += sin(aSeed * 40.0 + t * 3.0) * 0.5 * t + t * t * 2.5;
  p.z += cos(aSeed * 23.0 + t * 2.0) * 0.4 * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(0.6, 3.2, t) * uScale / -mv.z;
  vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.32;
}`;

const smokeFragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.1, d) * vAlpha;
  gl_FragColor = vec4(vec3(0.86, 0.85, 0.83), a);
}`;

function createSmoke() {
  const n = 26;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) seeds[i] = i / n + Math.sin(i * 12.9) * 0.01;
  g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  const material = new ShaderMaterial({
    vertexShader: smokeVertex,
    fragmentShader: smokeFragment,
    uniforms: { uTime: { value: 0 }, uScale: { value: 500 } },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  return { geometry: g, material };
}

let smoke: ReturnType<typeof createSmoke> | null = null;
const getSmoke = () => (smoke ??= createSmoke());

function updateSmoke(time: number, height: number, camera: PerspectiveCamera) {
  const u = getSmoke().material.uniforms;
  u.uTime!.value = time;
  u.uScale!.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

function Smoke({ position }: { position: Vec3 }) {
  const { geometry, material } = getSmoke();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame((s) => updateSmoke(s.clock.elapsedTime, size.height * dpr, s.camera as PerspectiveCamera));
  return <points geometry={geometry} material={material} position={position} frustumCulled={false} />;
}

export function House() {
  const wood = usePbrSet('wood');
  const roof = usePbrSet('roof');
  const stone = usePbrSet('stone');
  const frame = useMemo(() => houseFrame(), []);

  const meshes = useMemo(() => {
    const p = buildHouse();
    const list: [BufferGeometry, MeshStandardMaterial][] = [
      [merged(p.stone), pbrMaterial(stone, '#C9C4B8')],
      [merged(p.wall), pbrMaterial(wood, new Color(1.55, 1.38, 1.18))],
      [merged(p.trim), pbrMaterial(wood, '#7C6450')],
      [merged(p.roof), pbrMaterial(roof, '#D7B7A0')],
      [merged(p.glass), new MeshStandardMaterial({ color: '#FFD58A', emissive: '#FFB04A', emissiveIntensity: 0.9, roughness: 0.3 })],
      [merged(p.metal), new MeshStandardMaterial({ color: '#8C9399', metalness: 0.7, roughness: 0.4, side: DoubleSide })],
      [merged(p.cable), new MeshStandardMaterial({ color: '#1E2124', roughness: 0.55 })],
      [merged(p.panel), new MeshStandardMaterial({ color: '#1A1D24', roughness: 0.5, metalness: 0.3 })],
    ];
    const colors = { cyan: PALETTE.neonCyan, magenta: PALETTE.neonMagenta, amber: PALETTE.amber, lime: PALETTE.lime };
    for (const [key, parts] of Object.entries(p.neon)) {
      if (parts.length) list.push([merged(parts), neonMaterial(colors[key as keyof typeof colors])]);
    }
    return list;
  }, [wood, roof, stone]);

  return (
    <group position={[frame.x, frame.y, frame.z]} rotation-y={frame.yaw}>
      {meshes.map(([g, m], i) => (
        <mesh key={i} geometry={g} material={m} castShadow receiveShadow />
      ))}
      <PropInstances model="crate" matrices={CRATES} />
      <PropInstances model="barrel" matrices={BARRELS} />
      <PropInstances model="lantern" matrices={LANTERN} tweak={lanternGlow} />
      <Smoke position={[CHIMNEY[0], CHIMNEY_TOP + 0.2, CHIMNEY[2]]} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 0.25, 2.3, D / 2 + 0.25]} position-y={2.0} />
        {BARRELS.map((m, i) => {
          const v = new Vector3().setFromMatrixPosition(m);
          return <CylinderCollider key={i} args={[0.45, 0.45]} position={[v.x, v.y + 0.45, v.z]} />;
        })}
        <CuboidCollider args={[1.2, 0.5, 0.9]} position={[-W / 2 - 0.3, 0.5, D / 2 + 0.9]} />
      </RigidBody>
    </group>
  );
}
