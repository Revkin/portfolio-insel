import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { getTerrain } from './terrain.ts';
import { PATH_HALF_WIDTH } from './layout.ts';
import { usePbrSet } from './textures.ts';
import { box, merged, pbrMaterial, type Vec3 } from './build.ts';
import { rng } from './scatter.ts';

const DECK_THICKNESS = 0.3;
const PLANK = 0.27;

/** Wooden bridge where the path crosses the creek: planks, beams, posts, rails. */
export function Bridge() {
  const { bridge } = getTerrain();
  const width = PATH_HALF_WIDTH * 2 + 0.4;
  const halfLen = bridge.length / 2;
  const wood = usePbrSet('wood');

  const { deck, frame, deckMaterial, frameMaterial } = useMemo(() => {
    const random = rng(31);
    // Loose planks across the deck, slightly uneven; top flush with the collider.
    const planks = [];
    const count = Math.floor(bridge.length / (PLANK + 0.03));
    for (let i = 0; i < count; i++) {
      const z = -halfLen + (i + 0.5) * (bridge.length / count);
      const jitter: Vec3 = [(random() - 0.5) * 0.12, DECK_THICKNESS / 2 - 0.045 + (random() - 0.5) * 0.015, z];
      planks.push(box(width + 0.2 + random() * 0.15, 0.09, PLANK, { position: jitter, rotation: [0, (random() - 0.5) * 0.04, 0], tile: 1.6 }));
    }
    const beams = [-1, 1].map((s) => box(0.22, 0.26, bridge.length + 0.4, { position: [s * (width / 2 - 0.35), -0.08, 0], tile: 1.6 }));

    const frameParts = [];
    for (const side of [-1, 1]) {
      const x = (side * width) / 2;
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        const z = k * (halfLen - 0.15);
        frameParts.push(box(0.16, 1.55, 0.16, { position: [x, 0.38, z], tile: 1.2 }));
      }
      frameParts.push(box(0.12, 0.12, bridge.length + 0.2, { position: [x, 1.08, 0], tile: 1.6 }));
      frameParts.push(box(0.07, 0.1, bridge.length, { position: [x, 0.6, 0], tile: 1.6 }));
    }
    return {
      deck: merged([...planks, ...beams]),
      frame: merged(frameParts),
      deckMaterial: pbrMaterial(wood, '#B59A7C'),
      frameMaterial: pbrMaterial(wood, '#8E7258'),
    };
  }, [bridge.length, halfLen, width, wood]);

  return (
    <RigidBody type="fixed" colliders={false} position={[bridge.x, bridge.y, bridge.z]} rotation={[0, bridge.angle, 0]}>
      <CuboidCollider args={[width / 2, DECK_THICKNESS / 2, halfLen]} />
      {/* Railings keep the player from falling off the sides. */}
      <CuboidCollider args={[0.08, 0.5, halfLen]} position={[width / 2, 0.6, 0]} />
      <CuboidCollider args={[0.08, 0.5, halfLen]} position={[-width / 2, 0.6, 0]} />

      <mesh geometry={deck} material={deckMaterial} castShadow receiveShadow />
      <mesh geometry={frame} material={frameMaterial} castShadow receiveShadow />
    </RigidBody>
  );
}
