/**
 * Quick look at any spot of the island from the game camera (for checking
 * the world while building it).
 *
 *   node scripts/look.ts <x> <z> <dirX> <dirZ> [pitch] [distance] [out.png]
 *
 * Teleports the player to (x, z), turns the camera along (dirX, dirZ) and
 * saves a screenshot (default: docs/screenshots/look.png). Needs `npm run build`.
 */
import { resolve } from 'node:path';
import { VIEWPORT, waitForScene, withPreviewPage } from './browser.ts';
import { teleport, waitSimSeconds, yawFor, type DebugWindow } from './debug-api.ts';

const [x, z, dx, dz, pitch = '-0.25', distance = '6', out = 'docs/screenshots/look.png'] = process.argv.slice(2);
if (dz === undefined) {
  console.error('Usage: node scripts/look.ts <x> <z> <dirX> <dirZ> [pitch] [distance] [out.png]');
  process.exit(1);
}

await withPreviewPage(async (page, baseUrl) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${baseUrl}?debug`);
  await waitForScene(page);
  await teleport(page, Number(x), Number(z), yawFor(Number(dx), Number(dz)));
  await page.evaluate(([p, d]) => (window as DebugWindow).__debug!.setCamera(p!, d!), [Number(pitch), Number(distance)]);
  await waitSimSeconds(page, 1.5);
  await page.screenshot({ path: resolve(out) });
  console.log(`→ ${out}`);
});
