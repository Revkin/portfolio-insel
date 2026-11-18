/**
 * Fixed views for automated screenshots (`npm run screenshots`).
 * The Playwright script opens the page with `?shot=<name>` and waits until
 * `window.__sceneReady` is true. More shots (dusk, night, start screen) are
 * added as the corresponding phases land.
 */
export type Vec3 = [number, number, number];

export interface ShotConfig {
  /** Fixed camera instead of the follow camera. */
  fixedCamera?: { position: Vec3; target: Vec3 };
  /** Where the player stands: path start or in front of portal N. */
  player: 'spawn' | { portalIndex: number };
  pitch?: number;
  distance?: number;
  /** Open the overlay of the portal the player stands at. */
  openOverlay?: boolean;
}

export const SHOTS = {
  overview: {
    fixedCamera: { position: [10, 95, 175], target: [0, 0, -5] },
    player: 'spawn',
  },
  gameplay: { player: 'spawn', pitch: -0.2, distance: 5.5 },
  /** Climbing rock in the west (Phase 2). */
  rock: {
    fixedCamera: { position: [-38, 20, -2], target: [-74, 7, -26] },
    player: 'spawn',
  },
  portal: { player: { portalIndex: 0 }, pitch: -0.18, distance: 6 },
  overlay: { player: { portalIndex: 0 }, pitch: -0.18, distance: 6, openOverlay: true },
} satisfies Record<string, ShotConfig>;

export type ShotName = keyof typeof SHOTS;

export function getShotFromUrl(): { name: ShotName; config: ShotConfig } | null {
  const requested = new URLSearchParams(window.location.search).get('shot');
  if (requested && requested in SHOTS) {
    const name = requested as ShotName;
    return { name, config: SHOTS[name] };
  }
  return null;
}

export function isDebugMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('debug') || params.has('shot');
}

declare global {
  interface Window {
    __sceneReady?: boolean;
    __debug?: unknown;
  }
}
