import { useGame } from '../systems/store.ts';
import { cameraRig } from './playerState.ts';
import { clamp } from '../world/math.ts';

const MIN_PITCH = -1.2;
const MAX_PITCH = 0.45;

/**
 * Mouse look via Pointer Lock (click into the scene) and mouse-wheel zoom.
 * Returns a cleanup function.
 */
export function initCameraInput(canvas: HTMLCanvasElement): () => void {
  const onClick = () => {
    if (useGame.getState().openProjectId !== null) return;
    if (document.pointerLockElement !== canvas) {
      // Some browsers reject the request (e.g. headless); the game still works without it.
      Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
    }
  };

  const onLockChange = () => {
    useGame.getState().setPointerLocked(document.pointerLockElement === canvas);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    cameraRig.yaw -= e.movementX * cameraRig.sensitivity;
    cameraRig.pitch = clamp(cameraRig.pitch - e.movementY * cameraRig.sensitivity, MIN_PITCH, MAX_PITCH);
  };

  const onWheel = (e: WheelEvent) => {
    if (useGame.getState().openProjectId !== null) return;
    e.preventDefault();
    cameraRig.distance = clamp(
      cameraRig.distance * Math.exp(e.deltaY * 0.001),
      cameraRig.minDistance,
      cameraRig.maxDistance,
    );
  };

  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mousemove', onMouseMove);

  return () => {
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('wheel', onWheel);
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('mousemove', onMouseMove);
  };
}
