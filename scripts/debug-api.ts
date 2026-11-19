/** Shape of `window.__debug` (see DebugHooks in src/Game.tsx), for the test scripts. */
import type { Page } from 'playwright';

export type MoveMode = 'ground' | 'air' | 'glide' | 'swim' | 'climb' | 'mantle';

export interface PlayerInfo {
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  mode: MoveMode;
  stamina: number;
  exhausted: boolean;
  /** Simulation time in seconds. */
  time: number;
  /** Character animation state (see src/player/Character.tsx). */
  anim: string;
  lift: number;
  speed: number;
  /** Height of the feet above ground or water. */
  agl: number;
}

/**
 * Gets the player into the glider from wherever they are near an edge:
 * jumps when on the ground, opens the glider once high enough in the air.
 * Holds W the whole time. Returns true when gliding.
 */
export async function openGlider(page: Page, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const p = await getPlayer(page);
    if (p.mode === 'glide') return true;
    if (p.mode === 'swim') return false;
    if (p.mode === 'ground' || (p.mode === 'air' && p.agl > 1.5)) {
      await page.keyboard.press('Space');
      await waitSimSeconds(page, 0.2);
      continue;
    }
    await waitSimSeconds(page, 0.05);
  }
  return false;
}

/** Horizontal speed between two samples, in metres per *simulation* second. */
export function speedBetween(a: PlayerInfo, b: PlayerInfo): number {
  const dt = b.time - a.time;
  return dt > 0 ? Math.hypot(b.x - a.x, b.z - a.z) / dt : 0;
}

/** Waits until `seconds` of simulation time have passed (independent of the frame rate). */
export async function waitSimSeconds(page: Page, seconds: number, timeoutMs = 30000): Promise<void> {
  const start = (await getPlayer(page)).time;
  await page.waitForFunction(
    (t) => (window as DebugWindow).__debug!.player().time >= t,
    start + seconds,
    { timeout: timeoutMs, polling: 30 },
  );
}

export interface DebugApi {
  portalCount: number;
  player: () => PlayerInfo;
  camera: () => { effectiveDistance: number; distance: number };
  climbRock: () => { x: number; z: number; radius: number; height: number; top: number };
  setCamera: (pitch: number, distance: number) => void;
  setStamina: (value: number) => void;
  teleportToPortal: (i: number) => boolean;
  teleport: (x: number, z: number, yaw?: number) => void;
  setYaw: (yaw: number) => void;
  pathPoints: () => { x: number; z: number }[];
  state: () => { lang: string; nearPortalId: string | null; openProjectId: string | null };
}

export type DebugWindow = Window & { __debug?: DebugApi };

export type Check = (ok: boolean, label: string, detail?: string) => void;

export const getPlayer = (page: Page) => page.evaluate(() => (window as DebugWindow).__debug!.player());

/** Yaw that makes the camera look along (x, z) – same formula as in the game. */
export const yawFor = (x: number, z: number) => Math.atan2(-x, -z);

export async function teleport(page: Page, x: number, z: number, yaw?: number) {
  await page.evaluate(([px, pz, py]) => (window as DebugWindow).__debug!.teleport(px!, pz!, py), [x, z, yaw] as const);
  // Let a few frames run so the controller settles on the ground.
  await page.waitForTimeout(400);
}

export async function measureFps(page: Page, ms = 1000): Promise<number> {
  return page.evaluate(
    (duration) =>
      new Promise<number>((done) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < duration) requestAnimationFrame(tick);
          else done((frames * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

export async function waitForPlayer(
  page: Page,
  predicate: string,
  timeout: number,
): Promise<boolean> {
  return page
    .waitForFunction(
      (body) => {
        const p = (window as DebugWindow).__debug!.player();
        return new Function('p', `return (${body});`)(p) as boolean;
      },
      predicate,
      { timeout, polling: 50 },
    )
    .then(() => true)
    .catch(() => false);
}
