/**
 * Screenshots from the real follow camera while the character actually moves:
 * climbing, pulling up, gliding, swimming and sprinting.
 *
 *   npm run build && npm run screenshots:action
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
import { waitForScene, withPreviewPage } from './browser.ts';
import { openGlider, teleport, waitForPlayer, waitSimSeconds, yawFor, type DebugWindow } from './debug-api.ts';

const OUT_DIR = resolve('docs/screenshots');
const only = process.argv.slice(2);
await mkdir(OUT_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  if (only.length && !only.includes(name)) return;
  const file = resolve(OUT_DIR, `action-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`• ${name} → ${file}`);
}

await withPreviewPage(async (page, baseUrl) => {
  await page.goto(`${baseUrl}?debug`);
  await waitForScene(page);
  const rock = await page.evaluate(() => (window as DebugWindow).__debug!.climbRock());
  const cam = (pitch: number, distance: number) =>
    page.evaluate(([p, d]) => (window as DebugWindow).__debug!.setCamera(p!, d!), [pitch, distance] as const);

  // Climbing the rock (camera behind and slightly below).
  await cam(-0.05, 4.5);
  await teleport(page, rock.x + rock.radius + 4, rock.z, yawFor(-1, 0));
  await page.keyboard.down('KeyW');
  await waitForPlayer(page, "p.mode === 'climb'", 20000);
  await waitSimSeconds(page, 1.6);
  await shot(page, 'climb');
  await waitForPlayer(page, "p.mode === 'mantle'", 20000);
  await waitSimSeconds(page, 0.15);
  await shot(page, 'mantle');
  await page.keyboard.up('KeyW');
  await waitForPlayer(page, "p.mode === 'ground'", 10000);

  // Gliding off the rock.
  await cam(-0.15, 6);
  await teleport(page, rock.x + rock.radius - 4, rock.z, yawFor(1, 0));
  const topY = (await page.evaluate(() => (window as DebugWindow).__debug!.player())).y;
  await page.keyboard.down('KeyW');
  await waitForPlayer(page, `p.y < ${topY - 0.4} || p.x > ${rock.x + rock.radius - 1}`, 20000);
  await openGlider(page);
  await waitSimSeconds(page, 0.8);
  await shot(page, 'glide');
  await page.keyboard.up('KeyW');
  await waitForPlayer(page, "p.mode === 'ground' || p.mode === 'swim'", 30000);

  // Swimming.
  await cam(-0.2, 5);
  await teleport(page, 2, 54, yawFor(0, 1));
  await page.keyboard.down('KeyW');
  await waitForPlayer(page, "p.mode === 'swim'", 30000);
  await waitSimSeconds(page, 1.5);
  await page.evaluate((y) => (window as DebugWindow).__debug!.setYaw(y), yawFor(1, 0));
  await waitSimSeconds(page, 1.2);
  await shot(page, 'swim');
  await page.keyboard.up('KeyW');
  await waitSimSeconds(page, 1.5);
  await shot(page, 'swim-idle');

  // Sprinting along the path.
  await cam(-0.2, 5.5);
  await teleport(page, 10, 25, yawFor(1, 0));
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await waitSimSeconds(page, 1.2);
  await shot(page, 'sprint');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');

  // Jump.
  await waitSimSeconds(page, 0.8);
  await page.keyboard.press('Space');
  await waitSimSeconds(page, 0.3);
  await shot(page, 'jump');
});
