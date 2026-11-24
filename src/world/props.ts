import { useLoader } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, InstancedMesh, Vector3, type Matrix4, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;
export const propUrl = (name: 'rocks' | 'barrel' | 'crate' | 'lantern') => `${BASE}assets/models/world/${name}.glb`;

export const configureLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

export interface PropMesh {
  name: string;
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
}

/**
 * All meshes of a model with their node transforms baked in. meshopt stores
 * quantized integer attributes, so they are converted to float first, or every
 * vertex gets rounded. `centerXZ` moves each mesh onto the y axis (rock set).
 */
export function extractMeshes(scene: Object3D, centerXZ = false): PropMesh[] {
  scene.updateMatrixWorld(true);
  const out: PropMesh[] = [];
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const g = new BufferGeometry();
    for (const [name, attr] of Object.entries(m.geometry.attributes)) {
      const a = attr as BufferAttribute;
      const data = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) {
        for (let k = 0; k < a.itemSize; k++) data[i * a.itemSize + k] = a.getComponent(i, k);
      }
      g.setAttribute(name, new BufferAttribute(data, a.itemSize));
    }
    g.setIndex(m.geometry.index);
    g.applyMatrix4(m.matrixWorld);
    if (centerXZ) {
      g.computeBoundingBox();
      const c = new Vector3();
      g.boundingBox!.getCenter(c);
      g.translate(-c.x, 0, -c.z);
    }
    g.computeBoundingSphere();
    out.push({ name: m.name, geometry: g, material: (m.material as MeshStandardMaterial).clone() });
  });
  return out;
}

/** One instanced mesh per part of a model. */
export function instancesOf(meshes: PropMesh[], matrices: Matrix4[]): InstancedMesh[] {
  return meshes.map(({ geometry, material }) => {
    const mesh = new InstancedMesh(geometry, material, Math.max(matrices.length, 1));
    mesh.count = matrices.length;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  });
}

/** Warm glowing glass for the lanterns. */
export function lanternGlow(material: MeshStandardMaterial, partName: string) {
  if (!partName.toLowerCase().includes('glass')) return;
  material.emissive.set('#FFB45A');
  material.emissiveIntensity = 1.2;
  material.transparent = false;
  material.opacity = 1;
}

for (const name of ['rocks', 'barrel', 'crate', 'lantern'] as const) useLoader.preload(GLTFLoader, propUrl(name), configureLoader);
