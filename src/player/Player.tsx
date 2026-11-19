import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Vector3, type Group } from 'three';
import { PALETTE } from '../content/palette.ts';
import { consumeJump, isDown } from '../systems/input.ts';
import { useGame } from '../systems/store.ts';
import { sampleHeight } from '../world/terrain.ts';
import { SEA_LEVEL } from '../world/layout.ts';
import { cameraRig, forwardFromYaw, playerState } from './playerState.ts';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FOOT_OFFSET, Locomotion } from './locomotion.ts';
import { Glider } from './Glider.tsx';
import { Character } from './Character.tsx';

const HEAD_HEIGHT = 1.55;
const SHOULDER_OFFSET = 0.45;
/** Keep the camera this far in front of anything it would clip into. */
const CAMERA_MARGIN = 0.3;
const CAMERA_MIN_DISTANCE = 0.8;

export interface PlayerProps {
  spawn: { x: number; z: number; yaw: number };
  /** False for fixed screenshot cameras. */
  followCamera: boolean;
}

export function Player({ spawn, followCamera }: PlayerProps) {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<Group>(null);
  const capsule = useRef<Group>(null);
  const glider = useRef<Group>(null);
  const loco = useRef<Locomotion | null>(null);
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera);

  const camTarget = useRef(new Vector3());
  // Visual heading uses atan2(x, z) of the look direction, i.e. camera yaw + π.
  const facing = useRef(spawn.yaw + Math.PI);
  const temp = useRef({ target: new Vector3(), dir: new Vector3(), camPos: new Vector3() });

  const spawnY = sampleHeight(spawn.x, spawn.z) + FOOT_OFFSET + 0.2;

  // The Locomotion needs the Rapier body and collider, which exist after mount.
  useEffect(() => {
    const ctrl = world.createCharacterController(0.02);
    let frame = 0;
    const attach = () => {
      if (body.current && collider.current) {
        const l = new Locomotion(rapier, world, body.current, collider.current, ctrl);
        loco.current = l;
        playerState.setStamina = (v) => {
          l.stamina = v;
        };
      } else {
        frame = requestAnimationFrame(attach);
      }
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      loco.current = null;
      playerState.setStamina = null;
      world.removeCharacterController(ctrl);
    };
  }, [world, rapier]);

  useEffect(() => {
    cameraRig.yaw = spawn.yaw;
    facing.current = spawn.yaw + Math.PI;
    camTarget.current.set(spawn.x, spawnY - FOOT_OFFSET + HEAD_HEIGHT, spawn.z);

    playerState.teleport = (x, z, yaw) => {
      const y = sampleHeight(x, z) + FOOT_OFFSET + 0.2;
      body.current?.setTranslation({ x, y, z }, true);
      body.current?.setNextKinematicTranslation({ x, y, z });
      loco.current?.reset();
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
    const l = loco.current;
    if (!l) return;
    const dt = Math.min(rawDt, 1 / 20);
    const paused = useGame.getState().openProjectId !== null;
    const fwd = forwardFromYaw(cameraRig.yaw);

    const forward = paused ? 0 : (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const right = paused ? 0 : (isDown('KeyD', 'ArrowRight') ? 1 : 0) - (isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const jump = consumeJump() && !paused;
    const sprint = !paused && isDown('ShiftLeft', 'ShiftRight');

    const center = l.update(dt, { forward, right, camForward: fwd, sprint, jump });

    playerState.position.set(center.x, center.y - FOOT_OFFSET, center.z);
    playerState.grounded = l.mode === 'ground';
    playerState.mode = l.mode;
    playerState.stamina = l.stamina;
    playerState.exhausted = l.exhausted;
    playerState.time += dt;
    playerState.velocity.copy(l.vel);
    playerState.climbDistance = l.climbDistance;
    playerState.mantleProgress = l.mantleProgress;

    // --- Visual: heading, swim pose, glider ---
    if (l.facing !== null) {
      const delta = Math.atan2(Math.sin(l.facing - facing.current), Math.cos(l.facing - facing.current));
      facing.current += delta * (1 - Math.exp(-12 * dt));
    }
    if (visual.current) visual.current.rotation.y = facing.current;
    if (capsule.current) {
      const lean = l.mode === 'swim' ? 1.25 : l.mode === 'glide' ? 0.25 : 0;
      capsule.current.rotation.x += (lean - capsule.current.rotation.x) * (1 - Math.exp(-8 * dt));
    }
    if (glider.current) glider.current.visible = l.mode === 'glide' || playerState.forcedAnim === 'glide';

    // --- Third-person camera with collision ---
    if (!followCamera) return;
    const { target, dir, camPos } = temp.current;
    const rx = -fwd.z;
    const rz = fwd.x;
    target.set(
      center.x + rx * SHOULDER_OFFSET,
      center.y - FOOT_OFFSET + (l.mode === 'swim' ? HEAD_HEIGHT - 0.6 : HEAD_HEIGHT),
      center.z + rz * SHOULDER_OFFSET,
    );
    camTarget.current.lerp(target, 1 - Math.exp(-10 * dt));
    const t = camTarget.current;
    const cp = Math.cos(cameraRig.pitch);
    dir.set(-fwd.x * cp, -Math.sin(cameraRig.pitch), -fwd.z * cp).normalize();

    // Pull in immediately when something blocks the view, ease back out.
    const free = l.obstacleDistance(t, dir, cameraRig.distance + CAMERA_MARGIN) - CAMERA_MARGIN;
    const wanted = Math.max(CAMERA_MIN_DISTANCE, Math.min(cameraRig.distance, free));
    cameraRig.effectiveDistance =
      wanted < cameraRig.effectiveDistance
        ? wanted
        : cameraRig.effectiveDistance + (wanted - cameraRig.effectiveDistance) * (1 - Math.exp(-4 * dt));

    camPos.copy(t).addScaledVector(dir, cameraRig.effectiveDistance);
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
        {/* The capsule is shown while the character model loads. */}
        <Suspense
          fallback={
            <group ref={capsule}>
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
          }
        >
          <group position-y={-FOOT_OFFSET}>
            <Character />
          </group>
        </Suspense>
        <group ref={glider} visible={false}>
          <Glider />
        </group>
      </group>
    </RigidBody>
  );
}
