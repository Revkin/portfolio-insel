import { MeshStandardMaterial, type DataArrayTexture } from 'three';

/**
 * Terrain material: MeshStandardMaterial with a splat shader on top.
 * Layers of the texture arrays (scripts/assets/build-world-assets.ts):
 *   0 grass ground, 1 sand, 2 mossy rock, 3 dirt, 4 cobblestone.
 * Vertex attribute `splat` = weights of sand, rock, dirt, cobble; grass is
 * the remainder. Rock is projected triplanar so cliffs do not stretch, the
 * rest planar from above. Transitions use the albedo brightness as height,
 * so stones poke through the dirt instead of fading linearly.
 */
export function createTerrainMaterial(albedo: DataArrayTexture, normal: DataArrayTexture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAlbedo = { value: albedo };
    shader.uniforms.uNormal = { value: normal };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 splat;
varying vec4 vSplat;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSplat = splat;
vTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
precision highp sampler2DArray;
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uNormal;
varying vec4 vSplat;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;

// Tile size in metres per layer.
const float TILE[5] = float[5](5.0, 4.0, 6.0, 3.0, 2.4);
const float ROUGH[5] = float[5](0.95, 0.92, 0.85, 0.97, 0.88);

vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * p; }

// Planar sample from above; the second, rotated and scaled lookup hides tiling.
void samplePlanar(int layer, bool antiTile, vec3 N, out vec3 col, out vec3 nrm) {
  vec2 uv = vTerrainPos.xz / TILE[layer];
  col = texture(uAlbedo, vec3(uv, float(layer))).rgb;
  vec2 tn = texture(uNormal, vec3(uv, float(layer))).xy * 2.0 - 1.0;
  if (antiTile) {
    vec2 uv2 = rot(uv * 0.37, 1.1) + 0.31;
    col = mix(col, texture(uAlbedo, vec3(uv2, float(layer))).rgb, 0.45);
    tn = mix(tn, texture(uNormal, vec3(uv2, float(layer))).xy * 2.0 - 1.0, 0.45);
  }
  // Whiteout blend for a projection along y (Ben Golus' triplanar notes).
  vec3 t = vec3(tn + N.xz, abs(N.y));
  nrm = t.xzy;
}

void sampleTriplanar(int layer, vec3 N, out vec3 col, out vec3 nrm) {
  vec3 w = pow(abs(N), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 p = vTerrainPos / TILE[layer];
  float L = float(layer);
  vec3 cx = texture(uAlbedo, vec3(p.zy, L)).rgb;
  vec3 cy = texture(uAlbedo, vec3(p.xz, L)).rgb;
  vec3 cz = texture(uAlbedo, vec3(p.xy, L)).rgb;
  col = cx * w.x + cy * w.y + cz * w.z;
  vec2 nx = texture(uNormal, vec3(p.zy, L)).xy * 2.0 - 1.0;
  vec2 ny = texture(uNormal, vec3(p.xz, L)).xy * 2.0 - 1.0;
  vec2 nz = texture(uNormal, vec3(p.xy, L)).xy * 2.0 - 1.0;
  vec3 tx = vec3(nx + N.zy, abs(N.x));
  vec3 ty = vec3(ny + N.xz, abs(N.y));
  vec3 tz = vec3(nz + N.xy, abs(N.z));
  nrm = tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z;
}

vec3 terrainNormal;
float terrainRough;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec3 N = normalize(vTerrainNormal);
  float w[5];
  w[1] = vSplat.x; w[2] = vSplat.y; w[3] = vSplat.z; w[4] = vSplat.w;
  w[0] = max(0.0, 1.0 - vSplat.x - vSplat.y - vSplat.z - vSplat.w);

  vec3 cols[5];
  vec3 nrms[5];
  float hgt[5];
  float best = 0.0;
  for (int i = 0; i < 5; i++) {
    cols[i] = vec3(0.0); nrms[i] = N; hgt[i] = 0.0;
    if (w[i] < 0.02) continue;
    if (i == 2) sampleTriplanar(i, N, cols[i], nrms[i]);
    else samplePlanar(i, i <= 1, N, cols[i], nrms[i]);
    hgt[i] = dot(cols[i], vec3(0.3, 0.5, 0.2)) + w[i];
    best = max(best, hgt[i]);
  }
  // Height blend: only layers close to the highest one contribute.
  vec3 col = vec3(0.0);
  vec3 nrm = vec3(0.0);
  float rough = 0.0;
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    if (w[i] < 0.02) continue;
    float b = max(hgt[i] - best + 0.25, 0.0) * w[i];
    col += cols[i] * b;
    nrm += nrms[i] * b;
    rough += ROUGH[i] * b;
    total += b;
  }
  col /= max(total, 1e-4);
  terrainNormal = normalize(mix(N, normalize(nrm), 0.85));
  terrainRough = rough / max(total, 1e-4);
  diffuseColor.rgb *= col;
}`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = terrainRough;')
      .replace(
        '#include <normal_fragment_maps>',
        'normal = normalize((viewMatrix * vec4(terrainNormal, 0.0)).xyz);',
      );
  };
  // One shader program regardless of the bound textures.
  material.customProgramCacheKey = () => 'terrain-splat-v1';
  return material;
}
