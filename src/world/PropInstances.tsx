import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import type { Matrix4, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { configureLoader, extractMeshes, instancesOf, propUrl } from './props.ts';

interface PropInstancesProps {
  model: 'barrel' | 'crate' | 'lantern';
  matrices: Matrix4[];
  /** Adjusts the (cloned) material of each part. */
  tweak?: (material: MeshStandardMaterial, partName: string) => void;
}

/** Places a Poly Haven prop several times (one draw call per part). */
export function PropInstances({ model, matrices, tweak }: PropInstancesProps) {
  const gltf = useLoader(GLTFLoader, propUrl(model), configureLoader);
  const meshes = useMemo(() => {
    const parts = extractMeshes(gltf.scene);
    if (tweak) for (const p of parts) tweak(p.material, p.name);
    return instancesOf(parts, matrices);
  }, [gltf, matrices, tweak]);
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
