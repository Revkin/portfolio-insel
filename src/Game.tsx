import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Object3D, type DirectionalLight } from 'three';
import { PROJECTS } from './content/projects.ts';
import { Terrain } from './world/Terrain.tsx';
import { Water } from './world/Water.tsx';
import { Grass } from './world/Grass.tsx';
import { Trees } from './world/Trees.tsx';
import { PathLights } from './world/PathLights.tsx';
import { Bridge } from './world/Bridge.tsx';
import { Landmarks } from './world/Landmarks.tsx';
import { Sky } from './world/Sky.tsx';
import { FOG, SUN_COLOR, SUN_DIRECTION } from './world/sky.ts';
import { Player } from './player/Player.tsx';
import { cameraRig, forwardFromYaw, playerState, yawFromDirection } from './player/playerState.ts';
import { initCameraInput } from './player/cameraInput.ts';
import { Portals } from './portals/Portals.tsx';
import { computePortalPlacements } from './portals/placement.ts';
import { CLIMB_ROCK, getTerrain, sampleHeight, waterSurfaceAt } from './world/terrain.ts';
import { useGame } from './systems/store.ts';
import { isDebugMode, type ShotConfig } from './systems/shots.ts';

function resolveSpawn(shot: ShotConfig | null): { x: number; z: number; yaw: number } {
  const { xs, zs } = getTerrain().path;
  if (shot && typeof shot.player === 'object') {
    const p = computePortalPlacements(PROJECTS.length)[shot.player.portalIndex];
    if (p) {
      // Slightly off-centre so the capsule does not hide the portal.
      const sx = -p.front.z;
      const sz = p.front.x;
      const x = p.interact.x + p.front.x * 0.8 + sx * 1.1;
      const z = p.interact.z + p.front.z * 0.8 + sz * 1.1;
      return { x, z, yaw: yawFromDirection(-p.front.x, -p.front.z) };
    }
  }
  const i = 4;
  return { x: xs[i]!, z: zs[i]!, yaw: yawFromDirection(xs[i + 6]! - xs[i]!, zs[i + 6]! - zs[i]!) };
}

/** Sun with a shadow frustum that follows the player. */
function Sun() {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const p = playerState.position;
    light.current?.position.set(p.x + SUN_DIRECTION.x * 100, p.y + SUN_DIRECTION.y * 100, p.z + SUN_DIRECTION.z * 100);
    target.position.copy(p);
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.6}
        color={SUN_COLOR}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
    </>
  );
}

function FixedCamera({ position, target }: NonNullable<ShotConfig['fixedCamera']>) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...target);
  }, [camera, position, target]);
  return null;
}

function CameraInput() {
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => initCameraInput(canvas), [canvas]);
  return null;
}

/**
 * Signals readiness to the screenshot/smoke scripts once the character model
 * is loaded and a few more frames have rendered.
 */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (!playerState.characterLoaded) return;
    frames.current += 1;
    if (frames.current === 20) window.__sceneReady = true;
  });
  return null;
}

/** Fixed screenshot camera in front of the player at spawn (character close-ups). */
function FacePlayerCamera({
  spawn,
  view,
}: {
  spawn: { x: number; z: number; yaw: number };
  view: NonNullable<ShotConfig['facePlayer']>;
}) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const f = forwardFromYaw(spawn.yaw);
    const p = playerState.position;
    camera.position.set(
      p.x + f.x * view.front - f.z * view.right,
      p.y + view.up,
      p.z + f.z * view.front + f.x * view.right,
    );
    camera.lookAt(p.x, p.y + view.lookHeight, p.z);
  });
  return null;
}

function DebugHooks() {
  useEffect(() => {
    if (!isDebugMode()) return;
    const placements = computePortalPlacements(PROJECTS.length);
    window.__debug = {
      portalCount: placements.length,
      player: () => ({
        x: playerState.position.x,
        y: playerState.position.y,
        z: playerState.position.z,
        grounded: playerState.grounded,
        mode: playerState.mode,
        stamina: playerState.stamina,
        exhausted: playerState.exhausted,
        time: playerState.time,
        anim: playerState.anim.state,
        lift: playerState.anim.lift,
        speed: Math.hypot(playerState.velocity.x, playerState.velocity.z),
        /** Height of the feet above ground or water. */
        agl:
          playerState.position.y -
          Math.max(
            sampleHeight(playerState.position.x, playerState.position.z),
            waterSurfaceAt(playerState.position.x, playerState.position.z),
          ),
      }),
      camera: () => ({
        effectiveDistance: cameraRig.effectiveDistance,
        distance: cameraRig.distance,
      }),
      climbRock: () => ({ ...CLIMB_ROCK, top: sampleHeight(CLIMB_ROCK.x, CLIMB_ROCK.z) }),
      setStamina: (value: number) => playerState.setStamina?.(value),
      setCamera: (pitch: number, distance: number) => {
        cameraRig.pitch = pitch;
        cameraRig.distance = distance;
      },
      teleport: (x: number, z: number, yaw?: number) => playerState.teleport?.(x, z, yaw),
      teleportToPortal: (i: number) => {
        const p = placements[i];
        if (!p) return false;
        playerState.teleport?.(
          p.interact.x + p.front.x * 0.6,
          p.interact.z + p.front.z * 0.6,
          yawFromDirection(-p.front.x, -p.front.z),
        );
        return true;
      },
      setYaw: (yaw: number) => {
        cameraRig.yaw = yaw;
      },
      /** Every 10th path sample, for walking tests. */
      pathPoints: () => {
        const { xs, zs } = getTerrain().path;
        const pts: { x: number; z: number }[] = [];
        for (let i = 0; i < xs.length; i += 10) pts.push({ x: xs[i]!, z: zs[i]! });
        pts.push({ x: xs[xs.length - 1]!, z: zs[zs.length - 1]! });
        return pts;
      },
      state: () => {
        const s = useGame.getState();
        return { lang: s.lang, nearPortalId: s.nearPortalId, openProjectId: s.openProjectId };
      },
    };
    return () => {
      delete window.__debug;
    };
  }, []);
  return null;
}

export function Game({ shot }: { shot: ShotConfig | null }) {
  const spawn = useMemo(() => resolveSpawn(shot), [shot]);

  useEffect(() => {
    if (shot?.pitch !== undefined) cameraRig.pitch = shot.pitch;
    if (shot?.distance !== undefined) cameraRig.distance = shot.distance;
    playerState.forcedAnim = shot?.animState ?? null;
  }, [shot]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 55, near: 0.1, far: 2500, position: [spawn.x, 10, spawn.z + 10] }}
      gl={{ antialias: true, preserveDrawingBuffer: shot !== null }}
    >
      <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
      <hemisphereLight args={['#CFE0F0', '#5E6A48', 0.5]} />
      <Sun />
      <Sky />

      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <Terrain />
          <Bridge />
          <Landmarks />
          <Trees />
          <Portals />
          <Player spawn={spawn} followCamera={!shot?.fixedCamera && !shot?.facePlayer} />
          <ReadySignal />
        </Physics>
      </Suspense>
      <Water />
      <Grass />
      <PathLights />

      {shot?.fixedCamera && <FixedCamera {...shot.fixedCamera} />}
      {shot?.facePlayer && <FacePlayerCamera spawn={spawn} view={shot.facePlayer} />}
      <CameraInput />
      <DebugHooks />
    </Canvas>
  );
}
