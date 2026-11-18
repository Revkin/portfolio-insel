import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { MathUtils, Vector3, type Group } from 'three';
import { PALETTE } from '../content/palette.ts';
import { consumeJump, isDown } from '../systems/input.ts';
import { useGame } from '../systems/store.ts';
import { sampleHeight } from '../world/terrain.ts';
import { SEA_LEVEL } from '../world/layout.ts';
import { cameraRig, forwardFromYaw, playerState } from './playerState.ts';

const CAPSULE_HALF_HEIGHT = 0.5;
const CAPSULE_RADIUS = 0.35;
/** Distance from the capsule centre down to the feet. */
const FOOT_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;

const WALK_SPEED = 4.5;
const ACCELERATION = 14;
const AIR_CONTROL = 0.35;
const JUMP_SPEED = 6.2;
const GRAVITY = -20;
const MAX_FALL_SPEED = -40;
/** Phase 1 boundary: no walking into water deeper than this (swimming comes in Phase 2). */
const MAX_WATER_DEPTH = 0.9;

const HEAD_HEIGHT = 1.55;
const SHOULDER_OFFSET = 0.45;

type CharacterController = ReturnType<ReturnType<typeof useRapier>['world']['createCharacterController']>;

export interface PlayerProps {
  spawn: { x: number; z: number; yaw: number };
  /** False for fixed screenshot cameras. */
  followCamera: boolean;
}

export function Player({ spawn, followCamera }: PlayerProps) {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<Group>(null);
  const controller = useRef<CharacterController | null>(null);
  const { world } = useRapier();
  const camera = useThree((s) => s.camera);

  const velocity = useRef(new Vector3());
  const camTarget = useRef(new Vector3());
  // Visual heading uses atan2(x, z) of the look direction, i.e. camera yaw + π.
  const facing = useRef(spawn.yaw + Math.PI);
  const temp = useRef({ desired: new Vector3(), camPos: new Vector3() });

  const spawnY = sampleHeight(spawn.x, spawn.z) + FOOT_OFFSET + 0.2;

  useEffect(() => {
    const c = world.createCharacterController(0.02);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.enableAutostep(0.45, 0.25, true);
    c.enableSnapToGround(0.5);
    c.setMaxSlopeClimbAngle(MathUtils.degToRad(50));
    c.setMinSlopeSlideAngle(MathUtils.degToRad(60));
    c.setSlideEnabled(true);
    controller.current = c;
    return () => {
      world.removeCharacterController(c);
      controller.current = null;
    };
  }, [world]);

  useEffect(() => {
    cameraRig.yaw = spawn.yaw;
    facing.current = spawn.yaw + Math.PI;
    camTarget.current.set(spawn.x, spawnY - FOOT_OFFSET + HEAD_HEIGHT, spawn.z);

    playerState.teleport = (x, z, yaw) => {
      const y = sampleHeight(x, z) + FOOT_OFFSET + 0.2;
      body.current?.setTranslation({ x, y, z }, true);
      body.current?.setNextKinematicTranslation({ x, y, z });
      velocity.current.set(0, 0, 0);
      camTarget.current.set(x, y - FOOT_OFFSET + HEAD_HEIGHT, z);
      if (yaw !== undefined) {
        cameraRig.yaw = yaw;
        facing.current = yaw + Math.PI;
      }
    };
    return () => {
      playerState.teleport = null;
    };
  }, [spawn, spawnY]);

  useFrame((_, rawDt) => {
    const rb = body.current;
    const col = collider.current;
    const ctrl = controller.current;
    if (!rb || !col || !ctrl) return;
    const dt = Math.min(rawDt, 1 / 20);
    const vel = velocity.current;
    const { desired, camPos } = temp.current;

    // --- Input → wish direction (relative to the camera) ---
    const paused = useGame.getState().openProjectId !== null;
    let ix = 0;
    let iz = 0;
    if (!paused) {
      if (isDown('KeyW', 'ArrowUp')) iz += 1;
      if (isDown('KeyS', 'ArrowDown')) iz -= 1;
      if (isDown('KeyD', 'ArrowRight')) ix += 1;
      if (isDown('KeyA', 'ArrowLeft')) ix -= 1;
    }
    const jump = consumeJump() && !paused;

    const fwd = forwardFromYaw(cameraRig.yaw);
    // Right vector = forward rotated 90° clockwise seen from above.
    const rx = -fwd.z;
    const rz = fwd.x;
    let wx = fwd.x * iz + rx * ix;
    let wz = fwd.z * iz + rz * ix;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }

    // --- Horizontal velocity with acceleration ---
    const control = playerState.grounded ? 1 : AIR_CONTROL;
    const blend = 1 - Math.exp(-ACCELERATION * control * dt);
    vel.x += (wx * WALK_SPEED - vel.x) * blend;
    vel.z += (wz * WALK_SPEED - vel.z) * blend;

    // --- Vertical velocity ---
    if (playerState.grounded && vel.y <= 0) vel.y = -2;
    if (jump && playerState.grounded) vel.y = JUMP_SPEED;
    vel.y = Math.max(vel.y + GRAVITY * dt, MAX_FALL_SPEED);

    const pos = rb.translation();
    desired.set(vel.x * dt, vel.y * dt, vel.z * dt);

    // Keep the player out of deep water until swimming exists.
    const nextGround = sampleHeight(pos.x + desired.x, pos.z + desired.z);
    if (nextGround < SEA_LEVEL - MAX_WATER_DEPTH) {
      desired.x = 0;
      desired.z = 0;
      vel.x = 0;
      vel.z = 0;
    }

    ctrl.computeColliderMovement(col, desired);
    const move = ctrl.computedMovement();
    playerState.grounded = ctrl.computedGrounded();
    if (playerState.grounded && vel.y < 0) vel.y = 0;

    let nx = pos.x + move.x;
    let ny = pos.y + move.y;
    let nz = pos.z + move.z;
    // Safety net: never fall through the ground.
    const ground = sampleHeight(nx, nz);
    if (ny - FOOT_OFFSET < ground - 1.5) {
      ny = ground + FOOT_OFFSET + 0.2;
      vel.y = 0;
    }
    if (!Number.isFinite(nx) || !Number.isFinite(nz)) {
      nx = pos.x;
      nz = pos.z;
    }
    rb.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    playerState.position.set(nx, ny - FOOT_OFFSET, nz);

    // --- Visual facing: turn towards the movement direction ---
    if (visual.current) {
      const speed = Math.hypot(vel.x, vel.z);
      if (speed > 0.3) {
        const target = Math.atan2(vel.x, vel.z);
        let delta = target - facing.current;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        facing.current += delta * (1 - Math.exp(-12 * dt));
      }
      visual.current.rotation.y = facing.current;
    }

    // --- Third-person camera ---
    if (!followCamera) return;
    camTarget.current.lerp(
      desired.set(nx + rx * SHOULDER_OFFSET, ny - FOOT_OFFSET + HEAD_HEIGHT, nz + rz * SHOULDER_OFFSET),
      1 - Math.exp(-10 * dt),
    );
    const t = camTarget.current;
    const cp = Math.cos(cameraRig.pitch);
    camPos.set(
      t.x - fwd.x * cp * cameraRig.distance,
      t.y - Math.sin(cameraRig.pitch) * cameraRig.distance,
      t.z - fwd.z * cp * cameraRig.distance,
    );
    const minY = Math.max(sampleHeight(camPos.x, camPos.z), SEA_LEVEL) + 0.4;
    if (camPos.y < minY) camPos.y = minY;
    camera.position.copy(camPos);
    camera.lookAt(t);
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[spawn.x, spawnY, spawn.z]}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      <group ref={visual}>
        <mesh castShadow>
          <capsuleGeometry args={[CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 6, 16]} />
          <meshStandardMaterial color="#3A3F4A" roughness={0.6} />
        </mesh>
        {/* Visor shows which way the capsule faces. */}
        <mesh position={[0, 0.45, CAPSULE_RADIUS - 0.04]}>
          <boxGeometry args={[0.4, 0.1, 0.12]} />
          <meshStandardMaterial
            color={PALETTE.neonCyan}
            emissive={PALETTE.neonCyan}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}
