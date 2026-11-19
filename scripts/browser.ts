/** Shared helper: serve dist/ with `vite preview` and open headless Chromium. */
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import { chromium, type Page } from 'playwright';

export const VIEWPORT = { width: 1600, height: 900 };

export async function withPreviewPage(run: (page: Page, baseUrl: string) => Promise<void>): Promise<void> {
  if (!existsSync('dist/index.html')) {
    throw new Error('dist/ fehlt – zuerst `npm run build` ausführen.');
  }
  const server = await preview({ preview: { port: 4173, strictPort: false, open: false } });
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error('Preview-Server hat keine URL geliefert.');

  // Ask for the real GPU via ANGLE/D3D11; falls back to software rendering.
  const browser = await chromium.launch({
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`  [browser] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.error(`  [pageerror] ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 400) console.error(`  [http ${res.status()}] ${res.url()}`);
    });
    await run(page, baseUrl);
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.httpServer.close(() => done()));
  }
}

export async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as Window & { __sceneReady?: boolean }).__sceneReady === true,
    undefined,
    { timeout: 60_000 },
  );
}

export async function webglRenderer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unbekannt';
  });
}
