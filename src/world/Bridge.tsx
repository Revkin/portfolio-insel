import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { getTerrain } from './terrain.ts';
import { PATH_HALF_WIDTH } from './layout.ts';

const DECK_THICKNESS = 0.3;

/** Graybox wooden bridge where the path crosses the creek. */
export function Bridge() {
  const { bridge } = getTerrain();
  const width = PATH_HALF_WIDTH * 2 + 0.4;
  const halfLen = bridge.length / 2;

  return (
    <RigidBody type="fixed" colliders={false} position={[bridge.x, bridge.y, bridge.z]} rotation={[0, bridge.angle, 0]}>
      <CuboidCollider args={[width / 2, DECK_THICKNESS / 2, halfLen]} />
      {/* Railings keep the player from falling off the sides. */}
      <CuboidCollider args={[0.08, 0.5, halfLen]} position={[width / 2, 0.6, 0]} />
      <CuboidCollider args={[0.08, 0.5, halfLen]} position={[-width / 2, 0.6, 0]} />

      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, DECK_THICKNESS, bridge.length]} />
        <meshStandardMaterial color="#7A5A3A" roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * width) / 2, 0, 0]}>
          <mesh position-y={1.0} castShadow>
            <boxGeometry args={[0.12, 0.12, bridge.length]} />
            <meshStandardMaterial color="#6B4E32" roughness={0.9} />
          </mesh>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[0, 0.5, (k * bridge.length) / 2.4]} castShadow>
              <boxGeometry args={[0.15, 1.0, 0.15]} />
              <meshStandardMaterial color="#6B4E32" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </RigidBody>
  );
}
