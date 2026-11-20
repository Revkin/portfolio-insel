import { use } from 'react';
import {
  DataArrayTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

const BASE = import.meta.env.BASE_URL;
export const textureUrl = (name: string) => `${BASE}assets/textures/${name}.webp`;

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, create: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = create();
    cache.set(key, p);
  }
  return p;
}

async function loadPixels(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const { width, height } = bitmap;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  bitmap.close();
  return { data: new Uint8Array(pixels.buffer), width, height };
}

/**
 * Loads an image whose square layers are stacked vertically as a texture
 * array (suspends until loaded).
 */
export function useTextureArray(name: string, srgb: boolean): DataArrayTexture {
  return use(
    cached(`array:${name}`, async () => {
      const { data, width, height } = await loadPixels(textureUrl(name));
      const tex = new DataArrayTexture(data, width, width, height / width);
      tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.magFilter = LinearFilter;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      return tex;
    }),
  );
}

export interface PbrSet {
  map: Texture;
  normalMap: Texture;
  /** AO (r), roughness (g), metalness (b). */
  arm: Texture;
}

const loader = new TextureLoader();

/** Colour, normal and ARM textures of one material, repeating (suspends until loaded). */
export function usePbrSet(name: 'wood' | 'roof' | 'stone' | 'cobble'): PbrSet {
  return use(
    cached(`pbr:${name}`, async () => {
      const [map, normalMap, arm] = await Promise.all(
        ['albedo', 'normal', 'arm'].map((m) => loader.loadAsync(textureUrl(`${name}-${m}`))),
      );
      map!.colorSpace = SRGBColorSpace;
      for (const t of [map!, normalMap!, arm!]) {
        t.wrapS = t.wrapT = RepeatWrapping;
        t.anisotropy = 8;
      }
      return { map: map!, normalMap: normalMap!, arm: arm! };
    }),
  );
}
