import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Builds a flat strip along sampled points. `heightAt(i)` gives the y of the
 * centre line, `offset` shifts the strip sideways (left = negative).
 */
export function buildRibbon(
  xs: ArrayLike<number>,
  zs: ArrayLike<number>,
  from: number,
  to: number,
  halfWidth: number,
  heightAt: (i: number) => number,
  offset = 0,
): BufferGeometry {
  const count = to - from + 1;
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];
  let length = 0;

  for (let k = 0; k < count; k++) {
    const i = from + k;
    const ip = Math.max(i - 1, 0);
    const inx = Math.min(i + 1, xs.length - 1);
    let tx = xs[inx]! - xs[ip]!;
    let tz = zs[inx]! - zs[ip]!;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    // Left-hand normal in the xz plane.
    const nx = -tz;
    const nz = tx;
    const cx = xs[i]! + nx * offset;
    const cz = zs[i]! + nz * offset;
    const y = heightAt(i);
    if (k > 0) length += Math.hypot(xs[i]! - xs[i - 1]!, zs[i]! - zs[i - 1]!);

    positions.set([cx - nx * halfWidth, y, cz - nz * halfWidth, cx + nx * halfWidth, y, cz + nz * halfWidth], k * 6);
    uvs.set([0, length, 1, length], k * 4);
    if (k < count - 1) {
      const a = k * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
