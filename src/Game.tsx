import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Object3D, type DirectionalLight } from 'three';
import { PROJECTS } from './content/projects.ts';
import { Terrain } from './world/Terrain.tsx';
import { Water } from './world/Water.tsx';
import { PathLights } from './world/PathLights.tsx';
import { Bridge } from './world/Bridge.tsx';
import { Landmarks } from './world/Landmarks.tsx';
import { Player } from './player/Player.tsx';
import { cameraRig, playerState, yawFromDirection } from './player/playerState.ts';
import { initCameraInput } from './player/cameraInput.ts';
import { Portals } from './portals/Portals.tsx';
import { computePortalPlacements } from './portals/placement.ts';
import { getTerrain } from './world/terrain.ts';
import { useGame } from './systems/store.ts';
import { isDebugMode, type ShotConfig } from './systems/shots.ts';

const SKY = '#A9CBE3';

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
    light.current?.position.set(p.x + 40, p.y + 70, p.z + 30);
    target.position.copy(p);
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.2}
        color="#FFF1DA"
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

/** Signals readiness to the screenshot/smoke scripts after a few rendered frames. */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 20) window.__sceneReady = true;
  });
  return null;
}

function DebugHooks() {
  useEffect(() => {
    if (!isDebugMode()) return;
    const placements = computePortalPlacements(PROJECTS.length);
    window.__debug = {
      portalCount: placements.length,
      player: () => ({ ...playerState.position, grounded: playerState.grounded }),
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
  }, [shot]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 55, near: 0.1, far: 2500, position: [spawn.x, 10, spawn.z + 10] }}
      gl={{ antialias: true, preserveDrawingBuffer: shot !== null }}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 150, 850]} />
      <hemisphereLight args={['#CFE6FF', '#6A7A52', 1.6]} />
      <Sun />

      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <Terrain />
          <Bridge />
          <Landmarks />
          <Portals />
          <Player spawn={spawn} followCamera={!shot?.fixedCamera} />
          <ReadySignal />
        </Physics>
      </Suspense>
      <Water />
      <PathLights />

      {shot?.fixedCamera && <FixedCamera {...shot.fixedCamera} />}
      <CameraInput />
      <DebugHooks />
    </Canvas>
  );
}
