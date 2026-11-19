/**
 * Prints the structure of a glTF/GLB file: meshes, triangles, skin joints,
 * materials, textures and (with --anims) all animation clips.
 *
 *   node scripts/assets/inspect-gltf.ts <file> [--anims]
 */
import { NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/assets/inspect-gltf.ts <file> [--anims]');
  process.exit(1);
}

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const root = doc.getRoot();

console.log(`Materials: ${root.listMaterials().map((m) => m.getName()).join(', ')}`);
for (const t of root.listTextures()) {
  const size = t.getSize();
  console.log(`Texture: ${t.getName() || t.getURI()} ${size?.join('×') ?? '?'} ${t.getMimeType()} ${t.getImage()?.byteLength ?? 0} B`);
}
for (const m of root.listMeshes()) {
  let tris = 0;
  for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(`Mesh: ${m.getName()} – ${m.listPrimitives().length} primitive(s), ${tris} tris, attrs ${m.listPrimitives()[0]?.listSemantics().join(',')}`);
}
for (const s of root.listSkins()) {
  console.log(`Skin: ${s.listJoints().length} joints: ${s.listJoints().map((j) => j.getName()).join(', ')}`);
}

console.log('Scene graph:');
const walk = (n: Node, depth: number) => {
  if (depth > 3) return;
  const t = n.getTranslation().map((v) => v.toFixed(2)).join(' ');
  const s = n.getScale().map((v) => v.toFixed(2)).join(' ');
  console.log(`${'  '.repeat(depth + 1)}${n.getName()}  t=[${t}] s=[${s}]${n.getMesh() ? ' (mesh)' : ''}${n.getSkin() ? ' (skin)' : ''}`);
  n.listChildren().forEach((c) => walk(c, depth + 1));
};
root.listScenes()[0]?.listChildren().forEach((n) => walk(n, 0));

const anims = root.listAnimations();
console.log(`Animations: ${anims.length}`);
if (flags.includes('--anims')) {
  for (const a of anims) {
    let max = 0;
    for (const s of a.listSamplers()) {
      const arr = s.getInput()?.getArray();
      if (arr && arr.length) max = Math.max(max, arr[arr.length - 1]!);
    }
    console.log(`  ${a.getName().padEnd(32)} ${max.toFixed(2)} s  ${a.listChannels().length} channels`);
  }
}
