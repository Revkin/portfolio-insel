/**
 * Phase 2 acceptance: sprint + stamina, swimming and the swim boundary,
 * climbing with pull-up, gliding and camera collision – all with the capsule.
 *
 * All speeds and durations use the game's simulation time, so the checks do
 * not depend on the frame rate of the (possibly software-rendered) test browser.
 */
import type { Page } from 'playwright';
import {
  getPlayer,
  measureFps,
  speedBetween,
  teleport,
  waitForPlayer,
  waitSimSeconds,
  yawFor,
  type Check,
  type DebugWindow,
} from './debug-api.ts';

const keys = {
  async down(page: Page, ...k: string[]) {
    for (const key of k) await page.keyboard.down(key);
  },
  async up(page: Page, ...k: string[]) {
    for (const key of k) await page.keyboard.up(key);
  },
};

async function section(page: Page, name: string) {
  console.log(`  [${name} – ${(await measureFps(page, 500)).toFixed(0)} fps]`);
}

export async function runMovementTests(page: Page, check: Check) {
  // --- Sprint & stamina ---
  {
    await section(page, 'Sprint & Ausdauer');
    await teleport(page, 10, 25, yawFor(1, 0));
    await keys.down(page, 'KeyW');
    await waitSimSeconds(page, 0.5); // accelerate
    let p0 = await getPlayer(page);
    await waitSimSeconds(page, 1);
    let p1 = await getPlayer(page);
    const walkSpeed = speedBetween(p0, p1);

    await keys.down(page, 'ShiftLeft');
    await waitSimSeconds(page, 0.4);
    p0 = await getPlayer(page);
    await waitSimSeconds(page, 1);
    p1 = await getPlayer(page);
    const sprintSpeed = speedBetween(p0, p1);
    check(sprintSpeed > walkSpeed * 1.4, 'Shift sprintet schneller als Gehen', `${walkSpeed.toFixed(1)} → ${sprintSpeed.toFixed(1)} m/s`);
    check(p1.stamina < 0.85, 'Sprinten verbraucht Ausdauer', `${(p1.stamina * 100).toFixed(0)} %`);
    check(
      (await page.getByTestId('stamina').getAttribute('data-visible')) === 'true',
      'Ausdauerleiste wird beim Verbrauch eingeblendet',
    );

    const exhausted = await waitForPlayer(page, 'p.exhausted', 30000);
    check(exhausted, 'Ausdauer läuft beim Dauersprint leer');
    await waitSimSeconds(page, 0.4);
    const e0 = await getPlayer(page);
    await waitSimSeconds(page, 1);
    const e1 = await getPlayer(page);
    const tiredSpeed = speedBetween(e0, e1);
    check(tiredSpeed < 5.5, 'Erschöpft: nur noch Gehtempo trotz Shift', `${tiredSpeed.toFixed(1)} m/s`);
    await keys.up(page, 'ShiftLeft', 'KeyW');
    const s0 = (await getPlayer(page)).stamina;
    await waitSimSeconds(page, 2);
    const s1 = (await getPlayer(page)).stamina;
    check(s1 > s0 + 0.2, 'Ausdauer regeneriert am Boden', `${(s0 * 100).toFixed(0)} → ${(s1 * 100).toFixed(0)} %`);
  }

  // --- Swimming & boundary ---
  {
    await section(page, 'Schwimmen');
    await teleport(page, 2, 54, yawFor(0, 1)); // beach, looking south to the sea
    await keys.down(page, 'KeyW');
    const swimming = await waitForPlayer(page, "p.mode === 'swim'", 30000);
    check(swimming, 'Ins Meer laufen → Schwimmen');
    await waitSimSeconds(page, 1.5);
    const a = await getPlayer(page);
    await waitSimSeconds(page, 1);
    const b = await getPlayer(page);
    check(Math.abs(b.y - a.y) < 0.3 && b.y > -1.6 && b.y < -0.6, 'Schwimmer treibt an der Oberfläche', `Füße y=${b.y.toFixed(2)}`);
    const swimSpeed = speedBetween(a, b);
    check(swimSpeed > 1.5 && swimSpeed < 3.5, 'Schwimmen ist langsamer als Gehen', `${swimSpeed.toFixed(1)} m/s`);

    await keys.down(page, 'ShiftLeft');
    await waitSimSeconds(page, 0.6);
    const f0 = await getPlayer(page);
    await waitSimSeconds(page, 1);
    const f1 = await getPlayer(page);
    await keys.up(page, 'ShiftLeft');
    check(
      speedBetween(f0, f1) > swimSpeed * 1.3 && f1.stamina < f0.stamina,
      'Shift im Wasser: schneller schwimmen, kostet Ausdauer',
      `${speedBetween(f0, f1).toFixed(1)} m/s`,
    );

    // Keep swimming outwards: the boundary must stop the player.
    await waitSimSeconds(page, 18, 90000);
    const far = await getPlayer(page);
    const d = Math.hypot(far.x / 100, far.z / 75);
    check(d < 1.36, 'Unsichtbare Grenze hält den Schwimmer nahe der Küste', `d=${d.toFixed(2)}`);
    check(far.mode === 'swim', 'Weiterhin im Schwimmmodus', far.mode);

    await page.evaluate((y) => (window as DebugWindow).__debug!.setYaw(y), yawFor(0, -1));
    const back = await waitForPlayer(page, "p.mode === 'ground'", 90000);
    await keys.up(page, 'KeyW');
    check(back, 'Zurück an Land schwimmen → wieder laufen');
  }

  // --- Climbing & pull-up ---
  const rock = await page.evaluate(() => (window as DebugWindow).__debug!.climbRock());
  {
    await section(page, 'Klettern');
    await teleport(page, rock.x + rock.radius + 6, rock.z, yawFor(-1, 0)); // east of the rock, facing it
    await keys.down(page, 'KeyW');
    const climbing = await waitForPlayer(page, "p.mode === 'climb'", 20000);
    check(climbing, 'Gegen Felswand laufen → Klettern startet');
    const c0 = await getPlayer(page);
    await waitSimSeconds(page, 1);
    const c1 = await getPlayer(page);
    const rate = (c1.y - c0.y) / (c1.time - c0.time);
    check(c1.mode !== 'climb' || rate > 1, 'W klettert nach oben', `${c1.mode}, ${rate.toFixed(1)} m/s`);
    check(c1.stamina < c0.stamina, 'Klettern verbraucht Ausdauer');
    const onTop = await waitForPlayer(page, `p.mode === 'ground' && p.y > ${rock.top - 2}`, 40000);
    await keys.up(page, 'KeyW');
    const top = await getPlayer(page);
    check(onTop, 'Oben an der Kante hochgezogen, steht auf dem Fels', `y=${top.y.toFixed(1)}, Fels oben ≈ ${rock.top.toFixed(1)}`);
  }

  // --- Climb jump & push off ---
  {
    await section(page, 'Klettersprung');
    // South side of the rock (the west side is already the sea cliff).
    await teleport(page, rock.x, rock.z + rock.radius + 6, yawFor(0, -1));
    await keys.down(page, 'KeyW');
    const climbing = await waitForPlayer(page, "p.mode === 'climb'", 20000);
    await keys.up(page, 'KeyW');
    await waitSimSeconds(page, 0.3);
    const j0 = await getPlayer(page);
    await page.keyboard.press('Space');
    await waitSimSeconds(page, 0.4);
    const j1 = await getPlayer(page);
    check(climbing && j1.y > j0.y + 1, 'Leertaste beim Klettern: Sprung nach oben', `+${(j1.y - j0.y).toFixed(1)} m`);
    check(j1.stamina < j0.stamina - 0.1, 'Klettersprung kostet Ausdauer');

    // Push off backwards: hold S, press Space.
    await keys.down(page, 'KeyS');
    await waitSimSeconds(page, 0.1);
    await page.keyboard.press('Space');
    const left = await waitForPlayer(page, "p.mode === 'air'", 5000);
    await keys.up(page, 'KeyS');
    const landed = await waitForPlayer(page, "p.mode === 'ground'", 15000);
    check(left && landed, 'S + Leertaste: von der Wand abspringen und landen');
  }

  // --- Climbing with too little stamina: fall off ---
  {
    await section(page, 'Klettern ohne Ausdauer');
    await teleport(page, rock.x + rock.radius + 4, rock.z, yawFor(-1, 0));
    await keys.down(page, 'KeyW');
    const climbing = await waitForPlayer(page, "p.mode === 'climb'", 20000);
    await waitSimSeconds(page, 0.5);
    // Leave only a little stamina (test hook) – about one second of climbing.
    await page.evaluate(() => (window as DebugWindow).__debug!.setStamina(0.1));
    const before = await getPlayer(page);
    // The fall can be very short, so watch for the climb ending instead of the air phase.
    const fell = await waitForPlayer(page, "p.mode !== 'climb'", 30000);
    const atFall = await getPlayer(page);
    await keys.up(page, 'KeyW');
    check(
      climbing && fell && atFall.mode !== 'mantle' && atFall.stamina < 0.05 && atFall.time - before.time < 2.5,
      'Ausdauer leer beim Klettern → Charakter fällt',
      `nach ${(atFall.time - before.time).toFixed(1)} s, Ausdauer ${(atFall.stamina * 100).toFixed(0)} %`,
    );
    const down = await waitForPlayer(page, "p.mode === 'ground'", 20000);
    check(down, 'Nach dem Absturz wieder auf dem Boden (kein erneutes Festhalten)');
  }

  // --- Gliding ---
  {
    await section(page, 'Gleiten');
    // Start a few metres before the east edge of the rock top, run and jump off.
    await teleport(page, rock.x + rock.radius - 4, rock.z, yawFor(1, 0));
    const topY = (await getPlayer(page)).y;
    await keys.down(page, 'KeyW');
    await waitForPlayer(page, `p.y < ${topY - 0.4} || p.x > ${rock.x + rock.radius - 1}`, 20000);
    await page.keyboard.press('Space'); // jump (or coyote jump) off the edge
    await waitSimSeconds(page, 0.35);
    await page.keyboard.press('Space'); // open the glider
    const gliding = await waitForPlayer(page, "p.mode === 'glide'", 3000);
    check(gliding, 'Von der Kante springen, Leertaste in der Luft → Gleiter öffnet');
    const g0 = await getPlayer(page);
    await waitSimSeconds(page, 1.2);
    const g1 = await getPlayer(page);
    const horizontal = Math.hypot(g1.x - g0.x, g1.z - g0.z);
    const drop = g0.y - g1.y;
    check(
      gliding && horizontal > 6 && horizontal > 2.5 * Math.max(drop, 0.1),
      'Gleiten: weit nach vorn, langsam nach unten',
      `${horizontal.toFixed(1)} m vor, ${drop.toFixed(1)} m runter in 1,2 s`,
    );
    const landed = await waitForPlayer(page, "p.mode === 'ground' || p.mode === 'swim'", 30000);
    await keys.up(page, 'KeyW');
    check(landed, 'Gleiter landet sicher');

    // Toggle: open and close again in the air.
    await teleport(page, rock.x + rock.radius - 4, rock.z, yawFor(1, 0));
    await keys.down(page, 'KeyW');
    await waitForPlayer(page, `p.y < ${topY - 0.4} || p.x > ${rock.x + rock.radius - 1}`, 20000);
    await page.keyboard.press('Space');
    let opened = false;
    for (let i = 0; i < 4 && !opened; i++) {
      await waitSimSeconds(page, 0.25);
      await page.keyboard.press('Space');
      opened = await waitForPlayer(page, "p.mode === 'glide'", 1000);
    }
    await waitSimSeconds(page, 0.3);
    await page.keyboard.press('Space');
    const closed = await waitForPlayer(page, "p.mode === 'air' || p.mode === 'ground'", 3000);
    await keys.up(page, 'KeyW');
    check(opened && closed, 'Leertaste im Gleitflug schließt den Gleiter', `geöffnet: ${opened}, geschlossen: ${closed}`);
    await waitForPlayer(page, "p.mode === 'ground'", 20000);
  }

  // --- Camera collision ---
  {
    await section(page, 'Kamera');
    // Stand at the foot of the rock looking away from it: the camera would be inside the rock.
    await teleport(page, rock.x + rock.radius + 2.5, rock.z, yawFor(1, 0));
    await page.evaluate(() => (window as DebugWindow).__debug!.setCamera(-0.1, 10));
    await waitSimSeconds(page, 0.5);
    const cam = await page.evaluate(() => (window as DebugWindow).__debug!.camera());
    check(cam.effectiveDistance < cam.distance - 2, 'Kamera rückt bei Hindernissen näher heran', `${cam.effectiveDistance.toFixed(1)} von ${cam.distance} m`);
    await teleport(page, 10, 25, yawFor(1, 0));
    await waitSimSeconds(page, 1.5);
    const free = await page.evaluate(() => (window as DebugWindow).__debug!.camera());
    check(free.effectiveDistance > free.distance - 0.5, 'Ohne Hindernis wieder voller Abstand', `${free.effectiveDistance.toFixed(1)} m`);
    await page.evaluate(() => (window as DebugWindow).__debug!.setCamera(-0.28, 5.5));
  }
}
