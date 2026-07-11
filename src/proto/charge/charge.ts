import type { AppContext } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
import type { Mechanic, RampState, StepResult } from '../shared/mechanic';
import { circleRectGap, clamp } from '../shared/math';
import { CHARGE, CHARGE_CONFIG } from './config';

interface Wall {
  worldX: number;
  gapY: number;
  gap: number;
  minGap: number;
  passed: boolean;
}

interface Pickup {
  worldX: number;
  y: number;
  taken: boolean;
}

/** Pure wall generator — exported for the determinism test. */
export function nextWall(rng: Rng, worldX: number, gap: number, height: number): Wall {
  const gapY = rng.range(CHARGE.edgeMargin, height - gap - CHARGE.edgeMargin);
  return { worldX, gapY, gap, minGap: Infinity, passed: false };
}

/**
 * CHARGE — hold to charge, release to launch. Hold length sets launch power
 * (analog nuance in one finger). While charging the comet near-floats to buy
 * aiming time; released, it dashes up and then falls under gravity. Thread the
 * scrolling gaps.
 */
export class ChargeMechanic implements Mechanic {
  readonly cfg = CHARGE_CONFIG;

  private rng!: Rng;
  private cameraX = 0;
  private y = 0;
  private prevY = 0;
  private vy = 0;
  private charging = false;
  private chargeStartMs = 0;
  private lastSpawnX = 0;
  private walls: Wall[] = [];
  private pickups: Pickup[] = [];

  reset(rng: Rng, ctx: AppContext): void {
    this.rng = rng;
    this.cameraX = 0;
    this.y = this.prevY = ctx.height * 0.5;
    this.vy = 0;
    this.charging = false;
    this.walls = [];
    this.pickups = [];
    this.lastSpawnX = ctx.width * 0.95;
    this.fill(ctx, this.cfg.ramp.baseGap);
  }

  onPress(): void {
    this.charging = true;
    this.chargeStartMs = performance.now();
  }

  onRelease(holdMs: number): void {
    this.charging = false;
    const charge = clamp(holdMs / (CHARGE.chargeTimeMax * 1000), 0, 1);
    this.vy = -(CHARGE.impulseMin + (CHARGE.impulseMax - CHARGE.impulseMin) * charge);
  }

  update(dt: number, ramp: RampState, ctx: AppContext): StepResult {
    this.cameraX += ramp.speed * dt;

    const g = this.charging ? CHARGE.chargeGravity : CHARGE.gravity;
    this.prevY = this.y;
    this.vy += g * dt;
    this.y += this.vy * dt;

    this.fill(ctx, ramp.gap);

    const cometX = ctx.width * CHARGE.cometX;
    const r = CHARGE.cometR;
    let dead = false;
    let nearMisses = 0;
    let pickups = 0;

    // top/bottom bounds
    if (this.y - r <= 0 || this.y + r >= ctx.height) dead = true;

    for (const wall of this.walls) {
      const sx = wall.worldX - this.cameraX;
      if (sx + CHARGE.wallW < -20) continue;
      const topH = wall.gapY;
      const botY = wall.gapY + wall.gap;
      const botH = ctx.height - botY;
      const gTop = circleRectGap(cometX, this.y, r, sx, 0, CHARGE.wallW, topH);
      const gBot = circleRectGap(cometX, this.y, r, sx, botY, CHARGE.wallW, botH);
      if (gTop <= 0 || gBot <= 0) dead = true;
      if (sx < cometX + 60 && sx + CHARGE.wallW > cometX - 60) {
        wall.minGap = Math.min(wall.minGap, gTop, gBot);
      }
      if (!wall.passed && sx + CHARGE.wallW < cometX - r) {
        wall.passed = true;
        if (wall.minGap > 0 && wall.minGap <= this.cfg.nearMissThresholdPx) nearMisses++;
      }
    }

    for (const p of this.pickups) {
      if (p.taken) continue;
      const sx = p.worldX - this.cameraX;
      if (Math.hypot(cometX - sx, this.y - p.y) <= r + CHARGE.pickupR) {
        p.taken = true;
        pickups++;
      }
    }

    return { advanced: ramp.speed * dt, pickups, nearMisses, dead };
  }

  render(alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.fillStyle = PALETTE.bg;
    c.fillRect(0, 0, w, h);

    // walls
    c.fillStyle = PALETTE.accentAlt;
    for (const wall of this.walls) {
      const sx = wall.worldX - this.cameraX;
      if (sx > w + 20 || sx + CHARGE.wallW < -20) continue;
      c.fillRect(sx, 0, CHARGE.wallW, wall.gapY);
      const botY = wall.gapY + wall.gap;
      c.fillRect(sx, botY, CHARGE.wallW, h - botY);
    }

    // pickups
    c.fillStyle = PALETTE.fg;
    for (const p of this.pickups) {
      if (p.taken) continue;
      const sx = p.worldX - this.cameraX;
      if (sx < -20 || sx > w + 20) continue;
      c.beginPath();
      c.arc(sx, p.y, CHARGE.pickupR, 0, Math.PI * 2);
      c.fill();
    }

    // comet
    const drawY = this.prevY + (this.y - this.prevY) * alpha;
    const cx = w * CHARGE.cometX;
    c.fillStyle = PALETTE.accent;
    c.beginPath();
    c.arc(cx, drawY, CHARGE.cometR, 0, Math.PI * 2);
    c.fill();

    // charge meter
    if (this.charging) {
      const charge = clamp(
        (performance.now() - this.chargeStartMs) / (CHARGE.chargeTimeMax * 1000),
        0,
        1,
      );
      c.fillStyle = 'rgba(123,131,166,0.5)';
      c.fillRect(cx - 26, drawY - 30, 52, 6);
      c.fillStyle = charge >= 1 ? PALETTE.accentAlt : PALETTE.accent;
      c.fillRect(cx - 26, drawY - 30, 52 * charge, 6);
    }
  }

  private fill(ctx: AppContext, gap: number): void {
    const ahead = this.cameraX + ctx.width * 2;
    while (this.lastSpawnX < ahead) {
      this.lastSpawnX += this.rng.range(CHARGE.spawnMinGap, CHARGE.spawnMaxGap);
      const wall = nextWall(this.rng, this.lastSpawnX, gap, ctx.height);
      this.walls.push(wall);
      if (this.rng.bool(CHARGE.pickupChance)) {
        // place near a gap edge — risky reward
        const edge = this.rng.bool() ? wall.gapY + 22 : wall.gapY + wall.gap - 22;
        this.pickups.push({ worldX: this.lastSpawnX + CHARGE.wallW * 0.5, y: edge, taken: false });
      }
    }
    this.walls = this.walls.filter((wl) => wl.worldX - this.cameraX > -60);
    this.pickups = this.pickups.filter((p) => p.worldX - this.cameraX > -60);
  }
}
