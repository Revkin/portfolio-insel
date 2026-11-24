import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { ConvexHullCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { configureLoader, extractMeshes, instancesOf, propUrl } from './props.ts';
import { CLIMB_ROCK, GRID, getTerrain, sampleHeight } from './terrain.ts';
import { getSurface, sampleGrid } from './surface.ts';
import { PATH_HALF_WIDTH } from './layout.ts';
import { isFree, rng } from './scatter.ts';

interface RockPlacement {
  shape: number;
  matrix: Matrix4;
  collide: boolean;
}

function place(shapeCount: number): RockPlacement[] {
  const random = rng(777);
  const t = getTerrain();
  const surface = getSurface();
  const out: RockPlacement[] = [];
  const taken: { x: number; z: number; r: number }[] = [];
  const q = new Quaternion();
  const e = new Euler();

  const add = (x: number, z: number, scale: number, sink: number, collide: boolean) => {
    const r = scale * 1.4;
    if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r)) return false;
    taken.push({ x, z, r });
    e.set((random() - 0.5) * 0.3, random() * Math.PI * 2, (random() - 0.5) * 0.3);
    q.setFromEuler(e);
    const y = sampleHeight(x, z) - sink * scale;
    const s = new Vector3(scale * (0.9 + random() * 0.25), scale * (0.8 + random() * 0.4), scale * (0.9 + random() * 0.25));
    out.push({ shape: Math.floor(random() * shapeCount), matrix: new Matrix4().compose(new Vector3(x, y, z), q, s), collide });
    return true;
  };

  const tryMany = (n: number, attempts: number, accept: (x: number, z: number) => [number, number, boolean] | null) => {
    let placed = 0;
    for (let a = 0; a < attempts && placed < n; a++) {
      const x = GRID.minX + random() * (GRID.maxX - GRID.minX);
      const z = GRID.minZ + random() * (GRID.maxZ - GRID.minZ);
      const r = accept(x, z);
      if (r && add(x, z, r[0], r[1], r[2])) placed++;
    }
  };

  // Shoreline boulders, more of them along the rocky west.
  tryMany(46, 20000, (x, z) => {
    const h = sampleHeight(x, z);
    if (h < -0.8 || h > 1.4) return null;
    if (!isFree(x, z, { path: 2, creek: 3.5 })) return null;
    const west = x < -40 ? 1 : 0;
    if (random() > 0.35 + west * 0.5) return null;
    const scale = 0.6 + random() * (0.8 + west * 0.8);
    return [scale, 0.3, scale > 0.9];
  });
  // Around the base of the climbing rock (north and west side only).
  tryMany(12, 4000, (x, z) => {
    const d = Math.hypot(x - CLIMB_ROCK.x, (z - CLIMB_ROCK.z) * 1.15);
    if (d < CLIMB_ROCK.radius + 1.5 || d > CLIMB_ROCK.radius + 6) return null;
    if (z > CLIMB_ROCK.z - 2 && x > CLIMB_ROCK.x - 4) return null;
    if (!isFree(x, z, { path: 2 })) return null;
    return [1 + random() * 0.9, 0.25, true];
  });
  // Pebbles and stones along the creek banks.
  tryMany(26, 12000, (x, z) => {
    const cd = sampleGrid(t.creekDist, x, z);
    if (cd < 2.2 || cd > 4.5) return null;
    if (!isFree(x, z, { path: 1.5 })) return null;
    return [0.22 + random() * 0.35, 0.25, false];
  });
  // Single stones at the path edges.
  tryMany(18, 12000, (x, z) => {
    const pd = sampleGrid(t.pathDist, x, z);
    if (pd < PATH_HALF_WIDTH + 0.7 || pd > PATH_HALF_WIDTH + 2.2) return null;
    if (!isFree(x, z, { path: 0.7, creek: 3, margin: 1 })) return null;
    return [0.18 + random() * 0.25, 0.3, false];
  });
  // A few mossy rocks in the meadows.
  tryMany(14, 8000, (x, z) => {
    if (sampleGrid(surface.grass, x, z) < 0.5) return null;
    if (!isFree(x, z, { path: 3, creek: 4, margin: 2, mesa: true })) return null;
    const scale = 0.5 + random() * 0.6;
    return [scale, 0.35, scale > 0.8];
  });
  return out;
}

/** Hull points of one placed rock (subsampled vertices in world space). */
function hullPoints(geometry: BufferGeometry, matrix: Matrix4): Float32Array {
  const pos = geometry.getAttribute('position');
  const step = Math.max(1, Math.floor(pos.count / 120));
  const v = new Vector3();
  const out: number[] = [];
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    out.push(v.x, v.y, v.z);
  }
  return new Float32Array(out);
}

/** Mossy rocks (Poly Haven, CC0) scattered by rules, instanced per shape. */
export function Rocks() {
  const gltf = useLoader(GLTFLoader, propUrl('rocks'), configureLoader);
  const { meshes, hulls } = useMemo(() => {
    const shapes = extractMeshes(gltf.scene, true);
    // Slightly cooler, greyer tint so the rocks sit with the terrain's rock layer.
    for (const s of shapes) s.material.color.set('#A9B0A0');
    const placements = place(shapes.length);
    const meshes = shapes.flatMap((shape, i) =>
      instancesOf([shape], placements.filter((p) => p.shape === i).map((p) => p.matrix)),
    );
    const hulls = placements.filter((p) => p.collide).map((p) => hullPoints(shapes[p.shape]!.geometry, p.matrix));
    return { meshes, hulls };
  }, [gltf]);

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {hulls.map((h, i) => (
          <ConvexHullCollider key={i} args={[h]} />
        ))}
      </RigidBody>
    </group>
  );
}
