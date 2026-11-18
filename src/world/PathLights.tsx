import { useMemo } from 'react';
import { PALETTE } from '../content/palette.ts';
import { PATH_HALF_WIDTH } from './layout.ts';
import { getTerrain, sampleHeight } from './terrain.ts';
import { buildRibbon } from './ribbon.ts';

/** Thin neon strips along both edges of the path (graybox version). */
export function PathLights() {
  const geometries = useMemo(() => {
    const t = getTerrain();
    const { xs, zs } = t.path;
    const last = xs.length - 1;
    const strip = (side: number) =>
      buildRibbon(xs, zs, 0, last, 0.05, (i) => {
        const nearBridge = Math.hypot(xs[i]! - t.bridge.x, zs[i]! - t.bridge.z) < t.bridge.length / 2;
        const ground = nearBridge
          ? Math.max(t.bridge.y + 0.15, sampleHeight(xs[i]!, zs[i]!))
          : Math.max(t.pathHeights[i]!, sampleHeight(xs[i]!, zs[i]!));
        return ground + 0.04;
      }, side * (PATH_HALF_WIDTH + 0.1));
    return [strip(-1), strip(1)];
  }, []);

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial
            color={PALETTE.neonCyan}
            emissive={PALETTE.neonCyan}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
