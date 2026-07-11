import type { AppContext } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
import { glowPickup, glowRect } from '../../ui/shapes';
import type { CometView, Mechanic, RampState, StepResult } from '../shared/mechanic';
import { circleRectGap, clamp } from '../shared/math';
import { FLIP, FLIP_CONFIG } from './config';

type Surface = 'floor' | 'ceil';

interface Obstacle {
  worldX: number;
  surface: Surface;
  h: number;
  minGap: number;
  passed: boolean;
}

interface Pickup {
  worldX: number;
  y: number;
  taken: boolean;
  minGap: number;
}

/** Pure obstacle generator — exported for the determinism test. */
export function nextObstacle(rng: Rng, worldX: number): Obstacle {
  return {
    worldX,
    surface: rng.bool() ? 'floor' : 'ceil',
    h: rng.range(FLIP.obstacleMinH, FLIP.obstacleMaxH),
    minGap: Infinity,
    passed: false,
  };
}

/**
 * FLIP — gravity-flip lane runner. The comet accelerates toward the active
 * surface; a tap flips gravity so it peels off and falls to the opposite
 * surface. Obstacles jut from floor and ceiling; flip through the gaps.
 */
export class FlipMechanic implements Mechanic {
  readonly cfg = FLIP_CONFIG;

  private rng!: Rng;
  private cameraX = 0;
  private y = 0;
  private prevY = 0;
  private vy = 0;
  private gravitySign = 1; // +1 → floor, -1 → ceiling
  private lastSpawnX = 0;
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];

  reset(rng: Rng, ctx: AppContext): void {
    this.rng = rng;
    this.cameraX = 0;
    this.gravitySign = 1;
    this.vy = 0;
    this.y = this.prevY = this.floorY(ctx);
    this.obstacles = [];
    this.pickups = [];
    this.lastSpawnX = ctx.width * 0.9;
    this.fill(ctx);
  }

  onPress(): void {
    this.gravitySign *= -1; // flip
  }

  onRelease(): void {
    /* one-touch: flip is on press only */
  }

  update(dt: number, ramp: RampState, ctx: AppContext): StepResult {
    this.cameraX += ramp.speed * dt;

    // physics
    this.prevY = this.y;
    this.vy += FLIP.gravity * this.gravitySign * dt;
    this.y += this.vy * dt;
    const fY = this.floorY(ctx);
    const cY = this.ceilY();
    if (this.gravitySign > 0 && this.y >= fY) {
      this.y = fY;
      this.vy = 0;
    } else if (this.gravitySign < 0 && this.y <= cY) {
      this.y = cY;
      this.vy = 0;
    }
    this.y = clamp(this.y, cY, fY);

    this.fill(ctx);

    const cometX = ctx.width * FLIP.cometX;
    const r = FLIP.cometR;
    let nearMisses = 0;
    let pickups = 0;
    let dead = false;

    for (const o of this.obstacles) {
      const sx = o.worldX - this.cameraX;
      if (sx + FLIP.obstacleW < -20) continue;
      const ry = o.surface === 'floor' ? ctx.height - FLIP.laneMargin - o.h : FLIP.laneMargin;
      const gap = circleRectGap(cometX, this.y, r, sx, ry, FLIP.obstacleW, o.h);
      if (gap <= 0) dead = true;
      // track closest approach while the obstacle is near the comet's column
      if (sx < cometX + 60 && sx + FLIP.obstacleW > cometX - 60) {
        o.minGap = Math.min(o.minGap, gap);
      }
      if (!o.passed && sx + FLIP.obstacleW < cometX - r) {
        o.passed = true;
        if (o.minGap > 0 && o.minGap <= this.cfg.nearMissThresholdPx) nearMisses++;
      }
    }

    for (const p of this.pickups) {
      if (p.taken) continue;
      const sx = p.worldX - this.cameraX;
      const d = Math.hypot(cometX - sx, this.y - p.y);
      if (d <= r + FLIP.pickupR) {
        p.taken = true;
        pickups++;
      }
    }

    return { advanced: ramp.speed * dt, pickups, nearMisses, dead };
  }

  render(_alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;

    // lane bands (surfaces the comet clings to)
    const band = c.createLinearGradient(0, 0, 0, FLIP.laneMargin);
    band.addColorStop(0, 'rgba(77,225,193,0.16)');
    band.addColorStop(1, 'rgba(77,225,193,0)');
    c.fillStyle = band;
    c.fillRect(0, 0, w, FLIP.laneMargin);
    const band2 = c.createLinearGradient(0, h - FLIP.laneMargin, 0, h);
    band2.addColorStop(0, 'rgba(77,225,193,0)');
    band2.addColorStop(1, 'rgba(77,225,193,0.16)');
    c.fillStyle = band2;
    c.fillRect(0, h - FLIP.laneMargin, w, FLIP.laneMargin);

    for (const o of this.obstacles) {
      const sx = o.worldX - this.cameraX;
      if (sx > w + 20 || sx + FLIP.obstacleW < -20) continue;
      const ry = o.surface === 'floor' ? h - FLIP.laneMargin - o.h : FLIP.laneMargin;
      glowRect(c, sx, ry, FLIP.obstacleW, o.h, PALETTE.accentAlt);
    }

    for (const p of this.pickups) {
      if (p.taken) continue;
      const sx = p.worldX - this.cameraX;
      if (sx < -20 || sx > w + 20) continue;
      glowPickup(c, sx, p.y, FLIP.pickupR, PALETTE.accent, this.cameraX * 0.02 + sx * 0.05);
    }
  }

  cometView(ctx: AppContext, alpha: number): CometView {
    const drawY = this.prevY + (this.y - this.prevY) * alpha;
    // squash toward the direction of travel
    const stretch = clamp(1 + Math.abs(this.vy) / 2200, 1, 1.5);
    return { x: ctx.width * FLIP.cometX, y: drawY, stretch, angle: Math.PI / 2 };
  }

  private floorY(ctx: AppContext): number {
    return ctx.height - FLIP.laneMargin - FLIP.cometR;
  }
  private ceilY(): number {
    return FLIP.laneMargin + FLIP.cometR;
  }

  private fill(ctx: AppContext): void {
    // keep the field populated a screen-width ahead of the camera
    const ahead = this.cameraX + ctx.width * 2;
    while (this.lastSpawnX < ahead) {
      const spacing = this.rng.range(FLIP.spawnMinGap, FLIP.spawnMaxGap);
      this.lastSpawnX += spacing;
      const o = nextObstacle(this.rng, this.lastSpawnX);
      this.obstacles.push(o);
      if (this.rng.bool(FLIP.pickupChance)) {
        // place pickup on the opposite surface's danger lane just past the wall
        const py =
          o.surface === 'floor'
            ? ctx.height - FLIP.laneMargin - o.h - 26
            : FLIP.laneMargin + o.h + 26;
        this.pickups.push({
          worldX: this.lastSpawnX + FLIP.obstacleW * 0.5,
          y: clamp(py, this.ceilY(), this.floorY(ctx)),
          taken: false,
          minGap: Infinity,
        });
      }
    }
    // prune off-screen-left
    this.obstacles = this.obstacles.filter((o) => o.worldX - this.cameraX > -60);
    this.pickups = this.pickups.filter((p) => p.worldX - this.cameraX > -60);
  }
}
