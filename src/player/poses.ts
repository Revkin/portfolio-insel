import { Object3D, Quaternion, Vector3 } from 'three';

/**
 * Procedural poses for movements the CC0 animation library does not contain
 * (climbing, glider hang, pulling up – SPEC section 6). Instead of editing
 * keyframes per bone axis, each limb bone is *aimed* at a direction given in
 * character space (+x = character's left, +y = up, +z = forward). That works
 * independently of how the rig's bone axes are oriented.
 */
export type Dir = [number, number, number];
export interface LimbTarget {
  bone: string;
  /** Child bone that defines the bone's direction. */
  child: string;
  dir: Dir;
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpDir = new Vector3();
const qDelta = new Quaternion();
const qBone = new Quaternion();
const qParent = new Quaternion();
const qTarget = new Quaternion();

/**
 * Rotates `bone` so that the vector to `child` points along `worldDir`,
 * blended with the current (animated) rotation by `weight`.
 */
export function aimBone(bone: Object3D, child: Object3D, worldDir: Vector3, weight: number) {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  bone.getWorldPosition(tmpA);
  child.getWorldPosition(tmpB);
  const current = tmpB.sub(tmpA);
  if (current.lengthSq() < 1e-10) return;
  current.normalize();
  qDelta.setFromUnitVectors(current, worldDir);
  bone.getWorldQuaternion(qBone);
  if (bone.parent) bone.parent.getWorldQuaternion(qParent);
  else qParent.identity();
  qTarget.copy(qParent).invert().multiply(qDelta.multiply(qBone));
  bone.quaternion.slerp(qTarget, weight);
  bone.updateMatrixWorld(true);
}

export function applyPose(
  bones: Map<string, Object3D>,
  targets: LimbTarget[],
  characterRotation: Quaternion,
  weight: number,
) {
  for (const t of targets) {
    const bone = bones.get(t.bone);
    const child = bones.get(t.child);
    if (!bone || !child) continue;
    tmpDir.set(t.dir[0], t.dir[1], t.dir[2]).normalize().applyQuaternion(characterRotation);
    aimBone(bone, child, tmpDir, weight);
  }
}

function limb(side: 'l' | 'r', upper: Dir, lower: Dir, kind: 'arm' | 'leg'): LimbTarget[] {
  const m = side === 'l' ? 1 : -1;
  const u: Dir = [upper[0] * m, upper[1], upper[2]];
  const lo: Dir = [lower[0] * m, lower[1], lower[2]];
  return kind === 'arm'
    ? [
        { bone: `upperarm_${side}`, child: `lowerarm_${side}`, dir: u },
        { bone: `lowerarm_${side}`, child: `hand_${side}`, dir: lo },
      ]
    : [
        { bone: `thigh_${side}`, child: `calf_${side}`, dir: u },
        { bone: `calf_${side}`, child: `foot_${side}`, dir: lo },
      ];
}

/** Hanging from the glider bar: arms straight up, legs trailing slightly. */
export function glidePose(time: number): LimbTarget[] {
  const sway = Math.sin(time * 1.7) * 0.06;
  return [
    ...limb('l', [0.28, 0.95, 0.12], [0.06, 1, 0.08], 'arm'),
    ...limb('r', [0.28, 0.95, 0.12], [0.06, 1, 0.08], 'arm'),
    ...limb('l', [0.1, -1, -0.28 + sway], [0.02, -0.92, -0.42 + sway], 'leg'),
    ...limb('r', [0.1, -1, -0.28 - sway], [0.02, -0.92, -0.42 - sway], 'leg'),
  ];
}

/**
 * Climbing cycle. `phase` advances with the distance climbed; arms and legs
 * alternate (left arm with right leg).
 */
export function climbPose(phase: number): LimbTarget[] {
  const s = Math.sin(phase);
  const armL = 0.5 + 0.5 * s; // 1 = reaching high
  const armR = 0.5 - 0.5 * s;
  const arm = (k: number): [Dir, Dir] => [
    [0.38, 0.35 + 0.6 * k, 0.55],
    [0.12, 0.55 + 0.45 * k, 0.7 - 0.25 * k],
  ];
  const leg = (k: number): [Dir, Dir] => [
    [0.16, -0.75 + 0.45 * k, 0.55],
    [0.02, -1, -0.12 - 0.15 * k],
  ];
  const [aL0, aL1] = arm(armL);
  const [aR0, aR1] = arm(armR);
  const [lL0, lL1] = leg(armR);
  const [lR0, lR1] = leg(armL);
  return [
    ...limb('l', aL0, aL1, 'arm'),
    ...limb('r', aR0, aR1, 'arm'),
    ...limb('l', lL0, lL1, 'leg'),
    ...limb('r', lR0, lR1, 'leg'),
  ];
}

/** Pulling up over a ledge: hands pressed down in front, knee coming up. */
export function mantlePose(t: number): LimbTarget[] {
  const push = Math.min(1, t * 1.5);
  return [
    ...limb('l', [0.3, -0.2 - 0.5 * push, 0.9], [0.08, -0.85, 0.45], 'arm'),
    ...limb('r', [0.3, -0.2 - 0.5 * push, 0.9], [0.08, -0.85, 0.45], 'arm'),
    ...limb('l', [0.12, -0.2, 0.9], [0.02, -1, -0.1], 'leg'),
    ...limb('r', [0.1, -0.9, 0.25], [0.02, -1, -0.2], 'leg'),
  ];
}
