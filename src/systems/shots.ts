/**
 * Fixed camera positions for automated screenshots (`npm run screenshots`).
 * The Playwright script opens the page with `?shot=<name>` and waits until
 * `window.__sceneReady` is true. New shots (day, dusk, night, portal close-up,
 * overlay, start screen) are added here as the corresponding phases land.
 */
export type Vec3 = [number, number, number];

export interface Shot {
  name: string;
  camera: Vec3;
  target: Vec3;
  isScreenshot: boolean;
}

const SHOTS: Record<string, Omit<Shot, 'name' | 'isScreenshot'>> = {
  overview: { camera: [0, 120, 230], target: [0, 0, 0] },
};

export function getShot(): Shot {
  const requested = new URLSearchParams(window.location.search).get('shot');
  const name = requested && requested in SHOTS ? requested : 'overview';
  const preset = SHOTS[name] ?? { camera: [0, 120, 230], target: [0, 0, 0] };
  return { name, ...preset, isScreenshot: requested !== null };
}

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}
