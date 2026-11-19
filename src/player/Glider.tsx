import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, Quaternion, Vector3 } from 'three';
import { PALETTE } from '../content/palette.ts';

/**
 * Glider (SPEC 6, character sheet): delta wing with a slight dihedral, a
 * tube frame and neon edges – cyan on the leading edges, magenta at the back.
 * Coordinates relative to the player's capsule centre; the bar sits where
 * the hands are in the hanging pose.
 */
const BAR_Y = 1.02;
const NOSE = new Vector3(0, BAR_Y + 0.45, 1.05);
const TAIL = new Vector3(0, BAR_Y + 0.38, -0.55);
const LEFT = new Vector3(1.75, BAR_Y + 0.42, -0.6);
const RIGHT = new Vector3(-1.75, BAR_Y + 0.42, -0.6);
const HUB = new Vector3(0, BAR_Y + 0.4, 0.05);

function Tube({ from, to, radius, color, glow = false }: { from: Vector3; to: Vector3; radius: number; color: string; glow?: boolean }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = to.clone().sub(from);
    const length = dir.length();
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    return { position: from.clone().add(to).multiplyScalar(0.5), quaternion, length };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow={!glow}>
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={glow ? color : '#000000'}
        emissiveIntensity={glow ? 2 : 0}
        toneMapped={!glow}
        roughness={0.5}
        metalness={0.4}
      />
    </mesh>
  );
}

export function Glider() {
  const wing = useMemo(() => {
    const g = new BufferGeometry();
    const p = [NOSE, LEFT, TAIL, NOSE, TAIL, RIGHT].flatMap((v) => [v.x, v.y, v.z]);
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const barL = new Vector3(0.32, BAR_Y, 0.08);
  const barR = new Vector3(-0.32, BAR_Y, 0.08);

  return (
    <group>
      <mesh geometry={wing} castShadow>
        <meshStandardMaterial color="#1E232B" side={DoubleSide} transparent opacity={0.92} roughness={0.6} />
      </mesh>
      {/* Neon edges */}
      <Tube from={NOSE} to={LEFT} radius={0.018} color={PALETTE.neonCyan} glow />
      <Tube from={NOSE} to={RIGHT} radius={0.018} color={PALETTE.neonCyan} glow />
      <Tube from={LEFT} to={TAIL} radius={0.014} color={PALETTE.neonMagenta} glow />
      <Tube from={RIGHT} to={TAIL} radius={0.014} color={PALETTE.neonMagenta} glow />
      {/* Frame: keel, A-frame down to the control bar */}
      <Tube from={NOSE} to={TAIL} radius={0.02} color="#5A606A" />
      <Tube from={HUB} to={barL} radius={0.015} color="#5A606A" />
      <Tube from={HUB} to={barR} radius={0.015} color="#5A606A" />
      <Tube from={barL} to={barR} radius={0.018} color="#8A9099" />
    </group>
  );
}
