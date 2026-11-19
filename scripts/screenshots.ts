/**
 * Renders reference views of the production build to docs/screenshots/.
 *
 *   npm run build && npm run screenshots
 *   npm run screenshots -- overview      (only selected shots)
 *
 * Opens each shot with `?shot=<name>` and waits for `window.__sceneReady`.
 * Shot names must exist in src/systems/shots.ts.
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { waitForScene, webglRenderer, withPreviewPage } from './browser.ts';

// Must match SHOTS in src/systems/shots.ts.
const ALL_SHOTS = ['overview', 'gameplay', 'rock', 'char-idle', 'char-back', 'char-run', 'char-climb', 'char-glide', 'char-swim', 'portal', 'overlay'];
const OUT_DIR = resolve('docs/screenshots');

const requested = process.argv.slice(2);
const shots = requested.length > 0 ? requested : ALL_SHOTS;

await mkdir(OUT_DIR, { recursive: true });

let failed = false;
await withPreviewPage(async (page, baseUrl) => {
  await page.goto(baseUrl);
  console.log(`WebGL-Renderer: ${await webglRenderer(page)}`);

  for (const shot of shots) {
    process.stdout.write(`• ${shot} … `);
    try {
      await page.goto(`${baseUrl}?shot=${encodeURIComponent(shot)}`, { waitUntil: 'load' });
      await waitForScene(page);
      // Let the camera settle and shadows/animations update.
      await page.waitForTimeout(1500);
      const file = resolve(OUT_DIR, `${shot}.png`);
      await page.screenshot({ path: file });
      console.log(`ok → ${file}`);
    } catch (err) {
      failed = true;
      console.log('FEHLER');
      console.error(err);
    }
  }
});

process.exit(failed ? 1 : 0);
