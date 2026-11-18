import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import { Line } from '@react-three/drei';
import { PALETTE } from '../content/palette.ts';

const NOSE: [number, number, number] = [0, 1.55, 0.9];
const LEFT: [number, number, number] = [-1.7, 1.25, -0.5];
const RIGHT: [number, number, number] = [1.7, 1.25, -0.5];

/** Graybox glider: triangular wing with cyan/magenta neon edges (final model in Phase 3). */
export function Glider() {
  const wing = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array([...NOSE, ...LEFT, ...RIGHT]), 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={wing} castShadow>
        <meshStandardMaterial color="#20242C" side={DoubleSide} transparent opacity={0.85} roughness={0.5} />
      </mesh>
      <Line points={[LEFT, NOSE, RIGHT]} color={PALETTE.neonCyan} lineWidth={3} toneMapped={false} />
      <Line points={[LEFT, RIGHT]} color={PALETTE.neonMagenta} lineWidth={3} toneMapped={false} />
      {/* Handle bar */}
      <Line
        points={[
          [-0.35, 1.25, 0.05],
          [0.35, 1.25, 0.05],
        ]}
        color="#888"
        lineWidth={2}
      />
    </group>
  );
}
