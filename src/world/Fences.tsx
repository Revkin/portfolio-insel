import { useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { PATH_HALF_WIDTH } from './layout.ts';
import { getTerrain, sampleHeight } from './terrain.ts';
import { fbm } from './math.ts';
import { isFree, rng } from './scatter.ts';
import { usePbrSet } from './textures.ts';
import { beam, box, catenary, merged, pbrMaterial, tube } from './build.ts';
import { lanternGlow } from './props.ts';
import { PropInstances } from './PropInstances.tsx';

const POST_SPACING = 2.4;
const FENCE_OFFSET = PATH_HALF_WIDTH + 0.85;
const LANTERN_SPACING = 15;
const LANTERN_OFFSET = PATH_HALF_WIDTH + 0.55;
const LANTERN_SCALE = 1.5;

interface Station {
  x: number;
  z: number;
  /** Unit direction along the path. */
  dx: number;
  dz: number;
  /** Distance from the beach end of the path. */
  s: number;
}

/** Points along the path every `spacing` metres. */
function stations(spacing: number, start: number, end: number): Station[] {
  const { xs, zs } = getTerrain().path;
  const out: Station[] = [];
  let s = 0;
  let next = start;
  for (let i = 1; i < xs.length; i++) {
    const ax = xs[i - 1]!;
    const az = zs[i - 1]!;
    const seg = Math.hypot(xs[i]! - ax, zs[i]! - az);
    while (next <= s + seg) {
      const f = (next - s) / seg;
      const dx = (xs[i]! - ax) / seg;
      const dz = (zs[i]! - az) / seg;
      out.push({ x: ax + dx * seg * f, z: az + dz * seg * f, dx, dz, s: next });
      next += spacing;
    }
    s += seg;
  }
  return out.filter((st) => st.s <= s - end);
}

interface Span {
  a: Vector3;
  b: Vector3;
  style: 'rail' | 'cable';
}

function layout() {
  const random = rng(99);
  const posts: Vector3[] = [];
  const spans: Span[] = [];
  const list = stations(POST_SPACING, 3, 8);
  for (const side of [-1, 1]) {
    let prev: Vector3 | null = null;
    for (const st of list) {
      // Fences in sections, with gaps so the meadows stay reachable.
      const on = fbm(st.s * 0.045 + side * 13.7, side * 4.1, 2) > 0.5;
      const x = st.x - st.dz * side * FENCE_OFFSET;
      const z = st.z + st.dx * side * FENCE_OFFSET;
      if (!on || !isFree(x, z, { path: 0.5, creek: 3.6, margin: 0.8 })) {
        prev = null;
        continue;
      }
      const top = new Vector3(x + (random() - 0.5) * 0.1, sampleHeight(x, z) + 1.0 + random() * 0.12, z + (random() - 0.5) * 0.1);
      posts.push(top);
      if (prev) {
        const style = fbm(st.s * 0.02 + 40, side * 7, 2) > 0.5 ? 'cable' : 'rail';
        spans.push({ a: prev, b: top, style });
      }
      prev = top;
    }
  }

  const lanterns: { base: Vector3; armX: number; armZ: number }[] = [];
  let side = 1;
  for (const st of stations(LANTERN_SPACING, 9, 4)) {
    side = -side;
    const x = st.x - st.dz * side * LANTERN_OFFSET;
    const z = st.z + st.dx * side * LANTERN_OFFSET;
    if (!isFree(x, z, { path: 0.35, creek: 3.6, margin: 0.6 })) continue;
    if (posts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.8)) continue;
    // Pole base; the arm reaches over the path edge.
    lanterns.push({ base: new Vector3(x, sampleHeight(x, z), z), armX: st.dz * side, armZ: -st.dx * side });
  }
  return { posts, spans, lanterns };
}

/** Fences along the path (wooden rails or sagging cables) and lantern poles. */
export function Fences() {
  const wood = usePbrSet('wood');
  const data = useMemo(() => {
    const { posts, spans, lanterns } = layout();
    const woodParts: BufferGeometry[] = [];
    const cableParts: BufferGeometry[] = [];
    const random = rng(7);

    for (const p of posts) {
      woodParts.push(
        box(0.14, 1.3, 0.14, {
          position: [p.x, p.y - 0.62, p.z],
          rotation: [(random() - 0.5) * 0.06, random() * Math.PI, (random() - 0.5) * 0.06],
          tile: 1.2,
        }),
      );
    }
    for (const { a, b, style } of spans) {
      if (style === 'rail') {
        for (const h of [-0.15, -0.55]) {
          woodParts.push(beam(a.clone().setY(a.y + h), b.clone().setY(b.y + h + (random() - 0.5) * 0.06), 0.06, 0.09, 1.6));
        }
      } else {
        for (const [h, sag] of [
          [-0.12, 0.22],
          [-0.45, 0.16],
        ] as const) {
          cableParts.push(tube(catenary(a.clone().setY(a.y + h), b.clone().setY(b.y + h), sag), 0.02));
        }
      }
    }

    const lanternMatrices: Matrix4[] = [];
    lanterns.forEach(({ base, armX, armZ }) => {
      const arm = { dx: armX, dz: armZ };
      const top = base.y + 2.35;
      woodParts.push(box(0.13, 2.6, 0.13, { position: [base.x, base.y + 1.1, base.z], tile: 1.2 }));
      const tip = new Vector3(base.x + arm.dx * 0.6, top - 0.08, base.z + arm.dz * 0.6);
      woodParts.push(beam(new Vector3(base.x, top, base.z), tip, 0.08, 0.08, 1.2));
      woodParts.push(beam(new Vector3(base.x, top - 0.45, base.z), new Vector3(base.x + arm.dx * 0.3, top - 0.05, base.z + arm.dz * 0.3), 0.05, 0.05, 1.2));
      cableParts.push(tube([tip, tip.clone().setY(tip.y - 0.12)], 0.012, 4));
      lanternMatrices.push(
        new Matrix4().compose(
          new Vector3(tip.x, tip.y - 0.12 - 0.3 * LANTERN_SCALE, tip.z),
          new Quaternion().setFromEuler(new Euler(0, random() * Math.PI, 0)),
          new Vector3().setScalar(LANTERN_SCALE),
        ),
      );
    });

    const colliders = spans.map(({ a, b }) => {
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      return {
        position: [(a.x + b.x) / 2, (a.y + b.y) / 2 - 0.45, (a.z + b.z) / 2] as [number, number, number],
        rotation: [0, Math.atan2(-(b.z - a.z), b.x - a.x), 0] as [number, number, number],
        half: [len / 2, 0.6, 0.07] as [number, number, number],
      };
    });

    return {
      woodGeometry: merged(woodParts),
      cableGeometry: merged(cableParts),
      woodMaterial: pbrMaterial(wood, '#9A7E62'),
      cableMaterial: new MeshStandardMaterial({ color: '#1E2124', roughness: 0.55 }),
      lanterns,
      lanternMatrices,
      colliders,
    };
  }, [wood]);

  return (
    <group>
      <mesh geometry={data.woodGeometry} material={data.woodMaterial} castShadow receiveShadow />
      <mesh geometry={data.cableGeometry} material={data.cableMaterial} castShadow />
      <PropInstances model="lantern" matrices={data.lanternMatrices} tweak={lanternGlow} />
      <RigidBody type="fixed" colliders={false}>
        {data.colliders.map((c, i) => (
          <CuboidCollider key={i} args={c.half} position={c.position} rotation={c.rotation} />
        ))}
        {data.lanterns.map(({ base: p }, i) => (
          <CylinderCollider key={`l${i}`} args={[1.2, 0.1]} position={[p.x, p.y + 1.2, p.z]} />
        ))}
      </RigidBody>
    </group>
  );
}
