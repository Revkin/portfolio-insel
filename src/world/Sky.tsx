import { useMemo } from 'react';
import { BackSide, ShaderMaterial } from 'three';
import { Environment } from '@react-three/drei';
import { skyFragmentShader, skyUniforms, skyVertexShader } from './sky.ts';

function SkyDome({ radius }: { radius: number }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: skyUniforms(),
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

/**
 * Procedural sky dome. The same sky is rendered once into a small cube map
 * that lights all PBR materials (image-based lighting), so reflections and
 * ambient light match the visible sky.
 */
export function Sky() {
  return (
    <>
      <SkyDome radius={2000} />
      <Environment resolution={64} frames={1} environmentIntensity={0.9}>
        <SkyDome radius={50} />
      </Environment>
    </>
  );
}
