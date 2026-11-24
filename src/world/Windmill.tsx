import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Color, DoubleSide, MeshStandardMaterial, PlaneGeometry, Vector3, type BufferGeometry, type Group } from 'three';
import { PALETTE } from '../content/palette.ts';
import { WINDMILL_POSITION } from './layout.ts';
import { sampleHeight } from './terrain.ts';
import { usePbrSet } from './textures.ts';
import { beam, box, cylinder, merged, neonMaterial, part, pbrMaterial, transform } from './build.ts';

/*
 * Windmill on the hill in the north (SPEC 4.5): octagonal plank tower on a
 * stone base, tiled cap, four lattice sails with cloth and neon edges.
 * Local frame: sails at +z.
 */

const OCT = Math.PI / 8; // flat side of the octagon to the front
const TOWER_BOTTOM = 2.0;
const TOWER_TOP = 9.4;
const R_BOTTOM = 2.6;
const R_TOP = 1.75;
const HUB_Y = 9.9;
const HUB_Z = 2.35;
const SAIL_LENGTH = 7;

/** Apothem of the tower at height y (distance to a flat side). */
const apothem = (y: number) => (R_BOTTOM + ((R_TOP - R_BOTTOM) * (y - TOWER_BOTTOM)) / (TOWER_TOP - TOWER_BOTTOM)) * Math.cos(OCT);

function buildTower() {
  const stone = [cylinder(2.7, 2.95, 2.3, 8, { position: [0, 0.9, 0], rotation: [0, OCT, 0], tile: 1.4 })];
  const wall = [cylinder(R_TOP, R_BOTTOM, TOWER_TOP - TOWER_BOTTOM, 8, { position: [0, (TOWER_TOP + TOWER_BOTTOM) / 2, 0], rotation: [0, OCT, 0], tile: 1.6 })];
  const roof = [cylinder(0.3, 2.15, 2.5, 8, { position: [0, TOWER_TOP + 1.25, 0], rotation: [0, OCT, 0], tile: 1.4 })];
  const trim: BufferGeometry[] = [
    cylinder(2.68, 2.68, 0.22, 8, { position: [0, TOWER_BOTTOM, 0], rotation: [0, OCT, 0] }),
    cylinder(1.98, 1.98, 0.26, 8, { position: [0, TOWER_TOP, 0], rotation: [0, OCT, 0] }),
    // Door and frame.
    box(1.05, 1.9, 0.12, { position: [0, 1.05, 2.76] }),
    box(1.35, 0.14, 0.2, { position: [0, 2.05, 2.78] }),
    // Axle from the cap to the hub.
    cylinder(0.16, 0.16, 1.4, 8, { position: [0, HUB_Y, HUB_Z - 0.6], rotation: [Math.PI / 2, 0, 0] }),
  ];
  for (const sx of [-1, 1]) trim.push(box(0.14, 2.0, 0.2, { position: [sx * 0.6, 1.05, 2.78] }));
  const glass: BufferGeometry[] = [];
  for (const y of [4.8, 7.4]) {
    const z = apothem(y) + 0.03;
    trim.push(box(0.8, 0.12, 0.12, { position: [0, y + 0.42, z] }), box(0.9, 0.1, 0.18, { position: [0, y - 0.42, z] }));
    glass.push(box(0.62, 0.74, 0.04, { position: [0, y, z - 0.03] }));
  }
  return { stone, wall, roof, trim, glass };
}

/** One sail along +y in the rotor plane: spar, lattice, cloth, neon edges. */
function buildSails() {
  const frame: BufferGeometry[] = [];
  const cloth: BufferGeometry[] = [];
  const neon: BufferGeometry[] = [];
  const inner = 1.1;
  const x0 = 0.12;
  const x1 = 1.5;
  for (let k = 0; k < 4; k++) {
    const rot: [number, number, number] = [0, 0, (k * Math.PI) / 2];
    const add = (list: BufferGeometry[], g: BufferGeometry) => list.push(transform(g, undefined, rot));
    add(frame, box(0.2, SAIL_LENGTH + 0.4, 0.2, { position: [0, (SAIL_LENGTH + 0.4) / 2, 0], tile: 1.6 }));
    add(frame, beam(new Vector3(x1, inner, 0.08), new Vector3(x1, SAIL_LENGTH, 0.08), 0.08));
    for (let r = inner; r <= SAIL_LENGTH + 0.01; r += 0.56) {
      add(frame, beam(new Vector3(-0.1, r, 0.08), new Vector3(x1 + 0.05, r, 0.08), 0.06));
    }
    add(cloth, part(new PlaneGeometry(x1 - x0 - 0.1, SAIL_LENGTH - inner - 0.9), { position: [(x0 + x1) / 2, (inner + 0.4 + SAIL_LENGTH - 0.5) / 2, 0.02] }));
    // Neon along the outer edge and the tip.
    add(neon, beam(new Vector3(x1 + 0.06, inner, 0.13), new Vector3(x1 + 0.06, SAIL_LENGTH, 0.13), 0.045));
    add(neon, beam(new Vector3(-0.12, SAIL_LENGTH + 0.06, 0.13), new Vector3(x1 + 0.1, SAIL_LENGTH + 0.06, 0.13), 0.045));
  }
  frame.push(cylinder(0.32, 0.32, 0.4, 10, { position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] }));
  return { frame, cloth, neon };
}

export function Windmill() {
  const rotor = useRef<Group>(null);
  const y = sampleHeight(WINDMILL_POSITION.x, WINDMILL_POSITION.z);
  const wood = usePbrSet('wood');
  const roof = usePbrSet('roof');
  const stone = usePbrSet('stone');

  const { tower, sails } = useMemo(() => {
    const t = buildTower();
    const s = buildSails();
    const trimMaterial = pbrMaterial(wood, '#7C6450');
    return {
      tower: [
        [merged(t.stone), pbrMaterial(stone, '#C9C4B8')],
        [merged(t.wall), pbrMaterial(wood, new Color(1.6, 1.45, 1.25))],
        [merged(t.roof), pbrMaterial(roof, '#B8A090')],
        [merged(t.trim), trimMaterial],
        [merged(t.glass), new MeshStandardMaterial({ color: '#FFD58A', emissive: '#FFB04A', emissiveIntensity: 0.8 })],
      ] as [BufferGeometry, MeshStandardMaterial][],
      sails: [
        [merged(s.frame), pbrMaterial(wood, '#C2AC90')],
        [merged(s.cloth), new MeshStandardMaterial({ color: '#E8E1D0', roughness: 0.95, side: DoubleSide })],
        [merged(s.neon), neonMaterial(PALETTE.neonCyan)],
      ] as [BufferGeometry, MeshStandardMaterial][],
    };
  }, [wood, roof, stone]);

  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += dt * 0.45;
  });

  return (
    <group position={[WINDMILL_POSITION.x, y, WINDMILL_POSITION.z]} rotation-y={0.4}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[5, 2.7]} position-y={5} />
      </RigidBody>
      {tower.map(([g, m], i) => (
        <mesh key={i} geometry={g} material={m} castShadow receiveShadow />
      ))}
      <group ref={rotor} position={[0, HUB_Y, HUB_Z]} rotation-z={0.3}>
        {sails.map(([g, m], i) => (
          <mesh key={i} geometry={g} material={m} castShadow />
        ))}
      </group>
    </group>
  );
}
