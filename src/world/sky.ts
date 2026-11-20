import { Color, Vector3 } from 'three';

/**
 * Afternoon light (SPEC 3, reference 03-gameplay-view.png): low, warm sun in
 * the north-east, so it shines slightly against the view along the path and
 * casts long shadows towards the camera. Phase 6 animates these values.
 */
export const SUN_DIRECTION = new Vector3(0.5, 0.36, -0.79).normalize();
export const SUN_COLOR = new Color('#FFE2B8');

export const SKY = {
  zenith: new Color('#5B8FC4'),
  horizon: new Color('#D7E2E3'),
  /** Warm glow around the sun. */
  glow: new Color('#FFE6BE'),
  /** Below the horizon (seen through haze over the sea). */
  ground: new Color('#9FB7BD'),
};

/** Haze colour: the horizon colour, so distant objects melt into the sky. */
export const FOG = { color: SKY.horizon, near: 70, far: 950 };

export const skyVertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // always just in front of the far plane
}`;

export const skyFragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float up = d.y;
  // Wide hazy band at the horizon, blue towards the zenith.
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, up), 0.7));
  col = mix(col, uGround, smoothstep(0.0, -0.08, up));
  float s = max(dot(d, uSunDir), 0.0);
  col += uGlow * (pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.5) * smoothstep(-0.1, 0.1, up);
  col += uSunColor * smoothstep(0.9993, 0.9997, s) * 6.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function skyUniforms() {
  return {
    uZenith: { value: SKY.zenith },
    uHorizon: { value: SKY.horizon },
    uGlow: { value: SKY.glow },
    uGround: { value: SKY.ground },
    uSunDir: { value: SUN_DIRECTION },
    uSunColor: { value: SUN_COLOR },
  };
}
