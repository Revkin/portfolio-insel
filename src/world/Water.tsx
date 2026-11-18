import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { CREEK_HALF_WIDTH, SEA_LEVEL } from './layout.ts';
import { getTerrain } from './terrain.ts';
import { buildRibbon } from './ribbon.ts';

/** Graybox water: flat sea, creek surface strip and a simple waterfall sheet. */
export function Water() {
  const { creekGeometry, fall } = useMemo(() => {
    const t = getTerrain();
    const creekGeometry = buildRibbon(
      t.creek.xs,
      t.creek.zs,
      0,
      t.creekEnd,
      CREEK_HALF_WIDTH * 0.9,
      (i) => t.creekWater[i]!,
    );
    const end = t.creekEnd;
    const ex = t.creek.xs[end]!;
    const ez = t.creek.zs[end]!;
    const px = t.creek.xs[end - 2]!;
    const pz = t.creek.zs[end - 2]!;
    const top = t.creekWater[end]!;
    return {
      creekGeometry,
      fall: { x: ex, z: ez, top, angle: Math.atan2(ex - px, ez - pz) },
    };
  }, []);

  const fallHeight = fall.top - SEA_LEVEL;

  return (
    <group>
      {/* Uniform deep sea floor beyond the terrain grid. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-7.1}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#123E50" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={SEA_LEVEL}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#1F5F7A" transparent opacity={0.9} roughness={0.25} metalness={0.1} />
      </mesh>

      <mesh geometry={creekGeometry} position-y={0.02}>
        <meshStandardMaterial color="#3A8FB0" transparent opacity={0.8} roughness={0.2} side={DoubleSide} />
      </mesh>

      {fallHeight > 0.5 && (
        <mesh position={[fall.x, SEA_LEVEL + fallHeight / 2, fall.z]} rotation-y={fall.angle}>
          <planeGeometry args={[CREEK_HALF_WIDTH * 1.6, fallHeight]} />
          <meshStandardMaterial color="#BFE6F2" transparent opacity={0.7} side={DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
