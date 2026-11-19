import { Vector3 } from 'three';
import type { MoveMode } from './locomotion.ts';

/**
 * Mutable per-frame player/camera state shared between systems without React
 * re-renders (position is read by portals, HUD, minimap, audio …).
 */
export const playerState = {
  /** Feet position. */
  position: new Vector3(),
  grounded: false,
  mode: 'ground' as MoveMode,
  /** 0..1 */
  stamina: 1,
  exhausted: false,
  /** Accumulated simulation time in seconds (tests measure speeds with it). */
  time: 0,
  /** Current velocity (m/s), for animation blending. */
  velocity: new Vector3(),
  /** Distance moved along the wall, drives the climbing cycle. */
  climbDistance: 0,
  /** 0..1 progress of a pull-up over a ledge. */
  mantleProgress: 0,
  /**
   * Screenshot/test override for the character animation state
   * ('climb', 'glide', 'swim', 'run', …); null = follow the real movement mode.
   */
  forcedAnim: null as null | string,
  /** True once the character model has loaded (screenshots wait for it). */
  characterLoaded: false,
  /** Current character animation state and lift (debug/tests). */
  anim: { state: 'idle', lift: 0 },
  /** Set by the Player component; moves the player instantly (tests, shots). */
  teleport: null as null | ((x: number, z: number, yaw?: number) => void),
  /** Set by the Player component; only used by tests. */
  setStamina: null as null | ((value: number) => void),
};

export const cameraRig = {
  /** Rotation around the up axis; 0 = looking north (-z). */
  yaw: 0,
  /** Negative = looking down. */
  pitch: -0.28,
  distance: 5.5,
  minDistance: 2.5,
  maxDistance: 14,
  sensitivity: 0.0025,
  /** Actual distance after camera collision (read-only for others). */
  effectiveDistance: 5.5,
};

/** Unit vector the camera looks along on the ground plane for a given yaw. */
export function forwardFromYaw(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Yaw that makes the camera look along the given ground direction. */
export function yawFromDirection(x: number, z: number): number {
  return Math.atan2(-x, -z);
}
