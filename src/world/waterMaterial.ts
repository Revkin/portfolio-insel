import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  FrontSide,
  LinearFilter,
  RedFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
} from 'three';
import { GRID, getTerrain } from './terrain.ts';
import { SKY, SUN_COLOR, SUN_DIRECTION } from './sky.ts';

/** Water depth below sea level is stored up to this many metres. */
const MAX_DEPTH = 8;

/** Sea depth per terrain vertex as a texture (0 = shore, 1 = MAX_DEPTH or deeper). */
function buildDepthTexture(): DataTexture {
  const t = getTerrain();
  const data = new Uint8Array(t.nx * t.nz);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(Math.min(Math.max(-t.heights[i]!, 0) / MAX_DEPTH, 1) * 255);
  }
  const tex = new DataTexture(data, t.nx, t.nz, RedFormat, UnsignedByteType);
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
// Height of small wind waves; p in metres.
float waves(vec2 p, float t) {
  float h = vnoise(p * 0.35 + vec2(t * 0.12, t * 0.05)) * 0.5;
  h += vnoise(p * 0.9 + vec2(-t * 0.2, t * 0.17)) * 0.3;
  h += vnoise(p * 2.3 + vec2(t * 0.35, -t * 0.3)) * 0.15;
  return h;
}
vec3 waveNormal(vec2 p, float t, float strength) {
  float e = 0.08;
  float h = waves(p, t);
  float hx = waves(p + vec2(e, 0.0), t);
  float hz = waves(p + vec2(0.0, e), t);
  return normalize(vec3((h - hx) / e * strength, 1.0, (h - hz) / e * strength));
}
`;

const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform sampler2D uDepth;
uniform vec4 uGrid; // minX, minZ, sizeX, sizeZ
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vWorld;
varying vec2 vUv;
${NOISE}
void main() {
  float t = uTime;
#if defined(CREEK)
  // Flow along the ribbon: v = metres downstream, u = across.
  vec2 p = vec2(vUv.x * 4.0, vUv.y * 0.8 - t * 1.6);
  vec3 N = waveNormal(p, t * 0.3, 0.9);
  float depth = 0.25 + 0.9 * (1.0 - abs(vUv.x * 2.0 - 1.0));
#elif defined(FALL)
  vec2 p = vec2(vUv.x * 6.0, vUv.y * 2.0 + t * 4.0);
  vec3 N = vec3(0.0, 1.0, 0.0);
  float depth = 1.0;
#else
  vec2 p = vWorld.xz;
  // Calmer far away: fine ripples would only alias into glitter.
  float far = smoothstep(60.0, 400.0, distance(cameraPosition.xz, vWorld.xz));
  vec3 N = normalize(mix(waveNormal(p, t, 0.55), vec3(0.0, 1.0, 0.0), far * 0.8));
  vec2 g = (vWorld.xz - uGrid.xy) / uGrid.zw;
  float depth = texture2D(uDepth, g).r * ${MAX_DEPTH.toFixed(1)};
  if (any(lessThan(g, vec2(0.0))) || any(greaterThan(g, vec2(1.0)))) depth = ${MAX_DEPTH.toFixed(1)};
#endif

  vec3 V = normalize(cameraPosition - vWorld);
#if defined(FALL)
  // Falling water: bright streaks moving down.
  float streak = vnoise(vec2(vUv.x * 14.0, vUv.y * 1.5 + t * 3.5)) * 0.6 + vnoise(vec2(vUv.x * 30.0, vUv.y * 4.0 + t * 6.0)) * 0.4;
  vec3 col = mix(uShallow, vec3(0.92, 0.97, 1.0), smoothstep(0.35, 0.8, streak));
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float alpha = (0.55 + 0.4 * streak) * edge;
  vec3 lit = col * (0.55 + 0.5 * max(dot(vec3(0.0, 1.0, 0.0), uSunDir), 0.0));
  gl_FragColor = vec4(lit, alpha);
#else
  float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));
  float spec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 3.0 + pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.12;

  vec3 water = mix(uShallow, uDeep, smoothstep(0.3, 6.0, depth));
  // Diffuse light in the water body.
  water *= 0.65 + 0.45 * max(uSunDir.y, 0.0);
#if defined(CREEK)
  vec3 col = mix(water, sky, fresnel * 0.4) + uSunColor * spec * 0.15;
#else
  vec3 col = mix(water, sky, fresnel * 0.85) + uSunColor * spec;
#endif

  // Foam: along the shore (sea) or the banks and in fast water (creek).
#if defined(CREEK)
  float bank = max(smoothstep(0.16, 0.0, vUv.x), smoothstep(0.84, 1.0, vUv.x));
  float foamNoise = vnoise(vec2(vUv.x * 9.0, vUv.y * 1.2 - t * 2.0));
  float foam = bank * smoothstep(0.45, 0.75, foamNoise) * 0.8 + smoothstep(0.85, 0.97, foamNoise) * 0.15;
#else
  float shore = smoothstep(0.9, 0.0, depth);
  float bands = sin(depth * 9.0 - t * 1.6 + vnoise(p * 0.6) * 5.0) * 0.5 + 0.5;
  float foamNoise = vnoise(p * 2.2 + vec2(t * 0.3, 0.0));
  float foam = shore * smoothstep(0.55, 0.9, bands * 0.6 + foamNoise * 0.6) + smoothstep(0.25, 0.0, depth) * 0.8;
#endif
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, vec3(0.93, 0.97, 0.98) * (0.75 + 0.35 * uSunDir.y), foam);

  float alpha = mix(0.5, 0.95, smoothstep(0.0, 2.5, depth));
  alpha = max(alpha, foam);
  alpha = max(alpha, fresnel);
  gl_FragColor = vec4(col, alpha);
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export type WaterKind = 'sea' | 'creek' | 'fall';

export function createWaterMaterial(kind: WaterKind): ShaderMaterial {
  const t = getTerrain();
  const defines: Record<string, string> = {};
  if (kind === 'creek') defines.CREEK = '';
  if (kind === 'fall') defines.FALL = '';
  return new ShaderMaterial({
    defines,
    // Merge clones its inputs: only the fog uniforms go through it, so the
    // shared sun and sky objects stay live for the day-night cycle.
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog),
      uTime: { value: 0 },
      uDepth: { value: kind === 'sea' ? buildDepthTexture() : null },
      uGrid: { value: [GRID.minX, GRID.minZ, (t.nx - 1) * GRID.step, (t.nz - 1) * GRID.step] },
      uSunDir: { value: SUN_DIRECTION },
      uSunColor: { value: SUN_COLOR },
      uZenith: { value: SKY.zenith },
      uHorizon: { value: SKY.horizon },
      uShallow: { value: new Color(kind === 'sea' ? '#3FA9A6' : '#2F6F68') },
      uDeep: { value: new Color('#0E3A50') },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: kind === 'sea',
    side: kind === 'sea' ? FrontSide : DoubleSide,
    fog: true,
  });
}
