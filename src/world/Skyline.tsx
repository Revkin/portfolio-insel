import { useMemo } from 'react';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { rng } from './scatter.ts';

/*
 * Futuristic city in the north-west across the sea (SPEC 4.7). Background only:
 * instanced boxes in tiers with spires; a world-space window pattern in the
 * shader, so no textures are needed. Haze comes from the scene fog.
 */

const CENTER = { x: -470, z: -560 };

interface Block {
  x: number;
  z: number;
  y: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  shade: number;
}

function layout(): Block[] {
  const random = rng(2077);
  const blocks: Block[] = [];
  for (let i = 0; i < 60; i++) {
    // Along a band facing the island, denser and taller in the middle.
    const u = random() * 2 - 1;
    const x = CENTER.x + u * 260 + (random() - 0.5) * 40;
    const z = CENTER.z - u * 120 + (random() - 0.5) * 140;
    const core = 1 - Math.abs(u);
    let h = 40 + random() * 90 + core * core * random() * 260;
    let w = 16 + random() * 22;
    let d = 16 + random() * 22;
    const yaw = (random() - 0.5) * 0.5;
    const shade = 0.85 + random() * 0.3;
    let y = -2;
    // Stepped tiers, each narrower than the one below.
    const tiers = h > 150 ? 3 : h > 90 ? 2 : 1;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? h : h * (0.45 + random() * 0.2);
      blocks.push({ x, z, y, w, h: th, d, yaw, shade });
      y += th;
      h -= th;
      w *= 0.62 + random() * 0.2;
      d *= 0.62 + random() * 0.2;
      if (h < 10) break;
    }
    if (random() < 0.45) blocks.push({ x, z, y, w: 1.6, h: 25 + random() * 45, d: 1.6, yaw, shade: 0.7 });
  }
  return blocks;
}

function skylineMaterial() {
  const material = new MeshStandardMaterial({ color: '#8C9BB0', roughness: 0.45, metalness: 0.2 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float facade = 1.0 - step(0.7, abs(vWN.y));
vec2 f = abs(vWN.x) > abs(vWN.z) ? vec2(vWP.z, vWP.y) : vec2(vWP.x, vWP.y);
vec2 cell = fract(f / vec2(3.2, 3.6));
float win = step(0.18, cell.x) * step(cell.x, 0.82) * step(0.3, cell.y) * step(cell.y, 0.8);
float band = step(0.94, fract(vWP.y / 28.0));
diffuseColor.rgb *= 1.0 - facade * (win * 0.28 + band * 0.25);`,
    );
  };
  material.customProgramCacheKey = () => 'skyline-v1';
  return material;
}

export function Skyline() {
  const mesh = useMemo(() => {
    const blocks = layout();
    const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const m = new InstancedMesh(geometry, skylineMaterial(), blocks.length);
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const base = new Color('#8C9BB0');
    const c = new Color();
    blocks.forEach((b, i) => {
      m.setMatrixAt(i, new Matrix4().compose(new Vector3(b.x, b.y, b.z), q.setFromAxisAngle(up, b.yaw), new Vector3(b.w, b.h, b.d)));
      m.setColorAt(i, c.copy(base).multiplyScalar(b.shade));
    });
    m.computeBoundingSphere();
    return m;
  }, []);
  return <primitive object={mesh} />;
}
