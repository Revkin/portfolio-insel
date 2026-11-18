import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import { PROJECTS } from '../content/projects.ts';
import { PROJECT_COLORS } from '../content/palette.ts';
import type { Project } from '../content/types.ts';
import { useGame } from '../systems/store.ts';
import { playerState } from '../player/playerState.ts';
import { computePortalPlacements, type PortalPlacement } from './placement.ts';

export const INTERACT_DISTANCE = 3;

const FRAME_W = 3.2;
const FRAME_H = 4.2;
const PILLAR = 0.6;
const INNER_W = 2.0;
const INNER_H = 3.0;
const NEON = 0.07;

/** One portal per project, generated from the data in content/projects.ts. */
export function Portals() {
  const placements = useMemo(() => computePortalPlacements(PROJECTS.length), []);

  useFrame(() => {
    const { position } = playerState;
    let nearest: string | null = null;
    let nearestDist = INTERACT_DISTANCE;
    placements.forEach((p, i) => {
      const d = Math.hypot(position.x - p.interact.x, position.z - p.interact.z);
      if (d < nearestDist && Math.abs(position.y - p.y) < 3) {
        nearestDist = d;
        nearest = PROJECTS[i]?.id ?? null;
      }
    });
    const state = useGame.getState();
    if (state.nearPortalId !== nearest) state.setNearPortal(nearest);
  });

  return (
    <group>
      {PROJECTS.map((project, i) => {
        const placement = placements[i];
        return placement ? <PortalPlaceholder key={project.id} project={project} placement={placement} /> : null;
      })}
    </group>
  );
}

/** Graybox portal: concrete frame, double neon frame, hologram board (final design in Phase 5). */
function PortalPlaceholder({ project, placement }: { project: Project; placement: PortalPlacement }) {
  const color = PROJECT_COLORS[project.color];
  const neon = (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
  );
  const frameY = FRAME_H / 2 + 0.25;

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotationY, 0]}
      userData={{ portalId: project.id }}
    >
      <CuboidCollider args={[PILLAR / 2, FRAME_H / 2, PILLAR / 2]} position={[-(FRAME_W - PILLAR) / 2, frameY, 0]} />
      <CuboidCollider args={[PILLAR / 2, FRAME_H / 2, PILLAR / 2]} position={[(FRAME_W - PILLAR) / 2, frameY, 0]} />
      <CuboidCollider args={[FRAME_W / 2 + 0.2, 0.25, 0.7]} position={[0, 0, 0]} />

      {/* Base slab (sinks into slopes) */}
      <mesh position-y={-0.1} receiveShadow castShadow>
        <boxGeometry args={[FRAME_W + 0.4, 0.7, 1.4]} />
        <meshStandardMaterial color="#77736C" roughness={0.95} />
      </mesh>

      {/* Concrete frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (FRAME_W - PILLAR)) / 2, frameY, 0]} castShadow receiveShadow>
          <boxGeometry args={[PILLAR, FRAME_H, PILLAR]} />
          <meshStandardMaterial color="#8C8780" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, FRAME_H + 0.25 - PILLAR / 2, 0]} castShadow>
        <boxGeometry args={[FRAME_W, PILLAR, PILLAR]} />
        <meshStandardMaterial color="#8C8780" roughness={0.9} />
      </mesh>

      {/* Double neon frame */}
      {[0, 0.18].map((inset) => {
        const w = INNER_W - inset * 2;
        const h = INNER_H - inset * 2;
        const cy = 0.35 + INNER_H / 2;
        return (
          <group key={inset} position={[0, cy, 0.05]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[w, NEON, NEON]} />
              {neon}
            </mesh>
            <mesh position={[0, -h / 2, 0]}>
              <boxGeometry args={[w, NEON, NEON]} />
              {neon}
            </mesh>
            <mesh position={[-w / 2, 0, 0]}>
              <boxGeometry args={[NEON, h, NEON]} />
              {neon}
            </mesh>
            <mesh position={[w / 2, 0, 0]}>
              <boxGeometry args={[NEON, h, NEON]} />
              {neon}
            </mesh>
          </group>
        );
      })}

      {/* See-through inner surface */}
      <mesh position={[0, 0.35 + INNER_H / 2, 0]}>
        <planeGeometry args={[INNER_W, INNER_H]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Hologram board placeholder */}
      <mesh position={[FRAME_W / 2 + 1.0, 2.4, 0.2]} rotation-y={-0.3}>
        <planeGeometry args={[1.4, 0.9]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={DoubleSide} depthWrite={false} />
      </mesh>
    </RigidBody>
  );
}
