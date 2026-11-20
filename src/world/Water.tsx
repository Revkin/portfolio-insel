import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CREEK_HALF_WIDTH, SEA_LEVEL } from './layout.ts';
import { getTerrain } from './terrain.ts';
import { buildRibbon } from './ribbon.ts';
import { createWaterMaterial } from './waterMaterial.ts';

/**
 * Sea with depth colour and shore foam, the flowing creek and the waterfall
 * over the west cliff (all shader-based, no textures).
 */
export function Water() {
  const { creekGeometry, fall, materials } = useMemo(() => {
    const t = getTerrain();
    const creekGeometry = buildRibbon(
      t.creek.xs,
      t.creek.zs,
      0,
      t.creekEnd,
      CREEK_HALF_WIDTH * 0.95,
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
      materials: {
        sea: createWaterMaterial('sea'),
        creek: createWaterMaterial('creek'),
        fall: createWaterMaterial('fall'),
      },
    };
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    for (const m of Object.values(materials)) m.uniforms.uTime!.value = time;
  });

  const fallHeight = fall.top - SEA_LEVEL;

  return (
    <group>
      {/* Uniform deep sea floor beyond the terrain grid. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-7.1}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#0F3442" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={SEA_LEVEL} material={materials.sea} receiveShadow={false}>
        <planeGeometry args={[3000, 3000]} />
      </mesh>

      <mesh geometry={creekGeometry} position-y={0.02} material={materials.creek} />

      {fallHeight > 0.5 && (
        <group position={[fall.x, 0, fall.z]} rotation-y={fall.angle}>
          {/* Sheet bending over the cliff edge, then falling straight down. */}
          <mesh position-y={SEA_LEVEL + fallHeight / 2} position-z={0.6} material={materials.fall}>
            <planeGeometry args={[CREEK_HALF_WIDTH * 1.7, fallHeight, 1, 1]} />
          </mesh>
          {/* Foam pool where the water hits the sea. */}
          <mesh rotation-x={-Math.PI / 2} position={[0, SEA_LEVEL + 0.05, 1.2]} material={materials.creek}>
            <circleGeometry args={[3.2, 24]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
