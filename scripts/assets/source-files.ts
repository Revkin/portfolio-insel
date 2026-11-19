/**
 * Locations of the downloaded (not committed) Quaternius source packs and a
 * reader that tolerates the broken image URIs in the character glTF.
 *
 * The packs live outside the repo; override the folder with ASSET_SOURCE_DIR.
 *   Universal Animation Library[Standard].zip – quaternius.itch.io/universal-animation-library (CC0)
 *   Universal Base Characters[Standard].zip   – quaternius.itch.io/universal-base-characters (CC0)
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

export const SOURCE_DIR = resolve(process.env.ASSET_SOURCE_DIR ?? '../asset-downloads/extracted');

export const SOURCES = {
  animations: join(SOURCE_DIR, 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'),
  character: join(SOURCE_DIR, 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'),
  hair: join(SOURCE_DIR, 'Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/Hair_SimpleParted.gltf'),
  /** Lighter skin variant (the glTF references the dark one). */
  skinLight: join(SOURCE_DIR, 'Universal Base Characters[Standard]/Base Characters/Textures/T_Superhero_Male_Ligh.png'),
};

export async function createIO(): Promise<NodeIO> {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/**
 * Reads a .gltf whose image URIs may point to non-existent "<name>_png.png"
 * copies (a packaging quirk of the Standard pack): falls back to "<name>.png".
 */
export async function readGltfLenient(io: NodeIO, file: string): Promise<Document> {
  if (!existsSync(file)) throw new Error(`Quelldatei fehlt: ${file}\nSiehe scripts/assets/source-files.ts`);
  const json = JSON.parse(await readFile(file, 'utf8')) as {
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
  };
  const dir = dirname(file);
  const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const b of json.buffers ?? []) {
    if (b.uri) resources[b.uri] = new Uint8Array(await readFile(join(dir, b.uri)));
  }
  for (const img of json.images ?? []) {
    if (!img.uri) continue;
    let path = join(dir, img.uri);
    if (!existsSync(path)) {
      const fixed = img.uri.replace(/_png\.png$/, '.png');
      path = existsSync(join(dir, fixed)) ? join(dir, fixed) : join(dir, '..', 'Textures', fixed);
    }
    if (!existsSync(path)) throw new Error(`Bild fehlt: ${img.uri}`);
    resources[img.uri] = new Uint8Array(await readFile(path));
  }
  return io.readJSON({ json: json as never, resources });
}
