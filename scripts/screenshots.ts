/**
 * Renders reference views of the production build to docs/screenshots/.
 *
 *   npm run build && npm run screenshots
 *   npm run screenshots -- overview      (only selected shots)
 *
 * Starts `vite preview` programmatically, opens each shot with `?shot=<name>`
 * in headless Chromium and waits for `window.__sceneReady`.
 * Shot names must exist in src/systems/shots.ts.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const ALL_SHOTS = ['overview'];
const VIEWPORT = { width: 1600, height: 900 };
const OUT_DIR = resolve('docs/screenshots');

const requested = process.argv.slice(2);
const shots = requested.length > 0 ? requested : ALL_SHOTS;

if (!existsSync('dist/index.html')) {
  console.error('dist/ fehlt – zuerst `npm run build` ausführen.');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: false, open: false } });
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Preview-Server hat keine URL geliefert.');

// Use the real GPU via ANGLE/D3D11 so screenshots match what a browser shows.
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});

let failed = false;
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`  [browser] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.error(`  [pageerror] ${err.message}`));

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unbekannt';
  });
  console.log(`WebGL-Renderer: ${renderer}`);

  for (const shot of shots) {
    const url = `${baseUrl}?shot=${encodeURIComponent(shot)}`;
    process.stdout.write(`• ${shot} … `);
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(
        () => (window as Window & { __sceneReady?: boolean }).__sceneReady === true,
        undefined,
        { timeout: 30_000 },
      );
      // Let animations, shadows and postprocessing settle.
      await page.waitForTimeout(1000);
      const file = resolve(OUT_DIR, `${shot}.png`);
      await page.screenshot({ path: file });
      console.log(`ok → ${file}`);
    } catch (err) {
      failed = true;
      console.log('FEHLER');
      console.error(err);
    }
  }
} finally {
  await browser.close();
  await new Promise<void>((done) => server.httpServer.close(() => done()));
}

process.exit(failed ? 1 : 0);
