import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import type * as RapierModule from '@dimforge/rapier3d-compat';
import { MathUtils, Vector3 } from 'three';
import { ISLAND_RADIUS_X, ISLAND_RADIUS_Z } from '../world/layout.ts';
import { sampleHeight, waterSurfaceAt } from '../world/terrain.ts';
import { clamp } from '../world/math.ts';

/**
 * Movement state machine for the player capsule (SPEC section 7):
 * walk/sprint, jump, glide, swim, climb (+ pulling up over ledges).
 * Physics via Rapier's kinematic character controller.
 */
export type MoveMode = 'ground' | 'air' | 'glide' | 'swim' | 'climb' | 'mantle';

export const CAPSULE_HALF_HEIGHT = 0.5;
export const CAPSULE_RADIUS = 0.35;
/** Distance from the capsule centre down to the feet. */
export const FOOT_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;

const WALK_SPEED = 4.5;
const SPRINT_SPEED = 8;
const ACCELERATION = 14;
const AIR_CONTROL = 0.35;
const JUMP_SPEED = 6.2;
const GRAVITY = -20;
const MAX_FALL_SPEED = -40;
const COYOTE_TIME = 0.12;

const GLIDE_SPEED = 8.5;
const GLIDE_SINK = -2.2;
const GLIDE_TURN_RATE = 2.2;
const GLIDE_MIN_HEIGHT = 1.2;

const SWIM_SPEED = 2.6;
const SWIM_FAST_SPEED = 4.2;
/** Floating: feet this far below the surface. */
const SWIM_FLOAT_DEPTH = 1.15;
/**
 * Swim when the water (surface to ground) is deeper than the floating depth,
 * so the swimmer never drags over the sea floor; walk again in shallower water.
 */
const SWIM_ENTER_DEPTH = 1.3;
const SWIM_EXIT_DEPTH = 1.1;

const CLIMB_SPEED = 2.0;
const CLIMB_JUMP_SPEED = 6;
const CLIMB_JUMP_TIME = 0.3;
/** Surfaces steeper than this (normal.y below) can be climbed. */
const CLIMB_MAX_NORMAL_Y = 0.6;
const WALL_PROBE = 0.55;
const MANTLE_TIME = 0.35;

// Stamina, 0..1
const SPRINT_DRAIN = 0.18;
const SWIM_FAST_DRAIN = 0.2;
const CLIMB_DRAIN = 0.1;
const CLIMB_IDLE_DRAIN = 0.03;
const CLIMB_JUMP_COST = 0.15;
const REGEN = 0.3;
const REGEN_DELAY = 0.6;
const EXHAUSTED_RECOVER = 0.3;

/** Swimming boundary in island-normalised distance (1 ≈ coast). */
const BOUND_SOFT = 1.15;
const BOUND_HARD = 1.3;

export interface MoveInput {
  /** Raw axes: forward (W = +1) and right (D = +1). */
  forward: number;
  right: number;
  /** Camera forward on the ground plane (unit). */
  camForward: { x: number; z: number };
  sprint: boolean;
  jump: boolean;
}

/** Only the parts of the Rapier module this class needs. */
type Rapier = { Ray: typeof RapierModule.Ray };

const UP = new Vector3(0, 1, 0);

export class Locomotion {
  mode: MoveMode = 'ground';
  readonly vel = new Vector3();
  stamina = 1;
  exhausted = false;
  /** Heading of the visual (atan2(x, z)); null = keep. */
  facing: number | null = null;

  private coyote = 0;
  private regenDelay = 0;
  private climbJump = 0;
  private lostWall = 0;
  private noClimbUntilGrounded = false;
  private climbCooldown = 0;
  private readonly wallNormal = new Vector3();
  private readonly mantleFrom = new Vector3();
  private readonly mantleTo = new Vector3();
  private mantleT = 0;
  private configuredFor: string | null = null;

  // Scratch vectors (no per-frame allocations).
  private readonly desired = new Vector3();
  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();
  private readonly tmpC = new Vector3();
  private readonly ray: RapierModule.Ray;

  constructor(
    private readonly R: Rapier,
    private readonly world: World,
    private readonly body: RigidBody,
    private readonly collider: Collider,
    private readonly ctrl: KinematicCharacterController,
  ) {
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    ctrl.setUp({ x: 0, y: 1, z: 0 });
  }

  reset() {
    this.mode = 'ground';
    this.vel.set(0, 0, 0);
    this.climbJump = 0;
    this.mantleT = 0;
    this.noClimbUntilGrounded = false;
  }

  /** Advances one frame and moves the kinematic body. Returns the new centre position. */
  update(dt: number, input: MoveInput): Vector3 {
    const p = this.body.translation();
    const center = this.tmpC.set(p.x, p.y, p.z);
    this.climbCooldown = Math.max(0, this.climbCooldown - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    if (this.mode === 'mantle') return this.updateMantle(dt, center);
    if (this.mode === 'climb') return this.updateClimb(dt, input, center);
    return this.updateFree(dt, input, center);
  }

  // ---------------------------------------------------------------- free movement

  private updateFree(dt: number, input: MoveInput, center: Vector3): Vector3 {
    const vel = this.vel;
    const feet = center.y - FOOT_OFFSET;
    const surface = waterSurfaceAt(center.x, center.z);
    const waterDepth = surface - sampleHeight(center.x, center.z);

    // Enter / leave water (feet must actually be in the water, e.g. not gliding above it).
    if (this.mode !== 'swim' && waterDepth > SWIM_ENTER_DEPTH && surface - feet > 0.5) {
      this.mode = 'swim';
      vel.y *= 0.2;
    } else if (this.mode === 'swim' && waterDepth < SWIM_EXIT_DEPTH) {
      this.mode = 'air';
    }

    // Wish direction relative to the camera.
    const { camForward: f } = input;
    let wx = f.x * input.forward - f.z * input.right;
    let wz = f.z * input.forward + f.x * input.right;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }
    const moving = wl > 0;

    // Jump / glider toggle.
    if (input.jump) {
      if (this.mode === 'ground' || (this.mode === 'air' && this.coyote > 0)) {
        vel.y = JUMP_SPEED;
        this.mode = 'air';
        this.coyote = 0;
      } else if (this.mode === 'air' && this.heightAboveSurface(center) > GLIDE_MIN_HEIGHT) {
        this.mode = 'glide';
        vel.y = Math.max(vel.y, GLIDE_SINK);
      } else if (this.mode === 'glide') {
        this.mode = 'air';
      }
    }

    // Horizontal velocity per mode.
    const canSprint = input.sprint && moving && !this.exhausted && this.stamina > 0;
    let draining = false;
    if (this.mode === 'glide') {
      let hx = vel.x;
      let hz = vel.z;
      let hl = Math.hypot(hx, hz);
      if (hl < 0.1) {
        hx = f.x;
        hz = f.z;
        hl = 1;
      }
      let heading = Math.atan2(hx, hz);
      if (moving) {
        const target = Math.atan2(wx, wz);
        const delta = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
        heading += clamp(delta, -GLIDE_TURN_RATE * dt, GLIDE_TURN_RATE * dt);
      }
      const speed = MathUtils.lerp(hl, GLIDE_SPEED, 1 - Math.exp(-2 * dt));
      vel.x = Math.sin(heading) * speed;
      vel.z = Math.cos(heading) * speed;
      vel.y += (GLIDE_SINK - vel.y) * (1 - Math.exp(-3 * dt));
    } else {
      let speed = WALK_SPEED;
      let control = 1;
      if (this.mode === 'ground') {
        if (canSprint) {
          speed = SPRINT_SPEED;
          draining = true;
        }
      } else if (this.mode === 'swim') {
        const fast = input.sprint && moving && !this.exhausted && this.stamina > 0;
        speed = fast ? SWIM_FAST_SPEED : SWIM_SPEED;
        draining = fast;
      } else {
        control = AIR_CONTROL;
        // Keep sprint momentum through a jump.
        speed = Math.max(WALK_SPEED, Math.hypot(vel.x, vel.z));
      }
      const blend = 1 - Math.exp(-ACCELERATION * control * dt);
      // In the air without input keep momentum instead of braking.
      if (this.mode !== 'air' || moving) {
        vel.x += (wx * speed - vel.x) * blend;
        vel.z += (wz * speed - vel.z) * blend;
      }

      if (this.mode === 'ground') {
        if (vel.y <= 0) vel.y = -2;
      } else if (this.mode === 'swim') {
        const targetFeet = waterSurfaceAt(center.x, center.z) - SWIM_FLOAT_DEPTH;
        vel.y = clamp((targetFeet - feet) * 4, -3, 3);
      } else {
        vel.y = Math.max(vel.y + GRAVITY * dt, MAX_FALL_SPEED);
      }
    }

    this.updateStamina(dt, draining, this.mode === 'ground');

    // Soft boundary: drift back towards the island when swimming too far out.
    const d = Math.hypot(center.x / ISLAND_RADIUS_X, center.z / ISLAND_RADIUS_Z);
    if (d > BOUND_SOFT) {
      const ox = center.x / ISLAND_RADIUS_X / d / ISLAND_RADIUS_X;
      const oz = center.z / ISLAND_RADIUS_Z / d / ISLAND_RADIUS_Z;
      const ol = Math.hypot(ox, oz) || 1;
      const nx = ox / ol;
      const nz = oz / ol;
      const outward = vel.x * nx + vel.z * nz;
      if (d > BOUND_HARD && outward > 0) {
        vel.x -= nx * outward;
        vel.z -= nz * outward;
      }
      const push = (d - BOUND_SOFT) * 25;
      vel.x -= nx * push * dt * 10;
      vel.z -= nz * push * dt * 10;
    }

    // Start climbing when pushing against a steep, climbable surface.
    const pushing = this.mode === 'glide' ? true : moving;
    if (pushing && this.canStartClimb()) {
      const dirX = this.mode === 'glide' && !moving ? Math.sin(Math.atan2(vel.x, vel.z)) : wx;
      const dirZ = this.mode === 'glide' && !moving ? Math.cos(Math.atan2(vel.x, vel.z)) : wz;
      if (this.tryStartClimb(center, dirX, dirZ)) return center;
    }

    // Move with the character controller.
    this.configure(this.mode);
    this.desired.set(vel.x * dt, vel.y * dt, vel.z * dt);
    this.ctrl.computeColliderMovement(this.collider, this.desired);
    const move = this.ctrl.computedMovement();
    const grounded = this.ctrl.computedGrounded();
    center.set(center.x + move.x, center.y + move.y, center.z + move.z);
    this.safetyNet(center);
    this.body.setNextKinematicTranslation(center);

    // State after moving.
    if (this.mode === 'ground' && !grounded) {
      this.mode = 'air';
      this.coyote = COYOTE_TIME;
      if (vel.y < 0) vel.y = 0;
    } else if ((this.mode === 'air' || this.mode === 'glide') && grounded && vel.y <= 0) {
      this.mode = 'ground';
      vel.y = 0;
    }
    if (this.mode === 'ground') this.noClimbUntilGrounded = false;

    const speed = Math.hypot(vel.x, vel.z);
    this.facing = speed > 0.3 ? Math.atan2(vel.x, vel.z) : null;
    return center;
  }

  // ---------------------------------------------------------------- climbing

  private canStartClimb(): boolean {
    return (
      !this.noClimbUntilGrounded &&
      this.climbCooldown <= 0 &&
      this.stamina > 0.05 &&
      !this.exhausted
    );
  }

  private tryStartClimb(center: Vector3, dirX: number, dirZ: number): boolean {
    const hit = this.castRay(center.x, center.y + 0.2, center.z, dirX, 0, dirZ, CAPSULE_RADIUS + WALL_PROBE);
    if (!hit || hit.normal.y > CLIMB_MAX_NORMAL_Y) return false;
    // Must be pushing into the wall, not sliding along it.
    const nh = Math.hypot(hit.normal.x, hit.normal.z) || 1;
    if ((dirX * hit.normal.x + dirZ * hit.normal.z) / nh > -0.5) return false;
    this.wallNormal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
    this.mode = 'climb';
    this.vel.set(0, 0, 0);
    this.lostWall = 0;
    this.climbJump = 0;
    return true;
  }

  private updateClimb(dt: number, input: MoveInput, center: Vector3): Vector3 {
    const n = this.wallNormal;
    const right = this.tmpA.crossVectors(UP, n);
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    right.normalize();
    const up = this.tmpB.crossVectors(n, right).normalize();

    const moving = input.forward !== 0 || input.right !== 0;
    this.stamina -= (moving || this.climbJump > 0 ? CLIMB_DRAIN : CLIMB_IDLE_DRAIN) * dt;
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.exhausted = true;
      return this.dropFromWall(center, 1.5);
    }
    this.regenDelay = REGEN_DELAY;

    if (input.jump) {
      if (input.forward < 0) {
        // Push off the wall backwards.
        this.vel.set(n.x * 4.5, 4, n.z * 4.5);
        this.climbCooldown = 0.4;
        this.mode = 'air';
        return center;
      }
      if (this.stamina > CLIMB_JUMP_COST && this.climbJump <= 0) {
        this.stamina -= CLIMB_JUMP_COST;
        this.climbJump = CLIMB_JUMP_TIME;
      }
    }

    const d = this.desired.set(0, 0, 0);
    if (this.climbJump > 0) {
      this.climbJump -= dt;
      d.addScaledVector(up, CLIMB_JUMP_SPEED * dt);
    } else if (moving) {
      const l = Math.hypot(input.forward, input.right);
      d.addScaledVector(up, (input.forward / l) * CLIMB_SPEED * dt);
      d.addScaledVector(right, (input.right / l) * CLIMB_SPEED * dt);
    }

    // Keep contact with the wall and follow its curvature.
    const hit = this.castRay(center.x, center.y, center.z, -n.x, -n.y, -n.z, CAPSULE_RADIUS + 0.9);
    if (hit && hit.normal.y <= 0.75) {
      this.lostWall = 0;
      this.tmpA.set(hit.normal.x, hit.normal.y, hit.normal.z);
      n.lerp(this.tmpA, 0.35).normalize();
      // Pull towards the wall horizontally only: a correction along the tilted
      // normal would also push down and cancel the climb at the foot of a wall.
      const gap = hit.toi - CAPSULE_RADIUS - 0.04;
      const hl = Math.hypot(n.x, n.z) || 1;
      const pull = clamp(gap, -0.05, 0.08) * 0.5;
      d.x -= (n.x / hl) * pull;
      d.z -= (n.z / hl) * pull;
    } else {
      this.lostWall += 1;
      if (this.lostWall > 2) {
        const goingUp = input.forward > 0 || this.climbJump > 0;
        if (goingUp && this.tryMantle(center)) return center;
        return this.dropFromWall(center, 0.5);
      }
    }

    this.configure('climb');
    this.ctrl.computeColliderMovement(this.collider, d);
    const move = this.ctrl.computedMovement();
    center.set(center.x + move.x, center.y + move.y, center.z + move.z);
    this.safetyNet(center);
    this.body.setNextKinematicTranslation(center);

    // Climbed down to walkable ground. (The controller's own "grounded" flag
    // counts the wall as ground while climbing, so probe below the feet.)
    if (input.forward < 0 && this.walkableGroundBelow(center, 0.25)) {
      this.mode = 'ground';
      this.climbCooldown = 0.5;
    }
    // Climbed into water.
    const surface = waterSurfaceAt(center.x, center.z);
    if (
      input.forward < 0 &&
      surface - (center.y - FOOT_OFFSET) > 0.3 &&
      surface - sampleHeight(center.x, center.z) > SWIM_ENTER_DEPTH
    ) {
      this.mode = 'swim';
      this.climbCooldown = 0.5;
    }

    this.facing = Math.atan2(-n.x, -n.z);
    return center;
  }

  private dropFromWall(center: Vector3, push: number): Vector3 {
    const n = this.wallNormal;
    this.vel.set(n.x * push, 0, n.z * push);
    this.mode = 'air';
    this.noClimbUntilGrounded = this.exhausted;
    this.climbCooldown = 0.5;
    return center;
  }

  /** Pull up over a ledge: find walkable ground just above and behind the wall top. */
  private tryMantle(center: Vector3): boolean {
    const n = this.wallNormal;
    const ox = center.x - n.x * (CAPSULE_RADIUS + 0.7);
    const oz = center.z - n.z * (CAPSULE_RADIUS + 0.7);
    const oy = center.y + 1.6;
    const hit = this.castRay(ox, oy, oz, 0, -1, 0, 3.5);
    if (!hit || hit.normal.y < 0.6) return false;
    const groundY = oy - hit.toi;
    this.mantleFrom.copy(center);
    this.mantleTo.set(ox, groundY + FOOT_OFFSET + 0.05, oz);
    this.mantleT = 0;
    this.mode = 'mantle';
    this.vel.set(0, 0, 0);
    return true;
  }

  private updateMantle(dt: number, center: Vector3): Vector3 {
    this.mantleT = Math.min(1, this.mantleT + dt / MANTLE_TIME);
    const t = this.mantleT;
    // Up first, then forward.
    const up = Math.min(1, t * 1.6);
    const fwd = Math.max(0, (t - 0.35) / 0.65);
    center.set(
      MathUtils.lerp(this.mantleFrom.x, this.mantleTo.x, fwd),
      MathUtils.lerp(this.mantleFrom.y, this.mantleTo.y, up),
      MathUtils.lerp(this.mantleFrom.z, this.mantleTo.z, fwd),
    );
    this.body.setNextKinematicTranslation(center);
    if (t >= 1) {
      this.mode = 'ground';
      this.climbCooldown = 0.4;
    }
    return center;
  }

  // ---------------------------------------------------------------- helpers

  private updateStamina(dt: number, draining: boolean, onGround: boolean) {
    if (draining) {
      const rate = this.mode === 'swim' ? SWIM_FAST_DRAIN : SPRINT_DRAIN;
      this.stamina = Math.max(0, this.stamina - rate * dt);
      this.regenDelay = REGEN_DELAY;
      if (this.stamina <= 0) this.exhausted = true;
    } else if (onGround) {
      this.regenDelay = Math.max(0, this.regenDelay - dt);
      if (this.regenDelay <= 0) this.stamina = Math.min(1, this.stamina + REGEN * dt);
    }
    if (this.exhausted && this.stamina >= EXHAUSTED_RECOVER) this.exhausted = false;
  }

  private walkableGroundBelow(center: Vector3, tolerance: number): boolean {
    const hit = this.castRay(center.x, center.y, center.z, 0, -1, 0, FOOT_OFFSET + tolerance);
    return hit !== null && hit.normal.y > 0.7;
  }

  private heightAboveSurface(center: Vector3): number {
    const ground = Math.max(sampleHeight(center.x, center.z), waterSurfaceAt(center.x, center.z));
    return center.y - FOOT_OFFSET - ground;
  }

  /** Never end up below the terrain (e.g. after a bad frame). */
  private safetyNet(center: Vector3) {
    const ground = sampleHeight(center.x, center.z);
    if (center.y - FOOT_OFFSET < ground - 1.5) {
      center.y = ground + FOOT_OFFSET + 0.2;
      this.vel.y = 0;
    }
  }

  private configure(mode: MoveMode) {
    const key = mode === 'climb' ? 'climb' : mode === 'ground' ? 'ground' : 'free';
    if (this.configuredFor === key) return;
    this.configuredFor = key;
    const c = this.ctrl;
    if (key === 'climb') {
      // Moving along a steep wall must not be blocked by slope limits.
      c.setMaxSlopeClimbAngle(MathUtils.degToRad(89));
      c.setMinSlopeSlideAngle(MathUtils.degToRad(89));
      c.disableAutostep();
      c.disableSnapToGround();
    } else {
      c.setMaxSlopeClimbAngle(MathUtils.degToRad(50));
      c.setMinSlopeSlideAngle(MathUtils.degToRad(60));
      c.enableAutostep(0.45, 0.25, true);
      if (key === 'ground') c.enableSnapToGround(0.5);
      else c.disableSnapToGround();
    }
  }

  /** Ray cast that ignores the player; returns world-space normal (facing the ray). */
  private castRay(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
  ): { toi: number; normal: { x: number; y: number; z: number } } | null {
    this.ray.origin = { x: ox, y: oy, z: oz };
    this.ray.dir = { x: dx, y: dy, z: dz };
    const hit = this.world.castRayAndGetNormal(
      this.ray,
      maxDist,
      true,
      undefined,
      undefined,
      this.collider,
      this.body,
      (c) => isClimbableOrSolid(c),
    );
    if (!hit) return null;
    let { x, y, z } = hit.normal;
    if (x * dx + y * dy + z * dz > 0) {
      x = -x;
      y = -y;
      z = -z;
    }
    return { toi: hit.timeOfImpact, normal: { x, y, z } };
  }

  /** Exposed for the camera: distance to the first obstacle along a ray. */
  obstacleDistance(origin: Vector3, dir: Vector3, maxDist: number): number {
    this.ray.origin = { x: origin.x, y: origin.y, z: origin.z };
    this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = this.world.castRay(this.ray, maxDist, true, undefined, undefined, this.collider, this.body);
    return hit ? hit.timeOfImpact : maxDist;
  }

  get rapier(): Rapier {
    return this.R;
  }
}

/** Only colliders on bodies marked `climbable` count as walls to climb. */
function isClimbableOrSolid(c: Collider): boolean {
  const data = c.parent()?.userData as { climbable?: boolean } | undefined;
  return data?.climbable === true;
}
