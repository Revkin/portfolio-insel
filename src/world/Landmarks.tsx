import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { HOUSE_POSITION, WINDMILL_POSITION } from './layout.ts';
import { sampleHeight } from './terrain.ts';
import { fbm } from './math.ts';

/** Graybox stand-ins for the house, windmill and skyline (replaced in Phase 4). */
export function Landmarks() {
  return (
    <group>
      <House />
      <Windmill />
      <Skyline />
    </group>
  );
}

function House() {
  const y = sampleHeight(HOUSE_POSITION.x, HOUSE_POSITION.z);
  return (
    <RigidBody type="fixed" colliders={false} position={[HOUSE_POSITION.x, y, HOUSE_POSITION.z]} rotation={[0, -0.5, 0]}>
      <CuboidCollider args={[4, 2.5, 3]} position-y={2.5} />
      <mesh position-y={2.5} castShadow receiveShadow>
        <boxGeometry args={[8, 5, 6]} />
        <meshStandardMaterial color="#9C8F7E" roughness={0.9} />
      </mesh>
      <mesh position-y={6.2} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[6.2, 2.6, 4]} />
        <meshStandardMaterial color="#5A4636" roughness={0.9} />
      </mesh>
      {/* Warm windows */}
      {[-2, 2].map((x) => (
        <mesh key={x} position={[x, 2.8, 3.01]}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshStandardMaterial color="#FFC774" emissive="#FFB23E" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function Windmill() {
  const rotor = useRef<Group>(null);
  const y = sampleHeight(WINDMILL_POSITION.x, WINDMILL_POSITION.z);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += dt * 0.6;
  });
  return (
    <group position={[WINDMILL_POSITION.x, y, WINDMILL_POSITION.z]} rotation-y={0.4}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[5, 2.6]} position-y={5} />
      </RigidBody>
      <mesh position-y={5} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 2.8, 10, 12]} />
        <meshStandardMaterial color="#B9AE9C" roughness={0.9} />
      </mesh>
      <mesh position-y={11} castShadow>
        <coneGeometry args={[2.4, 2.4, 12]} />
        <meshStandardMaterial color="#5A4636" roughness={0.9} />
      </mesh>
      <group ref={rotor} position={[0, 9.5, 2.6]}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} rotation-z={(k * Math.PI) / 2} position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 13, 0.1]} />
            <meshStandardMaterial color="#D8D2C4" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Skyline() {
  const towers = useMemo(() => {
    const list: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const u = i / 39;
      const x = -620 + u * 380 + (fbm(i * 3.1, 1.7) - 0.5) * 40;
      const z = -520 + (fbm(i * 1.3, 8.2) - 0.5) * 120;
      const h = 40 + fbm(i * 0.7, 4.4) ** 2 * 260;
      list.push({ x, z, w: 14 + fbm(i, 2) * 20, d: 14 + fbm(2, i) * 20, h });
    }
    return list;
  }, []);
  return (
    <group>
      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2 - 2, t.z]}>
          <boxGeometry args={[t.w, t.h, t.d]} />
          <meshStandardMaterial color="#7D8CA3" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
