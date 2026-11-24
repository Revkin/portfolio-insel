/**
 * End-to-end smoke test of the production build:
 * Phase 1 – walk across the island, open a portal with E, switch DE/EN, close with Esc.
 * Phase 2 – sprint/stamina, swim, climb, glide, camera collision (movement-tests.ts).
 *
 *   npm run build && npm run test:smoke
 *   npm run test:smoke -- movement      (only the movement part)
 */
import type { Page } from 'playwright';
import { waitForScene, withPreviewPage } from './browser.ts';
import { waitSimSeconds, type DebugWindow } from './debug-api.ts';
import { runMovementTests } from './movement-tests.ts';

const only = process.argv[2];

let failures = 0;
function check(ok: boolean, label: string, detail = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

const player = (page: Page) => page.evaluate(() => (window as DebugWindow).__debug!.player());
const state = (page: Page) => page.evaluate(() => (window as DebugWindow).__debug!.state());

await withPreviewPage(async (page, baseUrl) => {
  await page.goto(`${baseUrl}?debug&lang=de`);
  await waitForScene(page);
  await page.waitForTimeout(500);

  const fps = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else done((frames * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`Bildrate im Test-Browser: ${fps.toFixed(1)} fps`);

  if (only === 'movement') {
    console.log('\n— Bewegung (Phase 2) —');
    await runMovementTests(page, check);
    return;
  }
  console.log('\n— Welt, Portale, Overlay (Phase 1) —');

  const portalCount = await page.evaluate(() => (window as DebugWindow).__debug!.portalCount);
  check(portalCount === 5, 'Fünf Portale aus den Projektdaten', `${portalCount}`);

  // --- Walking ---
  const start = await player(page);
  check(start.grounded, 'Spieler steht nach dem Laden auf dem Boden', `y=${start.y.toFixed(2)}`);
  // Durations in simulation time: the test browser may render slowly.
  await page.keyboard.down('KeyW');
  await waitSimSeconds(page, 2.5, 120000);
  await page.keyboard.up('KeyW');
  await waitSimSeconds(page, 0.3, 60000);
  const walked = await player(page);
  const dist = Math.hypot(walked.x - start.x, walked.z - start.z);
  check(dist > 4, 'W bewegt den Spieler vorwärts', `${dist.toFixed(1)} m`);
  check(walked.grounded && walked.y > -0.5, 'Spieler bleibt auf dem Gelände', `y=${walked.y.toFixed(2)}`);

  await page.keyboard.down('KeyD');
  await waitSimSeconds(page, 0.8, 60000);
  await page.keyboard.up('KeyD');
  const strafed = await player(page);
  check(Math.hypot(strafed.x - walked.x, strafed.z - walked.z) > 1, 'D bewegt seitlich');

  // --- Jump ---
  const beforeJump = await player(page);
  await page.keyboard.press('Space');
  await waitSimSeconds(page, 0.25, 60000);
  const inAir = await player(page);
  check(inAir.y > beforeJump.y + 0.5, 'Leertaste springt', `+${(inAir.y - beforeJump.y).toFixed(2)} m`);
  await waitSimSeconds(page, 1.2, 60000);
  check((await player(page)).grounded, 'Landet wieder auf dem Boden');

  // --- Walk the whole path: beach → bridge → house ---
  {
    const points = await page.evaluate(() => (window as DebugWindow).__debug!.pathPoints());
    const first = points[0]!;
    await page.evaluate((p) => (window as DebugWindow).__debug!.teleport(p.x, p.z), first);
    await waitSimSeconds(page, 0.5, 60000);
    let reached = 0;
    let stuckAt: string | null = null;
    let minY = Infinity;
    await page.keyboard.down('KeyW');
    for (let k = 1; k < points.length; k++) {
      const target = points[k]!;
      const deadline = (await player(page)).time + 8;
      let ok = false;
      for (;;) {
        const p = await player(page);
        if (p.time > deadline) break;
        minY = Math.min(minY, p.y);
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        if (Math.hypot(dx, dz) < 2) {
          ok = true;
          break;
        }
        await page.evaluate((yaw) => (window as DebugWindow).__debug!.setYaw(yaw), Math.atan2(-dx, -dz));
        await page.waitForTimeout(60);
      }
      if (!ok) {
        const p = await player(page);
        stuckAt = `Wegpunkt ${k}/${points.length - 1} bei x=${p.x.toFixed(1)} z=${p.z.toFixed(1)}`;
        break;
      }
      reached = k;
    }
    await page.keyboard.up('KeyW');
    check(stuckAt === null, 'Ganzen Pfad vom Strand bis zum Haus abgelaufen', stuckAt ?? `${reached} Wegpunkte`);
    check(minY > 0.5, 'Unterwegs nie unter die Wasserlinie gefallen', `min y=${minY.toFixed(2)}`);
  }

  // --- Portal interaction ---
  // Wait for the state instead of fixed delays: software rendering can be slow.
  const waitForNear = (id: string) =>
    page
      .waitForFunction((want) => (window as DebugWindow).__debug!.state().nearPortalId === want, id, {
        timeout: 5000,
      })
      .then(() => true)
      .catch(() => false);

  for (let i = 0; i < portalCount; i++) {
    await page.evaluate((idx) => (window as DebugWindow).__debug!.teleportToPortal(idx), i);
    const ok = await waitForNear(`placeholder-${i + 1}`);
    check(ok, `Portal ${i + 1}: Hinweis „E – Öffnen“ erscheint`, String((await state(page)).nearPortalId));
  }

  await page.evaluate(() => (window as DebugWindow).__debug!.teleportToPortal(0));
  await waitForNear('placeholder-1');
  check(await page.getByTestId('interact-prompt').isVisible(), 'Hinweis ist im HUD sichtbar');
  await page.keyboard.press('KeyE');
  const overlay = page.getByTestId('project-overlay');
  await overlay.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
  check(await overlay.isVisible(), 'E öffnet das Overlay');
  check((await overlay.locator('h2').textContent()) === 'Platzhalter-Projekt 1', 'Overlay-Titel auf Deutsch');

  // Movement is paused while the overlay is open.
  const paused = await player(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  const stillPaused = await player(page);
  check(Math.hypot(stillPaused.x - paused.x, stillPaused.z - paused.z) < 0.1, 'Bewegung pausiert bei offenem Overlay');

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  check((await overlay.locator('h2').textContent()) === 'Placeholder project 1', 'Sprache EN schaltet den Overlay-Text um');
  check(await page.evaluate(() => document.documentElement.lang) === 'en', '<html lang> wechselt auf en');
  await page.getByRole('button', { name: 'DE', exact: true }).click();
  check((await overlay.locator('h2').textContent()) === 'Platzhalter-Projekt 1', 'Zurück auf DE');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(!(await overlay.isVisible()), 'Esc schließt das Overlay');

  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  check(await overlay.isVisible(), 'Overlay lässt sich erneut öffnen');
  await page.getByRole('button', { name: /Schließen/ }).click();
  await page.waitForTimeout(200);
  check(!(await overlay.isVisible()), 'Schließen-Button schließt das Overlay');

  console.log('\n— Bewegung (Phase 2) —');
  await runMovementTests(page, check);
});

console.log(failures === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
