import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Mesh } from 'three';
import type { Vec3 } from '../systems/shots.ts';

const COLORS = {
  nightSky: '#1B1F45',
  deepSea: '#0E2A3A',
  grass: '#6E8F3A',
  pathStone: '#8A8278',
  neonCyan: '#3EF2E6',
} as const;

/**
 * Phase 0: minimal placeholder scene (sea, island disc, one neon ring) to prove
 * that rendering, the build and the deployment work. Replaced in Phase 1.
 */
export function EmptyScene({ target }: { target: Vec3 }) {
  const ring = useRef<Mesh>(null);
  const frames = useRef(0);

  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.y += delta * 0.4;
    // Signal the screenshot script once a few frames have actually rendered.
    if (frames.current < 3 && ++frames.current === 3) window.__sceneReady = true;
  });

  return (
    <>
      <color attach="background" args={[COLORS.nightSky]} />
      <fog attach="fog" args={[COLORS.nightSky, 150, 600]} />

      <hemisphereLight args={['#9FB8FF', '#203018', 0.6]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-far={400}
      />

      {/* Sea */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color={COLORS.deepSea} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* Island placeholder (~200 × 150 m) */}
      <mesh scale={[100, 1, 75]} position-y={0.5} receiveShadow castShadow>
        <cylinderGeometry args={[1, 1.08, 2, 64]} />
        <meshStandardMaterial color={COLORS.grass} roughness={0.9} />
      </mesh>

      {/* Neon ring as a stand-in for the first portal */}
      <mesh ref={ring} position={[0, 9, 0]} castShadow>
        <torusGeometry args={[6, 0.35, 16, 96]} />
        <meshStandardMaterial
          color={COLORS.neonCyan}
          emissive={COLORS.neonCyan}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 0.4, 10]} />
        <meshStandardMaterial color={COLORS.pathStone} roughness={0.8} />
      </mesh>

      <OrbitControls target={target} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={400} />
    </>
  );
}
