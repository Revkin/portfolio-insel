import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial, Vector3, type Group } from 'three';
import { DOCK } from './layout.ts';
import { usePbrSet } from './textures.ts';
import { box, catenary, cylinder, merged, part, pbrMaterial, transform, tube } from './build.ts';
import { rng } from './scatter.ts';

/*
 * Wooden dock on the east coast with a moored rowboat (SPEC 4.1).
 * Local frame: x runs from the shore out to sea, deck top at y = DOCK.deck.
 */

const WIDTH = 2.2;
const PLANK = 0.26;

function buildDock() {
  const random = rng(5);
  const deck: BufferGeometry[] = [];
  const frame: BufferGeometry[] = [];
  const count = Math.floor(DOCK.length / (PLANK + 0.035));
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * (DOCK.length / count);
    deck.push(box(PLANK, 0.08, WIDTH + random() * 0.12, { position: [x, DOCK.deck - 0.04 + (random() - 0.5) * 0.02, (random() - 0.5) * 0.08], rotation: [0, (random() - 0.5) * 0.04, 0], tile: 1.6 }));
  }
  for (const s of [-1, 1]) frame.push(box(DOCK.length, 0.2, 0.16, { position: [DOCK.length / 2, DOCK.deck - 0.18, s * (WIDTH / 2 - 0.15)], tile: 1.6 }));
  // Piles down to the sea floor; the outer ones stick out above the deck.
  for (let x = 1.2; x <= DOCK.length; x += 2.2) {
    const outer = x + 2.2 > DOCK.length;
    for (const s of [-1, 1]) {
      const top = DOCK.deck + (outer ? 0.7 : 0.05);
      const bottom = -7;
      frame.push(cylinder(0.13, 0.15, top - bottom, 7, { position: [x, (top + bottom) / 2, s * (WIDTH / 2 + 0.02)], tile: 1.2 }));
    }
    frame.push(box(0.12, 0.16, WIDTH + 0.2, { position: [x, DOCK.deck - 0.32, 0], tile: 1.6 }));
  }
  return { deck: merged(deck), frame: merged(frame) };
}

const BOAT_LENGTH = 3.6;
const BOAT_BEAM = 0.75;

const halfWidth = (u: number) => BOAT_BEAM * (u > 0 ? Math.sqrt(Math.max(0, 1 - u ** 2.4)) : Math.sqrt(1 - 0.55 * u * u));
const depth = (u: number) => 0.48 * (1 - 0.3 * u * u);
const sheer = (u: number) => 0.12 * u * u + (u > 0 ? 0.06 * u : 0);

/** Rowboat hull: half-elliptical sections along the length, pointed bow at +x. */
function hullGeometry(): BufferGeometry {
  const N = 18;
  const M = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = -1 + (2 * i) / N;
    for (let j = 0; j <= M; j++) {
      const th = -Math.PI / 2 + (Math.PI * j) / M;
      pos.push((u * BOAT_LENGTH) / 2, sheer(u) - depth(u) * Math.cos(th) * Math.max(0.15, 1 - Math.max(0, u) ** 3), halfWidth(u) * Math.sin(th));
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j;
      const b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Transom: fan across the stern section.
  const c = pos.length / 3;
  pos.push(-BOAT_LENGTH / 2, sheer(-1), 0);
  for (let j = 0; j < M; j++) idx.push(c, j + 1, j);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return part(g, { tile: 1.2 });
}

function buildBoat() {
  const hull = [hullGeometry()];
  const trim: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const rim: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      rim.push(new Vector3((u * BOAT_LENGTH) / 2, sheer(u) + 0.02, s * halfWidth(u)));
    }
    trim.push(tube(rim, 0.04, 5));
  }
  for (const u of [0.25, -0.45]) {
    const w = halfWidth(u) * 2 - 0.06;
    trim.push(box(0.3, 0.05, w, { position: [(u * BOAT_LENGTH) / 2, sheer(u) - 0.2, 0], tile: 1.2 }));
  }
  // Two oars lying in the boat.
  for (const s of [-1, 1]) {
    trim.push(cylinder(0.025, 0.025, 2.3, 6, { position: [-0.1, -0.05, s * 0.22], rotation: [0, 0, Math.PI / 2 + 0.06 * s] }));
    trim.push(box(0.5, 0.02, 0.14, { position: [1.05, -0.02, s * 0.22], rotation: [0, 0, 0.06 * s] }));
  }
  return { hull: merged(hull), trim: merged(trim) };
}

function Boat({ wood }: { wood: ReturnType<typeof usePbrSet> }) {
  const group = useRef<Group>(null);
  const { meshes } = useMemo(() => {
    const b = buildBoat();
    return {
      meshes: [
        [b.hull, pbrMaterial(wood, '#C9A27E', { side: DoubleSide })],
        [b.trim, pbrMaterial(wood, '#7C6450')],
      ] as [BufferGeometry, MeshStandardMaterial][],
    };
  }, [wood]);
  useFrame((s) => {
    const g = group.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.position.y = 0.12 + Math.sin(t * 1.1) * 0.04;
    g.rotation.x = Math.sin(t * 0.9) * 0.04;
    g.rotation.z = Math.sin(t * 0.7 + 1) * 0.025;
  });
  return (
    <group position={[DOCK.length - 2.4, 0, WIDTH / 2 + 1.25]} rotation-y={0.12}>
      <group ref={group}>
        {meshes.map(([g, m], i) => (
          <mesh key={i} geometry={g} material={m} castShadow receiveShadow />
        ))}
      </group>
    </group>
  );
}

export function Dock() {
  const wood = usePbrSet('wood');
  const { meshes, rope } = useMemo(() => {
    const d = buildDock();
    const lastPile = new Vector3(Math.floor((DOCK.length - 1.2) / 2.2) * 2.2 + 1.2, DOCK.deck + 0.5, WIDTH / 2 + 0.02);
    const bow = new Vector3(DOCK.length - 2.4 + BOAT_LENGTH / 2 - 0.2, 0.3, WIDTH / 2 + 1.25 - 0.2);
    return {
      meshes: [
        [d.deck, pbrMaterial(wood, '#CDB49A')],
        [d.frame, pbrMaterial(wood, '#8A7058')],
      ] as [BufferGeometry, MeshStandardMaterial][],
      rope: transform(tube(catenary(lastPile, bow, 0.35), 0.02, 4)),
    };
  }, [wood]);
  const ropeMaterial = useMemo(() => new MeshStandardMaterial({ color: '#B8A27A', roughness: 0.9 }), []);

  return (
    <group position={[DOCK.x, 0, DOCK.z]} rotation-y={DOCK.yaw}>
      {meshes.map(([g, m], i) => (
        <mesh key={i} geometry={g} material={m} castShadow receiveShadow />
      ))}
      <mesh geometry={rope} material={ropeMaterial} />
      <Boat wood={wood} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[DOCK.length / 2, 0.15, WIDTH / 2]} position={[DOCK.length / 2, DOCK.deck - 0.15, 0]} />
      </RigidBody>
    </group>
  );
}
