import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import {
  AnimationMixer,
  BoxGeometry,
  CylinderGeometry,
  Group,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
  type AnimationAction,
  type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PALETTE } from '../content/palette.ts';
import { playerState } from './playerState.ts';
import { applyPose, climbPose, glidePose, mantlePose } from './poses.ts';
import { waterSurfaceAt } from '../world/terrain.ts';

const BASE = import.meta.env.BASE_URL;
export const CHARACTER_URL = `${BASE}assets/models/character.glb`;
export const ANIMATIONS_URL = `${BASE}assets/models/character-anims.glb`;

/** The base model is 1.81 m; slightly smaller reads younger (character sheet). */
const CHARACTER_SCALE = 0.95;
const FADE = 0.2;
/** Where the swim clips are anchored relative to the water surface (metres). */
const SWIM_CHEST_ABOVE = 0.02;
const SWIM_HEAD_ABOVE = 0.18;

type Clip =
  | 'Idle_Loop'
  | 'Walk_Loop'
  | 'Jog_Fwd_Loop'
  | 'Sprint_Loop'
  | 'Jump_Start'
  | 'Jump_Loop'
  | 'Jump_Land'
  | 'Swim_Idle_Loop'
  | 'Swim_Fwd_Loop';

/** Nominal ground speed of each locomotion clip (m/s) for playback-rate matching. */
const CLIP_SPEED: Partial<Record<Clip, number>> = {
  Walk_Loop: 1.5,
  Jog_Fwd_Loop: 4.2,
  Sprint_Loop: 7.2,
  Swim_Fwd_Loop: 2.6,
};

const configureLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

function techwearMaterial(color: string, emissive = '#000000') {
  return new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, emissive, emissiveIntensity: 1.6 });
}

/**
 * Add-on meshes built in code (SPEC 6): backpack on the upper back, jacket
 * collar and cargo pockets. Created in the T-pose (character space, metres)
 * and attached to the bones they should follow.
 */
function addOutfit(bones: Map<string, Object3D>, root: Object3D) {
  const dark = techwearMaterial('#23272E');
  const strap = techwearMaterial('#15171B');
  const neon = techwearMaterial(PALETTE.neonCyan, PALETTE.neonCyan);

  const place = (mesh: Object3D, x: number, y: number, z: number, boneName: string) => {
    mesh.position.set(x, y, z);
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    bones.get(boneName)?.attach(mesh);
    mesh.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = true;
    });
  };

  // Backpack: main body, top flap, two straps over the shoulders, neon strip.
  const pack = new Group();
  const body = new Mesh(new BoxGeometry(0.3, 0.38, 0.14), dark);
  const flap = new Mesh(new BoxGeometry(0.31, 0.08, 0.15), strap);
  flap.position.y = 0.18;
  const pocket = new Mesh(new BoxGeometry(0.22, 0.14, 0.05), strap);
  pocket.position.set(0, -0.08, -0.08);
  const strip = new Mesh(new BoxGeometry(0.012, 0.26, 0.012), neon);
  strip.position.set(0.1, 0.02, -0.075);
  const strip2 = strip.clone();
  strip2.position.x = -0.1;
  pack.add(body, flap, pocket, strip, strip2);
  for (const side of [-1, 1]) {
    const s = new Mesh(new BoxGeometry(0.045, 0.34, 0.02), strap);
    s.position.set(0.09 * side, 0.06, 0.2);
    s.rotation.x = -0.12;
    pack.add(s);
    const top = new Mesh(new BoxGeometry(0.045, 0.02, 0.2), strap);
    top.position.set(0.09 * side, 0.2, 0.1);
    pack.add(top);
  }
  pack.scale.setScalar(0.8);
  place(pack, 0, 1.28, -0.2, 'spine_03');

  // Chunky boots over the (bare-foot) base mesh.
  const bootMat = techwearMaterial('#2E2A27');
  const soleMat = techwearMaterial('#4A443E');
  for (const [side, bone] of [
    [1, 'foot_l'],
    [-1, 'foot_r'],
  ] as const) {
    const boot = new Group();
    const shell = new Mesh(new BoxGeometry(0.13, 0.12, 0.27), bootMat);
    shell.position.set(0, 0.07, 0.015);
    const toe = new Mesh(new CylinderGeometry(0.065, 0.065, 0.12, 12), bootMat);
    toe.rotation.z = Math.PI / 2;
    toe.position.set(0, 0.06, 0.13);
    const sole = new Mesh(new BoxGeometry(0.14, 0.035, 0.3), soleMat);
    sole.position.set(0, 0.012, 0.02);
    const cuff = new Mesh(new CylinderGeometry(0.075, 0.07, 0.14, 12), bootMat);
    cuff.position.set(0, 0.17, -0.04);
    const glow = new Mesh(new BoxGeometry(0.135, 0.012, 0.012), neon);
    glow.position.set(0, 0.22, -0.04);
    boot.add(shell, toe, sole, cuff, glow);
    place(boot, 0.114 * side, 0, -0.03, bone);
  }

  // High jacket collar around the neck.
  const collar = new Mesh(new TorusGeometry(0.085, 0.03, 8, 20), dark);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.05, 1.2, 1.6);
  place(collar, 0, 1.53, -0.01, 'spine_03');

  // Cargo pockets on the thighs.
  for (const [side, bone] of [
    [1, 'thigh_l'],
    [-1, 'thigh_r'],
  ] as const) {
    const p = new Mesh(new BoxGeometry(0.05, 0.16, 0.13), strap);
    place(p, 0.175 * side, 0.68, 0.0, bone);
    const s = new Mesh(new CylinderGeometry(0.105, 0.105, 0.025, 14), strap);
    place(s, 0.11 * side, 0.82, -0.02, bone);
  }
}

interface Rig {
  scene: Group;
  bones: Map<string, Object3D>;
  mixer: AnimationMixer;
  actions: Map<Clip, AnimationAction>;
}

function buildRig(model: GLTF, anims: GLTF): Rig {
  const scene = model.scene;
  scene.updateMatrixWorld(true);

  const bones = new Map<string, Object3D>();
  scene.traverse((o) => {
    if ((o as { isBone?: boolean }).isBone) bones.set(o.name, o);
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      // Skinned meshes move outside their bind-pose bounds.
      m.frustumCulled = false;
    }
  });

  // Hair is a static mesh in rest pose; let it follow the head bone.
  const hair = scene.getObjectByName('Hair');
  const head = bones.get('Head');
  if (hair && head) head.attach(hair);

  // The hair texture is neutral grey (meant for tinting): dark brown like the sheet.
  scene.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (m?.name === 'MI_Hair_1') m.color.set('#3B2A20');
    if (m?.name === 'M_Character') {
      m.emissiveIntensity = 1.4;
      // The sculpted muscles in the normal map should not show through the jacket.
      m.normalScale.set(0.45, 0.45);
    }
  });

  // Slightly larger head: reads younger than the "superhero" base proportions.
  head?.scale.setScalar(1.12);

  addOutfit(bones, scene);

  const mixer = new AnimationMixer(scene);
  const actions = new Map<Clip, AnimationAction>();
  for (const clip of anims.animations) {
    const action = mixer.clipAction(clip);
    actions.set(clip.name as Clip, action);
  }
  for (const once of ['Jump_Start', 'Jump_Land'] as Clip[]) {
    const a = actions.get(once);
    if (a) {
      a.setLoop(LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  return { scene, bones, mixer, actions };
}

type AnimState = 'idle' | 'walk' | 'jog' | 'sprint' | 'jump' | 'fall' | 'land' | 'swim' | 'swimIdle' | 'glide' | 'climb' | 'mantle';

const STATE_CLIP: Record<AnimState, Clip> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  jump: 'Jump_Start',
  fall: 'Jump_Loop',
  land: 'Jump_Land',
  swim: 'Swim_Fwd_Loop',
  swimIdle: 'Swim_Idle_Loop',
  glide: 'Jump_Loop',
  climb: 'Idle_Loop',
  mantle: 'Jump_Land',
};

/** Animated player character (Quaternius base character + animation library, CC0). */
export function Character() {
  const model = useLoader(GLTFLoader, CHARACTER_URL, configureLoader);
  const anims = useLoader(GLTFLoader, ANIMATIONS_URL, configureLoader);
  const rig = useMemo(() => buildRig(model, anims), [model, anims]);
  const outer = useRef<Group>(null);
  /** Vertical offset: the swim clips lie flat at ground level, so lift them to the surface. */
  const lift = useRef<Group>(null);

  const anim = useRef({
    state: 'idle' as AnimState,
    action: null as AnimationAction | null,
    prevMode: playerState.mode,
    landTimer: 0,
    jumpTimer: 0,
    poseWeight: 0,
    poseKind: 'climb' as 'climb' | 'glide' | 'mantle',
    time: 0,
    rotation: new Quaternion(),
    anchorPos: new Vector3(),
  });

  useEffect(() => {
    const idle = rig.actions.get('Idle_Loop');
    idle?.play();
    anim.current.action = idle ?? null;
    playerState.characterLoaded = true;
    return () => {
      rig.mixer.stopAllAction();
      playerState.characterLoaded = false;
    };
  }, [rig]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const a = anim.current;
    a.time += dt;
    const forced = playerState.forcedAnim;
    const mode = playerState.mode;
    const v = playerState.velocity;
    const hSpeed = Math.hypot(v.x, v.z);

    // Transitions that depend on the previous mode.
    if (a.prevMode !== mode) {
      if ((a.prevMode === 'air' || a.prevMode === 'glide') && mode === 'ground' && hSpeed < 3) a.landTimer = 0.35;
      if (mode === 'air' && a.prevMode === 'ground' && v.y > 2) a.jumpTimer = 0.45;
      a.prevMode = mode;
    }
    a.landTimer = Math.max(0, a.landTimer - dt);
    a.jumpTimer = Math.max(0, a.jumpTimer - dt);

    // Desired animation state.
    let next: AnimState;
    if (forced) {
      next = (forced === 'run' ? 'jog' : forced) as AnimState;
    } else if (mode === 'climb' || mode === 'glide' || mode === 'mantle') {
      next = mode;
    } else if (mode === 'swim') {
      next = hSpeed > 0.4 ? 'swim' : 'swimIdle';
    } else if (mode === 'air') {
      next = a.jumpTimer > 0 ? 'jump' : 'fall';
    } else if (a.landTimer > 0 && hSpeed < 1) {
      next = 'land';
    } else if (hSpeed < 0.3) {
      next = 'idle';
    } else if (hSpeed < 2.6) {
      next = 'walk';
    } else if (hSpeed < 6) {
      next = 'jog';
    } else {
      next = 'sprint';
    }

    if (next !== a.state || !a.action) {
      const clip = STATE_CLIP[next];
      const action = rig.actions.get(clip);
      if (action && action !== a.action) {
        action.reset();
        if (next === 'jump') action.time = 0.35; // skip the crouch: our jump is instant
        if (next === 'land') action.time = 0.25;
        action.play();
        if (a.action) action.crossFadeFrom(a.action, next === 'jump' ? 0.1 : FADE, false);
        a.action = action;
      }
      a.state = next;
    }

    // Match playback speed to the movement speed.
    if (a.action) {
      const clip = a.action.getClip().name as Clip;
      const nominal = CLIP_SPEED[clip];
      a.action.timeScale = nominal && !forced ? Math.min(1.8, Math.max(0.6, hSpeed / nominal)) : next === 'jump' ? 1.6 : 1;
    }
    rig.mixer.update(dt);

    if (lift.current && outer.current) {
      // Swim clips are authored at different heights: lift the model so that the
      // head (treading water) or the chest (swimming) sits at the water surface.
      let target = 0;
      const swimming = !forced && (next === 'swim' || next === 'swimIdle');
      if (swimming) {
        const p = playerState.position;
        const surface = waterSurfaceAt(p.x, p.z);
        const anchor = rig.bones.get(next === 'swim' ? 'spine_03' : 'Head');
        if (anchor) {
          anchor.getWorldPosition(a.anchorPos);
          const wanted = surface + (next === 'swim' ? SWIM_CHEST_ABOVE : SWIM_HEAD_ABOVE);
          // Lift lives inside the scaled group: convert world metres to local units.
          target = lift.current.position.y + (wanted - a.anchorPos.y) / CHARACTER_SCALE;
          target = Math.min(2, Math.max(-0.5, target));
        }
      }
      lift.current.position.y += (target - lift.current.position.y) * (1 - Math.exp(-4 * dt));
      playerState.anim.state = next;
      playerState.anim.lift = lift.current.position.y;
    }

    // Procedural pose layer for climbing, gliding and pulling up.
    const poseActive = next === 'climb' || next === 'glide' || next === 'mantle';
    if (poseActive) a.poseKind = next as 'climb' | 'glide' | 'mantle';
    a.poseWeight += ((poseActive ? 1 : 0) - a.poseWeight) * (1 - Math.exp(-12 * dt));
    if (a.poseWeight > 0.01 && outer.current) {
      outer.current.getWorldQuaternion(a.rotation);
      const targets =
        a.poseKind === 'glide'
          ? glidePose(a.time)
          : a.poseKind === 'mantle'
            ? mantlePose(playerState.mantleProgress)
            : climbPose((forced ? a.time * 2 : playerState.climbDistance * 2.6) + 0.4);
      applyPose(rig.bones, targets, a.rotation, a.poseWeight);
    }
  });

  return (
    <group ref={outer} scale={CHARACTER_SCALE}>
      <group ref={lift}>
        <primitive object={rig.scene} />
      </group>
    </group>
  );
}

useLoader.preload(GLTFLoader, CHARACTER_URL, configureLoader);
useLoader.preload(GLTFLoader, ANIMATIONS_URL, configureLoader);
